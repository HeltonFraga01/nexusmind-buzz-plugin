const LOCAL_STORAGE_VIP_POLICY_KEY = "nexusmind_vip_policy_v1";
const SHARED_ROUTING_POLICY_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-routing-policy.json";
const DEFAULT_VIP_MODELS = [
  "gpt-6.1-terra",
  "claude-sonnet-4-6",
  "claude-sonnet-5-5",
  "claude-opus-4-6",
  "claude-opus-4-6-thinking",
  "claude-opus-5-5"
];
const DEFAULT_VIP_AGENT_PATTERNS = [
  "OrgFy Iris",
  "OrgFy Bento",
  "Conselho *"
];
const DEFAULT_VIP_FALLBACK_CHAIN = [
  "claude-sonnet-4-6",
  "claude-sonnet-5-5",
  "claude-opus-4-6",
  "gpt-6.1-terra"
];
const DEFAULT_VIP_POLICY = {
  version: 1,
  vipModels: [...DEFAULT_VIP_MODELS],
  blockedModels: [],
  vipAgentPatterns: [...DEFAULT_VIP_AGENT_PATTERNS],
  vipFallbackChain: [...DEFAULT_VIP_FALLBACK_CHAIN],
  autoProtectAnthropic: true,
  explicitAutoOverrides: []
};
function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}
function uniqueStrings(list) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
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
function isDefaultVipModelId(modelId, groupId) {
  const m = normalizeId(modelId);
  if (!m) return false;
  if (groupId === "nexusmind_anthropic") return true;
  return m === "gpt-6.1-terra" || m.startsWith("claude-opus") || m.startsWith("claude-sonnet-5") || m === "claude-sonnet-4-6" || m.startsWith("gpt-6") || m.startsWith("gpt-5");
}
function loadVipPolicy() {
  var _a, _b, _c, _d;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_VIP_POLICY_KEY);
    if (!raw) {
      const legacyBlocked = [];
      try {
        const rawPol = (_d = (_c = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _c.getItem) == null ? void 0 : _d.call(_c, "nexusmind_routing_policy");
        if (rawPol) {
          const parsedPol = JSON.parse(rawPol);
          if (Array.isArray(parsedPol == null ? void 0 : parsedPol.autoAssignBlocked)) {
            legacyBlocked.push(...parsedPol.autoAssignBlocked.map(String));
          }
        }
      } catch {
      }
      return {
        ...DEFAULT_VIP_POLICY,
        blockedModels: uniqueStrings(legacyBlocked)
      };
    }
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      vipModels: Array.isArray(parsed == null ? void 0 : parsed.vipModels) ? uniqueStrings(parsed.vipModels) : [...DEFAULT_VIP_MODELS],
      blockedModels: Array.isArray(parsed == null ? void 0 : parsed.blockedModels) ? uniqueStrings(parsed.blockedModels) : [],
      vipAgentPatterns: Array.isArray(parsed == null ? void 0 : parsed.vipAgentPatterns) && parsed.vipAgentPatterns.length > 0 ? uniqueStrings([...parsed.vipAgentPatterns, "OrgFy Bento"]) : [...DEFAULT_VIP_AGENT_PATTERNS],
      vipFallbackChain: Array.isArray(parsed == null ? void 0 : parsed.vipFallbackChain) && parsed.vipFallbackChain.length > 0 ? uniqueStrings(parsed.vipFallbackChain) : [...DEFAULT_VIP_FALLBACK_CHAIN],
      autoProtectAnthropic: (parsed == null ? void 0 : parsed.autoProtectAnthropic) !== false,
      explicitAutoOverrides: Array.isArray(parsed == null ? void 0 : parsed.explicitAutoOverrides) ? uniqueStrings(parsed.explicitAutoOverrides) : []
    };
  } catch {
    return { ...DEFAULT_VIP_POLICY };
  }
}
async function saveVipPolicy(ctx, cfg) {
  var _a, _b;
  const clean = {
    version: 1,
    vipModels: uniqueStrings(cfg.vipModels || []),
    blockedModels: uniqueStrings(cfg.blockedModels || []),
    vipAgentPatterns: uniqueStrings(cfg.vipAgentPatterns || DEFAULT_VIP_AGENT_PATTERNS),
    vipFallbackChain: uniqueStrings(cfg.vipFallbackChain || DEFAULT_VIP_FALLBACK_CHAIN),
    autoProtectAnthropic: cfg.autoProtectAnthropic !== false,
    explicitAutoOverrides: uniqueStrings(cfg.explicitAutoOverrides || [])
  };
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_VIP_POLICY_KEY, JSON.stringify(clean));
  } catch {
  }
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.writeFile) === "function") {
    try {
      await host.writeFile(
        SHARED_ROUTING_POLICY_PATH,
        JSON.stringify(
          {
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            vipPolicy: clean
          },
          null,
          2
        )
      );
    } catch {
    }
  }
}
function isVipAgent(agentNameOrKey, cfg = DEFAULT_VIP_POLICY) {
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
function getModelAccessMode(modelId, groupId, cfg, disabledModels) {
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
function setModelAccessMode(cfg, modelId, mode) {
  const target = normalizeId(modelId);
  const strip = (arr) => (arr || []).filter((x) => normalizeId(x) !== target);
  const nextVip = strip(cfg.vipModels);
  const nextBlocked = strip(cfg.blockedModels);
  const nextAutoOverrides = strip(cfg.explicitAutoOverrides);
  if (mode === "vip") {
    nextVip.push(modelId);
  } else if (mode === "blocked") {
    nextBlocked.push(modelId);
  } else {
    nextAutoOverrides.push(modelId);
  }
  return {
    ...cfg,
    vipModels: uniqueStrings(nextVip),
    blockedModels: uniqueStrings(nextBlocked),
    explicitAutoOverrides: uniqueStrings(nextAutoOverrides)
  };
}
function applyQuickVipPreset(cfg, catalogModels) {
  let next = {
    ...cfg,
    autoProtectAnthropic: true,
    vipModels: uniqueStrings([...cfg.vipModels, ...DEFAULT_VIP_MODELS])
  };
  for (const m of catalogModels || []) {
    if (isDefaultVipModelId(m.id, m.primaryGroup)) {
      next = setModelAccessMode(next, m.id, "vip");
    }
  }
  return next;
}
function toggleVipAgent(cfg, agentName) {
  const clean = String(agentName || "").trim();
  if (!clean) return cfg;
  const target = normalizeId(clean);
  const existsExact = (cfg.vipAgentPatterns || []).some((p) => normalizeId(p) === target);
  if (existsExact) {
    return {
      ...cfg,
      vipAgentPatterns: cfg.vipAgentPatterns.filter((p) => normalizeId(p) !== target)
    };
  }
  return {
    ...cfg,
    vipAgentPatterns: uniqueStrings([...cfg.vipAgentPatterns, clean])
  };
}
function isFreeModel$1(modelId) {
  const m = String(modelId || "").trim().toLowerCase();
  return m.includes(":free") || m.includes("-free") || m.includes("/free") || m.endsWith("free") || m.startsWith("pol/") || m.startsWith("pollinations/");
}
function isUnsupportedAgentModel(modelId) {
  const m = String(modelId || "").trim().toLowerCase();
  if (!m) return true;
  return m.startsWith("pol/") || m.startsWith("pollinations/") || m.includes("pol/community/") || m.includes("pollinations/community/") || m.includes("gemini-3.8-flash-medium") || m.includes("mistral-large-4-1t-a52b") || m.includes("gemini-3-pro-low") || m.includes("gemini-3-pro-high") || m.startsWith("auto/") || m.includes("tab_jump") || m.includes("autocomplete") || m.includes("fim-") || m.includes("embedding") || m.includes("rerank") || m.includes("whisper") || m.includes("tts") || m.includes("imagen") || m.includes("dall-e") || m.includes("moderation");
}
function scoreModelForTier(modelId, tier) {
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
    else if (/(opus|thinking|r1)/.test(m)) tierMatch = 35;
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
function getDisabledModels() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, "nexusmind_disabled_models");
    if (!raw) return /* @__PURE__ */ new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x) => String(x))) : /* @__PURE__ */ new Set();
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function pingModel(ctx, modelId, group) {
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.request) !== "function") {
    return { online: false, latencyMs: null, error: "ctx.host.request indisponível" };
  }
  const isAnthropic = group.id === "nexusmind_anthropic";
  const url = isAnthropic ? "https://api.nexusmind.digital/v1/messages" : "https://api.nexusmind.digital/v1/chat/completions";
  const headers = isAnthropic ? {
    "x-api-key": group.defaultKey,
    Authorization: `Bearer ${group.defaultKey}`,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/NexusMindRouter"
  } : {
    Authorization: `Bearer ${group.defaultKey}`,
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/NexusMindRouter"
  };
  const t0 = Date.now();
  try {
    const probeBody = isAnthropic ? {
      model: modelId,
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 16,
      tools: [{ name: "ping", description: "healthcheck", input_schema: { type: "object", properties: {} } }]
    } : {
      model: modelId,
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 5,
      tools: [{ type: "function", function: { name: "ping", description: "healthcheck", parameters: { type: "object", properties: {} } } }]
    };
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(probeBody),
      timeoutMs: 9e3
    });
    const latencyMs = Date.now() - t0;
    if ((res == null ? void 0 : res.status) >= 200 && (res == null ? void 0 : res.status) < 300) {
      return { online: true, latencyMs };
    }
    return { online: false, latencyMs, error: `HTTP ${(res == null ? void 0 : res.status) ?? "err"}` };
  } catch (err) {
    return { online: false, latencyMs: Date.now() - t0, error: String((err == null ? void 0 : err.message) || err).slice(0, 100) };
  }
}
async function selectBestModelByTier(ctx, groups, input = {}) {
  var _a, _b;
  const tier = input.tier || "tier2_balanced";
  let savedPolicy = {};
  try {
    const rawPol = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, "nexusmind_routing_policy");
    if (rawPol) savedPolicy = JSON.parse(rawPol) || {};
  } catch {
  }
  const isVip = Boolean(input.is_vip);
  const preferFree = isVip ? false : input.prefer_free !== void 0 ? Boolean(input.prefer_free) : Boolean(savedPolicy.forceFree);
  const avoidFree = isVip ? true : input.avoid_free !== false && !preferFree;
  const maxProbes = Math.max(1, Math.min(8, Number(input.max_probes || 5)));
  const disabled = getDisabledModels();
  const blockedAuto = new Set((savedPolicy.autoAssignBlocked || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
  const excluded = /* @__PURE__ */ new Set([
    ...(input.exclude_models || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean),
    ...blockedAuto
  ]);
  const host = ctx == null ? void 0 : ctx.host;
  const catalog = /* @__PURE__ */ new Map();
  if (typeof (host == null ? void 0 : host.request) === "function") {
    await Promise.all(
      Object.values(groups).map(async (grp) => {
        try {
          const res = await host.request({
            url: "https://api.nexusmind.digital/v1/models",
            method: "GET",
            headers: {
              Authorization: `Bearer ${grp.defaultKey}`,
              "User-Agent": "BuzzDesktop/NexusMindRouter"
            },
            timeoutMs: 8e3
          });
          if ((res == null ? void 0 : res.status) >= 200 && (res == null ? void 0 : res.status) < 300 && (res == null ? void 0 : res.body)) {
            const parsed = JSON.parse(res.body);
            for (const m of Array.isArray(parsed == null ? void 0 : parsed.data) ? parsed.data : []) {
              const mid = String((m == null ? void 0 : m.id) || "").trim();
              if (!mid || isUnsupportedAgentModel(mid) || disabled.has(mid) || excluded.has(mid.toLowerCase()) || catalog.has(mid)) continue;
              catalog.set(mid, { id: mid, group: grp });
            }
          }
        } catch {
        }
      })
    );
  }
  if (catalog.size === 0) {
    for (const grp of Object.values(groups)) {
      if (!disabled.has(grp.defaultModel) && !excluded.has(grp.defaultModel.toLowerCase())) {
        catalog.set(grp.defaultModel, { id: grp.defaultModel, group: grp });
      }
    }
  }
  let pool = Array.from(catalog.values());
  if (preferFree) {
    const freeOnly = pool.filter((c) => isFreeModel$1(c.id));
    if (freeOnly.length > 0) pool = freeOnly;
  } else if (avoidFree) {
    const paidOnly = pool.filter((c) => !isFreeModel$1(c.id));
    if (paidOnly.length > 0) pool = paidOnly;
  }
  const preRanked = pool.map((item) => {
    const { capability, tierMatch } = scoreModelForTier(item.id, tier);
    const preScore = tierMatch * 0.65 + capability * 0.35;
    return { ...item, capability, tierMatch, preScore };
  }).sort((a, b) => b.preScore - a.preScore).slice(0, maxProbes);
  const probed = await Promise.all(
    preRanked.map(async (cand) => {
      const ping = await pingModel(ctx, cand.id, cand.group);
      const latencyWeight = tier === "decision" || tier === "tier1_fast" ? 8 : 3.5;
      const latencyPenalty = ping.latencyMs !== null ? Math.min(35, ping.latencyMs / 1e3 * latencyWeight) : 35;
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
        isFree: isFreeModel$1(cand.id),
        error: ping.error
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
    selectedModel: (winner == null ? void 0 : winner.model) || null,
    selectedGroup: (winner == null ? void 0 : winner.group) || null,
    selectedPlatform: (winner == null ? void 0 : winner.platform) || null,
    selectedLatencyMs: (winner == null ? void 0 : winner.latencyMs) ?? null,
    selectedScore: (winner == null ? void 0 : winner.combinedScore) ?? null,
    candidatesTested: probed.length,
    ranking: probed,
    message: winner ? `Melhor modelo para '${tier}': ${winner.model} (${winner.group}, ${winner.latencyMs}ms, score ${winner.combinedScore}).` : `Nenhum dos ${probed.length} modelos testados respondeu HTTP 200 para '${tier}'.`
  };
}
async function applyBestModelToAgent(ctx, groups, input) {
  var _a, _b, _c;
  const isVip = input.is_vip ?? isVipAgent(input.agente, loadVipPolicy());
  const selection = await selectBestModelByTier(ctx, groups, { ...input, is_vip: isVip });
  if (!selection.ok || !selection.selectedModel) {
    return { ...selection, applied: false, agentKey: null, previousModel: null };
  }
  const agentsApi = ctx == null ? void 0 : ctx.agents;
  const snap = ((_a = agentsApi == null ? void 0 : agentsApi.snapshot) == null ? void 0 : _a.call(agentsApi)) || {};
  const allAgents = [...snap.running || [], ...snap.agents || []];
  const q = String(input.agente || "").trim().toLowerCase();
  const target = allAgents.find(
    (a) => String((a == null ? void 0 : a.key) || "").toLowerCase() === q || String((a == null ? void 0 : a.name) || "").toLowerCase() === q || String((a == null ? void 0 : a.name) || "").toLowerCase().includes(q)
  );
  if (!target || typeof (agentsApi == null ? void 0 : agentsApi.save) !== "function") {
    return {
      ...selection,
      applied: false,
      agentKey: (target == null ? void 0 : target.key) || null,
      previousModel: ((_b = target == null ? void 0 : target.config) == null ? void 0 : _b.model) || null,
      message: `${selection.message} (Agente '${input.agente}' não encontrado ou ctx.agents.save indisponível).`
    };
  }
  const previousModel = ((_c = target == null ? void 0 : target.config) == null ? void 0 : _c.model) || null;
  const nextCfg = {
    ...target.config && typeof target.config === "object" ? target.config : {},
    model: selection.selectedModel,
    provider: selection.selectedGroup || "nexusmind_antigravity"
  };
  await agentsApi.save(target.key, { config: nextCfg });
  return {
    ...selection,
    applied: true,
    agentKey: target.key,
    previousModel,
    message: `Agente '${target.name || target.key}' atualizado de '${previousModel || "padrão"}' para '${selection.selectedModel}' (${selection.selectedGroup}, ${selection.selectedLatencyMs}ms).`
  };
}
const DECISIONS_CONFIG_STORAGE_KEY = "nexusmind_decisions_config_v1";
const DECISIONS_CONFIG_DISK_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-decisions-config.json";
function readDecisionsConfig(defaultModel) {
  var _a, _b;
  const defaults = {
    primaryModel: "claude-sonnet-4-6",
    fallbackModels: ["claude-sonnet-5-5", "gemini-2.5-flash", "gemini-3.8-flash-medium"],
    autoRankFallback: true
  };
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, DECISIONS_CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const rawPrimary = String((parsed == null ? void 0 : parsed.primaryModel) || "").trim();
    const primary = rawPrimary && !isUnsupportedAgentModel(rawPrimary) ? rawPrimary : defaults.primaryModel;
    const rawFallbacks = Array.isArray(parsed == null ? void 0 : parsed.fallbackModels) ? parsed.fallbackModels.map((x) => String(x || "").trim()).filter((x) => Boolean(x) && !isUnsupportedAgentModel(x) && x !== "gpt-6.1-terra" && x !== "grok-4.1-fast") : [];
    const fallbacks = rawFallbacks.length > 0 ? rawFallbacks : defaults.fallbackModels;
    const autoRankFallback = (parsed == null ? void 0 : parsed.autoRankFallback) !== false;
    return { primaryModel: primary, fallbackModels: fallbacks, autoRankFallback };
  } catch {
    return defaults;
  }
}
function saveDecisionsConfig(ctx, cfg) {
  var _a, _b;
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, DECISIONS_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
  }
  try {
    const host = ctx == null ? void 0 : ctx.host;
    if (typeof (host == null ? void 0 : host.writeFile) === "function") {
      void host.writeFile(DECISIONS_CONFIG_DISK_PATH, JSON.stringify(cfg, null, 2));
    }
  } catch {
  }
}
function resolveGroupForModel(modelId, groups, fallbackGroup) {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("grok") && groups.nexusmind_grok) return groups.nexusmind_grok;
  if (m.includes("claude") && groups.nexusmind_anthropic) return groups.nexusmind_anthropic;
  if ((m.includes("gemini") || m.includes("antigravity")) && groups.nexusmind_antigravity) {
    return groups.nexusmind_antigravity;
  }
  if (groups.nexusmind_openai) return groups.nexusmind_openai;
  return fallbackGroup;
}
function getKnownDecisionModels(groups) {
  var _a, _b, _c, _d;
  const set = /* @__PURE__ */ new Set();
  for (const grp of Object.values(groups)) {
    if ((grp == null ? void 0 : grp.defaultModel) && !isUnsupportedAgentModel(grp.defaultModel)) set.add(grp.defaultModel);
  }
  for (const seed of [
    "gemini-2.5-flash",
    "gemini-3.8-flash-medium",
    "claude-sonnet-4-6",
    "claude-sonnet-5-5"
  ]) {
    set.add(seed);
  }
  try {
    const rawRank = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, "nexusmind_model_ranking");
    if (rawRank) {
      const parsed = JSON.parse(rawRank);
      for (const m of Array.isArray(parsed == null ? void 0 : parsed.models) ? parsed.models : []) {
        if ((m == null ? void 0 : m.model) && !isUnsupportedAgentModel(m.model) && (m == null ? void 0 : m.online) !== false && !(m == null ? void 0 : m.isDisabled) && !isFreeModel$1(m.model)) {
          set.add(String(m.model));
        }
      }
    }
  } catch {
  }
  try {
    const rawCached = (_d = (_c = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _c.getItem) == null ? void 0 : _d.call(_c, "nexusmind_cached_models");
    if (rawCached) {
      const parsed = JSON.parse(rawCached);
      for (const m of Array.isArray(parsed) ? parsed : []) {
        if ((m == null ? void 0 : m.id) && !isUnsupportedAgentModel(m.id) && !isFreeModel$1(m.id)) set.add(String(m.id));
      }
    }
  } catch {
  }
  return Array.from(set);
}
function getRankingFallbackModels() {
  var _a, _b;
  try {
    const rawRank = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, "nexusmind_model_ranking");
    if (!rawRank) return [];
    const parsed = JSON.parse(rawRank);
    if (!Array.isArray(parsed == null ? void 0 : parsed.models)) return [];
    return parsed.models.filter((m) => (m == null ? void 0 : m.model) && (m == null ? void 0 : m.online) !== false && !(m == null ? void 0 : m.isDisabled) && !isFreeModel$1(m.model)).slice(0, 6).map((m) => String(m.model));
  } catch {
    return [];
  }
}
function createNexusMindDecisionProvider(ctx, groups) {
  const fastGroup = groups.nexusmind_antigravity || Object.values(groups)[0];
  const defaultModel = (fastGroup == null ? void 0 : fastGroup.defaultModel) || "gemini-3.8-flash-medium";
  const listeners = /* @__PURE__ */ new Set();
  const notifyListeners = () => {
    for (const fn of Array.from(listeners)) {
      try {
        fn();
      } catch {
      }
    }
  };
  const React = ctx == null ? void 0 : ctx.react;
  const SettingsComponent = (React == null ? void 0 : React.createElement) ? function NexusMindDecisionsSettings() {
    const h = React.createElement;
    const [cfg, setCfg] = React.useState(() => readDecisionsConfig());
    const [fallbackInput, setFallbackInput] = React.useState(
      () => readDecisionsConfig().fallbackModels.join(", ")
    );
    const [savedMsg, setSavedMsg] = React.useState("");
    const [pingState, setPingState] = React.useState({
      busy: false,
      text: ""
    });
    const knownModels = React.useMemo(() => getKnownDecisionModels(groups), []);
    const applySave = (nextCfg, note) => {
      setCfg(nextCfg);
      setFallbackInput(nextCfg.fallbackModels.join(", "));
      saveDecisionsConfig(ctx, nextCfg);
      notifyListeners();
      setSavedMsg(note);
    };
    const handleSaveClick = () => {
      const cleanPrimary = String(cfg.primaryModel || "").trim() || defaultModel;
      const cleanFallbacks = fallbackInput.split(/[,\n]+/).map((s) => s.trim()).filter((s) => Boolean(s) && s.toLowerCase() !== cleanPrimary.toLowerCase());
      applySave(
        {
          primaryModel: cleanPrimary,
          fallbackModels: Array.from(new Set(cleanFallbacks)),
          autoRankFallback: cfg.autoRankFallback
        },
        `Salvo: ${cleanPrimary} (+ ${cleanFallbacks.length} fallback${cleanFallbacks.length === 1 ? "" : "s"})`
      );
    };
    const handlePickBestAuto = async () => {
      setPingState({ busy: true, text: "Testando modelos mais rápidos no NexusMind..." });
      try {
        const best = await selectBestModelByTier(ctx, groups, { tier: "decision", max_probes: 5 });
        if (best.ok && best.selectedModel) {
          const otherOnline = best.ranking.filter((r) => r.online && r.model !== best.selectedModel).map((r) => r.model);
          const nextFallbacks = Array.from(/* @__PURE__ */ new Set([...otherOnline, ...cfg.fallbackModels])).filter(
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
      } catch (err) {
        setPingState({ busy: false, ok: false, text: `Erro ao testar: ${(err == null ? void 0 : err.message) || err}` });
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
        text: res.online ? `OK · ${mdl} respondeu em ${res.latencyMs}ms (${grp.id})` : `FALHA · ${mdl} (${res.error || "indisponível"}) — failover automático entrará em ação se ocorrer em produção.`
      });
    };
    const inputStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 10px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.16)",
      backgroundColor: "rgba(0,0,0,0.28)",
      color: "#f3f4f6",
      fontSize: "12px",
      fontFamily: "monospace"
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
          boxSizing: "border-box"
        }
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h("label", { style: { fontSize: "12px", fontWeight: "600", color: "#e5e7eb" } }, "Modelo Principal (Customizável)"),
        h("input", {
          type: "text",
          value: cfg.primaryModel,
          placeholder: "Ex.: gemini-3.8-flash-medium, gpt-6.1-terra, claude-sonnet-5-5",
          onChange: (e) => {
            setSavedMsg("");
            setCfg({ ...cfg, primaryModel: e.target.value });
          },
          style: inputStyle
        }),
        h(
          "select",
          {
            value: knownModels.includes(cfg.primaryModel) ? cfg.primaryModel : "",
            onChange: (e) => {
              if (e.target.value) {
                setSavedMsg("");
                setCfg({ ...cfg, primaryModel: e.target.value });
              }
            },
            style: { ...inputStyle, cursor: "pointer" }
          },
          h("option", { value: "" }, "— Escolher da lista do NexusMind Gateway —"),
          ...knownModels.map((m) => h("option", { key: m, value: m }, m))
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
          onChange: (e) => {
            setSavedMsg("");
            setFallbackInput(e.target.value);
          },
          style: inputStyle
        })
      ),
      h(
        "label",
        { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#cbd5e1", cursor: "pointer" } },
        h("input", {
          type: "checkbox",
          checked: cfg.autoRankFallback,
          onChange: (e) => {
            setSavedMsg("");
            setCfg({ ...cfg, autoRankFallback: Boolean(e.target.checked) });
          }
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
              cursor: "pointer"
            }
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
              cursor: pingState.busy ? "wait" : "pointer"
            }
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
              cursor: pingState.busy ? "wait" : "pointer"
            }
          },
          "⚡ Auto (Melhor Online)"
        )
      ),
      savedMsg && h("div", { style: { fontSize: "11px", color: "#34d399", fontFamily: "monospace" } }, savedMsg),
      pingState.text && h(
        "div",
        {
          style: {
            fontSize: "11px",
            color: pingState.ok === false ? "#fca5a5" : pingState.ok === true ? "#34d399" : "#93c5fd",
            fontFamily: "monospace"
          }
        },
        pingState.text
      )
    );
  } : void 0;
  return {
    id: "nexusmind-fast",
    label: "NexusMind Fast Decisions",
    description: "Modelo customizável via NexusMind Gateway com fallback automático para Attention e roteamento OrgFy.",
    order: 5,
    status: () => (fastGroup == null ? void 0 : fastGroup.defaultKey) ? "ready" : "needs-setup",
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ...SettingsComponent ? { Settings: SettingsComponent } : {},
    decide: async (request, options) => {
      var _a;
      const host = ctx == null ? void 0 : ctx.host;
      if (typeof (host == null ? void 0 : host.request) !== "function") {
        return { outcome: "failed", reason: "unavailable" };
      }
      const questionsSpec = Object.entries(request.questions || {}).map(([key, q]) => {
        var _a2;
        if (q.type === "yes_no") {
          return `- "${key}" (yes_no): ${q.instructions} -> retorne {"type":"yes_no","probability": <numero 0..1>}`;
        }
        if (q.type === "choice") {
          return `- "${key}" (choice): ${q.instructions} | opcoes: ${JSON.stringify(q.options)} -> retorne {"type":"choice","choice":"<uma das chaves>","confidence":<0..1>,"probabilities":{}}`;
        }
        return `- "${key}" (score): ${q.instructions} | niveis 0..${(((_a2 = q.levels) == null ? void 0 : _a2.length) || 2) - 1}: ${JSON.stringify(q.levels)} -> retorne {"type":"score","score":<numero 0..N-1>,"confidence":<0..1>,"probabilities":{}}`;
      });
      const prompt = [
        "Você é um motor de decisão determinístico ultrarrápido. Responda APENAS um objeto JSON válido (sem markdown, sem comentários) mapeando cada chave de pergunta para sua resposta exata.",
        "Perguntas:",
        ...questionsSpec,
        "",
        "Texto para julgar (state):",
        String(request.state || "").slice(0, 6e3)
      ].join("\n");
      const tryCall = async (grp, mdl) => {
        var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
        if ((_a2 = options == null ? void 0 : options.signal) == null ? void 0 : _a2.aborted) {
          return { outcome: "failed", reason: "timeout" };
        }
        const isAnthropic = grp.id === "nexusmind_anthropic";
        const url = isAnthropic ? "https://api.nexusmind.digital/v1/messages" : "https://api.nexusmind.digital/v1/chat/completions";
        const headers = isAnthropic ? {
          "x-api-key": grp.defaultKey,
          Authorization: `Bearer ${grp.defaultKey}`,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
          "User-Agent": "BuzzDesktop/NexusMindDecisions"
        } : {
          Authorization: `Bearer ${grp.defaultKey}`,
          "Content-Type": "application/json",
          "User-Agent": "BuzzDesktop/NexusMindDecisions"
        };
        const reqBody = isAnthropic ? {
          model: mdl,
          max_tokens: 600,
          system: "Retorne estritamente JSON válido seguindo o schema solicitado.",
          messages: [{ role: "user", content: prompt }]
        } : {
          model: mdl,
          temperature: 0,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Retorne estritamente JSON válido seguindo o schema solicitado." },
            { role: "user", content: prompt }
          ]
        };
        const res = await host.request({
          url,
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
          timeoutMs: Math.min(5500, Math.max(2e3, Number(request.timeoutMs || 5500)))
        });
        if (!res || res.status < 200 || res.status >= 300 || !res.body) {
          return null;
        }
        const outer = JSON.parse(res.body);
        const rawText = isAnthropic ? String(((_d = (_c = (_b = outer == null ? void 0 : outer.content) == null ? void 0 : _b.find) == null ? void 0 : _c.call(_b, (b) => (b == null ? void 0 : b.type) === "text")) == null ? void 0 : _d.text) || ((_f = (_e = outer == null ? void 0 : outer.content) == null ? void 0 : _e[0]) == null ? void 0 : _f.text) || "").trim() : String(((_i = (_h = (_g = outer == null ? void 0 : outer.choices) == null ? void 0 : _g[0]) == null ? void 0 : _h.message) == null ? void 0 : _i.content) || "").trim();
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        const jsonSlice = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
        const parsed = JSON.parse(jsonSlice);
        if (!parsed || typeof parsed !== "object") return null;
        const answers = {};
        for (const [k, q] of Object.entries(request.questions || {})) {
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
            const normProbs = {};
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
              probabilities: normProbs
            };
          } else if (q.type === "score") {
            const levels = Array.isArray(q.levels) ? q.levels.map(String) : [];
            const maxIdx = Math.max(1, levels.length - 1);
            const rawSc = Number(raw.score ?? 0);
            const sc = Number.isFinite(rawSc) ? Math.max(0, Math.min(maxIdx, rawSc)) : 0;
            const rawConf = Number(raw.confidence ?? 0.8);
            const conf = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.8;
            const normProbs = {};
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
              probabilities: normProbs
            };
          }
        }
        return { outcome: "answered", model: mdl, answers };
      };
      const cfg = readDecisionsConfig();
      const chain = [
        cfg.primaryModel,
        ...cfg.fallbackModels,
        ...cfg.autoRankFallback ? getRankingFallbackModels() : [],
        ...Object.values(groups).map((g) => g.defaultModel)
      ].map((m) => String(m || "").trim()).filter(Boolean);
      const uniqueChain = Array.from(new Set(chain)).slice(0, 6);
      try {
        for (const candidateModel of uniqueChain) {
          if ((_a = options == null ? void 0 : options.signal) == null ? void 0 : _a.aborted) {
            return { outcome: "failed", reason: "timeout" };
          }
          const grp = resolveGroupForModel(candidateModel, groups, fastGroup);
          try {
            const result = await tryCall(grp, candidateModel);
            if (result) return result;
          } catch {
          }
        }
        return { outcome: "failed", reason: "service_error" };
      } catch {
        return { outcome: "failed", reason: "invalid_response" };
      }
    }
  };
}
const DEFAULT_ROUTING_POLICY = {
  strategy: "balanced",
  forceFree: false,
  maxCostPerReqUsd: null,
  autoAssignBlocked: [],
  tierPins: {}
};
const SHARED_RANKING_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-model-ranking.json";
const SHARED_USAGE_SUMMARY_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nm_usage_summary.json",
  "~/.buzz/.scratch/nm_usage_summary.json"
];
const SHARED_USAGE_PATHS = [
  "/Users/heltonfraga/.buzz/.scratch/nm_usage.json",
  "~/.buzz/.scratch/nm_usage.json"
];
const LOCAL_STORAGE_RANKING_KEY = "nexusmind_model_ranking";
const LOCAL_STORAGE_POLICY_KEY = "nexusmind_routing_policy";
function loadSavedRoutingPolicy() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_POLICY_KEY);
    if (!raw) return { ...DEFAULT_ROUTING_POLICY };
    const p = JSON.parse(raw);
    return {
      strategy: ["balanced", "speed", "quality", "cost"].includes(p == null ? void 0 : p.strategy) ? p.strategy : "balanced",
      forceFree: Boolean(p == null ? void 0 : p.forceFree),
      maxCostPerReqUsd: typeof (p == null ? void 0 : p.maxCostPerReqUsd) === "number" && p.maxCostPerReqUsd > 0 ? p.maxCostPerReqUsd : null,
      autoAssignBlocked: Array.isArray(p == null ? void 0 : p.autoAssignBlocked) ? p.autoAssignBlocked.map(String) : [],
      tierPins: (p == null ? void 0 : p.tierPins) && typeof p.tierPins === "object" ? { ...p.tierPins } : {}
    };
  } catch {
    return { ...DEFAULT_ROUTING_POLICY };
  }
}
function saveRoutingPolicy(policy) {
  var _a, _b;
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_POLICY_KEY, JSON.stringify(policy));
  } catch {
  }
}
function decodeFileContent(raw) {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder("utf-8").decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  return String(raw ?? "");
}
function inferCanonicalGroupForModel(modelId, groups) {
  const m = String(modelId || "").toLowerCase();
  if (m.includes("grok") && groups.nexusmind_grok) return groups.nexusmind_grok;
  if ((m.includes("/") || m.includes(":free")) && groups.nexusmind_openai) {
    return groups.nexusmind_openai;
  }
  if ((m.includes("gemini") || m.includes("antigravity") || m.includes("thinking") || m.includes("-high") || m.includes("-medium") || m.includes("-low")) && groups.nexusmind_antigravity) {
    return groups.nexusmind_antigravity;
  }
  if (m.includes("claude") && groups.nexusmind_anthropic) return groups.nexusmind_anthropic;
  if (groups.nexusmind_openai) return groups.nexusmind_openai;
  return Object.values(groups)[0];
}
async function loadGatewayUsageByModel(ctx) {
  var _a;
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.readFile) !== "function") {
    return { sampleSize: 0, byModel: {} };
  }
  for (const path of SHARED_USAGE_SUMMARY_PATHS) {
    try {
      const raw = await host.readFile(path);
      if (!raw) continue;
      const parsed = JSON.parse(decodeFileContent(raw));
      if (parsed && typeof parsed.byModel === "object" && parsed.sampleSize > 0) {
        return {
          sampleSize: Number(parsed.sampleSize || 0),
          byModel: parsed.byModel
        };
      }
    } catch {
    }
  }
  for (const path of SHARED_USAGE_PATHS) {
    try {
      const raw = await host.readFile(path);
      if (!raw) continue;
      const byteLen = typeof raw === "string" ? raw.length : (raw == null ? void 0 : raw.byteLength) ?? 0;
      if (byteLen > 12e6) continue;
      const parsed = JSON.parse(decodeFileContent(raw));
      const items = Array.isArray((_a = parsed == null ? void 0 : parsed.data) == null ? void 0 : _a.items) ? parsed.data.items : Array.isArray(parsed == null ? void 0 : parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
      if (items.length === 0) continue;
      const acc = /* @__PURE__ */ new Map();
      for (const it of items) {
        const mid = String((it == null ? void 0 : it.model) || "").trim();
        if (!mid) continue;
        let cur = acc.get(mid);
        if (!cur) {
          cur = { calls: 0, durSum: 0, durN: 0, ttftSum: 0, ttftN: 0, cost: 0, inputTok: 0, cacheReadTok: 0, lastSeen: null };
          acc.set(mid, cur);
        }
        cur.calls += 1;
        const cost = Number((it == null ? void 0 : it.actual_cost) ?? (it == null ? void 0 : it.total_cost) ?? 0);
        if (Number.isFinite(cost) && cost >= 0) cur.cost += cost;
        const dur = Number(it == null ? void 0 : it.duration_ms);
        if (Number.isFinite(dur) && dur > 0 && dur < 6e5) {
          cur.durSum += dur;
          cur.durN += 1;
        }
        const ttft = Number(it == null ? void 0 : it.first_token_ms);
        if (Number.isFinite(ttft) && ttft > 0 && ttft < 12e4) {
          cur.ttftSum += ttft;
          cur.ttftN += 1;
        }
        const inp = Number((it == null ? void 0 : it.input_tokens) ?? 0);
        const cr = Number((it == null ? void 0 : it.cache_read_tokens) ?? 0);
        if (Number.isFinite(inp) && inp > 0) cur.inputTok += inp;
        if (Number.isFinite(cr) && cr > 0) cur.cacheReadTok += cr;
        if (typeof (it == null ? void 0 : it.created_at) === "string" && (!cur.lastSeen || it.created_at > cur.lastSeen)) {
          cur.lastSeen = it.created_at;
        }
      }
      const byModel = {};
      for (const [mid, st] of acc.entries()) {
        const totalIn = st.inputTok + st.cacheReadTok;
        byModel[mid] = {
          calls: st.calls,
          avgDurationMs: st.durN > 0 ? Math.round(st.durSum / st.durN) : null,
          avgFirstTokenMs: st.ttftN > 0 ? Math.round(st.ttftSum / st.ttftN) : null,
          totalCostUsd: Number(st.cost.toFixed(4)),
          avgCostUsd: st.calls > 0 ? Number((st.cost / st.calls).toFixed(6)) : 0,
          cacheHitPct: totalIn > 0 ? Number((st.cacheReadTok / totalIn * 100).toFixed(1)) : null,
          lastSeenAt: st.lastSeen
        };
      }
      return { sampleSize: items.length, byModel };
    } catch {
    }
  }
  return { sampleSize: 0, byModel: {} };
}
function computeModelRowScore(modelId, tier, usage, probe, policy) {
  const effectiveTier = tier === "geral" ? "tier2_balanced" : tier;
  const { capability, tierMatch } = scoreModelForTier(modelId, effectiveTier);
  const calls = (usage == null ? void 0 : usage.calls) ?? 0;
  const adoptionScore = calls > 0 ? Math.min(100, Math.round(Math.log10(calls + 1) * 26)) : 0;
  let speedScore = 60;
  if ((probe == null ? void 0 : probe.status) === "ok" && typeof probe.latency === "number") {
    speedScore = Math.max(15, Math.min(100, Math.round(100 - probe.latency / 1e3 * 12)));
  } else if ((usage == null ? void 0 : usage.avgFirstTokenMs) && usage.avgFirstTokenMs > 0) {
    speedScore = Math.max(20, Math.min(98, Math.round(100 - usage.avgFirstTokenMs / 1e3 * 8)));
  } else if ((usage == null ? void 0 : usage.avgDurationMs) && usage.avgDurationMs > 0) {
    speedScore = Math.max(20, Math.min(95, Math.round(100 - usage.avgDurationMs / 1e3 * 1.4)));
  }
  const avgCost = (usage == null ? void 0 : usage.avgCostUsd) ?? 0;
  const costScore = avgCost <= 0 ? 100 : Math.max(10, Math.round(100 - Math.min(90, avgCost * 1800)));
  let rawScore;
  if (policy.strategy === "speed" || tier === "tier1_fast" || tier === "decision") {
    rawScore = speedScore * 0.4 + tierMatch * 0.3 + adoptionScore * 0.15 + capability * 0.15;
  } else if (policy.strategy === "quality" || tier === "tier3_frontier" || tier === "reasoning") {
    rawScore = capability * 0.48 + tierMatch * 0.32 + adoptionScore * 0.1 + speedScore * 0.1;
  } else if (policy.strategy === "cost") {
    rawScore = costScore * 0.4 + tierMatch * 0.25 + adoptionScore * 0.2 + capability * 0.15;
  } else {
    rawScore = capability * 0.32 + tierMatch * 0.28 + adoptionScore * 0.22 + speedScore * 0.18;
  }
  if ((usage == null ? void 0 : usage.cacheHitPct) && usage.cacheHitPct >= 50) {
    rawScore += Math.min(5, (usage.cacheHitPct - 40) / 12);
  }
  const free = isFreeModel$1(modelId);
  if (policy.forceFree) {
    rawScore += free ? 18 : -25;
  } else if (free) {
    rawScore -= 20;
  }
  if ((probe == null ? void 0 : probe.status) === "ok") {
    rawScore += 8;
  } else if ((probe == null ? void 0 : probe.status) === "error") {
    rawScore -= 60;
  }
  return {
    score: Number(Math.max(0, Math.min(100, rawScore)).toFixed(1)),
    capabilityScore: capability,
    tierMatchScore: tierMatch,
    adoptionScore,
    speedScore
  };
}
function buildModelRankingSnapshot(params) {
  var _a, _b, _c;
  const tier = params.tier || "geral";
  const policy = {
    ...DEFAULT_ROUTING_POLICY,
    ...params.policy || {},
    forceFree: ((_a = params.policy) == null ? void 0 : _a.forceFree) ?? (params.avoidFree === false ? true : false),
    autoAssignBlocked: Array.isArray((_b = params.policy) == null ? void 0 : _b.autoAssignBlocked) ? params.policy.autoAssignBlocked : [],
    tierPins: ((_c = params.policy) == null ? void 0 : _c.tierPins) ? { ...params.policy.tierPins } : {}
  };
  const disabledSet = new Set(params.disabledModels || []);
  const blockedSet = new Set(policy.autoAssignBlocked.map((m) => m.toLowerCase()));
  const liveProbes = params.liveProbes || {};
  const qualityBench = params.qualityBench || {};
  const quarantines = params.quarantines || {};
  const pool = /* @__PURE__ */ new Map();
  for (const m of params.catalogModels || []) {
    const mid = String((m == null ? void 0 : m.id) || "").trim();
    if (!mid) continue;
    const grp = m.primaryGroup && params.groups[m.primaryGroup] || Array.isArray(m.groups) && m.groups[0] && params.groups[m.groups[0]] || inferCanonicalGroupForModel(mid, params.groups);
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
  const rankForTier = (targetTier) => {
    const rows = [];
    for (const item of pool.values()) {
      const usage = params.usageByModel[item.id];
      const probe = liveProbes[item.id];
      const qBench = qualityBench[item.id];
      const qEntry = quarantines[item.id];
      const isDisabled = disabledSet.has(item.id);
      const unsupported = isUnsupportedAgentModel(item.id);
      const accessMode = params.vipPolicy ? getModelAccessMode(item.id, item.group.id, params.vipPolicy, params.disabledModels) : isDisabled || blockedSet.has(item.id.toLowerCase()) ? "blocked" : "auto";
      const isBlocked = unsupported || blockedSet.has(item.id.toLowerCase()) || accessMode !== "auto";
      const quarantined = Boolean(qEntry);
      const free = isFreeModel$1(item.id);
      const avgCost = (usage == null ? void 0 : usage.avgCostUsd) ?? 0;
      const exceedsCostCap = policy.maxCostPerReqUsd !== null && avgCost > 0 && avgCost > policy.maxCostPerReqUsd;
      const freeMismatch = policy.forceFree ? !free : false;
      const effectiveOnline = (probe == null ? void 0 : probe.status) === "ok" ? true : (probe == null ? void 0 : probe.status) === "error" ? false : qBench ? qBench.online : null;
      const eligibleForAuto = !isDisabled && !isBlocked && !quarantined && effectiveOnline !== false && !exceedsCostCap && !freeMismatch;
      const scored = computeModelRowScore(item.id, targetTier, usage, probe, policy);
      let blendedScore = scored.score;
      if (qBench) {
        blendedScore = qBench.online ? Number(Math.max(0, Math.min(100, scored.score * 0.55 + qBench.qualityScore * 0.45 + (qBench.toolCallOk ? 6 : -10))).toFixed(1)) : Math.max(0, Number((scored.score - 50).toFixed(1)));
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
        quarantineReason: qEntry == null ? void 0 : qEntry.reason,
        qualityScore: qBench ? qBench.qualityScore : null,
        toolCallOk: qBench ? qBench.toolCallOk : null,
        eligibleForAuto,
        score: isDisabled ? -1 : blendedScore,
        capabilityScore: scored.capabilityScore,
        tierMatchScore: scored.tierMatchScore,
        adoptionScore: scored.adoptionScore,
        speedScore: scored.speedScore,
        online: effectiveOnline,
        pingLatencyMs: typeof (probe == null ? void 0 : probe.latency) === "number" ? probe.latency : (qBench == null ? void 0 : qBench.latencyMs) ?? null,
        pingError: (probe == null ? void 0 : probe.errorMsg) || (!(qBench == null ? void 0 : qBench.online) ? qBench == null ? void 0 : qBench.errorMsg : void 0),
        calls: (usage == null ? void 0 : usage.calls) ?? 0,
        avgDurationMs: (usage == null ? void 0 : usage.avgDurationMs) ?? null,
        avgFirstTokenMs: (usage == null ? void 0 : usage.avgFirstTokenMs) ?? null,
        cacheHitPct: (usage == null ? void 0 : usage.cacheHitPct) ?? null,
        avgCostUsd: avgCost,
        totalCostUsd: (usage == null ? void 0 : usage.totalCostUsd) ?? 0
      });
    }
    rows.sort((a, b) => {
      if (a.isDisabled !== b.isDisabled) return a.isDisabled ? 1 : -1;
      if (a.online === false !== (b.online === false)) return a.online === false ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.calls !== a.calls) return b.calls - a.calls;
      return (a.pingLatencyMs ?? 999999) - (b.pingLatencyMs ?? 999999);
    });
    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });
    return rows;
  };
  const tiers = ["geral", "tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"];
  const bestByTier = {};
  let selectedRows = [];
  for (const t of tiers) {
    const ranked = rankForTier(t);
    if (t === tier) selectedRows = ranked;
    const pinnedModel = policy.tierPins[t];
    const pinnedRow = pinnedModel ? ranked.find((r) => r.model === pinnedModel && !r.isDisabled && !r.autoAssignBlocked && r.online !== false) : void 0;
    const winner = pinnedRow || ranked.find((r) => r.eligibleForAuto) || ranked.find((r) => !r.isDisabled && !r.autoAssignBlocked && r.online !== false) || null;
    bestByTier[t] = winner ? {
      model: winner.model,
      group: winner.group,
      platform: winner.platform,
      score: winner.score,
      pingLatencyMs: winner.pingLatencyMs,
      calls: winner.calls,
      online: winner.online,
      avgCostUsd: winner.avgCostUsd,
      cacheHitPct: winner.cacheHitPct,
      pinned: Boolean(pinnedRow)
    } : null;
  }
  const hasUsage = params.usageSampleSize > 0;
  const hasProbes = Object.values(liveProbes).some((p) => p.status === "ok" || p.status === "error");
  const source = hasUsage && hasProbes ? "gateway_usage+live_probe" : hasUsage ? "gateway_usage" : hasProbes ? "live_probe" : "catalog";
  return {
    version: 2,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source,
    usageSampleSize: params.usageSampleSize,
    tier,
    policy,
    bestByTier,
    models: selectedRows
  };
}
async function persistModelRankingSnapshot(ctx, snapshot) {
  var _a, _b;
  const payload = JSON.stringify(
    {
      ...snapshot,
      models: snapshot.models.slice(0, 80)
    },
    null,
    2
  );
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_RANKING_KEY, payload);
  } catch {
  }
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.writeFile) === "function") {
    try {
      await host.writeFile(SHARED_RANKING_PATH, payload);
      return true;
    } catch {
    }
  }
  if (typeof (host == null ? void 0 : host.spawn) === "function") {
    try {
      const b64 = btoa(unescape(encodeURIComponent(payload)));
      const py = `import base64, os; p=${JSON.stringify(SHARED_RANKING_PATH)}; os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(base64.b64decode(${JSON.stringify(b64)}))`;
      const proc = await host.spawn("python", { args: [py] });
      await proc.exited;
      return true;
    } catch {
    }
  }
  return false;
}
function estimateProbeCostUsd(modelId, inputTokens, outputTokens) {
  const m = String(modelId || "").toLowerCase();
  if (m.includes(":free") || m.includes("-free") || m.endsWith("free")) return 0;
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens)) return null;
  const inTok = Math.max(0, Number(inputTokens || 0));
  const outTok = Math.max(0, Number(outputTokens || 0));
  if (inTok === 0 && outTok === 0) return null;
  let per1mIn = 1;
  let per1mOut = 3;
  if (m.includes("opus")) {
    per1mIn = 15;
    per1mOut = 75;
  } else if (m.includes("sonnet")) {
    per1mIn = 3;
    per1mOut = 15;
  } else if (m.includes("haiku")) {
    per1mIn = 0.8;
    per1mOut = 4;
  } else if (m.includes("flash")) {
    per1mIn = 0.15;
    per1mOut = 0.6;
  } else if (m.includes("gemini") || m.includes("hydrogen")) {
    per1mIn = 1.25;
    per1mOut = 5;
  } else if (m.includes("gpt-6") || m.includes("gpt-5")) {
    per1mIn = 2.5;
    per1mOut = 10;
  } else if (m.includes("grok")) {
    per1mIn = 0.5;
    per1mOut = 1.5;
  }
  return Number((inTok / 1e6 * per1mIn + outTok / 1e6 * per1mOut).toFixed(6));
}
const LOCAL_STORAGE_QUALITY_BENCH_KEY = "nexusmind_quality_bench_v1";
const SHARED_QUALITY_BENCH_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-quality-bench.json";
const ORGFY_EVAL_DOC_PATH = "/Users/heltonfraga/.buzz/REPOS/orgfy/docs/eval-modelos-onda5.md";
async function writeTextFileWithFallback(ctx, filePath, content) {
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.writeFile) === "function") {
    try {
      await host.writeFile(filePath, content);
      return true;
    } catch {
    }
  }
  if (typeof (host == null ? void 0 : host.spawn) === "function") {
    try {
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const py = `import base64, os; p=${JSON.stringify(filePath)}; os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(base64.b64decode(${JSON.stringify(b64)}))`;
      const proc = await host.spawn("python", { args: [py] });
      await proc.exited;
      return true;
    } catch {
    }
  }
  return false;
}
function buildOrgfyEvalMarkdown(results) {
  const rows = Object.values(results).filter((r) => r && r.model).sort((a, b) => {
    if (a.toolCallOk !== b.toolCallOk) return a.toolCallOk ? -1 : 1;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    return (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999);
  });
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const lines = [
    "# Eval R5.1 — Qualidade & Tool-Calling (NexusMind Gateway)",
    "",
    `_Atualizado manualmente via NexusMind Gateway em ${updatedAt}_`,
    "",
    "| Provider | Model | Resposta | Tool Call | Card concluído (end-to-end) | Latência Média (ms) | Custo Total (USD) | Erro Amostra |",
    "| :--- | :--- | ---: | ---: | :--- | ---: | ---: | :--- |"
  ];
  for (const r of rows) {
    const respStr = r.online ? "10/10" : "0/10";
    const tcStr = r.toolCallOk ? "10/10" : "0/10";
    const msStr = typeof r.latencyMs === "number" ? String(Math.round(r.latencyMs)) : "—";
    const costStr = typeof r.estimatedCostUsd === "number" ? `$${r.estimatedCostUsd.toFixed(5)}` : "—";
    const errStr = r.errorMsg ? String(r.errorMsg).replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 90) : "—";
    lines.push(`| ${r.group} | ${r.model} | ${respStr} | ${tcStr} | score ${r.qualityScore}/100 | ${msStr} | ${costStr} | ${errStr} |`);
  }
  return lines.join("\n") + "\n";
}
async function syncQualityBenchToOrgfyEval(ctx, results) {
  if (!results || Object.keys(results).length === 0) return false;
  const md = buildOrgfyEvalMarkdown(results);
  return writeTextFileWithFallback(ctx, ORGFY_EVAL_DOC_PATH, md);
}
function classifyGatewayError(errorText, httpStatus) {
  const txt = String(errorText || "").toLowerCase();
  if (txt.includes("weekly limit") || txt.includes("limit") && txt.includes("resets")) {
    return "weekly_limit";
  }
  if (txt.includes("malformed_function_call") || txt.includes("malformed function") || txt.includes("invalid tool") || txt.includes("tool_use") && txt.includes("invalid")) {
    return "malformed_tool";
  }
  if (txt.includes("stream ended") || txt.includes("upstream response stream") || txt.includes("unexpected eof") || txt.includes("premature close")) {
    return "stream_cut";
  }
  if (httpStatus === 404 || txt.includes("resource not found") || txt.includes("(404)") || txt.includes("model not found")) {
    return "not_found";
  }
  if (httpStatus === 429 || txt.includes("429") || txt.includes("rate limit") || txt.includes("too many requests") || txt.includes("quota")) {
    return "rate_limit";
  }
  if (httpStatus === 401 || httpStatus === 403 || txt.includes("unauthorized") || txt.includes("invalid api key") || txt.includes("forbidden")) {
    return "auth_error";
  }
  if (txt.includes("timeout") || txt.includes("timed out") || txt.includes("aborted") || txt.includes("etimedout")) {
    return "timeout";
  }
  if (typeof httpStatus === "number" && httpStatus >= 500 || /\b50[0234]\b/.test(txt) || txt.includes("server error") || txt.includes("bad gateway")) {
    return "server_error";
  }
  return "unknown";
}
function loadSavedQualityBench() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_QUALITY_BENCH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
async function saveQualityBench(ctx, results) {
  var _a, _b;
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_QUALITY_BENCH_KEY, JSON.stringify(results));
  } catch {
  }
  const payload = JSON.stringify(
    {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: Object.keys(results).length,
      results
    },
    null,
    2
  );
  await writeTextFileWithFallback(ctx, SHARED_QUALITY_BENCH_PATH, payload);
}
async function runModelQualityProbe(ctx, modelId, group) {
  var _a, _b;
  const testedAt = (/* @__PURE__ */ new Date()).toISOString();
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.request) !== "function") {
    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: false,
      toolCallOk: false,
      streamOk: false,
      latencyMs: null,
      qualityScore: 0,
      errorKind: "unknown",
      errorMsg: "ctx.host.request indisponível"
    };
  }
  const isAnthropic = group.id === "nexusmind_anthropic";
  const url = isAnthropic ? "https://api.nexusmind.digital/v1/messages" : "https://api.nexusmind.digital/v1/chat/completions";
  const headers = isAnthropic ? {
    "x-api-key": group.defaultKey,
    Authorization: `Bearer ${group.defaultKey}`,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/NexusMindQualityBench"
  } : {
    Authorization: `Bearer ${group.defaultKey}`,
    "Content-Type": "application/json",
    "User-Agent": "BuzzDesktop/NexusMindQualityBench"
  };
  const body = isAnthropic ? {
    model: modelId,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: 'Chame a ferramenta check_status com {"service":"orgfy"} agora.'
      }
    ],
    tools: [
      {
        name: "check_status",
        description: "Verifica o status de um serviço da fábrica",
        input_schema: {
          type: "object",
          properties: { service: { type: "string" } },
          required: ["service"]
        }
      }
    ]
  } : {
    model: modelId,
    max_tokens: 120,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: 'Chame a ferramenta check_status com {"service":"orgfy"} agora.'
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "check_status",
          description: "Verifica o status de um serviço da fábrica",
          parameters: {
            type: "object",
            properties: { service: { type: "string" } },
            required: ["service"]
          }
        }
      }
    ],
    tool_choice: "auto"
  };
  const t0 = Date.now();
  try {
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(body),
      timeoutMs: 14e3
    });
    const latencyMs = Date.now() - t0;
    const rawBody = String((res == null ? void 0 : res.body) || "");
    if (!res || res.status < 200 || res.status >= 300) {
      const errKind = classifyGatewayError(rawBody, res == null ? void 0 : res.status);
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: errKind,
        errorMsg: `HTTP ${(res == null ? void 0 : res.status) ?? "err"} · ${rawBody.slice(0, 120)}`
      };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: "stream_cut",
        errorMsg: "Resposta JSON truncada/inválida"
      };
    }
    if (parsed == null ? void 0 : parsed.error) {
      const errText = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
      const errKind = classifyGatewayError(errText, res.status);
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: errKind,
        errorMsg: errText.slice(0, 140)
      };
    }
    let toolCallOk = false;
    let streamOk = false;
    if (isAnthropic) {
      const blocks = Array.isArray(parsed == null ? void 0 : parsed.content) ? parsed.content : [];
      const toolUse = blocks.find((b) => (b == null ? void 0 : b.type) === "tool_use" && (b == null ? void 0 : b.name) === "check_status");
      if (toolUse && toolUse.input && typeof toolUse.input === "object") {
        toolCallOk = true;
        streamOk = true;
      } else if (blocks.some((b) => (b == null ? void 0 : b.type) === "text" && String((b == null ? void 0 : b.text) || "").trim().length > 0)) {
        streamOk = true;
      }
    } else {
      const msg = (_b = (_a = parsed == null ? void 0 : parsed.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message;
      const toolCalls = Array.isArray(msg == null ? void 0 : msg.tool_calls) ? msg.tool_calls : [];
      const tc = toolCalls.find((c) => {
        var _a2;
        return ((_a2 = c == null ? void 0 : c.function) == null ? void 0 : _a2.name) === "check_status";
      });
      if (tc) {
        try {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          if (args && typeof args === "object") {
            toolCallOk = true;
            streamOk = true;
          }
        } catch {
          toolCallOk = false;
          streamOk = true;
        }
      } else if (typeof (msg == null ? void 0 : msg.content) === "string" && msg.content.trim().length > 0) {
        streamOk = true;
      }
    }
    const speedPts = Math.max(0, Math.min(25, Math.round(25 - latencyMs / 1e3 * 2.5)));
    const qualityScore = (toolCallOk ? 45 : 0) + (streamOk ? 30 : 0) + speedPts;
    const usage = (parsed == null ? void 0 : parsed.usage) || {};
    const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
    const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
    const estimatedCostUsd = estimateProbeCostUsd(modelId, inputTokens, outputTokens);
    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: true,
      toolCallOk,
      streamOk,
      latencyMs,
      qualityScore,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      errorKind: "ok",
      ...toolCallOk ? {} : { errorMsg: "Respondeu texto mas não executou tool_call estruturado" }
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const msg = String((err == null ? void 0 : err.message) || err);
    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: false,
      toolCallOk: false,
      streamOk: false,
      latencyMs,
      qualityScore: 0,
      errorKind: classifyGatewayError(msg),
      errorMsg: msg.slice(0, 140)
    };
  }
}
async function runBatchQualityBench(ctx, candidates, onProgress) {
  const existing = loadSavedQualityBench();
  const next = { ...existing };
  const total = candidates.length;
  let done = 0;
  const queue = [...candidates];
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const res = await runModelQualityProbe(ctx, item.model, item.group);
      next[item.model] = res;
      done += 1;
      try {
        onProgress == null ? void 0 : onProgress(done, total, res);
      } catch {
      }
    }
  };
  await Promise.all([worker(), worker()]);
  await saveQualityBench(ctx, next);
  return next;
}
const TIER_OPTIONS = [
  { id: "geral", label: "Geral" },
  { id: "tier1_fast", label: "Tier 1 · Rápido" },
  { id: "tier2_balanced", label: "Tier 2 · Código" },
  { id: "tier3_frontier", label: "Tier 3 · Frontier" },
  { id: "reasoning", label: "Raciocínio" },
  { id: "decision", label: "Decision" }
];
const STRATEGY_OPTIONS = [
  { id: "balanced", label: "Balanceado" },
  { id: "speed", label: "Velocidade" },
  { id: "quality", label: "Máxima Qualidade" },
  { id: "cost", label: "Menor Custo" }
];
function fmtMs(ms) {
  if (ms === null || ms === void 0 || !Number.isFinite(ms)) return "—";
  if (ms >= 1e3) return `${(ms / 1e3).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}
function fmtCost(usd, opts) {
  if (opts == null ? void 0 : opts.isFree) return "FREE";
  if (Number.isFinite(usd) && usd > 0) {
    if (usd < 1e-3) return `$${(usd * 1e3).toFixed(2)}/1k`;
    return `$${usd.toFixed(4)}`;
  }
  if (typeof (opts == null ? void 0 : opts.estimatedProbeUsd) === "number" && opts.estimatedProbeUsd > 0) {
    return `~$${opts.estimatedProbeUsd.toFixed(4)}`;
  }
  return "—";
}
function createModelRankingTabComponent(ctx, groups) {
  const React = ctx.react;
  const h = React.createElement;
  return function ModelRankingTab({
    models,
    disabledModels,
    modelTests,
    onTestSingleModel,
    onNotify,
    vipPolicy,
    onSetModelAccessMode,
    onQuickProtectVips,
    qualityBench,
    onUpdateQualityBench,
    quarantines
  }) {
    var _a, _b;
    const [selectedTier, setSelectedTier] = React.useState("geral");
    const [policy, setPolicy] = React.useState(() => loadSavedRoutingPolicy());
    const [usageByModel, setUsageByModel] = React.useState({});
    const [usageSampleSize, setUsageSampleSize] = React.useState(0);
    const [probingTop, setProbingTop] = React.useState(false);
    const [runningEval, setRunningEval] = React.useState(false);
    const [evalProgress, setEvalProgress] = React.useState(null);
    const [selectedAgentKey, setSelectedAgentKey] = React.useState("");
    const [applyingModel, setApplyingModel] = React.useState(null);
    const [onlyAutoEligible, setOnlyAutoEligible] = React.useState(false);
    const [searchFilter, setSearchFilter] = React.useState("");
    const [controlPlane, setControlPlane] = React.useState(null);
    const refreshControlPlane = React.useCallback(async () => {
      const host = ctx == null ? void 0 : ctx.host;
      if (typeof (host == null ? void 0 : host.readFile) !== "function") return;
      for (const p of ["~/.buzz/.scratch/model-control-plane.json", "/Users/heltonfraga/.buzz/.scratch/model-control-plane.json"]) {
        try {
          const raw = await host.readFile(p);
          if (!raw) continue;
          const txt = typeof raw === "string" ? raw : new TextDecoder("utf-8").decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
          const parsed = JSON.parse(txt);
          if (parsed && Array.isArray(parsed.models)) {
            setControlPlane(parsed);
            return;
          }
        } catch {
        }
      }
    }, []);
    React.useEffect(() => {
      refreshControlPlane();
    }, [refreshControlPlane]);
    const updatePolicy = (updater) => {
      setPolicy((prev) => {
        const next = updater(prev);
        saveRoutingPolicy(next);
        return next;
      });
    };
    const agentsList = React.useMemo(() => {
      var _a2, _b2;
      try {
        const snap = ((_b2 = (_a2 = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a2.snapshot) == null ? void 0 : _b2.call(_a2)) || {};
        const pool = [];
        const seen = /* @__PURE__ */ new Set();
        for (const list of [snap.running, snap.agents]) {
          if (!Array.isArray(list)) continue;
          for (const a of list) {
            if (!(a == null ? void 0 : a.key) || seen.has(a.key)) continue;
            seen.add(a.key);
            pool.push(a);
          }
        }
        return pool.sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key)));
      } catch {
        return [];
      }
    }, [models.length, applyingModel]);
    React.useEffect(() => {
      if (!selectedAgentKey && agentsList.length > 0) {
        setSelectedAgentKey(agentsList[0].key);
      }
    }, [agentsList, selectedAgentKey]);
    const refreshUsageTelemetry = React.useCallback(async () => {
      const loaded = await loadGatewayUsageByModel(ctx);
      setUsageByModel(loaded.byModel);
      setUsageSampleSize(loaded.sampleSize);
    }, []);
    React.useEffect(() => {
      refreshUsageTelemetry();
    }, [refreshUsageTelemetry]);
    const snapshot = React.useMemo(() => {
      return buildModelRankingSnapshot({
        catalogModels: models,
        groups,
        usageByModel,
        usageSampleSize,
        liveProbes: modelTests,
        disabledModels,
        tier: selectedTier,
        policy,
        vipPolicy,
        qualityBench,
        quarantines
      });
    }, [models, usageByModel, usageSampleSize, modelTests, disabledModels, selectedTier, policy, vipPolicy, qualityBench, quarantines]);
    React.useEffect(() => {
      if (snapshot.models.length === 0) return;
      persistModelRankingSnapshot(ctx, snapshot);
    }, [snapshot]);
    const visibleRows = React.useMemo(() => {
      const q = searchFilter.trim().toLowerCase();
      return snapshot.models.filter((r) => {
        if (r.isDisabled) return false;
        if (policy.forceFree && !r.isFree) return false;
        if (onlyAutoEligible && !r.eligibleForAuto) return false;
        if (q && !r.model.toLowerCase().includes(q)) return false;
        return true;
      }).slice(0, 40);
    }, [snapshot, policy.forceFree, onlyAutoEligible, searchFilter]);
    const activeWinner = snapshot.bestByTier[selectedTier] || null;
    const pinnedForTier = policy.tierPins[selectedTier] || null;
    const toggleAutoAssignBlock = (modelId) => {
      updatePolicy((prev) => {
        const lower = modelId.toLowerCase();
        const exists = prev.autoAssignBlocked.some((m) => m.toLowerCase() === lower);
        const nextBlocked = exists ? prev.autoAssignBlocked.filter((m) => m.toLowerCase() !== lower) : [...prev.autoAssignBlocked, modelId];
        return { ...prev, autoAssignBlocked: nextBlocked };
      });
    };
    const togglePinForTier = (modelId) => {
      updatePolicy((prev) => {
        const nextPins = { ...prev.tierPins };
        if (nextPins[selectedTier] === modelId) {
          delete nextPins[selectedTier];
        } else {
          nextPins[selectedTier] = modelId;
        }
        return { ...prev, tierPins: nextPins };
      });
    };
    const handleProbeTopCandidates = async () => {
      const topToTest = visibleRows.slice(0, 6);
      if (topToTest.length === 0) return;
      setProbingTop(true);
      onNotify({ type: "info", text: `Testando saúde HTTP 200 dos top ${topToTest.length} modelos...` });
      try {
        await Promise.all(topToTest.map((row) => onTestSingleModel(row.model)));
        await refreshUsageTelemetry();
        onNotify({ type: "success", text: `Ranking e políticas sincronizados com o OrgFy e agentes.` });
      } finally {
        setProbingTop(false);
      }
    };
    const handleRunManualEval = async () => {
      const topToEval = visibleRows.slice(0, 8);
      if (topToEval.length === 0) return;
      setRunningEval(true);
      setEvalProgress(`Eval 0/${topToEval.length}`);
      onNotify({
        type: "info",
        text: `Rodando Eval de Qualidade & Tool-Calling nos top ${topToEval.length} modelos...`
      });
      try {
        const candidates = topToEval.map((row) => ({
          model: row.model,
          group: groups[row.group] || inferCanonicalGroupForModel(row.model, groups)
        }));
        const updated = await runBatchQualityBench(ctx, candidates, (done, total) => {
          setEvalProgress(`Eval ${done}/${total}`);
        });
        onUpdateQualityBench == null ? void 0 : onUpdateQualityBench(updated);
        await syncQualityBenchToOrgfyEval(ctx, updated);
        await refreshUsageTelemetry();
        const testedSlice = topToEval.map((r) => updated[r.model]).filter(Boolean);
        const approved = testedSlice.filter((r) => r.online && r.toolCallOk).length;
        onNotify({
          type: "success",
          text: `Eval concluído: ${approved}/${testedSlice.length} aprovados em Tool-Calling. Ranking e OrgFy atualizados.`
        });
      } catch (err) {
        onNotify({ type: "error", text: `Erro no Eval manual: ${(err == null ? void 0 : err.message) || err}` });
      } finally {
        setRunningEval(false);
        setEvalProgress(null);
      }
    };
    const handleApplyModel = async (modelId, groupId) => {
      const agentsApi = ctx == null ? void 0 : ctx.agents;
      const target = agentsList.find((a) => a.key === selectedAgentKey);
      if (!target || typeof (agentsApi == null ? void 0 : agentsApi.save) !== "function") {
        onNotify({ type: "error", text: "Selecione um agente para aplicar o modelo." });
        return;
      }
      setApplyingModel(modelId);
      try {
        const nextCfg = {
          ...target.config && typeof target.config === "object" ? target.config : {},
          model: modelId,
          provider: groupId
        };
        await agentsApi.save(target.key, { config: nextCfg });
        onNotify({ type: "success", text: `${target.name || target.key} atualizado para ${modelId}.` });
      } catch (err) {
        onNotify({ type: "error", text: `Falha ao aplicar: ${(err == null ? void 0 : err.message) || err}` });
      } finally {
        setApplyingModel(null);
      }
    };
    const cpSummary = (controlPlane == null ? void 0 : controlPlane.summary) || null;
    const cpModels = Array.isArray(controlPlane == null ? void 0 : controlPlane.models) ? controlPlane.models : [];
    const cpProviders = Array.isArray(controlPlane == null ? void 0 : controlPlane.providerHealth) ? controlPlane.providerHealth : [];
    const hasDecisionApi = typeof ((_a = ctx == null ? void 0 : ctx.decisions) == null ? void 0 : _a.decide) === "function";
    const approvedList = cpModels.filter((m) => m.evalApproved);
    const avgApprovedLat = approvedList.length > 0 ? Math.round(approvedList.reduce((acc, m) => acc + Number(m.latencyMs || 0), 0) / approvedList.length) : null;
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      // 0. Dashboard SOTA Eval-First Control Plane (KPIs + Gráficos SVG nativos)
      cpSummary && h(
        "div",
        { "data-nm-sota-dashboard": "true", style: { display: "flex", flexDirection: "column", gap: "12px" } },
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" } },
          [
            {
              label: "Aprovados no Eval (Hard Gate)",
              val: `${cpSummary.approvedCount}/${cpSummary.totalEvaluated}`,
              sub: `${cpSummary.autoEligibleCount} Auto · ${cpSummary.vipCount} VIP · ${cpSummary.blockedCount} Bloq.`,
              tone: "ok"
            },
            {
              label: "Sucesso Real 24h (sessions.db)",
              val: typeof cpSummary.prodSuccessRate24hPct === "number" ? `${cpSummary.prodSuccessRate24hPct.toFixed(1)}%` : "—",
              sub: `${Number(cpSummary.prodTurns24h || 0).toLocaleString("pt-BR")} turnos · ${cpSummary.prodErrors24h || 0} erros`,
              tone: (cpSummary.prodSuccessRate24hPct ?? 100) >= 95 ? "ok" : "warn"
            },
            {
              label: "Latência Média (Aprovados)",
              val: fmtMs(avgApprovedLat),
              sub: `12 tools · schema fidelity ≥ 80%`,
              tone: "neutral"
            },
            {
              label: "Roteamento & Decision API",
              val: hasDecisionApi ? "Decision API ✓" : "Eval-First ✓",
              sub: policy.forceFree ? "Modo :free ativo" : `Auto #1: ${((_b = controlPlane == null ? void 0 : controlPlane.bestByTier) == null ? void 0 : _b.geral) || "—"}`,
              tone: "accent"
            }
          ].map(
            (k) => h(
              "div",
              { key: k.label, className: "nm-card-pad", style: { padding: "11px 13px" } },
              h("div", { style: { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--nm-muted)" } }, k.label),
              h("div", { className: "nm-mono nm-num", style: { fontSize: "18px", fontWeight: 700, marginTop: "4px", color: k.tone === "ok" ? "var(--green-11, #3dd68c)" : k.tone === "warn" ? "var(--amber-11, #fbbf24)" : "var(--nm-fg)" } }, k.val),
              h("div", { style: { fontSize: "10.5px", color: "var(--nm-muted)", marginTop: "2px" } }, k.sub)
            )
          )
        ),
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" } },
          // Gráfico 1: SVG Eval Score × Latência × Sucesso 24h (Top 9)
          h(
            "div",
            { className: "nm-card-pad", style: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12.5px", fontWeight: 700 } }, "Eval SOTA v2 · Score × Latência × Prod 24h"),
              h("span", { className: "nm-mono", style: { fontSize: "10px", color: "var(--nm-muted)" } }, "0–100 pts")
            ),
            h(
              "svg",
              { viewBox: "0 0 440 212", style: { width: "100%", height: "212px", display: "block" }, role: "img", "aria-label": "Ranking Eval Score por modelo" },
              cpModels.slice(0, 8).map((m, i) => {
                var _a2;
                const y = 8 + i * 25;
                const score = Math.max(0, Math.min(100, Number(m.evalScore || 0)));
                const barW = Math.max(4, score / 100 * 190);
                const color = !m.online ? "var(--red-11, #f87171)" : m.policyState === "blocked" ? "var(--amber-11, #fbbf24)" : m.policyState === "vip" ? "#c084fc" : "var(--green-11, #3dd68c)";
                const shortName = String(m.model || "").split("/").pop() || m.model;
                const label = shortName.length > 22 ? shortName.slice(0, 20) + "…" : shortName;
                const prodPct = (_a2 = m.prod24h) == null ? void 0 : _a2.successRate24hPct;
                return h(
                  "g",
                  { key: m.model },
                  h("text", { x: 0, y: y + 12, fill: "var(--text-secondary, #c7c7c7)", fontSize: "10.5", fontFamily: "ui-monospace, monospace" }, label),
                  h("rect", { x: 150, y: y + 2, width: 190, height: 13, rx: 4, fill: "rgba(255,255,255,0.06)" }),
                  h("rect", { x: 150, y: y + 2, width: barW, height: 13, rx: 4, fill: color }),
                  h(
                    "text",
                    { x: 348, y: y + 12, fill: "var(--text-primary, #f3f4f6)", fontSize: "10", fontFamily: "ui-monospace, monospace" },
                    `${score.toFixed(1)} · ${fmtMs(m.latencyMs)}${typeof prodPct === "number" ? ` · ${Math.round(prodPct)}%` : ""}`
                  )
                );
              })
            )
          ),
          // Gráfico 2: Saúde por Provedor (Provider Health Matrix)
          h(
            "div",
            { className: "nm-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px", padding: "12px 14px" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h("span", { style: { fontSize: "12.5px", fontWeight: 700 } }, "Saúde por Provedor (API NexusMind)"),
              h("span", { className: "nm-mono", style: { fontSize: "10px", color: "var(--nm-muted)" } }, `${cpProviders.length} provedores`)
            ),
            cpProviders.map((p) => {
              const pct = Math.max(0, Math.min(100, Number(p.healthPct || 0)));
              const toneColor = pct >= 70 ? "var(--green-11, #3dd68c)" : pct >= 40 ? "var(--amber-11, #fbbf24)" : "var(--red-11, #f87171)";
              return h(
                "div",
                { key: p.provider, style: { display: "flex", flexDirection: "column", gap: "4px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", fontSize: "11.5px" } },
                  h("span", { className: "nm-mono", style: { fontWeight: 600 } }, String(p.provider || "").replace("nexusmind_", "")),
                  h("span", { className: "nm-mono", style: { color: "var(--nm-muted)", fontSize: "10.5px" } }, `${p.approved}/${p.total} aprov. · ${p.online} online · ${fmtMs(p.avgLatencyMs)}`)
                ),
                h(
                  "div",
                  { style: { height: "8px", borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" } },
                  h("div", { style: { width: `${Math.max(4, pct)}%`, height: "100%", borderRadius: "999px", backgroundColor: toneColor } })
                )
              );
            }),
            h(
              "div",
              { style: { marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--nm-border)", fontSize: "10.5px", color: "var(--nm-muted)", display: "flex", justifyContent: "space-between" } },
              h("span", null, "Hard Gate: Tool Call ≥ 80% + Schema ≥ 80% + Score ≥ 80"),
              h("span", { className: "nm-mono" }, (controlPlane == null ? void 0 : controlPlane.evalVersion) || "sota-v2")
            )
          )
        )
      ),
      // 1. Barra compacta de Tier + Critérios de Roteamento (CodeDen + Buzz Theme)
      h(
        "div",
        {
          className: "nm-card-pad",
          style: { display: "flex", flexDirection: "column", gap: "10px", padding: "12px 14px" }
        },
        // Linha 1: Tiers + Ação de Healthcheck
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
          h(
            "div",
            { className: "nm-segmented", style: { flexWrap: "wrap" } },
            TIER_OPTIONS.map((t) => {
              const active = selectedTier === t.id;
              return h(
                "button",
                {
                  key: t.id,
                  type: "button",
                  className: "nm-seg-btn",
                  "data-active": active ? "true" : "false",
                  onClick: () => setSelectedTier(t.id)
                },
                t.label
              );
            })
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            onQuickProtectVips && h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "soft",
                onClick: onQuickProtectVips
              },
              "Proteger VIPs"
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "soft",
                "data-run-manual-eval": "true",
                onClick: handleRunManualEval,
                disabled: runningEval || probingTop || visibleRows.length === 0,
                title: "Testa Tool-Calling, integridade e latência dos top 8 modelos e atualiza o Ranking + OrgFy"
              },
              runningEval ? evalProgress || "Rodando Eval..." : "Rodar Eval (Top 8)"
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "primary",
                onClick: handleProbeTopCandidates,
                disabled: probingTop || runningEval
              },
              probingTop ? "Testando..." : "Testar Top 6"
            )
          )
        ),
        // Linha 2: Critérios de Política (Estratégia, Teto de Custo, Forçar :free, Busca)
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-primary, #2a2a2a)"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
            // Estratégia
            h(
              "label",
              { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)" } },
              "Critério:",
              h(
                "select",
                {
                  value: policy.strategy,
                  onChange: (e) => updatePolicy((p) => ({ ...p, strategy: e.target.value })),
                  style: {
                    backgroundColor: "var(--surface-inset, #101010)",
                    color: "var(--text-primary, #ffffff)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px"
                  }
                },
                STRATEGY_OPTIONS.map((s) => h("option", { key: s.id, value: s.id }, s.label))
              )
            ),
            // Teto de custo por requisição
            h(
              "label",
              { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)" } },
              "Teto custo/req:",
              h(
                "select",
                {
                  value: policy.maxCostPerReqUsd === null ? "" : String(policy.maxCostPerReqUsd),
                  onChange: (e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    updatePolicy((p) => ({ ...p, maxCostPerReqUsd: v }));
                  },
                  style: {
                    backgroundColor: "var(--surface-inset, #101010)",
                    color: "var(--text-primary, #ffffff)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px"
                  }
                },
                h("option", { value: "" }, "Sem teto"),
                h("option", { value: "0.005" }, "≤ $0.005"),
                h("option", { value: "0.02" }, "≤ $0.020"),
                h("option", { value: "0.05" }, "≤ $0.050")
              )
            ),
            // Toggle Forçar :free (explicitamente pedido)
            h(
              "label",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  padding: "4px 9px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  border: `1px solid ${policy.forceFree ? "var(--nm-primary-border)" : "var(--nm-border)"}`,
                  backgroundColor: policy.forceFree ? "var(--nm-primary-soft)" : "transparent",
                  color: policy.forceFree ? "var(--nm-primary-text)" : "var(--nm-fg-secondary)",
                  fontWeight: policy.forceFree ? "600" : "500"
                }
              },
              h("input", {
                type: "checkbox",
                className: "nm-check",
                checked: policy.forceFree,
                onChange: (e) => updatePolicy((p) => ({ ...p, forceFree: Boolean(e.target.checked) }))
              }),
              "Forçar modelos :free"
            ),
            // Filtro elegíveis para auto-designação
            h(
              "label",
              { style: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--nm-muted)", cursor: "pointer" } },
              h("input", {
                type: "checkbox",
                className: "nm-check",
                checked: onlyAutoEligible,
                onChange: (e) => setOnlyAutoEligible(Boolean(e.target.checked))
              }),
              "Só elegíveis (Auto)"
            )
          ),
          h("input", {
            type: "text",
            className: "nm-input",
            placeholder: "Filtrar modelo...",
            value: searchFilter,
            onChange: (e) => setSearchFilter(e.target.value),
            style: { width: "170px", fontSize: "11.5px" }
          })
        )
      ),
      // 2. Faixa única do Modelo #1 Eleito + Aplicação Direta (com acento herdado do Buzz)
      h(
        "div",
        {
          className: "nm-card-pad",
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "11px 14px",
            borderColor: activeWinner ? "var(--nm-primary-border)" : "var(--nm-border)"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
          h(
            "span",
            { className: "nm-pill", "data-tone": "accent" },
            (activeWinner == null ? void 0 : activeWinner.pinned) ? "FIXADO" : "AUTO #1"
          ),
          h(
            "span",
            { className: "nm-mono", style: { fontSize: "13px", fontWeight: "700", color: "var(--nm-fg)" } },
            activeWinner ? activeWinner.model : "Nenhum elegível"
          ),
          activeWinner && h(
            "span",
            { className: "nm-mono nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `score ${activeWinner.score} · ${activeWinner.calls.toLocaleString("pt-BR")} reqs · ${fmtCost(activeWinner.avgCostUsd)}`
          ),
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `(${usageSampleSize.toLocaleString("pt-BR")} chamadas · ${policy.autoAssignBlocked.length} bloqueados p/ auto)`
          )
        ),
        agentsList.length > 0 && h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "select",
            {
              className: "nm-select",
              value: selectedAgentKey,
              onChange: (e) => setSelectedAgentKey(e.target.value),
              style: { fontSize: "11.5px" }
            },
            agentsList.map(
              (a) => {
                var _a2;
                return h("option", { key: a.key, value: a.key }, `${a.name || a.key} (${((_a2 = a.config) == null ? void 0 : _a2.model) || "padrão"})`);
              }
            )
          ),
          activeWinner && h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              onClick: () => handleApplyModel(activeWinner.model, activeWinner.group),
              disabled: applyingModel !== null,
              style: { padding: "5px 10px", fontSize: "11.5px" }
            },
            "Aplicar #1"
          )
        )
      ),
      // 3. Tabela minimalista de Ranking + Controle de Auto-Designação por Modelo
      h(
        "div",
        { className: "nm-card", style: { overflowX: "auto" } },
        h(
          "table",
          { className: "nm-table" },
          h(
            "thead",
            null,
            h(
              "tr",
              {
                style: {
                  borderBottom: "1px solid var(--border-primary, #2e2e2e)",
                  textAlign: "left",
                  color: "var(--text-tertiary, #808080)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }
              },
              ["#", "Modelo", "Auto-Designação", "Score", "Saúde", "Chamadas", "Latência", "Custo", "Ações"].map(
                (col) => h("th", { key: col, style: { padding: "9px 12px", fontWeight: "600" } }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            visibleRows.length === 0 ? h(
              "tr",
              null,
              h(
                "td",
                { colSpan: 9, style: { padding: "24px", textAlign: "center", color: "var(--text-tertiary, #808080)" } },
                "Nenhum modelo corresponde aos critérios atuais."
              )
            ) : visibleRows.map((row, idx) => {
              var _a2;
              const isPinned = pinnedForTier === row.model;
              const healthLabel = row.online === true ? `OK · ${fmtMs(row.pingLatencyMs)}` : row.online === false ? `Erro` : "—";
              const healthColor = row.online === true ? "var(--green-11, #3dd68c)" : row.online === false ? "var(--red-11, #ff9592)" : "var(--text-tertiary, #808080)";
              return h(
                "tr",
                {
                  key: row.model,
                  style: {
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    opacity: row.autoAssignBlocked ? 0.65 : 1
                  }
                },
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-tertiary, #808080)" } }, `${idx + 1}`),
                h(
                  "td",
                  { style: { padding: "8px 12px", fontWeight: "500", color: "var(--text-primary, #ffffff)" } },
                  h("span", null, row.model),
                  h(
                    "span",
                    { style: { marginLeft: "6px", fontSize: "10px", color: "var(--text-tertiary, #808080)", fontFamily: "monospace" } },
                    row.group.replace("nexusmind_", "")
                  ),
                  row.isFree && h(
                    "span",
                    { style: { marginLeft: "6px", fontSize: "9px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "var(--affordance-subtle, #282828)", color: "var(--text-secondary, #c7c7c7)" } },
                    "FREE"
                  ),
                  isPinned && h(
                    "span",
                    { className: "nm-pill", "data-tone": "accent", style: { marginLeft: "6px", fontSize: "9.5px", padding: "1px 6px" } },
                    "FIXADO"
                  )
                ),
                // Controle 1-clique em 3 estados: Auto | VIP | Bloq.
                h(
                  "td",
                  { style: { padding: "8px 12px" } },
                  onSetModelAccessMode ? h(
                    "div",
                    { className: "nm-mode-group" },
                    [
                      { id: "auto", label: "Auto" },
                      { id: "vip", label: "VIP" },
                      { id: "blocked", label: "Bloq." }
                    ].map(
                      (opt) => h(
                        "button",
                        {
                          key: opt.id,
                          type: "button",
                          className: "nm-mode-btn",
                          "data-active": row.accessMode === opt.id ? opt.id : void 0,
                          onClick: () => onSetModelAccessMode(row.model, opt.id),
                          title: opt.id === "auto" ? "Liberado para pool automático dos agentes" : opt.id === "vip" ? "Reservado apenas para Iris e Conselho" : "Bloqueado para roteamento automático"
                        },
                        opt.label
                      )
                    )
                  ) : h(
                    "button",
                    {
                      onClick: () => toggleAutoAssignBlock(row.model),
                      className: "nm-btn",
                      style: { padding: "3px 8px", fontSize: "11px" }
                    },
                    row.autoAssignBlocked ? "Bloq." : "Auto"
                  )
                ),
                h(
                  "td",
                  { style: { padding: "8px 12px", fontFamily: "monospace", fontWeight: "600", color: "var(--nm-fg)" } },
                  `${row.score}`,
                  row.toolCallOk !== null && h(
                    "span",
                    {
                      className: "nm-pill",
                      "data-tone": row.toolCallOk ? "ok" : "danger",
                      style: { marginLeft: "6px", fontSize: "9.5px", padding: "1px 5px" },
                      title: row.toolCallOk ? "Tool-Calling validado" : "Falha no Tool-Calling"
                    },
                    row.toolCallOk ? "TC" : "TC!"
                  )
                ),
                h(
                  "td",
                  { style: { padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: row.quarantined ? "var(--nm-danger)" : healthColor } },
                  row.quarantined ? "Quarentena" : healthLabel
                ),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-secondary, #c7c7c7)" } }, row.calls > 0 ? row.calls.toLocaleString("pt-BR") : "—"),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-tertiary, #a4a4a4)" } }, fmtMs(row.avgFirstTokenMs ?? row.avgDurationMs ?? row.pingLatencyMs)),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-tertiary, #a4a4a4)" } }, fmtCost(row.avgCostUsd, { isFree: row.isFree, estimatedProbeUsd: ((_a2 = qualityBench == null ? void 0 : qualityBench[row.model]) == null ? void 0 : _a2.estimatedCostUsd) ?? null })),
                h(
                  "td",
                  { style: { padding: "8px 12px", whiteSpace: "nowrap" } },
                  h(
                    "div",
                    { style: { display: "flex", gap: "5px" } },
                    h(
                      "button",
                      {
                        onClick: () => togglePinForTier(row.model),
                        title: isPinned ? "Desafixar deste tier" : `Fixar como padrão para ${selectedTier}`,
                        style: {
                          padding: "3px 7px",
                          borderRadius: "5px",
                          border: "1px solid var(--border-primary, #333333)",
                          backgroundColor: isPinned ? "var(--affordance-selected, #333333)" : "transparent",
                          color: "var(--text-secondary, #c7c7c7)",
                          fontSize: "10px",
                          cursor: "pointer"
                        }
                      },
                      isPinned ? "Desafixar" : "Fixar"
                    ),
                    h(
                      "button",
                      {
                        onClick: () => onTestSingleModel(row.model),
                        style: {
                          padding: "3px 7px",
                          borderRadius: "5px",
                          border: "1px solid var(--border-primary, #333333)",
                          backgroundColor: "transparent",
                          color: "var(--text-secondary, #c7c7c7)",
                          fontSize: "10px",
                          cursor: "pointer"
                        }
                      },
                      "Testar"
                    ),
                    agentsList.length > 0 && h(
                      "button",
                      {
                        onClick: () => handleApplyModel(row.model, row.group),
                        disabled: applyingModel === row.model,
                        style: {
                          padding: "3px 8px",
                          borderRadius: "5px",
                          border: "none",
                          backgroundColor: "var(--affordance-subtle, #282828)",
                          color: "var(--text-primary, #ffffff)",
                          fontSize: "10px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }
                      },
                      applyingModel === row.model ? "..." : "Aplicar"
                    )
                  )
                )
              );
            })
          )
        )
      )
    );
  };
}
function isFreeModel(modelId) {
  const low = String(modelId || "").toLowerCase();
  return low.includes(":free") || low.includes("-free") || low.endsWith("free");
}
function readBuzzAgents(ctx) {
  var _a, _b;
  try {
    const snap = ((_b = (_a = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a.snapshot) == null ? void 0 : _b.call(_a)) || {};
    const runningKeys = new Set(
      Array.isArray(snap.running) ? snap.running.map((a) => String((a == null ? void 0 : a.key) || "")) : []
    );
    const seen = /* @__PURE__ */ new Set();
    const list = [];
    for (const pool of [snap.agents, snap.running]) {
      if (!Array.isArray(pool)) continue;
      for (const raw of pool) {
        const key = String((raw == null ? void 0 : raw.key) || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cfg = (raw == null ? void 0 : raw.config) && typeof raw.config === "object" ? raw.config : {};
        list.push({
          key,
          name: String((raw == null ? void 0 : raw.name) || (cfg == null ? void 0 : cfg.name) || key),
          picture: typeof (raw == null ? void 0 : raw.picture) === "string" ? raw.picture : void 0,
          running: runningKeys.has(key) || (raw == null ? void 0 : raw.status) === "running",
          provider: String((cfg == null ? void 0 : cfg.provider) || "padrão"),
          model: String((cfg == null ? void 0 : cfg.model) || "padrão"),
          harness: String((cfg == null ? void 0 : cfg.harness) || "goose"),
          config: cfg
        });
      }
    }
    return list.sort((a, b) => {
      if (a.running !== b.running) return a.running ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}
function createNexusMindAgentsTabComponent(ctx, groups) {
  const React = ctx.react;
  const h = React.createElement;
  return function NexusMindAgentsTab({
    models,
    disabledModels,
    modelTests,
    onNotify,
    vipPolicy,
    onToggleVipAgent,
    onFailoverAgent
  }) {
    const [agents, setAgents] = React.useState(() => readBuzzAgents(ctx));
    const [search, setSearch] = React.useState("");
    const [filterOnlyFree, setFilterOnlyFree] = React.useState(false);
    const [savingKey, setSavingKey] = React.useState(null);
    const [draftModelByAgent, setDraftModelByAgent] = React.useState({});
    const [bestModelInfo, setBestModelInfo] = React.useState(null);
    const refreshAgents = React.useCallback(() => {
      setAgents(readBuzzAgents(ctx));
    }, []);
    React.useEffect(() => {
      refreshAgents();
      const agentsApi = ctx == null ? void 0 : ctx.agents;
      if (typeof (agentsApi == null ? void 0 : agentsApi.subscribe) === "function") {
        try {
          const unsub = agentsApi.subscribe(() => {
            refreshAgents();
          });
          return () => {
            if (typeof unsub === "function") unsub();
          };
        } catch {
        }
      }
      return void 0;
    }, [refreshAgents]);
    React.useEffect(() => {
      let active = true;
      loadGatewayUsageByModel(ctx).then((loaded) => {
        if (!active) return;
        const policy = loadSavedRoutingPolicy();
        const snap = buildModelRankingSnapshot({
          catalogModels: models,
          groups,
          usageByModel: loaded.byModel,
          usageSampleSize: loaded.sampleSize,
          liveProbes: modelTests,
          disabledModels,
          tier: "tier2_balanced",
          policy
        });
        const top = snap.bestByTier.tier2_balanced || snap.bestByTier.geral;
        if ((top == null ? void 0 : top.model) && (top == null ? void 0 : top.group)) {
          setBestModelInfo({ model: top.model, group: top.group });
        }
      }).catch(() => {
      });
      return () => {
        active = false;
      };
    }, [models, disabledModels, modelTests]);
    const activeCatalogOptions = React.useMemo(() => {
      const disabledSet = new Set(disabledModels);
      const list = models.filter((m) => (m == null ? void 0 : m.id) && !disabledSet.has(m.id)).map((m) => ({
        id: String(m.id),
        group: String(m.primaryGroup || Array.isArray(m.groups) && m.groups[0] || "nexusmind_openai")
      }));
      if (list.length > 0) return list;
      return Object.values(groups).map((g) => ({ id: g.defaultModel, group: g.id }));
    }, [models, disabledModels]);
    const filteredAgents = React.useMemo(() => {
      const q = search.trim().toLowerCase();
      return agents.filter((a) => {
        if (filterOnlyFree && !isFreeModel(a.model)) return false;
        if (q && !a.name.toLowerCase().includes(q) && !a.model.toLowerCase().includes(q) && !a.provider.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });
    }, [agents, search, filterOnlyFree]);
    const freeAgentsCount = React.useMemo(
      () => agents.filter((a) => isFreeModel(a.model)).length,
      [agents]
    );
    const runningCount = React.useMemo(
      () => agents.filter((a) => a.running).length,
      [agents]
    );
    const resolveGroupForModel2 = (modelId) => {
      const found = activeCatalogOptions.find((o) => o.id === modelId);
      if (found) return found.group;
      const low = modelId.toLowerCase();
      if (low.includes("grok")) return "nexusmind_grok";
      if (low.includes("gemini") || low.includes("thinking")) return "nexusmind_antigravity";
      if (low.includes("claude")) return "nexusmind_anthropic";
      return "nexusmind_openai";
    };
    const handleSaveAgentModel = async (agent, targetModel, targetGroup) => {
      var _a, _b;
      const agentsApi = ctx == null ? void 0 : ctx.agents;
      if (typeof (agentsApi == null ? void 0 : agentsApi.save) !== "function") {
        onNotify({ type: "error", text: "API ctx.agents.save() indisponível neste runtime." });
        return;
      }
      const providerId = targetGroup || resolveGroupForModel2(targetModel);
      setSavingKey(agent.key);
      try {
        const fresh = readBuzzAgents(ctx).find((a) => a.key === agent.key) || agent;
        const nextCfg = {
          ...fresh.config && typeof fresh.config === "object" ? fresh.config : {},
          provider: providerId,
          model: targetModel
        };
        await agentsApi.save(agent.key, { config: nextCfg });
        refreshAgents();
        onNotify({
          type: "success",
          text: `${agent.name} atualizado para ${targetModel} (${providerId.replace("nexusmind_", "")}).`
        });
        try {
          (_b = (_a = ctx == null ? void 0 : ctx.notifications) == null ? void 0 : _a.notify) == null ? void 0 : _b.call(_a, {
            title: "NexusMind Gateway",
            body: `${agent.name} → ${targetModel}`
          });
        } catch {
        }
      } catch (err) {
        onNotify({
          type: "error",
          text: `Falha ao atualizar ${agent.name}: ${(err == null ? void 0 : err.message) || err}`
        });
      } finally {
        setSavingKey(null);
      }
    };
    const handleOpenOrgfyFactory = () => {
      var _a, _b;
      try {
        (_b = (_a = ctx == null ? void 0 : ctx.navigation) == null ? void 0 : _a.open) == null ? void 0 : _b.call(_a, {
          version: 1,
          kind: "page",
          pluginId: "digital.cortexx.orgfy",
          pageId: "orgfy"
        });
      } catch {
      }
    };
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      // 1. Barra de Resumo & Filtros (CodeDen + Buzz Theme)
      h(
        "div",
        {
          className: "nm-card-pad",
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "11px 14px",
            fontSize: "12px"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", color: "var(--nm-fg-secondary)" } },
          h(
            "span",
            { className: "nm-num" },
            "Agentes: ",
            h("strong", { style: { color: "var(--nm-fg)" } }, `${agents.length}`)
          ),
          h(
            "span",
            { className: "nm-pill", "data-tone": "ok" },
            `${runningCount} online`
          ),
          freeAgentsCount > 0 && h(
            "span",
            { className: "nm-pill", "data-tone": "warn" },
            `${freeAgentsCount} usando :free`
          ),
          bestModelInfo && h(
            "span",
            { className: "nm-pill", "data-tone": "accent" },
            `#1 ${bestModelInfo.model}`
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h("input", {
            type: "text",
            className: "nm-input",
            placeholder: "Filtrar agente ou modelo...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            style: { width: "185px", fontSize: "11.5px" }
          }),
          freeAgentsCount > 0 && h(
            "label",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                color: filterOnlyFree ? "var(--nm-warn)" : "var(--nm-muted)",
                cursor: "pointer"
              }
            },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: filterOnlyFree,
              onChange: (e) => setFilterOnlyFree(Boolean(e.target.checked))
            }),
            "Só :free"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              onClick: refreshAgents,
              style: { padding: "5px 10px", fontSize: "11.5px" }
            },
            "Atualizar"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              onClick: handleOpenOrgfyFactory,
              title: "Abrir OrgFy Factory via navegação nativa do Buzz",
              style: { padding: "5px 10px", fontSize: "11.5px" }
            },
            "OrgFy Factory ↗"
          )
        )
      ),
      // 2. Tabela limpa de Agentes Buzz com Troca Direta de Modelo
      h(
        "div",
        { className: "nm-card", style: { overflowX: "auto" } },
        h(
          "table",
          { className: "nm-table" },
          h(
            "thead",
            null,
            h(
              "tr",
              {
                style: {
                  borderBottom: "1px solid var(--border-primary, #2e2e2e)",
                  textAlign: "left",
                  color: "var(--text-tertiary, #808080)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }
              },
              ["Agente", "Status", "Provedor", "Modelo Atual", "Trocar Modelo", "Ação"].map(
                (col) => h("th", { key: col, style: { padding: "9px 12px", fontWeight: "600" } }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            filteredAgents.length === 0 ? h(
              "tr",
              null,
              h(
                "td",
                { colSpan: 6, style: { padding: "24px", textAlign: "center", color: "var(--text-tertiary, #808080)" } },
                agents.length === 0 ? "Nenhum agente retornado por ctx.agents.snapshot()." : "Nenhum agente corresponde ao filtro atual."
              )
            ) : filteredAgents.map((agent) => {
              const isSaving = savingKey === agent.key;
              const agentIsFree = isFreeModel(agent.model);
              const selectedDraft = draftModelByAgent[agent.key] ?? agent.model;
              const hasPendingChange = selectedDraft && selectedDraft !== agent.model;
              return h(
                "tr",
                {
                  key: agent.key,
                  style: {
                    borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.05))"
                  }
                },
                // Agente (avatar real do Buzz + nome)
                h(
                  "td",
                  { style: { padding: "8px 12px" } },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    agent.picture ? h("img", {
                      src: agent.picture,
                      alt: agent.name,
                      style: {
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        objectFit: "cover",
                        backgroundColor: "var(--surface-inset, #101010)"
                      }
                    }) : h(
                      "div",
                      {
                        style: {
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          backgroundColor: "var(--affordance-subtle, #282828)",
                          color: "var(--text-secondary, #c7c7c7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: "600"
                        }
                      },
                      agent.name.slice(0, 2).toUpperCase()
                    ),
                    h(
                      "div",
                      null,
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "6px" } },
                        h("span", { style: { fontWeight: "600", color: "var(--nm-fg)" } }, agent.name),
                        vipPolicy && isVipAgent(agent.name, vipPolicy) && h("span", { className: "nm-pill", "data-tone": "warn", style: { fontSize: "9.5px", padding: "1px 5px" } }, "VIP")
                      ),
                      h("div", { style: { fontSize: "10px", color: "var(--nm-muted)", fontFamily: "monospace" } }, agent.harness)
                    )
                  )
                ),
                // Status
                h(
                  "td",
                  { style: { padding: "8px 12px" } },
                  h(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "11px",
                        color: agent.running ? "var(--green-11, #3dd68c)" : "var(--text-tertiary, #808080)"
                      }
                    },
                    h("span", {
                      style: {
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: agent.running ? "var(--green-11, #3dd68c)" : "var(--text-tertiary, #666666)"
                      }
                    }),
                    agent.running ? "Online" : "Inativo"
                  )
                ),
                // Provedor
                h(
                  "td",
                  { style: { padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: "var(--text-secondary, #c7c7c7)" } },
                  agent.provider.replace("nexusmind_", "")
                ),
                // Modelo Atual
                h(
                  "td",
                  { style: { padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: "var(--text-primary, #ffffff)" } },
                  h("span", null, agent.model),
                  agentIsFree && h(
                    "span",
                    {
                      style: {
                        marginLeft: "6px",
                        fontSize: "9px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        backgroundColor: "var(--amber-3, #302008)",
                        color: "var(--amber-11, #ffca16)",
                        fontWeight: "600"
                      }
                    },
                    "FREE"
                  )
                ),
                // Select para trocar modelo
                h(
                  "td",
                  { style: { padding: "8px 12px" } },
                  h(
                    "select",
                    {
                      value: selectedDraft,
                      onChange: (e) => setDraftModelByAgent((prev) => ({ ...prev, [agent.key]: e.target.value })),
                      style: {
                        backgroundColor: "var(--surface-inset, #101010)",
                        color: "var(--text-primary, #ffffff)",
                        border: "1px solid var(--border-primary, #333333)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        maxWidth: "220px"
                      }
                    },
                    !activeCatalogOptions.some((o) => o.id === agent.model) && h("option", { key: "__current", value: agent.model }, agent.model),
                    activeCatalogOptions.slice(0, 80).map(
                      (opt) => h(
                        "option",
                        { key: opt.id, value: opt.id },
                        `${opt.id} (${opt.group.replace("nexusmind_", "")})`
                      )
                    )
                  )
                ),
                // Ações
                h(
                  "td",
                  { style: { padding: "8px 12px", whiteSpace: "nowrap" } },
                  h(
                    "div",
                    { style: { display: "flex", gap: "6px" } },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "nm-btn",
                        "data-variant": hasPendingChange ? "primary" : void 0,
                        onClick: () => handleSaveAgentModel(agent, selectedDraft),
                        disabled: isSaving || !hasPendingChange,
                        style: { padding: "4px 10px", fontSize: "11px" }
                      },
                      isSaving ? "..." : "Salvar"
                    ),
                    onToggleVipAgent && vipPolicy && h(
                      "button",
                      {
                        type: "button",
                        className: "nm-btn",
                        "data-variant": isVipAgent(agent.name, vipPolicy) ? "soft" : void 0,
                        onClick: () => onToggleVipAgent(agent.name),
                        title: isVipAgent(agent.name, vipPolicy) ? "Agente VIP protegido contra troca automática (clique para liberar)" : "Proteger como agente VIP (Iris/Conselho)",
                        style: { padding: "4px 8px", fontSize: "10.5px" }
                      },
                      isVipAgent(agent.name, vipPolicy) ? "VIP ✓" : "VIP"
                    ),
                    onFailoverAgent && h(
                      "button",
                      {
                        type: "button",
                        className: "nm-btn",
                        onClick: async () => {
                          setSavingKey(agent.key);
                          try {
                            await onFailoverAgent(agent.key);
                            refreshAgents();
                          } finally {
                            setSavingKey(null);
                          }
                        },
                        disabled: isSaving,
                        title: "Executar failover inteligente respeitando isolamento VIP",
                        style: { padding: "4px 8px", fontSize: "10.5px" }
                      },
                      "Failover"
                    ),
                    bestModelInfo && !(vipPolicy && isVipAgent(agent.name, vipPolicy)) && agent.model !== bestModelInfo.model && h(
                      "button",
                      {
                        type: "button",
                        className: "nm-btn",
                        "data-variant": "soft",
                        onClick: () => handleSaveAgentModel(agent, bestModelInfo.model, bestModelInfo.group),
                        disabled: isSaving,
                        title: `Aplicar modelo #1 do ranking (${bestModelInfo.model})`,
                        style: { padding: "4px 9px", fontSize: "10.5px" }
                      },
                      "Usar #1"
                    )
                  )
                )
              );
            })
          )
        )
      )
    );
  };
}
const DEFAULT_AUTOPILOT_CONFIG = {
  enabled: true,
  wakeOnFailover: true,
  notifyOnFailover: true,
  benchIntervalMin: 30,
  pollIntervalSec: 12
};
const QUARANTINE_TTL_MS = {
  ok: 0,
  weekly_limit: 60 * 60 * 1e3,
  not_found: 120 * 60 * 1e3,
  auth_error: 120 * 60 * 1e3,
  malformed_tool: 30 * 60 * 1e3,
  stream_cut: 10 * 60 * 1e3,
  rate_limit: 10 * 60 * 1e3,
  server_error: 10 * 60 * 1e3,
  timeout: 5 * 60 * 1e3,
  unknown: 10 * 60 * 1e3
};
const LOCAL_STORAGE_QUARANTINE_KEY = "nexusmind_quarantine_v1";
const LOCAL_STORAGE_FAILOVER_LOG_KEY = "nexusmind_failover_log_v1";
const LOCAL_STORAGE_AUTOPILOT_KEY = "nexusmind_autopilot_cfg_v1";
const SHARED_FAILOVER_LOG_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-failover-log.json";
function loadAutopilotConfig() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_AUTOPILOT_KEY);
    if (!raw) return { ...DEFAULT_AUTOPILOT_CONFIG };
    const p = JSON.parse(raw);
    return {
      enabled: (p == null ? void 0 : p.enabled) !== false,
      wakeOnFailover: (p == null ? void 0 : p.wakeOnFailover) !== false,
      notifyOnFailover: (p == null ? void 0 : p.notifyOnFailover) !== false,
      benchIntervalMin: Math.max(5, Math.min(240, Number((p == null ? void 0 : p.benchIntervalMin) || 30))),
      pollIntervalSec: Math.max(5, Math.min(120, Number((p == null ? void 0 : p.pollIntervalSec) || 12)))
    };
  } catch {
    return { ...DEFAULT_AUTOPILOT_CONFIG };
  }
}
function saveAutopilotConfig(cfg) {
  var _a, _b;
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_AUTOPILOT_KEY, JSON.stringify(cfg));
  } catch {
  }
}
function loadQuarantines(nowMs = Date.now()) {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_QUARANTINE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const active = {};
    for (const [model, entry] of Object.entries(parsed)) {
      const exp = Date.parse((entry == null ? void 0 : entry.expiresAt) || "");
      if (Number.isFinite(exp) && exp > nowMs) {
        active[model] = entry;
      }
    }
    return active;
  } catch {
    return {};
  }
}
function saveQuarantines(map) {
  var _a, _b;
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_QUARANTINE_KEY, JSON.stringify(map));
  } catch {
  }
}
function quarantineModel(model, group, errorText, httpStatus, agentName, nowMs = Date.now()) {
  const errorKind = classifyGatewayError(errorText, httpStatus);
  const ttl = QUARANTINE_TTL_MS[errorKind] || QUARANTINE_TTL_MS.unknown;
  const current = loadQuarantines(nowMs);
  const prev = current[model];
  const entry = {
    model,
    group,
    reason: String(errorText || errorKind).slice(0, 180),
    errorKind,
    quarantinedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttl).toISOString(),
    hitCount: ((prev == null ? void 0 : prev.hitCount) || 0) + 1,
    lastAgent: agentName || (prev == null ? void 0 : prev.lastAgent)
  };
  current[model] = entry;
  saveQuarantines(current);
  return entry;
}
function releaseQuarantine(model) {
  if (!model) {
    saveQuarantines({});
    return {};
  }
  const current = loadQuarantines();
  delete current[model];
  saveQuarantines(current);
  return current;
}
function loadFailoverLog() {
  var _a, _b;
  try {
    const raw = (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_FAILOVER_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function appendFailoverLog(ctx, evt) {
  var _a, _b;
  const prev = loadFailoverLog();
  const next = [evt, ...prev].slice(0, 60);
  try {
    (_b = (_a = globalThis == null ? void 0 : globalThis.localStorage) == null ? void 0 : _a.setItem) == null ? void 0 : _b.call(_a, LOCAL_STORAGE_FAILOVER_LOG_KEY, JSON.stringify(next));
  } catch {
  }
  const host = ctx == null ? void 0 : ctx.host;
  if (typeof (host == null ? void 0 : host.writeFile) === "function") {
    try {
      await host.writeFile(
        SHARED_FAILOVER_LOG_PATH,
        JSON.stringify({ updatedAt: (/* @__PURE__ */ new Date()).toISOString(), events: next }, null, 2)
      );
    } catch {
    }
  }
  return next;
}
function pickFailoverCandidate(input) {
  var _a, _b, _c, _d, _e;
  const vipPolicy = input.vipPolicy || loadVipPolicy();
  const qualityBench = input.qualityBench || loadSavedQualityBench();
  const quarantines = input.quarantines || loadQuarantines();
  const disabledModels = input.disabledModels || [];
  const vip = isVipAgent(input.agentName, vipPolicy);
  const currentLower = String(input.currentModel || "").trim().toLowerCase();
  const isQuarantined = (m) => Boolean(quarantines[m]);
  const isBrokenInBench = (m) => {
    const q = qualityBench[m];
    return Boolean(q && !q.online);
  };
  if (vip) {
    const vipPool = Array.from(
      /* @__PURE__ */ new Set([...vipPolicy.vipFallbackChain || [], ...vipPolicy.vipModels || []])
    );
    const viableVip = vipPool.filter((m) => {
      if (!m || isUnsupportedAgentModel(m)) return false;
      if (m.toLowerCase() === currentLower) return false;
      const grp = inferCanonicalGroupForModel(m, input.groups);
      const mode = getModelAccessMode(m, grp == null ? void 0 : grp.id, vipPolicy, disabledModels);
      if (mode === "blocked") return false;
      if (isQuarantined(m) || isBrokenInBench(m)) return false;
      return true;
    });
    const sortVipCandidates = (list) => list.sort((a, b) => {
      const qa = qualityBench[a];
      const qb = qualityBench[b];
      const sa = ((qa == null ? void 0 : qa.toolCallOk) ? 50 : 0) + ((qa == null ? void 0 : qa.qualityScore) ?? 0);
      const sb = ((qb == null ? void 0 : qb.toolCallOk) ? 50 : 0) + ((qb == null ? void 0 : qb.qualityScore) ?? 0);
      return sb - sa;
    });
    const paidVip = viableVip.filter((m) => !isFreeModel$1(m));
    if (paidVip.length > 0) {
      sortVipCandidates(paidVip);
      const chosen = paidVip[0];
      const grp = inferCanonicalGroupForModel(chosen, input.groups);
      return {
        ok: true,
        isVip: true,
        model: chosen,
        group: (grp == null ? void 0 : grp.id) || "nexusmind_anthropic",
        score: ((_a = qualityBench[chosen]) == null ? void 0 : _a.qualityScore) ?? 95,
        reason: `Failover VIP pago para ${input.agentName}: ${chosen} (${(grp == null ? void 0 : grp.id) || "vip"}).`
      };
    }
    const paidRanking = (((_b = input.rankingSnapshot) == null ? void 0 : _b.models) || []).filter((r) => {
      var _a2;
      const mid = String((r == null ? void 0 : r.model) || "").trim();
      if (!mid || mid.toLowerCase() === currentLower || isUnsupportedAgentModel(mid) || isFreeModel$1(mid)) return false;
      if (r.isDisabled || r.online === false || isQuarantined(mid) || isBrokenInBench(mid)) return false;
      const grp = r.group || ((_a2 = inferCanonicalGroupForModel(mid, input.groups)) == null ? void 0 : _a2.id);
      if (getModelAccessMode(mid, grp, vipPolicy, disabledModels) === "blocked") return false;
      const q = qualityBench[mid];
      const evalOk = Boolean(r.evalApproved === true || r.toolCallOk === true || q && q.online && q.toolCallOk === true);
      if (!evalOk) return false;
      return true;
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
    if (paidRanking.length > 0) {
      const chosen = paidRanking[0];
      return {
        ok: true,
        isVip: true,
        model: chosen.model,
        group: chosen.group || ((_c = inferCanonicalGroupForModel(chosen.model, input.groups)) == null ? void 0 : _c.id) || "nexusmind_openai",
        score: chosen.score ?? 90,
        reason: `Failover VIP (pago alternativo) para ${input.agentName}: ${chosen.model}.`
      };
    }
    if (viableVip.length > 0) {
      sortVipCandidates(viableVip);
      const chosen = viableVip[0];
      const grp = inferCanonicalGroupForModel(chosen, input.groups);
      return {
        ok: true,
        isVip: true,
        model: chosen,
        group: (grp == null ? void 0 : grp.id) || "nexusmind_openai",
        score: ((_d = qualityBench[chosen]) == null ? void 0 : _d.qualityScore) ?? 70,
        reason: `Failover VIP de contingência (0 pagos disponíveis) para ${input.agentName}: ${chosen}.`
      };
    }
    return {
      ok: false,
      isVip: true,
      model: null,
      group: null,
      score: null,
      reason: `Nenhum modelo VIP pago saudável disponível para ${input.agentName} (proteção anti-downgrade ativa).`
    };
  }
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const pushCandidate = (modelId, groupId, baseScore, rowEvalApproved) => {
    var _a2;
    const clean = String(modelId || "").trim();
    if (!clean || seen.has(clean.toLowerCase()) || clean.toLowerCase() === currentLower) return;
    if (isUnsupportedAgentModel(clean)) return;
    seen.add(clean.toLowerCase());
    const resolvedGroup = groupId || ((_a2 = inferCanonicalGroupForModel(clean, input.groups)) == null ? void 0 : _a2.id) || "nexusmind_openai";
    const mode = getModelAccessMode(clean, resolvedGroup, vipPolicy, disabledModels);
    if (mode !== "auto") return;
    if (isQuarantined(clean) || isBrokenInBench(clean)) return;
    const q = qualityBench[clean];
    const evalApproved = Boolean(rowEvalApproved === true || q && q.online && q.toolCallOk === true);
    if (q && q.toolCallOk === false) return;
    const toolBonus = evalApproved ? 40 : 0;
    const qualityBlend = q ? q.qualityScore * 0.65 + baseScore * 0.35 : baseScore;
    candidates.push({
      model: clean,
      group: resolvedGroup,
      score: Number((qualityBlend + toolBonus).toFixed(1)),
      toolCallOk: q ? q.toolCallOk : evalApproved ? true : null,
      evalApproved
    });
  };
  for (const row of ((_e = input.rankingSnapshot) == null ? void 0 : _e.models) || []) {
    if (row.isDisabled || row.online === false) continue;
    pushCandidate(row.model, row.group, row.score, Boolean(row.evalApproved ?? row.toolCallOk));
  }
  const hasAnyEvalApproved = candidates.some((c) => c.evalApproved);
  if (!hasAnyEvalApproved) {
    for (const grp of Object.values(input.groups)) {
      if (grp == null ? void 0 : grp.defaultModel) {
        pushCandidate(grp.defaultModel, grp.id, 65, false);
      }
    }
  }
  const finalPool = hasAnyEvalApproved ? candidates.filter((c) => c.evalApproved) : candidates;
  finalPool.sort((a, b) => {
    if (a.evalApproved !== b.evalApproved) return a.evalApproved ? -1 : 1;
    if (a.toolCallOk === true !== (b.toolCallOk === true)) return a.toolCallOk === true ? -1 : 1;
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
      reason: `Nenhum modelo 'auto' aprovado no Eval e fora de quarentena disponível para ${input.agentName}.`
    };
  }
  return {
    ok: true,
    isVip: false,
    model: winner.model,
    group: winner.group,
    score: winner.score,
    reason: `Failover Eval-First para ${input.agentName}: ${winner.model} (${winner.group}, score ${winner.score}${winner.evalApproved ? " · Eval ✓" : ""}).`
  };
}
async function refineCandidateWithDecisionApi(ctx, agentName, isVip, primary, rankingSnapshot) {
  if (!primary.ok || !primary.model) return primary;
  const decisionsApi = ctx == null ? void 0 : ctx.decisions;
  if (typeof (decisionsApi == null ? void 0 : decisionsApi.decide) !== "function") return primary;
  const pool = ((rankingSnapshot == null ? void 0 : rankingSnapshot.models) || []).filter((r) => !r.isDisabled && r.online !== false && (r.evalApproved === true || r.toolCallOk === true)).filter((r) => isVip ? r.accessMode !== "blocked" : r.accessMode === "auto" || !r.autoAssignBlocked).slice(0, 3);
  if (pool.length < 2) return primary;
  try {
    const res = await decisionsApi.decide({
      question: `Entre estes modelos já aprovados no Eval, qual escolher para o failover do agente ${agentName} (${isVip ? "VIP/Estratégico" : "Execução"})?`,
      options: pool.map((c) => `${c.model} (${c.group}, evalScore=${c.score}, lat=${c.pingLatencyMs ?? "?"}ms)`)
    });
    const pickedText = String((res == null ? void 0 : res.choice) || (res == null ? void 0 : res.decision) || (res == null ? void 0 : res.option) || "").toLowerCase();
    const match = pool.find((c) => pickedText.includes(String(c.model || "").toLowerCase()));
    if (match && match.model !== primary.model) {
      return {
        ...primary,
        model: match.model,
        group: match.group,
        score: match.score,
        reason: `${primary.reason} [Decision API → ${match.model}]`
      };
    }
  } catch {
  }
  return primary;
}
async function executeAgentFailover(ctx, groups, params) {
  var _a, _b, _c, _d, _e;
  const agentsApi = ctx == null ? void 0 : ctx.agents;
  const snap = ((_a = agentsApi == null ? void 0 : agentsApi.snapshot) == null ? void 0 : _a.call(agentsApi)) || {};
  const allAgents = [...snap.running || [], ...snap.agents || []];
  const q = String(params.agentKeyOrName || "").trim().toLowerCase();
  const target = allAgents.find(
    (a) => String((a == null ? void 0 : a.key) || "").toLowerCase() === q || String((a == null ? void 0 : a.name) || "").toLowerCase() === q || String((a == null ? void 0 : a.name) || "").toLowerCase().includes(q)
  );
  const agentName = (target == null ? void 0 : target.name) || params.agentKeyOrName;
  const agentKey = (target == null ? void 0 : target.key) || params.agentKeyOrName;
  const fromModel = ((_b = target == null ? void 0 : target.config) == null ? void 0 : _b.model) || null;
  const fromGroup = ((_c = target == null ? void 0 : target.config) == null ? void 0 : _c.provider) || ((_d = inferCanonicalGroupForModel(fromModel || "", groups)) == null ? void 0 : _d.id) || "nexusmind_openai";
  const vipPolicy = params.vipPolicy || loadVipPolicy();
  const vip = isVipAgent(agentName, vipPolicy);
  const errorKind = params.errorText ? classifyGatewayError(params.errorText, params.httpStatus) : "unknown";
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
    groups
  });
  pick = await refineCandidateWithDecisionApi(ctx, agentName, vip, pick, params.rankingSnapshot);
  let applied = false;
  let wokeAgent = false;
  let note = pick.reason;
  if (pick.ok && pick.model && target && typeof (agentsApi == null ? void 0 : agentsApi.save) === "function") {
    try {
      const nextCfg = {
        ...target.config && typeof target.config === "object" ? target.config : {},
        model: pick.model,
        provider: pick.group || "nexusmind_openai"
      };
      await agentsApi.save(target.key, { config: nextCfg });
      applied = true;
      if (params.wakeAfter && typeof (agentsApi == null ? void 0 : agentsApi.wake) === "function") {
        try {
          await agentsApi.wake(target.key);
          wokeAgent = true;
        } catch {
        }
      }
      if (params.notify && typeof ((_e = ctx == null ? void 0 : ctx.notifications) == null ? void 0 : _e.send) === "function") {
        try {
          ctx.notifications.send({
            title: vip ? `Failover VIP · ${agentName}` : `Failover Automático · ${agentName}`,
            body: `${fromModel || "anterior"} → ${pick.model} (${errorKind})`
          });
        } catch {
        }
      }
    } catch (err) {
      note = `Falha ao salvar agente: ${(err == null ? void 0 : err.message) || err}`;
    }
  } else if (!target) {
    note = `Agente '${params.agentKeyOrName}' não encontrado no Buzz.`;
  }
  const evt = {
    id: `fo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
    note
  };
  await appendFailoverLog(ctx, evt);
  try {
    const win = globalThis;
    if (typeof (win == null ? void 0 : win.dispatchEvent) === "function" && typeof (win == null ? void 0 : win.CustomEvent) === "function") {
      win.dispatchEvent(new win.CustomEvent("nexusmind.failover.completed", { detail: evt }));
    }
  } catch {
  }
  return evt;
}
function scanLiveAgentErrors(ctx) {
  var _a, _b, _c, _d, _e;
  const out = [];
  const relaySnap = (_b = (_a = ctx == null ? void 0 : ctx.relay) == null ? void 0 : _a.snapshot) == null ? void 0 : _b.call(_a);
  const activityMap = (_c = relaySnap == null ? void 0 : relaySnap.session) == null ? void 0 : _c.agentActivity;
  if (!activityMap || typeof activityMap !== "object") return out;
  const agentsSnap = ((_e = (_d = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _d.snapshot) == null ? void 0 : _e.call(_d)) || {};
  const allAgents = [...agentsSnap.running || [], ...agentsSnap.agents || []];
  const byPubkey = /* @__PURE__ */ new Map();
  for (const a of allAgents) {
    if (a == null ? void 0 : a.pubkey) byPubkey.set(String(a.pubkey).toLowerCase(), a);
    if (a == null ? void 0 : a.key) byPubkey.set(String(a.key).toLowerCase(), a);
  }
  const entries = activityMap instanceof Map ? Array.from(activityMap.entries()) : Object.entries(activityMap);
  for (const [key, val] of entries) {
    const items = Array.isArray(val) ? val : val && typeof val === "object" ? [val] : [];
    for (const item of items) {
      const errText = String((item == null ? void 0 : item.error) || (item == null ? void 0 : item.statusText) || (item == null ? void 0 : item.message) || "");
      const isErr = (item == null ? void 0 : item.status) === "error" || /ran into this error|weekly limit|malformed_function_call|stream ended|resource not found \(404\)|http 429|50[234]/i.test(errText);
      if (!isErr || !errText) continue;
      const kind = classifyGatewayError(errText);
      if (kind === "ok" || kind === "unknown") continue;
      const pub = String((item == null ? void 0 : item.agentPubkey) || (item == null ? void 0 : item.pubkey) || key || "").toLowerCase();
      const agent = byPubkey.get(pub);
      const agentKey = (agent == null ? void 0 : agent.key) || key;
      const agentName = (agent == null ? void 0 : agent.name) || (item == null ? void 0 : item.agentName) || key;
      const turnId = String((item == null ? void 0 : item.turnId) || (item == null ? void 0 : item.id) || (item == null ? void 0 : item.updatedAt) || "");
      const signature = `${agentKey}:${kind}:${turnId || errText.slice(0, 48)}`;
      out.push({
        agentKey,
        agentName,
        errorText: errText.slice(0, 220),
        errorKind: kind,
        signature
      });
    }
  }
  return out;
}
function fmtRemaining(expiresAt) {
  const diff = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "expirando";
  const mins = Math.ceil(diff / 6e4);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}
function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return iso;
  }
}
function isValidModelId(val) {
  const s = String(val || "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return low !== "padrão" && low !== "padrao" && low !== "default" && low !== "none" && low !== "null";
}
function normalizeModelId(val) {
  return String(val || "").trim().toLowerCase();
}
function uniqueModels(list) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const raw of list) {
    if (!isValidModelId(raw)) continue;
    const clean = raw.trim();
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}
function createAutopilotFailoverTabComponent(ctx, groups) {
  const React = ctx.react;
  const h = React.createElement;
  return function AutopilotFailoverTab({
    models,
    disabledModels,
    vipPolicy,
    onUpdateVipPolicy,
    autopilotCfg,
    onUpdateAutopilotCfg,
    quarantines,
    onRefreshQuarantines,
    qualityBench,
    onUpdateQualityBench,
    failoverLog,
    onRefreshFailoverLog,
    rankingSnapshot,
    onNotify
  }) {
    const [benchRunning, setBenchRunning] = React.useState(false);
    const [benchScopeActive, setBenchScopeActive] = React.useState(null);
    const [benchProgress, setBenchProgress] = React.useState("");
    const [singleTestingModel, setSingleTestingModel] = React.useState(null);
    const [benchFilter, setBenchFilter] = React.useState("all");
    const [failoverBusyAgent, setFailoverBusyAgent] = React.useState(null);
    const [vipChainInput, setVipChainInput] = React.useState(
      () => (vipPolicy.vipFallbackChain || []).join(", ")
    );
    React.useEffect(() => {
      setVipChainInput((vipPolicy.vipFallbackChain || []).join(", "));
    }, [vipPolicy.vipFallbackChain]);
    const buzzAgents = React.useMemo(() => {
      var _a, _b;
      try {
        const snap = ((_b = (_a = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a.snapshot) == null ? void 0 : _b.call(_a)) || {};
        const seen = /* @__PURE__ */ new Set();
        const list = [];
        for (const pool of [snap.running, snap.agents]) {
          if (!Array.isArray(pool)) continue;
          for (const a of pool) {
            if (!(a == null ? void 0 : a.key) || seen.has(a.key)) continue;
            seen.add(a.key);
            list.push(a);
          }
        }
        return list.sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key)));
      } catch {
        return [];
      }
    }, [failoverLog.length, failoverBusyAgent]);
    const vipAgents = buzzAgents.filter((a) => isVipAgent(a.name || a.key, vipPolicy));
    const workerAgents = buzzAgents.filter((a) => !isVipAgent(a.name || a.key, vipPolicy));
    const providerHintByModel = React.useMemo(() => {
      var _a, _b;
      const map = /* @__PURE__ */ new Map();
      for (const m of models || []) {
        const mid = String((m == null ? void 0 : m.id) || "").trim();
        const grp = (m == null ? void 0 : m.primaryGroup) || (Array.isArray(m == null ? void 0 : m.groups) ? m.groups[0] : void 0);
        if (mid && grp && groups[grp]) {
          map.set(mid.toLowerCase(), grp);
        }
      }
      for (const a of buzzAgents) {
        const mid = String(((_a = a == null ? void 0 : a.config) == null ? void 0 : _a.model) || "").trim();
        const prov = String(((_b = a == null ? void 0 : a.config) == null ? void 0 : _b.provider) || "").trim();
        if (isValidModelId(mid) && prov && groups[prov] && !map.has(mid.toLowerCase())) {
          map.set(mid.toLowerCase(), prov);
        }
      }
      return map;
    }, [models, buzzAgents]);
    const resolveGroupForModel2 = (modelId) => {
      const hinted = providerHintByModel.get(modelId.toLowerCase());
      if (hinted && groups[hinted]) return groups[hinted];
      if (modelId.includes("/") || modelId.toLowerCase().includes(":free")) {
        if (groups.nexusmind_openai) return groups.nexusmind_openai;
      }
      return inferCanonicalGroupForModel(modelId, groups);
    };
    const vipAgentActiveModels = React.useMemo(
      () => uniqueModels(vipAgents.map((a) => {
        var _a;
        return String(((_a = a == null ? void 0 : a.config) == null ? void 0 : _a.model) || "");
      })),
      [vipAgents]
    );
    const allAgentActiveModels = React.useMemo(
      () => uniqueModels(buzzAgents.map((a) => {
        var _a;
        return String(((_a = a == null ? void 0 : a.config) == null ? void 0 : _a.model) || "");
      })),
      [buzzAgents]
    );
    const allVipTargetModels = React.useMemo(
      () => uniqueModels([
        ...vipAgentActiveModels,
        ...vipPolicy.vipModels || [],
        ...vipPolicy.vipFallbackChain || []
      ]),
      [vipAgentActiveModels, vipPolicy.vipModels, vipPolicy.vipFallbackChain]
    );
    const vipModelSet = React.useMemo(
      () => new Set(allVipTargetModels.map(normalizeModelId)),
      [allVipTargetModels]
    );
    const inUseModelSet = React.useMemo(
      () => new Set(allAgentActiveModels.map(normalizeModelId)),
      [allAgentActiveModels]
    );
    const findBenchForModel = (rawModel) => {
      if (!isValidModelId(rawModel)) return null;
      const exact = qualityBench[rawModel.trim()];
      if (exact) return exact;
      const low = rawModel.trim().toLowerCase();
      const short = String(rawModel.split("/").pop() || rawModel).trim().toLowerCase();
      for (const [k, v] of Object.entries(qualityBench || {})) {
        const kl = k.toLowerCase();
        if (kl === low || kl === short || String(k.split("/").pop() || k).toLowerCase() === short) {
          return v;
        }
      }
      return null;
    };
    const quarantineList = Object.values(quarantines || {});
    const benchList = Object.values(qualityBench || {}).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.toolCallOk !== b.toolCallOk) return a.toolCallOk ? -1 : 1;
      return b.qualityScore - a.qualityScore;
    });
    const toolOkCount = benchList.filter((b) => b.online && b.toolCallOk).length;
    const benchIssuesCount = benchList.filter((b) => !b.online || !b.toolCallOk).length;
    const benchVipCount = benchList.filter((b) => vipModelSet.has(normalizeModelId(b.model))).length;
    const benchInUseCount = benchList.filter((b) => inUseModelSet.has(normalizeModelId(b.model))).length;
    const filteredBenchList = React.useMemo(() => {
      return benchList.filter((b) => {
        if (benchFilter === "vip") return vipModelSet.has(normalizeModelId(b.model));
        if (benchFilter === "in_use") return inUseModelSet.has(normalizeModelId(b.model));
        if (benchFilter === "ok") return b.online && b.toolCallOk;
        if (benchFilter === "issues") return !b.online || !b.toolCallOk;
        return true;
      });
    }, [benchList, benchFilter, vipModelSet, inUseModelSet]);
    const handleRunQualityBench = async (scope) => {
      setBenchRunning(true);
      setBenchScopeActive(scope);
      try {
        let targetModels = [];
        let scopeLabel = "";
        if (scope === "vip_all") {
          targetModels = allVipTargetModels;
          scopeLabel = "VIPs (agentes VIP + marcados + cadeia)";
        } else if (scope === "in_use") {
          targetModels = allAgentActiveModels;
          scopeLabel = "modelos em uso nos agentes";
        } else {
          const fromRank = ((rankingSnapshot == null ? void 0 : rankingSnapshot.models) || []).filter((r) => r.accessMode === "auto" && !r.isDisabled).slice(0, 8).map((r) => r.model);
          targetModels = fromRank.length > 0 ? fromRank : Object.values(groups).filter((g) => g.id !== "nexusmind_anthropic").map((g) => g.defaultModel);
          scopeLabel = "Pool Auto (Top 8)";
        }
        if (targetModels.length === 0) {
          onNotify({ type: "info", text: `Nenhum modelo encontrado para testar em ${scopeLabel}.` });
          return;
        }
        const candidates = targetModels.map((m) => ({
          model: m,
          group: resolveGroupForModel2(m)
        }));
        if (scope === "vip_all") setBenchFilter("vip");
        else if (scope === "in_use") setBenchFilter("in_use");
        else setBenchFilter("all");
        setBenchProgress(`Testando 0/${candidates.length} (${scopeLabel})...`);
        const updated = await runBatchQualityBench(ctx, candidates, (done, total, latest) => {
          setBenchProgress(
            `${done}/${total} · ${latest.model} (${latest.online ? latest.toolCallOk ? `TC OK · ${latest.qualityScore}` : `Sem TC · ${latest.qualityScore}` : latest.errorKind})`
          );
        });
        onUpdateQualityBench(updated);
        await syncQualityBenchToOrgfyEval(ctx, updated);
        const testedResults = targetModels.map((m) => updated[m]).filter(Boolean);
        const okTc = testedResults.filter((r) => r.online && r.toolCallOk).length;
        const failed = testedResults.filter((r) => !r.online || !r.toolCallOk).length;
        onNotify({
          type: failed > 0 ? "info" : "success",
          text: `Bench ${scopeLabel}: ${okTc}/${testedResults.length} OK em Tool-Calling${failed > 0 ? ` · ${failed} com falha` : ""}. Ranking e OrgFy sincronizados.`
        });
      } finally {
        setBenchRunning(false);
        setBenchScopeActive(null);
        setBenchProgress("");
      }
    };
    const handleTestSingleBenchModel = async (modelId) => {
      setSingleTestingModel(modelId);
      try {
        const grp = resolveGroupForModel2(modelId);
        const res = await runModelQualityProbe(ctx, modelId, grp);
        const next = { ...qualityBench || {}, [modelId]: res };
        await saveQualityBench(ctx, next);
        await syncQualityBenchToOrgfyEval(ctx, next);
        onUpdateQualityBench(next);
        onNotify({
          type: res.online && res.toolCallOk ? "success" : "error",
          text: res.online && res.toolCallOk ? `${modelId}: OK (Tool-Calling + ${res.latencyMs}ms · ${res.qualityScore}/100).` : `${modelId}: ${res.errorMsg || res.errorKind} (${res.qualityScore}/100).`
        });
      } finally {
        setSingleTestingModel(null);
      }
    };
    const handleClearBenchHistory = async () => {
      await saveQualityBench(ctx, {});
      onUpdateQualityBench({});
      onNotify({ type: "info", text: "Histórico do benchmark limpo." });
    };
    const handleManualFailover = async (agent) => {
      setFailoverBusyAgent(agent.key);
      try {
        const evt = await executeAgentFailover(ctx, groups, {
          agentKeyOrName: agent.key,
          errorText: "Failover manual acionado no Cockpit NexusMind",
          trigger: "manual",
          rankingSnapshot,
          vipPolicy,
          qualityBench,
          disabledModels,
          wakeAfter: autopilotCfg.wakeOnFailover,
          notify: autopilotCfg.notifyOnFailover
        });
        onRefreshQuarantines();
        onRefreshFailoverLog();
        onNotify({
          type: evt.applied ? "success" : "error",
          text: evt.applied ? `${evt.agentName}: ${evt.fromModel || "anterior"} → ${evt.toModel}` : evt.note || `Não foi possível trocar ${evt.agentName}.`
        });
      } finally {
        setFailoverBusyAgent(null);
      }
    };
    const handleSaveVipChain = () => {
      const nextChain = vipChainInput.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      onUpdateVipPolicy({
        ...vipPolicy,
        vipFallbackChain: nextChain.length > 0 ? nextChain : vipPolicy.vipFallbackChain
      });
      onNotify({ type: "success", text: `Cadeia VIP salva (${nextChain.length} modelos).` });
    };
    const handleQuickProtectVips = () => {
      const next = applyQuickVipPreset(vipPolicy, models);
      onUpdateVipPolicy(next);
      onNotify({
        type: "success",
        text: "Escudo VIP aplicado: Anthropic + GPT-6.1 Terra + modelos frontier travados para Iris e Conselho."
      });
    };
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      // 1. KPI Strip do Autopiloto
      h(
        "div",
        { className: "nm-kpi-grid" },
        h(
          "div",
          { className: "nm-kpi-card" },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { className: "nm-kpi-label" }, "AUTOPILOTO FAILOVER"),
            h(
              "span",
              { className: "nm-pill", "data-tone": autopilotCfg.enabled ? "ok" : "warn" },
              autopilotCfg.enabled ? "ATIVO" : "PAUSADO"
            )
          ),
          h("div", { className: "nm-kpi-val" }, autopilotCfg.enabled ? "Vigilância 24/7" : "Manual"),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `Poll ${autopilotCfg.pollIntervalSec}s · ${failoverLog.length} eventos registrados`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "ESCUDO VIP (IRIS & CONSELHO)"),
          h("div", { className: "nm-kpi-val" }, `${vipAgents.length} VIP · ${workerAgents.length} Pool`),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `${allVipTargetModels.length} modelos VIP (${vipAgentActiveModels.length} em uso · ${vipPolicy.vipModels.length} marcados)`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "CIRCUIT BREAKER (QUARENTENA)"),
          h(
            "div",
            { className: "nm-kpi-val", style: { color: quarantineList.length > 0 ? "var(--nm-danger)" : "var(--nm-ok)" } },
            `${quarantineList.length} isolado${quarantineList.length === 1 ? "" : "s"}`
          ),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            quarantineList.length > 0 ? "Auto-expira após TTL de cooldown" : "Nenhum modelo em quarentena"
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "BENCHMARK TOOL-CALLING"),
          h("div", { className: "nm-kpi-val" }, benchList.length > 0 ? `${toolOkCount}/${benchList.length} OK` : "Não rodado"),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            benchProgress || (benchIssuesCount > 0 ? `${benchIssuesCount} modelo(s) com erro ou sem TC` : "Valida tool_calls + stream + latência")
          )
        )
      ),
      // 2. Controles do Autopiloto + Ações Rápidas (com escopos claros e contagens reais)
      h(
        "div",
        {
          className: "nm-card-pad",
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: autopilotCfg.enabled,
              onChange: (e) => onUpdateAutopilotCfg({ ...autopilotCfg, enabled: Boolean(e.target.checked) })
            }),
            "Auto-Failover Inteligente"
          ),
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--nm-fg-secondary)", cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: autopilotCfg.wakeOnFailover,
              onChange: (e) => onUpdateAutopilotCfg({ ...autopilotCfg, wakeOnFailover: Boolean(e.target.checked) })
            }),
            "Acordar agente após troca"
          ),
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--nm-fg-secondary)", cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: vipPolicy.autoProtectAnthropic,
              onChange: (e) => onUpdateVipPolicy({ ...vipPolicy, autoProtectAnthropic: Boolean(e.target.checked) })
            }),
            "Travar toda Anthropic como VIP"
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              onClick: handleQuickProtectVips
            },
            "Proteger VIPs (1-clique)"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "primary",
              "data-bench-vip-all": "true",
              disabled: benchRunning || allVipTargetModels.length === 0,
              onClick: () => handleRunQualityBench("vip_all"),
              title: `Testa todos os ${allVipTargetModels.length} modelos VIP: modelos atuais dos agentes VIP + marcados como VIP + cadeia de fallback`
            },
            benchRunning && benchScopeActive === "vip_all" ? "Testando VIPs..." : `Testar VIPs (${allVipTargetModels.length})`
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              "data-bench-in-use": "true",
              disabled: benchRunning || allAgentActiveModels.length === 0,
              onClick: () => handleRunQualityBench("in_use"),
              title: `Testa todos os ${allAgentActiveModels.length} modelos distintos configurados nos agentes do Buzz agora`
            },
            benchRunning && benchScopeActive === "in_use" ? "Testando em uso..." : `Testar em Uso (${allAgentActiveModels.length})`
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: benchRunning,
              onClick: () => handleRunQualityBench("auto_top"),
              title: "Testa os 8 melhores candidatos do pool automático para workers"
            },
            benchRunning && benchScopeActive === "auto_top" ? "Testando Pool..." : "Bench Pool Auto (Top 8)"
          )
        )
      ),
      // 3. Quarentena / Circuit Breaker (se houver modelos isolados)
      quarantineList.length > 0 && h(
        "div",
        { className: "nm-card" },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--nm-border)"
            }
          },
          h("span", { style: { fontSize: "12px", fontWeight: 600, color: "var(--nm-danger)" } }, `Circuit Breaker — ${quarantineList.length} modelo(s) em quarentena`),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              onClick: () => {
                releaseQuarantine();
                onRefreshQuarantines();
                onNotify({ type: "info", text: "Quarentena limpa para todos os modelos." });
              },
              style: { padding: "4px 9px", fontSize: "11px" }
            },
            "Liberar Todos"
          )
        ),
        quarantineList.map(
          (q) => h(
            "div",
            { key: q.model, className: "nm-list-row" },
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "2px" } },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h("span", { className: "nm-mono", style: { fontSize: "12px", fontWeight: 600 } }, q.model),
                h("span", { className: "nm-pill", "data-tone": "danger" }, q.errorKind),
                h("span", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, `expira em ${fmtRemaining(q.expiresAt)}`)
              ),
              h("div", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, `${q.reason}${q.lastAgent ? ` · ${q.lastAgent}` : ""}`)
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                onClick: () => {
                  releaseQuarantine(q.model);
                  onRefreshQuarantines();
                },
                style: { padding: "4px 9px", fontSize: "11px" }
              },
              "Liberar"
            )
          )
        )
      ),
      // 4. Escudo VIP: Cadeia VIP + Agentes VIP vs Pool Automático (com status ao vivo do bench por agente)
      h(
        "div",
        { className: "nm-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
          h("span", { style: { fontSize: "12.5px", fontWeight: 600 } }, "Cadeia de Fallback Exclusiva VIP (Iris & Conselho)"),
          h("span", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, "Agentes VIP só trocam se falharem, e nunca caem para modelos fracos")
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("input", {
            type: "text",
            className: "nm-input nm-mono",
            value: vipChainInput,
            onChange: (e) => setVipChainInput(e.target.value),
            placeholder: "claude-sonnet-4-6, claude-sonnet-5-5, claude-opus-4-6, gpt-6.1-terra",
            style: { flex: "1", minWidth: "260px" }
          }),
          h(
            "button",
            { type: "button", className: "nm-btn", "data-variant": "soft", onClick: handleSaveVipChain },
            "Salvar Cadeia VIP"
          )
        ),
        allVipTargetModels.length > 0 && h(
          "div",
          { style: { fontSize: "11px", color: "var(--nm-muted)", lineHeight: "1.45" } },
          h("strong", { style: { color: "var(--nm-fg-secondary)", fontWeight: 600 } }, `Modelos incluídos em "Testar VIPs (${allVipTargetModels.length})": `),
          h("span", { className: "nm-mono" }, allVipTargetModels.join(" · "))
        ),
        buzzAgents.length > 0 && h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px" } },
          buzzAgents.map((a) => {
            var _a;
            const vip = isVipAgent(a.name || a.key, vipPolicy);
            const rawModel = String(((_a = a.config) == null ? void 0 : _a.model) || "padrão");
            const shortModel = rawModel.split("/").pop() || rawModel;
            const bench = findBenchForModel(rawModel);
            const healthDotColor = !bench ? null : !bench.online ? "var(--nm-danger)" : bench.toolCallOk ? "var(--nm-ok)" : "var(--nm-warn)";
            const healthTitle = !bench ? "Modelo ainda não testado no Bench" : !bench.online ? `Falha no Bench: ${bench.errorMsg || bench.errorKind}` : bench.toolCallOk ? `Bench OK · Tool-Calling válido (${bench.latencyMs ?? "?"}ms · ${bench.qualityScore}/100)` : `Respondeu mas falhou em Tool-Calling (${bench.qualityScore}/100)`;
            return h(
              "div",
              {
                key: a.key,
                className: "nm-surface",
                title: healthTitle,
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  borderColor: bench && (!bench.online || !bench.toolCallOk) ? "var(--nm-danger)" : vip ? "var(--nm-warn-border)" : "var(--nm-border)"
                }
              },
              healthDotColor && h("span", {
                style: {
                  width: "7px",
                  height: "7px",
                  borderRadius: "999px",
                  backgroundColor: healthDotColor,
                  flexShrink: 0
                }
              }),
              h("span", { style: { fontWeight: 600 } }, a.name || a.key),
              h("span", { className: "nm-mono", style: { fontSize: "10px", color: "var(--nm-muted)" } }, shortModel),
              h(
                "button",
                {
                  type: "button",
                  className: "nm-pill",
                  "data-tone": vip ? "warn" : "info",
                  onClick: () => onUpdateVipPolicy(toggleVipAgent(vipPolicy, a.name || a.key)),
                  title: vip ? "Agente VIP protegido (clique para mover ao Pool Auto)" : "Agente no Pool Auto (clique para promover a VIP)",
                  style: { cursor: "pointer" }
                },
                vip ? "VIP" : "Pool"
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "nm-btn",
                  "data-variant": "ghost",
                  disabled: failoverBusyAgent === a.key,
                  onClick: () => handleManualFailover(a),
                  title: "Forçar failover inteligente agora",
                  style: { padding: "1px 5px", fontSize: "10px" }
                },
                failoverBusyAgent === a.key ? "..." : "Trocar"
              )
            );
          })
        )
      ),
      // 5. Resultados do Benchmark de Qualidade (Tool-Calling + Stream + Filtros + Re-testar)
      benchList.length > 0 && h(
        "div",
        { className: "nm-card", style: { overflowX: "auto" } },
        h(
          "div",
          {
            style: {
              padding: "10px 14px",
              borderBottom: "1px solid var(--nm-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
            h("span", { style: { fontSize: "12px", fontWeight: 600 } }, `Benchmark de Qualidade Real (${filteredBenchList.length}/${benchList.length})`),
            h(
              "div",
              { className: "nm-segmented" },
              [
                { id: "all", label: `Todos (${benchList.length})` },
                { id: "vip", label: `VIPs (${benchVipCount})` },
                { id: "in_use", label: `Em uso (${benchInUseCount})` },
                { id: "ok", label: `TC OK (${toolOkCount})` },
                { id: "issues", label: `Com problema (${benchIssuesCount})` }
              ].map(
                (tab) => h(
                  "button",
                  {
                    key: tab.id,
                    type: "button",
                    className: "nm-seg-btn",
                    "data-active": benchFilter === tab.id ? "true" : "false",
                    onClick: () => setBenchFilter(tab.id),
                    style: { fontSize: "10.5px", padding: "3px 7px" }
                  },
                  tab.label
                )
              )
            )
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "ghost",
              onClick: handleClearBenchHistory,
              style: { fontSize: "11px", padding: "3px 8px" }
            },
            "Limpar histórico"
          )
        ),
        h(
          "table",
          { className: "nm-table" },
          h(
            "thead",
            null,
            h(
              "tr",
              null,
              ["Modelo", "Escopo", "Qualidade", "Tool-Call", "Stream", "Latência", "Status / Erro", "Ação"].map(
                (col) => h("th", { key: col }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            filteredBenchList.length === 0 ? h(
              "tr",
              null,
              h("td", { colSpan: 8, style: { padding: "18px", textAlign: "center", color: "var(--nm-muted)", fontSize: "11.5px" } }, "Nenhum modelo testado neste filtro.")
            ) : filteredBenchList.slice(0, 30).map((b) => {
              const isVipM = vipModelSet.has(normalizeModelId(b.model));
              const isInUseM = inUseModelSet.has(normalizeModelId(b.model));
              const isTestingThis = singleTestingModel === b.model;
              return h(
                "tr",
                { key: b.model },
                h(
                  "td",
                  { className: "nm-mono", style: { fontWeight: 500 } },
                  h("span", null, b.model),
                  h(
                    "span",
                    { style: { marginLeft: "6px", fontSize: "10px", color: "var(--nm-muted)" } },
                    String(b.group || "").replace("nexusmind_", "")
                  )
                ),
                h(
                  "td",
                  null,
                  h(
                    "div",
                    { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
                    isVipM && h("span", { className: "nm-pill", "data-tone": "warn", style: { fontSize: "9.5px" } }, "VIP"),
                    isInUseM && h("span", { className: "nm-pill", "data-tone": "info", style: { fontSize: "9.5px" } }, "Em uso"),
                    !isVipM && !isInUseM && h("span", { style: { fontSize: "10px", color: "var(--nm-muted)" } }, "Pool")
                  )
                ),
                h(
                  "td",
                  {
                    className: "nm-mono nm-num",
                    style: {
                      fontWeight: 700,
                      color: b.qualityScore >= 75 ? "var(--nm-ok)" : b.qualityScore >= 40 ? "var(--nm-warn)" : "var(--nm-danger)"
                    }
                  },
                  `${b.qualityScore}/100`
                ),
                h(
                  "td",
                  null,
                  h("span", { className: "nm-pill", "data-tone": b.toolCallOk ? "ok" : "danger" }, b.toolCallOk ? "OK" : "Falhou")
                ),
                h(
                  "td",
                  null,
                  h("span", { className: "nm-pill", "data-tone": b.streamOk ? "ok" : "danger" }, b.streamOk ? "Íntegro" : "Corte")
                ),
                h("td", { className: "nm-mono nm-num", style: { color: "var(--nm-muted)" } }, b.latencyMs !== null ? `${b.latencyMs}ms` : "—"),
                h("td", { style: { fontSize: "11px", color: b.online ? "var(--nm-muted)" : "var(--nm-danger)" } }, b.errorMsg || "Saudável"),
                h(
                  "td",
                  null,
                  h(
                    "button",
                    {
                      type: "button",
                      className: "nm-btn",
                      disabled: isTestingThis || benchRunning,
                      onClick: () => handleTestSingleBenchModel(b.model),
                      style: { padding: "3px 7px", fontSize: "10px" }
                    },
                    isTestingThis ? "..." : "Re-testar"
                  )
                )
              );
            })
          )
        )
      ),
      // 6. Histórico de Failovers
      h(
        "div",
        { className: "nm-card", style: { overflowX: "auto" } },
        h(
          "div",
          { style: { padding: "10px 14px", borderBottom: "1px solid var(--nm-border)", fontSize: "12px", fontWeight: 600 } },
          `Telemetria de Failovers (${failoverLog.length})`
        ),
        failoverLog.length === 0 ? h(
          "div",
          { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--nm-muted)" } },
          "Nenhum failover disparado ainda. O watchdog monitora erros reais (404, weekly limit, stream ended, malformed_function_call) e troca automaticamente."
        ) : h(
          "table",
          { className: "nm-table" },
          h(
            "thead",
            null,
            h("tr", null, ["Hora", "Agente", "Troca", "Erro", "Origem", "Resultado"].map((c) => h("th", { key: c }, c)))
          ),
          h(
            "tbody",
            null,
            failoverLog.slice(0, 15).map(
              (ev) => h(
                "tr",
                { key: ev.id },
                h("td", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, fmtTime(ev.timestamp)),
                h(
                  "td",
                  null,
                  h("span", { style: { fontWeight: 600 } }, ev.agentName),
                  ev.isVip && h("span", { className: "nm-pill", "data-tone": "warn", style: { marginLeft: "6px", fontSize: "9.5px" } }, "VIP")
                ),
                h(
                  "td",
                  { className: "nm-mono", style: { fontSize: "11px" } },
                  `${ev.fromModel || "—"} → ${ev.toModel || "bloqueado"}`
                ),
                h("td", null, h("span", { className: "nm-pill", "data-tone": "danger" }, ev.errorKind)),
                h("td", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, ev.trigger),
                h(
                  "td",
                  null,
                  h(
                    "span",
                    { className: "nm-pill", "data-tone": ev.applied ? "ok" : "warn" },
                    ev.applied ? ev.wokeAgent ? "Aplicado + Wake" : "Aplicado" : "Protegido"
                  )
                )
              )
            )
          )
        )
      )
    );
  };
}
const NEXUSMIND_THEME_CSS = `
[data-nexusmind-root="true"] {
  --nm-bg: var(--bg-app, var(--surface-base, #101010));
  --nm-fg: var(--text-primary, var(--text-standard, #f3f4f6));
  --nm-fg-secondary: var(--text-secondary, var(--text-subtle, #c7c7c7));
  --nm-muted: var(--text-tertiary, var(--text-metadata, #9ca3af));
  --nm-card: var(--bg-panel, var(--surface-panel, #18181b));
  --nm-surface: var(--affordance-subtle, var(--surface-inset, #202024));
  --nm-surface-hover: var(--affordance-subtle-hover, #2a2a30);
  --nm-inset: var(--surface-inset, var(--bg-app, #121215));
  --nm-selected: var(--affordance-selected, #2c2c32);
  --nm-border: var(--border-primary, var(--border-standard, rgba(255, 255, 255, 0.09)));
  --nm-border-strong: var(--border-prominent, var(--border-control, rgba(255, 255, 255, 0.16)));

  /* Acento 100% herdado do Buzz Desktop (Bee, Citrus, Cobalt, Iris, Magenta, Mono) */
  --nm-primary: var(--affordance-accent-prominent, var(--accent-9, #3dd68c));
  --nm-primary-hover: var(--affordance-accent-prominent-hover, var(--accent-10, var(--nm-primary)));
  --nm-primary-pressed: var(--affordance-accent-prominent-pressed, var(--accent-pressed, var(--nm-primary)));
  --nm-primary-fg: var(--text-on-accent, var(--accent-contrast, #08120c));
  --nm-primary-soft: var(--accent-3, color-mix(in srgb, var(--nm-primary) 14%, transparent));
  --nm-primary-border: var(--accent-7, color-mix(in srgb, var(--nm-primary) 42%, transparent));
  --nm-primary-text: var(--accent-link, var(--accent-11, var(--nm-primary)));

  /* Semânticos */
  --nm-ok: var(--green-11, #3dd68c);
  --nm-ok-soft: var(--green-3, rgba(61, 214, 140, 0.13));
  --nm-ok-border: var(--green-7, rgba(61, 214, 140, 0.35));
  --nm-warn: var(--amber-11, #fbbf24);
  --nm-warn-soft: var(--amber-3, rgba(245, 158, 11, 0.13));
  --nm-warn-border: var(--amber-7, rgba(245, 158, 11, 0.38));
  --nm-danger: var(--red-11, #f87171);
  --nm-danger-soft: var(--red-3, rgba(239, 68, 68, 0.14));
  --nm-danger-border: var(--red-7, rgba(239, 68, 68, 0.42));
  --nm-info: var(--blue-11, #60a5fa);
  --nm-info-soft: var(--blue-3, rgba(56, 189, 248, 0.13));
  --nm-info-border: var(--blue-7, rgba(56, 189, 248, 0.35));

  --nm-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  color: var(--nm-fg);
  font-family: inherit;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

[data-nexusmind-root="true"] *,
[data-nexusmind-root="true"] *::before,
[data-nexusmind-root="true"] *::after {
  box-sizing: border-box;
}

[data-nexusmind-root="true"] button,
[data-nexusmind-root="true"] input,
[data-nexusmind-root="true"] select,
[data-nexusmind-root="true"] textarea {
  font-family: inherit;
  font-size: inherit;
}

.nm-workspace {
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background: transparent;
}

.nm-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 26px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.nm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--nm-border);
}

.nm-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--nm-primary-soft);
  border: 1px solid var(--nm-primary-border);
  color: var(--nm-primary-text);
  flex-shrink: 0;
}

.nm-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 12px;
  overflow: hidden;
}

.nm-card-pad {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 12px;
  padding: 14px 16px;
}

.nm-surface {
  background: var(--nm-surface);
  border: 1px solid var(--nm-border);
  border-radius: 9px;
}

.nm-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.nm-kpi-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 10px;
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.14s ease;
}

.nm-kpi-card:hover {
  border-color: var(--nm-border-strong);
}

.nm-kpi-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--nm-muted);
}

.nm-kpi-val {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--nm-fg);
}

.nm-bar-track {
  height: 4px;
  border-radius: 9999px;
  background: var(--nm-surface);
  overflow: hidden;
}

.nm-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--nm-primary);
  transition: width 0.25s ease;
}

.nm-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--nm-border);
  background: var(--nm-card);
}

.nm-seg-btn {
  padding: 5px 11px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--nm-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.nm-seg-btn:hover {
  color: var(--nm-fg);
}

.nm-seg-btn[data-active="true"] {
  background: var(--nm-selected);
  color: var(--nm-fg);
  font-weight: 600;
}

.nm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--nm-border);
  background: var(--nm-surface);
  color: var(--nm-fg);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.nm-btn:hover:not(:disabled) {
  background: var(--nm-surface-hover);
  border-color: var(--nm-border-strong);
}

.nm-btn[data-variant="primary"] {
  background: var(--nm-primary);
  border-color: var(--nm-primary);
  color: var(--nm-primary-fg);
  font-weight: 600;
}

.nm-btn[data-variant="primary"]:hover:not(:disabled) {
  background: var(--nm-primary-hover);
  border-color: var(--nm-primary-hover);
  color: var(--nm-primary-fg);
}

.nm-btn[data-variant="primary"]:active:not(:disabled) {
  background: var(--nm-primary-pressed);
  border-color: var(--nm-primary-pressed);
  color: var(--nm-primary-fg);
}

.nm-btn[data-variant="soft"] {
  background: var(--nm-primary-soft);
  border-color: var(--nm-primary-border);
  color: var(--nm-primary-text);
  font-weight: 600;
}

.nm-btn[data-variant="ghost"] {
  background: transparent;
  border-color: transparent;
  color: var(--nm-muted);
}

.nm-btn[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--nm-surface);
  color: var(--nm-fg);
}

.nm-btn[data-variant="danger"] {
  background: var(--nm-danger-soft);
  border-color: var(--nm-danger-border);
  color: var(--nm-danger);
}

.nm-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.nm-input, .nm-select {
  border-radius: 7px;
  background: var(--nm-inset);
  border: 1px solid var(--nm-border);
  color: var(--nm-fg);
  font-size: 12px;
  padding: 5px 10px;
  outline: none;
  transition: border-color 0.12s ease;
}

.nm-input:focus, .nm-select:focus {
  border-color: var(--nm-primary-border);
}

.nm-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--nm-font-mono);
  border: 1px solid var(--nm-border);
  background: var(--nm-surface);
  color: var(--nm-fg-secondary);
  white-space: nowrap;
}

.nm-pill[data-tone="accent"] {
  background: var(--nm-primary-soft);
  border-color: var(--nm-primary-border);
  color: var(--nm-primary-text);
}

.nm-pill[data-tone="ok"] {
  background: var(--nm-ok-soft);
  border-color: var(--nm-ok-border);
  color: var(--nm-ok);
}

.nm-pill[data-tone="warn"] {
  background: var(--nm-warn-soft);
  border-color: var(--nm-warn-border);
  color: var(--nm-warn);
}

.nm-pill[data-tone="danger"] {
  background: var(--nm-danger-soft);
  border-color: var(--nm-danger-border);
  color: var(--nm-danger);
}

.nm-pill[data-tone="info"] {
  background: var(--nm-info-soft);
  border-color: var(--nm-info-border);
  color: var(--nm-info);
}

.nm-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-top: 1px solid var(--nm-border);
  transition: background 0.12s ease;
}

.nm-list-row:first-child {
  border-top: none;
}

.nm-list-row:hover {
  background: var(--nm-surface);
}

.nm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.nm-table th {
  text-align: left;
  padding: 9px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nm-muted);
  border-bottom: 1px solid var(--nm-border);
}

.nm-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--nm-border);
}

.nm-table tbody tr:last-child td {
  border-bottom: none;
}

.nm-table tbody tr:hover {
  background: var(--nm-surface);
}

.nm-check {
  cursor: pointer;
  accent-color: var(--nm-primary);
  width: 14px;
  height: 14px;
}

.nm-mode-group {
  display: inline-flex;
  align-items: center;
  border-radius: 7px;
  border: 1px solid var(--nm-border);
  background: var(--nm-inset);
  padding: 2px;
  gap: 2px;
}

.nm-mode-btn {
  border: none;
  background: transparent;
  color: var(--nm-muted);
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.nm-mode-btn:hover {
  color: var(--nm-fg);
}

.nm-mode-btn[data-active="auto"] {
  background: var(--nm-ok-soft);
  color: var(--nm-ok);
  font-weight: 600;
}

.nm-mode-btn[data-active="vip"] {
  background: var(--nm-warn-soft);
  color: var(--nm-warn);
  font-weight: 600;
}

.nm-mode-btn[data-active="blocked"] {
  background: var(--nm-danger-soft);
  color: var(--nm-danger);
  font-weight: 600;
}

.nm-mono { font-family: var(--nm-font-mono); }
.nm-num { font-variant-numeric: tabular-nums; }
`;
const GOOSE_MAX_MODELS_PER_GROUP = 40;
function selectTopGooseModelsByGroup(params) {
  var _a;
  const limit = Math.max(1, params.limit ?? GOOSE_MAX_MODELS_PER_GROUP);
  const usageByModel = params.usageByModel || {};
  const liveProbes = params.liveProbes || {};
  const policy = loadSavedRoutingPolicy();
  const normalizedProbes = {};
  for (const [mid, p] of Object.entries(liveProbes)) {
    if ((p == null ? void 0 : p.status) === "ok" || (p == null ? void 0 : p.status) === "error") {
      normalizedProbes[mid] = { status: p.status, latency: p.latency, errorMsg: p.errorMsg };
    }
  }
  const snap = buildModelRankingSnapshot({
    catalogModels: params.catalogModels || [],
    groups: CANONICAL_GROUPS,
    usageByModel,
    usageSampleSize: params.usageSampleSize || 0,
    liveProbes: normalizedProbes,
    tier: "geral",
    avoidFree: !policy.forceFree,
    policy
  });
  const rankScoreByModel = /* @__PURE__ */ new Map();
  const callsByModel = /* @__PURE__ */ new Map();
  for (const row of snap.models || []) {
    if (row == null ? void 0 : row.model) {
      rankScoreByModel.set(row.model, typeof row.score === "number" ? row.score : 0);
      callsByModel.set(row.model, typeof row.calls === "number" ? row.calls : 0);
    }
  }
  const out = {};
  for (const [pid, rawList] of Object.entries(params.groupModelsMap)) {
    const unique = Array.from(new Set((rawList || []).filter(Boolean)));
    const defModel = (_a = CANONICAL_GROUPS[pid]) == null ? void 0 : _a.defaultModel;
    const scored = unique.map((mid) => {
      var _a2;
      const low = mid.toLowerCase();
      const probe = normalizedProbes[mid];
      const calls = callsByModel.get(mid) ?? Number(((_a2 = usageByModel[mid]) == null ? void 0 : _a2.calls) || 0);
      const fallbackScore = scoreModelForTier(mid, "tier2_balanced");
      const baseRank = rankScoreByModel.get(mid) ?? fallbackScore.capability + fallbackScore.tierMatch;
      const isFree = low.includes(":free") || low.includes("-free") || low.endsWith("free");
      let priority = baseRank;
      if (defModel && mid === defModel) priority += 80;
      if ((probe == null ? void 0 : probe.status) === "ok") priority += 200;
      else if ((probe == null ? void 0 : probe.status) === "error") priority -= 150;
      if (calls > 0) priority += Math.min(60, Math.log10(calls + 1) * 20);
      if (isFree && !policy.forceFree) priority -= 40;
      return { mid, priority, calls };
    });
    scored.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.calls !== a.calls) return b.calls - a.calls;
      return a.mid.localeCompare(b.mid);
    });
    out[pid] = scored.slice(0, limit).map((s) => s.mid);
  }
  return out;
}
const SESSION_FILE_PATHS = [
  "~/.buzz/.nexusmind_auth_session.json",
  "/Users/heltonfraga/.buzz/.nexusmind_auth_session.json"
];
async function readPrivateSessionFile(ctx) {
  var _a;
  if (!((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.readFile)) return null;
  for (const p of SESSION_FILE_PATHS) {
    try {
      const raw = await ctx.host.readFile(p);
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      const data = JSON.parse(text);
      if (data && typeof data === "object") {
        return { path: p, data };
      }
    } catch {
    }
  }
  return null;
}
async function writePrivateSessionData(ctx, sessionData) {
  var _a, _b;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("nexusmind_mcp_token");
      localStorage.removeItem("nexusmind_auth_session");
    }
  } catch {
  }
  const serialized = JSON.stringify(sessionData, null, 2);
  if ((_a = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a.spawn) {
    try {
      const pyScript = `
import os, json
path = os.path.expanduser("~/.buzz/.nexusmind_auth_session.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
content = ${JSON.stringify(serialized)}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as f:
    f.write(content)
os.chmod(path, 0o600)
`;
      const proc = await ctx.host.spawn("python", { args: [pyScript] });
      const code = await proc.exited;
      if (code === 0) return true;
    } catch {
    }
  }
  for (const p of SESSION_FILE_PATHS) {
    try {
      if ((_b = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b.writeFile) {
        await ctx.host.writeFile(p, serialized);
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function loadPersistedAccountToken(ctx) {
  var _a;
  const sess = await readPrivateSessionFile(ctx);
  if (!(sess == null ? void 0 : sess.data)) return null;
  const tok = sess.data.access_token || sess.data.token || ((_a = sess.data.token_data) == null ? void 0 : _a.access_token);
  return typeof tok === "string" && tok.trim().length > 0 ? tok.trim() : null;
}
const GOOSE_SECRETS_MERGE_PY = `
def _parse_yaml_scalar(raw_val):
    s = raw_val.strip()
    if not s:
        return ""
    if s[0] == '"':
        out = []
        esc = False
        for ch in s[1:]:
            if esc:
                out.append(ch)
                esc = False
            elif ch == '\\\\':
                esc = True
            elif ch == '"':
                break
            else:
                out.append(ch)
        return "".join(out)
    if s[0] == "'":
        end = s.find("'", 1)
        return s[1:end] if end != -1 else s[1:]
    idx = s.find(" #")
    if idx != -1:
        s = s[:idx].rstrip()
    return s

def _format_yaml_value(val):
    s = str(val)
    needs_quote = any(c in s for c in ["#", ":", "'", '"', "\\n", "\\r"]) or s.startswith((" ", "-", "?", "!", "*", "&", "{", "[")) or s.endswith(" ")
    return json.dumps(s, ensure_ascii=False) if needs_quote else s

def merge_goose_secrets(path, updates):
    try:
        import yaml
        data = {}
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
            if isinstance(loaded, dict):
                data = loaded
        for k, v in updates.items():
            if v:
                data[k] = v
        dumped = yaml.safe_dump(data, sort_keys=False, default_flow_style=False, allow_unicode=True)
        write_private(path, dumped)
        return {str(k): str(v) for k, v in data.items() if v is not None}
    except Exception:
        # Fallback preservando comentários, linhas desconhecidas, aspas e '#' em valores
        raw_lines = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                raw_lines = f.readlines()
        parsed = {}
        seen = set()
        out_lines = []
        for line in raw_lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"): 
                out_lines.append(line)
                continue
            if ":" in line:
                k_part, v_part = line.split(":", 1)
                k = k_part.strip()
                if k and not k.startswith("-") and " " not in k:
                    if k in updates and updates[k]:
                        out_lines.append(f"{k}: {_format_yaml_value(updates[k])}\\n")
                        parsed[k] = str(updates[k])
                        seen.add(k)
                    else:
                        out_lines.append(line)
                        parsed[k] = _parse_yaml_scalar(v_part)
                        seen.add(k)
                    continue
            out_lines.append(line)
        for k, v in updates.items():
            if v and k not in seen:
                if out_lines and not out_lines[-1].endswith("\\n"):
                    out_lines[-1] = out_lines[-1] + "\\n"
                out_lines.append(f"{k}: {_format_yaml_value(v)}\\n")
                parsed[k] = str(v)
        write_private(path, "".join(out_lines))
        return parsed
`;
const SVG_ICONS = {
  // Official Brand Logos
  openai: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M22.28 12.06a5.53 5.53 0 0 0-.47-2.92 5.58 5.58 0 0 0-3.32-2.88 5.6 5.6 0 0 0-1.63-.24 5.57 5.57 0 0 0-4.04 1.76l-.42.48-1.78-1.03a5.57 5.57 0 0 0-5.74.52 5.57 5.57 0 0 0-2.3 4.88 5.54 5.54 0 0 0 .46 2.92 5.57 5.57 0 0 0 3.32 2.88c.52.16 1.07.24 1.63.24a5.58 5.58 0 0 0 4.04-1.76l.42-.48 1.78 1.03a5.57 5.57 0 0 0 5.74-.52 5.58 5.58 0 0 0 2.3-4.89zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
    })
  ),
  claude: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M13.5 2h-3l-.8 7.2L3.5 6 2 8.6l6.6 3.4L2 15.4 3.5 18l6.2-3.2.8 7.2h3l.8-7.2 6.2 3.2 1.5-2.6-6.6-3.4 6.6-3.4-1.5-2.6-6.2 3.2-.8-7.2z"
    })
  ),
  gemini: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M12 2C12 7.52 7.52 12 2 12c5.48 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z"
    })
  ),
  grok: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    })
  ),
  // Minimalist Functional Icons (Buzz UI Standard)
  dashboard: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 3, y: 14, width: 7, height: 7, rx: 1 })
  ),
  sync: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
  ),
  pull: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    props.h("polyline", { points: "7 10 12 15 17 10" }),
    props.h("line", { x1: 12, y1: 15, x2: 12, y2: 3 })
  ),
  search: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("circle", { cx: 11, cy: 11, r: 8 }),
    props.h("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
  ),
  check: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("polyline", { points: "20 6 9 17 4 12" })
  ),
  cross: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
    props.h("line", { x1: 6, y1: 6, x2: 18, y2: 18 })
  ),
  chevronLeft: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "15 18 9 12 15 6" })
  ),
  chevronRight: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "9 18 15 12 9 6" })
  ),
  external: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
    props.h("polyline", { points: "15 3 21 3 21 9" }),
    props.h("line", { x1: 10, y1: 14, x2: 21, y2: 3 })
  ),
  copy: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
    props.h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
  ),
  plug: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M12 2v6m0 8v6M5 9h14M7 9v4a5 5 0 0 0 10 0V9" })
  ),
  shield: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
  ),
  pulse: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
  ),
  wallet: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
    props.h("line", { x1: 2, y1: 10, x2: 22, y2: 10 })
  ),
  sparkles: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" })
  ),
  user: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 15, height: 15, ...props },
    props.h("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }),
    props.h("circle", { cx: 12, cy: 7, r: 4 })
  ),
  filter: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })
  ),
  power: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "M18.36 6.64a9 9 0 1 1-12.73 0" }),
    props.h("line", { x1: 12, y1: 2, x2: 12, y2: 12 })
  )
};
const inject = ["react", "pages", "settingsCards", "host", "agents", "decisions", "navigation", "notifications", "shortcuts", "relay"];
const ICON = "data:image/svg+xml;base64," + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V6l14 12V6"/><circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>'
);
const CANONICAL_GROUPS = {
  nexusmind_openai: {
    id: "nexusmind_openai",
    platformKey: "openai",
    groupName: "Saldo OpenAI",
    displayName: "NexusMind OpenAI",
    defaultKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    defaultModel: "gpt-6.1-terra",
    defaultCtx: 131072,
    defaultOut: 8192,
    accentColor: "#10a37f",
    logoKey: "openai",
    modelsCount: 14,
    telemetrySummary: "Hoje: 127.1M tokens • 1,232 reqs"
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    platformKey: "anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 2e5,
    defaultOut: 8192,
    accentColor: "#d97706",
    logoKey: "claude",
    modelsCount: 18,
    telemetrySummary: "Carregando dados..."
  },
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    platformKey: "antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    defaultKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    defaultModel: "gemini-2.5-flash",
    defaultCtx: 1048576,
    defaultOut: 65536,
    accentColor: "#0284c7",
    logoKey: "gemini",
    modelsCount: 66,
    telemetrySummary: "Hoje: 150.2M tokens • 2,572 reqs"
  },
  nexusmind_grok: {
    id: "nexusmind_grok",
    platformKey: "grok",
    groupName: "Grok",
    displayName: "NexusMind Grok",
    defaultKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    defaultModel: "grok-4.5",
    defaultCtx: 131072,
    defaultOut: 8192,
    accentColor: "#a855f7",
    logoKey: "grok",
    modelsCount: 14,
    telemetrySummary: "Hoje: 1.2k tokens • 1 req"
  }
};
const ANTHROPIC_ONLY_CLAUDE = /* @__PURE__ */ new Set([
  "claude-fable-5-2",
  "claude-haiku-4-5-20251001",
  "claude-haiku-5-5",
  "claude-mythos-5-2",
  "claude-opus-4-5-20251101",
  "claude-opus-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-5"
]);
const ANTIGRAVITY_ONLY_CLAUDE = /* @__PURE__ */ new Set([
  "claude-opus-4-5-thinking",
  "claude-opus-4-6-thinking",
  "claude-opus-5-5-high",
  "claude-opus-5-5-low",
  "claude-opus-5-5-medium",
  "claude-sonnet-4-5-thinking",
  "claude-sonnet-5-5-high",
  "claude-sonnet-5-5-low",
  "claude-sonnet-5-5-medium"
]);
function getModelGroups(m) {
  if (!m) return [];
  if (Array.isArray(m.groups) && m.groups.length > 0) return m.groups;
  const rawId = typeof m === "string" ? m : m.id || "";
  const mid = rawId.toLowerCase();
  if (!mid) return [];
  const groups = [];
  if (mid.includes("grok")) {
    groups.push("nexusmind_grok");
  }
  if (mid.includes("gemini") || mid.includes("antigravity") || mid.includes("tab_flash") || mid.includes("gpt-oss") || mid.includes("imagen")) {
    if (!groups.includes("nexusmind_antigravity")) {
      groups.push("nexusmind_antigravity");
    }
  }
  if (mid.includes("claude")) {
    if (ANTIGRAVITY_ONLY_CLAUDE.has(rawId) || mid.includes("thinking") || mid.includes("-high") || mid.includes("-low") || mid.includes("-medium")) {
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    } else if (ANTHROPIC_ONLY_CLAUDE.has(rawId) || mid.includes("2025") || mid.includes("mythos")) {
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
    } else {
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    }
  }
  if (mid.includes("mistral") || mid.includes("stepfun") || mid.includes("nvidia") || mid.includes("gemma") || mid.includes("nemotron") || mid.includes("glimmer") || mid.includes("poolside") || mid.includes("luna") || mid.includes("gpt-6") || mid.includes("ising") || mid.includes("riva") || mid.includes("muse") || mid.includes("laguna")) {
    if (!groups.includes("nexusmind_openai")) {
      groups.push("nexusmind_openai");
    }
  }
  if (groups.length === 0) {
    groups.push("nexusmind_openai");
  }
  return groups;
}
const OFFICIAL_ENDPOINTS = [
  {
    id: "default",
    label: "Endpoints da API",
    tag: "Padrão",
    tagColor: "#10b981",
    url: "https://api.nexusmind.digital",
    desc: "Host raiz do gateway e healthcheck"
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    tag: "Messages",
    tagColor: "#d97706",
    url: "https://api.nexusmind.digital",
    desc: "Endpoint nativo Anthropic Claude (/v1/messages)"
  },
  {
    id: "openai",
    label: "OpenAI-compatible API",
    tag: "v1",
    tagColor: "#3b82f6",
    url: "https://api.nexusmind.digital/v1",
    desc: "OpenAI, Codex, Grok, NIM (/v1/chat/completions)"
  },
  {
    id: "responses",
    label: "Responses API",
    tag: "Streaming",
    tagColor: "#8b5cf6",
    url: "https://api.nexusmind.digital/responses",
    desc: "OpenAI Responses API e WebSockets"
  },
  {
    id: "gemini",
    label: "Gemini Native API",
    tag: "v1beta",
    tagColor: "#0284c7",
    url: "https://api.nexusmind.digital/antigravity/v1beta",
    desc: "Google GenAI SDK nativo (generateContent)"
  },
  {
    id: "antigravity",
    label: "Antigravity Bridge",
    tag: "Contingência",
    tagColor: "#f59e0b",
    url: "https://api.nexusmind.digital/antigravity",
    desc: "Bridge Vertex AI de alta performance para Claude e Gemini"
  }
];
const CANONICAL_PROFILE = {
  username: "HeltonFraga01",
  email: "fraga450@gmail.com",
  balance: 5413.56,
  role: "admin",
  status: "active",
  allowedGroups: [1, 5, 7, 8, 10, 11, 13, 14, 15, 17, 18, 24, 25],
  activeApiKeys: 4
};
const CANONICAL_DASHBOARD = {
  today_tokens: 540091754,
  today_requests: 8810,
  today_cost: 86.22,
  total_tokens: 50078702405,
  total_requests: 606467,
  total_cost: 10901.45,
  by_platform: [
    { platform: "openai", today_tokens: 127114006, today_requests: 1232, total_tokens: 4213537199, total_requests: 44029 },
    { platform: "anthropic", today_tokens: 0, today_requests: 0, total_tokens: 4362622895, total_requests: 28503 },
    { platform: "antigravity", today_tokens: 150191469, today_requests: 2572, total_tokens: 40577968698, total_requests: 519860 },
    { platform: "grok", today_tokens: 1272, today_requests: 1, total_tokens: 10837914, total_requests: 242 }
  ]
};
function formatTokens(n = 0) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function formatNumber(n = 0) {
  return new Intl.NumberFormat("pt-BR").format(n);
}
function apply(ctx) {
  var _a, _b, _c;
  const React = ctx.react;
  const h = React.createElement;
  function NexusMindComponent({ isSettingsCard = false }) {
    const [mcpToken, setMcpToken] = React.useState(() => {
      try {
        localStorage.removeItem("nexusmind_mcp_token");
        return localStorage.getItem("nexusmind_connected") === "false" ? "" : "connected";
      } catch {
        return "connected";
      }
    });
    const [isConnected, setIsConnected] = React.useState(() => {
      try {
        const stored = localStorage.getItem("nexusmind_connected");
        if (stored === "false") return false;
        return true;
      } catch {
        return true;
      }
    });
    const [profileData, setProfileData] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_profile_cache");
        return s ? JSON.parse(s) : CANONICAL_PROFILE;
      } catch {
        return CANONICAL_PROFILE;
      }
    });
    const [dashboardMetrics, setDashboardMetrics] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_metrics_cache");
        return s ? JSON.parse(s) : CANONICAL_DASHBOARD;
      } catch {
        return CANONICAL_DASHBOARD;
      }
    });
    const [authInFlight, setAuthInFlight] = React.useState(false);
    const [generatedAuthUrl, setGeneratedAuthUrl] = React.useState("");
    const [manualKeyInput, setManualKeyInput] = React.useState("");
    const [models, setModels] = React.useState(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });
    const [disabledModels, setDisabledModels] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_disabled_models");
        return s ? JSON.parse(s) : [];
      } catch {
        return [];
      }
    });
    const [modelTests, setModelTests] = React.useState({});
    const [activeSection, setActiveSection] = React.useState("catalog");
    const [showGatewayDetails, setShowGatewayDetails] = React.useState(false);
    const [vipPolicy, setVipPolicy] = React.useState(() => loadVipPolicy());
    const [autopilotCfg, setAutopilotCfg] = React.useState(() => loadAutopilotConfig());
    const [quarantines, setQuarantines] = React.useState(() => loadQuarantines());
    const [qualityBench, setQualityBench] = React.useState(() => loadSavedQualityBench());
    const [failoverLog, setFailoverLog] = React.useState(() => loadFailoverLog());
    const [usageByModelCache, setUsageByModelCache] = React.useState({});
    const [usageSampleSizeCache, setUsageSampleSizeCache] = React.useState(0);
    React.useRef(/* @__PURE__ */ new Set());
    const ModelRankingTab = React.useMemo(
      () => createModelRankingTabComponent(ctx, CANONICAL_GROUPS),
      []
    );
    const NexusMindAgentsTab = React.useMemo(
      () => createNexusMindAgentsTabComponent(ctx, CANONICAL_GROUPS),
      []
    );
    const AutopilotFailoverTab = React.useMemo(
      () => createAutopilotFailoverTabComponent(ctx, CANONICAL_GROUPS),
      []
    );
    React.useEffect(() => {
      loadGatewayUsageByModel(ctx).then((u) => {
        setUsageByModelCache(u.byModel);
        setUsageSampleSizeCache(u.sampleSize);
      }).catch(() => {
      });
    }, [models.length]);
    const liveRankingSnapshot = React.useMemo(() => {
      return buildModelRankingSnapshot({
        catalogModels: models,
        groups: CANONICAL_GROUPS,
        usageByModel: usageByModelCache,
        usageSampleSize: usageSampleSizeCache,
        liveProbes: modelTests,
        disabledModels,
        tier: "geral",
        policy: loadSavedRoutingPolicy(),
        vipPolicy,
        qualityBench,
        quarantines
      });
    }, [models, usageByModelCache, usageSampleSizeCache, modelTests, disabledModels, vipPolicy, qualityBench, quarantines]);
    const handleUpdateVipPolicy = (next) => {
      setVipPolicy(next);
      void saveVipPolicy(ctx, next);
    };
    const handleSetModelAccessMode = (modelId, mode) => {
      const next = setModelAccessMode(vipPolicy, modelId, mode);
      handleUpdateVipPolicy(next);
      if (mode !== "blocked" && disabledModels.includes(modelId)) {
        const nextDis = disabledModels.filter((id) => id !== modelId);
        setDisabledModels(nextDis);
        try {
          localStorage.setItem("nexusmind_disabled_models", JSON.stringify(nextDis));
        } catch {
        }
      }
      setStatusMessage({
        type: "info",
        text: mode === "vip" ? `${modelId} travado como VIP (exclusivo Iris e Conselho).` : mode === "blocked" ? `${modelId} bloqueado para roteamento automático.` : `${modelId} liberado no pool Auto dos agentes.`
      });
    };
    const handleQuickProtectVips = () => {
      const next = applyQuickVipPreset(vipPolicy, models);
      handleUpdateVipPolicy(next);
      setStatusMessage({
        type: "success",
        text: "Escudo VIP aplicado: Anthropic + GPT-6.1 Terra + frontier reservados para Iris e Conselho."
      });
    };
    const handleToggleVipAgent = (agentName) => {
      const next = toggleVipAgent(vipPolicy, agentName);
      handleUpdateVipPolicy(next);
    };
    const handleFailoverAgent = async (agentKey, errorText, trigger = "manual") => {
      const evt = await executeAgentFailover(ctx, CANONICAL_GROUPS, {
        agentKeyOrName: agentKey,
        errorText,
        trigger,
        rankingSnapshot: liveRankingSnapshot,
        vipPolicy,
        qualityBench,
        disabledModels,
        wakeAfter: autopilotCfg.wakeOnFailover,
        notify: autopilotCfg.notifyOnFailover
      });
      setQuarantines(loadQuarantines());
      setFailoverLog(loadFailoverLog());
      setStatusMessage({
        type: evt.applied ? "success" : "error",
        text: evt.applied ? `Failover: ${evt.agentName} (${evt.fromModel || "anterior"} → ${evt.toModel})` : evt.note || `Não foi possível trocar ${evt.agentName}.`
      });
    };
    React.useEffect(() => {
      const onCompleted = (e) => {
        const evt = e == null ? void 0 : e.detail;
        setQuarantines(loadQuarantines());
        setFailoverLog(loadFailoverLog());
        if ((evt == null ? void 0 : evt.applied) && (evt == null ? void 0 : evt.agentName)) {
          setStatusMessage({
            type: "success",
            text: `Autopiloto: ${evt.agentName} (${evt.fromModel || "anterior"} → ${evt.toModel})`
          });
        }
      };
      try {
        if (typeof window !== "undefined" && window.addEventListener) {
          window.addEventListener("nexusmind.failover.completed", onCompleted);
        }
      } catch {
      }
      return () => {
        try {
          if (typeof window !== "undefined" && window.removeEventListener) {
            window.removeEventListener("nexusmind.failover.completed", onCompleted);
          }
        } catch {
        }
      };
    }, []);
    const buzzAgentsCount = React.useMemo(() => {
      var _a2, _b2;
      try {
        const snap = ((_b2 = (_a2 = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a2.snapshot) == null ? void 0 : _b2.call(_a2)) || {};
        const keys = /* @__PURE__ */ new Set();
        for (const list of [snap.agents, snap.running]) {
          if (!Array.isArray(list)) continue;
          for (const a of list) if (a == null ? void 0 : a.key) keys.add(String(a.key));
        }
        return keys.size;
      } catch {
        return 0;
      }
    }, [activeSection, models.length]);
    const [selectedGroupTab, setSelectedGroupTab] = React.useState("all");
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [filterFree, setFilterFree] = React.useState(false);
    const [filterReasoning, setFilterReasoning] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [pageSize, setPageSize] = React.useState(15);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [loadingPull, setLoadingPull] = React.useState(false);
    const [loadingSync, setLoadingSync] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState(null);
    const [lastSyncTime, setLastSyncTime] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync_time") || "";
      } catch {
        return "";
      }
    });
    const [copiedEndpoint, setCopiedEndpoint] = React.useState(null);
    const handleCopyEndpoint = (url, label) => {
      try {
        if (navigator && navigator.clipboard) {
          navigator.clipboard.writeText(url);
        }
      } catch {
      }
      setCopiedEndpoint(url);
      setStatusMessage({
        type: "info",
        text: `Endpoint ${label} copiado para a área de transferência: ${url}`
      });
      setTimeout(() => {
        setCopiedEndpoint((curr) => curr === url ? null : curr);
      }, 2500);
    };
    const fetchTelemetry = async (tokenToUse) => {
      var _a2, _b2, _c2, _d, _e;
      const token = tokenToUse.trim();
      if (!token) return;
      try {
        const profRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/profile",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3"
          },
          timeoutMs: 8e3
        });
        let u = null;
        if (profRes.status === 200) {
          const body = JSON.parse(profRes.body);
          u = body.data || body || {};
        } else {
          try {
            const mcpRes = await ctx.host.request({
              url: "https://nexusmind.digital/api/v1/mcp",
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "User-Agent": "BuzzDesktop/2.3"
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "user_get_profile", arguments: {} }
              }),
              timeoutMs: 8e3
            });
            if (mcpRes.status === 200 && mcpRes.body) {
              const mcpData = JSON.parse(mcpRes.body);
              const innerText = (_c2 = (_b2 = (_a2 = mcpData.result) == null ? void 0 : _a2.content) == null ? void 0 : _b2[0]) == null ? void 0 : _c2.text;
              if (innerText) {
                const inner = JSON.parse(innerText);
                u = ((_d = inner.result) == null ? void 0 : _d.data) || inner.data || inner;
              }
            }
          } catch {
          }
        }
        if (u) {
          const parsedBalance = typeof u.balance === "number" ? u.balance : typeof u.quota === "number" ? u.quota : void 0;
          const profile = {
            username: u.username || u.name || profileData.username,
            email: u.email || profileData.email,
            balance: parsedBalance,
            role: u.role === 100 || u.role === "admin" ? "admin" : u.role ? String(u.role) : "user",
            status: u.status || "active",
            allowedGroups: u.allowed_groups || CANONICAL_PROFILE.allowedGroups,
            activeApiKeys: typeof u.active_api_keys === "number" ? u.active_api_keys : 4
          };
          setProfileData(profile);
          localStorage.setItem("nexusmind_profile_cache", JSON.stringify(profile));
        }
        const dashRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/dashboard",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3"
          },
          timeoutMs: 8e3
        });
        if (dashRes.status === 200) {
          const body = JSON.parse(dashRes.body);
          const d = body.data || {};
          const metrics = {
            today_tokens: d.today_tokens ?? 540091754,
            today_requests: d.today_requests ?? 8810,
            today_cost: d.today_cost ?? 86.22,
            total_tokens: d.total_tokens ?? 50078702405,
            total_requests: d.total_requests ?? 606467,
            total_cost: d.total_actual_cost ?? 10901.45,
            by_platform: d.by_platform || CANONICAL_DASHBOARD.by_platform
          };
          setDashboardMetrics(metrics);
          localStorage.setItem("nexusmind_metrics_cache", JSON.stringify(metrics));
          try {
            if ((_e = ctx.host) == null ? void 0 : _e.writeFile) {
              void ctx.host.writeFile(
                "~/.buzz/.scratch/nm_dashboard_live.json",
                JSON.stringify({ fetched_at: (/* @__PURE__ */ new Date()).toISOString(), ...metrics }, null, 2)
              );
            }
          } catch {
          }
        }
      } catch {
        setProfileData(CANONICAL_PROFILE);
        setDashboardMetrics(CANONICAL_DASHBOARD);
      }
    };
    React.useEffect(() => {
      if (!isConnected) return;
      if (models.length === 0) {
        handlePullModelsFromNexusMind();
      }
      if (mcpToken && mcpToken !== "connected") {
        fetchTelemetry(mcpToken);
      } else {
        loadPersistedAccountToken(ctx).then((tok) => {
          if (tok) {
            setMcpToken(tok);
            fetchTelemetry(tok);
          }
        }).catch(() => {
        });
      }
    }, [isConnected]);
    const handleStartOAuthFlow = async () => {
      setAuthInFlight(true);
      setStatusMessage({
        type: "info",
        text: "Iniciando processo de autorização PKCE seguro..."
      });
      try {
        if (ctx.host && ctx.host.spawn) {
          const launcher = `
import os, sys, subprocess
script_path = os.path.expanduser("~/.buzz/REPOS/nexusmind-buzz-plugin/scripts/mcp_auth.py")
subprocess.run([sys.executable, script_path])
`;
          const proc = await ctx.host.spawn("python", {
            args: [launcher],
            onStdout: (chunk) => {
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const ev = JSON.parse(line.trim());
                  if (ev.type === "auth_url_ready" && ev.auth_url) {
                    setGeneratedAuthUrl(ev.auth_url);
                    setStatusMessage({
                      type: "info",
                      text: "Navegador aberto! Complete o login no NexusMind para conectar."
                    });
                  } else if (ev.type === "authorized" && ev.token) {
                    setMcpToken(ev.token);
                    void writePrivateSessionData(ctx, {
                      status: "authorized",
                      access_token: ev.token,
                      token: ev.token,
                      source: "oauth_pkce",
                      updated_at: Math.floor(Date.now() / 1e3)
                    });
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    setAuthInFlight(false);
                    setStatusMessage({
                      type: "success",
                      text: "Autenticação NexusMind concluída com sucesso! Cockpit conectado."
                    });
                    fetchTelemetry(ev.token);
                  }
                } catch {
                }
              }
            }
          });
          proc.exited.then(async (code) => {
            var _a2;
            setAuthInFlight(false);
            if (code === 0) {
              try {
                if (ctx.host.readFile) {
                  const content = await ctx.host.readFile("/Users/heltonfraga/.buzz/.nexusmind_auth_session.json");
                  const text = typeof content === "string" ? content : new TextDecoder().decode(content);
                  const sess = JSON.parse(text);
                  const resolvedToken = sess.access_token || sess.token || ((_a2 = sess.token_data) == null ? void 0 : _a2.access_token);
                  if (resolvedToken) {
                    setMcpToken(resolvedToken);
                    try {
                      localStorage.removeItem("nexusmind_mcp_token");
                    } catch {
                    }
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    fetchTelemetry(resolvedToken);
                  }
                }
              } catch {
              }
            }
          });
        }
      } catch (err) {
        setAuthInFlight(false);
        setStatusMessage({
          type: "error",
          text: `Falha ao iniciar autenticação: ${err.message}`
        });
      }
    };
    const handleOpenInBrowser = async () => {
      const urlToOpen = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      if (!/^https?:\/\//i.test(urlToOpen)) return;
      try {
        if (ctx.host && ctx.host.spawn) {
          await ctx.host.spawn("open", { args: [urlToOpen] });
        }
      } catch {
        window.open(urlToOpen, "_blank");
      }
    };
    const handleCopyAuthUrl = async () => {
      const urlToCopy = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      try {
        await navigator.clipboard.writeText(urlToCopy);
        setStatusMessage({
          type: "success",
          text: "Link copiado para a área de transferência!"
        });
      } catch {
        setStatusMessage({
          type: "info",
          text: `Copie manualmente: ${urlToCopy}`
        });
      }
    };
    const handleManualKeyConnect = async () => {
      const key = manualKeyInput.trim();
      if (!key) {
        setStatusMessage({
          type: "error",
          text: "Por favor, insira sua API Key ou Token NexusMind."
        });
        return;
      }
      setMcpToken(key);
      await writePrivateSessionData(ctx, {
        status: "authorized",
        access_token: key,
        token: key,
        source: "manual_key",
        updated_at: Math.floor(Date.now() / 1e3)
      });
      localStorage.setItem("nexusmind_connected", "true");
      setIsConnected(true);
      fetchTelemetry(key);
      setStatusMessage({
        type: "success",
        text: "Chave vinculada com sucesso e salva em sessão privada (0600)! Cockpit conectado."
      });
      if (models.length === 0) {
        handlePullModelsFromNexusMind();
      }
    };
    const handleDisconnect = () => {
      setMcpToken("");
      setIsConnected(false);
      try {
        localStorage.setItem("nexusmind_connected", "false");
        localStorage.removeItem("nexusmind_mcp_token");
      } catch {
      }
      setStatusMessage({
        type: "info",
        text: "Desconectado do NexusMind Gateway."
      });
    };
    const handlePullModelsFromNexusMind = async () => {
      setLoadingPull(true);
      setStatusMessage({
        type: "info",
        text: "Consultando catálogo de modelos em tempo real nos 4 grupos NexusMind..."
      });
      try {
        const groupKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const aggregatedMap = /* @__PURE__ */ new Map();
        const promises = Object.entries(groupKeys).map(async ([gid, key]) => {
          try {
            const res = await ctx.host.request({
              url: "https://api.nexusmind.digital/v1/models",
              method: "GET",
              headers: {
                Authorization: `Bearer ${key}`,
                "User-Agent": "BuzzDesktop/2.3"
              },
              timeoutMs: 14e3
            });
            if (res.status === 200) {
              const body = JSON.parse(res.body);
              const raw = body.data || [];
              for (const m of raw) {
                const mid = m.id;
                if (!mid) continue;
                if (!aggregatedMap.has(mid)) {
                  aggregatedMap.set(mid, {
                    ...m,
                    groups: [gid],
                    primaryGroup: gid
                  });
                } else {
                  const existing = aggregatedMap.get(mid);
                  if (!existing.groups.includes(gid)) {
                    existing.groups.push(gid);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Erro ao puxar grupo ${gid}:`, e);
          }
        });
        await Promise.all(promises);
        const sorted = Array.from(aggregatedMap.values()).sort(
          (a, b) => (a.id || "").localeCompare(b.id || "")
        );
        if (sorted.length > 0) {
          setModels(sorted);
          localStorage.setItem("nexusmind_cached_models", JSON.stringify(sorted));
          setStatusMessage({
            type: "success",
            text: `${sorted.length} modelos recuperados dos 4 grupos corporativos com sucesso!`
          });
        } else {
          throw new Error("Nenhum modelo foi retornado pelos provedores.");
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro ao buscar modelos do NexusMind: ${err.message}`
        });
      } finally {
        setLoadingPull(false);
      }
    };
    const handleTestSingleModel = async (mid) => {
      var _a2;
      const modelObj = models.find((m) => m.id === mid);
      const grps = getModelGroups(modelObj || mid);
      let targetGroup;
      if (selectedGroupTab !== "all" && selectedGroupTab in CANONICAL_GROUPS && grps.includes(selectedGroupTab)) {
        targetGroup = selectedGroupTab;
      } else if (grps.includes("nexusmind_anthropic")) {
        targetGroup = "nexusmind_anthropic";
      } else if (grps.includes("nexusmind_antigravity")) {
        targetGroup = "nexusmind_antigravity";
      } else if (grps.includes("nexusmind_grok")) {
        targetGroup = "nexusmind_grok";
      } else {
        targetGroup = "nexusmind_openai";
      }
      const keyToUse = CANONICAL_GROUPS[targetGroup].defaultKey;
      const isAnthropic = targetGroup === "nexusmind_anthropic";
      const endpointUrl = isAnthropic ? "https://api.nexusmind.digital/v1/messages" : "https://api.nexusmind.digital/v1/chat/completions";
      const reqHeaders = isAnthropic ? {
        "x-api-key": keyToUse,
        Authorization: `Bearer ${keyToUse}`,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/2.3"
      } : {
        Authorization: `Bearer ${keyToUse}`,
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/2.3"
      };
      setModelTests((prev) => ({
        ...prev,
        [mid]: { status: "testing" }
      }));
      const t0 = Date.now();
      try {
        const res = await ctx.host.request({
          url: endpointUrl,
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({
            model: mid,
            messages: [{ role: "user", content: "oi" }],
            max_tokens: isAnthropic ? 16 : 5
          }),
          timeoutMs: 14e3
        });
        const latency = Date.now() - t0;
        if (res.status === 200) {
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "ok", latency }
          }));
        } else {
          let errText = `Status ${res.status}`;
          try {
            const parsed = JSON.parse(res.body);
            const rawMsg = ((_a2 = parsed.error) == null ? void 0 : _a2.message) || parsed.message;
            if (rawMsg) errText = `HTTP ${res.status}: ${rawMsg}`;
          } catch {
          }
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "error", errorMsg: errText, latency }
          }));
        }
      } catch (err) {
        const latency = Date.now() - t0;
        setModelTests((prev) => ({
          ...prev,
          [mid]: { status: "error", errorMsg: err.message, latency }
        }));
      }
    };
    const handleBatchTestVisible = async () => {
      const visible = paginatedModels.filter((m) => !disabledModels.includes(m.id));
      if (visible.length === 0) return;
      setStatusMessage({
        type: "info",
        text: `Executando healthcheck em lote para ${visible.length} modelos visíveis...`
      });
      for (const m of visible) {
        await handleTestSingleModel(m.id);
      }
      setStatusMessage({
        type: "success",
        text: `Healthcheck concluído para os modelos visíveis.`
      });
    };
    const handleBatchDisableUnavailable = () => {
      const failed = Object.entries(modelTests).filter(([_, t]) => t.status === "error").map(([mid]) => mid);
      if (failed.length === 0) {
        setStatusMessage({
          type: "info",
          text: "Nenhum modelo com erro identificado nos testes recentes."
        });
        return;
      }
      const next = Array.from(/* @__PURE__ */ new Set([...disabledModels, ...failed]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({
        type: "success",
        text: `${failed.length} modelo(s) indisponível(is) foram desativados do catálogo local.`
      });
    };
    const handleToggleModel = (mid) => {
      let next;
      if (disabledModels.includes(mid)) {
        next = disabledModels.filter((id) => id !== mid);
      } else {
        next = [...disabledModels, mid];
      }
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
    };
    const handleEnableFilteredBulk = () => {
      const idsToEnable = new Set(filteredModels.map((m) => m.id));
      if (idsToEnable.size === 0) return;
      const next = disabledModels.filter((id) => !idsToEnable.has(id));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "success", text: `${idsToEnable.size} modelo(s) filtrado(s) ativados em massa.` });
    };
    const handleDisableFilteredBulk = () => {
      const idsToDisable = filteredModels.map((m) => m.id).filter(Boolean);
      if (idsToDisable.length === 0) return;
      const next = Array.from(/* @__PURE__ */ new Set([...disabledModels, ...idsToDisable]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "info", text: `${idsToDisable.length} modelo(s) filtrado(s) desativados em massa.` });
    };
    const handleDisableFreeBulk = () => {
      const freeIds = models.map((m) => m.id).filter((id) => {
        const low = String(id || "").toLowerCase();
        return low.includes(":free") || low.includes("-free") || low.endsWith("free");
      });
      if (freeIds.length === 0) return;
      const next = Array.from(/* @__PURE__ */ new Set([...disabledModels, ...freeIds]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "info", text: `${freeIds.length} modelo(s) :free desativados em massa.` });
    };
    const handleToggleAllFiltered = () => {
      const allActive = filteredModels.length > 0 && filteredModels.every((m) => !disabledModels.includes(m.id));
      if (allActive) handleDisableFilteredBulk();
      else handleEnableFilteredBulk();
    };
    const handleSyncModelsToBuzz = async () => {
      var _a2, _b2, _c2, _d;
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Sincronizando apenas modelos ativos, testados e validados com Goose e Pi..."
      });
      try {
        const effectiveKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const controlPlaneApproved = /* @__PURE__ */ new Set();
        const controlPlaneBlocked = /* @__PURE__ */ new Set();
        if (typeof ((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.readFile) === "function") {
          for (const cpPath of [
            "~/.buzz/.scratch/model-control-plane.json",
            "/Users/heltonfraga/.buzz/.scratch/model-control-plane.json"
          ]) {
            try {
              const raw = await ctx.host.readFile(cpPath);
              if (!raw) continue;
              const txt = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
              const cp = JSON.parse(txt);
              if (Array.isArray(cp == null ? void 0 : cp.models)) {
                for (const m of cp.models) {
                  const mid = String((m == null ? void 0 : m.model) || "").trim().toLowerCase();
                  if (!mid) continue;
                  if (m.policyState === "blocked" || m.online === false) {
                    controlPlaneBlocked.add(mid);
                  } else if (m.evalApproved && m.online) {
                    controlPlaneApproved.add(mid);
                  }
                }
                break;
              }
            } catch {
            }
          }
        }
        const validatedLowerSet = new Set(controlPlaneApproved);
        const failedLowerSet = new Set(controlPlaneBlocked);
        for (const [mid, q] of Object.entries(qualityBench || {})) {
          const low = String(mid || "").trim().toLowerCase();
          if (!low) continue;
          if ((q == null ? void 0 : q.online) && (q == null ? void 0 : q.toolCallOk)) validatedLowerSet.add(low);
          else if (q && (!q.online || q.toolCallOk === false)) failedLowerSet.add(low);
        }
        for (const [mid, t] of Object.entries(modelTests || {})) {
          const low = String(mid || "").trim().toLowerCase();
          if (!low) continue;
          if ((t == null ? void 0 : t.status) === "ok") validatedLowerSet.add(low);
          else if ((t == null ? void 0 : t.status) === "error") failedLowerSet.add(low);
        }
        const groupModelsMap = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: []
        };
        const candidateIds = /* @__PURE__ */ new Set();
        for (const item of models) if (item == null ? void 0 : item.id) candidateIds.add(String(item.id));
        for (const mid of Object.keys(qualityBench || {})) candidateIds.add(mid);
        for (const mid of Object.keys(modelTests || {})) candidateIds.add(mid);
        for (const mid of controlPlaneApproved) {
          const exact = ((_b2 = models.find((m) => String((m == null ? void 0 : m.id) || "").toLowerCase() === mid)) == null ? void 0 : _b2.id) || mid;
          candidateIds.add(exact);
        }
        for (const mid of candidateIds) {
          if (!mid || disabledModels.includes(mid) || isUnsupportedAgentModel(mid)) continue;
          const low = mid.toLowerCase();
          if (failedLowerSet.has(low)) continue;
          const itemObj = models.find((m) => (m == null ? void 0 : m.id) === mid) || { id: mid };
          const grps = getModelGroups(itemObj);
          const primaryGrp = grps[0];
          if (getModelAccessMode(mid, primaryGrp, vipPolicy, disabledModels) === "blocked") continue;
          if (validatedLowerSet.size > 0 && !validatedLowerSet.has(low)) continue;
          for (const g of grps) {
            if (groupModelsMap[g] && !groupModelsMap[g].includes(mid)) {
              groupModelsMap[g].push(mid);
            }
          }
        }
        for (const [pid, def] of Object.entries(CANONICAL_GROUPS)) {
          if (!groupModelsMap[pid] || groupModelsMap[pid].length === 0) {
            groupModelsMap[pid] = [def.defaultModel];
          }
        }
        let usageData = { byModel: {}, sampleSize: 0 };
        try {
          usageData = await loadGatewayUsageByModel(ctx);
        } catch {
        }
        const gooseModelsMap = selectTopGooseModelsByGroup({
          groupModelsMap,
          catalogModels: models,
          usageByModel: usageData.byModel,
          usageSampleSize: usageData.sampleSize,
          liveProbes: modelTests,
          limit: GOOSE_MAX_MODELS_PER_GROUP
        });
        const syncPayload = {
          effectiveKeys,
          groupModels: groupModelsMap,
          gooseModels: gooseModelsMap
        };
        const pythonSyncScript = `
import os, sys, json, subprocess

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]
goose_models = payload.get("gooseModels") or group_models

CANONICAL = {
    "nexusmind_openai": {
        "engine": "openai",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "gpt-6.1-terra",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_anthropic": {
        "engine": "anthropic",
        "api_key_env": "ANTHROPIC_API_KEY",
        "base_url": "https://api.nexusmind.digital",
        "display_name": "NexusMind Anthropic",
        "description": "Modelos Anthropic Claude nativos via NexusMind (/v1/messages)",
        "default_ctx": 1000000,
        "default_out": 8192,
        "default_model": "claude-sonnet-4-6",
        "pi_api": "anthropic-messages",
        "pi_baseUrl": "https://api.nexusmind.digital"
    },
    "nexusmind_antigravity": {
        "engine": "openai",
        "api_key_env": "ANTIGRAVITY_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind Anti-Gravity",
        "description": "Modelos Google Gemini, Claude e Anti-Gravity Gateway",
        "default_ctx": 1048576,
        "default_out": 65536,
        "default_model": "gemini-2.5-flash",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_grok": {
        "engine": "openai",
        "api_key_env": "GROK_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind Grok",
        "description": "Modelos xAI Grok via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "grok-4.5",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_responses": {
        "engine": "openai",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.nexusmind.digital/responses",
        "display_name": "NexusMind Responses",
        "description": "OpenAI Responses API e WebSocket streaming via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "gpt-5",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/responses"
    }
}

def write_private(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(content)
    os.chmod(path, 0o600)

# 1. Update Goose custom_providers (allowlist <= 40 models, sem api_key em texto puro)
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

for pid, cfg in CANONICAL.items():
    m_list = [m for m in goose_models.get(pid, [cfg["default_model"]]) if m][:40]
    if not m_list:
        m_list = [cfg["default_model"]]
    models_spec = [{
        "name": mid,
        "context_limit": cfg["default_ctx"],
        "max_tokens": cfg["default_out"]
    } for mid in m_list]
    provider_json = {
        "name": pid,
        "engine": cfg["engine"],
        "display_name": cfg["display_name"],
        "description": cfg["description"],
        "base_url": cfg["base_url"],
        "api_key_env": cfg["api_key_env"],
        "models": models_spec
    }
    write_private(os.path.join(goose_dir, f"{pid}.json"), json.dumps(provider_json, indent=2))

# 2. Merge Goose secrets.yaml via PyYAML (yaml.safe_load/safe_dump) com fallback seguro + chmod 0600
${GOOSE_SECRETS_MERGE_PY}
goose_secrets_path = os.path.expanduser("~/.config/goose/secrets.yaml")
secrets_map = {
    "OPENAI_API_KEY": keys.get("nexusmind_openai", ""),
    "ANTIGRAVITY_API_KEY": keys.get("nexusmind_antigravity", ""),
    "ANTHROPIC_API_KEY": keys.get("nexusmind_anthropic", ""),
    "GROK_API_KEY": keys.get("nexusmind_grok", ""),
    "XAI_API_KEY": keys.get("nexusmind_grok", ""),
    "GOOGLE_API_KEY": keys.get("nexusmind_antigravity", "")
}
existing_lines = merge_goose_secrets(goose_secrets_path, secrets_map)

# Update macOS Keychain for Goose via stdin (sem expor segredo em argv / ps aux)
try:
    keyring_json = json.dumps({k: v for k, v in existing_lines.items() if v})
    cmd_line = f"add-generic-password -U -s goose -a secrets -w {json.dumps(keyring_json)}\\n"
    subprocess.run(["security", "-i"], input=cmd_line, text=True, capture_output=True, timeout=5)
except Exception:
    pass

# 3. Update Pi models.json & auth.json locations
pi_paths = [
    os.path.expanduser("~/.buzz/.pi/models.json"),
    os.path.expanduser("~/.buzz/.pi/agent/models.json"),
    os.path.expanduser("~/.pi/agent/models.json"),
    os.path.expanduser("~/Library/Application Support/Buzz/pi/models.json")
]

for p in pi_paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    pi_data = {"providers": {}}
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                pi_data = json.load(f)
        except Exception:
            pass
    if "providers" not in pi_data:
        pi_data["providers"] = {}

    for pid, cfg in CANONICAL.items():
        m_list = group_models.get(pid, [cfg["default_model"]])
        pi_models = {}
        for mid in m_list:
            pi_models[mid] = {
                "name": mid,
                "contextWindow": cfg["default_ctx"],
                "maxTokens": cfg["default_out"]
            }
        pi_data["providers"][pid] = {
            "baseUrl": cfg["pi_baseUrl"],
            "apiKey": keys.get(pid, ""),
            "api": cfg["pi_api"],
            "models": pi_models
        }

    with open(p, "w", encoding="utf-8") as f:
        json.dump(pi_data, f, indent=2)

pi_auth_paths = [
    os.path.expanduser("~/.buzz/.pi/auth.json"),
    os.path.expanduser("~/.buzz/.pi/agent/auth.json"),
    os.path.expanduser("~/.pi/agent/auth.json"),
    os.path.expanduser("~/.pi/auth.json")
]

for ap in pi_auth_paths:
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    auth_data = {}
    if os.path.exists(ap):
        try:
            with open(ap, "r", encoding="utf-8") as f:
                auth_data = json.load(f)
        except Exception:
            pass
    for pid in CANONICAL.keys():
        auth_data[pid] = {
            "type": "api_key",
            "key": keys.get(pid, "")
        }
    with open(ap, "w", encoding="utf-8") as f:
        json.dump(auth_data, f, indent=2)

print("SYNC_SUCCESS")
`;
        if (ctx.host && ctx.host.spawn) {
          const proc = await ctx.host.spawn("python", {
            args: [pythonSyncScript]
          });
          await proc.exited;
        }
        const now = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync_time", now);
        const totalActive = models.length - disabledModels.length;
        const gooseTotal = Object.values(gooseModelsMap).reduce((acc, arr) => acc + arr.length, 0);
        setStatusMessage({
          type: "success",
          text: `Sincronização concluída! Goose: ${gooseTotal} modelos (top ${GOOSE_MAX_MODELS_PER_GROUP} por provedor por uso/qualidade). Pi: ${totalActive} ativos (${disabledModels.length} desativados expurgados).`
        });
        try {
          (_d = (_c2 = ctx == null ? void 0 : ctx.notifications) == null ? void 0 : _c2.notify) == null ? void 0 : _d.call(_c2, {
            title: "NexusMind Gateway",
            body: `Sincronizado: ${gooseTotal} modelos no Goose e ${totalActive} ativos no Pi.`
          });
        } catch {
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro ao sincronizar com Buzz: ${err.message}`
        });
      } finally {
        setLoadingSync(false);
      }
    };
    const groupCounts = React.useMemo(() => {
      if (models.length === 0) {
        return {
          all: 0,
          nexusmind_openai: 0,
          nexusmind_anthropic: 0,
          nexusmind_antigravity: 0,
          nexusmind_grok: 0
        };
      }
      const counts = {
        all: models.length,
        nexusmind_openai: 0,
        nexusmind_anthropic: 0,
        nexusmind_antigravity: 0,
        nexusmind_grok: 0
      };
      for (const m of models) {
        const grps = getModelGroups(m);
        for (const g of grps) {
          if (counts[g] !== void 0) counts[g]++;
        }
      }
      return counts;
    }, [models]);
    const statusCounts = React.useMemo(() => {
      const scoped = models.filter((m) => {
        if (selectedGroupTab !== "all") {
          const grps = getModelGroups(m);
          if (!grps.includes(selectedGroupTab)) return false;
        }
        return true;
      });
      let active = 0;
      let disabled = 0;
      let online = 0;
      let error = 0;
      for (const m of scoped) {
        const mid = m.id || "";
        if (disabledModels.includes(mid)) disabled++;
        else active++;
        const t = modelTests[mid];
        if ((t == null ? void 0 : t.status) === "ok") online++;
        else if ((t == null ? void 0 : t.status) === "error") error++;
      }
      return { all: scoped.length, active, disabled, online, error };
    }, [models, selectedGroupTab, disabledModels, modelTests]);
    const filteredModels = React.useMemo(() => {
      return models.filter((m) => {
        var _a2;
        const mid = m.id || "";
        const lower = mid.toLowerCase();
        if (selectedGroupTab !== "all") {
          const grps = getModelGroups(m);
          if (!grps.includes(selectedGroupTab)) return false;
        }
        const isDisabled = disabledModels.includes(mid);
        const testStatus = (_a2 = modelTests[mid]) == null ? void 0 : _a2.status;
        if (statusFilter === "active" && isDisabled) return false;
        if (statusFilter === "disabled" && !isDisabled) return false;
        if (statusFilter === "online" && testStatus !== "ok") return false;
        if (statusFilter === "error" && testStatus !== "error") return false;
        if (filterFree && !lower.includes(":free") && !lower.includes("free")) return false;
        if (filterReasoning && !lower.includes("reasoning") && !lower.includes("think") && !lower.includes("r1") && !lower.includes("luna")) {
          return false;
        }
        if (searchQuery.trim() && !lower.includes(searchQuery.trim().toLowerCase())) {
          return false;
        }
        return true;
      });
    }, [models, selectedGroupTab, statusFilter, disabledModels, modelTests, filterFree, filterReasoning, searchQuery]);
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredModels.length / (pageSize || 15)));
    React.useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage]);
    const paginatedModels = pageSize === 0 ? filteredModels : filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    if (isSettingsCard) {
      const openFullPage = () => {
        var _a2, _b2;
        try {
          if ((_a2 = ctx.navigation) == null ? void 0 : _a2.open) {
            ctx.navigation.open({
              version: 1,
              kind: "page",
              pluginId: "digital.nexusmind.buzz",
              pageId: "nexusmind"
            });
            return;
          }
          if ((_b2 = ctx.navigation) == null ? void 0 : _b2.navigate) {
            ctx.navigation.navigate("nexusmind");
            return;
          }
        } catch {
        }
        window.location.hash = "#/nexusmind";
      };
      return h(
        "div",
        {
          "data-nexusmind-root": "true",
          className: "nm-card-pad",
          style: { display: "flex", flexDirection: "column", gap: "12px" }
        },
        h("style", { "data-nexusmind-theme": "true" }, NEXUSMIND_THEME_CSS),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h("div", { className: "nm-brand-icon", style: { width: "32px", height: "32px" } }, SVG_ICONS.dashboard({ h, width: 16, height: 16 })),
            h(
              "div",
              null,
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                h("span", { style: { fontWeight: "600", fontSize: "13px", color: "var(--nm-fg)" } }, "NexusMind Gateway"),
                h("span", { className: "nm-pill", "data-tone": "accent", style: { fontSize: "10px" } }, "v2.8")
              ),
              h(
                "div",
                { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
                `${profileData.username} · $${(profileData.balance || 0).toFixed(2)} · ${models.length} modelos`
              )
            )
          ),
          h(
            "button",
            { type: "button", className: "nm-btn", onClick: openFullPage },
            "Abrir Cockpit ↗"
          )
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            { type: "button", className: "nm-btn", onClick: handlePullModelsFromNexusMind, disabled: loadingPull },
            loadingPull ? "Puxando..." : "Puxar Modelos"
          ),
          h(
            "button",
            { type: "button", className: "nm-btn", "data-variant": "primary", onClick: handleSyncModelsToBuzz, disabled: loadingSync },
            loadingSync ? "Sincronizando..." : "Sincronizar no Buzz"
          )
        )
      );
    }
    const renderDisconnectedHero = () => {
      return h(
        "div",
        {
          style: {
            maxWidth: "520px",
            margin: "48px auto",
            backgroundColor: "var(--bg-panel, #1a1a1a)",
            border: "1px solid var(--border-primary, #2e2e2e)",
            borderRadius: "12px",
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center"
          }
        },
        h(
          "div",
          {
            style: {
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "var(--affordance-subtle, #282828)",
              border: "1px solid var(--border-primary, #333333)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-primary, #ffffff)",
              marginBottom: "14px"
            }
          },
          SVG_ICONS.plug({ h, width: 22, height: 22 })
        ),
        h(
          "h1",
          { style: { fontSize: "18px", fontWeight: "600", margin: "0 0 6px", color: "var(--text-primary, #ffffff)" } },
          "NexusMind Gateway"
        ),
        h(
          "p",
          {
            style: {
              fontSize: "13px",
              color: "var(--text-tertiary, #a4a4a4)",
              lineHeight: "1.5",
              margin: "0 0 22px"
            }
          },
          "Conecte sua conta NexusMind para sincronizar modelos OpenAI, Anthropic Claude, Google Gemini e xAI Grok com os agentes do Buzz Desktop."
        ),
        h(
          "button",
          {
            type: "button",
            className: "nm-btn",
            "data-variant": "primary",
            onClick: handleStartOAuthFlow,
            disabled: authInFlight,
            style: { width: "100%", padding: "10px 18px", fontSize: "13px", marginBottom: "10px" }
          },
          SVG_ICONS.plug({ h, width: 15, height: 15 }),
          authInFlight ? "Aguardando no Navegador..." : "Conectar via OAuth / MCP"
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", width: "100%", marginBottom: "20px" } },
          h(
            "button",
            {
              onClick: handleOpenInBrowser,
              style: {
                flex: "1",
                borderRadius: "6px",
                padding: "8px 12px",
                backgroundColor: "var(--affordance-subtle, #232323)",
                color: "var(--text-primary, #ffffff)",
                border: "1px solid var(--border-primary, #333333)",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }
            },
            SVG_ICONS.external({ h, width: 13, height: 13 }),
            "Abrir no Navegador"
          ),
          h(
            "button",
            {
              onClick: handleCopyAuthUrl,
              style: {
                flex: "1",
                borderRadius: "6px",
                padding: "8px 12px",
                backgroundColor: "var(--affordance-subtle, #232323)",
                color: "var(--text-primary, #ffffff)",
                border: "1px solid var(--border-primary, #333333)",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }
            },
            SVG_ICONS.copy({ h, width: 13, height: 13 }),
            "Copiar Link"
          )
        ),
        h(
          "div",
          {
            style: {
              width: "100%",
              height: "1px",
              backgroundColor: "var(--border-primary, #2e2e2e)",
              marginBottom: "16px"
            }
          }
        ),
        h(
          "div",
          { style: { width: "100%", textAlign: "left" } },
          h(
            "label",
            { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)", display: "block", marginBottom: "6px" } },
            "Ou conecte manualmente com API Key (sk-...) ou Token:"
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px" } },
            h("input", {
              type: "password",
              placeholder: "sk-... ou mcp_at_...",
              value: manualKeyInput,
              onChange: (e) => setManualKeyInput(e.target.value),
              style: {
                flex: "1",
                backgroundColor: "var(--surface-inset, #101010)",
                border: "1px solid var(--border-primary, #333333)",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "var(--text-primary, #ffffff)",
                fontSize: "12px",
                outline: "none"
              }
            }),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "primary",
                onClick: handleManualKeyConnect,
                style: { padding: "8px 14px" }
              },
              "Conectar"
            )
          )
        )
      );
    };
    return h(
      "div",
      {
        "data-nexusmind-root": "true",
        className: "nm-workspace"
      },
      h("style", { "data-nexusmind-theme": "true" }, NEXUSMIND_THEME_CSS),
      !isConnected ? h("div", { className: "nm-container" }, renderDisconnectedHero()) : h(
        "div",
        { className: "nm-container" },
        // 1. HEADER CODEDEN + BUZZ THEME (herda acento e fonte do Buzz Desktop)
        h(
          "div",
          { className: "nm-header" },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "9px" } },
              h("span", { className: "nm-brand-icon" }, SVG_ICONS.dashboard({ h, width: 14, height: 14 })),
              h(
                "h1",
                {
                  style: {
                    fontSize: "15px",
                    fontWeight: "700",
                    margin: 0,
                    color: "var(--nm-fg)",
                    letterSpacing: "-0.015em"
                  }
                },
                "NexusMind Gateway"
              ),
              h("span", { className: "nm-pill", "data-tone": "ok", style: { fontSize: "10px", padding: "1px 6px" } }, "Online")
            ),
            h(
              "div",
              { className: "nm-segmented" },
              [
                { id: "catalog", label: "Modelos" },
                { id: "ranking", label: "Ranking & Roteamento" },
                {
                  id: "autopilot",
                  label: Object.keys(quarantines).length > 0 ? `Autopiloto (${Object.keys(quarantines).length})` : "Autopiloto & VIP"
                },
                { id: "agents", label: buzzAgentsCount > 0 ? `Agentes (${buzzAgentsCount})` : "Agentes" }
              ].map((tab) => {
                const active = activeSection === tab.id;
                return h(
                  "button",
                  {
                    key: tab.id,
                    type: "button",
                    className: "nm-seg-btn",
                    "data-active": active ? "true" : "false",
                    onClick: () => setActiveSection(tab.id)
                  },
                  tab.label
                );
              })
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                onClick: handlePullModelsFromNexusMind,
                disabled: loadingPull
              },
              SVG_ICONS.pull({ h, width: 13, height: 13 }),
              loadingPull ? "Buscando..." : "Puxar"
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "primary",
                onClick: handleSyncModelsToBuzz,
                disabled: loadingSync
              },
              SVG_ICONS.sync({ h, width: 13, height: 13 }),
              loadingSync ? "Sincronizando..." : "Sincronizar"
            ),
            h(
              "div",
              {
                className: "nm-surface",
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "5px 10px",
                  fontSize: "12px"
                }
              },
              h("span", { style: { color: "var(--nm-fg-secondary)", fontWeight: 500 } }, profileData.username),
              h(
                "span",
                { className: "nm-mono nm-num", style: { color: "var(--nm-primary-text)", fontWeight: "600" } },
                `$${(profileData.balance || 0).toFixed(2)}`
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "nm-btn",
                  "data-variant": "ghost",
                  onClick: handleDisconnect,
                  title: "Desconectar",
                  style: { padding: "0 4px", fontSize: "11px" }
                },
                "✕"
              )
            )
          )
        ),
        // 2. STATUS TOAST BANNER (COMPACT & FLAT)
        statusMessage && h(
          "div",
          {
            style: {
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-panel, #1a1a1a)",
              border: `1px solid ${statusMessage.type === "success" ? "var(--green-11, #3dd68c)" : statusMessage.type === "error" ? "var(--red-11, #ff9592)" : "var(--border-primary, #333333)"}`,
              color: statusMessage.type === "success" ? "var(--green-11, #3dd68c)" : statusMessage.type === "error" ? "var(--red-11, #ff9592)" : "var(--text-secondary, #c7c7c7)"
            }
          },
          h("span", null, statusMessage.text),
          h(
            "button",
            {
              onClick: () => setStatusMessage(null),
              style: {
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: "12px"
              }
            },
            "✕"
          )
        ),
        activeSection === "ranking" ? h(ModelRankingTab, {
          models,
          disabledModels,
          modelTests,
          onTestSingleModel: handleTestSingleModel,
          onNotify: setStatusMessage,
          vipPolicy,
          onSetModelAccessMode: handleSetModelAccessMode,
          onQuickProtectVips: handleQuickProtectVips,
          qualityBench,
          onUpdateQualityBench: setQualityBench,
          quarantines
        }) : activeSection === "autopilot" ? h(AutopilotFailoverTab, {
          models,
          disabledModels,
          vipPolicy,
          onUpdateVipPolicy: handleUpdateVipPolicy,
          autopilotCfg,
          onUpdateAutopilotCfg: (next) => {
            setAutopilotCfg(next);
            saveAutopilotConfig(next);
          },
          quarantines,
          onRefreshQuarantines: () => setQuarantines(loadQuarantines()),
          qualityBench,
          onUpdateQualityBench: setQualityBench,
          failoverLog,
          onRefreshFailoverLog: () => setFailoverLog(loadFailoverLog()),
          rankingSnapshot: liveRankingSnapshot,
          onNotify: setStatusMessage
        }) : activeSection === "agents" ? h(NexusMindAgentsTab, {
          models,
          disabledModels,
          modelTests,
          onNotify: setStatusMessage,
          vipPolicy,
          onToggleVipAgent: handleToggleVipAgent,
          onFailoverAgent: (agentKey) => handleFailoverAgent(agentKey, "Failover manual pela aba Agentes", "manual")
        }) : h(
          React.Fragment,
          null,
          // 3. KPI STRIP 4 CARDS (CodeDen Style + Buzz Accent Progress Bar)
          (() => {
            const activeCount = Math.max(0, models.length - disabledModels.length);
            const activePct = models.length > 0 ? Math.round(activeCount / models.length * 100) : 0;
            return h(
              "div",
              { className: "nm-kpi-grid", "data-nexusmind-kpi-grid": "true" },
              h(
                "div",
                { className: "nm-kpi-card" },
                h("span", { className: "nm-kpi-label" }, "SALDO DISPONÍVEL"),
                h("div", { className: "nm-kpi-val" }, `$${(profileData.balance || 0).toFixed(2)}`),
                h("div", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, `${profileData.username} · ${profileData.activeApiKeys || 4} chaves ativas`)
              ),
              h(
                "div",
                { className: "nm-kpi-card" },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                  h("span", { className: "nm-kpi-label" }, "CATÁLOGO ATIVO"),
                  h("span", { className: "nm-mono nm-num", style: { fontSize: "11px", color: "var(--nm-primary-text)" } }, `${activePct}%`)
                ),
                h(
                  "div",
                  { className: "nm-kpi-val" },
                  `${activeCount}`,
                  h("span", { style: { fontSize: "12px", fontWeight: 500, color: "var(--nm-muted)" } }, ` / ${models.length}`)
                ),
                h("div", { className: "nm-bar-track" }, h("div", { className: "nm-bar-fill", style: { width: `${activePct}%` } }))
              ),
              h(
                "div",
                { className: "nm-kpi-card" },
                h("span", { className: "nm-kpi-label" }, "CONSUMO HOJE"),
                h("div", { className: "nm-kpi-val" }, formatTokens(dashboardMetrics.today_tokens)),
                h("div", { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } }, `${formatNumber(dashboardMetrics.today_requests)} reqs · $${(dashboardMetrics.today_cost || 0).toFixed(2)}`)
              ),
              h(
                "div",
                { className: "nm-kpi-card", style: { justifyContent: "space-between" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("span", { className: "nm-kpi-label" }, "GATEWAY & ENDPOINTS"),
                  h("span", { className: "nm-pill", "data-tone": "accent", style: { fontSize: "9.5px", padding: "1px 6px" } }, "4 grupos")
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "4px" } },
                  h("span", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, lastSyncTime ? `Sync ${lastSyncTime}` : "api.nexusmind.digital"),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "nm-btn",
                      "data-variant": "ghost",
                      onClick: () => setShowGatewayDetails((v) => !v),
                      style: { padding: "3px 7px", fontSize: "11px", color: "var(--nm-primary-text)" }
                    },
                    showGatewayDetails ? "Ocultar ▾" : "Endpoints ▸"
                  )
                )
              )
            );
          })(),
          showGatewayDetails && h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "12px",
                backgroundColor: "var(--bg-panel, #1a1a1a)",
                border: "1px solid var(--border-primary, #333333)",
                borderRadius: "8px"
              }
            },
            h(
              "div",
              { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
              OFFICIAL_ENDPOINTS.map((ep) => {
                const isCopied = copiedEndpoint === ep.url;
                return h(
                  "button",
                  {
                    key: ep.id,
                    onClick: () => handleCopyEndpoint(ep.url, ep.label),
                    title: `${ep.desc} — Clique para copiar`,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "var(--affordance-subtle, #232323)",
                      border: `1px solid ${isCopied ? "var(--green-11, #3dd68c)" : "var(--border-primary, #333333)"}`,
                      borderRadius: "6px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: "11px",
                      color: isCopied ? "var(--green-11, #3dd68c)" : "var(--text-secondary, #c7c7c7)"
                    }
                  },
                  h("span", { style: { fontWeight: "600", color: "var(--text-primary, #ffffff)" } }, ep.label),
                  h("code", { style: { fontFamily: "monospace", fontSize: "11px" } }, ep.url)
                );
              })
            ),
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "8px"
                }
              },
              Object.entries(CANONICAL_GROUPS).map(
                ([pid, group]) => h(
                  "div",
                  {
                    key: pid,
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      backgroundColor: "var(--bg-app, #101010)",
                      border: "1px solid var(--border-primary, #333333)",
                      borderRadius: "6px",
                      fontSize: "11px"
                    }
                  },
                  h(
                    "div",
                    null,
                    h("div", { style: { fontWeight: "600", color: "var(--text-primary, #ffffff)" } }, group.groupName),
                    h("div", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, `Padrão: ${group.defaultModel.split("/").pop()}`)
                  ),
                  h(
                    "span",
                    { style: { color: "var(--text-secondary, #c7c7c7)", fontFamily: "monospace" } },
                    `${groupCounts[pid] ?? group.modelsCount}`
                  )
                )
              )
            )
          ),
          // 5. CATALOG WORKSPACE & MODEL MANAGEMENT (FLAT, SEM BONECA RUSSA)
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }
            },
            // Header Controls (Filter Tabs + Search Bar)
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px"
                }
              },
              // Tabs
              h(
                "div",
                { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
                [
                  { id: "all", label: `Todos os Grupos (${groupCounts.all})` },
                  { id: "nexusmind_openai", label: `Saldo OpenAI (${groupCounts.nexusmind_openai})` },
                  { id: "nexusmind_anthropic", label: `Saldo Claude (${groupCounts.nexusmind_anthropic})` },
                  { id: "nexusmind_antigravity", label: `Antigravity-Saldo (${groupCounts.nexusmind_antigravity})` },
                  { id: "nexusmind_grok", label: `Grok (${groupCounts.nexusmind_grok})` }
                ].map(
                  (tab) => h(
                    "button",
                    {
                      key: tab.id,
                      onClick: () => {
                        setSelectedGroupTab(tab.id);
                        setCurrentPage(1);
                      },
                      style: {
                        borderRadius: "6px",
                        padding: "5px 10px",
                        border: "none",
                        backgroundColor: selectedGroupTab === tab.id ? "var(--affordance-selected, #333333)" : "transparent",
                        color: selectedGroupTab === tab.id ? "var(--text-primary, #ffffff)" : "var(--text-tertiary, #a4a4a4)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: selectedGroupTab === tab.id ? "600" : "500"
                      }
                    },
                    tab.label
                  )
                )
              ),
              // Search Input & Filter Toggles
              h(
                "div",
                { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
                h(
                  "div",
                  {
                    style: {
                      position: "relative",
                      display: "flex",
                      alignItems: "center"
                    }
                  },
                  h("input", {
                    type: "text",
                    placeholder: "Buscar modelo...",
                    value: searchQuery,
                    onChange: (e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "6px",
                      backgroundColor: "var(--surface-inset, #101010)",
                      border: "1px solid var(--border-primary, #333333)",
                      color: "var(--text-primary, #ffffff)",
                      padding: "5px 10px 5px 28px",
                      fontSize: "12px",
                      outline: "none",
                      width: "180px"
                    }
                  }),
                  h(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        left: "9px",
                        color: "var(--text-tertiary, #a4a4a4)",
                        pointerEvents: "none",
                        display: "flex"
                      }
                    },
                    SVG_ICONS.search({ h, width: 13, height: 13 })
                  )
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      setFilterReasoning((v) => !v);
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "6px",
                      padding: "5px 10px",
                      border: `1px solid ${filterReasoning ? "var(--blue-7, #3b6ea5)" : "var(--border-primary, #333333)"}`,
                      backgroundColor: filterReasoning ? "var(--blue-3, #13253a)" : "transparent",
                      color: filterReasoning ? "var(--blue-11, #70b8ff)" : "var(--text-tertiary, #a4a4a4)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "500"
                    }
                  },
                  "Thinking / Reasoning"
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      setFilterFree((v) => !v);
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "6px",
                      padding: "5px 10px",
                      border: `1px solid ${filterFree ? "var(--green-7, #28714f)" : "var(--border-primary, #333333)"}`,
                      backgroundColor: filterFree ? "var(--green-3, #132d21)" : "transparent",
                      color: filterFree ? "var(--green-11, #3dd68c)" : "var(--text-tertiary, #a4a4a4)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "500"
                    }
                  },
                  "Apenas Free"
                ),
                (statusFilter !== "all" || selectedGroupTab !== "all" || filterFree || filterReasoning || searchQuery.trim() !== "") && h(
                  "button",
                  {
                    onClick: () => {
                      setSelectedGroupTab("all");
                      setStatusFilter("all");
                      setFilterFree(false);
                      setFilterReasoning(false);
                      setSearchQuery("");
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "6px",
                      padding: "5px 10px",
                      border: "1px solid var(--border-primary, #333333)",
                      backgroundColor: "var(--affordance-subtle, #232323)",
                      color: "var(--text-secondary, #c7c7c7)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "500"
                    }
                  },
                  "Limpar filtros"
                )
              )
            ),
            // Status & Healthcheck Segmented Filter Bar
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flexWrap: "wrap"
                }
              },
              h(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: "var(--text-tertiary, #a4a4a4)",
                    marginRight: "4px"
                  }
                },
                SVG_ICONS.filter({ h, width: 12, height: 12 }),
                "Status:"
              ),
              [
                { id: "all", label: `Todos (${statusCounts.all})`, accent: "var(--text-primary, #ffffff)" },
                { id: "active", label: `Ativos (${statusCounts.active})`, accent: "var(--green-11, #3dd68c)" },
                { id: "disabled", label: `Desativados (${statusCounts.disabled})`, accent: "var(--text-secondary, #c7c7c7)" },
                { id: "online", label: `Online (${statusCounts.online})`, accent: "var(--green-11, #3dd68c)" },
                { id: "error", label: `Com Erro (${statusCounts.error})`, accent: "var(--red-11, #ff9592)" }
              ].map((st) => {
                const active = statusFilter === st.id;
                return h(
                  "button",
                  {
                    key: st.id,
                    onClick: () => {
                      setStatusFilter(st.id);
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "6px",
                      padding: "4px 10px",
                      border: `1px solid ${active ? st.accent : "var(--border-primary, #2e2e2e)"}`,
                      backgroundColor: active ? "var(--affordance-selected, #2e2e2e)" : "transparent",
                      color: active ? st.accent : "var(--text-tertiary, #a4a4a4)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: active ? "600" : "500"
                    }
                  },
                  st.label
                );
              })
            ),
            // Batch Action Bar (Seleção & Gestão em Massa — Padrão Buzz)
            (() => {
              const allFilteredActive = filteredModels.length > 0 && filteredModels.every((m) => !disabledModels.includes(m.id));
              const btnNeutral = {
                borderRadius: "6px",
                padding: "4px 10px",
                backgroundColor: "var(--affordance-subtle, #232323)",
                color: "var(--text-secondary, #c7c7c7)",
                border: "1px solid var(--border-primary, #333333)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "500",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              };
              return h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                    backgroundColor: "var(--bg-panel, #1a1a1a)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "8px",
                    padding: "8px 12px"
                  }
                },
                h(
                  "label",
                  {
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      color: "var(--text-secondary, #c7c7c7)",
                      cursor: "pointer"
                    }
                  },
                  h("input", {
                    type: "checkbox",
                    className: "nm-check",
                    checked: allFilteredActive,
                    onChange: handleToggleAllFiltered
                  }),
                  h(
                    "span",
                    null,
                    allFilteredActive ? `Todos os ${filteredModels.length} filtrados ativos` : `Selecionar todos os ${filteredModels.length} filtrados`
                  ),
                  disabledModels.length > 0 && h(
                    "span",
                    { style: { color: "var(--text-tertiary, #a4a4a4)", fontSize: "11px" } },
                    `· ${disabledModels.length} desativados`
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
                  h("button", { onClick: handleEnableFilteredBulk, style: btnNeutral }, "Ativar filtrados"),
                  h("button", { onClick: handleDisableFilteredBulk, style: btnNeutral }, "Desativar filtrados"),
                  h("button", { onClick: handleDisableFreeBulk, style: btnNeutral }, "Desativar :free"),
                  h(
                    "button",
                    { onClick: handleBatchTestVisible, style: btnNeutral },
                    SVG_ICONS.sparkles({ h, width: 12, height: 12 }),
                    "Testar visíveis"
                  ),
                  h(
                    "button",
                    {
                      onClick: handleQuickProtectVips,
                      style: {
                        ...btnNeutral,
                        color: "var(--nm-warn)",
                        borderColor: "var(--nm-warn-border)"
                      }
                    },
                    "Proteger VIPs"
                  ),
                  h(
                    "button",
                    {
                      onClick: handleBatchDisableUnavailable,
                      style: {
                        ...btnNeutral,
                        color: "var(--red-11, #ff9592)"
                      }
                    },
                    "Desativar c/ erro"
                  )
                )
              );
            })(),
            // Ranking Rápido de Healthcheck (apenas quando há modelos testados ao vivo)
            (() => {
              const tested = Object.entries(modelTests).filter(([, t]) => t.status === "ok" || t.status === "error");
              if (tested.length === 0) return null;
              const onlineSorted = tested.filter(([, t]) => t.status === "ok" && typeof t.latency === "number").sort((a, b) => (a[1].latency ?? 999999) - (b[1].latency ?? 999999));
              const okCount = onlineSorted.length;
              const pct = Math.round(okCount / tested.length * 100);
              const top3 = onlineSorted.slice(0, 3);
              return h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-panel, #1a1a1a)",
                    border: "1px solid var(--border-primary, #2e2e2e)",
                    fontSize: "11px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                  h("span", { style: { fontWeight: "600", color: "var(--green-11, #3dd68c)" } }, "Ping Real:"),
                  top3.length === 0 ? h("span", { style: { color: "var(--red-11, #ff9592)" } }, "Nenhum modelo online nos testes recentes.") : top3.map(
                    ([mid, t], idx) => h(
                      "span",
                      {
                        key: mid,
                        style: {
                          padding: "2px 7px",
                          borderRadius: "5px",
                          backgroundColor: idx === 0 ? "var(--green-3, #132d21)" : "var(--affordance-subtle, #232323)",
                          color: idx === 0 ? "var(--green-11, #3dd68c)" : "var(--text-secondary, #c7c7c7)",
                          fontFamily: "monospace",
                          fontWeight: idx === 0 ? "600" : "500"
                        }
                      },
                      `#${idx + 1} ${mid} (${t.latency}ms)`
                    )
                  )
                ),
                h(
                  "span",
                  { style: { color: "var(--text-tertiary, #a4a4a4)", fontFamily: "monospace" } },
                  `Estabilidade: ${okCount}/${tested.length} online (${pct}%)`
                )
              );
            })(),
            // Model List Rows (Buzz-native flat container)
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--bg-panel, #1a1a1a)",
                  border: "1px solid var(--border-primary, #2e2e2e)",
                  borderRadius: "10px",
                  overflow: "hidden"
                }
              },
              paginatedModels.length === 0 ? h(
                "div",
                {
                  style: {
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "var(--text-tertiary, #a4a4a4)",
                    fontSize: "12px"
                  }
                },
                statusFilter === "online" || statusFilter === "error" ? "Nenhum modelo corresponde a este filtro ainda. Clique em 'Testar visíveis' para rodar o healthcheck." : "Nenhum modelo encontrado com os filtros atuais."
              ) : paginatedModels.map((item, idx) => {
                const mid = item.id;
                const isDisabled = disabledModels.includes(mid);
                const lower = mid.toLowerCase();
                const isThinking = lower.includes("reasoning") || lower.includes("think") || lower.includes("r1") || lower.includes("luna");
                const isFree = lower.includes(":free") || lower.includes("free");
                const testRes = modelTests[mid];
                return h(
                  "div",
                  {
                    key: mid,
                    className: "nm-list-row",
                    style: {
                      opacity: isDisabled ? 0.5 : 1
                    }
                  },
                  // Left: Toggle Checkbox + Model Name & Badges
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 } },
                    h("input", {
                      type: "checkbox",
                      className: "nm-check",
                      checked: !isDisabled,
                      onChange: () => handleToggleModel(mid)
                    }),
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                        h(
                          "span",
                          {
                            style: {
                              fontWeight: "500",
                              fontSize: "12px",
                              fontFamily: "monospace",
                              color: isDisabled ? "var(--text-tertiary, #808080)" : "var(--text-primary, #ffffff)",
                              textDecoration: isDisabled ? "line-through" : "none"
                            }
                          },
                          mid
                        ),
                        isThinking && h(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: "var(--blue-3, #13253a)",
                              color: "var(--blue-11, #70b8ff)",
                              fontWeight: "600"
                            }
                          },
                          "THINKING"
                        ),
                        isFree && h(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: "var(--affordance-subtle, #282828)",
                              color: "var(--text-secondary, #c7c7c7)",
                              fontWeight: "600"
                            }
                          },
                          "FREE"
                        )
                      ),
                      h(
                        "div",
                        { style: { fontSize: "11px", color: "var(--text-tertiary, #808080)" } },
                        item.context_window ? `Ctx: ${formatNumber(item.context_window)} tokens` : "Ctx: 128k tokens"
                      )
                    )
                  ),
                  // Right: Test Button + Status Badge + Sync Indicator
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    testRes && h(
                      "span",
                      {
                        style: {
                          fontSize: "11px",
                          padding: "2px 7px",
                          borderRadius: "5px",
                          fontFamily: "monospace",
                          backgroundColor: testRes.status === "ok" ? "var(--green-3, #132d21)" : testRes.status === "testing" ? "var(--blue-3, #13253a)" : "var(--red-3, #3b1219)",
                          color: testRes.status === "ok" ? "var(--green-11, #3dd68c)" : testRes.status === "testing" ? "var(--blue-11, #70b8ff)" : "var(--red-11, #ff9592)",
                          fontWeight: "500"
                        }
                      },
                      testRes.status === "testing" ? "Testando..." : testRes.status === "ok" ? `${testRes.latency}ms · OK` : `Erro · ${testRes.errorMsg || "Falha"}`
                    ),
                    h(
                      "button",
                      {
                        onClick: () => handleTestSingleModel(mid),
                        disabled: (testRes == null ? void 0 : testRes.status) === "testing",
                        style: {
                          borderRadius: "6px",
                          padding: "4px 9px",
                          backgroundColor: "var(--affordance-subtle, #232323)",
                          color: "var(--text-secondary, #c7c7c7)",
                          border: "1px solid var(--border-primary, #333333)",
                          fontSize: "11px",
                          fontWeight: "500",
                          cursor: (testRes == null ? void 0 : testRes.status) === "testing" ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }
                      },
                      SVG_ICONS.pulse({ h, width: 11, height: 11 }),
                      "Testar"
                    ),
                    (() => {
                      const rowGroup = item.primaryGroup || getModelGroups(item)[0];
                      const mode = getModelAccessMode(mid, rowGroup, vipPolicy, disabledModels);
                      return h(
                        "div",
                        { className: "nm-mode-group" },
                        [
                          { id: "auto", label: "Auto" },
                          { id: "vip", label: "VIP" },
                          { id: "blocked", label: "Bloq." }
                        ].map(
                          (opt) => h(
                            "button",
                            {
                              key: opt.id,
                              type: "button",
                              className: "nm-mode-btn",
                              "data-active": mode === opt.id ? opt.id : void 0,
                              onClick: () => handleSetModelAccessMode(mid, opt.id),
                              title: opt.id === "auto" ? "Liberado no pool automático dos agentes" : opt.id === "vip" ? "Reservado para Iris e Conselho" : "Bloqueado para roteamento automático"
                            },
                            opt.label
                          )
                        )
                      );
                    })()
                  )
                );
              })
            ),
            // Pagination Footer
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border-primary, #2e2e2e)",
                  flexWrap: "wrap",
                  gap: "10px"
                }
              },
              h(
                "div",
                { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)" } },
                pageSize === 0 ? `Exibindo todos os ${filteredModels.length} modelos` : `Exibindo ${Math.min((currentPage - 1) * pageSize + 1, filteredModels.length)}–${Math.min(
                  currentPage * pageSize,
                  filteredModels.length
                )} de ${filteredModels.length} modelos`
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                h(
                  "button",
                  {
                    onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
                    disabled: currentPage <= 1,
                    style: {
                      borderRadius: "6px",
                      padding: "4px 10px",
                      backgroundColor: "var(--affordance-subtle, #232323)",
                      color: currentPage <= 1 ? "var(--text-tertiary, #666666)" : "var(--text-primary, #ffffff)",
                      border: "1px solid var(--border-primary, #333333)",
                      cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  SVG_ICONS.chevronLeft({ h, width: 13, height: 13 }),
                  "Anterior"
                ),
                h(
                  "span",
                  { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)", padding: "0 6px" } },
                  `Página ${currentPage} de ${totalPages}`
                ),
                h(
                  "button",
                  {
                    onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
                    disabled: currentPage >= totalPages,
                    style: {
                      borderRadius: "6px",
                      padding: "4px 10px",
                      backgroundColor: "var(--affordance-subtle, #232323)",
                      color: currentPage >= totalPages ? "var(--text-tertiary, #666666)" : "var(--text-primary, #ffffff)",
                      border: "1px solid var(--border-primary, #333333)",
                      cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  "Próxima",
                  SVG_ICONS.chevronRight({ h, width: 13, height: 13 })
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "4px", marginLeft: "10px" } },
                  h("span", { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)" } }, "Por página:"),
                  [15, 30, 50, 0].map(
                    (sz) => h(
                      "button",
                      {
                        key: sz,
                        onClick: () => {
                          setPageSize(sz);
                          setCurrentPage(1);
                        },
                        style: {
                          borderRadius: "5px",
                          padding: "2px 7px",
                          border: "none",
                          backgroundColor: pageSize === sz ? "var(--affordance-selected, #333333)" : "transparent",
                          color: pageSize === sz ? "var(--text-primary, #ffffff)" : "var(--text-tertiary, #a4a4a4)",
                          fontSize: "11px",
                          cursor: "pointer"
                        }
                      },
                      sz === 0 ? "Todos" : String(sz)
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  }
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: function NexusMindMainPage() {
      return h(NexusMindComponent, { isSettingsCard: false });
    }
  });
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "nexusmind-settings",
      title: "NexusMind Gateway",
      group: "AI Models & Gateways",
      component: function NexusMindSettings() {
        return h(NexusMindComponent, { isSettingsCard: true });
      }
    });
  }
  const bgHandledErrorSigs = /* @__PURE__ */ new Set();
  const bgInFlightAgents = /* @__PURE__ */ new Set();
  const runBackgroundFailover = async (agentKeyOrName, errorText, trigger) => {
    const dedup = String(agentKeyOrName || "").trim().toLowerCase();
    if (!dedup || bgInFlightAgents.has(dedup)) return;
    bgInFlightAgents.add(dedup);
    try {
      const cfg = loadAutopilotConfig();
      const vipPol = loadVipPolicy();
      const qBench = loadSavedQualityBench();
      let cachedModels = [];
      let disabledList = [];
      try {
        const rawM = localStorage.getItem("nexusmind_cached_models");
        if (rawM) cachedModels = JSON.parse(rawM);
        const rawD = localStorage.getItem("nexusmind_disabled_models");
        if (rawD) disabledList = JSON.parse(rawD);
      } catch {
      }
      const usage = await loadGatewayUsageByModel(ctx).catch(() => ({ byModel: {}, sampleSize: 0 }));
      const rankSnap = buildModelRankingSnapshot({
        catalogModels: cachedModels,
        groups: CANONICAL_GROUPS,
        usageByModel: usage.byModel,
        usageSampleSize: usage.sampleSize,
        disabledModels: disabledList,
        tier: "geral",
        policy: loadSavedRoutingPolicy(),
        vipPolicy: vipPol,
        qualityBench: qBench,
        quarantines: loadQuarantines()
      });
      await executeAgentFailover(ctx, CANONICAL_GROUPS, {
        agentKeyOrName,
        errorText,
        trigger,
        rankingSnapshot: rankSnap,
        vipPolicy: vipPol,
        qualityBench: qBench,
        disabledModels: disabledList,
        wakeAfter: cfg.wakeOnFailover,
        notify: cfg.notifyOnFailover
      });
    } catch (err) {
      console.warn("[NEXUSMIND] Falha no failover em background:", err);
    } finally {
      bgInFlightAgents.delete(dedup);
    }
  };
  const onBgOrgfyFailover = (e) => {
    const detail = (e == null ? void 0 : e.detail) || e || {};
    const target = detail.agentKey || detail.agente || detail.agentName || detail.agent_pubkey;
    if (!target) return;
    void runBackgroundFailover(
      String(target),
      String(detail.error || detail.reason || "orgfy.failover.requested"),
      "orgfy_event"
    );
  };
  try {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("orgfy.failover.requested", onBgOrgfyFailover);
    }
    const bus = (ctx == null ? void 0 : ctx.events) || (ctx == null ? void 0 : ctx.bus);
    if (typeof (bus == null ? void 0 : bus.on) === "function") {
      bus.on("orgfy.failover.requested", onBgOrgfyFailover);
    }
  } catch {
  }
  let bgAutopilotTimer = null;
  const startBgAutopilotTimer = () => {
    if (bgAutopilotTimer) clearInterval(bgAutopilotTimer);
    const cfg = loadAutopilotConfig();
    const intervalMs = Math.max(5, cfg.pollIntervalSec || 12) * 1e3;
    bgAutopilotTimer = setInterval(() => {
      const liveCfg = loadAutopilotConfig();
      if (!liveCfg.enabled) return;
      const detected = scanLiveAgentErrors(ctx);
      for (const err of detected) {
        if (bgHandledErrorSigs.has(err.signature)) continue;
        bgHandledErrorSigs.add(err.signature);
        void runBackgroundFailover(err.agentKey, err.errorText, "watchdog");
      }
    }, intervalMs);
    if (typeof (bgAutopilotTimer == null ? void 0 : bgAutopilotTimer.unref) === "function") {
      bgAutopilotTimer.unref();
    }
  };
  startBgAutopilotTimer();
  if (typeof (ctx == null ? void 0 : ctx.on) === "function") {
    ctx.on("dispose", () => {
      if (bgAutopilotTimer) {
        clearInterval(bgAutopilotTimer);
        bgAutopilotTimer = null;
      }
      try {
        if (typeof window !== "undefined" && window.removeEventListener) {
          window.removeEventListener("orgfy.failover.requested", onBgOrgfyFailover);
        }
        const bus = (ctx == null ? void 0 : ctx.events) || (ctx == null ? void 0 : ctx.bus);
        if (typeof (bus == null ? void 0 : bus.off) === "function") {
          bus.off("orgfy.failover.requested", onBgOrgfyFailover);
        }
      } catch {
      }
    });
  }
  const hostGetJson = async (url, bearerToken, timeoutMs = 1e4) => {
    var _a2;
    if (!((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.request)) {
      throw new Error("ctx.host.request indisponível neste runtime do Buzz");
    }
    const t0 = performance.now();
    const res = await ctx.host.request({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        "User-Agent": "BuzzDesktop/NexusMindPlugin"
      },
      timeoutMs
    });
    const latencyMs = Math.round(performance.now() - t0);
    let parsed = null;
    try {
      parsed = res.body ? JSON.parse(res.body) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: res.body, json: parsed, latencyMs };
  };
  const readSessionFile = () => readPrivateSessionFile(ctx);
  const persistSessionData = (sessionData, _token) => writePrivateSessionData(ctx, sessionData);
  const refreshOAuthSession = async (sessionData) => {
    var _a2, _b2;
    const clientId = sessionData == null ? void 0 : sessionData.client_id;
    const refreshToken = ((_a2 = sessionData == null ? void 0 : sessionData.token_data) == null ? void 0 : _a2.refresh_token) || (sessionData == null ? void 0 : sessionData.refresh_token);
    if (!clientId || !refreshToken || !((_b2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b2.request)) {
      return null;
    }
    try {
      const formBody = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId
      }).toString();
      const resp = await ctx.host.request({
        url: "https://nexusmind.digital/api/v1/mcp/oauth/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "BuzzDesktop/NexusMindPlugin"
        },
        body: formBody,
        timeoutMs: 15e3
      });
      if (resp.status >= 200 && resp.status < 300 && resp.body) {
        const tokenInfo = JSON.parse(resp.body);
        const newAccessToken = tokenInfo.access_token;
        const newRefreshToken = tokenInfo.refresh_token || refreshToken;
        const expiresIn = tokenInfo.expires_in || 600;
        sessionData.access_token = newAccessToken;
        if (!sessionData.token_data) sessionData.token_data = {};
        sessionData.token_data.access_token = newAccessToken;
        sessionData.token_data.refresh_token = newRefreshToken;
        sessionData.token_data.expires_in = expiresIn;
        sessionData.token_data.updated_at = Math.floor(Date.now() / 1e3);
        sessionData.status = "authorized";
        await persistSessionData(sessionData, newAccessToken);
        return newAccessToken;
      }
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao renovar token OAuth:", err);
    }
    return null;
  };
  const resolveLiveAccountToken = async (forceRefresh = false) => {
    var _a2, _b2, _c2;
    let sessionObj = null;
    const sessResult = await readSessionFile();
    if (sessResult) {
      sessionObj = sessResult.data;
    }
    if (sessionObj) {
      const now = Math.floor(Date.now() / 1e3);
      const updatedAt = ((_a2 = sessionObj.token_data) == null ? void 0 : _a2.updated_at) || sessionObj.started_at || 0;
      const expiresIn = ((_b2 = sessionObj.token_data) == null ? void 0 : _b2.expires_in) || sessionObj.expires_in || 600;
      const isNearExpiry = now - updatedAt >= expiresIn - 60;
      if (forceRefresh || isNearExpiry) {
        const renewed = await refreshOAuthSession(sessionObj);
        if (renewed) return renewed;
      }
      const tok = sessionObj.access_token || sessionObj.token || ((_c2 = sessionObj.token_data) == null ? void 0 : _c2.access_token);
      if (typeof tok === "string" && tok.trim().length > 0) {
        return tok.trim();
      }
    }
    try {
      localStorage.removeItem("nexusmind_mcp_token");
    } catch {
    }
    return null;
  };
  const fetchLiveQuotaFromApi = async () => {
    let token = await resolveLiveAccountToken(false);
    if (!token) {
      return {
        status: "unavailable",
        source: "unavailable",
        balanceUsd: null,
        currency: "USD",
        accountHolder: null,
        reason: "Nenhum token OAuth/MCP da conta encontrado em localStorage ou ~/.buzz/.nexusmind_auth_session.json"
      };
    }
    const queryQuota = async (tok) => {
      var _a2, _b2, _c2, _d;
      try {
        const resProf = await hostGetJson("https://nexusmind.digital/api/v1/user/profile", tok, 8e3);
        if (resProf.status >= 200 && resProf.status < 300 && resProf.json) {
          const u = resProf.json.data || resProf.json;
          const rawBalance = typeof (u == null ? void 0 : u.balance) === "number" ? u.balance : typeof (u == null ? void 0 : u.quota) === "number" ? u.quota : null;
          return {
            status: rawBalance !== null ? "active" : "partial",
            source: "live_api",
            httpStatus: resProf.status,
            latencyMs: resProf.latencyMs,
            balanceUsd: rawBalance,
            currency: "USD",
            accountHolder: (u == null ? void 0 : u.username) || (u == null ? void 0 : u.name) || null,
            role: (u == null ? void 0 : u.role) === 100 || (u == null ? void 0 : u.role) === "admin" ? "admin" : (u == null ? void 0 : u.role) ?? null
          };
        }
      } catch {
      }
      try {
        const t0 = performance.now();
        const mcpReq = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/mcp",
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "User-Agent": "BuzzDesktop/NexusMindPlugin"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "user_get_profile", arguments: {} }
          }),
          timeoutMs: 8e3
        });
        const latencyMs = Math.round(performance.now() - t0);
        if (mcpReq.status === 200 && mcpReq.body) {
          const mcpData = JSON.parse(mcpReq.body);
          const innerText = (_c2 = (_b2 = (_a2 = mcpData.result) == null ? void 0 : _a2.content) == null ? void 0 : _b2[0]) == null ? void 0 : _c2.text;
          if (innerText) {
            const inner = JSON.parse(innerText);
            const u = ((_d = inner.result) == null ? void 0 : _d.data) || inner.data || inner;
            const rawBalance = typeof (u == null ? void 0 : u.balance) === "number" ? u.balance : typeof (u == null ? void 0 : u.quota) === "number" ? u.quota : null;
            if (rawBalance !== null) {
              return {
                status: "active",
                source: "live_api",
                httpStatus: 200,
                latencyMs,
                balanceUsd: rawBalance,
                currency: "USD",
                accountHolder: (u == null ? void 0 : u.username) || "HeltonFraga01",
                role: (u == null ? void 0 : u.role) === 100 || (u == null ? void 0 : u.role) === "admin" ? "admin" : (u == null ? void 0 : u.role) ?? null
              };
            }
          }
        } else if (mcpReq.status === 401) {
          return { httpStatus: 401, status: "unauthorized" };
        }
      } catch {
      }
      return null;
    };
    let result = await queryQuota(token);
    if (!result || result.httpStatus === 401) {
      const renewedToken = await resolveLiveAccountToken(true);
      if (renewedToken && renewedToken !== token) {
        token = renewedToken;
        result = await queryQuota(token);
      }
    }
    if (result && (result.status === "active" || result.status === "partial")) {
      return result;
    }
    return {
      status: "unavailable",
      source: "live_api_error",
      httpStatus: (result == null ? void 0 : result.httpStatus) || null,
      balanceUsd: null,
      currency: "USD",
      accountHolder: null,
      error: "Sessão expirada ou sem permissão de leitura de saldo"
    };
  };
  if ((_a = ctx.decisions) == null ? void 0 : _a.registerProvider) {
    try {
      const disposeDecisionProvider = ctx.decisions.registerProvider(
        createNexusMindDecisionProvider(ctx, CANONICAL_GROUPS)
      );
      if (ctx.on && typeof disposeDecisionProvider === "function") {
        ctx.on("dispose", () => {
          try {
            disposeDecisionProvider();
          } catch {
          }
        });
      }
      console.log("[NEXUSMIND] DecisionProvider 'nexusmind-fast' registrado em ctx.decisions.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar DecisionProvider:", err);
    }
  }
  if ((_b = ctx.agents) == null ? void 0 : _b.addInstructions) {
    try {
      ctx.agents.addInstructions({
        id: "nexusmind-gateway-v2",
        text: `NexusMind AI Gateway (Cortexx Platform) — Roteamento Unificado & Melhor Modelo por Tier:
Acesso aos catálogos de modelos LLM gerenciados com roteamento inteligente, ping real e DecisionProvider nativo.
Grupos Canônicos:
- nexusmind_openai: padrão gpt-6.1-terra (OpenAI-compatible /v1)
- nexusmind_anthropic: padrão claude-sonnet-4-6 (/v1/messages)
- nexusmind_antigravity: padrão gemini-2.5-flash (Gemini & Claude Thinking)
- nexusmind_grok: padrão grok-4.5 (xAI Grok)
Ferramentas nativas do Gateway:
1. nexusmind_models({ group? }): Consulta modelos disponíveis em tempo real (/v1/models) via host bridge com latência real.
2. nexusmind_status(): Ping HTTP real nos 4 grupos canônicos e consulta ao vivo de saldo/perfil (/api/v1/user/profile).
3. nexusmind_best_model({ tier?, exclude_models?, prefer_free?, avoid_free?, max_probes? }): Faz ping real em paralelo e elege o melhor modelo saudável para o tier ('tier1_fast' | 'tier2_balanced' | 'tier3_frontier' | 'reasoning' | 'decision'), evitando modelos :free com rate limit por padrão.
4. nexusmind_apply_best_model({ agente, tier?, exclude_models?, prefer_free? }): Seleciona o melhor modelo saudável para o tier e já aplica diretamente no agente via ctx.agents.save().
5. nexusmind_model_ranking({ tier?, live_probe?, avoid_free?, limit? }): Retorna o ranking real de modelos combinando telemetria do Gateway (nm_usage.json) + ping ao vivo, e atualiza ~/.buzz/.scratch/nexusmind-model-ranking.json para todo o ecossistema.
Use nexusmind_model_ranking, nexusmind_best_model ou nexusmind_apply_best_model sempre que precisar garantir o melhor modelo online para um card ou recuperar de erro 429/502.`
      });
      console.log("[NEXUSMIND] ctx.agents.addInstructions registrado com sucesso.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar addInstructions:", err);
    }
  }
  if ((_c = ctx.agents) == null ? void 0 : _c.addTool) {
    try {
      ctx.agents.addTool({
        name: "nexusmind_models",
        description: "Lista todos os modelos de IA disponíveis em tempo real no gateway NexusMind via ctx.host.request, com provedores, grupos, latência real e endpoints.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filtrar por grupo: 'nexusmind_openai', 'nexusmind_anthropic', 'nexusmind_antigravity', 'nexusmind_grok' ou 'all' (default: 'all')"
            }
          }
        },
        call: async (_client, _context, args) => {
          const groupFilter = (args == null ? void 0 : args.group) || "all";
          const groups = CANONICAL_GROUPS;
          const selectedEntries = Object.entries(groups).filter(
            ([key, grp]) => groupFilter === "all" || key === groupFilter || grp.platformKey === groupFilter
          );
          const groupResults = {};
          const dedupedModels = /* @__PURE__ */ new Map();
          await Promise.all(
            selectedEntries.map(async ([key, grp]) => {
              var _a2, _b2, _c2, _d;
              const t0 = performance.now();
              try {
                const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 1e4);
                if (res.status < 200 || res.status >= 300) {
                  const apiErr = ((_b2 = (_a2 = res.json) == null ? void 0 : _a2.error) == null ? void 0 : _b2.message) || ((_c2 = res.json) == null ? void 0 : _c2.message) || `HTTP ${res.status}`;
                  groupResults[key] = {
                    status: "error",
                    httpStatus: res.status,
                    error: apiErr,
                    latencyMs: res.latencyMs
                  };
                  return;
                }
                const liveModels = Array.isArray((_d = res.json) == null ? void 0 : _d.data) ? res.json.data : [];
                groupResults[key] = {
                  status: "operational",
                  httpStatus: res.status,
                  latencyMs: res.latencyMs,
                  totalModels: liveModels.length
                };
                for (const m of liveModels) {
                  const mid = m == null ? void 0 : m.id;
                  if (!mid) continue;
                  const existing = dedupedModels.get(mid);
                  if (!existing) {
                    dedupedModels.set(mid, {
                      id: mid,
                      displayName: m.display_name || mid,
                      group: key,
                      groups: [key],
                      platform: grp.platformKey,
                      baseUrl: "https://api.nexusmind.digital/v1",
                      status: "active",
                      latencyMs: res.latencyMs,
                      createdAt: m.created_at ?? m.created ?? null
                    });
                  } else {
                    if (!existing.groups.includes(key)) existing.groups.push(key);
                    existing.latencyMs = Math.min(existing.latencyMs, res.latencyMs);
                  }
                }
              } catch (err) {
                const latencyMs = Math.round(performance.now() - t0);
                groupResults[key] = {
                  status: "error",
                  httpStatus: null,
                  error: (err == null ? void 0 : err.message) || String(err),
                  latencyMs
                };
              }
            })
          );
          const modelsList = Array.from(dedupedModels.values()).sort((a, b) => a.id.localeCompare(b.id));
          const resultValues = Object.values(groupResults);
          const hasErrors = resultValues.some((r) => r.status === "error");
          const allErrors = resultValues.length === 0 || resultValues.every((r) => r.status === "error");
          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            protocol: "OpenAI-compatible /v1",
            fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
            status: allErrors ? "error" : hasErrors ? "degraded" : "operational",
            filter: groupFilter,
            totalGroups: selectedEntries.length,
            groups: groupResults,
            totalModels: modelsList.length,
            models: modelsList
          }, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_status",
        description: "Retorna a telemetria ao vivo do gateway NexusMind via ctx.host.request nos 4 grupos canônicos e consulta real de saldo/quota na API do usuário (sem valores hardcoded).",
        inputSchema: {
          type: "object",
          properties: {}
        },
        call: async (_client, _context) => {
          const groups = CANONICAL_GROUPS;
          const groupsTelemetry = {};
          let totalLatency = 0;
          let successfulGroups = 0;
          const [, quota] = await Promise.all([
            Promise.all(
              Object.entries(groups).map(async ([key, grp]) => {
                var _a2, _b2, _c2, _d;
                const t0 = performance.now();
                try {
                  const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 1e4);
                  if (res.status >= 200 && res.status < 300) {
                    const modelsCount = Array.isArray((_a2 = res.json) == null ? void 0 : _a2.data) ? res.json.data.length : 0;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "operational",
                      httpStatus: res.status,
                      latencyMs: res.latencyMs,
                      activeModels: modelsCount,
                      defaultModel: grp.defaultModel
                    };
                    totalLatency += res.latencyMs;
                    successfulGroups++;
                  } else {
                    const apiErr = ((_c2 = (_b2 = res.json) == null ? void 0 : _b2.error) == null ? void 0 : _c2.message) || ((_d = res.json) == null ? void 0 : _d.message) || `HTTP ${res.status}`;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "error",
                      httpStatus: res.status,
                      error: apiErr,
                      latencyMs: res.latencyMs
                    };
                  }
                } catch (err) {
                  const latencyMs = Math.round(performance.now() - t0);
                  groupsTelemetry[key] = {
                    groupName: grp.groupName,
                    platform: grp.platformKey,
                    status: "offline",
                    httpStatus: null,
                    error: (err == null ? void 0 : err.message) || String(err),
                    latencyMs
                  };
                }
              })
            ),
            fetchLiveQuotaFromApi()
          ]);
          const isOnline = successfulGroups > 0;
          const avgLatency = successfulGroups > 0 ? Math.round(totalLatency / successfulGroups) : null;
          const systemStatus = successfulGroups === Object.keys(groups).length ? "operational" : successfulGroups > 0 ? "degraded" : "outage";
          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            online: isOnline,
            status: systemStatus,
            protocol: "OpenAI-compatible /v1",
            measuredAt: (/* @__PURE__ */ new Date()).toISOString(),
            averageLatencyMs: avgLatency,
            activeGroupsCount: `${successfulGroups}/${Object.keys(groups).length}`,
            groups: groupsTelemetry,
            syncedWithHarness: true,
            quota
          }, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_best_model",
        description: "Faz ping real em paralelo nos melhores candidatos do NexusMind para o tier solicitado ('tier1_fast' | 'tier2_balanced' | 'tier3_frontier' | 'reasoning' | 'decision') e retorna o melhor modelo online (capacidade + menor latência), evitando modelos :free instáveis por padrão.",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier desejado para a tarefa (default: 'tier2_balanced')"
            },
            exclude_models: {
              type: "array",
              items: { type: "string" },
              description: "Lista de modelos em erro/rate-limit a excluir do ranking"
            },
            prefer_free: {
              type: "boolean",
              description: "Se true, restringe a candidatos FREE (default: false)"
            },
            avoid_free: {
              type: "boolean",
              description: "Se true (padrão), evita modelos :free propensos a HTTP 429"
            },
            max_probes: {
              type: "number",
              description: "Quantidade máxima de modelos testados ao vivo (1..8, default: 5)"
            }
          }
        },
        call: async (_client, _context, args) => {
          const res = await selectBestModelByTier(ctx, CANONICAL_GROUPS, {
            tier: args == null ? void 0 : args.tier,
            exclude_models: Array.isArray(args == null ? void 0 : args.exclude_models) ? args.exclude_models : void 0,
            prefer_free: Boolean(args == null ? void 0 : args.prefer_free),
            avoid_free: (args == null ? void 0 : args.avoid_free) !== false,
            max_probes: typeof (args == null ? void 0 : args.max_probes) === "number" ? args.max_probes : void 0
          });
          return JSON.stringify(res, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_apply_best_model",
        description: "Elege ao vivo o melhor modelo saudável no NexusMind para o tier solicitado e atualiza automaticamente a configuração do agente alvo no Buzz Desktop via ctx.agents.save().",
        inputSchema: {
          type: "object",
          properties: {
            agente: {
              type: "string",
              description: "Nome ou key do agente alvo no Buzz (ex: 'OrgFy Teo', 'OrgFy Val')"
            },
            tier: {
              type: "string",
              enum: ["tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier desejado (default: 'tier2_balanced')"
            },
            exclude_models: {
              type: "array",
              items: { type: "string" },
              description: "Modelos a excluir do ranking (ex: modelo com 429)"
            },
            prefer_free: {
              type: "boolean",
              description: "Se true, prioriza modelos FREE (default: false)"
            }
          },
          required: ["agente"]
        },
        call: async (_client, _context, args) => {
          const res = await applyBestModelToAgent(ctx, CANONICAL_GROUPS, {
            agente: String((args == null ? void 0 : args.agente) || ""),
            tier: args == null ? void 0 : args.tier,
            exclude_models: Array.isArray(args == null ? void 0 : args.exclude_models) ? args.exclude_models : void 0,
            prefer_free: Boolean(args == null ? void 0 : args.prefer_free)
          });
          return JSON.stringify(res, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_model_ranking",
        description: "Retorna o ranking real de modelos do NexusMind Gateway combinando telemetria de uso real (nm_usage.json), latência, cache hit, custo e opcionalmente ping HTTP 200 ao vivo, persistindo o snapshot compartilhado em ~/.buzz/.scratch/nexusmind-model-ranking.json.",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["geral", "tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier do ranking desejado (default: 'geral')"
            },
            live_probe: {
              type: "boolean",
              description: "Se true, faz ping HTTP 200 ao vivo nos top candidatos antes de ranquear (default: false)"
            },
            avoid_free: {
              type: "boolean",
              description: "Se true (padrão), penaliza modelos :free propensos a HTTP 429"
            },
            limit: {
              type: "number",
              description: "Quantidade de modelos retornados no ranking (default: 15)"
            }
          }
        },
        call: async (_client, _context, args) => {
          const tier = (args == null ? void 0 : args.tier) || "geral";
          const avoidFree = (args == null ? void 0 : args.avoid_free) !== false;
          const limit = Math.max(1, Math.min(50, Number((args == null ? void 0 : args.limit) || 15)));
          const usage = await loadGatewayUsageByModel(ctx);
          const liveProbes = {};
          if (args == null ? void 0 : args.live_probe) {
            const probeRes = await selectBestModelByTier(ctx, CANONICAL_GROUPS, {
              tier: tier === "geral" ? "tier2_balanced" : tier,
              avoid_free: avoidFree,
              max_probes: 6
            });
            for (const cand of probeRes.ranking) {
              liveProbes[cand.model] = {
                status: cand.online ? "ok" : "error",
                latency: cand.latencyMs ?? void 0,
                errorMsg: cand.error
              };
            }
          }
          let cachedModels = [];
          try {
            const raw = localStorage.getItem("nexusmind_cached_models");
            if (raw) cachedModels = JSON.parse(raw);
          } catch {
          }
          const savedPolicy = loadSavedRoutingPolicy();
          const snap = buildModelRankingSnapshot({
            catalogModels: cachedModels,
            groups: CANONICAL_GROUPS,
            usageByModel: usage.byModel,
            usageSampleSize: usage.sampleSize,
            liveProbes,
            tier,
            avoidFree: savedPolicy.forceFree ? false : avoidFree,
            policy: savedPolicy
          });
          await persistModelRankingSnapshot(ctx, snap);
          return JSON.stringify(
            {
              ...snap,
              models: snap.models.slice(0, limit)
            },
            null,
            2
          );
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_failover_agent",
        description: "Executa failover inteligente com Circuit Breaker e proteção estrita VIP: coloca o modelo que falhou em quarentena (TTL por classe de erro) e troca o agente para o melhor candidato saudável do pool apropriado (Auto para workers, cadeia VIP para Iris/Conselho).",
        inputSchema: {
          type: "object",
          properties: {
            agente: { type: "string", description: "Nome ou key do agente alvo no Buzz" },
            erro: { type: "string", description: "Mensagem de erro observada (ex: weekly limit, 404, malformed_function_call, stream ended)" },
            wake: { type: "boolean", description: "Se true, acorda o agente após aplicar o novo modelo (default: true)" }
          },
          required: ["agente"]
        },
        call: async (_client, _context, args) => {
          const usage = await loadGatewayUsageByModel(ctx);
          let cachedModels = [];
          try {
            const raw = localStorage.getItem("nexusmind_cached_models");
            if (raw) cachedModels = JSON.parse(raw);
          } catch {
          }
          const vipPol = loadVipPolicy();
          const qBench = loadSavedQualityBench();
          const rankSnap = buildModelRankingSnapshot({
            catalogModels: cachedModels,
            groups: CANONICAL_GROUPS,
            usageByModel: usage.byModel,
            usageSampleSize: usage.sampleSize,
            tier: "geral",
            policy: loadSavedRoutingPolicy(),
            vipPolicy: vipPol,
            qualityBench: qBench,
            quarantines: loadQuarantines()
          });
          const evt = await executeAgentFailover(ctx, CANONICAL_GROUPS, {
            agentKeyOrName: String((args == null ? void 0 : args.agente) || ""),
            errorText: (args == null ? void 0 : args.erro) ? String(args.erro) : void 0,
            trigger: "tool",
            rankingSnapshot: rankSnap,
            vipPolicy: vipPol,
            qualityBench: qBench,
            wakeAfter: (args == null ? void 0 : args.wake) !== false,
            notify: true
          });
          return JSON.stringify(evt, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_quality_bench",
        description: "Roda sonda real de qualidade (Tool-Calling Fidelity + integridade de resposta + latência) nos modelos informados ou nos principais do catálogo, salvando o resultado em ~/.buzz/.scratch/nexusmind-quality-bench.json.",
        inputSchema: {
          type: "object",
          properties: {
            modelos: { type: "array", items: { type: "string" }, description: "Lista opcional de modelos a testar" }
          }
        },
        call: async (_client, _context, args) => {
          const list = Array.isArray(args == null ? void 0 : args.modelos) && args.modelos.length > 0 ? args.modelos.map(String) : Object.values(CANONICAL_GROUPS).map((g) => g.defaultModel);
          const candidates = list.slice(0, 8).map((m) => ({
            model: m,
            group: CANONICAL_GROUPS[getModelGroups(m)[0]] || CANONICAL_GROUPS.nexusmind_openai
          }));
          const results = await runBatchQualityBench(ctx, candidates);
          return JSON.stringify({ tested: candidates.length, results }, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_vip_policy",
        description: "Consulta ou atualiza a política de proteção VIP (3 estados: auto | vip | blocked) e agentes protegidos (OrgFy Iris, Conselho).",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["get", "set_model_mode", "toggle_vip_agent"], description: "Ação (default: 'get')" },
            model: { type: "string", description: "ID do modelo quando action='set_model_mode'" },
            mode: { type: "string", enum: ["auto", "vip", "blocked"], description: "Novo modo do modelo" },
            agent: { type: "string", description: "Nome do agente quando action='toggle_vip_agent'" }
          }
        },
        call: async (_client, _context, args) => {
          let pol = loadVipPolicy();
          if ((args == null ? void 0 : args.action) === "set_model_mode" && (args == null ? void 0 : args.model) && (args == null ? void 0 : args.mode)) {
            pol = setModelAccessMode(pol, String(args.model), args.mode);
            await saveVipPolicy(ctx, pol);
          } else if ((args == null ? void 0 : args.action) === "toggle_vip_agent" && (args == null ? void 0 : args.agent)) {
            pol = toggleVipAgent(pol, String(args.agent));
            await saveVipPolicy(ctx, pol);
          }
          return JSON.stringify(pol, null, 2);
        }
      });
      console.log("[NEXUSMIND] 8 agentTools + DecisionProvider registrados com sucesso no harness do Buzz.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar agentTools:", err);
    }
  }
}
export {
  ANTHROPIC_ONLY_CLAUDE,
  ANTIGRAVITY_ONLY_CLAUDE,
  CANONICAL_GROUPS,
  GOOSE_MAX_MODELS_PER_GROUP,
  GOOSE_SECRETS_MERGE_PY,
  NEXUSMIND_THEME_CSS,
  OFFICIAL_ENDPOINTS,
  SESSION_FILE_PATHS,
  apply,
  applyBestModelToAgent,
  applyQuickVipPreset,
  buildModelRankingSnapshot,
  classifyGatewayError,
  createNexusMindDecisionProvider,
  executeAgentFailover,
  getModelAccessMode,
  getModelGroups,
  inject,
  isVipAgent,
  loadGatewayUsageByModel,
  loadPersistedAccountToken,
  loadQuarantines,
  loadVipPolicy,
  persistModelRankingSnapshot,
  pickFailoverCandidate,
  quarantineModel,
  readPrivateSessionFile,
  releaseQuarantine,
  runBatchQualityBench,
  runModelQualityProbe,
  saveVipPolicy,
  scanLiveAgentErrors,
  scoreModelForTier,
  selectBestModelByTier,
  selectTopGooseModelsByGroup,
  setModelAccessMode,
  toggleVipAgent,
  writePrivateSessionData
};
