#!/usr/bin/env python3
"""NexusMind Local LLM Router (127.0.0.1:4199) — Zero Dependências Externas.

Integrado nativamente ao `nexusmind-buzz-plugin`.
Lê dinamicamente `tierFallbackGroups` de ~/.buzz/.scratch/model-control-plane.json e expõe
aliases virtuais de Tier para Goose e Pi (`tier/vip-iris`, `tier/diretoria`, `tier/frontier`,
`tier/reasoning`, `tier/code`, `tier/fast`):
  1. Estratégia Priority (preserva Prompt Cache): mantém sempre o #1 enquanto responder HTTP 200.
  2. Failover in-flight (antes do primeiro token): em 503/502/504/429/404/401/403/timeout ou 400
     de tool-calling, abre Circuit Breaker (nível modelo + nível provedor) e tenta #2 -> #5.
  3. VIP Sticky Retry para OrgFy Iris (`tier/vip-iris`): tenta até 2 retries curtos (5s + 5s) no
     próprio `gpt-6.1-terra` antes de acionar a escada fechada VIP. `gpt-6.1-terra` NUNCA vaza
     para tiers não-VIP.
  4. SSE Keepalive + Cancelamento limpo: envia `: keepalive\\n\\n` a cada 15s durante TTFT silencioso
     de modelos de raciocínio e encerra o upstream imediatamente se o cliente desconectar.
  5. Observabilidade + Rotação: `/health`, `/metrics`, `/circuits/reset` e rotação automática de
     ~/.buzz/.scratch/router-telemetry.jsonl (máx 10 MB).
"""
from __future__ import annotations

import argparse
import json
import os
import plistlib
import queue
import signal
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4199
UPSTREAM_BASE = "https://api.nexusmind.digital"
LAUNCHAGENT_LABEL = "com.cortexx.nexusmind.local-router"
MAX_TELEMETRY_BYTES = 10 * 1024 * 1024  # 10 MB

CANONICAL_GROUP_KEYS: dict[str, str] = {
    "nexusmind_openai": "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    "nexusmind_anthropic": "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    "nexusmind_antigravity": "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    "nexusmind_grok": "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
}

TIER_ALIAS_TO_GROUP: dict[str, str] = {
    "tier/vip-iris": "group/vip-iris",
    "group/vip-iris": "group/vip-iris",
    "tier/diretoria": "group/vip-leadership",
    "tier/vip-leadership": "group/vip-leadership",
    "group/vip-leadership": "group/vip-leadership",
    "tier/frontier": "group/frontier",
    "group/frontier": "group/frontier",
    "tier/reasoning": "group/reasoning",
    "group/reasoning": "group/reasoning",
    "tier/code": "group/code",
    "group/code": "group/code",
    "tier/fast": "group/fast",
    "group/fast": "group/fast",
}

VIRTUAL_TIER_SPECS = [
    {"id": "tier/vip-iris", "ctx": 131072, "max_out": 8192},
    {"id": "tier/diretoria", "ctx": 200000, "max_out": 8192},
    {"id": "tier/frontier", "ctx": 1048576, "max_out": 65536},
    {"id": "tier/reasoning", "ctx": 1048576, "max_out": 65536},
    {"id": "tier/code", "ctx": 1048576, "max_out": 65536},
    {"id": "tier/fast", "ctx": 1048576, "max_out": 65536},
]

RETRIABLE_HTTP_CODES = {401, 403, 404, 408, 429, 500, 502, 503, 504}
PROVIDER_OUTAGE_CODES = {401, 403, 502, 503, 504}
VIP_STICKY_TRANSIENT_CODES = {408, 429, 500, 502, 503, 504}


def _resolve_buzz_dir() -> Path:
    env_dir = os.environ.get("ORGFY_BUZZ_DIR")
    if env_dir:
        return Path(env_dir)
    real_buzz = Path("/Users/heltonfraga/.buzz")
    if real_buzz.exists():
        return real_buzz
    return Path.home() / ".buzz"


def _resolve_real_home() -> Path:
    if Path("/Users/heltonfraga/.buzz").exists():
        return Path("/Users/heltonfraga")
    return Path.home()


def _ssl_context() -> ssl.SSLContext | None:
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


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


def infer_provider(model_id: str) -> str:
    m = model_id.lower()
    if "grok" in m and "/" not in m:
        return "nexusmind_grok"
    if "gemini" in m or "antigravity" in m or "thinking" in m or "-hydrogen" in m or "gpt-oss" in m:
        return "nexusmind_antigravity"
    if "claude" in m:
        return "nexusmind_anthropic"
    return "nexusmind_openai"


def is_retriable_error(status: int, body_text: str) -> bool:
    if status in RETRIABLE_HTTP_CODES:
        return True
    low = body_text.lower()
    if any(
        k in low
        for k in (
            "upstream_error",
            "upstream access forbidden",
            "upstream_malformed_function_call",
            "malformed_function_call",
            "no available accounts",
            "ambiguous model",
        )
    ):
        return True
    if status == 400:
        if any(k in low for k in ("tool calling", "no target in combo", "not supported", "unsupported model")):
            return True
    return False


def is_provider_wide_error(status: int, body_text: str) -> bool:
    if status in PROVIDER_OUTAGE_CODES:
        return True
    low = body_text.lower()
    return any(
        k in low
        for k in (
            "no available accounts",
            "upstream access forbidden",
            "service unavailable",
            "bad gateway",
            "gateway timeout",
        )
    )


class RouterState:
    """Mantém cache mtime do Control Plane, Circuit Breaker (modelo + provedor), VIP Sticky Retry e telemetria."""

    def __init__(
        self,
        buzz_dir: Path | None = None,
        upstream_base: str = UPSTREAM_BASE,
        circuit_ttl_sec: float = 180.0,
        provider_circuit_ttl_sec: float = 180.0,
        provider_trip_threshold: int = 2,
        request_timeout_sec: float = 90.0,
        sse_keepalive_sec: float = 15.0,
        vip_sticky_retries: int = 2,
        vip_sticky_delay_sec: float = 5.0,
    ) -> None:
        self.buzz_dir = buzz_dir or _resolve_buzz_dir()
        self.scratch_dir = self.buzz_dir / ".scratch"
        self.control_plane_path = self.scratch_dir / "model-control-plane.json"
        self.routing_policy_path = self.scratch_dir / "nexusmind-routing-policy.json"
        self.telemetry_path = self.scratch_dir / "router-telemetry.jsonl"
        self.upstream_base = upstream_base.rstrip("/")
        self.circuit_ttl_sec = circuit_ttl_sec
        self.provider_circuit_ttl_sec = provider_circuit_ttl_sec
        self.provider_trip_threshold = max(1, provider_trip_threshold)
        self.request_timeout_sec = request_timeout_sec
        self.sse_keepalive_sec = sse_keepalive_sec
        self.vip_sticky_retries = max(0, vip_sticky_retries)
        self.vip_sticky_delay_sec = max(0.0, vip_sticky_delay_sec)
        self.started_at = time.time()

        self._lock = threading.Lock()
        self._cp_mtime: float = 0.0
        self._cp_cache: dict[str, Any] = {}
        self._policy_mtime: float = 0.0
        self._policy_cache: dict[str, Any] = {}
        self._circuit_open_until: dict[str, float] = {}
        self._circuit_reasons: dict[str, str] = {}
        self._provider_open_until: dict[str, float] = {}
        self._provider_reasons: dict[str, str] = {}
        self._provider_recent_failed_models: dict[str, dict[str, float]] = {}
        self.api_keys = load_api_keys(self.buzz_dir)
        self.stats = {
            "total_requests": 0,
            "ok_requests": 0,
            "fallback_recoveries": 0,
            "vip_sticky_recoveries": 0,
            "failed_requests": 0,
        }

    def get_control_plane(self) -> dict[str, Any]:
        if not self.control_plane_path.exists():
            return {}
        try:
            mtime = self.control_plane_path.stat().st_mtime
            with self._lock:
                if mtime != self._cp_mtime or not self._cp_cache:
                    self._cp_cache = json.loads(self.control_plane_path.read_text(encoding="utf-8"))
                    self._cp_mtime = mtime
                return self._cp_cache
        except Exception:
            return self._cp_cache

    def get_routing_policy(self) -> dict[str, Any]:
        if not self.routing_policy_path.exists():
            return {}
        try:
            mtime = self.routing_policy_path.stat().st_mtime
            with self._lock:
                if mtime != self._policy_mtime or not self._policy_cache:
                    self._policy_cache = json.loads(self.routing_policy_path.read_text(encoding="utf-8"))
                    self._policy_mtime = mtime
                return self._policy_cache
        except Exception:
            return self._policy_cache

    def _extract_policy_sets(self) -> tuple[set[str], set[str], set[str], bool]:
        """Retorna (blocked_or_disabled, vip_models, explicit_auto_overrides, auto_protect_anthropic)."""
        pol = self.get_routing_policy()
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
        return blocked, vip, auto_overrides, auto_protect_anthropic

    def _is_model_allowed_in_group(self, model_id: str, provider_id: str, group_key: str) -> bool:
        ml = model_id.strip().lower()
        if not ml:
            return False
        is_iris = group_key == "group/vip-iris"
        is_vip_group = group_key in ("group/vip-iris", "group/vip-leadership")
        if not is_iris and ml == "gpt-6.1-terra":
            return False
        blocked, vip, auto_overrides, auto_protect_anthropic = self._extract_policy_sets()
        # Modelos desativados ou bloqueados nunca entram em nenhum tier
        if ml in blocked:
            return False
        # Em tiers de workers (Pool Auto), exclui modelos marcados como VIP
        if not is_vip_group:
            if ml in vip and ml not in auto_overrides:
                return False
            if auto_protect_anthropic and provider_id == "nexusmind_anthropic" and ml not in auto_overrides:
                return False
        return True

    def get_effective_tier_groups(self) -> dict[str, list[dict[str, Any]]]:
        """Retorna tierFallbackGroups já filtrados ao vivo por blockedModels, disabledModels e vipModels."""
        cp = self.get_control_plane()
        raw_groups = cp.get("tierFallbackGroups") or {}
        out: dict[str, list[dict[str, Any]]] = {}
        for gkey, entries in raw_groups.items():
            if not isinstance(entries, list):
                continue
            filtered: list[dict[str, Any]] = []
            seen: set[str] = set()
            for entry in entries:
                m = str(entry.get("model") or "").strip()
                p = str(entry.get("provider") or infer_provider(m)).strip()
                ml = m.lower()
                if not m or ml in seen:
                    continue
                if not self._is_model_allowed_in_group(m, p, gkey):
                    continue
                seen.add(ml)
                filtered.append(entry)
            out[gkey] = filtered
        return out

    def is_circuit_open(self, model_id: str, now: float | None = None) -> bool:
        now_t = time.time() if now is None else now
        key = model_id.strip().lower()
        with self._lock:
            exp = self._circuit_open_until.get(key)
            if exp is None:
                return False
            if exp <= now_t:
                self._circuit_open_until.pop(key, None)
                self._circuit_reasons.pop(key, None)
                return False
            return True

    def is_provider_circuit_open(self, provider_id: str, now: float | None = None) -> bool:
        now_t = time.time() if now is None else now
        key = provider_id.strip().lower()
        with self._lock:
            exp = self._provider_open_until.get(key)
            if exp is None:
                return False
            if exp <= now_t:
                self._provider_open_until.pop(key, None)
                self._provider_reasons.pop(key, None)
                return False
            return True

    def open_circuit(
        self,
        model_id: str,
        reason: str,
        provider_id: str | None = None,
        provider_wide: bool = False,
    ) -> None:
        now_t = time.time()
        key = model_id.strip().lower()
        with self._lock:
            self._circuit_open_until[key] = now_t + self.circuit_ttl_sec
            self._circuit_reasons[key] = reason[:160]
            if provider_id and provider_wide:
                pkey = provider_id.strip().lower()
                bucket = self._provider_recent_failed_models.setdefault(pkey, {})
                # Expira registros antigos (> provider_circuit_ttl_sec)
                bucket = {m: ts for m, ts in bucket.items() if now_t - ts <= self.provider_circuit_ttl_sec}
                bucket[key] = now_t
                self._provider_recent_failed_models[pkey] = bucket
                if len(bucket) >= self.provider_trip_threshold:
                    self._provider_open_until[pkey] = now_t + self.provider_circuit_ttl_sec
                    self._provider_reasons[pkey] = (
                        f"Pool outage ({len(bucket)} models): {reason[:120]}"
                    )

    def close_circuit(self, model_id: str, provider_id: str | None = None) -> None:
        key = model_id.strip().lower()
        with self._lock:
            self._circuit_open_until.pop(key, None)
            self._circuit_reasons.pop(key, None)
            if provider_id:
                pkey = provider_id.strip().lower()
                self._provider_open_until.pop(pkey, None)
                self._provider_reasons.pop(pkey, None)
                bucket = self._provider_recent_failed_models.get(pkey)
                if bucket:
                    bucket.pop(key, None)

    def reset_all_circuits(self) -> dict[str, int]:
        with self._lock:
            m_count = len(self._circuit_open_until)
            p_count = len(self._provider_open_until)
            self._circuit_open_until.clear()
            self._circuit_reasons.clear()
            self._provider_open_until.clear()
            self._provider_reasons.clear()
            self._provider_recent_failed_models.clear()
            return {"models_cleared": m_count, "providers_cleared": p_count}

    def get_open_circuits(self) -> dict[str, dict[str, Any]]:
        now_t = time.time()
        out: dict[str, dict[str, Any]] = {}
        with self._lock:
            for k, exp in list(self._circuit_open_until.items()):
                if exp <= now_t:
                    self._circuit_open_until.pop(k, None)
                    self._circuit_reasons.pop(k, None)
                else:
                    out[k] = {
                        "remaining_sec": round(exp - now_t, 1),
                        "reason": self._circuit_reasons.get(k, ""),
                    }
        return out

    def get_open_provider_circuits(self) -> dict[str, dict[str, Any]]:
        now_t = time.time()
        out: dict[str, dict[str, Any]] = {}
        with self._lock:
            for k, exp in list(self._provider_open_until.items()):
                if exp <= now_t:
                    self._provider_open_until.pop(k, None)
                    self._provider_reasons.pop(k, None)
                else:
                    out[k] = {
                        "remaining_sec": round(exp - now_t, 1),
                        "reason": self._provider_reasons.get(k, ""),
                    }
        return out

    def resolve_candidates(self, requested_model: str) -> list[dict[str, str]]:
        """Retorna lista ordenada de candidatos [{model, provider}] respeitando VIP, bloqueios ao vivo e Circuit Breakers."""
        req = (requested_model or "").strip()
        req_low = req.lower()
        groups = self.get_effective_tier_groups()
        is_iris_req = req_low in ("tier/vip-iris", "group/vip-iris", "gpt-6.1-terra")
        effective_group = TIER_ALIAS_TO_GROUP.get(req_low) or ("group/vip-iris" if is_iris_req else "group/code")

        raw_ladder: list[dict[str, str]] = []
        group_key = TIER_ALIAS_TO_GROUP.get(req_low)
        if group_key and isinstance(groups.get(group_key), list):
            for entry in groups[group_key]:
                m = str(entry.get("model") or "").strip()
                p = str(entry.get("provider") or infer_provider(m)).strip()
                if m:
                    raw_ladder.append({"model": m, "provider": p})
        elif req:
            raw_ladder.append({"model": req, "provider": infer_provider(req)})
            fallback_group = "group/vip-iris" if is_iris_req else "group/code"
            for entry in groups.get(fallback_group) or []:
                m = str(entry.get("model") or "").strip()
                p = str(entry.get("provider") or infer_provider(m)).strip()
                if m and m.lower() != req_low:
                    raw_ladder.append({"model": m, "provider": p})

        if not raw_ladder:
            if is_iris_req:
                raw_ladder = [
                    {"model": "gpt-6.1-terra", "provider": "nexusmind_openai"},
                    {"model": "gpt-6.2-sol", "provider": "nexusmind_openai"},
                    {"model": "claude-sonnet-4-6", "provider": "nexusmind_anthropic"},
                ]
            else:
                raw_ladder = [
                    {"model": "codex-auto-review", "provider": "nexusmind_openai"},
                    {"model": "gemini-2.5-flash", "provider": "nexusmind_antigravity"},
                    {"model": "gemini-4-hydrogen-high", "provider": "nexusmind_antigravity"},
                ]

        # Filtra rigorosamente contra VIP, blockedModels e disabledModels ao vivo
        filtered: list[dict[str, str]] = []
        seen: set[str] = set()
        for c in raw_ladder:
            ml = c["model"].lower()
            if ml in seen:
                continue
            if not self._is_model_allowed_in_group(c["model"], c["provider"], effective_group):
                continue
            seen.add(ml)
            filtered.append(c)

        now_t = time.time()
        healthy = [
            c
            for c in filtered
            if not self.is_circuit_open(c["model"], now_t)
            and not self.is_provider_circuit_open(c["provider"], now_t)
        ]
        cooled = [c for c in filtered if c not in healthy]
        return (healthy + cooled[:1])[:5] if healthy else cooled[:3]

    def _rotate_telemetry_if_needed(self) -> None:
        try:
            if self.telemetry_path.exists() and self.telemetry_path.stat().st_size >= MAX_TELEMETRY_BYTES:
                backup = self.telemetry_path.with_suffix(".jsonl.1")
                if backup.exists():
                    backup.unlink()
                self.telemetry_path.rename(backup)
        except Exception:
            pass

    def record_telemetry(self, entry: dict[str, Any]) -> None:
        try:
            self.telemetry_path.parent.mkdir(parents=True, exist_ok=True)
            line = json.dumps(entry, ensure_ascii=False) + "\n"
            with self._lock:
                self._rotate_telemetry_if_needed()
                with self.telemetry_path.open("a", encoding="utf-8") as f:
                    f.write(line)
        except Exception:
            pass

    def build_metrics_summary(self, max_rows: int = 500, recent_limit: int = 20) -> dict[str, Any]:
        rows: list[dict[str, Any]] = []
        if self.telemetry_path.exists():
            try:
                lines = self.telemetry_path.read_text(encoding="utf-8", errors="replace").splitlines()
                for line in lines[-max_rows:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
            except Exception:
                pass

        total = len(rows)
        ok_count = sum(1 for r in rows if int(r.get("status") or 0) == 200)
        failed_count = total - ok_count
        hops_recovered = sum(1 for r in rows if int(r.get("status") or 0) == 200 and int(r.get("hop") or 0) > 0)
        latencies = sorted(int(r.get("latency_ms") or 0) for r in rows if int(r.get("latency_ms") or 0) > 0)
        p50 = latencies[len(latencies) // 2] if latencies else 0

        by_tier: Counter[str] = Counter()
        by_model: Counter[str] = Counter()
        absorbed: Counter[str] = Counter()
        for r in rows:
            by_tier[str(r.get("requested_model") or "unknown")] += 1
            if r.get("actual_model"):
                key = f"{r['actual_model']} ({r.get('provider') or 'nexusmind'})"
                by_model[key] += 1
            for fa in r.get("failed_attempts") or []:
                absorbed[f"{fa.get('model')} HTTP {fa.get('status')}"] += 1

        return {
            "ok": True,
            "service": "nexusmind-local-router",
            "uptime_sec": round(time.time() - self.started_at, 1),
            "process_stats": dict(self.stats),
            "window_size": total,
            "ok_count": ok_count,
            "failed_count": failed_count,
            "success_rate_pct": round((ok_count / total) * 100.0, 2) if total else 100.0,
            "hops_recovered": hops_recovered,
            "p50_latency_ms": p50,
            "by_tier": dict(by_tier.most_common(12)),
            "by_model": dict(by_model.most_common(12)),
            "absorbed_errors": dict(absorbed.most_common(12)),
            "open_circuits": self.get_open_circuits(),
            "open_provider_circuits": self.get_open_provider_circuits(),
            "recent_events": list(reversed(rows[-recent_limit:])),
        }


def _stream_with_keepalive(
    upstream_resp: Any,
    wfile: Any,
    keepalive_sec: float = 15.0,
) -> bool:
    """Repassa SSE do upstream enviando `: keepalive\\n\\n` se o TTFT ficar silencioso.

    Retorna True se terminou normalmente, False se o cliente desconectou (abortando o upstream).
    """
    q: queue.Queue[bytes | None | Exception] = queue.Queue(maxsize=32)
    stop_evt = threading.Event()

    def _reader() -> None:
        try:
            while not stop_evt.is_set():
                chunk = upstream_resp.read(4096)
                if not chunk:
                    q.put(None)
                    return
                q.put(chunk)
        except Exception as exc:
            if not stop_evt.is_set():
                q.put(exc)

    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    try:
        while True:
            try:
                item = q.get(timeout=keepalive_sec)
            except queue.Empty:
                try:
                    wfile.write(b": keepalive\n\n")
                    wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    stop_evt.set()
                    try:
                        upstream_resp.close()
                    except Exception:
                        pass
                    return False
                continue

            if item is None:
                return True
            if isinstance(item, Exception):
                return False
            try:
                wfile.write(item)
                wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                stop_evt.set()
                try:
                    upstream_resp.close()
                except Exception:
                    pass
                return False
    finally:
        stop_evt.set()
        try:
            upstream_resp.close()
        except Exception:
            pass


def make_handler(state: RouterState):
    class LocalRouterHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args: Any) -> None:
            if os.environ.get("ORGFY_ROUTER_DEBUG") == "1":
                super().log_message(format, *args)

        def _send_json(self, status: int, payload: Any, extra_headers: dict[str, str] | None = None) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            for k, v in (extra_headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Local-Router-Token")
            self.end_headers()

        def do_GET(self) -> None:
            path = self.path.split("?", 1)[0]
            if path in ("/health", "/v1/health"):
                disc_report = None
                rep_path = state.scratch_dir / "router-discovery-report.json"
                if rep_path.exists():
                    try:
                        disc_report = json.loads(rep_path.read_text(encoding="utf-8"))
                    except Exception:
                        disc_report = None
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "service": "nexusmind-local-router",
                        "version": "2.1.0",
                        "pid": os.getpid(),
                        "uptime_sec": round(time.time() - state.started_at, 1),
                        "stats": state.stats,
                        "open_circuits": state.get_open_circuits(),
                        "open_provider_circuits": state.get_open_provider_circuits(),
                        "vip_sticky_policy": {
                            "tier": "tier/vip-iris",
                            "retries": state.vip_sticky_retries,
                            "delay_sec": state.vip_sticky_delay_sec,
                        },
                        "discovery_report": disc_report,
                        "tierFallbackGroups": state.get_effective_tier_groups(),
                    },
                )
                return
            if path in ("/metrics", "/v1/metrics"):
                self._send_json(200, state.build_metrics_summary())
                return
            if path in ("/v1/models", "/models"):
                now_ts = int(time.time())
                models_out = [
                    {
                        "id": spec["id"],
                        "object": "model",
                        "created": now_ts,
                        "owned_by": "nexusmind-local-router",
                    }
                    for spec in VIRTUAL_TIER_SPECS
                ]
                cp = state.get_control_plane()
                for m in cp.get("models") or []:
                    if m.get("evalApproved") and m.get("online"):
                        models_out.append(
                            {
                                "id": m["model"],
                                "object": "model",
                                "created": now_ts,
                                "owned_by": m.get("provider", "nexusmind"),
                            }
                        )
                self._send_json(200, {"object": "list", "data": models_out})
                return
            self._send_json(404, {"error": {"message": f"Not found: {path}"}})

        def do_POST(self) -> None:
            path = self.path.split("?", 1)[0]
            if path in ("/circuits/reset", "/v1/circuits/reset"):
                cleared = state.reset_all_circuits()
                self._send_json(200, {"ok": True, **cleared})
                return

            if path not in ("/v1/chat/completions", "/chat/completions", "/v1/messages", "/messages"):
                self._send_json(404, {"error": {"message": f"Unsupported endpoint: {path}"}})
                return

            content_len = int(self.headers.get("Content-Length") or 0)
            raw_body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                req_json = json.loads(raw_body.decode("utf-8"))
            except Exception as exc:
                self._send_json(400, {"error": {"message": f"Invalid JSON body: {exc}"}})
                return

            requested_model = str(req_json.get("model") or "tier/code")
            req_low = requested_model.strip().lower()
            is_vip_iris = req_low in ("tier/vip-iris", "group/vip-iris", "gpt-6.1-terra")
            is_stream = bool(req_json.get("stream"))
            candidates = state.resolve_candidates(requested_model)
            state.stats["total_requests"] += 1

            t_start = time.time()
            failed_attempts: list[dict[str, Any]] = []
            last_status = 503
            last_err_body = b'{"error":{"message":"All tier fallback candidates failed"}}'
            last_ct = "application/json"

            for hop_idx, cand in enumerate(candidates):
                cand_model = cand["model"]
                cand_prov = cand["provider"]
                api_key = state.api_keys.get(cand_prov) or next(iter(state.api_keys.values()))

                # VIP Sticky Retry: para Iris no modelo primário (hop 0), tenta até N retries antes de trocar
                max_attempts_this_hop = (
                    1 + state.vip_sticky_retries
                    if (is_vip_iris and hop_idx == 0)
                    else 1
                )

                for attempt_idx in range(max_attempts_this_hop):
                    forward_body = dict(req_json)
                    forward_body["model"] = cand_model
                    is_anthropic_endpoint = path.endswith("/messages")
                    target_path = "/v1/messages" if is_anthropic_endpoint else "/v1/chat/completions"
                    upstream_url = f"{state.upstream_base}{target_path}"

                    headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "NexusMindLocalRouter/2.0",
                        "Authorization": f"Bearer {api_key}",
                    }
                    if is_anthropic_endpoint or cand_prov == "nexusmind_anthropic":
                        headers["x-api-key"] = api_key
                        headers["anthropic-version"] = self.headers.get("anthropic-version") or "2023-06-01"

                    hop_t0 = time.time()
                    req = urllib.request.Request(
                        upstream_url,
                        data=json.dumps(forward_body, ensure_ascii=False).encode("utf-8"),
                        headers=headers,
                        method="POST",
                    )

                    try:
                        ctx_ssl = _ssl_context() if upstream_url.startswith("https://") else None
                        with urllib.request.urlopen(req, timeout=state.request_timeout_sec, context=ctx_ssl) as resp:
                            resp_status = int(resp.status)
                            resp_ct = resp.headers.get("Content-Type") or "application/json"
                            state.close_circuit(cand_model, cand_prov)
                            state.stats["ok_requests"] += 1
                            if hop_idx > 0:
                                state.stats["fallback_recoveries"] += 1
                            elif attempt_idx > 0:
                                state.stats["vip_sticky_recoveries"] += 1

                            extra_headers = {
                                "X-NexusMind-Requested-Model": requested_model,
                                "X-NexusMind-Actual-Model": cand_model,
                                "X-NexusMind-Provider": cand_prov,
                                "X-NexusMind-Fallback-Hop": str(hop_idx),
                                "X-NexusMind-Sticky-Attempt": str(attempt_idx),
                            }

                            if is_stream or "text/event-stream" in resp_ct.lower():
                                self.send_response(resp_status)
                                self.send_header("Content-Type", resp_ct)
                                self.send_header("Cache-Control", "no-cache")
                                self.send_header("Connection", "close")
                                for k, v in extra_headers.items():
                                    self.send_header(k, v)
                                self.end_headers()
                                _stream_with_keepalive(resp, self.wfile, keepalive_sec=state.sse_keepalive_sec)
                                self.close_connection = True
                            else:
                                resp_bytes = resp.read()
                                self.send_response(resp_status)
                                self.send_header("Content-Type", resp_ct)
                                self.send_header("Content-Length", str(len(resp_bytes)))
                                for k, v in extra_headers.items():
                                    self.send_header(k, v)
                                self.end_headers()
                                self.wfile.write(resp_bytes)

                            state.record_telemetry(
                                {
                                    "ts": datetime.now(timezone.utc).isoformat(),
                                    "requested_model": requested_model,
                                    "actual_model": cand_model,
                                    "provider": cand_prov,
                                    "hop": hop_idx,
                                    "sticky_attempt": attempt_idx,
                                    "status": resp_status,
                                    "stream": is_stream,
                                    "latency_ms": int((time.time() - hop_t0) * 1000),
                                    "total_latency_ms": int((time.time() - t_start) * 1000),
                                    "failed_attempts": failed_attempts,
                                }
                            )
                            return

                    except urllib.error.HTTPError as http_err:
                        err_status = int(http_err.code)
                        err_bytes = http_err.read() if hasattr(http_err, "read") else b""
                        err_text = err_bytes.decode("utf-8", errors="replace")
                        err_ct = http_err.headers.get("Content-Type") if http_err.headers else "application/json"
                        failed_attempts.append(
                            {
                                "model": cand_model,
                                "provider": cand_prov,
                                "status": err_status,
                                "attempt": attempt_idx,
                                "error": err_text[:140],
                                "latency_ms": int((time.time() - hop_t0) * 1000),
                            }
                        )
                        last_status = err_status
                        last_err_body = err_bytes or json.dumps({"error": {"message": f"HTTP {err_status}"}}).encode("utf-8")
                        last_ct = err_ct or "application/json"

                        # Se for VIP Sticky Retry e erro transitório, espera curto e tenta novamente o mesmo modelo
                        if (
                            attempt_idx + 1 < max_attempts_this_hop
                            and err_status in VIP_STICKY_TRANSIENT_CODES
                        ):
                            if state.vip_sticky_delay_sec > 0:
                                time.sleep(state.vip_sticky_delay_sec)
                            continue

                        if is_retriable_error(err_status, err_text):
                            state.open_circuit(
                                cand_model,
                                f"HTTP {err_status}: {err_text[:100]}",
                                provider_id=cand_prov,
                                provider_wide=is_provider_wide_error(err_status, err_text),
                            )
                            break  # passa para o próximo hop
                        # Erro 4xx determinístico do cliente -> devolve imediatamente
                        state.stats["failed_requests"] += 1
                        state.record_telemetry(
                            {
                                "ts": datetime.now(timezone.utc).isoformat(),
                                "requested_model": requested_model,
                                "actual_model": None,
                                "provider": None,
                                "hop": len(failed_attempts),
                                "status": last_status,
                                "stream": is_stream,
                                "latency_ms": int((time.time() - t_start) * 1000),
                                "failed_attempts": failed_attempts,
                            }
                        )
                        self.send_response(last_status)
                        self.send_header("Content-Type", last_ct)
                        self.send_header("Content-Length", str(len(last_err_body)))
                        self.end_headers()
                        self.wfile.write(last_err_body)
                        return

                    except Exception as exc:
                        err_msg = str(exc)[:140]
                        failed_attempts.append(
                            {
                                "model": cand_model,
                                "provider": cand_prov,
                                "status": 502,
                                "attempt": attempt_idx,
                                "error": err_msg,
                                "latency_ms": int((time.time() - hop_t0) * 1000),
                            }
                        )
                        last_status = 502
                        last_err_body = json.dumps({"error": {"message": f"Upstream unreachable: {err_msg}"}}).encode("utf-8")

                        if attempt_idx + 1 < max_attempts_this_hop:
                            if state.vip_sticky_delay_sec > 0:
                                time.sleep(state.vip_sticky_delay_sec)
                            continue

                        state.open_circuit(
                            cand_model,
                            f"network_error: {err_msg}",
                            provider_id=cand_prov,
                            provider_wide=True,
                        )
                        break

            state.stats["failed_requests"] += 1
            state.record_telemetry(
                {
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "requested_model": requested_model,
                    "actual_model": None,
                    "provider": None,
                    "hop": len(failed_attempts),
                    "status": last_status,
                    "stream": is_stream,
                    "latency_ms": int((time.time() - t_start) * 1000),
                    "failed_attempts": failed_attempts,
                }
            )
            self.send_response(last_status)
            self.send_header("Content-Type", last_ct)
            self.send_header("Content-Length", str(len(last_err_body)))
            self.send_header("X-NexusMind-Requested-Model", requested_model)
            self.send_header("X-NexusMind-Fallback-Hop", str(len(failed_attempts)))
            self.end_headers()
            self.wfile.write(last_err_body)

    return LocalRouterHandler


def register_router_provider(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, buzz_dir: Path | None = None) -> dict[str, str]:
    """Registra `nexusmind_router` no Goose custom_providers e no Pi models.json/auth.json."""
    bdir = buzz_dir or _resolve_buzz_dir()
    base_url = f"http://{host}:{port}/v1"
    real_home = _resolve_real_home()

    goose_dir = real_home / ".config" / "goose" / "custom_providers"
    goose_dir.mkdir(parents=True, exist_ok=True)
    goose_provider = {
        "name": "nexusmind_router",
        "engine": "openai",
        "display_name": "NexusMind Local Router (Auto-Fallback)",
        "description": "Roteador local in-flight integrado ao NexusMind Gateway com Top-5 por Tier, VIP Sticky Retry e Circuit Breaker",
        "base_url": base_url,
        "api_key_env": "OPENAI_API_KEY",
        "models": [
            {"name": spec["id"], "context_limit": spec["ctx"], "max_tokens": spec["max_out"]}
            for spec in VIRTUAL_TIER_SPECS
        ],
    }
    goose_path = goose_dir / "nexusmind_router.json"
    goose_path.write_text(json.dumps(goose_provider, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    pi_models_updated = []
    for p in (bdir / ".pi" / "models.json", bdir / ".pi" / "agent" / "models.json"):
        if not p.parent.exists():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"providers": {}}
        except Exception:
            data = {"providers": {}}
        data.setdefault("providers", {})
        data["providers"]["nexusmind_router"] = {
            "baseUrl": base_url,
            "apiKey": "local-router-key",
            "api": "openai-compatible",
            "models": {
                spec["id"]: {"name": spec["id"], "contextWindow": spec["ctx"], "maxTokens": spec["max_out"]}
                for spec in VIRTUAL_TIER_SPECS
            },
        }
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        pi_models_updated.append(str(p))

    for ap in (bdir / ".pi" / "auth.json", bdir / ".pi" / "agent" / "auth.json"):
        if not ap.parent.exists():
            continue
        try:
            adata = json.loads(ap.read_text(encoding="utf-8")) if ap.exists() else {}
        except Exception:
            adata = {}
        adata["nexusmind_router"] = {"type": "api_key", "key": "local-router-key"}
        ap.write_text(json.dumps(adata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return {"goose_provider": str(goose_path), "pi_models": ", ".join(pi_models_updated)}


def build_launchagent_plist(
    script_path: Path | None = None,
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    buzz_dir: Path | None = None,
) -> dict[str, Any]:
    bdir = buzz_dir or _resolve_buzz_dir()
    script = (script_path or Path(__file__).resolve()).resolve()
    log_path = str(bdir / ".scratch" / "local-router.log")
    python_bin = "/usr/bin/python3"
    for cand in ("/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"):
        if Path(cand).exists():
            python_bin = cand
            break
    return {
        "Label": LAUNCHAGENT_LABEL,
        "ProgramArguments": [python_bin, str(script), "--host", host, "--port", str(port)],
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 5,
        "EnvironmentVariables": {
            "ORGFY_BUZZ_DIR": str(bdir),
            "PYTHONUNBUFFERED": "1",
        },
        "StandardOutPath": log_path,
        "StandardErrorPath": log_path,
    }


def install_launchagent(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    buzz_dir: Path | None = None,
) -> dict[str, Any]:
    real_home = _resolve_real_home()
    agents_dir = real_home / "Library" / "LaunchAgents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    plist_path = agents_dir / f"{LAUNCHAGENT_LABEL}.plist"
    plist_data = build_launchagent_plist(host=host, port=port, buzz_dir=buzz_dir)
    with plist_path.open("wb") as f:
        plistlib.dump(plist_data, f)

    uid = os.getuid()
    loaded = False
    load_note = ""
    try:
        subprocess.run(
            ["launchctl", "bootout", f"gui/{uid}/{LAUNCHAGENT_LABEL}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        res = subprocess.run(
            ["launchctl", "bootstrap", f"gui/{uid}", str(plist_path)],
            capture_output=True,
            text=True,
            timeout=5,
        )
        loaded = res.returncode == 0
        load_note = (res.stdout or res.stderr or "").strip()
    except Exception as exc:
        load_note = str(exc)

    return {
        "ok": True,
        "label": LAUNCHAGENT_LABEL,
        "plist_path": str(plist_path),
        "loaded": loaded,
        "note": load_note,
    }


def _pid_file(buzz_dir: Path | None = None) -> Path:
    bdir = buzz_dir or _resolve_buzz_dir()
    return bdir / ".scratch" / "local-router.pid"


def stop_daemon(buzz_dir: Path | None = None) -> dict[str, Any]:
    pfile = _pid_file(buzz_dir)
    stopped_pid = None
    if pfile.exists():
        try:
            pid = int(pfile.read_text(encoding="utf-8").strip())
            os.kill(pid, signal.SIGTERM)
            stopped_pid = pid
        except Exception:
            pass
        try:
            pfile.unlink(missing_ok=True)
        except Exception:
            pass
    return {"ok": True, "stopped_pid": stopped_pid}


def start_daemon(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    buzz_dir: Path | None = None,
) -> dict[str, Any]:
    bdir = buzz_dir or _resolve_buzz_dir()
    stop_daemon(bdir)
    time.sleep(0.3)
    log_path = bdir / ".scratch" / "local-router.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    script = Path(__file__).resolve()
    env = dict(os.environ)
    env["ORGFY_BUZZ_DIR"] = str(bdir)
    env["PYTHONUNBUFFERED"] = "1"
    with log_path.open("a", encoding="utf-8") as logf:
        proc = subprocess.Popen(
            [sys.executable, str(script), "--host", host, "--port", str(port)],
            stdout=logf,
            stderr=logf,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            env=env,
        )
    _pid_file(bdir).write_text(f"{proc.pid}\n", encoding="utf-8")
    return {"ok": True, "pid": proc.pid, "log_path": str(log_path)}


def create_server(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    state: RouterState | None = None,
) -> ThreadingHTTPServer:
    st = state or RouterState()
    return ThreadingHTTPServer((host, port), make_handler(st))


def _local_http_call(
    host: str,
    port: int,
    path: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = 5.0,
) -> dict[str, Any]:
    url = f"http://{host}:{port}{path}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
        headers["Authorization"] = "Bearer local-router-key"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                body = json.loads(raw)
            except Exception:
                body = raw
            return {
                "ok": True,
                "status": int(resp.status),
                "latency_ms": int((time.time() - t0) * 1000),
                "headers": {k.lower(): v for k, v in resp.headers.items()},
                "body": body,
            }
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace") if hasattr(err, "read") else ""
        return {
            "ok": False,
            "status": int(err.code),
            "latency_ms": int((time.time() - t0) * 1000),
            "headers": {},
            "error": raw[:200] or f"HTTP {err.code}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "status": 0,
            "latency_ms": int((time.time() - t0) * 1000),
            "headers": {},
            "error": str(exc)[:200],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="NexusMind Local LLM Router (porta 4199)")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--upstream", default=UPSTREAM_BASE)
    parser.add_argument("--circuit-ttl", type=float, default=180.0)
    parser.add_argument("--vip-sticky-retries", type=int, default=2)
    parser.add_argument("--vip-sticky-delay", type=float, default=5.0)
    parser.add_argument("--register-provider", action="store_true", help="Registra nexusmind_router no Goose e no Pi e encerra")
    parser.add_argument("--install-launchagent", action="store_true", help="Instala e carrega o LaunchAgent do macOS e encerra")
    parser.add_argument("--start-daemon", action="store_true", help="Inicia ou reinicia o roteador em background via PID file")
    parser.add_argument("--stop-daemon", action="store_true", help="Para o roteador em background via PID file")
    parser.add_argument("--health-json", action="store_true", help="Consulta /health do roteador local e imprime JSON")
    parser.add_argument("--metrics-json", action="store_true", help="Consulta /metrics do roteador local e imprime JSON")
    parser.add_argument("--reset-circuits", action="store_true", help="Reseta circuitos via POST /circuits/reset e imprime JSON")
    parser.add_argument("--probe-tier", default="", help="Envia probe de 4 tokens para o tier informado e imprime JSON")
    parser.add_argument("--discover-and-eval", action="store_true", help="Descobre todos os modelos ativos nas 4 APIs, roda Eval de tool-calling e atualiza escadas")
    parser.add_argument("--max-models", type=int, default=80, help="Limite de modelos no --discover-and-eval (0 = todos)")
    parser.add_argument("--force", action="store_true", help="Força reteste ignorando cache de 6h no --discover-and-eval")
    args = parser.parse_args()

    if args.register_provider:
        res = register_router_provider(host=args.host, port=args.port)
        print(json.dumps({"ok": True, **res}, indent=2, ensure_ascii=False))
        return 0

    if args.install_launchagent:
        res = install_launchagent(host=args.host, port=args.port)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.stop_daemon:
        res = stop_daemon()
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.start_daemon:
        res = start_daemon(host=args.host, port=args.port)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if args.health_json:
        res = _local_http_call(args.host, args.port, "/health", "GET", timeout=3.0)
        print(json.dumps(res, ensure_ascii=False))
        return 0

    if args.metrics_json:
        res = _local_http_call(args.host, args.port, "/metrics", "GET", timeout=4.0)
        print(json.dumps(res, ensure_ascii=False))
        return 0

    if args.reset_circuits:
        res = _local_http_call(args.host, args.port, "/circuits/reset", "POST", payload={}, timeout=4.0)
        print(json.dumps(res, ensure_ascii=False))
        return 0

    if args.probe_tier:
        res = _local_http_call(
            args.host,
            args.port,
            "/v1/chat/completions",
            "POST",
            payload={
                "model": args.probe_tier,
                "messages": [{"role": "user", "content": "Responda apenas OK"}],
                "max_tokens": 4,
            },
            timeout=25.0,
        )
        print(json.dumps(res, ensure_ascii=False))
        return 0

    if args.discover_and_eval:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import discover_eval  # type: ignore
        res = discover_eval.run_discover_and_eval(max_models=args.max_models, force=args.force)
        print(json.dumps(res, ensure_ascii=False))
        return 0

    state = RouterState(
        upstream_base=args.upstream,
        circuit_ttl_sec=args.circuit_ttl,
        vip_sticky_retries=args.vip_sticky_retries,
        vip_sticky_delay_sec=args.vip_sticky_delay,
    )
    try:
        _pid_file(state.buzz_dir).write_text(f"{os.getpid()}\n", encoding="utf-8")
    except Exception:
        pass
    server = create_server(host=args.host, port=args.port, state=state)
    print(f"[nexusmind-local-router] Listening on http://{args.host}:{args.port} -> {args.upstream}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
