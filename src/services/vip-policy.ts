// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND VIP MODEL PROTECTION & 3-STATE ACCESS POLICY (v3.0)
// Controle simples em 3 estados para cada modelo:
//   - "auto"    : liberado no pool automático dos agentes da fábrica
//   - "vip"     : reservado exclusivamente para OrgFy Iris (CEO) e Conselho
//   - "blocked" : bloqueado para roteamento automático e failover
// Regra soberana:
//   1. Workers comuns NUNCA recebem modelos "vip" nem "blocked".
//   2. Agentes VIP (Iris / Conselho) NUNCA são alterados automaticamente
//      enquanto estiverem saudáveis; só fazem failover se falharem, e apenas
//      dentro da cadeia VIP aprovada.
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";

export type ModelAccessMode = "auto" | "vip" | "blocked";

export interface VipPolicyConfig {
  version: 1;
  vipModels: string[];
  blockedModels: string[];
  vipAgentPatterns: string[];
  vipFallbackChain: string[];
  autoProtectAnthropic: boolean;
  explicitAutoOverrides: string[];
}

export const LOCAL_STORAGE_VIP_POLICY_KEY = "nexusmind_vip_policy_v1";
export const SHARED_ROUTING_POLICY_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-routing-policy.json";

export const DEFAULT_VIP_MODELS: string[] = [
  "gpt-6.1-terra",
  "claude-sonnet-4-6",
  "claude-sonnet-5-5",
  "claude-opus-4-6",
  "claude-opus-4-6-thinking",
  "claude-opus-5-5",
];

export const DEFAULT_VIP_AGENT_PATTERNS: string[] = [
  "OrgFy Iris",
  "Conselho *",
];

export const DEFAULT_VIP_FALLBACK_CHAIN: string[] = [
  "claude-sonnet-4-6",
  "claude-sonnet-5-5",
  "claude-opus-4-6",
  "gpt-6.1-terra",
];

export const DEFAULT_VIP_POLICY: VipPolicyConfig = {
  version: 1,
  vipModels: [...DEFAULT_VIP_MODELS],
  blockedModels: [],
  vipAgentPatterns: [...DEFAULT_VIP_AGENT_PATTERNS],
  vipFallbackChain: [...DEFAULT_VIP_FALLBACK_CHAIN],
  autoProtectAnthropic: true,
  explicitAutoOverrides: [],
};

function normalizeId(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function uniqueStrings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function isDefaultVipModelId(modelId: string, groupId?: string): boolean {
  const m = normalizeId(modelId);
  if (!m) return false;
  if (groupId === "nexusmind_anthropic") return true;
  return (
    m === "gpt-6.1-terra" ||
    m.startsWith("claude-opus") ||
    m.startsWith("claude-sonnet-5") ||
    m === "claude-sonnet-4-6" ||
    m.startsWith("gpt-6") ||
    m.startsWith("gpt-5")
  );
}

export function loadVipPolicy(): VipPolicyConfig {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_VIP_POLICY_KEY);
    if (!raw) {
      // Migra bloqueios legados de nexusmind_routing_policy / nexusmind_disabled_models se existirem
      const legacyBlocked: string[] = [];
      try {
        const rawPol = (globalThis as any)?.localStorage?.getItem?.("nexusmind_routing_policy");
        if (rawPol) {
          const parsedPol = JSON.parse(rawPol);
          if (Array.isArray(parsedPol?.autoAssignBlocked)) {
            legacyBlocked.push(...parsedPol.autoAssignBlocked.map(String));
          }
        }
      } catch {}
      return {
        ...DEFAULT_VIP_POLICY,
        blockedModels: uniqueStrings(legacyBlocked),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      vipModels: Array.isArray(parsed?.vipModels) ? uniqueStrings(parsed.vipModels) : [...DEFAULT_VIP_MODELS],
      blockedModels: Array.isArray(parsed?.blockedModels) ? uniqueStrings(parsed.blockedModels) : [],
      vipAgentPatterns:
        Array.isArray(parsed?.vipAgentPatterns) && parsed.vipAgentPatterns.length > 0
          ? uniqueStrings(parsed.vipAgentPatterns)
          : [...DEFAULT_VIP_AGENT_PATTERNS],
      vipFallbackChain:
        Array.isArray(parsed?.vipFallbackChain) && parsed.vipFallbackChain.length > 0
          ? uniqueStrings(parsed.vipFallbackChain)
          : [...DEFAULT_VIP_FALLBACK_CHAIN],
      autoProtectAnthropic: parsed?.autoProtectAnthropic !== false,
      explicitAutoOverrides: Array.isArray(parsed?.explicitAutoOverrides)
        ? uniqueStrings(parsed.explicitAutoOverrides)
        : [],
    };
  } catch {
    return { ...DEFAULT_VIP_POLICY };
  }
}

export async function saveVipPolicy(ctx: Context | null | undefined, cfg: VipPolicyConfig): Promise<void> {
  const clean: VipPolicyConfig = {
    version: 1,
    vipModels: uniqueStrings(cfg.vipModels || []),
    blockedModels: uniqueStrings(cfg.blockedModels || []),
    vipAgentPatterns: uniqueStrings(cfg.vipAgentPatterns || DEFAULT_VIP_AGENT_PATTERNS),
    vipFallbackChain: uniqueStrings(cfg.vipFallbackChain || DEFAULT_VIP_FALLBACK_CHAIN),
    autoProtectAnthropic: cfg.autoProtectAnthropic !== false,
    explicitAutoOverrides: uniqueStrings(cfg.explicitAutoOverrides || []),
  };

  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_VIP_POLICY_KEY, JSON.stringify(clean));
  } catch {}

  // Sincroniza também para o arquivo compartilhado lido pela OrgFy / scripts
  const host = (ctx as any)?.host;
  if (typeof host?.writeFile === "function") {
    try {
      await host.writeFile(
        SHARED_ROUTING_POLICY_PATH,
        JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            vipPolicy: clean,
          },
          null,
          2
        )
      );
    } catch {}
  }
}

export function isVipAgent(agentNameOrKey: string, cfg: VipPolicyConfig = DEFAULT_VIP_POLICY): boolean {
  const target = normalizeId(agentNameOrKey);
  if (!target) return false;
  for (const rawPattern of cfg.vipAgentPatterns || DEFAULT_VIP_AGENT_PATTERNS) {
    const pat = normalizeId(rawPattern);
    if (!pat) continue;
    if (pat.endsWith("*")) {
      const prefix = pat.slice(0, -1).trim();
      if (prefix && (target.startsWith(prefix) || target.includes(prefix))) return true;
    } else if (target === pat || target.includes(pat)) {
      return true;
    }
  }
  return false;
}

export function getModelAccessMode(
  modelId: string,
  groupId: string | undefined,
  cfg: VipPolicyConfig,
  disabledModels?: string[]
): ModelAccessMode {
  const m = normalizeId(modelId);
  if (!m) return "blocked";

  if ((disabledModels || []).some((d) => normalizeId(d) === m)) {
    return "blocked";
  }
  if ((cfg.blockedModels || []).some((b) => normalizeId(b) === m)) {
    return "blocked";
  }
  if ((cfg.explicitAutoOverrides || []).some((a) => normalizeId(a) === m)) {
    return "auto";
  }
  if ((cfg.vipModels || []).some((v) => normalizeId(v) === m)) {
    return "vip";
  }
  if (cfg.autoProtectAnthropic && groupId === "nexusmind_anthropic") {
    return "vip";
  }
  return "auto";
}

export function setModelAccessMode(
  cfg: VipPolicyConfig,
  modelId: string,
  mode: ModelAccessMode
): VipPolicyConfig {
  const target = normalizeId(modelId);
  const strip = (arr: string[]) => (arr || []).filter((x) => normalizeId(x) !== target);

  const nextVip = strip(cfg.vipModels);
  const nextBlocked = strip(cfg.blockedModels);
  const nextAutoOverrides = strip(cfg.explicitAutoOverrides);

  if (mode === "vip") {
    nextVip.push(modelId);
  } else if (mode === "blocked") {
    nextBlocked.push(modelId);
  } else {
    // "auto": registra override explícito para sobrepor autoProtectAnthropic se necessário
    nextAutoOverrides.push(modelId);
  }

  return {
    ...cfg,
    vipModels: uniqueStrings(nextVip),
    blockedModels: uniqueStrings(nextBlocked),
    explicitAutoOverrides: uniqueStrings(nextAutoOverrides),
  };
}

export function applyQuickVipPreset(
  cfg: VipPolicyConfig,
  catalogModels: Array<{ id: string; primaryGroup?: string }>
): VipPolicyConfig {
  let next: VipPolicyConfig = {
    ...cfg,
    autoProtectAnthropic: true,
    vipModels: uniqueStrings([...cfg.vipModels, ...DEFAULT_VIP_MODELS]),
  };
  for (const m of catalogModels || []) {
    if (isDefaultVipModelId(m.id, m.primaryGroup)) {
      next = setModelAccessMode(next, m.id, "vip");
    }
  }
  return next;
}

export function toggleVipAgent(cfg: VipPolicyConfig, agentName: string): VipPolicyConfig {
  const clean = String(agentName || "").trim();
  if (!clean) return cfg;
  const target = normalizeId(clean);
  const existsExact = (cfg.vipAgentPatterns || []).some((p) => normalizeId(p) === target);
  if (existsExact) {
    return {
      ...cfg,
      vipAgentPatterns: cfg.vipAgentPatterns.filter((p) => normalizeId(p) !== target),
    };
  }
  return {
    ...cfg,
    vipAgentPatterns: uniqueStrings([...cfg.vipAgentPatterns, clean]),
  };
}

export function getAutoBlockedSetFromVipPolicy(
  cfg: VipPolicyConfig,
  catalogModels?: Array<{ id: string; primaryGroup?: string }>
): string[] {
  const out = new Set<string>();
  for (const m of cfg.blockedModels || []) out.add(m);
  for (const m of cfg.vipModels || []) {
    if (!cfg.explicitAutoOverrides.some((a) => normalizeId(a) === normalizeId(m))) {
      out.add(m);
    }
  }
  if (cfg.autoProtectAnthropic && Array.isArray(catalogModels)) {
    for (const m of catalogModels) {
      if (
        m.primaryGroup === "nexusmind_anthropic" &&
        !cfg.explicitAutoOverrides.some((a) => normalizeId(a) === normalizeId(m.id))
      ) {
        out.add(m.id);
      }
    }
  }
  return Array.from(out);
}
