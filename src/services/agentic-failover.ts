// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND AGENTIC FAILOVER & CIRCUIT BREAKER ENGINE (v3.0)
// 1. Quarentena inteligente (Circuit Breaker) com TTL por classe de erro:
//      weekly_limit (60m) · not_found/404 (120m) · malformed_tool (30m)
//      stream_cut / rate_limit / 5xx (10m) · timeout (5m)
// 2. Proteção estrita VIP:
//      - Workers comuns recebem apenas modelos "auto" saudáveis e fora de quarentena.
//      - Agentes VIP (OrgFy Iris / Conselho) NUNCA são degradados para modelos fracos;
//        só trocam quando realmente falham e apenas dentro da cadeia VIP aprovada.
// 3. Watchdog ao vivo (ctx.relay.snapshot().session.agentActivity) +
//    Listener do barramento OrgFy ("orgfy.failover.requested").
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import { type CanonicalGroupDef, isUnsupportedAgentModel } from "./smart-router";
import {
  type ModelRankingSnapshot,
  inferCanonicalGroupForModel,
} from "./model-ranking";
import {
  type VipPolicyConfig,
  getModelAccessMode,
  isVipAgent,
  loadVipPolicy,
} from "./vip-policy";
import {
  type GatewayErrorKind,
  type QualityProbeResult,
  classifyGatewayError,
  loadSavedQualityBench,
} from "./quality-bench";

export interface QuarantineEntry {
  model: string;
  group: string;
  reason: string;
  errorKind: GatewayErrorKind;
  quarantinedAt: string;
  expiresAt: string;
  hitCount: number;
  lastAgent?: string;
}

export interface FailoverEvent {
  id: string;
  timestamp: string;
  agentKey: string;
  agentName: string;
  isVip: boolean;
  fromModel: string | null;
  toModel: string | null;
  toGroup: string | null;
  reason: string;
  errorKind: GatewayErrorKind;
  trigger: "watchdog" | "orgfy_event" | "manual" | "tool";
  applied: boolean;
  wokeAgent: boolean;
  note?: string;
}

export interface AutopilotConfig {
  enabled: boolean;
  wakeOnFailover: boolean;
  notifyOnFailover: boolean;
  benchIntervalMin: number;
  pollIntervalSec: number;
}

export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = {
  enabled: true,
  wakeOnFailover: true,
  notifyOnFailover: true,
  benchIntervalMin: 30,
  pollIntervalSec: 12,
};

export const QUARANTINE_TTL_MS: Record<GatewayErrorKind, number> = {
  ok: 0,
  weekly_limit: 60 * 60 * 1000,
  not_found: 120 * 60 * 1000,
  auth_error: 120 * 60 * 1000,
  malformed_tool: 30 * 60 * 1000,
  stream_cut: 10 * 60 * 1000,
  rate_limit: 10 * 60 * 1000,
  server_error: 10 * 60 * 1000,
  timeout: 5 * 60 * 1000,
  unknown: 10 * 60 * 1000,
};

export const LOCAL_STORAGE_QUARANTINE_KEY = "nexusmind_quarantine_v1";
export const LOCAL_STORAGE_FAILOVER_LOG_KEY = "nexusmind_failover_log_v1";
export const LOCAL_STORAGE_AUTOPILOT_KEY = "nexusmind_autopilot_cfg_v1";
export const SHARED_FAILOVER_LOG_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-failover-log.json";

export function loadAutopilotConfig(): AutopilotConfig {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_AUTOPILOT_KEY);
    if (!raw) return { ...DEFAULT_AUTOPILOT_CONFIG };
    const p = JSON.parse(raw);
    return {
      enabled: p?.enabled !== false,
      wakeOnFailover: p?.wakeOnFailover !== false,
      notifyOnFailover: p?.notifyOnFailover !== false,
      benchIntervalMin: Math.max(5, Math.min(240, Number(p?.benchIntervalMin || 30))),
      pollIntervalSec: Math.max(5, Math.min(120, Number(p?.pollIntervalSec || 12))),
    };
  } catch {
    return { ...DEFAULT_AUTOPILOT_CONFIG };
  }
}

export function saveAutopilotConfig(cfg: AutopilotConfig): void {
  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_AUTOPILOT_KEY, JSON.stringify(cfg));
  } catch {}
}

export function loadQuarantines(nowMs: number = Date.now()): Record<string, QuarantineEntry> {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_QUARANTINE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const active: Record<string, QuarantineEntry> = {};
    for (const [model, entry] of Object.entries(parsed) as Array<[string, any]>) {
      const exp = Date.parse(entry?.expiresAt || "");
      if (Number.isFinite(exp) && exp > nowMs) {
        active[model] = entry as QuarantineEntry;
      }
    }
    return active;
  } catch {
    return {};
  }
}

function saveQuarantines(map: Record<string, QuarantineEntry>): void {
  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_QUARANTINE_KEY, JSON.stringify(map));
  } catch {}
}

export function quarantineModel(
  model: string,
  group: string,
  errorText: string,
  httpStatus?: number,
  agentName?: string,
  nowMs: number = Date.now()
): QuarantineEntry {
  const errorKind = classifyGatewayError(errorText, httpStatus);
  const ttl = QUARANTINE_TTL_MS[errorKind] || QUARANTINE_TTL_MS.unknown;
  const current = loadQuarantines(nowMs);
  const prev = current[model];
  const entry: QuarantineEntry = {
    model,
    group,
    reason: String(errorText || errorKind).slice(0, 180),
    errorKind,
    quarantinedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttl).toISOString(),
    hitCount: (prev?.hitCount || 0) + 1,
    lastAgent: agentName || prev?.lastAgent,
  };
  current[model] = entry;
  saveQuarantines(current);
  return entry;
}

export function releaseQuarantine(model?: string): Record<string, QuarantineEntry> {
  if (!model) {
    saveQuarantines({});
    return {};
  }
  const current = loadQuarantines();
  delete current[model];
  saveQuarantines(current);
  return current;
}

export function isModelQuarantined(model: string, nowMs: number = Date.now()): boolean {
  const active = loadQuarantines(nowMs);
  return Boolean(active[model]);
}

export function loadFailoverLog(): FailoverEvent[] {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_FAILOVER_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendFailoverLog(ctx: Context | null | undefined, evt: FailoverEvent): Promise<FailoverEvent[]> {
  const prev = loadFailoverLog();
  const next = [evt, ...prev].slice(0, 60);
  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_FAILOVER_LOG_KEY, JSON.stringify(next));
  } catch {}
  const host = (ctx as any)?.host;
  if (typeof host?.writeFile === "function") {
    try {
      await host.writeFile(
        SHARED_FAILOVER_LOG_PATH,
        JSON.stringify({ updatedAt: new Date().toISOString(), events: next }, null, 2)
      );
    } catch {}
  }
  return next;
}

export interface PickFailoverInput {
  agentName: string;
  currentModel: string | null;
  rankingSnapshot?: ModelRankingSnapshot | null;
  vipPolicy?: VipPolicyConfig;
  qualityBench?: Record<string, QualityProbeResult>;
  quarantines?: Record<string, QuarantineEntry>;
  disabledModels?: string[];
  groups: Record<string, CanonicalGroupDef>;
}

export interface PickFailoverResult {
  ok: boolean;
  isVip: boolean;
  model: string | null;
  group: string | null;
  score: number | null;
  reason: string;
}

/**
 * Seleciona o melhor modelo substituto respeitando rigorosamente a isolação VIP:
 *  - Agente VIP (Iris/Conselho): apenas cadeia VIP aprovada / modelos marcados como "vip".
 *  - Worker comum: apenas modelos "auto" saudáveis, fora de quarentena, priorizando toolCallOk.
 */
export function pickFailoverCandidate(input: PickFailoverInput): PickFailoverResult {
  const vipPolicy = input.vipPolicy || loadVipPolicy();
  const qualityBench = input.qualityBench || loadSavedQualityBench();
  const quarantines = input.quarantines || loadQuarantines();
  const disabledModels = input.disabledModels || [];
  const vip = isVipAgent(input.agentName, vipPolicy);
  const currentLower = String(input.currentModel || "").trim().toLowerCase();

  const isQuarantined = (m: string) => Boolean(quarantines[m]);
  const isBrokenInBench = (m: string) => {
    const q = qualityBench[m];
    return Boolean(q && !q.online);
  };

  if (vip) {
    // Cadeia VIP ordenada: vipFallbackChain + vipModels
    const vipPool = Array.from(
      new Set([...(vipPolicy.vipFallbackChain || []), ...(vipPolicy.vipModels || [])])
    );
    const viableVip = vipPool.filter((m) => {
      if (!m || isUnsupportedAgentModel(m)) return false;
      if (m.toLowerCase() === currentLower) return false;
      const grp = inferCanonicalGroupForModel(m, input.groups);
      const mode = getModelAccessMode(m, grp?.id, vipPolicy, disabledModels);
      if (mode === "blocked") return false;
      if (isQuarantined(m) || isBrokenInBench(m)) return false;
      return true;
    });

    if (viableVip.length > 0) {
      // Ordena priorizando toolCallOk e qualityScore quando já testado
      viableVip.sort((a, b) => {
        const qa = qualityBench[a];
        const qb = qualityBench[b];
        const sa = (qa?.toolCallOk ? 50 : 0) + (qa?.qualityScore ?? 0);
        const sb = (qb?.toolCallOk ? 50 : 0) + (qb?.qualityScore ?? 0);
        return sb - sa;
      });
      const chosen = viableVip[0];
      const grp = inferCanonicalGroupForModel(chosen, input.groups);
      return {
        ok: true,
        isVip: true,
        model: chosen,
        group: grp?.id || "nexusmind_anthropic",
        score: qualityBench[chosen]?.qualityScore ?? 95,
        reason: `Failover VIP seguro para ${input.agentName}: ${chosen} (${grp?.id || "vip"}).`,
      };
    }

    return {
      ok: false,
      isVip: true,
      model: null,
      group: null,
      score: null,
      reason: `Nenhum modelo VIP saudável disponível para ${input.agentName} (proteção anti-downgrade ativa).`,
    };
  }

  // Worker comum: Hard Gate Eval-First — apenas modelos "auto" aprovados no Eval (toolCallOk === true),
  // nunca VIP, nunca blocked e nunca em quarentena.
  const candidates: Array<{ model: string; group: string; score: number; toolCallOk: boolean | null; evalApproved: boolean }> = [];
  const seen = new Set<string>();

  const pushCandidate = (modelId: string, groupId: string | undefined, baseScore: number, rowEvalApproved?: boolean) => {
    const clean = String(modelId || "").trim();
    if (!clean || seen.has(clean.toLowerCase()) || clean.toLowerCase() === currentLower) return;
    if (isUnsupportedAgentModel(clean)) return;
    seen.add(clean.toLowerCase());

    const resolvedGroup = groupId || inferCanonicalGroupForModel(clean, input.groups)?.id || "nexusmind_openai";
    const mode = getModelAccessMode(clean, resolvedGroup, vipPolicy, disabledModels);
    if (mode !== "auto") return; // Bloqueia VIP e Blocked para workers!
    if (isQuarantined(clean) || isBrokenInBench(clean)) return;

    const q = qualityBench[clean];
    const evalApproved = Boolean(rowEvalApproved === true || (q && q.online && q.toolCallOk === true));
    // Hard Gate: se foi testado e falhou no tool-calling, rejeita terminantemente
    if (q && q.toolCallOk === false) return;

    const toolBonus = evalApproved ? 40 : 0;
    const qualityBlend = q ? q.qualityScore * 0.65 + baseScore * 0.35 : baseScore;
    candidates.push({
      model: clean,
      group: resolvedGroup,
      score: Number((qualityBlend + toolBonus).toFixed(1)),
      toolCallOk: q ? q.toolCallOk : evalApproved ? true : null,
      evalApproved,
    });
  };

  for (const row of input.rankingSnapshot?.models || []) {
    if (row.isDisabled || row.online === false) continue;
    pushCandidate(row.model, row.group, row.score, Boolean((row as any).evalApproved ?? row.toolCallOk));
  }

  // Fallback para defaults dos grupos não-VIP apenas se nenhum candidato Eval-aprovado existir
  const hasAnyEvalApproved = candidates.some((c) => c.evalApproved);
  if (!hasAnyEvalApproved) {
    for (const grp of Object.values(input.groups)) {
      if (grp?.defaultModel) {
        pushCandidate(grp.defaultModel, grp.id, 65, false);
      }
    }
  }

  // Hard Gate estrito: quando há modelos aprovados no Eval, descarta completamente os não-testados
  const finalPool = hasAnyEvalApproved ? candidates.filter((c) => c.evalApproved) : candidates;

  finalPool.sort((a, b) => {
    if (a.evalApproved !== b.evalApproved) return a.evalApproved ? -1 : 1;
    if ((a.toolCallOk === true) !== (b.toolCallOk === true)) return a.toolCallOk === true ? -1 : 1;
    return b.score - a.score;
  });

  const winner = finalPool[0];
  if (!winner) {
    return {
      ok: false,
      isVip: false,
      model: null,
      group: null,
      score: null,
      reason: `Nenhum modelo 'auto' aprovado no Eval e fora de quarentena disponível para ${input.agentName}.`,
    };
  }

  return {
    ok: true,
    isVip: false,
    model: winner.model,
    group: winner.group,
    score: winner.score,
    reason: `Failover Eval-First para ${input.agentName}: ${winner.model} (${winner.group}, score ${winner.score}${winner.evalApproved ? " · Eval ✓" : ""}).`,
  };
}

/**
 * Usa a API rápida/barata de Decision Model do Buzz (ctx.decisions.decide) como tie-breaker
 * exclusivamente entre candidatos já aprovados pelo Hard Gate do Eval.
 */
async function refineCandidateWithDecisionApi(
  ctx: Context,
  agentName: string,
  isVip: boolean,
  primary: PickFailoverResult,
  rankingSnapshot?: ModelRankingSnapshot | null
): Promise<PickFailoverResult> {
  if (!primary.ok || !primary.model) return primary;
  const decisionsApi = (ctx as any)?.decisions;
  if (typeof decisionsApi?.decide !== "function") return primary;
  const pool = (rankingSnapshot?.models || [])
    .filter((r: any) => !r.isDisabled && r.online !== false && (r.evalApproved === true || r.toolCallOk === true))
    .filter((r: any) => (isVip ? r.accessMode !== "blocked" : r.accessMode === "auto" || !r.autoAssignBlocked))
    .slice(0, 3);
  if (pool.length < 2) return primary;
  try {
    const res = await decisionsApi.decide({
      question: `Entre estes modelos já aprovados no Eval, qual escolher para o failover do agente ${agentName} (${isVip ? "VIP/Estratégico" : "Execução"})?`,
      options: pool.map((c: any) => `${c.model} (${c.group}, evalScore=${c.score}, lat=${c.pingLatencyMs ?? "?"}ms)`),
    });
    const pickedText = String(res?.choice || res?.decision || res?.option || "").toLowerCase();
    const match = pool.find((c: any) => pickedText.includes(String(c.model || "").toLowerCase()));
    if (match && match.model !== primary.model) {
      return {
        ...primary,
        model: match.model,
        group: match.group,
        score: match.score,
        reason: `${primary.reason} [Decision API → ${match.model}]`,
      };
    }
  } catch {
    // Fallback determinístico preserva a escolha Eval-First
  }
  return primary;
}

export async function executeAgentFailover(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>,
  params: {
    agentKeyOrName: string;
    errorText?: string;
    httpStatus?: number;
    trigger: FailoverEvent["trigger"];
    rankingSnapshot?: ModelRankingSnapshot | null;
    vipPolicy?: VipPolicyConfig;
    qualityBench?: Record<string, QualityProbeResult>;
    disabledModels?: string[];
    wakeAfter?: boolean;
    notify?: boolean;
  }
): Promise<FailoverEvent> {
  const agentsApi = (ctx as any)?.agents;
  const snap = agentsApi?.snapshot?.() || {};
  const allAgents: any[] = [...(snap.running || []), ...(snap.agents || [])];
  const q = String(params.agentKeyOrName || "").trim().toLowerCase();
  const target = allAgents.find(
    (a) =>
      String(a?.key || "").toLowerCase() === q ||
      String(a?.name || "").toLowerCase() === q ||
      String(a?.name || "").toLowerCase().includes(q)
  );

  const agentName = target?.name || params.agentKeyOrName;
  const agentKey = target?.key || params.agentKeyOrName;
  const fromModel = target?.config?.model || null;
  const fromGroup = target?.config?.provider || inferCanonicalGroupForModel(fromModel || "", groups)?.id || "nexusmind_openai";
  const vipPolicy = params.vipPolicy || loadVipPolicy();
  const vip = isVipAgent(agentName, vipPolicy);
  const errorKind = params.errorText ? classifyGatewayError(params.errorText, params.httpStatus) : "unknown";

  // Coloca o modelo que falhou em quarentena (se houve erro real)
  if (fromModel && params.errorText) {
    quarantineModel(fromModel, fromGroup, params.errorText, params.httpStatus, agentName);
  }

  let pick = pickFailoverCandidate({
    agentName,
    currentModel: fromModel,
    rankingSnapshot: params.rankingSnapshot,
    vipPolicy,
    qualityBench: params.qualityBench,
    disabledModels: params.disabledModels,
    groups,
  });

  // Tie-breaker via Buzz Decision Model API (ctx.decisions.decide) exclusivamente entre candidatos Eval-aprovados
  pick = await refineCandidateWithDecisionApi(ctx, agentName, vip, pick, params.rankingSnapshot);

  let applied = false;
  let wokeAgent = false;
  let note = pick.reason;

  if (pick.ok && pick.model && target && typeof agentsApi?.save === "function") {
    try {
      const nextCfg = {
        ...(target.config && typeof target.config === "object" ? target.config : {}),
        model: pick.model,
        provider: pick.group || "nexusmind_openai",
      };
      await agentsApi.save(target.key, { config: nextCfg });
      applied = true;

      if (params.wakeAfter && typeof agentsApi?.wake === "function") {
        try {
          await agentsApi.wake(target.key);
          wokeAgent = true;
        } catch {}
      }

      if (params.notify && typeof (ctx as any)?.notifications?.send === "function") {
        try {
          (ctx as any).notifications.send({
            title: vip ? `Failover VIP · ${agentName}` : `Failover Automático · ${agentName}`,
            body: `${fromModel || "anterior"} → ${pick.model} (${errorKind})`,
          });
        } catch {}
      }
    } catch (err: any) {
      note = `Falha ao salvar agente: ${err?.message || err}`;
    }
  } else if (!target) {
    note = `Agente '${params.agentKeyOrName}' não encontrado no Buzz.`;
  }

  const evt: FailoverEvent = {
    id: `fo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    agentKey,
    agentName,
    isVip: vip,
    fromModel,
    toModel: pick.model,
    toGroup: pick.group,
    reason: params.errorText || "Failover acionado manualmente",
    errorKind,
    trigger: params.trigger,
    applied,
    wokeAgent,
    note,
  };

  await appendFailoverLog(ctx, evt);

  try {
    const win = globalThis as any;
    if (typeof win?.dispatchEvent === "function" && typeof win?.CustomEvent === "function") {
      win.dispatchEvent(new win.CustomEvent("nexusmind.failover.completed", { detail: evt }));
    }
  } catch {}

  return evt;
}

export interface DetectedLiveAgentError {
  agentKey: string;
  agentName: string;
  errorText: string;
  errorKind: GatewayErrorKind;
  signature: string;
}

/**
 * Inspeciona atividade ao vivo dos agentes no Buzz (quando ctx.relay está disponível)
 * procurando erros reais de LLM (404, weekly limit, stream ended, malformed_function_call, 429, 5xx).
 */
export function scanLiveAgentErrors(ctx: Context): DetectedLiveAgentError[] {
  const out: DetectedLiveAgentError[] = [];
  const relaySnap = (ctx as any)?.relay?.snapshot?.();
  const activityMap = relaySnap?.session?.agentActivity;
  if (!activityMap || typeof activityMap !== "object") return out;

  const agentsSnap = (ctx as any)?.agents?.snapshot?.() || {};
  const allAgents: any[] = [...(agentsSnap.running || []), ...(agentsSnap.agents || [])];
  const byPubkey = new Map<string, any>();
  for (const a of allAgents) {
    if (a?.pubkey) byPubkey.set(String(a.pubkey).toLowerCase(), a);
    if (a?.key) byPubkey.set(String(a.key).toLowerCase(), a);
  }

  const entries: Array<[string, any]> =
    activityMap instanceof Map ? Array.from(activityMap.entries()) : Object.entries(activityMap);

  for (const [key, val] of entries) {
    const items = Array.isArray(val) ? val : val && typeof val === "object" ? [val] : [];
    for (const item of items) {
      const errText = String(item?.error || item?.statusText || item?.message || "");
      const isErr = item?.status === "error" || /ran into this error|weekly limit|malformed_function_call|stream ended|resource not found \(404\)|http 429|50[234]/i.test(errText);
      if (!isErr || !errText) continue;

      const kind = classifyGatewayError(errText);
      if (kind === "ok" || kind === "unknown") continue;

      const pub = String(item?.agentPubkey || item?.pubkey || key || "").toLowerCase();
      const agent = byPubkey.get(pub);
      const agentKey = agent?.key || key;
      const agentName = agent?.name || item?.agentName || key;
      const turnId = String(item?.turnId || item?.id || item?.updatedAt || "");
      const signature = `${agentKey}:${kind}:${turnId || errText.slice(0, 48)}`;
      out.push({
        agentKey,
        agentName,
        errorText: errText.slice(0, 220),
        errorKind: kind,
        signature,
      });
    }
  }

  return out;
}
