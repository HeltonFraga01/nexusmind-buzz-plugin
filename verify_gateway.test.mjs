import assert from "node:assert/strict";
import * as nmMod from "./plugin.js";

// 1. Verificar registro de 4 agentTools + DecisionProvider 'nexusmind-fast'
const tools = new Map();
let registeredProvider = null;

nmMod.apply({
  react: { createElement: () => null },
  pages: { register: () => {} },
  settingsCards: { register: () => {} },
  agents: {
    addTool: (t) => tools.set(t.name, t),
    addInstructions: () => {},
  },
  decisions: {
    registerProvider: (p) => {
      registeredProvider = p;
      return () => {};
    },
  },
  host: {},
});

assert.equal(tools.size, 4, "devem existir exatamente 4 agentTools no NexusMind Gateway");
assert.ok(tools.has("nexusmind_models"));
assert.ok(tools.has("nexusmind_status"));
assert.ok(tools.has("nexusmind_best_model"));
assert.ok(tools.has("nexusmind_apply_best_model"));
assert.ok(registeredProvider && registeredProvider.id === "nexusmind-fast", "DecisionProvider 'nexusmind-fast' deve ser registrado");

// 2. Testar selectBestModelByTier evitando :free por padrão e elegendo tier1_fast / tier3_frontier
const savedConfigs = [];
const mockCtx = {
  host: {
    request: async ({ url, body }) => {
      if (url.endsWith("/models")) {
        return {
          status: 200,
          body: JSON.stringify({
            data: [
              { id: "qwen/qwen3:free" },
              { id: "gemini-3.8-flash-medium" },
              { id: "claude-opus-4-6-thinking" },
            ],
          }),
        };
      }
      const parsed = JSON.parse(body);
      if (parsed.messages?.[0]?.content?.includes("JSON")) {
        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    escopo_ok: { type: "yes_no", probability: 0.95 },
                    tier: { type: "choice", choice: "tier2_balanced", confidence: 0.87, probabilities: { tier2_balanced: 0.87 } },
                  }),
                },
              },
            ],
          }),
        };
      }
      return { status: 200, body: JSON.stringify({ id: "ok" }) };
    },
  },
  agents: {
    snapshot: () => ({
      agents: [{ key: "local:orgfy-teo", name: "OrgFy Teo", config: { model: "old-free:free", provider: "nexusmind_openai" } }],
    }),
    save: async (key, patch) => {
      savedConfigs.push({ key, patch });
    },
  },
};

const groups = {
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    platformKey: "antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    defaultKey: "sk-test",
    defaultModel: "gemini-3.8-flash-medium",
    defaultCtx: 1048576,
    defaultOut: 65536,
  },
};

const bestFast = await nmMod.selectBestModelByTier(mockCtx, groups, { tier: "tier1_fast" });
assert.equal(bestFast.ok, true);
assert.equal(bestFast.selectedModel, "gemini-3.8-flash-medium");
assert.equal(bestFast.ranking.some((r) => r.isFree), false, "avoid_free=true deve excluir modelos :free por padrão");

const applied = await nmMod.applyBestModelToAgent(mockCtx, groups, {
  agente: "OrgFy Teo",
  tier: "tier3_frontier",
});
assert.equal(applied.ok, true);
assert.equal(applied.applied, true);
assert.equal(applied.selectedModel, "claude-opus-4-6-thinking");
assert.equal(savedConfigs.length, 1);
assert.equal(savedConfigs[0].patch.config.model, "claude-opus-4-6-thinking");

// 3. Testar DecisionProvider nativo
const dp = nmMod.createNexusMindDecisionProvider(mockCtx, groups);
const dec = await dp.decide(
  {
    state: "Card atômico com 2 arquivos",
    questions: {
      escopo_ok: { type: "yes_no", instructions: "Escopo atômico?" },
      tier: {
        type: "choice",
        instructions: "Tier?",
        options: { tier1_fast: "Rápido", tier2_balanced: "Balanceado" },
      },
    },
    timeoutMs: 5000,
  },
  { signal: new AbortController().signal }
);
assert.equal(dec.outcome, "answered");
assert.equal(dec.answers.escopo_ok.probability, 0.95);
assert.equal(dec.answers.tier.choice, "tier2_balanced");

console.log("[NEXUSMIND GATEWAY v2.4 OK]", JSON.stringify({
  tools: Array.from(tools.keys()),
  decisionProvider: registeredProvider.id,
  bestFast: bestFast.selectedModel,
  appliedFrontier: applied.selectedModel,
}));
