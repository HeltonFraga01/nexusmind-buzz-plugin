// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND SMART MODEL ROUTER & BUZZ DECISION PROVIDER (v2.4)
// 1. Seleção ao vivo do melhor modelo por tier (tier1_fast | tier2_balanced | tier3_frontier | reasoning | decision)
// 2. Aplicação direta do melhor modelo saudável em agentes do Buzz (ctx.agents.save)
// 3. DecisionProvider nativo (ctx.decisions.registerProvider) roteando yes_no/choice/score
//    pelo modelo rápido e barato do próprio NexusMind Gateway!
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";

export type NexusTier = "tier1_fast" | "tier2_balanced" | "tier3_frontier" | "reasoning" | "decision";

export interface CanonicalGroupDef {
  id: string;
  platformKey: string;
  groupName: string;
  displayName: string;
  defaultKey: string;
  defaultModel: string;
  defaultCtx: number;
  defaultOut: number;
}

export interface RankedModelCandidate {
  model: string;
  group: string;
  platform: string;
  tierMatch: number;
  capabilityScore: number;
  latencyMs: number | null;
  combinedScore: number;
  online: boolean;
  isFree: boolean;
  error?: string;
}

export interface BestModelInput {
  tier?: NexusTier;
  exclude_models?: string[];
  prefer_free?: boolean;
  avoid_free?: boolean;
  max_probes?: number;
}

export interface BestModelResult {
  ok: boolean;
  tier: NexusTier;
  selectedModel: string | null;
  selectedGroup: string | null;
  selectedPlatform: string | null;
  selectedLatencyMs: number | null;
  selectedScore: number | null;
  candidatesTested: number;
  ranking: RankedModelCandidate[];
  message: string;
}

export function isFreeModel(modelId: string): boolean {
  const m = String(modelId || "").toLowerCase();
  return m.includes(":free") || m.includes("-free") || m.includes("/free") || m.endsWith("free");
}

export function isUnsupportedAgentModel(modelId: string): boolean {
  const m = String(modelId || "").trim().toLowerCase();
  if (!m) return true;
  return (
    m.startsWith("auto/") ||
    m.includes("tab_jump") ||
    m.includes("autocomplete") ||
    m.includes("fim-") ||
    m.includes("embedding") ||
    m.includes("rerank") ||
    m.includes("whisper") ||
    m.includes("tts") ||
    m.includes("imagen") ||
    m.includes("dall-e") ||
    m.includes("moderation")
  );
}

export function scoreModelForTier(modelId: string, tier: NexusTier): { capability: number; tierMatch: number } {
  const m = String(modelId || "").toLowerCase();
  let capability = 55;
  let tierMatch = 50;

  if (/(opus|gpt-5|gpt-6|claude-sonnet-5|claude-opus-5|gemini-3\.?5?-pro|gemini-2\.5-pro|grok-4\.5)/.test(m)) {
    capability = 92;
  } else if (/(claude-sonnet-4-6|sonnet|deepseek-r1|deepseek-v3|qwen3-coder|mistral-large|grok-4|codestral)/.test(m)) {
    capability = 84;
  } else if (/(gemini-3\.8-flash|gemini-2\.5-flash|haiku|flash|devstral|nemotron|kimi)/.test(m)) {
    capability = 74;
  } else if (/(mini|lite|nano|8b|7b|3b)/.test(m)) {
    capability = 58;
  }

  if (tier === "decision" || tier === "tier1_fast") {
    if (/(flash|haiku|mini|fast|lite|gemma|devstral)/.test(m)) tierMatch = 95;
    else if (/(sonnet|mistral-large)/.test(m)) tierMatch = 70;
    else if (/(opus|thinking|r1)/.test(m)) tierMatch = 35; // pesado/lento demais para tier1/decision
  } else if (tier === "tier2_balanced") {
    if (/(claude-sonnet-4-6|sonnet|mistral-large|gemini-3\.8-flash-medium|grok-4|qwen3-coder)/.test(m)) tierMatch = 95;
    else if (/(pro|opus|flash)/.test(m)) tierMatch = 75;
  } else if (tier === "tier3_frontier") {
    if (/(opus|gpt-5|gpt-6|claude-sonnet-5|gemini-3\.?5?-pro|grok-4\.5)/.test(m)) tierMatch = 98;
    else if (/(sonnet-4-6|thinking|reasoning|mistral-large)/.test(m)) tierMatch = 82;
    else if (/(nano|tiny|mini|lite)/.test(m)) tierMatch = 25;
  } else if (tier === "reasoning") {
    if (/(thinking|reasoning|r1|opus-4-6|opus-5|o3|gpt-5)/.test(m)) tierMatch = 98;
    else if (/(sonnet|pro|grok-4)/.test(m)) tierMatch = 75;
  }

  return { capability, tierMatch };
}

function getDisabledModels(): Set<string> {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.("nexusmind_disabled_models");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x) => String(x))) : new Set();
  } catch {
    return new Set();
  }
}

async function pingModel(
  ctx: Context,
  modelId: string,
  group: CanonicalGroupDef
): Promise<{ online: boolean; latencyMs: number | null; error?: string }> {
  const host = (ctx as any)?.host;
  if (typeof host?.request !== "function") {
    return { online: false, latencyMs: null, error: "ctx.host.request indisponível" };
  }
  const isAnthropic = group.id === "nexusmind_anthropic";
  const url = isAnthropic
    ? "https://api.nexusmind.digital/v1/messages"
    : "https://api.nexusmind.digital/v1/chat/completions";
  const headers: Record<string, string> = isAnthropic
    ? {
        "x-api-key": group.defaultKey,
        Authorization: `Bearer ${group.defaultKey}`,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/NexusMindRouter",
      }
    : {
        Authorization: `Bearer ${group.defaultKey}`,
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/NexusMindRouter",
      };

  const t0 = Date.now();
  try {
    const probeBody: Record<string, any> = isAnthropic
      ? {
          model: modelId,
          messages: [{ role: "user", content: "ok" }],
          max_tokens: 16,
          tools: [{ name: "ping", description: "healthcheck", input_schema: { type: "object", properties: {} } }],
        }
      : {
          model: modelId,
          messages: [{ role: "user", content: "ok" }],
          max_tokens: 5,
          tools: [{ type: "function", function: { name: "ping", description: "healthcheck", parameters: { type: "object", properties: {} } } }],
        };
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(probeBody),
      timeoutMs: 9000,
    });
    const latencyMs = Date.now() - t0;
    if (res?.status >= 200 && res?.status < 300) {
      return { online: true, latencyMs };
    }
    return { online: false, latencyMs, error: `HTTP ${res?.status ?? "err"}` };
  } catch (err: any) {
    return { online: false, latencyMs: Date.now() - t0, error: String(err?.message || err).slice(0, 100) };
  }
}

/**
 * Seleciona ao vivo o melhor modelo saudável no NexusMind para o tier solicitado,
 * evitando modelos desativados, excluídos ou com erro HTTP/rate-limit.
 */
export async function selectBestModelByTier(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>,
  input: BestModelInput = {}
): Promise<BestModelResult> {
  const tier: NexusTier = input.tier || "tier2_balanced";
  let savedPolicy: { forceFree?: boolean; autoAssignBlocked?: string[] } = {};
  try {
    const rawPol = (globalThis as any)?.localStorage?.getItem?.("nexusmind_routing_policy");
    if (rawPol) savedPolicy = JSON.parse(rawPol) || {};
  } catch {}
  const preferFree = input.prefer_free !== undefined ? Boolean(input.prefer_free) : Boolean(savedPolicy.forceFree);
  const avoidFree = input.avoid_free !== false && !preferFree;
  const maxProbes = Math.max(1, Math.min(8, Number(input.max_probes || 5)));
  const disabled = getDisabledModels();
  const blockedAuto = new Set((savedPolicy.autoAssignBlocked || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
  const excluded = new Set([
    ...(input.exclude_models || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean),
    ...blockedAuto,
  ]);
  const host = (ctx as any)?.host;

  const catalog = new Map<string, { id: string; group: CanonicalGroupDef }>();
  if (typeof host?.request === "function") {
    await Promise.all(
      Object.values(groups).map(async (grp) => {
        try {
          const res = await host.request({
            url: "https://api.nexusmind.digital/v1/models",
            method: "GET",
            headers: {
              Authorization: `Bearer ${grp.defaultKey}`,
              "User-Agent": "BuzzDesktop/NexusMindRouter",
            },
            timeoutMs: 8000,
          });
          if (res?.status >= 200 && res?.status < 300 && res?.body) {
            const parsed = JSON.parse(res.body);
            for (const m of Array.isArray(parsed?.data) ? parsed.data : []) {
              const mid = String(m?.id || "").trim();
              if (!mid || isUnsupportedAgentModel(mid) || disabled.has(mid) || excluded.has(mid.toLowerCase()) || catalog.has(mid)) continue;
              catalog.set(mid, { id: mid, group: grp });
            }
          }
        } catch {
          // Grupo falhou; segue nos demais
        }
      })
    );
  }

  // Fallback para os modelos padrão dos 4 grupos se /v1/models falhar
  if (catalog.size === 0) {
    for (const grp of Object.values(groups)) {
      if (!disabled.has(grp.defaultModel) && !excluded.has(grp.defaultModel.toLowerCase())) {
        catalog.set(grp.defaultModel, { id: grp.defaultModel, group: grp });
      }
    }
  }

  let pool = Array.from(catalog.values());
  if (preferFree) {
    const freeOnly = pool.filter((c) => isFreeModel(c.id));
    if (freeOnly.length > 0) pool = freeOnly;
  } else if (avoidFree) {
    const paidOnly = pool.filter((c) => !isFreeModel(c.id));
    if (paidOnly.length > 0) pool = paidOnly;
  }

  const preRanked = pool
    .map((item) => {
      const { capability, tierMatch } = scoreModelForTier(item.id, tier);
      const preScore = tierMatch * 0.65 + capability * 0.35;
      return { ...item, capability, tierMatch, preScore };
    })
    .sort((a, b) => b.preScore - a.preScore)
    .slice(0, maxProbes);

  const probed: RankedModelCandidate[] = await Promise.all(
    preRanked.map(async (cand) => {
      const ping = await pingModel(ctx, cand.id, cand.group);
      const latencyWeight = tier === "decision" || tier === "tier1_fast" ? 8 : 3.5;
      const latencyPenalty = ping.latencyMs !== null ? Math.min(35, (ping.latencyMs / 1000) * latencyWeight) : 35;
      const combinedScore = ping.online ? Number((cand.preScore - latencyPenalty).toFixed(2)) : -1;
      return {
        model: cand.id,
        group: cand.group.id,
        platform: cand.group.platformKey,
        tierMatch: cand.tierMatch,
        capabilityScore: cand.capability,
        latencyMs: ping.latencyMs,
        combinedScore,
        online: ping.online,
        isFree: isFreeModel(cand.id),
        error: ping.error,
      };
    })
  );

  probed.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    return (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999);
  });

  const winner = probed.find((p) => p.online) || null;
  return {
    ok: Boolean(winner),
    tier,
    selectedModel: winner?.model || null,
    selectedGroup: winner?.group || null,
    selectedPlatform: winner?.platform || null,
    selectedLatencyMs: winner?.latencyMs ?? null,
    selectedScore: winner?.combinedScore ?? null,
    candidatesTested: probed.length,
    ranking: probed,
    message: winner
      ? `Melhor modelo para '${tier}': ${winner.model} (${winner.group}, ${winner.latencyMs}ms, score ${winner.combinedScore}).`
      : `Nenhum dos ${probed.length} modelos testados respondeu HTTP 200 para '${tier}'.`,
  };
}

/**
 * Seleciona o melhor modelo saudável para um tier e atualiza diretamente a config do agente no Buzz.
 */
export async function applyBestModelToAgent(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>,
  input: BestModelInput & { agente: string }
): Promise<BestModelResult & { applied: boolean; agentKey: string | null; previousModel: string | null }> {
  const selection = await selectBestModelByTier(ctx, groups, input);
  if (!selection.ok || !selection.selectedModel) {
    return { ...selection, applied: false, agentKey: null, previousModel: null };
  }

  const agentsApi = (ctx as any)?.agents;
  const snap = agentsApi?.snapshot?.() || {};
  const allAgents: any[] = [...(snap.running || []), ...(snap.agents || [])];
  const q = String(input.agente || "").trim().toLowerCase();
  const target = allAgents.find(
    (a) =>
      String(a?.key || "").toLowerCase() === q ||
      String(a?.name || "").toLowerCase() === q ||
      String(a?.name || "").toLowerCase().includes(q)
  );

  if (!target || typeof agentsApi?.save !== "function") {
    return {
      ...selection,
      applied: false,
      agentKey: target?.key || null,
      previousModel: target?.config?.model || null,
      message: `${selection.message} (Agente '${input.agente}' não encontrado ou ctx.agents.save indisponível).`,
    };
  }

  const previousModel = target?.config?.model || null;
  const nextCfg = {
    ...(target.config && typeof target.config === "object" ? target.config : {}),
    model: selection.selectedModel,
    provider: selection.selectedGroup || "nexusmind_antigravity",
  };
  await agentsApi.save(target.key, { config: nextCfg });

  return {
    ...selection,
    applied: true,
    agentKey: target.key,
    previousModel,
    message: `Agente '${target.name || target.key}' atualizado de '${previousModel || "padrão"}' para '${selection.selectedModel}' (${selection.selectedGroup}, ${selection.selectedLatencyMs}ms).`,
  };
}

export interface DecisionsModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  autoRankFallback: boolean;
}

const DECISIONS_CONFIG_STORAGE_KEY = "nexusmind_decisions_config_v1";
const DECISIONS_CONFIG_DISK_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-decisions-config.json";

function readDecisionsConfig(defaultModel: string): DecisionsModelConfig {
  const defaults: DecisionsModelConfig = {
    primaryModel: "gemini-2.5-flash",
    fallbackModels: ["gemini-3.8-flash-medium", "claude-sonnet-4-6", "claude-sonnet-5-5"],
    autoRankFallback: true,
  };
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(DECISIONS_CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const rawPrimary = String(parsed?.primaryModel || "").trim();
    const primary =
      rawPrimary && !isUnsupportedAgentModel(rawPrimary) ? rawPrimary : defaults.primaryModel;
    const rawFallbacks = Array.isArray(parsed?.fallbackModels)
      ? parsed.fallbackModels
          .map((x: any) => String(x || "").trim())
          .filter((x: string) => Boolean(x) && !isUnsupportedAgentModel(x) && x !== "gpt-6.1-terra" && x !== "grok-4.1-fast")
      : [];
    const fallbacks = rawFallbacks.length > 0 ? rawFallbacks : defaults.fallbackModels;
    const autoRankFallback = parsed?.autoRankFallback !== false;
    return { primaryModel: primary, fallbackModels: fallbacks, autoRankFallback };
  } catch {
    return defaults;
  }
}

function saveDecisionsConfig(ctx: Context, cfg: DecisionsModelConfig): void {
  try {
    (globalThis as any)?.localStorage?.setItem?.(DECISIONS_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
  try {
    const host = (ctx as any)?.host;
    if (typeof host?.writeFile === "function") {
      void host.writeFile(DECISIONS_CONFIG_DISK_PATH, JSON.stringify(cfg, null, 2));
    }
  } catch {}
}

function resolveGroupForModel(
  modelId: string,
  groups: Record<string, CanonicalGroupDef>,
  fallbackGroup: CanonicalGroupDef
): CanonicalGroupDef {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("grok") && groups.nexusmind_grok) return groups.nexusmind_grok;
  if (m.includes("claude") && groups.nexusmind_anthropic) return groups.nexusmind_anthropic;
  if ((m.includes("gemini") || m.includes("antigravity")) && groups.nexusmind_antigravity) {
    return groups.nexusmind_antigravity;
  }
  if (groups.nexusmind_openai) return groups.nexusmind_openai;
  return fallbackGroup;
}

function getKnownDecisionModels(groups: Record<string, CanonicalGroupDef>): string[] {
  const set = new Set<string>();
  for (const grp of Object.values(groups)) {
    if (grp?.defaultModel && !isUnsupportedAgentModel(grp.defaultModel)) set.add(grp.defaultModel);
  }
  for (const seed of [
    "gemini-2.5-flash",
    "gemini-3.8-flash-medium",
    "claude-sonnet-4-6",
    "claude-sonnet-5-5",
  ]) {
    set.add(seed);
  }
  try {
    const rawRank = (globalThis as any)?.localStorage?.getItem?.("nexusmind_model_ranking");
    if (rawRank) {
      const parsed = JSON.parse(rawRank);
      for (const m of Array.isArray(parsed?.models) ? parsed.models : []) {
        if (m?.model && !isUnsupportedAgentModel(m.model) && m?.online !== false && !m?.isDisabled && !isFreeModel(m.model)) {
          set.add(String(m.model));
        }
      }
    }
  } catch {}
  try {
    const rawCached = (globalThis as any)?.localStorage?.getItem?.("nexusmind_cached_models");
    if (rawCached) {
      const parsed = JSON.parse(rawCached);
      for (const m of Array.isArray(parsed) ? parsed : []) {
        if (m?.id && !isUnsupportedAgentModel(m.id) && !isFreeModel(m.id)) set.add(String(m.id));
      }
    }
  } catch {}
  return Array.from(set);
}

function getRankingFallbackModels(): string[] {
  try {
    const rawRank = (globalThis as any)?.localStorage?.getItem?.("nexusmind_model_ranking");
    if (!rawRank) return [];
    const parsed = JSON.parse(rawRank);
    if (!Array.isArray(parsed?.models)) return [];
    return parsed.models
      .filter((m: any) => m?.model && m?.online !== false && !m?.isDisabled && !isFreeModel(m.model))
      .slice(0, 6)
      .map((m: any) => String(m.model));
  } catch {
    return [];
  }
}

/**
 * Registra um DecisionProvider nativo do NexusMind no Buzz Desktop (`Settings > Decisions API`),
 * com seleção de modelo customizado + cadeia de fallback automático (sem ficar preso a um único modelo).
 */
export function createNexusMindDecisionProvider(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>
) {
  const fastGroup = groups.nexusmind_antigravity || Object.values(groups)[0];
  const defaultModel = fastGroup?.defaultModel || "gemini-3.8-flash-medium";
  const listeners = new Set<() => void>();
  const notifyListeners = () => {
    for (const fn of Array.from(listeners)) {
      try {
        fn();
      } catch {}
    }
  };

  const React = (ctx as any)?.react;
  const SettingsComponent = React?.createElement
    ? function NexusMindDecisionsSettings() {
        const h = React.createElement;
        const [cfg, setCfg] = React.useState(() => readDecisionsConfig(defaultModel)) as [DecisionsModelConfig, (v: DecisionsModelConfig) => void];
        const [fallbackInput, setFallbackInput] = React.useState(() =>
          readDecisionsConfig(defaultModel).fallbackModels.join(", ")
        ) as [string, (v: string) => void];
        const [savedMsg, setSavedMsg] = React.useState("") as [string, (v: string) => void];
        const [pingState, setPingState] = React.useState({
          busy: false,
          text: "",
        }) as [{ busy: boolean; text: string; ok?: boolean }, (v: { busy: boolean; text: string; ok?: boolean }) => void];
        const knownModels = React.useMemo(() => getKnownDecisionModels(groups), []);

        const applySave = (nextCfg: DecisionsModelConfig, note: string) => {
          setCfg(nextCfg);
          setFallbackInput(nextCfg.fallbackModels.join(", "));
          saveDecisionsConfig(ctx, nextCfg);
          notifyListeners();
          setSavedMsg(note);
        };

        const handleSaveClick = () => {
          const cleanPrimary = String(cfg.primaryModel || "").trim() || defaultModel;
          const cleanFallbacks = fallbackInput
            .split(/[,\n]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => Boolean(s) && s.toLowerCase() !== cleanPrimary.toLowerCase());
          applySave(
            {
              primaryModel: cleanPrimary,
              fallbackModels: Array.from(new Set(cleanFallbacks)),
              autoRankFallback: cfg.autoRankFallback,
            },
            `Salvo: ${cleanPrimary} (+ ${cleanFallbacks.length} fallback${cleanFallbacks.length === 1 ? "" : "s"})`
          );
        };

        const handlePickBestAuto = async () => {
          setPingState({ busy: true, text: "Testando modelos mais rápidos no NexusMind..." });
          try {
            const best = await selectBestModelByTier(ctx, groups, { tier: "decision", max_probes: 5 });
            if (best.ok && best.selectedModel) {
              const otherOnline = best.ranking
                .filter((r) => r.online && r.model !== best.selectedModel)
                .map((r) => r.model);
              const nextFallbacks = Array.from(new Set([...otherOnline, ...cfg.fallbackModels])).filter(
                (m) => m !== best.selectedModel
              );
              applySave(
                { primaryModel: best.selectedModel, fallbackModels: nextFallbacks.slice(0, 5), autoRankFallback: true },
                `Auto-selecionado: ${best.selectedModel} (${best.selectedLatencyMs}ms)`
              );
              setPingState({ busy: false, ok: true, text: `Online: ${best.selectedModel} (${best.selectedLatencyMs}ms)` });
            } else {
              setPingState({ busy: false, ok: false, text: best.message });
            }
          } catch (err: any) {
            setPingState({ busy: false, ok: false, text: `Erro ao testar: ${err?.message || err}` });
          }
        };

        const handleTestPrimary = async () => {
          const mdl = String(cfg.primaryModel || "").trim() || defaultModel;
          const grp = resolveGroupForModel(mdl, groups, fastGroup);
          setPingState({ busy: true, text: `Pingando ${mdl} via ${grp.id}...` });
          const res = await pingModel(ctx, mdl, grp);
          setPingState({
            busy: false,
            ok: res.online,
            text: res.online
              ? `OK · ${mdl} respondeu em ${res.latencyMs}ms (${grp.id})`
              : `FALHA · ${mdl} (${res.error || "indisponível"}) — failover automático entrará em ação se ocorrer em produção.`,
          });
        };

        const inputStyle = {
          width: "100%",
          boxSizing: "border-box" as const,
          padding: "8px 10px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.16)",
          backgroundColor: "rgba(0,0,0,0.28)",
          color: "#f3f4f6",
          fontSize: "12px",
          fontFamily: "monospace",
        };

        return h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.03)",
              maxWidth: "560px",
              width: "100%",
              boxSizing: "border-box",
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { style: { fontSize: "12px", fontWeight: "600", color: "#e5e7eb" } }, "Modelo Principal (Customizável)"),
            h("input", {
              type: "text",
              value: cfg.primaryModel,
              placeholder: "Ex.: gemini-3.8-flash-medium, gpt-6.1-terra, claude-sonnet-5-5",
              onChange: (e: any) => {
                setSavedMsg("");
                setCfg({ ...cfg, primaryModel: e.target.value });
              },
              style: inputStyle,
            }),
            h(
              "select",
              {
                value: knownModels.includes(cfg.primaryModel) ? cfg.primaryModel : "",
                onChange: (e: any) => {
                  if (e.target.value) {
                    setSavedMsg("");
                    setCfg({ ...cfg, primaryModel: e.target.value });
                  }
                },
                style: { ...inputStyle, cursor: "pointer" },
              },
              h("option", { value: "" }, "— Escolher da lista do NexusMind Gateway —"),
              ...knownModels.map((m: string) => h("option", { key: m, value: m }, m))
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "label",
              { style: { fontSize: "12px", fontWeight: "600", color: "#e5e7eb" } },
              "Cadeia de Fallback Automático (separados por vírgula)"
            ),
            h("input", {
              type: "text",
              value: fallbackInput,
              placeholder: "gpt-6.1-terra, claude-sonnet-5-5, grok-4.1-fast",
              onChange: (e: any) => {
                setSavedMsg("");
                setFallbackInput(e.target.value);
              },
              style: inputStyle,
            })
          ),
          h(
            "label",
            { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#cbd5e1", cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              checked: cfg.autoRankFallback,
              onChange: (e: any) => {
                setSavedMsg("");
                setCfg({ ...cfg, autoRankFallback: Boolean(e.target.checked) });
              },
            }),
            "Usar Ranking NexusMind automaticamente como failover se principal + fallbacks falharem"
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h(
              "button",
              {
                type: "button",
                onClick: handleSaveClick,
                style: {
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#10b981",
                  color: "#000",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                },
              },
              "Salvar Modelo"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: handleTestPrimary,
                disabled: pingState.busy,
                style: {
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(56,189,248,0.45)",
                  backgroundColor: "rgba(56,189,248,0.12)",
                  color: "#38bdf8",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: pingState.busy ? "wait" : "pointer",
                },
              },
              pingState.busy ? "Testando..." : "Testar Modelo"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: handlePickBestAuto,
                disabled: pingState.busy,
                style: {
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "#e5e7eb",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: pingState.busy ? "wait" : "pointer",
                },
              },
              "⚡ Auto (Melhor Online)"
            )
          ),
          savedMsg &&
            h("div", { style: { fontSize: "11px", color: "#34d399", fontFamily: "monospace" } }, savedMsg),
          pingState.text &&
            h(
              "div",
              {
                style: {
                  fontSize: "11px",
                  color: pingState.ok === false ? "#fca5a5" : pingState.ok === true ? "#34d399" : "#93c5fd",
                  fontFamily: "monospace",
                },
              },
              pingState.text
            )
        );
      }
    : undefined;

  return {
    id: "nexusmind-fast",
    label: "NexusMind Fast Decisions",
    description:
      "Modelo customizável via NexusMind Gateway com fallback automático para Attention e roteamento OrgFy.",
    order: 5,
    status: () => (fastGroup?.defaultKey ? "ready" : "needs-setup") as "ready" | "needs-setup",
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ...(SettingsComponent ? { Settings: SettingsComponent } : {}),
    decide: async (request: any, options: { signal: AbortSignal }) => {
      const host = (ctx as any)?.host;
      if (typeof host?.request !== "function") {
        return { outcome: "failed" as const, reason: "unavailable" as const };
      }

      const questionsSpec = Object.entries(request.questions || {}).map(([key, q]: [string, any]) => {
        if (q.type === "yes_no") {
          return `- "${key}" (yes_no): ${q.instructions} -> retorne {"type":"yes_no","probability": <numero 0..1>}`;
        }
        if (q.type === "choice") {
          return `- "${key}" (choice): ${q.instructions} | opcoes: ${JSON.stringify(q.options)} -> retorne {"type":"choice","choice":"<uma das chaves>","confidence":<0..1>,"probabilities":{}}`;
        }
        return `- "${key}" (score): ${q.instructions} | niveis 0..${(q.levels?.length || 2) - 1}: ${JSON.stringify(q.levels)} -> retorne {"type":"score","score":<numero 0..N-1>,"confidence":<0..1>,"probabilities":{}}`;
      });

      const prompt = [
        "Você é um motor de decisão determinístico ultrarrápido. Responda APENAS um objeto JSON válido (sem markdown, sem comentários) mapeando cada chave de pergunta para sua resposta exata.",
        "Perguntas:",
        ...questionsSpec,
        "",
        "Texto para julgar (state):",
        String(request.state || "").slice(0, 6000),
      ].join("\n");

      const tryCall = async (grp: CanonicalGroupDef, mdl: string) => {
        if (options?.signal?.aborted) {
          return { outcome: "failed" as const, reason: "timeout" as const };
        }
        const isAnthropic = grp.id === "nexusmind_anthropic";
        const url = isAnthropic
          ? "https://api.nexusmind.digital/v1/messages"
          : "https://api.nexusmind.digital/v1/chat/completions";
        const headers: Record<string, string> = isAnthropic
          ? {
              "x-api-key": grp.defaultKey,
              Authorization: `Bearer ${grp.defaultKey}`,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
              "User-Agent": "BuzzDesktop/NexusMindDecisions",
            }
          : {
              Authorization: `Bearer ${grp.defaultKey}`,
              "Content-Type": "application/json",
              "User-Agent": "BuzzDesktop/NexusMindDecisions",
            };
        const reqBody = isAnthropic
          ? {
              model: mdl,
              max_tokens: 600,
              system: "Retorne estritamente JSON válido seguindo o schema solicitado.",
              messages: [{ role: "user", content: prompt }],
            }
          : {
              model: mdl,
              temperature: 0,
              max_tokens: 600,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: "Retorne estritamente JSON válido seguindo o schema solicitado." },
                { role: "user", content: prompt },
              ],
            };

        const res = await host.request({
          url,
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
          timeoutMs: Math.min(7000, Math.max(2000, Number(request.timeoutMs || 7000))),
        });

        if (!res || res.status < 200 || res.status >= 300 || !res.body) {
          return null;
        }
        const outer = JSON.parse(res.body);
        const rawText = isAnthropic
          ? String(outer?.content?.find?.((b: any) => b?.type === "text")?.text || outer?.content?.[0]?.text || "").trim()
          : String(outer?.choices?.[0]?.message?.content || "").trim();
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== "object") return null;

        // Normaliza respostas conforme o contrato estrito do DecisionsService
        const answers: Record<string, any> = {};
        for (const [k, q] of Object.entries(request.questions || {}) as Array<[string, any]>) {
          const raw = parsed[k];
          if (!raw || typeof raw !== "object") return null;
          if (q.type === "yes_no") {
            const p = Math.max(0, Math.min(1, Number(raw.probability ?? (raw.answer ? 1 : 0))));
            answers[k] = { type: "yes_no", probability: Number.isFinite(p) ? p : 0.5 };
          } else if (q.type === "choice") {
            const keys = Object.keys(q.options || {});
            const ch = keys.includes(String(raw.choice)) ? String(raw.choice) : keys[0];
            const rawConf = Number(raw.confidence ?? 0.8);
            const conf = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.8;
            const normProbs: Record<string, number> = {};
            if (raw.probabilities && typeof raw.probabilities === "object") {
              for (const [pk, pv] of Object.entries(raw.probabilities)) {
                if (keys.includes(pk)) {
                  const num = Number(pv);
                  if (Number.isFinite(num)) normProbs[pk] = Math.max(0, Math.min(1, num));
                }
              }
            }
            if (Object.keys(normProbs).length === 0 && ch) {
              normProbs[ch] = conf;
            }
            answers[k] = {
              type: "choice",
              choice: ch,
              confidence: conf,
              probabilities: normProbs,
            };
          } else if (q.type === "score") {
            const levels: string[] = Array.isArray(q.levels) ? q.levels.map(String) : [];
            const maxIdx = Math.max(1, levels.length - 1);
            const rawSc = Number(raw.score ?? 0);
            const sc = Number.isFinite(rawSc) ? Math.max(0, Math.min(maxIdx, rawSc)) : 0;
            const rawConf = Number(raw.confidence ?? 0.8);
            const conf = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.8;
            const normProbs: Record<string, number> = {};
            if (raw.probabilities && typeof raw.probabilities === "object") {
              for (const [pk, pv] of Object.entries(raw.probabilities)) {
                const num = Number(pv);
                if (!Number.isFinite(num)) continue;
                const clamped = Math.max(0, Math.min(1, num));
                if (/^\d+$/.test(pk) && Number(pk) >= 0 && Number(pk) <= maxIdx) {
                  normProbs[pk] = clamped;
                } else {
                  const idx = levels.findIndex((lv) => lv.toLowerCase() === pk.toLowerCase());
                  if (idx >= 0) normProbs[String(idx)] = clamped;
                }
              }
            }
            if (Object.keys(normProbs).length === 0) {
              normProbs[String(Math.round(sc))] = conf;
            }
            answers[k] = {
              type: "score",
              score: sc,
              confidence: conf,
              probabilities: normProbs,
            };
          }
        }
        return { outcome: "answered" as const, model: mdl, answers };
      };

      const cfg = readDecisionsConfig(defaultModel);
      const chain: string[] = [
        cfg.primaryModel,
        ...cfg.fallbackModels,
        ...(cfg.autoRankFallback ? getRankingFallbackModels() : []),
        ...Object.values(groups).map((g) => g.defaultModel),
      ]
        .map((m) => String(m || "").trim())
        .filter(Boolean);
      const uniqueChain = Array.from(new Set(chain)).slice(0, 6);

      try {
        for (const candidateModel of uniqueChain) {
          if (options?.signal?.aborted) {
            return { outcome: "failed" as const, reason: "timeout" as const };
          }
          const grp = resolveGroupForModel(candidateModel, groups, fastGroup);
          try {
            const result = await tryCall(grp, candidateModel);
            if (result) return result;
          } catch {
            // Tenta próximo modelo na cadeia de fallback
          }
        }
        return { outcome: "failed" as const, reason: "service_error" as const };
      } catch {
        return { outcome: "failed" as const, reason: "invalid_response" as const };
      }
    },
  };
}
