// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND MODEL RANKING TAB (v2.5)
// Aba dedicada de Ranking Real de Modelos dentro do NexusMind Gateway:
// - Pódio Top 3 (Melhor Geral, Mais Rápido Online, Melhor Custo-Benefício)
// - Seletor de Tier (Geral, Tier 1 Rápido, Tier 2 Equilibrado, Tier 3 Frontier, Raciocínio, Decision)
// - Telemetria real do Gateway (nm_usage.json) + Ping HTTP 200 ao vivo
// - Aplicação em 1 clique do modelo escolhido direto em qualquer agente do Buzz
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { CanonicalGroupDef } from "../services/smart-router";
import {
  type GatewayUsageMetrics,
  type LiveProbeState,
  type ModelRankingSnapshot,
  type RankedGatewayModel,
  type RankingTier,
  buildModelRankingSnapshot,
  loadGatewayUsageByModel,
  persistModelRankingSnapshot,
} from "../services/model-ranking";

const TIER_OPTIONS: Array<{ id: RankingTier; label: string; hint: string }> = [
  { id: "geral", label: "Geral", hint: "Equilíbrio entre qualidade, adoção real e velocidade" },
  { id: "tier1_fast", label: "Tier 1 · Rápido", hint: "Triagem, tarefas simples e baixa latência" },
  { id: "tier2_balanced", label: "Tier 2 · Equilibrado", hint: "Execução padrão de cards e código" },
  { id: "tier3_frontier", label: "Tier 3 · Frontier", hint: "Arquitetura, revisão crítica e alto rigor" },
  { id: "reasoning", label: "Raciocínio", hint: "Debugging complexo e planejamento profundo" },
  { id: "decision", label: "Decision API", hint: "Classificadores yes_no / choice / score" },
];

function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}/1k`;
  return `$${usd.toFixed(4)}/req`;
}

export function createModelRankingTabComponent(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>
) {
  const React = ctx.react;
  const h = React.createElement;

  return function ModelRankingTab({
    models,
    disabledModels,
    modelTests,
    onTestSingleModel,
    onNotify,
  }: {
    models: any[];
    disabledModels: string[];
    modelTests: Record<string, LiveProbeState>;
    onTestSingleModel: (mid: string) => Promise<void>;
    onNotify: (msg: { type: "success" | "error" | "info"; text: string }) => void;
  }) {
    const [selectedTier, setSelectedTier] = React.useState<RankingTier>("geral");
    const [hideFree, setHideFree] = React.useState<boolean>(true);
    const [usageByModel, setUsageByModel] = React.useState<Record<string, GatewayUsageMetrics>>({});
    const [usageSampleSize, setUsageSampleSize] = React.useState<number>(0);
    const [probingTop, setProbingTop] = React.useState<boolean>(false);
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string>("");
    const [applyingModel, setApplyingModel] = React.useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = React.useState<string>("");

    const agentsList = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const pool: any[] = [];
        const seen = new Set<string>();
        for (const list of [snap.running, snap.agents]) {
          if (!Array.isArray(list)) continue;
          for (const a of list) {
            if (!a?.key || seen.has(a.key)) continue;
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

    // Carrega telemetria real de ~/.buzz/.scratch/nm_usage.json ao montar
    const refreshUsageTelemetry = React.useCallback(async () => {
      const loaded = await loadGatewayUsageByModel(ctx);
      setUsageByModel(loaded.byModel);
      setUsageSampleSize(loaded.sampleSize);
    }, []);

    React.useEffect(() => {
      refreshUsageTelemetry();
    }, [refreshUsageTelemetry]);

    const snapshot: ModelRankingSnapshot = React.useMemo(() => {
      return buildModelRankingSnapshot({
        catalogModels: models,
        groups,
        usageByModel,
        usageSampleSize,
        liveProbes: modelTests,
        disabledModels,
        tier: selectedTier,
        avoidFree: hideFree,
      });
    }, [models, usageByModel, usageSampleSize, modelTests, disabledModels, selectedTier, hideFree]);

    // Persiste automaticamente o ranking atualizado para o OrgFy e agentes
    React.useEffect(() => {
      if (snapshot.models.length === 0) return;
      persistModelRankingSnapshot(ctx, snapshot).then((ok) => {
        if (ok) {
          setLastSavedAt(
            new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          );
        }
      });
    }, [snapshot]);

    const visibleRows: RankedGatewayModel[] = React.useMemo(() => {
      return snapshot.models
        .filter((r) => !r.isDisabled && (!hideFree || !r.isFree))
        .slice(0, 30);
    }, [snapshot, hideFree]);

    const topOverall = visibleRows[0] || null;
    const topFastest = React.useMemo(() => {
      const candidates = visibleRows.filter((r) => r.online !== false && (r.pingLatencyMs !== null || r.avgFirstTokenMs !== null || r.avgDurationMs !== null));
      return [...candidates].sort((a, b) => {
        const la = a.pingLatencyMs ?? a.avgFirstTokenMs ?? a.avgDurationMs ?? 999999;
        const lb = b.pingLatencyMs ?? b.avgFirstTokenMs ?? b.avgDurationMs ?? 999999;
        return la - lb;
      })[0] || null;
    }, [visibleRows]);

    const topMostUsed = React.useMemo(() => {
      const candidates = visibleRows.filter((r) => r.calls > 0);
      return [...candidates].sort((a, b) => b.calls - a.calls)[0] || null;
    }, [visibleRows]);

    const handleProbeTopCandidates = async () => {
      const topToTest = visibleRows.slice(0, 6);
      if (topToTest.length === 0) return;
      setProbingTop(true);
      onNotify({
        type: "info",
        text: `Testando saúde HTTP 200 ao vivo nos ${topToTest.length} melhores modelos de '${selectedTier}'...`,
      });
      try {
        await Promise.all(topToTest.map((row) => onTestSingleModel(row.model)));
        await refreshUsageTelemetry();
        onNotify({
          type: "success",
          text: `Ranking atualizado e salvo em nexusmind-model-ranking.json para o OrgFy e agentes.`,
        });
      } finally {
        setProbingTop(false);
      }
    };

    const handleApplyModelToSelectedAgent = async (row: RankedGatewayModel) => {
      const agentsApi = (ctx as any)?.agents;
      const target = agentsList.find((a) => a.key === selectedAgentKey);
      if (!target || typeof agentsApi?.save !== "function") {
        onNotify({ type: "error", text: "Selecione um agente válido para aplicar o modelo." });
        return;
      }
      setApplyingModel(row.model);
      try {
        const nextCfg = {
          ...(target.config && typeof target.config === "object" ? target.config : {}),
          model: row.model,
          provider: row.group,
        };
        await agentsApi.save(target.key, { config: nextCfg });
        onNotify({
          type: "success",
          text: `Agente '${target.name || target.key}' atualizado para '${row.model}' (${row.group}, score ${row.score}).`,
        });
      } catch (err: any) {
        onNotify({
          type: "error",
          text: `Erro ao aplicar modelo em ${target.name || target.key}: ${err?.message || err}`,
        });
      } finally {
        setApplyingModel(null);
      }
    };

    const activeTierInfo = TIER_OPTIONS.find((t) => t.id === selectedTier) || TIER_OPTIONS[0];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "18px" } },

      // Barra de Controles do Ranking
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "14px 18px",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
            TIER_OPTIONS.map((t) => {
              const active = selectedTier === t.id;
              return h(
                "button",
                {
                  key: t.id,
                  onClick: () => setSelectedTier(t.id),
                  style: {
                    borderRadius: "9999px",
                    padding: "5px 12px",
                    border: `1px solid ${active ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                    backgroundColor: active ? "rgba(16,185,129,0.18)" : "transparent",
                    color: active ? "#34d399" : "#9ca3af",
                    fontSize: "11px",
                    fontWeight: active ? "700" : "500",
                    cursor: "pointer",
                  },
                },
                t.label
              );
            })
          ),
          h(
            "div",
            { style: { fontSize: "11px", color: "#9ca3af" } },
            `${activeTierInfo.hint} · Telemetria: ${usageSampleSize.toLocaleString("pt-BR")} chamadas reais do Gateway${lastSavedAt ? ` · Sincronizado para OrgFy às ${lastSavedAt}` : ""}`
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
          h(
            "label",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "#d1d5db",
                cursor: "pointer",
              },
            },
            h("input", {
              type: "checkbox",
              checked: hideFree,
              onChange: (e: any) => setHideFree(Boolean(e.target.checked)),
              style: { accentColor: "#10b981" },
            }),
            "Ocultar :free (429)"
          ),
          h(
            "button",
            {
              onClick: handleProbeTopCandidates,
              disabled: probingTop,
              style: {
                borderRadius: "9999px",
                padding: "7px 16px",
                backgroundColor: "#10b981",
                color: "#000000",
                border: "none",
                cursor: probingTop ? "wait" : "pointer",
                fontSize: "12px",
                fontWeight: "700",
              },
            },
            probingTop ? "Testando Top 6 ao vivo..." : "⚡ Testar Saúde & Atualizar Ranking"
          )
        )
      ),

      // Pódio Top 3
      h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" } },
        [
          {
            title: `#1 MELHOR PARA ${activeTierInfo.label.toUpperCase()}`,
            accent: "#10b981",
            row: topOverall,
            detail: topOverall ? `Score ${topOverall.score}/100 · ${topOverall.calls.toLocaleString("pt-BR")} chamadas` : "Sem dados",
          },
          {
            title: "MAIS RÁPIDO (LATÊNCIA REAL)",
            accent: "#38bdf8",
            row: topFastest,
            detail: topFastest
              ? topFastest.pingLatencyMs !== null
                ? `Ping ao vivo: ${fmtMs(topFastest.pingLatencyMs)}`
                : `TTFT/Média Gateway: ${fmtMs(topFastest.avgFirstTokenMs ?? topFastest.avgDurationMs)}`
              : "Sem medições",
          },
          {
            title: "MAIS VALIDADO EM PRODUÇÃO",
            accent: "#c084fc",
            row: topMostUsed,
            detail: topMostUsed
              ? `${topMostUsed.calls.toLocaleString("pt-BR")} chamadas · Cache ${topMostUsed.cacheHitPct ?? "—"}%`
              : "Sem histórico",
          },
        ].map((card) =>
          h(
            "div",
            {
              key: card.title,
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: `1px solid ${card.accent}44`,
                borderRadius: "14px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              },
            },
            h("div", { style: { fontSize: "10px", fontWeight: "700", color: card.accent, letterSpacing: "0.05em" } }, card.title),
            h(
              "div",
              {
                style: {
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
                title: card.row?.model || "",
              },
              card.row ? card.row.model : "—"
            ),
            h("div", { style: { fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" } }, card.detail)
          )
        )
      ),

      // Barra de Aplicação Direta em Agente
      agentsList.length > 0 &&
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              padding: "10px 16px",
              borderRadius: "12px",
              backgroundColor: "rgba(56, 189, 248, 0.06)",
              border: "1px solid rgba(56, 189, 248, 0.22)",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
            h("span", { style: { fontSize: "12px", fontWeight: "600", color: "#38bdf8" } }, "Aplicar modelo do ranking no agente:"),
            h(
              "select",
              {
                value: selectedAgentKey,
                onChange: (e: any) => setSelectedAgentKey(e.target.value),
                style: {
                  backgroundColor: "rgba(0,0,0,0.45)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: "8px",
                  padding: "5px 10px",
                  fontSize: "12px",
                },
              },
              agentsList.map((a) =>
                h(
                  "option",
                  { key: a.key, value: a.key },
                  `${a.name || a.key} (atual: ${a.config?.model || "padrão"})`
                )
              )
            )
          ),
          topOverall &&
            h(
              "button",
              {
                onClick: () => handleApplyModelToSelectedAgent(topOverall),
                disabled: applyingModel !== null,
                style: {
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  backgroundColor: "rgba(56, 189, 248, 0.18)",
                  border: "1px solid rgba(56, 189, 248, 0.45)",
                  color: "#7dd3fc",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                },
              },
              `Aplicar #1 (${topOverall.model})`
            )
        ),

      // Tabela Completa de Ranking
      h(
        "div",
        {
          style: {
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            borderRadius: "14px",
            overflowX: "auto",
          },
        },
        h(
          "table",
          { style: { width: "100%", borderCollapse: "collapse", fontSize: "12px" } },
          h(
            "thead",
            null,
            h(
              "tr",
              { style: { borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left", color: "#9ca3af", fontSize: "10px", textTransform: "uppercase" } },
              ["#", "Modelo", "Grupo", "Score", "Saúde / Ping", "Chamadas", "Latência Média", "Cache Hit", "Custo", "Ação"].map((col) =>
                h("th", { key: col, style: { padding: "10px 12px", fontWeight: "700" } }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            visibleRows.map((row, idx) => {
              const healthLabel =
                row.online === true
                  ? `HTTP 200 · ${fmtMs(row.pingLatencyMs)}`
                  : row.online === false
                  ? `Erro · ${row.pingError || "Falha"}`
                  : "Não testado";
              const healthColor =
                row.online === true ? "#10b981" : row.online === false ? "#f87171" : "#9ca3af";

              return h(
                "tr",
                {
                  key: row.model,
                  style: {
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    backgroundColor: idx === 0 ? "rgba(16, 185, 129, 0.05)" : "transparent",
                  },
                },
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", fontWeight: "700", color: idx < 3 ? "#10b981" : "#9ca3af" } }, `#${idx + 1}`),
                h(
                  "td",
                  { style: { padding: "10px 12px", fontWeight: "600", color: "#ffffff" } },
                  row.model,
                  row.isFree &&
                    h(
                      "span",
                      { style: { marginLeft: "6px", fontSize: "9px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(245,158,11,0.2)", color: "#fbbf24" } },
                      "FREE"
                    )
                ),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", fontSize: "11px", color: "#9ca3af" } }, row.group.replace("nexusmind_", "")),
                h(
                  "td",
                  { style: { padding: "10px 12px", fontFamily: "monospace", fontWeight: "700", color: row.score >= 75 ? "#34d399" : row.score >= 55 ? "#fbbf24" : "#f87171" } },
                  `${row.score}`
                ),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", fontSize: "11px", color: healthColor } }, healthLabel),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", color: "#e4e4e7" } }, row.calls > 0 ? row.calls.toLocaleString("pt-BR") : "—"),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", color: "#cbd5e1" } }, fmtMs(row.avgDurationMs)),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", color: "#cbd5e1" } }, row.cacheHitPct !== null ? `${row.cacheHitPct}%` : "—"),
                h("td", { style: { padding: "10px 12px", fontFamily: "monospace", color: "#cbd5e1" } }, fmtCost(row.avgCostUsd)),
                h(
                  "td",
                  { style: { padding: "10px 12px", whiteSpace: "nowrap" } },
                  h(
                    "div",
                    { style: { display: "flex", gap: "6px" } },
                    h(
                      "button",
                      {
                        onClick: () => onTestSingleModel(row.model),
                        style: {
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.12)",
                          backgroundColor: "rgba(255,255,255,0.06)",
                          color: "#e4e4e7",
                          fontSize: "10px",
                          cursor: "pointer",
                        },
                      },
                      "Testar"
                    ),
                    agentsList.length > 0 &&
                      h(
                        "button",
                        {
                          onClick: () => handleApplyModelToSelectedAgent(row),
                          disabled: applyingModel === row.model,
                          style: {
                            padding: "4px 9px",
                            borderRadius: "6px",
                            border: "1px solid rgba(56,189,248,0.4)",
                            backgroundColor: "rgba(56,189,248,0.14)",
                            color: "#38bdf8",
                            fontSize: "10px",
                            fontWeight: "700",
                            cursor: "pointer",
                          },
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
