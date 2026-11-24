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
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: isAnthropic ? 16 : 5,
      }),
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
              if (!mid || disabled.has(mid) || excluded.has(mid.toLowerCase()) || catalog.has(mid)) continue;
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

/**
 * Registra um DecisionProvider nativo do NexusMind no Buzz Desktop (`Settings > Decisions API`),
 * usando um modelo ultrarrápido e barato do próprio Gateway (gemini-3.8-flash-medium) para responder
 * perguntas batch yes_no / choice / score do Attention Classifier e do OrgFy Decision Router.
 */
export function createNexusMindDecisionProvider(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>
) {
  const fastGroup = groups.nexusmind_antigravity || Object.values(groups)[0];
  const fallbackGroup = groups.nexusmind_openai || fastGroup;
  const decisionModel = fastGroup?.defaultModel || "gemini-3.8-flash-medium";

  return {
    id: "nexusmind-fast",
    label: "NexusMind Fast Decisions",
    description: `Modelo rápido via NexusMind Gateway (${decisionModel}) para classificadores Attention e roteamento OrgFy.`,
    order: 5,
    status: () => (fastGroup?.defaultKey ? "ready" : "needs-setup") as "ready" | "needs-setup",
    subscribe: () => () => {},
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
        const res = await host.request({
          url: "https://api.nexusmind.digital/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${grp.defaultKey}`,
            "Content-Type": "application/json",
            "User-Agent": "BuzzDesktop/NexusMindDecisions",
          },
          body: JSON.stringify({
            model: mdl,
            temperature: 0,
            max_tokens: 600,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "Retorne estritamente JSON válido seguindo o schema solicitado." },
              { role: "user", content: prompt },
            ],
          }),
          timeoutMs: Math.min(25000, Math.max(2000, Number(request.timeoutMs || 10000))),
        });

        if (!res || res.status < 200 || res.status >= 300 || !res.body) {
          return null;
        }
        const outer = JSON.parse(res.body);
        const rawText = String(outer?.choices?.[0]?.message?.content || "").trim();
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
            const conf = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.8)));
            answers[k] = {
              type: "choice",
              choice: ch,
              confidence: Number.isFinite(conf) ? conf : 0.8,
              probabilities: raw.probabilities && typeof raw.probabilities === "object" ? raw.probabilities : { [ch]: conf },
            };
          } else if (q.type === "score") {
            const maxIdx = Math.max(1, (q.levels?.length || 2) - 1);
            const sc = Math.max(0, Math.min(maxIdx, Number(raw.score ?? 0)));
            const conf = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.8)));
            answers[k] = {
              type: "score",
              score: Number.isFinite(sc) ? sc : 0,
              confidence: Number.isFinite(conf) ? conf : 0.8,
              probabilities: raw.probabilities && typeof raw.probabilities === "object" ? raw.probabilities : {},
            };
          }
        }
        return { outcome: "answered" as const, model: mdl, answers };
      };

      try {
        const primary = await tryCall(fastGroup, decisionModel);
        if (primary) return primary;
        if (fallbackGroup && fallbackGroup.defaultModel !== decisionModel) {
          const secondary = await tryCall(fallbackGroup, fallbackGroup.defaultModel);
          if (secondary) return secondary;
        }
        return { outcome: "failed" as const, reason: "service_error" as const };
      } catch {
        return { outcome: "failed" as const, reason: "invalid_response" as const };
      }
    },
  };
}
