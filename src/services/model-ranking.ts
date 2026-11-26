// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND MODEL RANKING & POLICY ROUTING ENGINE (v2.6)
// Combina telemetria real do Gateway (~/.buzz/.scratch/nm_usage_summary.json),
// healthcheck ao vivo (ctx.host.request), capacidade por tier e políticas do usuário:
//   - strategy: balanced | speed | quality | cost
//   - forceFree: forçar modelos :free na seleção automática
//   - maxCostPerReqUsd: teto de custo por requisição (evita modelos caros em tarefas simples)
//   - autoAssignBlocked: modelos proibidos para designação automática (uso apenas manual)
//   - tierPins: modelo fixado manualmente por tier
// Persiste snapshot em ~/.buzz/.scratch/nexusmind-model-ranking.json para OrgFy e agentes.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import {
  type CanonicalGroupDef,
  type NexusTier,
  isFreeModel,
  isUnsupportedAgentModel,
  scoreModelForTier,
} from "./smart-router";
import {
  type ModelAccessMode,
  type VipPolicyConfig,
  getModelAccessMode,
} from "./vip-policy";
import type { QualityProbeResult } from "./quality-bench";
import type { QuarantineEntry } from "./agentic-failover";

export type RankingTier = "geral" | NexusTier;
export type RoutingStrategy = "balanced" | "speed" | "quality" | "cost";

export interface RoutingPolicy {
  strategy: RoutingStrategy;
  forceFree: boolean;
  maxCostPerReqUsd: number | null;
  autoAssignBlocked: string[];
  tierPins: Partial<Record<RankingTier, string>>;
}

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  strategy: "balanced",
  forceFree: false,
  maxCostPerReqUsd: null,
  autoAssignBlocked: [],
  tierPins: {},
};

export interface GatewayUsageMetrics {
  calls: number;
  avgDurationMs: number | null;
  avgFirstTokenMs: number | null;
  totalCostUsd: number;
  avgCostUsd: number;
  cacheHitPct: number | null;
  lastSeenAt: string | null;
}

export interface LiveProbeState {
  status: "testing" | "ok" | "error";
  latency?: number;
  errorMsg?: string;
}

export interface RankedGatewayModel {
  rank: number;
  model: string;
  group: string;
  platform: string;
  isFree: boolean;
  isDisabled: boolean;
  autoAssignBlocked: boolean;
  accessMode: ModelAccessMode;
  quarantined: boolean;
  quarantineReason?: string;
  qualityScore: number | null;
  toolCallOk: boolean | null;
  eligibleForAuto: boolean;
  score: number;
  capabilityScore: number;
  tierMatchScore: number;
  adoptionScore: number;
  speedScore: number;
  online: boolean | null;
  pingLatencyMs: number | null;
  pingError?: string;
  calls: number;
  avgDurationMs: number | null;
  avgFirstTokenMs: number | null;
  cacheHitPct: number | null;
  avgCostUsd: number;
  totalCostUsd: number;
}

export interface BestTierSummary {
  model: string;
  group: string;
  platform: string;
  score: number;
  pingLatencyMs: number | null;
  calls: number;
  online: boolean | null;
  avgCostUsd: number;
  cacheHitPct: number | null;
  pinned?: boolean;
}

export interface ModelRankingSnapshot {
  version: 2;
  generatedAt: string;
  source: "gateway_usage+live_probe" | "gateway_usage" | "live_probe" | "catalog";
  usageSampleSize: number;
  tier: RankingTier;
  policy: RoutingPolicy;
  bestByTier: Record<RankingTier, BestTierSummary | null>;
  models: RankedGatewayModel[];
}

export const SHARED_RANKING_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-model-ranking.json";
export const SHARED_USAGE_SUMMARY_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nm_usage_summary.json",
  "~/.buzz/.scratch/nm_usage_summary.json",
];
export const SHARED_USAGE_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nm_usage.json",
  "~/.buzz/.scratch/nm_usage.json",
];
export const LOCAL_STORAGE_RANKING_KEY = "nexusmind_model_ranking";
export const LOCAL_STORAGE_POLICY_KEY = "nexusmind_routing_policy";

export function loadSavedRoutingPolicy(): RoutingPolicy {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_POLICY_KEY);
    if (!raw) return { ...DEFAULT_ROUTING_POLICY };
    const p = JSON.parse(raw);
    return {
      strategy: ["balanced", "speed", "quality", "cost"].includes(p?.strategy) ? p.strategy : "balanced",
      forceFree: Boolean(p?.forceFree),
      maxCostPerReqUsd: typeof p?.maxCostPerReqUsd === "number" && p.maxCostPerReqUsd > 0 ? p.maxCostPerReqUsd : null,
      autoAssignBlocked: Array.isArray(p?.autoAssignBlocked) ? p.autoAssignBlocked.map(String) : [],
      tierPins: p?.tierPins && typeof p.tierPins === "object" ? { ...p.tierPins } : {},
    };
  } catch {
    return { ...DEFAULT_ROUTING_POLICY };
  }
}

export function saveRoutingPolicy(policy: RoutingPolicy): void {
  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_POLICY_KEY, JSON.stringify(policy));
  } catch {}
}

function decodeFileContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}

export function inferCanonicalGroupForModel(
  modelId: string,
  groups: Record<string, CanonicalGroupDef>
): CanonicalGroupDef {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("grok") && groups.nexusmind_grok) return groups.nexusmind_grok;
  if (
    (m.includes("gemini") || m.includes("antigravity") || m.includes("thinking") || m.includes("-high") || m.includes("-medium") || m.includes("-low")) &&
    groups.nexusmind_antigravity
  ) {
    return groups.nexusmind_antigravity;
  }
  if (m.includes("claude") && groups.nexusmind_anthropic) return groups.nexusmind_anthropic;
  if (groups.nexusmind_openai) return groups.nexusmind_openai;
  return Object.values(groups)[0];
}

/**
 * Lê telemetria real de uso do Gateway NexusMind:
 * 1. Prioriza ~/.buzz/.scratch/nm_usage_summary.json (~42 KB, instantâneo na WebView)
 * 2. Fallback para ~/.buzz/.scratch/nm_usage.json (para execução em Node/testes)
 */
export async function loadGatewayUsageByModel(
  ctx: Context
): Promise<{ sampleSize: number; byModel: Record<string, GatewayUsageMetrics> }> {
  const host = (ctx as any)?.host;
  if (typeof host?.readFile !== "function") {
    return { sampleSize: 0, byModel: {} };
  }

  // 1. Leitura ultrarrápida do resumo pré-agregado (~42 KB)
  for (const path of SHARED_USAGE_SUMMARY_PATHS) {
    try {
      const raw = await host.readFile(path);
      if (!raw) continue;
      const parsed = JSON.parse(decodeFileContent(raw));
      if (parsed && typeof parsed.byModel === "object" && parsed.sampleSize > 0) {
        return {
          sampleSize: Number(parsed.sampleSize || 0),
          byModel: parsed.byModel as Record<string, GatewayUsageMetrics>,
        };
      }
    } catch {}
  }

  // 2. Fallback para arquivo bruto (funciona em Node / testes)
  for (const path of SHARED_USAGE_PATHS) {
    try {
      const raw = await host.readFile(path);
      if (!raw) continue;
      const parsed = JSON.parse(decodeFileContent(raw));
      const items: any[] = Array.isArray(parsed?.data?.items)
        ? parsed.data.items
        : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed)
        ? parsed
        : [];
      if (items.length === 0) continue;

      const acc = new Map<
        string,
        {
          calls: number;
          durSum: number;
          durN: number;
          ttftSum: number;
          ttftN: number;
          cost: number;
          inputTok: number;
          cacheReadTok: number;
          lastSeen: string | null;
        }
      >();

      for (const it of items) {
        const mid = String(it?.model || "").trim();
        if (!mid) continue;
        let cur = acc.get(mid);
        if (!cur) {
          cur = { calls: 0, durSum: 0, durN: 0, ttftSum: 0, ttftN: 0, cost: 0, inputTok: 0, cacheReadTok: 0, lastSeen: null };
          acc.set(mid, cur);
        }
        cur.calls += 1;
        const cost = Number(it?.actual_cost ?? it?.total_cost ?? 0);
        if (Number.isFinite(cost) && cost >= 0) cur.cost += cost;
        const dur = Number(it?.duration_ms);
        if (Number.isFinite(dur) && dur > 0 && dur < 600000) {
          cur.durSum += dur;
          cur.durN += 1;
        }
        const ttft = Number(it?.first_token_ms);
        if (Number.isFinite(ttft) && ttft > 0 && ttft < 120000) {
          cur.ttftSum += ttft;
          cur.ttftN += 1;
        }
        const inp = Number(it?.input_tokens ?? 0);
        const cr = Number(it?.cache_read_tokens ?? 0);
        if (Number.isFinite(inp) && inp > 0) cur.inputTok += inp;
        if (Number.isFinite(cr) && cr > 0) cur.cacheReadTok += cr;
        if (typeof it?.created_at === "string" && (!cur.lastSeen || it.created_at > cur.lastSeen)) {
          cur.lastSeen = it.created_at;
        }
      }

      const byModel: Record<string, GatewayUsageMetrics> = {};
      for (const [mid, st] of acc.entries()) {
        const totalIn = st.inputTok + st.cacheReadTok;
        byModel[mid] = {
          calls: st.calls,
          avgDurationMs: st.durN > 0 ? Math.round(st.durSum / st.durN) : null,
          avgFirstTokenMs: st.ttftN > 0 ? Math.round(st.ttftSum / st.ttftN) : null,
          totalCostUsd: Number(st.cost.toFixed(4)),
          avgCostUsd: st.calls > 0 ? Number((st.cost / st.calls).toFixed(6)) : 0,
          cacheHitPct: totalIn > 0 ? Number(((st.cacheReadTok / totalIn) * 100).toFixed(1)) : null,
          lastSeenAt: st.lastSeen,
        };
      }
      return { sampleSize: items.length, byModel };
    } catch {}
  }

  return { sampleSize: 0, byModel: {} };
}

function computeModelRowScore(
  modelId: string,
  tier: RankingTier,
  usage: GatewayUsageMetrics | undefined,
  probe: LiveProbeState | undefined,
  policy: RoutingPolicy
): {
  score: number;
  capabilityScore: number;
  tierMatchScore: number;
  adoptionScore: number;
  speedScore: number;
} {
  const effectiveTier: NexusTier = tier === "geral" ? "tier2_balanced" : tier;
  const { capability, tierMatch } = scoreModelForTier(modelId, effectiveTier);
  const calls = usage?.calls ?? 0;
  const adoptionScore = calls > 0 ? Math.min(100, Math.round(Math.log10(calls + 1) * 26)) : 0;

  let speedScore = 60;
  if (probe?.status === "ok" && typeof probe.latency === "number") {
    speedScore = Math.max(15, Math.min(100, Math.round(100 - (probe.latency / 1000) * 12)));
  } else if (usage?.avgFirstTokenMs && usage.avgFirstTokenMs > 0) {
    speedScore = Math.max(20, Math.min(98, Math.round(100 - (usage.avgFirstTokenMs / 1000) * 8)));
  } else if (usage?.avgDurationMs && usage.avgDurationMs > 0) {
    speedScore = Math.max(20, Math.min(95, Math.round(100 - (usage.avgDurationMs / 1000) * 1.4)));
  }

  const avgCost = usage?.avgCostUsd ?? 0;
  const costScore = avgCost <= 0 ? 100 : Math.max(10, Math.round(100 - Math.min(90, avgCost * 1800)));

  let rawScore: number;
  if (policy.strategy === "speed" || tier === "tier1_fast" || tier === "decision") {
    rawScore = speedScore * 0.4 + tierMatch * 0.3 + adoptionScore * 0.15 + capability * 0.15;
  } else if (policy.strategy === "quality" || tier === "tier3_frontier" || tier === "reasoning") {
    rawScore = capability * 0.48 + tierMatch * 0.32 + adoptionScore * 0.1 + speedScore * 0.1;
  } else if (policy.strategy === "cost") {
    rawScore = costScore * 0.4 + tierMatch * 0.25 + adoptionScore * 0.2 + capability * 0.15;
  } else {
    rawScore = capability * 0.32 + tierMatch * 0.28 + adoptionScore * 0.22 + speedScore * 0.18;
  }

  if (usage?.cacheHitPct && usage.cacheHitPct >= 50) {
    rawScore += Math.min(5, (usage.cacheHitPct - 40) / 12);
  }

  const free = isFreeModel(modelId);
  if (policy.forceFree) {
    rawScore += free ? 18 : -25;
  } else if (free) {
    rawScore -= 20;
  }

  if (probe?.status === "ok") {
    rawScore += 8;
  } else if (probe?.status === "error") {
    rawScore -= 60;
  }

  return {
    score: Number(Math.max(0, Math.min(100, rawScore)).toFixed(1)),
    capabilityScore: capability,
    tierMatchScore: tierMatch,
    adoptionScore,
    speedScore,
  };
}

/**
 * Monta o ranking completo combinando catálogo, uso real, ping ao vivo e política do usuário.
 */
export function buildModelRankingSnapshot(params: {
  catalogModels: Array<{ id: string; primaryGroup?: string; groups?: string[] }>;
  groups: Record<string, CanonicalGroupDef>;
  usageByModel: Record<string, GatewayUsageMetrics>;
  usageSampleSize: number;
  liveProbes?: Record<string, LiveProbeState>;
  disabledModels?: string[];
  tier?: RankingTier;
  avoidFree?: boolean;
  policy?: Partial<RoutingPolicy>;
  vipPolicy?: VipPolicyConfig;
  qualityBench?: Record<string, QualityProbeResult>;
  quarantines?: Record<string, QuarantineEntry>;
}): ModelRankingSnapshot {
  const tier: RankingTier = params.tier || "geral";
  const policy: RoutingPolicy = {
    ...DEFAULT_ROUTING_POLICY,
    ...(params.policy || {}),
    forceFree: params.policy?.forceFree ?? (params.avoidFree === false ? true : false),
    autoAssignBlocked: Array.isArray(params.policy?.autoAssignBlocked) ? params.policy!.autoAssignBlocked : [],
    tierPins: params.policy?.tierPins ? { ...params.policy.tierPins } : {},
  };

  const disabledSet = new Set(params.disabledModels || []);
  const blockedSet = new Set(policy.autoAssignBlocked.map((m) => m.toLowerCase()));
  const liveProbes = params.liveProbes || {};
  const qualityBench = params.qualityBench || {};
  const quarantines = params.quarantines || {};

  const pool = new Map<string, { id: string; group: CanonicalGroupDef }>();
  for (const m of params.catalogModels || []) {
    const mid = String(m?.id || "").trim();
    if (!mid) continue;
    const grp =
      (m.primaryGroup && params.groups[m.primaryGroup]) ||
      (Array.isArray(m.groups) && m.groups[0] && params.groups[m.groups[0]]) ||
      inferCanonicalGroupForModel(mid, params.groups);
    pool.set(mid, { id: mid, group: grp });
  }
  for (const mid of Object.keys(params.usageByModel || {})) {
    if (!pool.has(mid)) {
      pool.set(mid, { id: mid, group: inferCanonicalGroupForModel(mid, params.groups) });
    }
  }
  for (const grp of Object.values(params.groups)) {
    if (grp.defaultModel && !pool.has(grp.defaultModel)) {
      pool.set(grp.defaultModel, { id: grp.defaultModel, group: grp });
    }
  }

  const rankForTier = (targetTier: RankingTier): RankedGatewayModel[] => {
    const rows: RankedGatewayModel[] = [];
    for (const item of pool.values()) {
      const usage = params.usageByModel[item.id];
      const probe = liveProbes[item.id];
      const qBench = qualityBench[item.id];
      const qEntry = quarantines[item.id];
      const isDisabled = disabledSet.has(item.id);
      const unsupported = isUnsupportedAgentModel(item.id);
      const accessMode: ModelAccessMode = params.vipPolicy
        ? getModelAccessMode(item.id, item.group.id, params.vipPolicy, params.disabledModels)
        : isDisabled || blockedSet.has(item.id.toLowerCase())
        ? "blocked"
        : "auto";
      const isBlocked = unsupported || blockedSet.has(item.id.toLowerCase()) || accessMode !== "auto";
      const quarantined = Boolean(qEntry);
      const free = isFreeModel(item.id);
      const avgCost = usage?.avgCostUsd ?? 0;
      const exceedsCostCap =
        policy.maxCostPerReqUsd !== null && avgCost > 0 && avgCost > policy.maxCostPerReqUsd;
      const freeMismatch = policy.forceFree ? !free : false;
      const effectiveOnline =
        probe?.status === "ok"
          ? true
          : probe?.status === "error"
          ? false
          : qBench
          ? qBench.online
          : null;
      const eligibleForAuto =
        !isDisabled &&
        !isBlocked &&
        !quarantined &&
        effectiveOnline !== false &&
        !exceedsCostCap &&
        !freeMismatch;

      const scored = computeModelRowScore(item.id, targetTier, usage, probe, policy);
      let blendedScore = scored.score;
      if (qBench) {
        blendedScore = qBench.online
          ? Number(Math.max(0, Math.min(100, scored.score * 0.55 + qBench.qualityScore * 0.45 + (qBench.toolCallOk ? 6 : -10))).toFixed(1))
          : Math.max(0, Number((scored.score - 50).toFixed(1)));
      }
      if (quarantined) {
        blendedScore = Math.max(0, Number((blendedScore - 45).toFixed(1)));
      }

      rows.push({
        rank: 0,
        model: item.id,
        group: item.group.id,
        platform: item.group.platformKey,
        isFree: free,
        isDisabled,
        autoAssignBlocked: isBlocked,
        accessMode,
        quarantined,
        quarantineReason: qEntry?.reason,
        qualityScore: qBench ? qBench.qualityScore : null,
        toolCallOk: qBench ? qBench.toolCallOk : null,
        eligibleForAuto,
        score: isDisabled ? -1 : blendedScore,
        capabilityScore: scored.capabilityScore,
        tierMatchScore: scored.tierMatchScore,
        adoptionScore: scored.adoptionScore,
        speedScore: scored.speedScore,
        online: effectiveOnline,
        pingLatencyMs: typeof probe?.latency === "number" ? probe.latency : (qBench?.latencyMs ?? null),
        pingError: probe?.errorMsg || (!qBench?.online ? qBench?.errorMsg : undefined),
        calls: usage?.calls ?? 0,
        avgDurationMs: usage?.avgDurationMs ?? null,
        avgFirstTokenMs: usage?.avgFirstTokenMs ?? null,
        cacheHitPct: usage?.cacheHitPct ?? null,
        avgCostUsd: avgCost,
        totalCostUsd: usage?.totalCostUsd ?? 0,
      });
    }

    rows.sort((a, b) => {
      if (a.isDisabled !== b.isDisabled) return a.isDisabled ? 1 : -1;
      if ((a.online === false) !== (b.online === false)) return a.online === false ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.calls !== a.calls) return b.calls - a.calls;
      return (a.pingLatencyMs ?? 999999) - (b.pingLatencyMs ?? 999999);
    });

    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });
    return rows;
  };

  const tiers: RankingTier[] = ["geral", "tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"];
  const bestByTier = {} as Record<RankingTier, BestTierSummary | null>;
  let selectedRows: RankedGatewayModel[] = [];

  for (const t of tiers) {
    const ranked = rankForTier(t);
    if (t === tier) selectedRows = ranked;

    const pinnedModel = policy.tierPins[t];
    const pinnedRow = pinnedModel
      ? ranked.find((r) => r.model === pinnedModel && !r.isDisabled && !r.autoAssignBlocked && r.online !== false)
      : undefined;
    const winner = pinnedRow || ranked.find((r) => r.eligibleForAuto) || ranked.find((r) => !r.isDisabled && !r.autoAssignBlocked && r.online !== false) || null;

    bestByTier[t] = winner
      ? {
          model: winner.model,
          group: winner.group,
          platform: winner.platform,
          score: winner.score,
          pingLatencyMs: winner.pingLatencyMs,
          calls: winner.calls,
          online: winner.online,
          avgCostUsd: winner.avgCostUsd,
          cacheHitPct: winner.cacheHitPct,
          pinned: Boolean(pinnedRow),
        }
      : null;
  }

  const hasUsage = params.usageSampleSize > 0;
  const hasProbes = Object.values(liveProbes).some((p) => p.status === "ok" || p.status === "error");
  const source: ModelRankingSnapshot["source"] =
    hasUsage && hasProbes
      ? "gateway_usage+live_probe"
      : hasUsage
      ? "gateway_usage"
      : hasProbes
      ? "live_probe"
      : "catalog";

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    source,
    usageSampleSize: params.usageSampleSize,
    tier,
    policy,
    bestByTier,
    models: selectedRows,
  };
}

export async function persistModelRankingSnapshot(
  ctx: Context,
  snapshot: ModelRankingSnapshot
): Promise<boolean> {
  const payload = JSON.stringify(
    {
      ...snapshot,
      models: snapshot.models.slice(0, 80),
    },
    null,
    2
  );

  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_RANKING_KEY, payload);
  } catch {}

  const host = (ctx as any)?.host;
  if (typeof host?.writeFile === "function") {
    try {
      await host.writeFile(SHARED_RANKING_PATH, payload);
      return true;
    } catch {}
  }

  if (typeof host?.spawn === "function") {
    try {
      const b64 = btoa(unescape(encodeURIComponent(payload)));
      const py = `import base64, os; p=${JSON.stringify(SHARED_RANKING_PATH)}; os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(base64.b64decode(${JSON.stringify(b64)}))`;
      const proc = await host.spawn("python", { args: [py] });
      await proc.exited;
      return true;
    } catch {}
  }

  return false;
}
