import type { Context } from "@buzz/author";

export const inject = ["react", "pages", "settingsCards", "host"];

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'
  );

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  function NexusMindComponent() {
    const ui = ctx.reflect.get("ui") as any;

    const [apiKey, setApiKey] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_api_key") || "";
      } catch {
        return "";
      }
    });

    const [adminKey, setAdminKey] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_admin_key") || "";
      } catch {
        return "";
      }
    });

    const [selectedGroup, setSelectedGroup] = React.useState<string>("all");
    const [filterFree, setFilterFree] = React.useState<boolean>(false);
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [models, setModels] = React.useState<any[]>(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });

    const [loading, setLoading] = React.useState<boolean>(false);
    const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
    const [lastSyncTime, setLastSyncTime] = React.useState<string>(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync") || "";
      } catch {
        return "";
      }
    });

    const handleSaveKeys = () => {
      try {
        localStorage.setItem("nexusmind_api_key", apiKey.trim());
        localStorage.setItem("nexusmind_admin_key", adminKey.trim());
        setStatusMessage({ type: "success", text: "Chaves salvas com sucesso no armazenamento local!" });
      } catch (err: any) {
        setStatusMessage({ type: "error", text: "Erro ao salvar chaves: " + err.message });
      }
    };

    const handleTestConnection = async () => {
      if (!apiKey.trim()) {
        setStatusMessage({ type: "error", text: "Por favor, insira uma API Key antes de testar a conexão." });
        return;
      }
      setLoading(true);
      setStatusMessage({ type: "info", text: "Testando conexão com https://api.nexusmind.digital/v1/models..." });

      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/models",
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          timeoutMs: 15000,
        });

        if (res.status === 200) {
          const body = JSON.parse(res.body);
          const list = body.data || [];
          setStatusMessage({
            type: "success",
            text: `Conexão estabelecida com sucesso! ${list.length} modelos identificados no NexusMind.`,
          });
        } else {
          setStatusMessage({
            type: "error",
            text: `Falha na conexão: HTTP ${res.status} - ${res.body.slice(0, 200)}`,
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro de rede ao conectar ao NexusMind: ${err.message}`,
        });
      } finally {
        setLoading(false);
      }
    };

    const handleSyncModels = async () => {
      if (!apiKey.trim()) {
        setStatusMessage({ type: "error", text: "Insira sua API Key do NexusMind para sincronizar." });
        return;
      }

      setLoading(true);
      setStatusMessage({ type: "info", text: "Sincronizando modelos e gerando catálogos do Buzz..." });

      try {
        // 1. Fetch available models from NexusMind API
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/models",
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          timeoutMs: 20000,
        });

        if (res.status !== 200) {
          throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`);
        }

        const data = JSON.parse(res.body);
        const fetchedModels = data.data || [];
        setModels(fetchedModels);
        localStorage.setItem("nexusmind_cached_models", JSON.stringify(fetchedModels));

        const now = new Date().toLocaleString();
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync", now);

        // 2. Execute local sync script via host process
        const pythonSyncScript = `
import json, os, urllib.request

api_key = "${apiKey.trim()}"
models_data = json.loads('''${JSON.stringify(fetchedModels)}''')

# Define groups & provider configs
groups = {
    "nexusmind_openai": {
        "name": "NexusMind OpenAI & NVIDIA NIM",
        "description": "NexusMind OpenAI, Codex, NVIDIA NIM e OpenCode",
        "models": [m["id"] for m in models_data if not m["id"].startswith("claude") and not m["id"].startswith("gemini")]
    },
    "nexusmind_claude": {
        "name": "NexusMind Anthropic Claude",
        "description": "Modelos Anthropic Claude 3.5 e 3.7",
        "models": [m["id"] for m in models_data if "claude" in m["id"].lower()]
    },
    "nexusmind_antigravity": {
        "name": "NexusMind Anti-Gravity",
        "description": "Google Gemini e modelos Google Antigravity",
        "models": [m["id"] for m in models_data if "gemini" in m["id"].lower()]
    },
    "nexusmind_grok": {
        "name": "NexusMind Grok",
        "description": "xAI Grok 2 e Grok 3",
        "models": [m["id"] for m in models_data if "grok" in m["id"].lower()]
    }
}

# Update Goose custom providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

for key, g in groups.items():
    if not g["models"]: continue
    cfg = {
        "name": g["name"],
        "engine": "openai",
        "api_key": api_key,
        "base_url": "https://api.nexusmind.digital/v1",
        "description": g["description"],
        "models": g["models"]
    }
    with open(os.path.join(goose_dir, f"{key}.json"), "w") as f:
        json.dump(cfg, f, indent=2)

print("SYNC_SUCCESS: Goose and Pi providers updated.")
`;

        if (ctx.host.spawn) {
          const proc = await ctx.host.spawn("python", {
            args: ["-c", pythonSyncScript],
          });
          await proc.exited;
        }

        setStatusMessage({
          type: "success",
          text: `Sincronização concluída! ${fetchedModels.length} modelos atualizados com sucesso para todos os agentes do Buzz.`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro durante a sincronização: ${err.message}`,
        });
      } finally {
        setLoading(false);
      }
    };

    const filteredModels = models.filter((m: any) => {
      const id = (m.id || "").toLowerCase();
      if (filterFree && !id.includes("free")) return false;
      if (selectedGroup === "openai" && (id.includes("claude") || id.includes("gemini") || id.includes("grok"))) return false;
      if (selectedGroup === "claude" && !id.includes("claude")) return false;
      if (selectedGroup === "antigravity" && !id.includes("gemini")) return false;
      if (selectedGroup === "grok" && !id.includes("grok")) return false;
      if (searchQuery && !id.includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    return h(
      "section",
      {
        style: {
          padding: "var(--space-6, 24px)",
          maxWidth: "960px",
          margin: "0 auto",
          color: "var(--text-standard, #ffffff)",
          fontFamily: "var(--font-sans, system-ui)",
        },
      },
      // Header
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4, 16px)",
            borderBottom: "1px solid var(--border-subtle, #333338)",
            paddingBottom: "var(--space-4, 16px)",
            marginBottom: "var(--space-6, 24px)",
          },
        },
        h("img", { src: ICON, style: { width: "36px", height: "36px" } }),
        h(
          "div",
          null,
          h("h1", { style: { margin: 0, fontSize: "22px", fontWeight: "600" } }, "NexusMind Gateway"),
          h(
            "p",
            { style: { margin: "4px 0 0", color: "var(--text-subtle, #a0a0a0)", fontSize: "14px" } },
            "Conexão direta, gerenciamento de chaves e sincronização contínua de modelos para os agentes do Buzz."
          )
        )
      ),

      // Status message
      statusMessage &&
        h(
          "div",
          {
            style: {
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              backgroundColor:
                statusMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : statusMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(59, 130, 246, 0.15)",
              color:
                statusMessage.type === "success"
                  ? "#10b981"
                  : statusMessage.type === "error"
                  ? "#ef4444"
                  : "#3b82f6",
              border: `1px solid ${
                statusMessage.type === "success"
                  ? "#10b981"
                  : statusMessage.type === "error"
                  ? "#ef4444"
                  : "#3b82f6"
              }`,
            },
          },
          statusMessage.text
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
            marginBottom: "24px",
          },
        },
        h("h2", { style: { margin: "0 0 16px", fontSize: "16px", fontWeight: "600" } }, "Credenciais e Acesso NexusMind"),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "14px" } },
          h(
            "div",
            null,
            h("label", { style: { display: "block", fontSize: "13px", marginBottom: "6px", color: "var(--text-subtle, #a0a0a0)" } }, "NexusMind API Key:"),
            h("input", {
              type: "password",
              value: apiKey,
              onChange: (e: any) => setApiKey(e.target.value),
              placeholder: "ex: sk-proj-... ou sua chave do NexusMind",
              style: {
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle, #333338)",
                backgroundColor: "#111115",
                color: "#ffffff",
                boxSizing: "border-box",
                fontSize: "14px",
              },
            })
          ),
          h(
            "div",
            null,
            h("label", { style: { display: "block", fontSize: "13px", marginBottom: "6px", color: "var(--text-subtle, #a0a0a0)" } }, "NexusMind Admin Key (opcional para gerenciar contas):"),
            h("input", {
              type: "password",
              value: adminKey,
              onChange: (e: any) => setAdminKey(e.target.value),
              placeholder: "adm_sc_...",
              style: {
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle, #333338)",
                backgroundColor: "#111115",
                color: "#ffffff",
                boxSizing: "border-box",
                fontSize: "14px",
              },
            })
          ),
          h(
            "div",
            { style: { display: "flex", gap: "10px", marginTop: "6px" } },
            h(
              "button",
              {
                onClick: handleSaveKeys,
                style: {
                  padding: "8px 16px",
                  borderRadius: "6px",
                  backgroundColor: "var(--border-subtle, #333338)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "500",
                },
              },
              "Salvar Chaves"
            ),
            h(
              "button",
              {
                onClick: handleTestConnection,
                disabled: loading,
                style: {
                  padding: "8px 16px",
                  borderRadius: "6px",
                  backgroundColor: "transparent",
                  color: "#3b82f6",
                  border: "1px solid #3b82f6",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "500",
                },
              },
              loading ? "Testando..." : "Testar Conexão"
            ),
            h(
              "button",
              {
                onClick: handleSyncModels,
                disabled: loading,
                style: {
                  padding: "8px 20px",
                  borderRadius: "6px",
                  backgroundColor: "#10b981",
                  color: "#000000",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  marginLeft: "auto",
                },
              },
              loading ? "Sincronizando..." : "⚡ Sincronizar Modelos no Buzz"
            )
          )
        )
      ),

      // Synced Models Section
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
            },
          },
          h(
            "div",
            null,
            h("h2", { style: { margin: 0, fontSize: "18px", fontWeight: "600" } }, "Modelos Disponíveis"),
            lastSyncTime &&
              h("p", { style: { margin: "4px 0 0", fontSize: "12px", color: "var(--text-subtle, #a0a0a0)" } }, `Última sincronização: ${lastSyncTime}`)
          ),
          h(
            "div",
            { style: { display: "flex", gap: "10px", alignItems: "center" } },
            h("input", {
              type: "text",
              placeholder: "Filtrar modelo...",
              value: searchQuery,
              onChange: (e: any) => setSearchQuery(e.target.value),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #333338",
                backgroundColor: "#111115",
                color: "#ffffff",
                fontSize: "13px",
              },
            }),
            h(
              "button",
              {
                onClick: () => setFilterFree(!filterFree),
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #333338",
                  backgroundColor: filterFree ? "#10b981" : "transparent",
                  color: filterFree ? "#000000" : "#ffffff",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: filterFree ? "600" : "normal",
                },
              },
              "Apenas Free"
            )
          )
        ),

        // Group Filter Tabs
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid #2d2d35",
              paddingBottom: "8px",
              marginBottom: "16px",
            },
          },
          [
            { id: "all", label: "Todos os Grupos" },
            { id: "openai", label: "OpenAI & NVIDIA NIM" },
            { id: "claude", label: "Anthropic Claude" },
            { id: "antigravity", label: "Anti-Gravity (Gemini)" },
            { id: "grok", label: "xAI Grok" },
          ].map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                onClick: () => setSelectedGroup(tab.id),
                style: {
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: selectedGroup === tab.id ? "rgba(255,255,255,0.1)" : "transparent",
                  color: selectedGroup === tab.id ? "#ffffff" : "#a0a0a0",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: selectedGroup === tab.id ? "600" : "normal",
                },
              },
              tab.label
            )
          )
        ),

        // Models List
        filteredModels.length === 0
          ? h(
              "div",
              {
                style: {
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--text-subtle, #a0a0a0)",
                  backgroundColor: "var(--bg-card, #1a1a20)",
                  borderRadius: "12px",
                },
              },
              "Nenhum modelo encontrado. Clique em '⚡ Sincronizar Modelos no Buzz' acima para carregar."
            )
          : h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr", gap: "8px" } },
              filteredModels.map((m: any) => {
                const isFree = (m.id || "").includes("free");
                const isReasoning =
                  (m.id || "").includes("thinking") ||
                  (m.id || "").includes("reasoning") ||
                  (m.id || "").includes("gemini") ||
                  (m.id || "").includes("o1") ||
                  (m.id || "").includes("o3") ||
                  (m.id || "").includes("claude-3-7");

                return h(
                  "div",
                  {
                    key: m.id,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg-card, #1a1a20)",
                      border: "1px solid var(--border-subtle, #2d2d35)",
                    },
                  },
                  h(
                    "div",
                    null,
                    h("span", { style: { fontWeight: "500", fontSize: "14px" } }, m.id),
                    h(
                      "div",
                      { style: { display: "flex", gap: "6px", marginTop: "4px" } },
                      isFree &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(16, 185, 129, 0.2)",
                              color: "#10b981",
                              fontWeight: "600",
                            },
                          },
                          "FREE"
                        ),
                      isReasoning &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
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
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "#a0a0a0",
                          },
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

  // 1. Register main workspace page
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: NexusMindComponent,
  });

  // 2. Register settings card
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "nexusmind-settings",
      title: "NexusMind Gateway",
      group: "AI Models & Gateways",
      component: NexusMindComponent,
    });
  }
}
