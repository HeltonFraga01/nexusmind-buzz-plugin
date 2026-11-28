#!/usr/bin/env python3
"""Descoberta Dinâmica + Eval Real de Tool-Calling nas 4 APIs do NexusMind Gateway.

Consulta ao vivo `GET /v1/models` nos 4 grupos canônicos (`nexusmind_openai`,
`nexusmind_anthropic`, `nexusmind_antigravity`, `nexusmind_grok`), extrai todos os
modelos ativos (respeitando `disabledModels`, `blockedModels` e `vipModels` de
~/.buzz/.scratch/nexusmind-routing-policy.json), roda sonda real de Tool-Calling +
Schema em paralelo controlado e reconstrói atomicamente:
  1. ~/.buzz/.scratch/model-control-plane.json (consumido ao vivo pelo local_router.py)
  2. ~/.buzz/.scratch/router-discovery-report.json (exibido na aba Roteador Local)
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
import sqlite3
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UPSTREAM_BASE = "https://api.nexusmind.digital"

CANONICAL_GROUP_KEYS: dict[str, str] = {
    "nexusmind_openai": "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    "nexusmind_anthropic": "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    "nexusmind_antigravity": "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    "nexusmind_grok": "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
}

PLATFORM_BY_PROVIDER: dict[str, str] = {
    "nexusmind_openai": "openai",
    "nexusmind_anthropic": "anthropic",
    "nexusmind_antigravity": "antigravity",
    "nexusmind_grok": "grok",
}

UNSUPPORTED_SUBSTRINGS = (
    "tab_flash",
    "tab_jump",
    "autocomplete",
    "fim-",
    "embedding",
    "rerank",
    "whisper",
    "tts",
    "imagen",
    "-image",
    "image-preview",
    "dall-e",
    "moderation",
    "safety-guard",
    "audio-preview",
    "realtime-preview",
    "imagine-video",
    "imagine-image",
    "prompt-guard",
    "safeguard",
    "orpheus",
)

UNSUPPORTED_PREFIXES = (
    "pol/",
    "pollinations/",
    "auto/",
    "ddgw/",
    "chat_",
)


def _resolve_buzz_dir() -> Path:
    env_dir = os.environ.get("ORGFY_BUZZ_DIR")
    if env_dir:
        return Path(env_dir)
    real_buzz = Path("/Users/heltonfraga/.buzz")
    if real_buzz.exists():
        return real_buzz
    return Path.home() / ".buzz"


def _resolve_sessions_db() -> Path:
    real_db = Path("/Users/heltonfraga/.local/share/goose/sessions/sessions.db")
    if real_db.exists():
        return real_db
    return Path.home() / ".local" / "share" / "goose" / "sessions" / "sessions.db"


def _ssl_context() -> ssl.SSLContext | None:
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def is_garbage_or_non_agent(model_id: str) -> bool:
    m = (model_id or "").strip().lower()
    if not m or m in ("haiku", "flash", "economy", "nex-n2-pro"):
        return True
    if m.endswith(":batch"):
        return True
    if any(m.startswith(p) for p in UNSUPPORTED_PREFIXES):
        return True
    if any(s in m for s in UNSUPPORTED_SUBSTRINGS):
        return True
    return False


def is_free_model(model_id: str) -> bool:
    m = (model_id or "").strip().lower()
    return ":free" in m or "-free" in m or "/free" in m or m.endswith("free")


def load_api_keys(buzz_dir: Path) -> dict[str, str]:
    keys = dict(CANONICAL_GROUP_KEYS)
    for ap in (buzz_dir / ".pi" / "auth.json", buzz_dir / ".pi" / "agent" / "auth.json"):
        if ap.exists():
            try:
                parsed = json.loads(ap.read_text(encoding="utf-8"))
                if isinstance(parsed, dict):
                    for pid in CANONICAL_GROUP_KEYS:
                        k = (parsed.get(pid) or {}).get("key") if isinstance(parsed.get(pid), dict) else None
                        if isinstance(k, str) and k.strip():
                            keys[pid] = k.strip()
                break
            except Exception:
                pass
    return keys


def load_policy(scratch_dir: Path) -> tuple[set[str], set[str], set[str], bool, dict[str, Any]]:
    pol_path = scratch_dir / "nexusmind-routing-policy.json"
    pol: dict[str, Any] = {}
    if pol_path.exists():
        try:
            pol = json.loads(pol_path.read_text(encoding="utf-8"))
        except Exception:
            pol = {}
    vp = pol.get("vipPolicy") if isinstance(pol.get("vipPolicy"), dict) else {}
    blocked: set[str] = set()
    for arr in (pol.get("blockedModels"), pol.get("disabledModels"), vp.get("blockedModels")):
        if isinstance(arr, list):
            for x in arr:
                s = str(x or "").strip().lower()
                if s:
                    blocked.add(s)
    vip: set[str] = set()
    for arr in (pol.get("vipModels"), vp.get("vipModels")):
        if isinstance(arr, list):
            for x in arr:
                s = str(x or "").strip().lower()
                if s:
                    vip.add(s)
    auto_overrides: set[str] = set()
    for arr in (pol.get("explicitAutoOverrides"), vp.get("explicitAutoOverrides")):
        if isinstance(arr, list):
            for x in arr:
                s = str(x or "").strip().lower()
                if s:
                    auto_overrides.add(s)
    auto_protect_anthropic = vp.get("autoProtectAnthropic", True) is not False
    return blocked, vip, auto_overrides, auto_protect_anthropic, pol


def load_nm_usage(scratch_dir: Path) -> tuple[int, dict[str, dict[str, Any]]]:
    p = scratch_dir / "nm_usage_summary.json"
    if not p.exists():
        return 0, {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("byModel"), dict):
            return int(data.get("sampleSize") or 0), data["byModel"]
    except Exception:
        pass
    return 0, {}


def load_prod_24h() -> dict[str, dict[str, Any]]:
    db = _resolve_sessions_db()
    stats: dict[str, dict[str, Any]] = {}
    if not db.exists():
        return stats
    try:
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id, s.model_config_json
            FROM sessions s
            WHERE s.updated_at >= datetime('now', '-24 hours')
            """
        )
        sess_to_model: dict[str, str] = {}
        for sid, mjson in cur.fetchall():
            if not mjson:
                continue
            try:
                mj = json.loads(mjson)
                mname = str(mj.get("model_name") or mj.get("model") or "").strip()
            except Exception:
                continue
            if mname:
                sess_to_model[sid] = mname
                stats.setdefault(mname, {"turns24h": 0, "errorTurns24h": 0})
        if sess_to_model:
            placeholders = ",".join("?" for _ in sess_to_model)
            cur.execute(
                f"SELECT session_id, content_json FROM messages WHERE session_id IN ({placeholders}) AND role = 'assistant'",
                list(sess_to_model.keys()),
            )
            for sid, cjson in cur.fetchall():
                mname = sess_to_model.get(sid)
                if not mname:
                    continue
                stats[mname]["turns24h"] += 1
                low = (cjson or "").lower()
                if any(k in low for k in ("ran into this error", "http 503", "http 429", "malformed_function_call", "no available accounts")):
                    stats[mname]["errorTurns24h"] += 1
        conn.close()
    except Exception:
        pass
    for st in stats.values():
        t = st["turns24h"]
        st["successRate24hPct"] = round(((t - st["errorTurns24h"]) / t) * 100.0, 1) if t > 0 else None
    return stats


def discover_models_from_4_apis(api_keys: dict[str, str], upstream_base: str = UPSTREAM_BASE) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Consulta GET /v1/models em paralelo nos 4 grupos e retorna (catalog_by_model, api_summary)."""
    ctx_ssl = _ssl_context() if upstream_base.startswith("https://") else None
    catalog: dict[str, dict[str, Any]] = {}
    api_summary: dict[str, dict[str, Any]] = {}

    def _fetch_group(gid: str, key: str) -> tuple[str, list[dict[str, Any]], str | None]:
        req = urllib.request.Request(
            f"{upstream_base.rstrip('/')}/v1/models",
            headers={"Authorization": f"Bearer {key}", "User-Agent": "NexusMindDiscovery/2.0"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=15, context=ctx_ssl) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                items = body.get("data") if isinstance(body, dict) else []
                return gid, items if isinstance(items, list) else [], None
        except Exception as exc:
            return gid, [], str(exc)[:140]

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(_fetch_group, gid, key) for gid, key in api_keys.items()]
        for fut in concurrent.futures.as_completed(futs):
            gid, items, err = fut.result()
            api_summary[gid] = {
                "provider": gid,
                "platform": PLATFORM_BY_PROVIDER.get(gid, "openai"),
                "online": err is None,
                "rawCount": len(items),
                "error": err,
            }
            for item in items:
                mid = str(item.get("id") or "").strip()
                if not mid:
                    continue
                if mid not in catalog:
                    catalog[mid] = {
                        "model": mid,
                        "provider": gid,
                        "providers": [gid],
                        "owned_by": item.get("owned_by"),
                        "context_window": item.get("context_window") or item.get("max_context_length"),
                        "max_tokens": item.get("max_tokens") or item.get("max_output_tokens"),
                        "pricing": item.get("pricing"),
                        "created": item.get("created"),
                    }
                else:
                    if gid not in catalog[mid]["providers"]:
                        catalog[mid]["providers"].append(gid)
    return catalog, api_summary


def probe_tool_calling(
    model_id: str,
    provider_id: str,
    api_key: str,
    upstream_base: str = UPSTREAM_BASE,
    timeout: float = 12.0,
) -> dict[str, Any]:
    """Sonda rápida e real de Tool-Calling + Schema JSON (1 chamada por modelo)."""
    is_anth = provider_id == "nexusmind_anthropic"
    url = f"{upstream_base.rstrip('/')}{'/v1/messages' if is_anth else '/v1/chat/completions'}"
    headers = {"Content-Type": "application/json", "User-Agent": "NexusMindDiscoveryEval/2.0"}
    prompt = "Chame exclusivamente a ferramenta check_service_health com service='orgfy' e check_mode='quick'."

    if is_anth:
        headers.update({
            "x-api-key": api_key,
            "Authorization": f"Bearer {api_key}",
            "anthropic-version": "2023-06-01",
        })
        body: dict[str, Any] = {
            "model": model_id,
            "max_tokens": 200,
            "tools": [
                {
                    "name": "check_service_health",
                    "description": "Verifica a saúde operacional de um serviço",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "service": {"type": "string"},
                            "check_mode": {"type": "string", "enum": ["quick", "deep"]},
                        },
                        "required": ["service", "check_mode"],
                    },
                }
            ],
            "messages": [{"role": "user", "content": prompt}],
        }
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": model_id,
            "max_tokens": 200,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "check_service_health",
                        "description": "Verifica a saúde operacional de um serviço",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "service": {"type": "string"},
                                "check_mode": {"type": "string", "enum": ["quick", "deep"]},
                            },
                            "required": ["service", "check_mode"],
                        },
                    },
                }
            ],
            "tool_choice": "auto",
            "messages": [{"role": "user", "content": prompt}],
        }

    t0 = time.time()
    ctx_ssl = _ssl_context() if url.startswith("https://") else None
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=timeout, context=ctx_ssl) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
            ms = int((time.time() - t0) * 1000)
            called_args: list[dict[str, Any]] = []
            if is_anth:
                for b in raw.get("content") or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "check_service_health":
                        if isinstance(b.get("input"), dict):
                            called_args.append(b["input"])
            else:
                msg = (raw.get("choices") or [{}])[0].get("message") or {}
                for tc in msg.get("tool_calls") or []:
                    fn = tc.get("function") or {}
                    if fn.get("name") == "check_service_health":
                        a_raw = fn.get("arguments")
                        try:
                            parsed_a = json.loads(a_raw) if isinstance(a_raw, str) else a_raw
                        except Exception:
                            parsed_a = {}
                        if isinstance(parsed_a, dict):
                            called_args.append(parsed_a)

            tool_ok = len(called_args) > 0
            schema_ok = any(
                str(a.get("service") or "").strip().lower() == "orgfy"
                and str(a.get("check_mode") or "").strip().lower() in ("quick", "deep")
                for a in called_args
            )
            return {
                "online": True,
                "toolCallOk": tool_ok and schema_ok,
                "toolCallRate": 1.0 if tool_ok else 0.0,
                "schemaFidelity": 1.0 if schema_ok else 0.0,
                "latencyMs": ms,
                "error": None if (tool_ok and schema_ok) else ("no_tool_call" if not tool_ok else "invalid_schema"),
            }
    except urllib.error.HTTPError as err:
        err_txt = ""
        try:
            err_txt = err.read().decode("utf-8", errors="replace")[:120]
        except Exception:
            pass
        return {
            "online": False,
            "toolCallOk": False,
            "toolCallRate": 0.0,
            "schemaFidelity": 0.0,
            "latencyMs": int((time.time() - t0) * 1000),
            "error": f"HTTP {err.code}: {err_txt}".strip(": "),
        }
    except Exception as exc:
        return {
            "online": False,
            "toolCallOk": False,
            "toolCallRate": 0.0,
            "schemaFidelity": 0.0,
            "latencyMs": int((time.time() - t0) * 1000),
            "error": str(exc)[:120],
        }


def score_for_tier(model_id: str, tier: str, latency_ms: int | None, calls: int, prod_pct: float | None) -> float:
    m = model_id.lower()
    cap = 66.0
    if any(k in m for k in ("opus", "gpt-6", "gpt-5", "sonnet-4-6", "sonnet-5", "hydrogen-high", "pro-high", "480b", "grok-4.3", "grok-4.20-multi-agent", "grok-4.6", "grok-4.7")):
        cap = 93.0
    elif any(k in m for k in ("sonnet", "codex", "qwen3-coder", "codestral", "mistral-large", "hydrogen-sonar", "grok-4.20", "gemini-3.8-flash-high", "gemini-3.5-flash-high", "gemini-2.5-pro", "gemini-3.1-pro", "nemotron-3.5-super")):
        cap = 87.0
    elif any(k in m for k in ("gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash", "hydrogen-low", "haiku", "nemotron")):
        cap = 80.0
    elif any(k in m for k in ("lite", "mini", "nano")):
        cap = 70.0

    tm = 75.0
    if tier in ("tier1_fast", "decision"):
        if any(k in m for k in ("flash", "fast", "lite", "haiku", "mini")) and "thinking" not in m:
            tm = 96.0
        elif any(k in m for k in ("codex", "codestral", "non-reasoning")):
            tm = 86.0
        elif any(k in m for k in ("opus", "thinking", "reasoning", "480b")):
            tm = 48.0
    elif tier == "tier2_balanced":
        if any(k in m for k in ("codex", "coder", "codestral", "sonnet", "gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.5-flash", "mistral-large", "grok-4.20")):
            tm = 95.0
    elif tier == "tier3_frontier":
        if any(k in m for k in ("opus", "gpt-6", "sonnet", "hydrogen-high", "480b", "mistral-large", "grok-4.3", "grok-4.20-multi-agent", "pro")):
            tm = 96.0
        elif any(k in m for k in ("lite", "mini", "nano")):
            tm = 45.0
    elif tier == "reasoning":
        if any(k in m for k in ("thinking", "reasoning", "opus", "hydrogen-high", "grok-4.20-reasoning", "grok-4.20-multi-agent", "r1", "gpt-6")):
            tm = 97.0
        elif any(k in m for k in ("sonnet", "pro", "480b", "gemini-2.5-flash")):
            tm = 85.0

    speed = 70.0
    if isinstance(latency_ms, int) and latency_ms > 0:
        speed = max(25.0, min(98.0, 100.0 - (latency_ms / 1000.0) * 7.5))
    adoption = min(98.0, math.log10(calls + 1) * 26.0) if calls > 0 else 55.0
    prod = float(prod_pct) if isinstance(prod_pct, (int, float)) else 92.0

    if tier in ("tier1_fast", "decision"):
        score = speed * 0.40 + tm * 0.30 + cap * 0.15 + prod * 0.15
    elif tier in ("tier3_frontier", "reasoning"):
        score = cap * 0.45 + tm * 0.30 + prod * 0.15 + speed * 0.10
    else:
        score = cap * 0.34 + tm * 0.28 + speed * 0.18 + adoption * 0.10 + prod * 0.10
    if is_free_model(model_id):
        score -= 6.0
    return round(max(0.0, min(99.5, score)), 1)


def _interleave_by_provider(rows: list[dict[str, Any]], tier_key: str, limit: int = 5) -> list[dict[str, Any]]:
    ranked = sorted(
        rows,
        key=lambda r: (
            (r.get("tierScores") or {}).get(tier_key, r.get("evalScore", 0)),
            -(r.get("latencyMs") or 999999),
        ),
        reverse=True,
    )
    buckets: dict[str, list[dict[str, Any]]] = {}
    prov_order: list[str] = []
    for r in ranked:
        p = str(r.get("provider") or "nexusmind_openai")
        if p not in buckets:
            buckets[p] = []
            prov_order.append(p)
        buckets[p].append(r)

    out: list[dict[str, Any]] = []
    rnd = 0
    while len(out) < limit:
        added = False
        for p in prov_order:
            if rnd < len(buckets[p]):
                r = buckets[p][rnd]
                sc = (r.get("tierScores") or {}).get(tier_key, r.get("evalScore", 0))
                out.append({"model": r["model"], "provider": r["provider"], "score": sc})
                added = True
                if len(out) >= limit:
                    break
        if not added:
            break
        rnd += 1
    return out


def run_discover_and_eval(
    buzz_dir: Path | None = None,
    upstream_base: str = UPSTREAM_BASE,
    max_models: int = 80,
    force: bool = False,
    workers: int = 4,
) -> dict[str, Any]:
    bdir = buzz_dir or _resolve_buzz_dir()
    scratch = bdir / ".scratch"
    scratch.mkdir(parents=True, exist_ok=True)
    cp_path = scratch / "model-control-plane.json"
    report_path = scratch / "router-discovery-report.json"

    api_keys = load_api_keys(bdir)
    blocked, vip, auto_overrides, auto_protect_anthropic, pol_raw = load_policy(scratch)
    usage_sample, nm_usage = load_nm_usage(scratch)
    prod_24h = load_prod_24h()

    # Carrega control-plane anterior para preservar resultados recentes (< 6h) quando force=False
    prev_cp: dict[str, Any] = {}
    prev_models: dict[str, dict[str, Any]] = {}
    if cp_path.exists():
        try:
            prev_cp = json.loads(cp_path.read_text(encoding="utf-8"))
            for m in prev_cp.get("models") or []:
                if m.get("model"):
                    prev_models[m["model"].lower()] = m
        except Exception:
            pass

    catalog, api_summary = discover_models_from_4_apis(api_keys, upstream_base=upstream_base)

    active_candidates: list[dict[str, Any]] = []
    skipped_disabled = 0
    skipped_garbage = 0
    for mid, meta in catalog.items():
        ml = mid.lower()
        if is_garbage_or_non_agent(mid):
            skipped_garbage += 1
            continue
        if ml in blocked:
            skipped_disabled += 1
            continue
        prov = meta["provider"]
        is_vip = (ml in vip and ml not in auto_overrides) or (
            auto_protect_anthropic and prov == "nexusmind_anthropic" and ml not in auto_overrides
        )
        usage_calls = int((nm_usage.get(mid) or {}).get("calls") or 0)
        active_candidates.append({
            **meta,
            "policyState": "vip" if is_vip else "auto",
            "usageCalls": usage_calls,
        })

    # Prioriza: VIPs, modelos com uso real, pagos antes de :free, intercalando provedores
    active_candidates.sort(
        key=lambda c: (
            1 if c["policyState"] == "vip" else 0,
            1 if not is_free_model(c["model"]) else 0,
            c["usageCalls"],
            c["model"],
        ),
        reverse=True,
    )

    to_eval = active_candidates if max_models <= 0 else active_candidates[:max_models]

    now_ts = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()
    evaluated_rows: list[dict[str, Any]] = []
    tested_now = 0
    reused_cached = 0

    def _eval_one(cand: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        mid = cand["model"]
        ml = mid.lower()
        prov = cand["provider"]
        prev = prev_models.get(ml)
        if not force and prev and prev.get("evalApproved") and prev.get("online"):
            prev_ts = prev.get("testedAtTs") or 0
            if now_ts - float(prev_ts) < 21600:
                row = dict(prev)
                row["policyState"] = cand["policyState"]
                row["eligibleForAuto"] = bool(row.get("evalApproved") and cand["policyState"] == "auto")
                return row, False

        key = api_keys.get(prov) or next(iter(api_keys.values()))
        probe = probe_tool_calling(mid, prov, key, upstream_base=upstream_base)
        calls = cand["usageCalls"]
        prod = prod_24h.get(mid) or {}
        prod_pct = prod.get("successRate24hPct")

        tier_scores = {
            t: score_for_tier(mid, t, probe["latencyMs"], calls, prod_pct) if probe["toolCallOk"] else 0.0
            for t in ("geral", "tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision")
        }
        eval_score = tier_scores["geral"]
        approved = bool(probe["online"] and probe["toolCallOk"] and eval_score >= 70.0)
        row = {
            "model": mid,
            "provider": prov,
            "group": prov,
            "platform": PLATFORM_BY_PROVIDER.get(prov, "openai"),
            "online": probe["online"],
            "evalApproved": approved,
            "toolCallOk": probe["toolCallOk"],
            "eligibleForAuto": bool(approved and cand["policyState"] == "auto"),
            "evalScore": eval_score,
            "qualityScore": int(round(eval_score)),
            "tierScores": tier_scores,
            "toolCallRate": probe["toolCallRate"],
            "schemaFidelity": probe["schemaFidelity"],
            "latencyMs": probe["latencyMs"],
            "calls": calls,
            "isFree": is_free_model(mid),
            "policyState": cand["policyState"],
            "contextWindow": cand.get("context_window"),
            "ownedBy": cand.get("owned_by"),
            "error": probe["error"],
            "testedAt": now_iso,
            "testedAtTs": now_ts,
        }
        return row, True

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(6, workers))) as pool:
        futs = [pool.submit(_eval_one, c) for c in to_eval]
        for fut in concurrent.futures.as_completed(futs):
            row, was_tested = fut.result()
            evaluated_rows.append(row)
            if was_tested:
                tested_now += 1
            else:
                reused_cached += 1

    # Mescla modelos avaliados com anteriores aprovados que ainda não estejam bloqueados
    merged_by_model: dict[str, dict[str, Any]] = {}
    for row in evaluated_rows:
        merged_by_model[row["model"].lower()] = row
    for ml, old in prev_models.items():
        if ml not in merged_by_model and ml not in blocked and not is_garbage_or_non_agent(old.get("model", "")):
            merged_by_model[ml] = old

    all_rows = sorted(
        merged_by_model.values(),
        key=lambda r: (1 if r.get("evalApproved") else 0, float(r.get("evalScore") or 0), -(r.get("latencyMs") or 999999)),
        reverse=True,
    )

    approved_all = [r for r in all_rows if r.get("evalApproved") and r.get("online")]
    auto_pool = [r for r in approved_all if r.get("policyState") == "auto" and r["model"].lower() != "gpt-6.1-terra"]
    vip_pool = [r for r in approved_all if r.get("policyState") == "vip"]
    vip_non_iris = [r for r in vip_pool if r["model"].lower() != "gpt-6.1-terra"]

    # Escadas intercaladas por provedor (garante redundância multi-provedor real!)
    iris_sorted = sorted(
        vip_pool,
        key=lambda r: (1 if r["model"].lower() == "gpt-6.1-terra" else 0, float(r.get("evalScore") or 0)),
        reverse=True,
    )
    tier_groups = {
        "group/vip-iris": [
            {"model": r["model"], "provider": r["provider"], "score": r.get("evalScore", 0)}
            for r in iris_sorted[:5]
        ],
        "group/vip-leadership": _interleave_by_provider(vip_non_iris or auto_pool, "tier3_frontier", 5),
        "group/frontier": _interleave_by_provider(auto_pool, "tier3_frontier", 5),
        "group/reasoning": _interleave_by_provider(auto_pool, "reasoning", 5),
        "group/code": _interleave_by_provider(auto_pool, "tier2_balanced", 5),
        "group/fast": _interleave_by_provider(auto_pool, "tier1_fast", 5),
    }

    # Atualiza atomicamente model-control-plane.json preservando metadados úteis
    cp_out = dict(prev_cp) if isinstance(prev_cp, dict) else {}
    cp_out.update({
        "evalVersion": "discovery-sota-v3",
        "updatedAt": now_iso,
        "usageSampleSize": usage_sample or cp_out.get("usageSampleSize") or 30000,
        "policy": pol_raw or cp_out.get("policy") or {},
        "summary": {
            "totalCatalog4Apis": len(catalog),
            "activeCandidates": len(active_candidates),
            "totalEvaluated": len(all_rows),
            "testedNow": tested_now,
            "reusedCached": reused_cached,
            "approvedCount": len(approved_all),
            "autoEligibleCount": len(auto_pool),
            "vipApprovedCount": len(vip_pool),
            "skippedDisabled": skipped_disabled,
            "skippedGarbage": skipped_garbage,
        },
        "tierFallbackGroups": tier_groups,
        "models": all_rows,
    })

    tmp_cp = cp_path.with_suffix(".json.tmp")
    tmp_cp.write_text(json.dumps(cp_out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_cp.replace(cp_path)

    # Relatório detalhado por API para a aba Roteador Local
    approved_by_prov: dict[str, int] = {}
    for r in approved_all:
        p = str(r.get("provider") or "nexusmind_openai")
        approved_by_prov[p] = approved_by_prov.get(p, 0) + 1
    for gid, info in api_summary.items():
        info["approvedCount"] = approved_by_prov.get(gid, 0)

    report = {
        "ok": True,
        "updatedAt": now_iso,
        "totalCatalog4Apis": len(catalog),
        "activeCandidates": len(active_candidates),
        "testedNow": tested_now,
        "reusedCached": reused_cached,
        "approvedCount": len(approved_all),
        "autoApprovedCount": len(auto_pool),
        "vipApprovedCount": len(vip_pool),
        "skippedDisabled": skipped_disabled,
        "skippedGarbage": skipped_garbage,
        "apis": list(api_summary.values()),
        "tierCounts": {k: len(v) for k, v in tier_groups.items()},
        "topApprovedAuto": [
            {"model": r["model"], "provider": r["provider"], "score": r["evalScore"], "latencyMs": r["latencyMs"]}
            for r in auto_pool[:15]
        ],
    }
    tmp_rep = report_path.with_suffix(".json.tmp")
    tmp_rep.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_rep.replace(report_path)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Descoberta e Eval de Tool-Calling nas 4 APIs do NexusMind")
    parser.add_argument("--max-models", type=int, default=80, help="Máximo de modelos ativos para testar (0 = todos)")
    parser.add_argument("--force", action="store_true", help="Ignora cache de 6h e retesta todos os candidatos")
    parser.add_argument("--workers", type=int, default=4, help="Concorrência máxima de sondas (default: 4)")
    args = parser.parse_args()

    res = run_discover_and_eval(max_models=args.max_models, force=args.force, workers=args.workers)
    print(json.dumps(res, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
