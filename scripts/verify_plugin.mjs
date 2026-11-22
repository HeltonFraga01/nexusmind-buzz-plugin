import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.resolve(__dirname, "../plugin.js");
const pluginCode = fs.readFileSync(pluginPath, "utf8");

assert.equal((pluginCode.match(/\bfetch\s*\(/g) || []).length, 0, "plugin.js nao deve conter nenhuma chamada fetch()");

const nmMod = await import(pathToFileURL(pluginPath).href);
assert.ok(Array.isArray(nmMod.inject), "inject deve ser array");
assert.equal(typeof nmMod.apply, "function", "apply deve ser function");

function makeHarness({ profileStatus = 200, profileBalance = 1234.5, failGroupKey = null, hasToken = true } = {}) {
  const tools = new Map();
  const ctx = {
    react: { createElement: () => null },
    pages: { register: () => {} },
    settingsCards: { register: () => {} },
    agents: {
      addInstructions: () => {},
      addTool: (t) => tools.set(t.name, t),
    },
    host: {
      readFile: async () => {
        if (!hasToken) throw new Error("ENOENT");
        return JSON.stringify({ access_token: "mcp_test_token_123" });
      },
      request: async (req) => {
        if (req.url.includes("/api/v1/user/profile")) {
          if (profileStatus !== 200) {
            return { status: profileStatus, headers: {}, body: JSON.stringify({ error: { message: "Unauthorized" } }) };
          }
          return { status: 200, headers: {}, body: JSON.stringify({ data: { username: "HeltonReal", balance: profileBalance, role: "admin" } }) };
        }
        if (failGroupKey && req.headers.Authorization.includes(failGroupKey)) {
          throw new Error("timeout simulated");
        }
        return {
          status: 200,
          headers: {},
          body: JSON.stringify({ data: [{ id: "shared-model" }, { id: "grp-model-" + req.headers.Authorization.slice(7, 13) }] }),
        };
      },
    },
  };
  nmMod.apply(ctx);
  return { tools };
}

// 1. Positivo via ctx.host.request + saldo real da API
const nm1 = makeHarness({ profileStatus: 200, profileBalance: 1234.5 });
const nmModels = JSON.parse(await nm1.tools.get("nexusmind_models").call({}, {}, { group: "all" }));
assert.equal(nmModels.transport, "ctx.host.request");
assert.equal(nmModels.status, "operational");
assert.equal(nmModels.totalGroups, 4);
assert.equal(nmModels.totalModels, 5, "deve deduplicar shared-model entre os 4 grupos");

const nmStatus = JSON.parse(await nm1.tools.get("nexusmind_status").call({}, {}, {}));
assert.equal(nmStatus.transport, "ctx.host.request");
assert.equal(nmStatus.status, "operational");
assert.equal(nmStatus.quota.source, "live_api");
assert.equal(nmStatus.quota.balanceUsd, 1234.5, "deve retornar saldo real da API e nao 5413.56");
console.log("[NEXUSMIND POSITIVO OK]", JSON.stringify({ status: nmStatus.status, totalModels: nmModels.totalModels, quota: nmStatus.quota }));

// 2. Negativo: sem token e 1 grupo falhando
const nm2 = makeHarness({ hasToken: false, failGroupKey: "sk-f37b25" });
const nmStatusDeg = JSON.parse(await nm2.tools.get("nexusmind_status").call({}, {}, {}));
assert.equal(nmStatusDeg.status, "degraded");
assert.equal(nmStatusDeg.quota.status, "unavailable");
assert.equal(nmStatusDeg.quota.balanceUsd, null, "sem token nao pode retornar 5413.56");
assert.equal(nmStatusDeg.groups.nexusmind_grok.httpStatus, null, "erro de transporte deve reportar httpStatus: null");
console.log("[NEXUSMIND NEGATIVO OK]", JSON.stringify({ status: nmStatusDeg.status, quota: nmStatusDeg.quota }));
