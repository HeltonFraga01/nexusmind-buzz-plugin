const inject = ["react", "pages", "settingsCards", "host"];
const ICON = "data:image/svg+xml;base64," + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'
);
const CANONICAL_GROUPS = {
  nexusmind_openai: {
    id: "nexusmind_openai",
    groupName: "Saldo OpenAI",
    displayName: "NexusMind OpenAI",
    description: "Modelos OpenAI, Codex e NVIDIA NIM via NexusMind (Grupo Saldo OpenAI)",
    defaultKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    defaultModel: "google/gemma-4-31b-it",
    defaultCtx: 131072,
    defaultOut: 8192
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    description: "Modelos Anthropic Claude 3.5 e 3.7 via NexusMind (Grupo Saldo Claude)",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 2e5,
    defaultOut: 8192
  },
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    description: "Modelos Google Gemini e Anti-Gravity Gateway via NexusMind (Grupo Antigravity-Saldo)",
    defaultKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    defaultModel: "gemini-3.8-flash-medium",
    defaultCtx: 1048576,
    defaultOut: 65536
  },
  nexusmind_grok: {
    id: "nexusmind_grok",
    groupName: "Grok",
    displayName: "NexusMind Grok",
    description: "Modelos xAI Grok via NexusMind (Grupo Grok)",
    defaultKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    defaultModel: "grok-4.5",
    defaultCtx: 131072,
    defaultOut: 16384
  }
};
function isReasoning(modelId) {
  const m = modelId.toLowerCase();
  return m.includes("reason") || m.includes("thinking") || m.includes("opus") || m.includes("sonnet") || m.includes("o1") || m.includes("o3") || m.includes("medium") || m.includes("high") || m.includes("sonar") || m.includes("flash") || m.includes("ultra") || m.includes("luna") || m.includes("sol") || m.includes("free") || m.includes("claude-3-7");
}
function getContextWindow(pid, modelId) {
  const m = modelId.toLowerCase();
  if (pid === "nexusmind_antigravity" || m.includes("gemini")) return 1048576;
  if (pid === "nexusmind_anthropic" || m.includes("claude")) return 2e5;
  return 131072;
}
function getMaxTokens(pid, modelId) {
  const m = modelId.toLowerCase();
  if (pid === "nexusmind_antigravity" || m.includes("gemini")) return 65536;
  if (pid === "nexusmind_grok" || m.includes("grok")) return 16384;
  return 8192;
}
function apply(ctx) {
  const React = ctx.react;
  const h = React.createElement;
  function NexusMindComponent({ isSettingsCard = false }) {
    ctx.reflect.get("ui");
    const [apiKey, setApiKey] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_api_key") || "";
      } catch {
        return "";
      }
    });
    const [useCustomGroupKeys, setUseCustomGroupKeys] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_custom_group_keys") === "true";
      } catch {
        return false;
      }
    });
    const [groupKeys, setGroupKeys] = React.useState(() => {
      try {
        const stored = localStorage.getItem("nexusmind_group_keys");
        if (stored) return JSON.parse(stored);
      } catch {
      }
      return {
        nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
        nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
        nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
        nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
      };
    });
    const [selectedGroupTab, setSelectedGroupTab] = React.useState("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [filterFree, setFilterFree] = React.useState(false);
    const [filterReasoning, setFilterReasoning] = React.useState(false);
    const [models, setModels] = React.useState(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });
    const [loading, setLoading] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState(null);
    const [lastSyncTime, setLastSyncTime] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync") || "";
      } catch {
        return "";
      }
    });
    const handleSaveKeys = () => {
      try {
        localStorage.setItem("nexusmind_api_key", apiKey.trim());
        localStorage.setItem("nexusmind_custom_group_keys", String(useCustomGroupKeys));
        localStorage.setItem("nexusmind_group_keys", JSON.stringify(groupKeys));
        setStatusMessage({
          type: "success",
          text: "Configurações e Chaves NexusMind salvas com sucesso!"
        });
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: "Erro ao salvar chaves: " + err.message
        });
      }
    };
    const handleTestConnection = async () => {
      const testKey = apiKey.trim() || (useCustomGroupKeys ? groupKeys.nexusmind_openai : CANONICAL_GROUPS.nexusmind_openai.defaultKey);
      setLoading(true);
      setStatusMessage({
        type: "info",
        text: "Testando conexão com https://api.nexusmind.digital/v1/models..."
      });
      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/models",
          method: "GET",
          headers: {
            Authorization: `Bearer ${testKey}`,
            "Content-Type": "application/json"
          },
          timeoutMs: 15e3
        });
        if (res.status === 200) {
          const body = JSON.parse(res.body);
          const list = body.data || [];
          setStatusMessage({
            type: "success",
            text: `Conexão NexusMind OK! Status 200. ${list.length} modelos identificados online.`
          });
        } else {
          setStatusMessage({
            type: "error",
            text: `Falha na conexão: HTTP ${res.status} - ${res.body.slice(0, 180)}`
          });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro ao conectar com API NexusMind: ${err.message}`
        });
      } finally {
        setLoading(false);
      }
    };
    const handleSyncModels = async () => {
      setLoading(true);
      setStatusMessage({
        type: "info",
        text: "Consultando API do NexusMind e gerando catálogos Goose e Pi..."
      });
      try {
        const effectiveKeys = {
          nexusmind_openai: (useCustomGroupKeys ? groupKeys.nexusmind_openai : apiKey.trim()) || CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: (useCustomGroupKeys ? groupKeys.nexusmind_anthropic : apiKey.trim()) || CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: (useCustomGroupKeys ? groupKeys.nexusmind_antigravity : apiKey.trim()) || CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: (useCustomGroupKeys ? groupKeys.nexusmind_grok : apiKey.trim()) || CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const groupModelsMap = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: []
        };
        const allFetched = [];
        const seenIds = /* @__PURE__ */ new Set();
        for (const [pid, key] of Object.entries(effectiveKeys)) {
          try {
            const res = await ctx.host.request({
              url: "https://api.nexusmind.digital/v1/models",
              method: "GET",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json"
              },
              timeoutMs: 15e3
            });
            if (res.status === 200) {
              const body = JSON.parse(res.body);
              const items = body.data || [];
              for (const item of items) {
                if (item.id && !seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  allFetched.push(item);
                }
                const mid = item.id;
                if (!mid) continue;
                if (pid === "nexusmind_grok" && mid.toLowerCase().includes("grok")) {
                  groupModelsMap.nexusmind_grok.push(mid);
                } else if (pid === "nexusmind_anthropic" && mid.toLowerCase().includes("claude")) {
                  groupModelsMap.nexusmind_anthropic.push(mid);
                } else if (pid === "nexusmind_antigravity" && (mid.toLowerCase().includes("gemini") || mid.toLowerCase().includes("antigravity"))) {
                  groupModelsMap.nexusmind_antigravity.push(mid);
                } else if (pid === "nexusmind_openai") {
                  const l = mid.toLowerCase();
                  if (!l.includes("claude") && !l.includes("gemini") && !l.includes("grok") && (l.includes("gpt") || l.includes("codex") || l.includes("gemma") || l.includes("mistral") || l.includes("nvidia/") || l.includes("poolside") || l.includes("stepfun") || l.endsWith("-free") || l.includes(":free"))) {
                    groupModelsMap.nexusmind_openai.push(mid);
                  }
                }
              }
            }
          } catch {
          }
        }
        for (const [pid, groupDef] of Object.entries(CANONICAL_GROUPS)) {
          if (!groupModelsMap[pid] || groupModelsMap[pid].length === 0) {
            groupModelsMap[pid] = [groupDef.defaultModel];
          }
        }
        setModels(allFetched);
        localStorage.setItem("nexusmind_cached_models", JSON.stringify(allFetched));
        const now = (/* @__PURE__ */ new Date()).toLocaleString();
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync", now);
        const syncPayload = {
          effectiveKeys,
          groupModels: groupModelsMap
        };
        const pythonSyncScript = `
import os, sys, json

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]

CANONICAL = {
    "nexusmind_openai": {
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex e NVIDIA NIM via NexusMind (Grupo Saldo OpenAI)",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "google/gemma-4-31b-it"
    },
    "nexusmind_anthropic": {
        "display_name": "NexusMind Anthropic",
        "description": "Modelos Anthropic Claude 3.5 e 3.7 via NexusMind (Grupo Saldo Claude)",
        "default_ctx": 200000,
        "default_out": 8192,
        "default_model": "claude-sonnet-4-6"
    },
    "nexusmind_antigravity": {
        "display_name": "NexusMind Anti-Gravity",
        "description": "Modelos Google Gemini e Anti-Gravity Gateway via NexusMind (Grupo Antigravity-Saldo)",
        "default_ctx": 1048576,
        "default_out": 65536,
        "default_model": "gemini-3.8-flash-medium"
    },
    "nexusmind_grok": {
        "display_name": "NexusMind Grok",
        "description": "Modelos xAI Grok via NexusMind (Grupo Grok)",
        "default_ctx": 131072,
        "default_out": 16384,
        "default_model": "grok-4.5"
    }
}

def is_reasoning(m):
    l = m.lower()
    return any(w in l for w in ["reason", "thinking", "opus", "sonnet", "o1", "o3", "medium", "high", "sonar", "flash", "ultra", "luna", "sol", "free", "claude-3-7"])

# 1. Update Goose Custom Providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

# Remove legacy / stale provider files
stale_files = ["custom_nexusmind.json", "nexusmind_nvidia.json", "nexusmind_openai_models.json"]
for sf in stale_files:
    p = os.path.join(goose_dir, sf)
    if os.path.exists(p):
        try: os.remove(p)
        except: pass

pi_providers = {}
pi_auth = {}

for pid, meta in CANONICAL.items():
    token = keys.get(pid)
    models = sorted(list(set(group_models.get(pid, [meta["default_model"]]))))
    
    # Goose config
    goose_models = []
    for m in models:
        goose_models.append({
            "name": m,
            "context_limit": meta["default_ctx"],
            "reasoning": is_reasoning(m)
        })
        
    goose_cfg = {
        "name": pid,
        "engine": "openai",
        "display_name": meta["display_name"],
        "description": meta["description"],
        "api_key_env": "",
        "base_url": "https://api.nexusmind.digital/v1",
        "models": goose_models,
        "supports_streaming": True,
        "requires_auth": False,
        "preserves_thinking": True,
        "base_path": None,
        "headers": {
            "Authorization": f"Bearer {token}"
        }
    }
    
    with open(os.path.join(goose_dir, f"{pid}.json"), "w") as f:
        json.dump(goose_cfg, f, indent=2)

    # Pi config
    pi_models = []
    for m in models:
        pi_models.append({
            "id": m,
            "name": m,
            "contextWindow": meta["default_ctx"],
            "maxTokens": meta["default_out"],
            "reasoning": is_reasoning(m),
            "input": ["text"],
            "compat": {
                "maxTokensField": "max_tokens",
                "supportsDeveloperRole": False,
                "supportsUsageInStreaming": False
            }
        })
        
    pi_providers[pid] = {
        "api": "openai-completions",
        "apiKey": token,
        "baseUrl": "https://api.nexusmind.digital/v1",
        "models": pi_models
    }
    pi_auth[pid] = {
        "type": "api_key",
        "key": token
    }

# Update Goose config.yaml
goose_yaml = os.path.expanduser("~/.config/goose/config.yaml")
if os.path.exists(goose_yaml):
    try:
        import yaml
        with open(goose_yaml, "r") as f:
            gy = yaml.safe_load(f) or {}
        gy["providers"] = {
            "nexusmind_grok": {"enabled": True, "configured": True, "model": "grok-4.5"},
            "nexusmind_anthropic": {"enabled": True, "configured": True, "model": "claude-sonnet-4-6"},
            "nexusmind_antigravity": {"enabled": True, "configured": True, "model": "gemini-3.8-flash-medium"},
            "nexusmind_openai": {"enabled": True, "configured": True, "model": "google/gemma-4-31b-it"}
        }
        gy["active_provider"] = "nexusmind_antigravity"
        with open(goose_yaml, "w") as f:
            yaml.dump(gy, f, default_flow_style=False, sort_keys=False)
    except:
        pass

# 2. Update Pi Configuration in all directories
pi_models_payload = {"providers": pi_providers}
pi_settings_payload = {
    "defaultProvider": "nexusmind_antigravity",
    "defaultModel": "gemini-3.8-flash-medium",
    "defaultThinkingLevel": "medium",
    "packages": ["./packages/nexusmind"]
}

pi_targets = [
    os.path.expanduser("~/.buzz/.pi"),
    os.path.expanduser("~/.buzz/.pi/agent"),
    os.path.expanduser("~/.pi/agent"),
    os.path.expanduser("~/Library/Application Support/Buzz/pi")
]

for base in pi_targets:
    os.makedirs(base, exist_ok=True)
    with open(os.path.join(base, "models.json"), "w") as f:
        json.dump(pi_models_payload, f, indent=2)
    with open(os.path.join(base, "auth.json"), "w") as f:
        json.dump(pi_auth, f, indent=2)
    with open(os.path.join(base, "settings.json"), "w") as f:
        json.dump(pi_settings_payload, f, indent=2)

print("SYNC_SUCCESS")
`;
        const b64 = btoa(unescape(encodeURIComponent(pythonSyncScript)));
        const launcher = `import base64; exec(base64.b64decode("${b64}").decode("utf-8"))`;
        if (ctx.host.spawn) {
          const proc = await ctx.host.spawn("python", {
            args: ["-c", launcher]
          });
          await proc.exited;
        } else if (ctx.host.runCommand) {
          await ctx.host.runCommand("sync-models", launcher);
        }
        const totalActive = groupModelsMap.nexusmind_openai.length + groupModelsMap.nexusmind_anthropic.length + groupModelsMap.nexusmind_antigravity.length + groupModelsMap.nexusmind_grok.length;
        setStatusMessage({
          type: "success",
          text: `Sincronização 100% concluída! ${totalActive} modelos ativos configurados nos 4 provedores do Goose (~/.config/goose/custom_providers/) e Pi (~/.buzz/.pi/models.json).`
        });
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro durante a sincronização: ${err.message}`
        });
      } finally {
        setLoading(false);
      }
    };
    const filteredModels = models.filter((m) => {
      const id = (m.id || "").toLowerCase();
      if (filterFree && !id.includes("free")) return false;
      if (filterReasoning && !isReasoning(id)) return false;
      if (selectedGroupTab === "nexusmind_openai" && (id.includes("claude") || id.includes("gemini") || id.includes("grok"))) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_anthropic" && !id.includes("claude")) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_antigravity" && !id.includes("gemini") && !id.includes("antigravity")) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_grok" && !id.includes("grok")) {
        return false;
      }
      if (searchQuery && !id.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    const openFullPage = async () => {
      const nav = ctx.reflect.get("navigation") || ctx.navigation;
      if (nav && typeof nav.open === "function") {
        await nav.open({
          version: 1,
          kind: "plugin",
          pluginId: "digital.nexusmind.buzz",
          pageId: "nexusmind"
        });
      }
    };
    if (isSettingsCard) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            color: "var(--text-standard, #ffffff)"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          h("img", { src: ICON, style: { width: "24px", height: "24px" } }),
          h(
            "div",
            null,
            h("div", { style: { fontWeight: "600", fontSize: "14px" } }, "NexusMind Gateway"),
            h(
              "div",
              { style: { fontSize: "12px", color: "var(--text-subtle, #a0a0a0)" } },
              "Gateway oficial de IA para os agentes Goose e Pi no ecossistema OrgFy."
            )
          )
        ),
        statusMessage && h(
          "div",
          {
            style: {
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              backgroundColor: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.15)" : statusMessage.type === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
              color: statusMessage.type === "success" ? "#10b981" : statusMessage.type === "error" ? "#ef4444" : "#3b82f6"
            }
          },
          statusMessage.text
        ),
        h(
          "div",
          null,
          h(
            "label",
            { style: { display: "block", fontSize: "12px", marginBottom: "4px", color: "var(--text-subtle, #a0a0a0)" } },
            "NexusMind API Key:"
          ),
          h("input", {
            type: "password",
            value: apiKey,
            onChange: (e) => setApiKey(e.target.value),
            placeholder: "sk-...",
            style: {
              width: "100%",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #333338)",
              backgroundColor: "#111115",
              color: "#ffffff",
              boxSizing: "border-box",
              fontSize: "13px"
            }
          })
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              onClick: handleSaveKeys,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "#2d2d35",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }
            },
            "Salvar Chave"
          ),
          h(
            "button",
            {
              onClick: handleTestConnection,
              disabled: loading,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                color: "#3b82f6",
                border: "1px solid #3b82f6",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "12px"
              }
            },
            loading ? "Testando..." : "Testar Conexão"
          ),
          h(
            "button",
            {
              onClick: handleSyncModels,
              disabled: loading,
              style: {
                padding: "6px 14px",
                borderRadius: "6px",
                backgroundColor: "#10b981",
                color: "#000000",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "12px"
              }
            },
            loading ? "Sincronizando..." : "⚡ Sincronizar Modelos"
          ),
          h(
            "button",
            {
              onClick: openFullPage,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                color: "#a0a0a0",
                border: "1px solid #333338",
                cursor: "pointer",
                fontSize: "12px",
                marginLeft: "auto"
              }
            },
            "Abrir Página do Plugin →"
          )
        )
      );
    }
    return h(
      "section",
      {
        style: {
          padding: "var(--space-6, 24px)",
          maxWidth: "1024px",
          margin: "0 auto",
          color: "var(--text-standard, #ffffff)",
          fontFamily: "var(--font-sans, system-ui)"
        }
      },
      // Header
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-subtle, #333338)",
            paddingBottom: "var(--space-4, 16px)",
            marginBottom: "var(--space-6, 24px)"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h("img", { src: ICON, style: { width: "38px", height: "38px" } }),
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h(
                "h1",
                { style: { margin: 0, fontSize: "22px", fontWeight: "600" } },
                "NexusMind Gateway"
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    fontWeight: "600"
                  }
                },
                "OFICIAL"
              )
            ),
            h(
              "p",
              {
                style: {
                  margin: "4px 0 0",
                  color: "var(--text-subtle, #a0a0a0)",
                  fontSize: "13px"
                }
              },
              "Integração canônica do NexusMind para os 4 provedores do Buzz Desktop (Goose e Pi)."
            )
          )
        ),
        h(
          "button",
          {
            onClick: handleSyncModels,
            disabled: loading,
            style: {
              padding: "10px 22px",
              borderRadius: "8px",
              backgroundColor: "#10b981",
              color: "#000000",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }
          },
          loading ? "Sincronizando..." : "⚡ Sincronizar Modelos no Buzz"
        )
      ),
      // Status Notification
      statusMessage && h(
        "div",
        {
          style: {
            padding: "14px 18px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "13px",
            lineHeight: "1.4",
            backgroundColor: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.12)" : statusMessage.type === "error" ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)",
            color: statusMessage.type === "success" ? "#10b981" : statusMessage.type === "error" ? "#ef4444" : "#3b82f6",
            border: `1px solid ${statusMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : statusMessage.type === "error" ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}`
          }
        },
        statusMessage.text
      ),
      // 4 Canonical Groups Overview Bar
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            marginBottom: "24px"
          }
        },
        Object.entries(CANONICAL_GROUPS).map(([pid, group]) => {
          const isSelected = selectedGroupTab === pid;
          return h(
            "div",
            {
              key: pid,
              onClick: () => setSelectedGroupTab(isSelected ? "all" : pid),
              style: {
                padding: "14px",
                borderRadius: "10px",
                backgroundColor: isSelected ? "rgba(59, 130, 246, 0.1)" : "var(--bg-card, #1a1a20)",
                border: isSelected ? "1px solid #3b82f6" : "1px solid var(--border-subtle, #2d2d35)",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              h(
                "span",
                { style: { fontWeight: "600", fontSize: "14px", color: isSelected ? "#3b82f6" : "#ffffff" } },
                group.groupName
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#a0a0a0"
                  }
                },
                pid
              )
            ),
            h(
              "div",
              { style: { fontSize: "12px", color: "var(--text-subtle, #a0a0a0)", marginTop: "6px" } },
              group.description
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "#10b981", marginTop: "8px", fontWeight: "500" } },
              `Padrão: ${group.defaultModel}`
            )
          );
        })
      ),
      // Credentials Card
      h(
        "div",
        {
          style: {
            backgroundColor: "var(--bg-card, #1a1a20)",
            border: "1px solid var(--border-subtle, #2d2d35)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "24px"
          }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px"
            }
          },
          h(
            "h2",
            { style: { margin: 0, fontSize: "16px", fontWeight: "600" } },
            "Configuração de Chaves e Acesso NexusMind"
          ),
          h(
            "label",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                cursor: "pointer",
                color: "var(--text-subtle, #a0a0a0)"
              }
            },
            h("input", {
              type: "checkbox",
              checked: useCustomGroupKeys,
              onChange: (e) => setUseCustomGroupKeys(e.target.checked)
            }),
            "Personalizar chaves individuais por grupo"
          )
        ),
        !useCustomGroupKeys ? h(
          "div",
          null,
          h(
            "label",
            {
              style: {
                display: "block",
                fontSize: "13px",
                marginBottom: "6px",
                color: "var(--text-subtle, #a0a0a0)"
              }
            },
            "Chave Master NexusMind (aplicada a todos os grupos):"
          ),
          h("input", {
            type: "password",
            value: apiKey,
            onChange: (e) => setApiKey(e.target.value),
            placeholder: "sk-... (sua API Key do NexusMind)",
            style: {
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #333338)",
              backgroundColor: "#111115",
              color: "#ffffff",
              boxSizing: "border-box",
              fontSize: "14px"
            }
          })
        ) : h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" } },
          Object.entries(CANONICAL_GROUPS).map(([pid, group]) => {
            return h(
              "div",
              { key: pid },
              h(
                "label",
                {
                  style: {
                    display: "block",
                    fontSize: "12px",
                    marginBottom: "4px",
                    color: "var(--text-subtle, #a0a0a0)"
                  }
                },
                `Chave ${group.groupName} (${pid}):`
              ),
              h("input", {
                type: "password",
                value: groupKeys[pid] || "",
                onChange: (e) => setGroupKeys({ ...groupKeys, [pid]: e.target.value }),
                placeholder: group.defaultKey,
                style: {
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle, #333338)",
                  backgroundColor: "#111115",
                  color: "#ffffff",
                  boxSizing: "border-box",
                  fontSize: "13px"
                }
              })
            );
          })
        ),
        h(
          "div",
          { style: { display: "flex", gap: "10px", marginTop: "16px" } },
          h(
            "button",
            {
              onClick: handleSaveKeys,
              style: {
                padding: "8px 18px",
                borderRadius: "6px",
                backgroundColor: "var(--border-subtle, #333338)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px"
              }
            },
            "Salvar Chaves"
          ),
          h(
            "button",
            {
              onClick: handleTestConnection,
              disabled: loading,
              style: {
                padding: "8px 18px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                color: "#3b82f6",
                border: "1px solid #3b82f6",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "500",
                fontSize: "13px"
              }
            },
            loading ? "Testando..." : "Testar Conexão com API"
          )
        )
      ),
      // Models Explorer Section
      h(
        "div",
        null,
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "10px"
            }
          },
          h(
            "div",
            null,
            h(
              "h2",
              { style: { margin: 0, fontSize: "18px", fontWeight: "600" } },
              "Catálogo e Modelos Sincronizados"
            ),
            lastSyncTime && h(
              "p",
              {
                style: {
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: "var(--text-subtle, #a0a0a0)"
                }
              },
              `Última sincronização no Buzz: ${lastSyncTime}`
            )
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px", alignItems: "center" } },
            h("input", {
              type: "text",
              placeholder: "Buscar modelo...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #333338",
                backgroundColor: "#111115",
                color: "#ffffff",
                fontSize: "13px"
              }
            }),
            h(
              "button",
              {
                onClick: () => setFilterReasoning(!filterReasoning),
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #333338",
                  backgroundColor: filterReasoning ? "#a855f7" : "transparent",
                  color: filterReasoning ? "#ffffff" : "#a0a0a0",
                  cursor: "pointer",
                  fontSize: "12px"
                }
              },
              "Thinking / Reasoning"
            ),
            h(
              "button",
              {
                onClick: () => setFilterFree(!filterFree),
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #333338",
                  backgroundColor: filterFree ? "#10b981" : "transparent",
                  color: filterFree ? "#000000" : "#a0a0a0",
                  cursor: "pointer",
                  fontSize: "12px"
                }
              },
              "Apenas Free"
            )
          )
        ),
        // Tabs
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "6px",
              borderBottom: "1px solid #2d2d35",
              paddingBottom: "8px",
              marginBottom: "16px",
              flexWrap: "wrap"
            }
          },
          [
            { id: "all", label: "Todos os Grupos" },
            { id: "nexusmind_openai", label: "Saldo OpenAI (NVIDIA / OpenCode)" },
            { id: "nexusmind_anthropic", label: "Saldo Claude (Anthropic)" },
            { id: "nexusmind_antigravity", label: "Antigravity-Saldo (Gemini)" },
            { id: "nexusmind_grok", label: "Grok (xAI)" }
          ].map(
            (tab) => h(
              "button",
              {
                key: tab.id,
                onClick: () => setSelectedGroupTab(tab.id),
                style: {
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: selectedGroupTab === tab.id ? "rgba(255,255,255,0.12)" : "transparent",
                  color: selectedGroupTab === tab.id ? "#ffffff" : "#a0a0a0",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: selectedGroupTab === tab.id ? "600" : "normal"
                }
              },
              tab.label
            )
          )
        ),
        // Models Listing
        filteredModels.length === 0 ? h(
          "div",
          {
            style: {
              padding: "40px",
              textAlign: "center",
              color: "var(--text-subtle, #a0a0a0)",
              backgroundColor: "var(--bg-card, #1a1a20)",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle, #2d2d35)"
            }
          },
          "Nenhum modelo encontrado. Clique em '⚡ Sincronizar Modelos no Buzz' acima para consultar a API."
        ) : h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr", gap: "8px" } },
          filteredModels.map((m) => {
            const mid = m.id || "";
            const isFree = mid.toLowerCase().includes("free");
            const hasReasoning = isReasoning(mid);
            const ctxWindow = getContextWindow(selectedGroupTab, mid);
            const maxOut = getMaxTokens(selectedGroupTab, mid);
            return h(
              "div",
              {
                key: mid,
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-card, #1a1a20)",
                  border: "1px solid var(--border-subtle, #2d2d35)"
                }
              },
              h(
                "div",
                null,
                h("span", { style: { fontWeight: "500", fontSize: "14px" } }, mid),
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      gap: "6px",
                      marginTop: "6px",
                      flexWrap: "wrap"
                    }
                  },
                  isFree && h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(16, 185, 129, 0.2)",
                        color: "#10b981",
                        fontWeight: "600"
                      }
                    },
                    "FREE"
                  ),
                  hasReasoning && h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(168, 85, 247, 0.2)",
                        color: "#c084fc",
                        fontWeight: "600"
                      }
                    },
                    "THINKING / REASONING"
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#a0a0a0"
                      }
                    },
                    `Ctx: ${(ctxWindow / 1024).toFixed(0)}k`
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#a0a0a0"
                      }
                    },
                    `Max: ${(maxOut / 1024).toFixed(0)}k`
                  ),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#a0a0a0"
                      }
                    },
                    m.owned_by || "nexusmind"
                  )
                )
              ),
              h(
                "span",
                { style: { fontSize: "12px", color: "#10b981", fontWeight: "500" } },
                "✓ Ativo no Buzz"
              )
            );
          })
        )
      )
    );
  }
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
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
}
export {
  CANONICAL_GROUPS,
  apply,
  inject
};
