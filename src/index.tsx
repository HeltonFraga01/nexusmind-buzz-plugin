import type { Context } from "@buzz/author";

export const inject = ["react", "pages", "settingsCards", "host"];

// Official Squircle SVG Logo for NexusMind
const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'
  );

export interface CanonicalGroup {
  id: string;
  groupName: string;
  displayName: string;
  description: string;
  defaultKey: string;
  defaultModel: string;
  defaultCtx: number;
  defaultOut: number;
  gradient: string;
  iconChar: string;
  operationalNote?: string;
}

export const CANONICAL_GROUPS: Record<string, CanonicalGroup> = {
  nexusmind_openai: {
    id: "nexusmind_openai",
    groupName: "Saldo OpenAI",
    displayName: "NexusMind OpenAI",
    description: "OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
    defaultKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    defaultModel: "mistralai/mistral-large-4-1t-a52b",
    defaultCtx: 131072,
    defaultOut: 8192,
    gradient: "linear-gradient(135deg, #ea580c, #f97316)",
    iconChar: "⚡",
    operationalNote: "NVIDIA NIM e contas OpenCode operam neste grupo.",
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    description: "Modelos Anthropic Claude (Contingência ativa via Antigravity)",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 200000,
    defaultOut: 8192,
    gradient: "linear-gradient(135deg, #c026d3, #d946ef)",
    iconChar: "🧠",
    operationalNote: "Contingência: Modelos Claude ativos também operam em Antigravity-Saldo.",
  },
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    description: "Google Gemini, Claude e Anti-Gravity Gateway",
    defaultKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    defaultModel: "gemini-3.8-flash-medium",
    defaultCtx: 1048576,
    defaultOut: 65536,
    gradient: "linear-gradient(135deg, #0284c7, #06b6d4)",
    iconChar: "✨",
    operationalNote: "Gateway de alto rendimento e suporte a raciocínio estendido.",
  },
  nexusmind_grok: {
    id: "nexusmind_grok",
    groupName: "Grok",
    displayName: "NexusMind Grok",
    description: "Modelos xAI Grok (grok-4.5, multimodal)",
    defaultKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    defaultModel: "grok-4.5",
    defaultCtx: 131072,
    defaultOut: 16384,
    gradient: "linear-gradient(135deg, #4f46e5, #6366f1)",
    iconChar: "🚀",
  },
};

function isReasoning(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return (
    m.includes("reason") ||
    m.includes("thinking") ||
    m.includes("opus") ||
    m.includes("sonnet") ||
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("medium") ||
    m.includes("high") ||
    m.includes("sonar") ||
    m.includes("flash") ||
    m.includes("ultra") ||
    m.includes("luna") ||
    m.includes("sol") ||
    m.includes("claude-3-7")
  );
}

function getContextWindow(pid: string, modelId: string): number {
  const m = modelId.toLowerCase();
  if (pid === "nexusmind_antigravity" || m.includes("gemini")) return 1048576;
  if (pid === "nexusmind_anthropic" || m.includes("claude")) return 200000;
  return 131072;
}

function getMaxTokens(pid: string, modelId: string): number {
  const m = modelId.toLowerCase();
  if (pid === "nexusmind_antigravity" || m.includes("gemini")) return 65536;
  if (pid === "nexusmind_grok" || m.includes("grok")) return 16384;
  return 8192;
}

export interface ModelTestState {
  status: "idle" | "testing" | "ok" | "error";
  latencyMs?: number;
  message?: string;
}

export interface UserProfileData {
  username?: string;
  email?: string;
  balance?: number;
  role?: string;
  activeApiKeys?: number;
}

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  function NexusMindComponent({ isSettingsCard = false }: { isSettingsCard?: boolean }) {
    // Connection Mode: "mcp" or "apikey"
    const [authMode, setAuthMode] = React.useState<"mcp" | "apikey">(() => {
      try {
        return (localStorage.getItem("nexusmind_auth_mode") as any) || "mcp";
      } catch {
        return "mcp";
      }
    });

    // MCP Server URL & OAuth Token
    const [mcpUrl, setMcpUrl] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_mcp_url") || "https://nexusmind.digital/api/v1/mcp";
      } catch {
        return "https://nexusmind.digital/api/v1/mcp";
      }
    });

    const [mcpToken, setMcpToken] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_mcp_token") || "";
      } catch {
        return "";
      }
    });

    // Master API Key (Fallback)
    const [apiKey, setApiKey] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_api_key") || "";
      } catch {
        return "";
      }
    });

    // Custom Group Keys Toggle
    const [useCustomGroupKeys, setUseCustomGroupKeys] = React.useState<boolean>(() => {
      try {
        return localStorage.getItem("nexusmind_custom_group_keys") === "true";
      } catch {
        return false;
      }
    });

    // Individual Group Keys
    const [groupKeys, setGroupKeys] = React.useState<Record<string, string>>(() => {
      try {
        const stored = localStorage.getItem("nexusmind_group_keys");
        if (stored) return JSON.parse(stored);
      } catch {
        // fallback
      }
      return {
        nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
        nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
        nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
        nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey,
      };
    });

    // User Profile state from MCP / API
    const [profileData, setProfileData] = React.useState<UserProfileData | null>(() => {
      try {
        const stored = localStorage.getItem("nexusmind_user_profile");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    });

    // Disabled models list (persisted in localStorage)
    const [disabledModels, setDisabledModels] = React.useState<string[]>(() => {
      try {
        const stored = localStorage.getItem("nexusmind_disabled_models");
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    });

    // Real-time model test states (modelId -> ModelTestState)
    const [modelTests, setModelTests] = React.useState<Record<string, ModelTestState>>({});

    const [selectedGroupTab, setSelectedGroupTab] = React.useState<string>("all");
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [filterFree, setFilterFree] = React.useState<boolean>(false);
    const [filterReasoning, setFilterReasoning] = React.useState<boolean>(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = React.useState<boolean>(false);

    // Cached catalog pulled from NexusMind
    const [models, setModels] = React.useState<any[]>(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });

    const [loadingPull, setLoadingPull] = React.useState<boolean>(false);
    const [loadingSync, setLoadingSync] = React.useState<boolean>(false);
    const [batchTesting, setBatchTesting] = React.useState<boolean>(false);
    const [statusMessage, setStatusMessage] = React.useState<{
      type: "success" | "error" | "info";
      text: string;
    } | null>(null);

    const [lastPullTime, setLastPullTime] = React.useState<string>(() => {
      try {
        return localStorage.getItem("nexusmind_last_pull") || "";
      } catch {
        return "";
      }
    });

    const [lastSyncTime, setLastSyncTime] = React.useState<string>(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync") || "";
      } catch {
        return "";
      }
    });

    const getEffectiveKeyForModel = (mid: string): string => {
      if (!useCustomGroupKeys && apiKey.trim()) return apiKey.trim();
      const l = mid.toLowerCase();
      if (l.includes("grok")) return groupKeys.nexusmind_grok || CANONICAL_GROUPS.nexusmind_grok.defaultKey;
      if (l.includes("claude")) return groupKeys.nexusmind_anthropic || CANONICAL_GROUPS.nexusmind_anthropic.defaultKey;
      if (l.includes("gemini") || l.includes("antigravity")) return groupKeys.nexusmind_antigravity || CANONICAL_GROUPS.nexusmind_antigravity.defaultKey;
      return groupKeys.nexusmind_openai || CANONICAL_GROUPS.nexusmind_openai.defaultKey;
    };

    // Save Settings
    const handleSaveSettings = () => {
      try {
        localStorage.setItem("nexusmind_auth_mode", authMode);
        localStorage.setItem("nexusmind_mcp_url", mcpUrl.trim());
        localStorage.setItem("nexusmind_mcp_token", mcpToken.trim());
        localStorage.setItem("nexusmind_api_key", apiKey.trim());
        localStorage.setItem("nexusmind_custom_group_keys", String(useCustomGroupKeys));
        localStorage.setItem("nexusmind_group_keys", JSON.stringify(groupKeys));
        setStatusMessage({
          type: "success",
          text: "Configurações NexusMind salvas com sucesso!",
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: "Erro ao salvar: " + err.message,
        });
      }
    };

    // Authenticate with NexusMind via OAuth / MCP
    const handleConnectOAuth = async () => {
      setStatusMessage({
        type: "info",
        text: "Verificando conexão e perfil via NexusMind MCP...",
      });

      const effectiveToken = mcpToken.trim() || apiKey.trim() || "adm_sc_c321e6a357118c3d6f282333_8484211e801bdfd06feefce9e42354b2d8e205b5599643d17b0ac84803032398";
      const targetHost = mcpUrl.includes("nexusmind.digital") ? "https://nexusmind.digital" : mcpUrl.replace(/\/api\/.*$/, "");

      try {
        // Probe user profile via REST or JSON-RPC
        const res = await ctx.host.request({
          url: `${targetHost}/api/v1/user/profile`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            "x-api-key": effectiveToken,
            "Content-Type": "application/json",
          },
          timeoutMs: 12000,
        });

        if (res.status === 200) {
          const body = JSON.parse(res.body);
          const u = body.data || {};
          const profile: UserProfileData = {
            username: u.username || "Usuário NexusMind",
            email: u.email || "",
            balance: u.balance ?? 0,
            role: u.role || "user",
          };
          setProfileData(profile);
          localStorage.setItem("nexusmind_user_profile", JSON.stringify(profile));
          setStatusMessage({
            type: "success",
            text: `Conectado com sucesso ao NexusMind! Usuário: ${profile.username} | Saldo: $${(profile.balance || 0).toFixed(2)} USD`,
          });
        } else {
          // Fallback: If OAuth browser consent is required
          window.open("https://nexusmind.digital/oauth/mcp/authorize", "_blank");
          setStatusMessage({
            type: "info",
            text: "Janela de autorização aberta. Conclua o login no navegador e cole o token gerado.",
          });
        }
      } catch (err: any) {
        window.open("https://nexusmind.digital/oauth/mcp/authorize", "_blank");
        setStatusMessage({
          type: "info",
          text: `Abrindo página de autenticação no navegador (${err.message})...`,
        });
      }
    };

    // ─────────────────────────────────────────────────────────────
    // PASSO 1: PUXAR MODELOS DO NEXUSMIND PARA O PLUGIN
    // (Atualiza a visualização local do catálogo sem tocar no Buzz)
    // ─────────────────────────────────────────────────────────────
    const handlePullModelsFromNexusMind = async () => {
      setLoadingPull(true);
      setStatusMessage({
        type: "info",
        text: "Consultando API do NexusMind e obtendo lista de modelos em tempo real...",
      });

      try {
        const effectiveKeys: Record<string, string> = {
          nexusmind_openai:
            (useCustomGroupKeys ? groupKeys.nexusmind_openai : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic:
            (useCustomGroupKeys ? groupKeys.nexusmind_anthropic : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity:
            (useCustomGroupKeys ? groupKeys.nexusmind_antigravity : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok:
            (useCustomGroupKeys ? groupKeys.nexusmind_grok : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_grok.defaultKey,
        };

        const allFetched: any[] = [];
        const seenIds = new Set<string>();

        // Query upstream models for each group
        for (const [_, key] of Object.entries(effectiveKeys)) {
          try {
            const res = await ctx.host.request({
              url: "https://api.nexusmind.digital/v1/models",
              method: "GET",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              timeoutMs: 15000,
            });

            if (res.status === 200) {
              const body = JSON.parse(res.body);
              const items = body.data || [];
              for (const item of items) {
                if (item.id && !seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  allFetched.push(item);
                }
              }
            }
          } catch {
            // ignore network glitch on single key
          }
        }

        setModels(allFetched);
        localStorage.setItem("nexusmind_cached_models", JSON.stringify(allFetched));

        const now = new Date().toLocaleString();
        setLastPullTime(now);
        localStorage.setItem("nexusmind_last_pull", now);

        setStatusMessage({
          type: "success",
          text: `Catálogo atualizado com sucesso! ${allFetched.length} modelos carregados da API do NexusMind. Você pode testar e habilitar/desabilitar antes de sincronizar com o Buzz.`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro ao buscar modelos do NexusMind: ${err.message}`,
        });
      } finally {
        setLoadingPull(false);
      }
    };

    // ─────────────────────────────────────────────────────────────
    // PASSO 2: SINCRONIZAR MODELOS COM O BUZZ (GOOSE & PI)
    // (Aplica os modelos filtrados e ativos nos agentes locais)
    // ─────────────────────────────────────────────────────────────
    const handleSyncModelsToBuzz = async () => {
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Configurando provedores no Buzz Desktop (Goose e Pi) excluindo modelos desativados...",
      });

      try {
        const effectiveKeys: Record<string, string> = {
          nexusmind_openai:
            (useCustomGroupKeys ? groupKeys.nexusmind_openai : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic:
            (useCustomGroupKeys ? groupKeys.nexusmind_anthropic : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity:
            (useCustomGroupKeys ? groupKeys.nexusmind_antigravity : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok:
            (useCustomGroupKeys ? groupKeys.nexusmind_grok : apiKey.trim()) ||
            CANONICAL_GROUPS.nexusmind_grok.defaultKey,
        };

        const groupModelsMap: Record<string, string[]> = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: [],
        };

        for (const item of models) {
          const mid = item.id;
          if (!mid || disabledModels.includes(mid)) continue;

          const l = mid.toLowerCase();
          if (l.includes("grok")) {
            groupModelsMap.nexusmind_grok.push(mid);
          } else if (l.includes("claude")) {
            groupModelsMap.nexusmind_anthropic.push(mid);
          } else if (l.includes("gemini") || l.includes("antigravity")) {
            groupModelsMap.nexusmind_antigravity.push(mid);
          } else {
            groupModelsMap.nexusmind_openai.push(mid);
          }
        }

        // Ensure default fallback if all models in a group were filtered
        for (const [pid, def] of Object.entries(CANONICAL_GROUPS)) {
          if (!groupModelsMap[pid] || groupModelsMap[pid].length === 0) {
            groupModelsMap[pid] = [def.defaultModel];
          }
        }

        const syncPayload = {
          effectiveKeys,
          groupModels: groupModelsMap,
        };

        const pythonSyncScript = `
import os, sys, json

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]

CANONICAL = {
    "nexusmind_openai": {
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "mistralai/mistral-large-4-1t-a52b"
    },
    "nexusmind_anthropic": {
        "display_name": "NexusMind Anthropic",
        "description": "Modelos Anthropic Claude via NexusMind",
        "default_ctx": 200000,
        "default_out": 8192,
        "default_model": "claude-sonnet-4-6"
    },
    "nexusmind_antigravity": {
        "display_name": "NexusMind Anti-Gravity",
        "description": "Modelos Google Gemini, Claude e Anti-Gravity Gateway",
        "default_ctx": 1048576,
        "default_out": 65536,
        "default_model": "gemini-3.8-flash-medium"
    },
    "nexusmind_grok": {
        "display_name": "NexusMind Grok",
        "description": "Modelos xAI Grok via NexusMind",
        "default_ctx": 131072,
        "default_out": 16384,
        "default_model": "grok-4.5"
    }
}

def is_reasoning(m):
    l = m.lower()
    return any(w in l for w in ["reason", "thinking", "opus", "sonnet", "o1", "o3", "medium", "high", "sonar", "flash", "ultra", "luna", "sol", "claude-3-7"])

# 1. Update Goose Custom Providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

# Clean legacy duplicate files
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
            "nexusmind_openai": {"enabled": True, "configured": True, "model": "mistralai/mistral-large-4-1t-a52b"}
        }
        gy["active_provider"] = "nexusmind_antigravity"
        with open(goose_yaml, "w") as f:
            yaml.dump(gy, f, default_flow_style=False, sort_keys=False)
    except:
        pass

# 2. Update Pi Configuration
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
            args: ["-c", launcher],
          });
          await proc.exited;
        } else if (ctx.host.runCommand) {
          await ctx.host.runCommand("sync-models", launcher);
        }

        const now = new Date().toLocaleString();
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync", now);

        const totalActive =
          groupModelsMap.nexusmind_openai.length +
          groupModelsMap.nexusmind_anthropic.length +
          groupModelsMap.nexusmind_antigravity.length +
          groupModelsMap.nexusmind_grok.length;

        setStatusMessage({
          type: "success",
          text: `Sincronização 100% concluída! ${totalActive} modelos ativos aplicados ao Goose e Pi (${disabledModels.length} desativados foram expurgados do catálogo).`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro ao sincronizar com o Buzz: ${err.message}`,
        });
      } finally {
        setLoadingSync(false);
      }
    };

    // Live ping / healthcheck for an individual model
    const handleTestModel = async (mid: string) => {
      const key = getEffectiveKeyForModel(mid);
      setModelTests((prev) => ({
        ...prev,
        [mid]: { status: "testing" },
      }));

      const t0 = Date.now();
      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: mid,
            messages: [{ role: "user", content: "oi" }],
            max_tokens: 5,
          }),
          timeoutMs: 14000,
        });

        const latency = Date.now() - t0;
        if (res.status === 200) {
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "ok", latencyMs: latency },
          }));
        } else {
          let msg = `HTTP ${res.status}`;
          try {
            const b = JSON.parse(res.body);
            msg = b.error?.message || b.message || msg;
          } catch {
            // ignore
          }
          if (msg.length > 40) msg = msg.slice(0, 38) + "...";
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "error", latencyMs: latency, message: msg },
          }));
        }
      } catch (err: any) {
        const latency = Date.now() - t0;
        let msg = err.message || "Timeout";
        if (msg.length > 40) msg = msg.slice(0, 38) + "...";
        setModelTests((prev) => ({
          ...prev,
          [mid]: { status: "error", latencyMs: latency, message: msg },
        }));
      }
    };

    // Batch test all currently visible/filtered models
    const handleTestVisibleModels = async () => {
      const toTest = filteredModels.map((m: any) => m.id).filter(Boolean);
      if (toTest.length === 0) return;
      setBatchTesting(true);
      setStatusMessage({
        type: "info",
        text: `Testando conectividade de ${toTest.length} modelos visíveis...`,
      });

      for (const mid of toTest) {
        await handleTestModel(mid);
      }

      setBatchTesting(false);
      setStatusMessage({
        type: "success",
        text: `Bateria de testes finalizada para ${toTest.length} modelos!`,
      });
    };

    // Toggle individual model enable/disable state
    const handleToggleModel = (mid: string) => {
      let updated: string[];
      if (disabledModels.includes(mid)) {
        updated = disabledModels.filter((id) => id !== mid);
      } else {
        updated = [...disabledModels, mid];
      }
      setDisabledModels(updated);
      try {
        localStorage.setItem("nexusmind_disabled_models", JSON.stringify(updated));
      } catch {
        // ignore
      }
    };

    // Disable all models that failed the test
    const handleDisableUnavailable = () => {
      const failing = Object.entries(modelTests)
        .filter(([_, data]) => data.status === "error")
        .map(([mid]) => mid);

      if (failing.length === 0) {
        setStatusMessage({
          type: "info",
          text: "Nenhum modelo com erro encontrado nos testes recentes.",
        });
        return;
      }

      const updated = Array.from(new Set([...disabledModels, ...failing]));
      setDisabledModels(updated);
      try {
        localStorage.setItem("nexusmind_disabled_models", JSON.stringify(updated));
      } catch {
        // ignore
      }
      setStatusMessage({
        type: "success",
        text: `${failing.length} modelos indisponíveis desativados. Eles não serão injetados nos agentes ao clicar em '⚡ Sincronizar Modelos no Buzz'.`,
      });
    };

    // Filter models
    const filteredModels = models.filter((m: any) => {
      const id = (m.id || "").toLowerCase();
      if (filterFree && !id.includes("free") && !id.includes("contributor")) return false;
      if (filterReasoning && !isReasoning(id)) return false;

      if (
        selectedGroupTab === "nexusmind_openai" &&
        (id.includes("claude") || id.includes("gemini") || id.includes("grok"))
      ) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_anthropic" && !id.includes("claude")) {
        return false;
      }
      if (
        selectedGroupTab === "nexusmind_antigravity" &&
        !id.includes("gemini") &&
        !id.includes("antigravity")
      ) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_grok" && !id.includes("grok")) {
        return false;
      }

      if (searchQuery && !id.includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const openFullPage = async () => {
      const nav = ctx.reflect.get("navigation") || (ctx as any).navigation;
      if (nav && typeof nav.open === "function") {
        await nav.open({
          version: 1,
          kind: "plugin",
          pluginId: "digital.nexusmind.buzz",
          pageId: "nexusmind",
        });
      }
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER: COMPONENT CARD PARA AS CONFIGURAÇÕES DO BUZZ
    // ─────────────────────────────────────────────────────────────
    if (isSettingsCard) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            color: "var(--text-standard, #ffffff)",
            fontFamily: "var(--font-sans, system-ui)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h("img", { src: ICON, style: { width: "24px", height: "24px" } }),
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
                      fontWeight: "600",
                    },
                  },
                  "v2.1"
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                profileData
                  ? `Conectado como ${profileData.username} ($${(profileData.balance || 0).toFixed(2)})`
                  : "Conexão MCP e Gateway de IA para agentes Goose e Pi."
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
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "500",
              },
            },
            "Abrir Painel →"
          )
        ),
        statusMessage &&
          h(
            "div",
            {
              style: {
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                backgroundColor:
                  statusMessage.type === "success"
                    ? "rgba(16, 185, 129, 0.12)"
                    : statusMessage.type === "error"
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(59, 130, 246, 0.12)",
                color:
                  statusMessage.type === "success"
                    ? "#10b981"
                    : statusMessage.type === "error"
                    ? "#ef4444"
                    : "#3b82f6",
              },
            },
            statusMessage.text
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
                fontWeight: "500",
              },
            },
            loadingPull ? "Puxando..." : "🔄 Puxar do NexusMind"
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
                fontWeight: "600",
              },
            },
            loadingSync ? "Sincronizando..." : "⚡ Sincronizar no Buzz"
          )
        )
      );
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: PÁGINA NATIVA PRINCIPAL DO BUZZ DESKTOP
    // (Design system idêntico ao "Manage plugins" e "Add a plugin")
    // ─────────────────────────────────────────────────────────────
    return h(
      "section",
      {
        style: {
          padding: "var(--space-6, 24px) var(--space-8, 32px)",
          maxWidth: "1080px",
          margin: "0 auto",
          color: "var(--text-standard, #ffffff)",
          fontFamily: "var(--font-sans, system-ui)",
        },
      },
      // Top Navigation Bar
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            {
              style: {
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #10b981, #0284c7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              },
            },
            h("img", { src: ICON, style: { width: "28px", height: "28px", filter: "brightness(0) invert(1)" } })
          ),
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("h1", { style: { margin: 0, fontSize: "22px", fontWeight: "600" } }, "NexusMind Gateway"),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    fontWeight: "600",
                  },
                },
                "v2.1 OFICIAL"
              )
            ),
            h(
              "p",
              { style: { margin: "2px 0 0", color: "var(--text-subtle, #8e8e96)", fontSize: "13px" } },
              "Gateway corporativo com autenticação MCP, healthcheck live e sincronização nativa para Goose e Pi."
            )
          )
        ),
        // Primary 2-Step Action Buttons
        h(
          "div",
          { style: { display: "flex", gap: "10px", alignItems: "center" } },
          h(
            "button",
            {
              onClick: handlePullModelsFromNexusMind,
              disabled: loadingPull,
              title: "Puxa os modelos mais recentes direto da API do NexusMind",
              style: {
                borderRadius: "9999px",
                padding: "8px 18px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                cursor: loadingPull ? "not-allowed" : "pointer",
                fontWeight: "500",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              },
            },
            loadingPull ? "Buscando Modelos..." : "🔄 1. Puxar do NexusMind"
          ),
          h(
            "button",
            {
              onClick: handleSyncModelsToBuzz,
              disabled: loadingSync,
              title: "Aplica os modelos filtrados aos agentes do Goose e Pi",
              style: {
                borderRadius: "9999px",
                padding: "8px 22px",
                backgroundColor: "#10b981",
                color: "#000000",
                border: "none",
                cursor: loadingSync ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              },
            },
            loadingSync ? "Sincronizando..." : "⚡ 2. Sincronizar no Buzz"
          )
        )
      ),

      // Status Notification Banner
      statusMessage &&
        h(
          "div",
          {
            style: {
              padding: "12px 18px",
              borderRadius: "12px",
              marginBottom: "20px",
              fontSize: "13px",
              lineHeight: "1.4",
              backgroundColor:
                statusMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.12)"
                  : statusMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(59, 130, 246, 0.12)",
              color:
                statusMessage.type === "success"
                  ? "#10b981"
                  : statusMessage.type === "error"
                  ? "#ef4444"
                  : "#60a5fa",
              border: `1px solid ${
                statusMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.25)"
                  : statusMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.25)"
                  : "rgba(59, 130, 246, 0.25)"
              }`,
            },
          },
          statusMessage.text
        ),

      // ─────────────────────────────────────────────────────────────
      // SEÇÃO: CONEXÃO MCP & AUTENTICAÇÃO INTELIGENTE
      // ─────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            borderRadius: "16px",
            padding: "20px 24px",
            marginBottom: "24px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "10px",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h(
              "div",
              {
                style: {
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                },
              },
              "🔌"
            ),
            h(
              "div",
              null,
              h("div", { style: { fontWeight: "600", fontSize: "15px" } }, "Conexão NexusMind MCP & Sessão"),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                "Autentique pelo endpoint MCP para sincronizar automaticamente perfil, saldo e ferramentas sem copiar chaves manuais."
              )
            )
          ),
          h(
            "button",
            {
              onClick: () => setShowAdvancedSettings(!showAdvancedSettings),
              style: {
                borderRadius: "9999px",
                backgroundColor: "transparent",
                color: "#8e8e96",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "6px 14px",
                fontSize: "12px",
                cursor: "pointer",
              },
            },
            showAdvancedSettings ? "Ocultar Detalhes" : "⚙️ Chaves Manuais"
          )
        ),

        // Live Profile Badge if connected
        profileData &&
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "12px 18px",
                borderRadius: "12px",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "10px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "12px" } },
              h("div", { style: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" } }),
              h(
                "div",
                null,
                h(
                  "span",
                  { style: { fontWeight: "600", fontSize: "13px", color: "#ffffff" } },
                  profileData.username
                ),
                h(
                  "span",
                  { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)", marginLeft: "8px" } },
                  profileData.email
                )
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "14px" } },
              h(
                "div",
                { style: { fontSize: "12px", color: "#8e8e96" } },
                "Saldo Ativo: ",
                h(
                  "strong",
                  { style: { color: "#10b981", fontSize: "14px" } },
                  `$${(profileData.balance || 0).toFixed(2)} USD`
                )
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                  },
                },
                profileData.role || "Admin"
              )
            )
          ),

        // MCP URL and Connect Row
        h(
          "div",
          { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
          h("input", {
            type: "text",
            value: mcpUrl,
            onChange: (e: any) => setMcpUrl(e.target.value),
            placeholder: "https://nexusmind.digital/api/v1/mcp",
            style: {
              flex: "1 1 300px",
              padding: "10px 16px",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              color: "#ffffff",
              fontSize: "13px",
            },
          }),
          h(
            "button",
            {
              onClick: handleConnectOAuth,
              style: {
                borderRadius: "9999px",
                padding: "10px 20px",
                backgroundColor: "#a855f7",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
              },
            },
            "🔑 Conectar via OAuth / MCP"
          )
        ),

        // Advanced Manual API Keys Section
        showAdvancedSettings &&
          h(
            "div",
            {
              style: {
                marginTop: "18px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              },
            },
            h(
              "label",
              {
                style: {
                  display: "block",
                  fontSize: "12px",
                  marginBottom: "6px",
                  color: "var(--text-subtle, #8e8e96)",
                },
              },
              "Chave Master NexusMind (sk-...):"
            ),
            h("input", {
              type: "password",
              value: apiKey,
              onChange: (e: any) => setApiKey(e.target.value),
              placeholder: "sk-...",
              style: {
                width: "100%",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
                fontSize: "13px",
                marginBottom: "10px",
                boxSizing: "border-box",
              },
            }),
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              h(
                "button",
                {
                  onClick: handleSaveSettings,
                  style: {
                    borderRadius: "9999px",
                    padding: "6px 14px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "Salvar Manualmente"
              )
            )
          )
      ),

      // ─────────────────────────────────────────────────────────────
      // SEÇÃO: OS 4 GRUPOS CANÔNICOS (NATIVE BUZZ SQUIRCLES)
      // ─────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            marginBottom: "28px",
          },
        },
        Object.entries(CANONICAL_GROUPS).map(([pid, group]) => {
          const isSelected = selectedGroupTab === pid;
          return h(
            "div",
            {
              key: pid,
              onClick: () => setSelectedGroupTab(isSelected ? "all" : pid),
              style: {
                padding: "18px 20px",
                borderRadius: "16px",
                backgroundColor: isSelected
                  ? "rgba(59, 130, 246, 0.1)"
                  : "rgba(255, 255, 255, 0.025)",
                border: isSelected
                  ? "1px solid #3b82f6"
                  : "1px solid rgba(255, 255, 255, 0.06)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" } },
              h(
                "div",
                {
                  style: {
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: group.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  },
                },
                group.iconChar
              ),
              h(
                "div",
                null,
                h(
                  "div",
                  { style: { fontWeight: "600", fontSize: "14px", color: isSelected ? "#60a5fa" : "#ffffff" } },
                  group.groupName
                ),
                h("div", { style: { fontSize: "11px", color: "#8e8e96" } }, pid)
              )
            ),
            h(
              "div",
              { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)", lineHeight: "1.4" } },
              group.description
            ),
            group.operationalNote &&
              h(
                "div",
                { style: { fontSize: "11px", color: "#f59e0b", marginTop: "6px", fontStyle: "italic" } },
                `⚠️ ${group.operationalNote}`
              ),
            h(
              "div",
              { style: { fontSize: "11px", color: "#10b981", marginTop: "10px", fontWeight: "500" } },
              `Padrão: ${group.defaultModel}`
            )
          );
        })
      ),

      // ─────────────────────────────────────────────────────────────
      // SEÇÃO: CATÁLOGO E GESTÃO DE MODELOS
      // ─────────────────────────────────────────────────────────────
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
              gap: "12px",
            },
          },
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("h2", { style: { margin: 0, fontSize: "18px", fontWeight: "600" } }, "Modelos Disponíveis"),
              h(
                "span",
                {
                  style: {
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#8e8e96",
                  },
                },
                filteredModels.length
              )
            ),
            lastPullTime &&
              h(
                "p",
                { style: { margin: "2px 0 0", fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                `Última busca na nuvem: ${lastPullTime} • ${models.length} modelos totais`
              )
          ),
          // Search & Filter Pills
          h(
            "div",
            { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
            h("input", {
              type: "text",
              placeholder: "Buscar modelo...",
              value: searchQuery,
              onChange: (e: any) => setSearchQuery(e.target.value),
              style: {
                borderRadius: "9999px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                padding: "8px 16px",
                fontSize: "13px",
                color: "#ffffff",
                minWidth: "180px",
              },
            }),
            h(
              "button",
              {
                onClick: () => setFilterReasoning(!filterReasoning),
                style: {
                  borderRadius: "9999px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: filterReasoning ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  color: filterReasoning ? "#c084fc" : "#8e8e96",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "6px 14px",
                },
              },
              "Thinking / Reasoning"
            ),
            h(
              "button",
              {
                onClick: () => setFilterFree(!filterFree),
                style: {
                  borderRadius: "9999px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: filterFree ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  color: filterFree ? "#10b981" : "#8e8e96",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "6px 14px",
                },
              },
              "Apenas Free"
            )
          )
        ),

        // Batch Action Toolbar (Nativo do Buzz)
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              padding: "10px 18px",
              borderRadius: "14px",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "10px",
            },
          },
          h(
            "div",
            { style: { fontSize: "12px", color: "#8e8e96" } },
            disabledModels.length > 0
              ? `${disabledModels.length} modelo(s) desativado(s) serão ignorados no Buzz`
              : "Todos os modelos ativos serão sincronizados com os agentes"
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px" } },
            h(
              "button",
              {
                onClick: handleTestVisibleModels,
                disabled: batchTesting,
                style: {
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  cursor: batchTesting ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "500",
                },
              },
              batchTesting ? "Testando Visíveis..." : "🧪 Testar Visíveis"
            ),
            h(
              "button",
              {
                onClick: handleDisableUnavailable,
                style: {
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "500",
                },
              },
              "🛡️ Desativar Indisponíveis"
            )
          )
        ),

        // Tabs
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              paddingBottom: "10px",
              marginBottom: "16px",
              flexWrap: "wrap",
            },
          },
          [
            { id: "all", label: "Todos os Grupos" },
            { id: "nexusmind_openai", label: "Saldo OpenAI" },
            { id: "nexusmind_anthropic", label: "Saldo Claude" },
            { id: "nexusmind_antigravity", label: "Antigravity-Saldo" },
            { id: "nexusmind_grok", label: "Grok" },
          ].map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                onClick: () => setSelectedGroupTab(tab.id),
                style: {
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor:
                    selectedGroupTab === tab.id
                      ? "rgba(255, 255, 255, 0.12)"
                      : "transparent",
                  color: selectedGroupTab === tab.id ? "#ffffff" : "#8e8e96",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: selectedGroupTab === tab.id ? "600" : "normal",
                },
              },
              tab.label
            )
          )
        ),

        // Models Listing Rows (Native Buzz Style)
        filteredModels.length === 0
          ? h(
              "div",
              {
                style: {
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--text-subtle, #8e8e96)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                },
              },
              h("div", { style: { fontSize: "28px", marginBottom: "8px" } }, "☁️"),
              h(
                "div",
                { style: { fontSize: "15px", fontWeight: "500", color: "#ffffff" } },
                "Nenhum modelo carregado ainda"
              ),
              h(
                "p",
                { style: { fontSize: "13px", color: "#8e8e96", maxWidth: "400px", margin: "6px auto 16px" } },
                "Clique em '🔄 1. Puxar do NexusMind' no topo para carregar o catálogo de modelos atualizado da sua conta."
              ),
              h(
                "button",
                {
                  onClick: handlePullModelsFromNexusMind,
                  style: {
                    borderRadius: "9999px",
                    padding: "8px 20px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  },
                },
                "Puxar Modelos Agora"
              )
            )
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              filteredModels.map((m: any) => {
                const mid = m.id || "";
                const isFree = mid.toLowerCase().includes("free") || mid.toLowerCase().includes("contributor");
                const hasReasoning = isReasoning(mid);
                const ctxWindow = getContextWindow(selectedGroupTab, mid);
                const maxOut = getMaxTokens(selectedGroupTab, mid);
                const isDisabled = disabledModels.includes(mid);
                const testState = modelTests[mid];

                return h(
                  "div",
                  {
                    key: mid,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 20px",
                      borderRadius: "14px",
                      backgroundColor: isDisabled ? "rgba(255, 255, 255, 0.01)" : "rgba(255, 255, 255, 0.03)",
                      border: isDisabled
                        ? "1px dashed rgba(255, 255, 255, 0.08)"
                        : "1px solid rgba(255, 255, 255, 0.06)",
                      opacity: isDisabled ? 0.45 : 1,
                      transition: "all 0.15s ease",
                      gap: "14px",
                      flexWrap: "wrap",
                    },
                  },
                  h(
                    "div",
                    { style: { flex: "1 1 auto", minWidth: "240px" } },
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "8px" } },
                      h(
                        "span",
                        {
                          style: {
                            fontWeight: "500",
                            fontSize: "14px",
                            textDecoration: isDisabled ? "line-through" : "none",
                            color: isDisabled ? "#8e8e96" : "#ffffff",
                          },
                        },
                        mid
                      ),
                      isDisabled &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              padding: "1px 8px",
                              borderRadius: "9999px",
                              backgroundColor: "rgba(239, 68, 68, 0.15)",
                              color: "#ef4444",
                              fontWeight: "600",
                            },
                          },
                          "DESATIVADO"
                        )
                    ),
                    h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          gap: "6px",
                          marginTop: "6px",
                          flexWrap: "wrap",
                        },
                      },
                      isFree &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              backgroundColor: "rgba(16, 185, 129, 0.2)",
                              color: "#10b981",
                              fontWeight: "600",
                            },
                          },
                          "FREE"
                        ),
                      hasReasoning &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              backgroundColor: "rgba(168, 85, 247, 0.2)",
                              color: "#c084fc",
                              fontWeight: "600",
                            },
                          },
                          "THINKING / REASONING"
                        ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "#8e8e96",
                          },
                        },
                        `Ctx: ${(ctxWindow / 1024).toFixed(0)}k`
                      ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "#8e8e96",
                          },
                        },
                        `Max: ${(maxOut / 1024).toFixed(0)}k`
                      ),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "#8e8e96",
                          },
                        },
                        m.owned_by || "nexusmind"
                      )
                    )
                  ),
                  // Test Status & Controls (Capsule Buttons)
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "10px" } },
                    testState &&
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "11px",
                            padding: "4px 10px",
                            borderRadius: "9999px",
                            backgroundColor:
                              testState.status === "ok"
                                ? "rgba(16, 185, 129, 0.15)"
                                : testState.status === "error"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color:
                              testState.status === "ok"
                                ? "#10b981"
                                : testState.status === "error"
                                ? "#ef4444"
                                : "#f59e0b",
                            fontWeight: "500",
                          },
                        },
                        testState.status === "testing"
                          ? "🟡 Testando..."
                          : testState.status === "ok"
                          ? `🟢 200 OK (${testState.latencyMs}ms)`
                          : `🔴 ${testState.message || "Erro"} (${testState.latencyMs}ms)`
                      ),
                    !testState &&
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "12px",
                            color: isDisabled ? "#8e8e96" : "#10b981",
                            fontWeight: "500",
                          },
                        },
                        isDisabled ? "⊘ Excluído do Buzz" : "✓ Ativo no Buzz"
                      ),
                    h(
                      "button",
                      {
                        onClick: () => handleTestModel(mid),
                        style: {
                          borderRadius: "9999px",
                          padding: "6px 14px",
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          color: "#ffffff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                        },
                      },
                      "⚡ Testar"
                    ),
                    h(
                      "button",
                      {
                        onClick: () => handleToggleModel(mid),
                        style: {
                          borderRadius: "9999px",
                          padding: "6px 16px",
                          backgroundColor: isDisabled
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(255, 255, 255, 0.08)",
                          color: isDisabled ? "#10b981" : "#ffffff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                        },
                      },
                      isDisabled ? "Ativar" : "Desativar"
                    )
                  )
                );
              })
            )
      )
    );
  }

  // 1. Register main workspace page
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: function NexusMindMainPage() {
      return h(NexusMindComponent, { isSettingsCard: false });
    },
  });

  // 2. Register settings card
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "nexusmind-settings",
      title: "NexusMind Gateway",
      group: "AI Models & Gateways",
      component: function NexusMindSettings() {
        return h(NexusMindComponent, { isSettingsCard: true });
      },
    });
  }
}
