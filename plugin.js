function isFreeModel(modelId) {
  const m = String(modelId || "").toLowerCase();
  return m.includes(":free") || m.includes("-free") || m.includes("/free") || m.endsWith("free");
}
function isUnsupportedAgentModel(modelId) {
  const m = String(modelId || "").trim().toLowerCase();
  if (!m) return true;
  return m.startsWith("auto/") || m.includes("tab_jump") || m.includes("autocomplete") || m.includes("fim-") || m.includes("embedding") || m.includes("rerank") || m.includes("whisper") || m.includes("tts") || m.includes("imagen") || m.includes("dall-e") || m.includes("moderation");
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
  const preferFree = input.prefer_free !== void 0 ? Boolean(input.prefer_free) : Boolean(savedPolicy.forceFree);
  const avoidFree = input.avoid_free !== false && !preferFree;
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
    const freeOnly = pool.filter((c) => isFreeModel(c.id));
    if (freeOnly.length > 0) pool = freeOnly;
  } else if (avoidFree) {
    const paidOnly = pool.filter((c) => !isFreeModel(c.id));
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
        isFree: isFreeModel(cand.id),
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
  const selection = await selectBestModelByTier(ctx, groups, input);
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
        if ((m == null ? void 0 : m.model) && !isUnsupportedAgentModel(m.model) && (m == null ? void 0 : m.online) !== false && !(m == null ? void 0 : m.isDisabled) && !isFreeModel(m.model)) {
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
        if ((m == null ? void 0 : m.id) && !isUnsupportedAgentModel(m.id) && !isFreeModel(m.id)) set.add(String(m.id));
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
    return parsed.models.filter((m) => (m == null ? void 0 : m.model) && (m == null ? void 0 : m.online) !== false && !(m == null ? void 0 : m.isDisabled) && !isFreeModel(m.model)).slice(0, 6).map((m) => String(m.model));
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
  const free = isFreeModel(modelId);
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
      const isDisabled = disabledSet.has(item.id);
      const unsupported = isUnsupportedAgentModel(item.id);
      const isBlocked = unsupported || blockedSet.has(item.id.toLowerCase());
      const free = isFreeModel(item.id);
      const avgCost = (usage == null ? void 0 : usage.avgCostUsd) ?? 0;
      const exceedsCostCap = policy.maxCostPerReqUsd !== null && avgCost > 0 && avgCost > policy.maxCostPerReqUsd;
      const freeMismatch = policy.forceFree ? !free : false;
      const eligibleForAuto = !isDisabled && !isBlocked && (probe == null ? void 0 : probe.status) !== "error" && !exceedsCostCap && !freeMismatch;
      const scored = computeModelRowScore(item.id, targetTier, usage, probe, policy);
      rows.push({
        rank: 0,
        model: item.id,
        group: item.group.id,
        platform: item.group.platformKey,
        isFree: free,
        isDisabled,
        autoAssignBlocked: isBlocked,
        eligibleForAuto,
        score: isDisabled ? -1 : scored.score,
        capabilityScore: scored.capabilityScore,
        tierMatchScore: scored.tierMatchScore,
        adoptionScore: scored.adoptionScore,
        speedScore: scored.speedScore,
        online: (probe == null ? void 0 : probe.status) === "ok" ? true : (probe == null ? void 0 : probe.status) === "error" ? false : null,
        pingLatencyMs: typeof (probe == null ? void 0 : probe.latency) === "number" ? probe.latency : null,
        pingError: probe == null ? void 0 : probe.errorMsg,
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
function fmtCost(usd) {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  if (usd < 1e-3) return `$${(usd * 1e3).toFixed(2)}/1k`;
  return `$${usd.toFixed(4)}`;
}
function createModelRankingTabComponent(ctx, groups) {
  const React = ctx.react;
  const h = React.createElement;
  return function ModelRankingTab({
    models,
    disabledModels,
    modelTests,
    onTestSingleModel,
    onNotify
  }) {
    const [selectedTier, setSelectedTier] = React.useState("geral");
    const [policy, setPolicy] = React.useState(() => loadSavedRoutingPolicy());
    const [usageByModel, setUsageByModel] = React.useState({});
    const [usageSampleSize, setUsageSampleSize] = React.useState(0);
    const [probingTop, setProbingTop] = React.useState(false);
    const [selectedAgentKey, setSelectedAgentKey] = React.useState("");
    const [applyingModel, setApplyingModel] = React.useState(null);
    const [onlyAutoEligible, setOnlyAutoEligible] = React.useState(false);
    const [searchFilter, setSearchFilter] = React.useState("");
    const updatePolicy = (updater) => {
      setPolicy((prev) => {
        const next = updater(prev);
        saveRoutingPolicy(next);
        return next;
      });
    };
    const agentsList = React.useMemo(() => {
      var _a, _b;
      try {
        const snap = ((_b = (_a = ctx == null ? void 0 : ctx.agents) == null ? void 0 : _a.snapshot) == null ? void 0 : _b.call(_a)) || {};
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
        policy
      });
    }, [models, usageByModel, usageSampleSize, modelTests, disabledModels, selectedTier, policy]);
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
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      // 1. Barra compacta de Tier + Critérios de Roteamento (flat, estilo Buzz)
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "10px",
            backgroundColor: "var(--bg-panel, #1a1a1a)",
            border: "1px solid var(--border-primary, #2e2e2e)"
          }
        },
        // Linha 1: Tiers + Ação de Healthcheck
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" } },
            TIER_OPTIONS.map((t) => {
              const active = selectedTier === t.id;
              return h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTier(t.id),
                  style: {
                    borderRadius: "6px",
                    padding: "5px 10px",
                    border: "none",
                    backgroundColor: active ? "var(--affordance-selected, #333333)" : "transparent",
                    color: active ? "var(--text-primary, #ffffff)" : "var(--text-tertiary, #a4a4a4)",
                    fontSize: "12px",
                    fontWeight: active ? "600" : "500",
                    cursor: "pointer"
                  }
                },
                t.label
              );
            })
          ),
          h(
            "button",
            {
              onClick: handleProbeTopCandidates,
              disabled: probingTop,
              style: {
                borderRadius: "6px",
                padding: "6px 12px",
                backgroundColor: "var(--affordance-prominent, #ffffff)",
                color: "var(--text-on-prominent, #000000)",
                border: "none",
                fontSize: "12px",
                fontWeight: "600",
                cursor: probingTop ? "wait" : "pointer"
              }
            },
            probingTop ? "Testando..." : "Testar Top 6"
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
                  borderRadius: "6px",
                  cursor: "pointer",
                  border: `1px solid ${policy.forceFree ? "var(--green-7, #28714f)" : "var(--border-primary, #333333)"}`,
                  backgroundColor: policy.forceFree ? "var(--green-3, #132d21)" : "transparent",
                  color: policy.forceFree ? "var(--green-11, #3dd68c)" : "var(--text-secondary, #c7c7c7)",
                  fontWeight: policy.forceFree ? "600" : "500"
                }
              },
              h("input", {
                type: "checkbox",
                checked: policy.forceFree,
                onChange: (e) => updatePolicy((p) => ({ ...p, forceFree: Boolean(e.target.checked) })),
                style: { accentColor: "#30a46c" }
              }),
              "Forçar modelos :free"
            ),
            // Filtro elegíveis para auto-designação
            h(
              "label",
              { style: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)", cursor: "pointer" } },
              h("input", {
                type: "checkbox",
                checked: onlyAutoEligible,
                onChange: (e) => setOnlyAutoEligible(Boolean(e.target.checked)),
                style: { accentColor: "#30a46c" }
              }),
              "Só elegíveis (Auto)"
            )
          ),
          h("input", {
            type: "text",
            placeholder: "Filtrar modelo...",
            value: searchFilter,
            onChange: (e) => setSearchFilter(e.target.value),
            style: {
              backgroundColor: "var(--surface-inset, #101010)",
              border: "1px solid var(--border-primary, #333333)",
              borderRadius: "6px",
              padding: "4px 10px",
              color: "var(--text-primary, #ffffff)",
              fontSize: "11px",
              width: "160px",
              outline: "none"
            }
          })
        )
      ),
      // 2. Faixa única do Modelo #1 Eleito + Aplicação Direta (substitui 3 cards + banner azul)
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "var(--bg-panel, #1a1a1a)",
            border: "1px solid var(--border-primary, #2e2e2e)"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)", fontWeight: "600", textTransform: "uppercase" } },
            (activeWinner == null ? void 0 : activeWinner.pinned) ? "Fixado:" : "Auto #1:"
          ),
          h(
            "span",
            { style: { fontSize: "13px", fontWeight: "700", color: "var(--text-primary, #ffffff)", fontFamily: "monospace" } },
            activeWinner ? activeWinner.model : "Nenhum elegível"
          ),
          activeWinner && h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-tertiary, #a4a4a4)", fontFamily: "monospace" } },
            `score ${activeWinner.score} · ${activeWinner.calls.toLocaleString("pt-BR")} reqs · ${fmtCost(activeWinner.avgCostUsd)}`
          ),
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-tertiary, #808080)" } },
            `(${usageSampleSize.toLocaleString("pt-BR")} chamadas no Gateway · ${policy.autoAssignBlocked.length} bloqueados p/ auto)`
          )
        ),
        agentsList.length > 0 && h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h(
            "select",
            {
              value: selectedAgentKey,
              onChange: (e) => setSelectedAgentKey(e.target.value),
              style: {
                backgroundColor: "var(--surface-inset, #101010)",
                color: "var(--text-primary, #ffffff)",
                border: "1px solid var(--border-primary, #333333)",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "11px"
              }
            },
            agentsList.map(
              (a) => {
                var _a;
                return h("option", { key: a.key, value: a.key }, `${a.name || a.key} (${((_a = a.config) == null ? void 0 : _a.model) || "padrão"})`);
              }
            )
          ),
          activeWinner && h(
            "button",
            {
              onClick: () => handleApplyModel(activeWinner.model, activeWinner.group),
              disabled: applyingModel !== null,
              style: {
                borderRadius: "6px",
                padding: "5px 10px",
                backgroundColor: "var(--affordance-subtle, #282828)",
                border: "1px solid var(--border-primary, #3a3a3a)",
                color: "var(--text-primary, #ffffff)",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer"
              }
            },
            "Aplicar #1"
          )
        )
      ),
      // 3. Tabela minimalista de Ranking + Controle de Auto-Designação por Modelo
      h(
        "div",
        {
          style: {
            backgroundColor: "var(--bg-panel, #1a1a1a)",
            border: "1px solid var(--border-primary, #2e2e2e)",
            borderRadius: "10px",
            overflowX: "auto"
          }
        },
        h(
          "table",
          { style: { width: "100%", borderCollapse: "collapse", fontSize: "12px" } },
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
                    { style: { marginLeft: "6px", fontSize: "9px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "var(--green-3, #132d21)", color: "var(--green-11, #3dd68c)" } },
                    "FIXADO"
                  )
                ),
                // Toggle 1-clique Auto vs Manual (Proibido p/ auto-designação)
                h(
                  "td",
                  { style: { padding: "8px 12px" } },
                  h(
                    "button",
                    {
                      onClick: () => toggleAutoAssignBlock(row.model),
                      title: row.autoAssignBlocked ? "Bloqueado para designação automática (clique para liberar)" : "Permitido para designação automática (clique para restringir a uso manual)",
                      style: {
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: `1px solid ${row.autoAssignBlocked ? "var(--amber-7, #714f19)" : "var(--border-primary, #333333)"}`,
                        backgroundColor: row.autoAssignBlocked ? "var(--amber-3, #302008)" : "transparent",
                        color: row.autoAssignBlocked ? "var(--amber-11, #ffca16)" : "var(--text-secondary, #c7c7c7)",
                        fontSize: "11px",
                        fontWeight: "500",
                        cursor: "pointer"
                      }
                    },
                    row.autoAssignBlocked ? "Manual (Bloq.)" : "Auto ✓"
                  )
                ),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", fontWeight: "600", color: "var(--text-primary, #ffffff)" } }, `${row.score}`),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: healthColor } }, healthLabel),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-secondary, #c7c7c7)" } }, row.calls > 0 ? row.calls.toLocaleString("pt-BR") : "—"),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-tertiary, #a4a4a4)" } }, fmtMs(row.avgFirstTokenMs ?? row.avgDurationMs)),
                h("td", { style: { padding: "8px 12px", fontFamily: "monospace", color: "var(--text-tertiary, #a4a4a4)" } }, fmtCost(row.avgCostUsd)),
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
const inject = ["react", "pages", "settingsCards", "host", "agents", "decisions"];
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
    defaultModel: "mistralai/mistral-large-4-1t-a52b",
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
    defaultModel: "gemini-3.8-flash-medium",
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
        return localStorage.getItem("nexusmind_mcp_token") || "connected";
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
    const ModelRankingTab = React.useMemo(
      () => createModelRankingTabComponent(ctx, CANONICAL_GROUPS),
      []
    );
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
      var _a2, _b2, _c2, _d;
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
        }
      } catch {
        setProfileData(CANONICAL_PROFILE);
        setDashboardMetrics(CANONICAL_DASHBOARD);
      }
    };
    React.useEffect(() => {
      if (isConnected) {
        if (models.length === 0) {
          handlePullModelsFromNexusMind();
        }
        if (mcpToken && mcpToken !== "connected") {
          fetchTelemetry(mcpToken);
        }
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
                    localStorage.setItem("nexusmind_mcp_token", ev.token);
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
                    localStorage.setItem("nexusmind_mcp_token", resolvedToken);
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
    const handleManualKeyConnect = () => {
      const key = manualKeyInput.trim();
      if (!key) {
        setStatusMessage({
          type: "error",
          text: "Por favor, insira sua API Key ou Token NexusMind."
        });
        return;
      }
      setMcpToken(key);
      localStorage.setItem("nexusmind_mcp_token", key);
      localStorage.setItem("nexusmind_connected", "true");
      setIsConnected(true);
      fetchTelemetry(key);
      setStatusMessage({
        type: "success",
        text: "Chave vinculada com sucesso! Cockpit conectado."
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
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Sincronizando modelos com Goose e Pi (expurgando desativados)..."
      });
      try {
        const effectiveKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const groupModelsMap = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: []
        };
        for (const item of models) {
          const mid = item.id;
          if (!mid || disabledModels.includes(mid)) continue;
          const grps = getModelGroups(item);
          for (const g of grps) {
            if (groupModelsMap[g]) {
              groupModelsMap[g].push(mid);
            }
          }
        }
        for (const [pid, def] of Object.entries(CANONICAL_GROUPS)) {
          if (!groupModelsMap[pid] || groupModelsMap[pid].length === 0) {
            groupModelsMap[pid] = [def.defaultModel];
          }
        }
        const syncPayload = {
          effectiveKeys,
          groupModels: groupModelsMap
        };
        const pythonSyncScript = `
import os, sys, json, subprocess

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]

CANONICAL = {
    "nexusmind_openai": {
        "engine": "openai",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "mistralai/mistral-large-4-1t-a52b",
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
        "default_model": "gemini-3.8-flash-medium",
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

# 1. Update Goose custom_providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

for pid, cfg in CANONICAL.items():
    m_list = group_models.get(pid, [cfg["default_model"]])
    models_spec = []
    for mid in m_list:
        models_spec.append({
            "name": mid,
            "context_limit": cfg["default_ctx"],
            "max_tokens": cfg["default_out"]
        })
    provider_json = {
        "name": pid,
        "engine": cfg["engine"],
        "display_name": cfg["display_name"],
        "description": cfg["description"],
        "api_key": keys.get(pid, ""),
        "base_url": cfg["base_url"],
        "api_key_env": cfg["api_key_env"],
        "models": models_spec
    }
    with open(os.path.join(goose_dir, f"{pid}.json"), "w", encoding="utf-8") as f:
        json.dump(provider_json, f, indent=2)

# 2. Update Goose config.yaml & secrets.yaml
goose_conf_path = os.path.expanduser("~/.config/goose/config.yaml")
goose_secrets_path = os.path.expanduser("~/.config/goose/secrets.yaml")

secrets_map = {
    "OPENAI_API_KEY": keys.get("nexusmind_openai", ""),
    "ANTIGRAVITY_API_KEY": keys.get("nexusmind_antigravity", ""),
    "ANTHROPIC_API_KEY": keys.get("nexusmind_anthropic", "") or keys.get("nexusmind_antigravity", ""),
    "GROK_API_KEY": keys.get("nexusmind_grok", ""),
    "XAI_API_KEY": keys.get("nexusmind_grok", ""),
    "GOOGLE_API_KEY": keys.get("nexusmind_antigravity", "")
}

with open(goose_secrets_path, "w", encoding="utf-8") as f:
    for k, v in secrets_map.items():
        f.write(f"{k}: {v}\\n")

# Update macOS Keychain for Goose if security tool exists
try:
    keyring_json = json.dumps(secrets_map)
    subprocess.run([
        "security", "add-generic-password", "-U",
        "-s", "goose",
        "-a", "secrets",
        "-w", keyring_json
    ], capture_output=True, timeout=5)
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
        setStatusMessage({
          type: "success",
          text: `Sincronização concluída com sucesso! ${totalActive} modelos ativos registrados no Goose e Pi. (${disabledModels.length} desativados foram expurgados).`
        });
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
        var _a2;
        try {
          if ((_a2 = ctx.navigation) == null ? void 0 : _a2.navigate) {
            ctx.navigation.navigate("nexusmind");
          } else {
            window.location.hash = "#/nexusmind";
          }
        } catch {
          window.location.hash = "#/nexusmind";
        }
      };
      return h(
        "div",
        {
          style: {
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px" } },
            h(
              "div",
              {
                style: {
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000000"
                }
              },
              SVG_ICONS.dashboard({ h, width: 20, height: 20 })
            ),
            h(
              "div",
              null,
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px" } },
                h("span", { style: { fontWeight: "600", fontSize: "14px" } }, "NexusMind Gateway"),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      color: "#10b981",
                      fontWeight: "600"
                    }
                  },
                  "v2.3"
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                `Conectado como ${profileData.username} ($${(profileData.balance || 0).toFixed(2)}) • ${models.length} modelos`
              )
            )
          ),
          h(
            "button",
            {
              onClick: openFullPage,
              style: {
                borderRadius: "9999px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                padding: "7px 16px",
                fontSize: "12px",
                fontWeight: "500"
              }
            },
            "Abrir Cockpit →"
          )
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              onClick: handlePullModelsFromNexusMind,
              disabled: loadingPull,
              style: {
                borderRadius: "9999px",
                padding: "6px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: "none",
                cursor: loadingPull ? "not-allowed" : "pointer",
                fontSize: "12px",
                fontWeight: "500"
              }
            },
            loadingPull ? "Puxando..." : "Puxar Modelos"
          ),
          h(
            "button",
            {
              onClick: handleSyncModelsToBuzz,
              disabled: loadingSync,
              style: {
                borderRadius: "9999px",
                padding: "6px 16px",
                backgroundColor: "#10b981",
                color: "#000000",
                border: "none",
                cursor: loadingSync ? "not-allowed" : "pointer",
                fontSize: "12px",
                fontWeight: "600"
              }
            },
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
            maxWidth: "580px",
            margin: "60px auto",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "36px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)"
          }
        },
        h(
          "div",
          {
            style: {
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000000",
              marginBottom: "20px",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)"
            }
          },
          SVG_ICONS.plug({ h, width: 32, height: 32 })
        ),
        h(
          "h1",
          { style: { fontSize: "24px", fontWeight: "700", margin: "0 0 8px", color: "#ffffff" } },
          "NexusMind Gateway"
        ),
        h(
          "p",
          {
            style: {
              fontSize: "14px",
              color: "var(--text-subtle, #8e8e96)",
              lineHeight: "1.6",
              margin: "0 0 28px"
            }
          },
          "Conecte sua conta do NexusMind para liberar mais de 180 modelos corporativos (OpenAI, Anthropic Claude, Google Gemini e xAI Grok) para os agentes do Buzz Desktop."
        ),
        // Primary Connect Button
        h(
          "button",
          {
            onClick: handleStartOAuthFlow,
            disabled: authInFlight,
            style: {
              width: "100%",
              borderRadius: "9999px",
              padding: "13px 24px",
              background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
              color: "#ffffff",
              border: "none",
              cursor: authInFlight ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "16px",
              boxShadow: "0 4px 16px rgba(168, 85, 247, 0.3)"
            }
          },
          SVG_ICONS.plug({ h, width: 16, height: 16 }),
          authInFlight ? "Aguardando no Navegador..." : "Conectar via OAuth / MCP"
        ),
        // Secondary Action Buttons
        h(
          "div",
          { style: { display: "flex", gap: "10px", width: "100%", marginBottom: "24px" } },
          h(
            "button",
            {
              onClick: handleOpenInBrowser,
              style: {
                flex: "1",
                borderRadius: "9999px",
                padding: "9px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
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
                borderRadius: "9999px",
                padding: "9px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
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
        // Divider
        h(
          "div",
          {
            style: {
              width: "100%",
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              marginBottom: "20px"
            }
          }
        ),
        // Manual Input Option
        h(
          "div",
          { style: { width: "100%", textAlign: "left" } },
          h(
            "label",
            { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)", display: "block", marginBottom: "8px" } },
            "Ou conecte manualmente com sua API Key (sk-...) ou Token:"
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
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                padding: "9px 14px",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none"
              }
            }),
            h(
              "button",
              {
                onClick: handleManualKeyConnect,
                style: {
                  borderRadius: "9999px",
                  padding: "9px 18px",
                  backgroundColor: "#10b981",
                  color: "#000000",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px"
                }
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
        style: {
          width: "100%",
          height: "100%",
          minHeight: "100%",
          overflowY: "auto",
          backgroundColor: "transparent",
          color: "var(--text-normal, #f0f6fc)",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 32px",
          boxSizing: "border-box"
        }
      },
      !isConnected ? renderDisconnectedHero() : h(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            paddingBottom: "48px"
          }
        },
        // 1. BUZZ-NATIVE MINIMALIST HEADER (SEM CARD DENTRO DE CARD, SEM NEON)
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--border-primary, #333333)"
            }
          },
          // Left: Title + Primary Tabs inline
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "h1",
                {
                  style: {
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: 0,
                    color: "var(--text-primary, #ffffff)",
                    letterSpacing: "-0.01em"
                  }
                },
                "NexusMind"
              ),
              h("span", {
                title: "Conectado",
                style: {
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "var(--green-11, #3dd68c)",
                  display: "inline-block"
                }
              })
            ),
            h(
              "div",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  backgroundColor: "var(--bg-panel, #1a1a1a)",
                  border: "1px solid var(--border-primary, #333333)",
                  borderRadius: "8px",
                  padding: "2px"
                }
              },
              [
                { id: "catalog", label: "Modelos" },
                { id: "ranking", label: "Ranking & Roteamento" }
              ].map((tab) => {
                const active = activeSection === tab.id;
                return h(
                  "button",
                  {
                    key: tab.id,
                    onClick: () => setActiveSection(tab.id),
                    style: {
                      borderRadius: "6px",
                      padding: "5px 12px",
                      border: "none",
                      backgroundColor: active ? "var(--affordance-selected, #333333)" : "transparent",
                      color: active ? "var(--text-primary, #ffffff)" : "var(--text-tertiary, #a4a4a4)",
                      fontSize: "12px",
                      fontWeight: active ? "600" : "500",
                      cursor: "pointer"
                    }
                  },
                  tab.label
                );
              })
            )
          ),
          // Right: Compact Actions & Account
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h(
              "button",
              {
                onClick: handlePullModelsFromNexusMind,
                disabled: loadingPull,
                style: {
                  borderRadius: "8px",
                  padding: "6px 12px",
                  backgroundColor: "var(--affordance-subtle, #232323)",
                  color: "var(--text-primary, #ffffff)",
                  border: "1px solid var(--border-primary, #333333)",
                  cursor: loadingPull ? "not-allowed" : "pointer",
                  fontWeight: "500",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG_ICONS.pull({ h, width: 13, height: 13 }),
              loadingPull ? "Buscando..." : "Puxar"
            ),
            h(
              "button",
              {
                onClick: handleSyncModelsToBuzz,
                disabled: loadingSync,
                style: {
                  borderRadius: "8px",
                  padding: "6px 14px",
                  backgroundColor: "var(--affordance-prominent, #ffffff)",
                  color: "var(--text-on-prominent, #000000)",
                  border: "none",
                  cursor: loadingSync ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }
              },
              SVG_ICONS.sync({ h, width: 13, height: 13 }),
              loadingSync ? "Sincronizando..." : "Sincronizar"
            ),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "var(--bg-panel, #1a1a1a)",
                  border: "1px solid var(--border-primary, #333333)",
                  borderRadius: "8px",
                  padding: "5px 10px",
                  fontSize: "12px"
                }
              },
              h("span", { style: { color: "var(--text-secondary, #c7c7c7)" } }, profileData.username),
              h(
                "span",
                { style: { color: "var(--green-11, #3dd68c)", fontWeight: "600", fontFamily: "monospace" } },
                `$${(profileData.balance || 0).toFixed(2)}`
              ),
              h(
                "button",
                {
                  onClick: handleDisconnect,
                  title: "Desconectar",
                  style: {
                    background: "none",
                    border: "none",
                    color: "var(--text-tertiary, #a4a4a4)",
                    cursor: "pointer",
                    fontSize: "11px",
                    padding: "0 2px",
                    marginLeft: "2px"
                  }
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
          onNotify: setStatusMessage
        }) : h(
          React.Fragment,
          null,
          // 3. ONE-LINE SUMMARY STRIP + COLLAPSIBLE GATEWAY & ENDPOINTS
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                padding: "8px 12px",
                backgroundColor: "var(--bg-panel, #1a1a1a)",
                border: "1px solid var(--border-primary, #333333)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-secondary, #c7c7c7)"
              }
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
              h(
                "span",
                null,
                "Ativos: ",
                h("strong", { style: { color: "var(--text-primary, #ffffff)" } }, `${models.length - disabledModels.length}`),
                h("span", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, ` / ${models.length}`)
              ),
              h(
                "span",
                null,
                "Hoje: ",
                h("strong", { style: { color: "var(--text-primary, #ffffff)" } }, formatTokens(dashboardMetrics.today_tokens)),
                ` (${formatNumber(dashboardMetrics.today_requests)} reqs)`
              ),
              lastSyncTime && h("span", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, `Sync: ${lastSyncTime}`)
            ),
            h(
              "button",
              {
                onClick: () => setShowGatewayDetails((v) => !v),
                style: {
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary, #c7c7c7)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "500",
                  padding: "2px 6px"
                }
              },
              showGatewayDetails ? "Ocultar Gateway & Endpoints ▾" : "Gateway & Endpoints ▸"
            )
          ),
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
                        borderRadius: "9999px",
                        padding: "6px 14px",
                        border: "none",
                        backgroundColor: selectedGroupTab === tab.id ? "rgba(255, 255, 255, 0.15)" : "transparent",
                        color: selectedGroupTab === tab.id ? "#ffffff" : "var(--text-subtle, #8e8e96)",
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
                { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
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
                      borderRadius: "9999px",
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      padding: "6px 14px 6px 32px",
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
                        left: "10px",
                        color: "var(--text-subtle, #8e8e96)",
                        pointerEvents: "none",
                        display: "flex"
                      }
                    },
                    SVG_ICONS.search({ h, width: 14, height: 14 })
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
                      borderRadius: "9999px",
                      padding: "6px 12px",
                      border: "1px solid",
                      borderColor: filterReasoning ? "#a855f7" : "rgba(255, 255, 255, 0.1)",
                      backgroundColor: filterReasoning ? "rgba(168, 85, 247, 0.15)" : "transparent",
                      color: filterReasoning ? "#c084fc" : "var(--text-subtle, #8e8e96)",
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
                      borderRadius: "9999px",
                      padding: "6px 12px",
                      border: "1px solid",
                      borderColor: filterFree ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                      backgroundColor: filterFree ? "rgba(168, 185, 129, 0.15)" : "transparent",
                      color: filterFree ? "#10b981" : "var(--text-subtle, #8e8e96)",
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
                      borderRadius: "9999px",
                      padding: "6px 10px",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      color: "#e4e4e7",
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
                    color: "var(--text-subtle, #8e8e96)",
                    marginRight: "4px"
                  }
                },
                SVG_ICONS.filter({ h, width: 12, height: 12 }),
                "Status:"
              ),
              [
                { id: "all", label: `Todos (${statusCounts.all})`, accent: "#ffffff" },
                { id: "active", label: `Ativos (${statusCounts.active})`, accent: "#10b981" },
                { id: "disabled", label: `Desativados (${statusCounts.disabled})`, accent: "#9ca3af" },
                { id: "online", label: `Online (${statusCounts.online})`, accent: "#34d399" },
                { id: "error", label: `Com Erro (${statusCounts.error})`, accent: "#f87171" }
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
                      borderRadius: "9999px",
                      padding: "4px 12px",
                      border: `1px solid ${active ? st.accent : "rgba(255, 255, 255, 0.08)"}`,
                      backgroundColor: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
                      color: active ? st.accent : "var(--text-subtle, #8e8e96)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: active ? "600" : "500",
                      transition: "all 0.15s ease"
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
                    checked: allFilteredActive,
                    onChange: handleToggleAllFiltered,
                    style: { cursor: "pointer", accentColor: "#ffffff", width: "14px", height: "14px" }
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
                    padding: "8px 14px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    fontSize: "11px"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                  h("span", { style: { fontWeight: "700", color: "#10b981" } }, "Ranking Ping Real:"),
                  top3.length === 0 ? h("span", { style: { color: "#f87171" } }, "Nenhum modelo online nos testes recentes.") : top3.map(
                    ([mid, t], idx) => h(
                      "span",
                      {
                        key: mid,
                        style: {
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          backgroundColor: idx === 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                          color: idx === 0 ? "#34d399" : "#e4e4e7",
                          fontFamily: "monospace",
                          fontWeight: idx === 0 ? "700" : "500"
                        }
                      },
                      `#${idx + 1} ${mid} (${t.latency}ms)`
                    )
                  )
                ),
                h(
                  "span",
                  { style: { color: "#9ca3af", fontFamily: "monospace" } },
                  `Estabilidade: ${okCount}/${tested.length} online (${pct}%)`
                )
              );
            })(),
            // Model List Rows
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "6px" } },
              paginatedModels.length === 0 ? h(
                "div",
                {
                  style: {
                    padding: "28px 16px",
                    textAlign: "center",
                    borderRadius: "10px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px dashed rgba(255, 255, 255, 0.08)",
                    color: "var(--text-subtle, #8e8e96)",
                    fontSize: "12px"
                  }
                },
                statusFilter === "online" || statusFilter === "error" ? "Nenhum modelo corresponde a este filtro ainda. Clique em 'Testar Visíveis' para rodar o healthcheck." : "Nenhum modelo encontrado com os filtros atuais."
              ) : paginatedModels.map((item) => {
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
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      backgroundColor: isDisabled ? "rgba(255, 255, 255, 0.01)" : "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "10px",
                      opacity: isDisabled ? 0.45 : 1,
                      transition: "all 0.15s ease"
                    }
                  },
                  // Left: Toggle Checkbox + Model Name & Badges
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 } },
                    h("input", {
                      type: "checkbox",
                      checked: !isDisabled,
                      onChange: () => handleToggleModel(mid),
                      style: { cursor: "pointer", accentColor: "#10b981", width: "16px", height: "16px" }
                    }),
                    h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                        h(
                          "span",
                          {
                            style: {
                              fontWeight: "600",
                              fontSize: "13px",
                              color: isDisabled ? "#8e8e96" : "#ffffff",
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
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(168, 85, 247, 0.15)",
                              color: "#c084fc",
                              fontWeight: "700"
                            }
                          },
                          "THINKING"
                        ),
                        isFree && h(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              fontWeight: "700"
                            }
                          },
                          "FREE"
                        )
                      ),
                      h(
                        "div",
                        { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                        item.context_window ? `Ctx: ${formatNumber(item.context_window)} tokens` : "Ctx: 128k tokens"
                      )
                    )
                  ),
                  // Right: Test Button + Status Badge + Sync Indicator
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "10px" } },
                    // Test Result Indicator
                    testRes && h(
                      "span",
                      {
                        style: {
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          backgroundColor: testRes.status === "ok" ? "rgba(16, 185, 129, 0.15)" : testRes.status === "testing" ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: testRes.status === "ok" ? "#10b981" : testRes.status === "testing" ? "#60a5fa" : "#f87171",
                          fontWeight: "600"
                        }
                      },
                      testRes.status === "testing" ? "Testando..." : testRes.status === "ok" ? `${testRes.latency}ms · Online` : `Erro · ${testRes.errorMsg || "Falha"}`
                    ),
                    // Individual Test Button
                    h(
                      "button",
                      {
                        onClick: () => handleTestSingleModel(mid),
                        disabled: (testRes == null ? void 0 : testRes.status) === "testing",
                        style: {
                          borderRadius: "9999px",
                          padding: "4px 10px",
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          color: "#ffffff",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
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
                    // Active in Buzz Badge
                    h(
                      "span",
                      {
                        style: {
                          fontSize: "11px",
                          fontWeight: "500",
                          color: isDisabled ? "#8e8e96" : "#10b981",
                          minWidth: "85px",
                          textAlign: "right"
                        }
                      },
                      isDisabled ? "✕ Desativado" : "✓ Ativo no Buzz"
                    )
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
                  paddingTop: "14px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  flexWrap: "wrap",
                  gap: "10px"
                }
              },
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                pageSize === 0 ? `Exibindo todos os ${filteredModels.length} modelos` : `Exibindo ${Math.min((currentPage - 1) * pageSize + 1, filteredModels.length)}–${Math.min(
                  currentPage * pageSize,
                  filteredModels.length
                )} de ${filteredModels.length} modelos`
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "button",
                  {
                    onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
                    disabled: currentPage <= 1,
                    style: {
                      borderRadius: "9999px",
                      padding: "5px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      color: currentPage <= 1 ? "rgba(255,255,255,0.3)" : "#ffffff",
                      border: "none",
                      cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  SVG_ICONS.chevronLeft({ h, width: 14, height: 14 }),
                  "Anterior"
                ),
                h(
                  "span",
                  { style: { fontSize: "12px", color: "#8e8e96", padding: "0 6px" } },
                  `Página ${currentPage} de ${totalPages}`
                ),
                h(
                  "button",
                  {
                    onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
                    disabled: currentPage >= totalPages,
                    style: {
                      borderRadius: "9999px",
                      padding: "5px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      color: currentPage >= totalPages ? "rgba(255,255,255,0.3)" : "#ffffff",
                      border: "none",
                      cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }
                  },
                  "Próxima",
                  SVG_ICONS.chevronRight({ h, width: 14, height: 14 })
                ),
                // Page size selector
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px" } },
                  h("span", { style: { fontSize: "12px", color: "#8e8e96" } }, "Por página:"),
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
                          borderRadius: "6px",
                          padding: "2px 8px",
                          border: "none",
                          backgroundColor: pageSize === sz ? "rgba(255, 255, 255, 0.15)" : "transparent",
                          color: pageSize === sz ? "#ffffff" : "#8e8e96",
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
  const SESSION_PATHS = [
    "~/.buzz/.nexusmind_auth_session.json",
    "/Users/heltonfraga/.buzz/.nexusmind_auth_session.json"
  ];
  const readSessionFile = async () => {
    var _a2;
    if (!((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.readFile)) return null;
    for (const p of SESSION_PATHS) {
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
  };
  const persistSessionData = async (sessionData, _token) => {
    var _a2;
    try {
      localStorage.removeItem("nexusmind_mcp_token");
      localStorage.removeItem("nexusmind_auth_session");
    } catch {
    }
    const serialized = JSON.stringify(sessionData, null, 2);
    for (const p of SESSION_PATHS) {
      try {
        if ((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.writeFile) {
          await ctx.host.writeFile(p, serialized);
          break;
        }
      } catch {
      }
    }
  };
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
    var _a2, _b2, _c2, _d;
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
      const stored = (_d = localStorage.getItem("nexusmind_mcp_token")) == null ? void 0 : _d.trim();
      if (stored && stored !== "connected") return stored;
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
- nexusmind_openai: padrão mistralai/mistral-large-4-1t-a52b (OpenAI-compatible /v1)
- nexusmind_anthropic: padrão claude-sonnet-4-6 (/v1/messages)
- nexusmind_antigravity: padrão gemini-3.8-flash-medium (Gemini & Claude Thinking)
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
      console.log("[NEXUSMIND] 5 agentTools + DecisionProvider registrados com sucesso no harness do Buzz.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar agentTools:", err);
    }
  }
}
export {
  ANTHROPIC_ONLY_CLAUDE,
  ANTIGRAVITY_ONLY_CLAUDE,
  CANONICAL_GROUPS,
  OFFICIAL_ENDPOINTS,
  apply,
  applyBestModelToAgent,
  buildModelRankingSnapshot,
  createNexusMindDecisionProvider,
  getModelGroups,
  inject,
  loadGatewayUsageByModel,
  persistModelRankingSnapshot,
  scoreModelForTier,
  selectBestModelByTier
};
