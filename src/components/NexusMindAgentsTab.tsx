// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND AGENTES BUZZ TAB (v2.7 — Buzz Native APIs & Live Sync)
// Integração nativa com:
//   - ctx.agents.snapshot() + ctx.agents.subscribe() (avatares, config, status)
//   - ctx.agents.save(key, { config }) sem `base` vazio (evita erro de sync)
//   - ctx.navigation.open() para deep-link direto ao OrgFy Factory
//   - ctx.notifications.notify() para confirmação nativa no Buzz Desktop
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { CanonicalGroupDef } from "../services/smart-router";
import {
  buildModelRankingSnapshot,
  loadGatewayUsageByModel,
  loadSavedRoutingPolicy,
  type LiveProbeState,
} from "../services/model-ranking";
import { type VipPolicyConfig, isVipAgent } from "../services/vip-policy";

interface BuzzAgentRow {
  key: string;
  name: string;
  picture?: string;
  running: boolean;
  provider: string;
  model: string;
  harness: string;
  config: Record<string, any>;
}

function isFreeModel(modelId: string): boolean {
  const low = String(modelId || "").toLowerCase();
  return low.includes(":free") || low.includes("-free") || low.endsWith("free");
}

function readBuzzAgents(ctx: any): BuzzAgentRow[] {
  try {
    const snap = ctx?.agents?.snapshot?.() || {};
    const runningKeys = new Set<string>(
      Array.isArray(snap.running) ? snap.running.map((a: any) => String(a?.key || "")) : []
    );
    const seen = new Set<string>();
    const list: BuzzAgentRow[] = [];

    for (const pool of [snap.agents, snap.running]) {
      if (!Array.isArray(pool)) continue;
      for (const raw of pool) {
        const key = String(raw?.key || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cfg = raw?.config && typeof raw.config === "object" ? raw.config : {};
        list.push({
          key,
          name: String(raw?.name || cfg?.name || key),
          picture: typeof raw?.picture === "string" ? raw.picture : undefined,
          running: runningKeys.has(key) || raw?.status === "running",
          provider: String(cfg?.provider || "padrão"),
          model: String(cfg?.model || "padrão"),
          harness: String(cfg?.harness || "goose"),
          config: cfg,
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

export function createNexusMindAgentsTabComponent(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>
) {
  const React = ctx.react;
  const h = React.createElement;

  return function NexusMindAgentsTab({
    models,
    disabledModels,
    modelTests,
    onNotify,
    vipPolicy,
    onToggleVipAgent,
    onFailoverAgent,
  }: {
    models: any[];
    disabledModels: string[];
    modelTests: Record<string, LiveProbeState>;
    onNotify: (msg: { type: "success" | "error" | "info"; text: string }) => void;
    vipPolicy?: VipPolicyConfig;
    onToggleVipAgent?: (agentName: string) => void;
    onFailoverAgent?: (agentKey: string) => Promise<void>;
  }) {
    const [agents, setAgents] = React.useState<BuzzAgentRow[]>(() => readBuzzAgents(ctx));
    const [search, setSearch] = React.useState<string>("");
    const [filterOnlyFree, setFilterOnlyFree] = React.useState<boolean>(false);
    const [savingKey, setSavingKey] = React.useState<string | null>(null);
    const [draftModelByAgent, setDraftModelByAgent] = React.useState<Record<string, string>>({});
    const [bestModelInfo, setBestModelInfo] = React.useState<{ model: string; group: string } | null>(null);

    const refreshAgents = React.useCallback(() => {
      setAgents(readBuzzAgents(ctx));
    }, []);

    // Live subscription to Buzz agents state
    React.useEffect(() => {
      refreshAgents();
      const agentsApi = (ctx as any)?.agents;
      if (typeof agentsApi?.subscribe === "function") {
        try {
          const unsub = agentsApi.subscribe(() => {
            refreshAgents();
          });
          return () => {
            if (typeof unsub === "function") unsub();
          };
        } catch {}
      }
      return undefined;
    }, [refreshAgents]);

    // Compute best ranked model for 1-click assignment
    React.useEffect(() => {
      let active = true;
      loadGatewayUsageByModel(ctx)
        .then((loaded) => {
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
            policy,
          });
          const top = snap.bestByTier.tier2_balanced || snap.bestByTier.geral;
          if (top?.model && top?.group) {
            setBestModelInfo({ model: top.model, group: top.group });
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [models, disabledModels, modelTests]);

    const activeCatalogOptions = React.useMemo(() => {
      const disabledSet = new Set(disabledModels);
      const list = models
        .filter((m) => m?.id && !disabledSet.has(m.id))
        .map((m) => ({
          id: String(m.id),
          group: String(m.primaryGroup || (Array.isArray(m.groups) && m.groups[0]) || "nexusmind_openai"),
        }));
      if (list.length > 0) return list;
      return Object.values(groups).map((g) => ({ id: g.defaultModel, group: g.id }));
    }, [models, disabledModels]);

    const filteredAgents = React.useMemo(() => {
      const q = search.trim().toLowerCase();
      return agents.filter((a) => {
        if (filterOnlyFree && !isFreeModel(a.model)) return false;
        if (
          q &&
          !a.name.toLowerCase().includes(q) &&
          !a.model.toLowerCase().includes(q) &&
          !a.provider.toLowerCase().includes(q)
        ) {
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

    const resolveGroupForModel = (modelId: string): string => {
      const found = activeCatalogOptions.find((o) => o.id === modelId);
      if (found) return found.group;
      const low = modelId.toLowerCase();
      if (low.includes("grok")) return "nexusmind_grok";
      if (low.includes("gemini") || low.includes("thinking")) return "nexusmind_antigravity";
      if (low.includes("claude")) return "nexusmind_anthropic";
      return "nexusmind_openai";
    };

    const handleSaveAgentModel = async (agent: BuzzAgentRow, targetModel: string, targetGroup?: string) => {
      const agentsApi = (ctx as any)?.agents;
      if (typeof agentsApi?.save !== "function") {
        onNotify({ type: "error", text: "API ctx.agents.save() indisponível neste runtime." });
        return;
      }
      const providerId = targetGroup || resolveGroupForModel(targetModel);
      setSavingKey(agent.key);
      try {
        // Lê snapshot fresco para preservar todos os campos de config e omite `base`
        const fresh = readBuzzAgents(ctx).find((a) => a.key === agent.key) || agent;
        const nextCfg = {
          ...(fresh.config && typeof fresh.config === "object" ? fresh.config : {}),
          provider: providerId,
          model: targetModel,
        };
        await agentsApi.save(agent.key, { config: nextCfg });
        refreshAgents();
        onNotify({
          type: "success",
          text: `${agent.name} atualizado para ${targetModel} (${providerId.replace("nexusmind_", "")}).`,
        });
        try {
          (ctx as any)?.notifications?.notify?.({
            title: "NexusMind Gateway",
            body: `${agent.name} → ${targetModel}`,
          });
        } catch {}
      } catch (err: any) {
        onNotify({
          type: "error",
          text: `Falha ao atualizar ${agent.name}: ${err?.message || err}`,
        });
      } finally {
        setSavingKey(null);
      }
    };

    const handleOpenOrgfyFactory = () => {
      try {
        (ctx as any)?.navigation?.open?.({
          version: 1,
          kind: "page",
          pluginId: "digital.cortexx.orgfy",
          pageId: "orgfy",
        });
      } catch {}
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
            fontSize: "12px",
          },
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
          freeAgentsCount > 0 &&
            h(
              "span",
              { className: "nm-pill", "data-tone": "warn" },
              `${freeAgentsCount} usando :free`
            ),
          bestModelInfo &&
            h(
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
            onChange: (e: any) => setSearch(e.target.value),
            style: { width: "185px", fontSize: "11.5px" },
          }),
          freeAgentsCount > 0 &&
            h(
              "label",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  color: filterOnlyFree ? "var(--nm-warn)" : "var(--nm-muted)",
                  cursor: "pointer",
                },
              },
              h("input", {
                type: "checkbox",
                className: "nm-check",
                checked: filterOnlyFree,
                onChange: (e: any) => setFilterOnlyFree(Boolean(e.target.checked)),
              }),
              "Só :free"
            ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              onClick: refreshAgents,
              style: { padding: "5px 10px", fontSize: "11.5px" },
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
              style: { padding: "5px 10px", fontSize: "11.5px" },
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
                  letterSpacing: "0.04em",
                },
              },
              ["Agente", "Status", "Provedor", "Modelo Atual", "Trocar Modelo", "Ação"].map((col) =>
                h("th", { key: col, style: { padding: "9px 12px", fontWeight: "600" } }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            filteredAgents.length === 0
              ? h(
                  "tr",
                  null,
                  h(
                    "td",
                    { colSpan: 6, style: { padding: "24px", textAlign: "center", color: "var(--text-tertiary, #808080)" } },
                    agents.length === 0
                      ? "Nenhum agente retornado por ctx.agents.snapshot()."
                      : "Nenhum agente corresponde ao filtro atual."
                  )
                )
              : filteredAgents.map((agent) => {
                  const isSaving = savingKey === agent.key;
                  const agentIsFree = isFreeModel(agent.model);
                  const selectedDraft = draftModelByAgent[agent.key] ?? agent.model;
                  const hasPendingChange = selectedDraft && selectedDraft !== agent.model;

                  return h(
                    "tr",
                    {
                      key: agent.key,
                      style: {
                        borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.05))",
                      },
                    },
                    // Agente (avatar real do Buzz + nome)
                    h(
                      "td",
                      { style: { padding: "8px 12px" } },
                      h(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: "8px" } },
                        agent.picture
                          ? h("img", {
                              src: agent.picture,
                              alt: agent.name,
                              style: {
                                width: "22px",
                                height: "22px",
                                borderRadius: "6px",
                                objectFit: "cover",
                                backgroundColor: "var(--surface-inset, #101010)",
                              },
                            })
                          : h(
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
                                  fontWeight: "600",
                                },
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
                            vipPolicy && isVipAgent(agent.name, vipPolicy) &&
                              h("span", { className: "nm-pill", "data-tone": "warn", style: { fontSize: "9.5px", padding: "1px 5px" } }, "VIP")
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
                            color: agent.running ? "var(--green-11, #3dd68c)" : "var(--text-tertiary, #808080)",
                          },
                        },
                        h("span", {
                          style: {
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: agent.running ? "var(--green-11, #3dd68c)" : "var(--text-tertiary, #666666)",
                          },
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
                      agentIsFree &&
                        h(
                          "span",
                          {
                            style: {
                              marginLeft: "6px",
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: "var(--amber-3, #302008)",
                              color: "var(--amber-11, #ffca16)",
                              fontWeight: "600",
                            },
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
                          onChange: (e: any) =>
                            setDraftModelByAgent((prev) => ({ ...prev, [agent.key]: e.target.value })),
                          style: {
                            backgroundColor: "var(--surface-inset, #101010)",
                            color: "var(--text-primary, #ffffff)",
                            border: "1px solid var(--border-primary, #333333)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            maxWidth: "220px",
                          },
                        },
                        !activeCatalogOptions.some((o) => o.id === agent.model) &&
                          h("option", { key: "__current", value: agent.model }, agent.model),
                        activeCatalogOptions.slice(0, 80).map((opt) =>
                          h(
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
                            "data-variant": hasPendingChange ? "primary" : undefined,
                            onClick: () => handleSaveAgentModel(agent, selectedDraft),
                            disabled: isSaving || !hasPendingChange,
                            style: { padding: "4px 10px", fontSize: "11px" },
                          },
                          isSaving ? "..." : "Salvar"
                        ),
                        onToggleVipAgent && vipPolicy &&
                          h(
                            "button",
                            {
                              type: "button",
                              className: "nm-btn",
                              "data-variant": isVipAgent(agent.name, vipPolicy) ? "soft" : undefined,
                              onClick: () => onToggleVipAgent(agent.name),
                              title: isVipAgent(agent.name, vipPolicy)
                                ? "Agente VIP protegido contra troca automática (clique para liberar)"
                                : "Proteger como agente VIP (Iris/Conselho)",
                              style: { padding: "4px 8px", fontSize: "10.5px" },
                            },
                            isVipAgent(agent.name, vipPolicy) ? "VIP ✓" : "VIP"
                          ),
                        onFailoverAgent &&
                          h(
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
                              style: { padding: "4px 8px", fontSize: "10.5px" },
                            },
                            "Failover"
                          ),
                        bestModelInfo &&
                          !(vipPolicy && isVipAgent(agent.name, vipPolicy)) &&
                          agent.model !== bestModelInfo.model &&
                          h(
                            "button",
                            {
                              type: "button",
                              className: "nm-btn",
                              "data-variant": "soft",
                              onClick: () => handleSaveAgentModel(agent, bestModelInfo.model, bestModelInfo.group),
                              disabled: isSaving,
                              title: `Aplicar modelo #1 do ranking (${bestModelInfo.model})`,
                              style: { padding: "4px 9px", fontSize: "10.5px" },
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
