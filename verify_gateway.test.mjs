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

assert.equal(tools.size, 9, "devem existir exatamente 9 agentTools no NexusMind Gateway v3.1");
assert.ok(tools.has("nexusmind_models"));
assert.ok(tools.has("nexusmind_status"));
assert.ok(tools.has("nexusmind_best_model"));
assert.ok(tools.has("nexusmind_apply_best_model"));
assert.ok(tools.has("nexusmind_model_ranking"));
assert.ok(tools.has("nexusmind_failover_agent"));
assert.ok(tools.has("nexusmind_quality_bench"));
assert.ok(tools.has("nexusmind_vip_policy"));
assert.ok(tools.has("nexusmind_router_status"));
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
              { id: "gemini-2.5-flash" },
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
    defaultModel: "gemini-2.5-flash",
    defaultCtx: 1048576,
    defaultOut: 65536,
  },
};

const bestFast = await nmMod.selectBestModelByTier(mockCtx, groups, { tier: "tier1_fast" });
assert.equal(bestFast.ok, true);
assert.equal(bestFast.selectedModel, "gemini-2.5-flash");
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

// 4. Testar buildModelRankingSnapshot (Ranking Real com telemetria do Gateway + ping)
const rankingSnap = nmMod.buildModelRankingSnapshot({
  catalogModels: [
    { id: "qwen/qwen3:free", primaryGroup: "nexusmind_openai" },
    { id: "gemini-2.5-flash", primaryGroup: "nexusmind_antigravity" },
    { id: "claude-sonnet-4-6", primaryGroup: "nexusmind_anthropic" },
  ],
  groups,
  usageByModel: {
    "gemini-2.5-flash": { calls: 1358, avgDurationMs: 12000, avgFirstTokenMs: 1200, totalCostUsd: 29.4, avgCostUsd: 0.021, cacheHitPct: 88.5, lastSeenAt: "2026-11-24T18:00:00Z" },
    "claude-sonnet-4-6": { calls: 159, avgDurationMs: 6760, avgFirstTokenMs: 900, totalCostUsd: 4.0, avgCostUsd: 0.025, cacheHitPct: 91.0, lastSeenAt: "2026-11-24T18:00:00Z" },
  },
  usageSampleSize: 1517,
  liveProbes: {
    "gemini-2.5-flash": { status: "ok", latency: 650 },
    "claude-sonnet-4-6": { status: "ok", latency: 820 },
  },
  tier: "geral",
  avoidFree: true,
});
assert.equal(rankingSnap.source, "gateway_usage+live_probe");
assert.ok(rankingSnap.bestByTier.geral && !rankingSnap.bestByTier.geral.model.includes(":free"));
assert.ok(rankingSnap.bestByTier.tier1_fast?.model === "gemini-2.5-flash");

// 5. Testar política de roteamento: autoAssignBlocked e forceFree
const snapBlocked = nmMod.buildModelRankingSnapshot({
  catalogModels: [
    { id: "qwen/qwen3:free", primaryGroup: "nexusmind_openai" },
    { id: "gemini-2.5-flash", primaryGroup: "nexusmind_antigravity" },
    { id: "claude-opus-4-6-thinking", primaryGroup: "nexusmind_anthropic" },
  ],
  groups,
  usageByModel: {
    "claude-opus-4-6-thinking": { calls: 402, avgDurationMs: 9000, avgFirstTokenMs: 1100, totalCostUsd: 120, avgCostUsd: 0.30, cacheHitPct: 80, lastSeenAt: "2026-11-24T18:00:00Z" },
    "gemini-2.5-flash": { calls: 1358, avgDurationMs: 12000, avgFirstTokenMs: 1200, totalCostUsd: 29.4, avgCostUsd: 0.021, cacheHitPct: 88.5, lastSeenAt: "2026-11-24T18:00:00Z" },
  },
  usageSampleSize: 1760,
  tier: "tier3_frontier",
  policy: {
    strategy: "balanced",
    forceFree: false,
    maxCostPerReqUsd: null,
    autoAssignBlocked: ["claude-opus-4-6-thinking"],
    tierPins: {},
  },
});
const opusRow = snapBlocked.models.find((m) => m.model === "claude-opus-4-6-thinking");
assert.ok(opusRow, "modelo bloqueado continua visível na tabela para uso manual");
assert.equal(opusRow.eligibleForAuto, false, "modelo em autoAssignBlocked deve ter eligibleForAuto=false");
assert.notEqual(snapBlocked.bestByTier.tier3_frontier?.model, "claude-opus-4-6-thinking", "modelo bloqueado não pode ser eleito automaticamente");

const snapForceFree = nmMod.buildModelRankingSnapshot({
  catalogModels: [
    { id: "qwen/qwen3:free", primaryGroup: "nexusmind_openai" },
    { id: "gemini-2.5-flash", primaryGroup: "nexusmind_antigravity" },
  ],
  groups,
  usageByModel: {
    "gemini-2.5-flash": { calls: 1358, avgDurationMs: 12000, avgFirstTokenMs: 1200, totalCostUsd: 29.4, avgCostUsd: 0.021, cacheHitPct: 88.5, lastSeenAt: "2026-11-24T18:00:00Z" },
  },
  usageSampleSize: 1358,
  tier: "geral",
  policy: {
    strategy: "balanced",
    forceFree: true,
    maxCostPerReqUsd: null,
    autoAssignBlocked: [],
    tierPins: {},
  },
});
assert.equal(snapForceFree.bestByTier.geral?.model, "qwen/qwen3:free", "forceFree=true deve priorizar modelos :free");

// 6. C2: Persistência de sessão MCP fora do localStorage + hidratação pós-reinício
const fakeFiles = new Map();
const fakeLocalStorage = new Map([["nexusmind_mcp_token", "legacy-should-be-removed"]]);
globalThis.localStorage = {
  getItem: (k) => (fakeLocalStorage.has(k) ? fakeLocalStorage.get(k) : null),
  setItem: (k, v) => fakeLocalStorage.set(k, String(v)),
  removeItem: (k) => fakeLocalStorage.delete(k),
};
const sessionCtx = {
  host: {
    writeFile: async (p, content) => { fakeFiles.set(p, content); },
    readFile: async (p) => {
      if (!fakeFiles.has(p)) throw new Error("ENOENT");
      return fakeFiles.get(p);
    },
  },
};
const persisted = await nmMod.writePrivateSessionData(sessionCtx, {
  status: "authorized",
  access_token: "mcp_at_survives_restart_123",
  source: "manual_key",
});
assert.equal(persisted, true, "C2: sessão deve ser persistida no arquivo de sessão");
assert.equal(fakeLocalStorage.has("nexusmind_mcp_token"), false, "C2: token não pode permanecer em localStorage");
// Simula reinício do Buzz (localStorage limpo)
fakeLocalStorage.clear();
const hydratedToken = await nmMod.loadPersistedAccountToken(sessionCtx);
assert.equal(hydratedToken, "mcp_at_survives_restart_123", "C2: token MCP deve sobreviver ao reinício via arquivo de sessão");

// 7. C3: Merge YAML seguro de secrets.yaml (preserva comentários, aspas e '#' dentro de valores + chmod 0600)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nm-secrets-c3-"));
const secretsFile = path.join(tmpDir, "secrets.yaml");
fs.writeFileSync(
  secretsFile,
  "# Comentario de cabecalho\nCUSTOM_QUOTED: \"abc#123:def\"\nCUSTOM_SINGLE: 'foo # bar'\nOPENAI_API_KEY: sk-old\n",
  "utf8"
);
const pyTest = `
import os, json
def write_private(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(content)
    os.chmod(path, 0o600)
${nmMod.GOOSE_SECRETS_MERGE_PY}
res = merge_goose_secrets(${JSON.stringify(secretsFile)}, {
    "OPENAI_API_KEY": "sk-openai-new",
    "ANTHROPIC_API_KEY": "sk-anthropic-new",
    "ANTIGRAVITY_API_KEY": "sk-antigravity-new",
})
print(json.dumps(res))
`;
const pyOut = execFileSync("/usr/local/bin/python3.13", ["-c", pyTest], { encoding: "utf8" }).trim();
const merged = JSON.parse(pyOut);
const mode = fs.statSync(secretsFile).mode & 0o777;
assert.equal(mode, 0o600, "C3: secrets.yaml deve ter permissão 0600");
assert.equal(merged.CUSTOM_QUOTED, "abc#123:def", "C3: valor com '#' e ':' entre aspas duplas deve ser preservado");
assert.equal(merged.CUSTOM_SINGLE, "foo # bar", "C3: valor com '#' entre aspas simples deve ser preservado");
assert.equal(merged.OPENAI_API_KEY, "sk-openai-new");
assert.notEqual(merged.ANTHROPIC_API_KEY, merged.ANTIGRAVITY_API_KEY, "C3: ANTHROPIC_API_KEY não pode receber chave Antigravity");
fs.rmSync(tmpDir, { recursive: true, force: true });

// 8. C1 (Top 40 ranqueado no Goose): prioriza uso real + qualidade + online em vez de ordem alfabética
const alphaFill = Array.from({ length: 50 }, (_, i) => `aaa-model-${String(i + 1).padStart(2, "0")}`);
const rankedTop = nmMod.selectTopGooseModelsByGroup({
  groupModelsMap: {
    nexusmind_openai: [...alphaFill, "z-gpt-5-turbo", "z-claude-sonnet-4-6", "mistralai/mistral-large-4-1t-a52b", "aaa-broken-free:free"],
  },
  catalogModels: [...alphaFill, "z-gpt-5-turbo", "z-claude-sonnet-4-6", "mistralai/mistral-large-4-1t-a52b", "aaa-broken-free:free"].map((id) => ({ id, primaryGroup: "nexusmind_openai" })),
  usageByModel: {
    "z-gpt-5-turbo": { calls: 950, avgDurationMs: 2100, avgFirstTokenMs: 400, totalCostUsd: 12, avgCostUsd: 0.012, cacheHitPct: 85, lastSeenAt: "2026-11-25T16:00:00Z" },
  },
  usageSampleSize: 950,
  liveProbes: {
    "z-claude-sonnet-4-6": { status: "ok", latency: 1200 },
    "aaa-broken-free:free": { status: "error", errorMsg: "HTTP 429" },
  },
  limit: 40,
});
assert.equal(rankedTop.nexusmind_openai.length, 40, "C1: Goose deve manter teto estrito de 40 modelos por provedor");
assert.ok(rankedTop.nexusmind_openai.slice(0, 3).includes("z-claude-sonnet-4-6"), "C1: modelo verificado online deve entrar no top 3 mesmo começando com z");
assert.ok(rankedTop.nexusmind_openai.slice(0, 3).includes("z-gpt-5-turbo"), "C1: modelo mais usado deve entrar no top 3 mesmo começando com z");
assert.ok(rankedTop.nexusmind_openai.slice(0, 3).includes("mistralai/mistral-large-4-1t-a52b"), "C1: defaultModel do grupo deve entrar no top 3");
assert.equal(rankedTop.nexusmind_openai.includes("aaa-broken-free:free"), false, "C1: modelo :free com erro deve ficar fora dos 40");

// 9. v2.8: Herança de cores e fontes do Buzz Desktop no NexusMind Gateway
assert.equal(typeof nmMod.NEXUSMIND_THEME_CSS, "string", "NEXUSMIND_THEME_CSS deve ser exportado");
assert.ok(nmMod.NEXUSMIND_THEME_CSS.includes("--affordance-accent-prominent"), "Tema deve herdar --affordance-accent-prominent do Buzz");
assert.ok(nmMod.NEXUSMIND_THEME_CSS.includes("--text-on-accent"), "Tema deve herdar --text-on-accent do Buzz");
assert.ok(nmMod.NEXUSMIND_THEME_CSS.includes("font-family: inherit"), "Tema deve herdar a fonte nativa do Buzz");
for (const rel of [
  "src/index.tsx",
  "src/components/ModelRankingTab.tsx",
  "src/components/NexusMindAgentsTab.tsx",
  "src/components/AutopilotFailoverTab.tsx",
]) {
  const srcText = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
  assert.ok(!srcText.includes("var(--affordance-prominent"), `${rel} não deve usar --affordance-prominent monocromático em CTAs`);
  assert.ok(!srcText.includes("system-ui, -apple-system"), `${rel} não deve sobrescrever a fonte padrão do Buzz`);
}

// 10. v3.0: Proteção VIP (3 estados), Classificação de Erros, Circuit Breaker, Quality Probe e Failover Agêntico
assert.equal(nmMod.classifyGatewayError("You've hit your weekly limit · resets Nov 30"), "weekly_limit");
assert.equal(nmMod.classifyGatewayError("Server error: upstream_malformed_function_call"), "malformed_tool");
assert.equal(nmMod.classifyGatewayError("Upstream response stream ended before completion"), "stream_cut");
assert.equal(nmMod.classifyGatewayError("Resource not found (404)", 404), "not_found");

const v3Groups = {
  nexusmind_openai: { id: "nexusmind_openai", platformKey: "openai", groupName: "Saldo OpenAI", displayName: "NexusMind OpenAI", defaultKey: "sk-test", defaultModel: "mistralai/mistral-large-4-1t-a52b", defaultCtx: 131072, defaultOut: 8192 },
  nexusmind_anthropic: { id: "nexusmind_anthropic", platformKey: "anthropic", groupName: "Saldo Claude", displayName: "NexusMind Anthropic", defaultKey: "sk-test", defaultModel: "claude-sonnet-4-6", defaultCtx: 200000, defaultOut: 8192 },
  nexusmind_antigravity: { id: "nexusmind_antigravity", platformKey: "antigravity", groupName: "Antigravity", displayName: "NexusMind Anti-Gravity", defaultKey: "sk-test", defaultModel: "gemini-2.5-flash", defaultCtx: 1048576, defaultOut: 65536 },
};

let vipPol = nmMod.loadVipPolicy();
assert.equal(nmMod.isVipAgent("OrgFy Iris", vipPol), true, "OrgFy Iris deve ser VIP por padrão");
assert.equal(nmMod.isVipAgent("Conselho COO", vipPol), true, "Conselho COO deve ser VIP por padrão");
assert.equal(nmMod.isVipAgent("OrgFy Atlas", vipPol), false, "OrgFy Atlas deve ser worker (Pool Auto)");
assert.equal(nmMod.getModelAccessMode("gpt-6.1-terra", "nexusmind_openai", vipPol), "vip", "gpt-6.1-terra deve ser VIP");
assert.equal(nmMod.getModelAccessMode("claude-sonnet-4-6", "nexusmind_anthropic", vipPol), "vip", "Anthropic deve ser VIP");
assert.equal(nmMod.getModelAccessMode("gemini-2.5-flash", "nexusmind_antigravity", vipPol), "auto", "gemini-2.5-flash deve ser Auto");

vipPol = nmMod.setModelAccessMode(vipPol, "nex-n2-pro", "blocked");
assert.equal(nmMod.getModelAccessMode("nex-n2-pro", "nexusmind_openai", vipPol), "blocked", "Bloqueio 1-clique deve marcar modelo como blocked");

const v3Ranking = nmMod.buildModelRankingSnapshot({
  catalogModels: [
    { id: "claude-sonnet-4-6", primaryGroup: "nexusmind_anthropic" },
    { id: "gpt-6.1-terra", primaryGroup: "nexusmind_openai" },
    { id: "nex-n2-pro", primaryGroup: "nexusmind_openai" },
    { id: "gemini-2.5-flash", primaryGroup: "nexusmind_antigravity" },
    { id: "mistralai/mistral-large-4-1t-a52b", primaryGroup: "nexusmind_openai" },
  ],
  groups: v3Groups,
  usageByModel: {
    "claude-sonnet-4-6": { calls: 900, avgDurationMs: 4000, avgFirstTokenMs: 600, totalCostUsd: 25, avgCostUsd: 0.02, cacheHitPct: 90, lastSeenAt: "2026-11-26T10:00:00Z" },
    "gemini-2.5-flash": { calls: 800, avgDurationMs: 5000, avgFirstTokenMs: 700, totalCostUsd: 8, avgCostUsd: 0.01, cacheHitPct: 85, lastSeenAt: "2026-11-26T10:00:00Z" },
  },
  usageSampleSize: 1700,
  vipPolicy: vipPol,
});

// Worker Atlas falhando em nex-n2-pro NUNCA pode receber claude-sonnet-4-6 ou gpt-6.1-terra (VIP)
const workerPick = nmMod.pickFailoverCandidate({
  agentName: "OrgFy Atlas",
  currentModel: "nex-n2-pro",
  rankingSnapshot: v3Ranking,
  vipPolicy: vipPol,
  groups: v3Groups,
});
assert.equal(workerPick.ok, true);
assert.equal(workerPick.isVip, false);
assert.notEqual(workerPick.model, "claude-sonnet-4-6", "Worker NUNCA deve receber modelo VIP Anthropic");
assert.notEqual(workerPick.model, "gpt-6.1-terra", "Worker NUNCA deve receber modelo VIP gpt-6.1-terra");
assert.equal(workerPick.model, "gemini-2.5-flash", "Worker deve receber melhor modelo Auto saudável");

// VIP Iris falhando em gpt-6.1-terra deve ir estritamente para cadeia VIP (claude-sonnet-4-6)
const vipPick = nmMod.pickFailoverCandidate({
  agentName: "OrgFy Iris",
  currentModel: "gpt-6.1-terra",
  rankingSnapshot: v3Ranking,
  vipPolicy: vipPol,
  groups: v3Groups,
});
assert.equal(vipPick.ok, true);
assert.equal(vipPick.isVip, true);
assert.equal(vipPick.model, "claude-sonnet-4-6", "Iris deve fazer failover apenas dentro da cadeia VIP");

// Quality Probe (Tool-Calling Fidelity)
const qMockCtx = {
  host: {
    request: async ({ body }) => {
      const parsed = JSON.parse(body);
      if (parsed.model === "nex-n2-pro") {
        return { status: 500, body: JSON.stringify({ error: "upstream_malformed_function_call" }) };
      }
      return {
        status: 200,
        body: JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  { id: "call_1", type: "function", function: { name: "check_status", arguments: '{"service":"orgfy"}' } },
                ],
              },
            },
          ],
        }),
      };
    },
  },
};
const qOk = await nmMod.runModelQualityProbe(qMockCtx, "gemini-2.5-flash", v3Groups.nexusmind_antigravity);
assert.equal(qOk.online, true);
assert.equal(qOk.toolCallOk, true);
assert.ok(qOk.qualityScore >= 75, "Modelo com tool_call válido deve pontuar >= 75");
const qBad = await nmMod.runModelQualityProbe(qMockCtx, "nex-n2-pro", v3Groups.nexusmind_openai);
assert.equal(qBad.online, false);
assert.equal(qBad.errorKind, "malformed_tool");

// End-to-end executeAgentFailover com Quarentena + Wake
const foSaved = [];
const foWoken = [];
const foCtx = {
  agents: {
    snapshot: () => ({
      agents: [{ key: "local:orgfy-atlas", name: "OrgFy Atlas", config: { model: "mistralai/mistral-large-4-1t-a52b", provider: "nexusmind_openai" } }],
    }),
    save: async (k, p) => foSaved.push({ k, p }),
    wake: async (k) => foWoken.push(k),
  },
};
const foEvt = await nmMod.executeAgentFailover(foCtx, v3Groups, {
  agentKeyOrName: "OrgFy Atlas",
  errorText: "Server error: Upstream response stream ended before",
  trigger: "watchdog",
  rankingSnapshot: v3Ranking,
  vipPolicy: vipPol,
  wakeAfter: true,
});
assert.equal(foEvt.applied, true);
assert.equal(foEvt.wokeAgent, true);
assert.equal(foEvt.toModel, "gemini-2.5-flash");
assert.equal(foSaved.length, 1);
assert.equal(foWoken.length, 1);
assert.ok(nmMod.loadQuarantines()["mistralai/mistral-large-4-1t-a52b"], "Modelo que falhou deve entrar em quarentena");
nmMod.releaseQuarantine();

console.log("[NEXUSMIND GATEWAY v3.0 OK]", JSON.stringify({
  tools: Array.from(tools.keys()),
  decisionProvider: registeredProvider.id,
  bestFast: bestFast.selectedModel,
  appliedFrontier: applied.selectedModel,
  rankingTopGeral: rankingSnap.bestByTier.geral.model,
  forceFreeTop: snapForceFree.bestByTier.geral.model,
  workerFailover: workerPick.model,
  vipFailover: vipPick.model,
  qualityProbeOk: qOk.qualityScore,
  endToEndFailover: `${foEvt.fromModel} -> ${foEvt.toModel}`,
}));
