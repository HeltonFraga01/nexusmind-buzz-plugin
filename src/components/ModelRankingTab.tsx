// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND RANKING & ROTEAMENTO TAB (v2.6 — Buzz Native Minimalist Design)
// Visual limpo seguindo os tokens nativos do Buzz (--bg-panel, --border-primary,
// --text-primary, --affordance-subtle), zero "boneca russa":
//   1. Barra compacta de critérios de roteamento (Tier, Estratégia, Teto de Custo, Forçar :free)
//   2. Faixa única do modelo #1 eleito + aplicação direta em agente
//   3. Tabela limpa com toggle 1-clique "Auto ✓ / Manual 🔒" (proibir auto-designação) e Fixar Tier
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { CanonicalGroupDef } from "../services/smart-router";
import {
  type GatewayUsageMetrics,
  type LiveProbeState,
  type ModelRankingSnapshot,
  type RankedGatewayModel,
  type RankingTier,
  type RoutingPolicy,
  type RoutingStrategy,
  buildModelRankingSnapshot,
  inferCanonicalGroupForModel,
  loadGatewayUsageByModel,
  loadSavedRoutingPolicy,
  persistModelRankingSnapshot,
  saveRoutingPolicy,
} from "../services/model-ranking";
import type { ModelAccessMode, VipPolicyConfig } from "../services/vip-policy";
import {
  type QualityProbeResult,
  runBatchQualityBench,
  syncQualityBenchToOrgfyEval,
} from "../services/quality-bench";
import type { QuarantineEntry } from "../services/agentic-failover";

const TIER_OPTIONS: Array<{ id: RankingTier; label: string }> = [
  { id: "geral", label: "Geral" },
  { id: "tier1_fast", label: "Tier 1 · Rápido" },
  { id: "tier2_balanced", label: "Tier 2 · Código" },
  { id: "tier3_frontier", label: "Tier 3 · Frontier" },
  { id: "reasoning", label: "Raciocínio" },
  { id: "decision", label: "Decision" },
];

const STRATEGY_OPTIONS: Array<{ id: RoutingStrategy; label: string }> = [
  { id: "balanced", label: "Balanceado" },
  { id: "speed", label: "Velocidade" },
  { id: "quality", label: "Máxima Qualidade" },
  { id: "cost", label: "Menor Custo" },
];

function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  if (usd < 0.001) return `$${(usd * 1000).toFixed(2)}/1k`;
  return `$${usd.toFixed(4)}`;
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
    vipPolicy,
    onSetModelAccessMode,
    onQuickProtectVips,
    qualityBench,
    onUpdateQualityBench,
    quarantines,
  }: {
    models: any[];
    disabledModels: string[];
    modelTests: Record<string, LiveProbeState>;
    onTestSingleModel: (mid: string) => Promise<void>;
    onNotify: (msg: { type: "success" | "error" | "info"; text: string }) => void;
    vipPolicy?: VipPolicyConfig;
    onSetModelAccessMode?: (modelId: string, mode: ModelAccessMode) => void;
    onQuickProtectVips?: () => void;
    qualityBench?: Record<string, QualityProbeResult>;
    onUpdateQualityBench?: (next: Record<string, QualityProbeResult>) => void;
    quarantines?: Record<string, QuarantineEntry>;
  }) {
    const [selectedTier, setSelectedTier] = React.useState<RankingTier>("geral");
    const [policy, setPolicy] = React.useState<RoutingPolicy>(() => loadSavedRoutingPolicy());
    const [usageByModel, setUsageByModel] = React.useState<Record<string, GatewayUsageMetrics>>({});
    const [usageSampleSize, setUsageSampleSize] = React.useState<number>(0);
    const [probingTop, setProbingTop] = React.useState<boolean>(false);
    const [runningEval, setRunningEval] = React.useState<boolean>(false);
    const [evalProgress, setEvalProgress] = React.useState<string | null>(null);
    const [selectedAgentKey, setSelectedAgentKey] = React.useState<string>("");
    const [applyingModel, setApplyingModel] = React.useState<string | null>(null);
    const [onlyAutoEligible, setOnlyAutoEligible] = React.useState<boolean>(false);
    const [searchFilter, setSearchFilter] = React.useState<string>("");

    const updatePolicy = (updater: (prev: RoutingPolicy) => RoutingPolicy) => {
      setPolicy((prev: RoutingPolicy) => {
        const next = updater(prev);
        saveRoutingPolicy(next);
        return next;
      });
    };

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
        policy,
        vipPolicy,
        qualityBench,
        quarantines,
      });
    }, [models, usageByModel, usageSampleSize, modelTests, disabledModels, selectedTier, policy, vipPolicy, qualityBench, quarantines]);

    React.useEffect(() => {
      if (snapshot.models.length === 0) return;
      persistModelRankingSnapshot(ctx, snapshot);
    }, [snapshot]);

    const visibleRows: RankedGatewayModel[] = React.useMemo(() => {
      const q = searchFilter.trim().toLowerCase();
      return snapshot.models
        .filter((r) => {
          if (r.isDisabled) return false;
          if (policy.forceFree && !r.isFree) return false;
          if (onlyAutoEligible && !r.eligibleForAuto) return false;
          if (q && !r.model.toLowerCase().includes(q)) return false;
          return true;
        })
        .slice(0, 40);
    }, [snapshot, policy.forceFree, onlyAutoEligible, searchFilter]);

    const activeWinner = snapshot.bestByTier[selectedTier] || null;
    const pinnedForTier = policy.tierPins[selectedTier] || null;

    const toggleAutoAssignBlock = (modelId: string) => {
      updatePolicy((prev) => {
        const lower = modelId.toLowerCase();
        const exists = prev.autoAssignBlocked.some((m) => m.toLowerCase() === lower);
        const nextBlocked = exists
          ? prev.autoAssignBlocked.filter((m) => m.toLowerCase() !== lower)
          : [...prev.autoAssignBlocked, modelId];
        return { ...prev, autoAssignBlocked: nextBlocked };
      });
    };

    const togglePinForTier = (modelId: string) => {
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
        text: `Rodando Eval de Qualidade & Tool-Calling nos top ${topToEval.length} modelos...`,
      });
      try {
        const candidates = topToEval.map((row) => ({
          model: row.model,
          group: groups[row.group] || inferCanonicalGroupForModel(row.model, groups),
        }));
        const updated = await runBatchQualityBench(ctx, candidates, (done, total) => {
          setEvalProgress(`Eval ${done}/${total}`);
        });
        onUpdateQualityBench?.(updated);
        await syncQualityBenchToOrgfyEval(ctx, updated);
        await refreshUsageTelemetry();
        const testedSlice = topToEval.map((r) => updated[r.model]).filter(Boolean);
        const approved = testedSlice.filter((r) => r.online && r.toolCallOk).length;
        onNotify({
          type: "success",
          text: `Eval concluído: ${approved}/${testedSlice.length} aprovados em Tool-Calling. Ranking e OrgFy atualizados.`,
        });
      } catch (err: any) {
        onNotify({ type: "error", text: `Erro no Eval manual: ${err?.message || err}` });
      } finally {
        setRunningEval(false);
        setEvalProgress(null);
      }
    };

    const handleApplyModel = async (modelId: string, groupId: string) => {
      const agentsApi = (ctx as any)?.agents;
      const target = agentsList.find((a) => a.key === selectedAgentKey);
      if (!target || typeof agentsApi?.save !== "function") {
        onNotify({ type: "error", text: "Selecione um agente para aplicar o modelo." });
        return;
      }
      setApplyingModel(modelId);
      try {
        const nextCfg = {
          ...(target.config && typeof target.config === "object" ? target.config : {}),
          model: modelId,
          provider: groupId,
        };
        await agentsApi.save(target.key, { config: nextCfg });
        onNotify({ type: "success", text: `${target.name || target.key} atualizado para ${modelId}.` });
      } catch (err: any) {
        onNotify({ type: "error", text: `Falha ao aplicar: ${err?.message || err}` });
      } finally {
        setApplyingModel(null);
      }
    };

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },

      // 1. Barra compacta de Tier + Critérios de Roteamento (CodeDen + Buzz Theme)
      h(
        "div",
        {
          className: "nm-card-pad",
          style: { display: "flex", flexDirection: "column", gap: "10px", padding: "12px 14px" },
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
                  onClick: () => setSelectedTier(t.id),
                },
                t.label
              );
            })
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            onQuickProtectVips &&
              h(
                "button",
                {
                  type: "button",
                  className: "nm-btn",
                  "data-variant": "soft",
                  onClick: onQuickProtectVips,
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
                title: "Testa Tool-Calling, integridade e latência dos top 8 modelos e atualiza o Ranking + OrgFy",
              },
              runningEval ? (evalProgress || "Rodando Eval...") : "Rodar Eval (Top 8)"
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "primary",
                onClick: handleProbeTopCandidates,
                disabled: probingTop || runningEval,
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
              borderTop: "1px solid var(--border-primary, #2a2a2a)",
            },
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
                  onChange: (e: any) => updatePolicy((p) => ({ ...p, strategy: e.target.value as RoutingStrategy })),
                  style: {
                    backgroundColor: "var(--surface-inset, #101010)",
                    color: "var(--text-primary, #ffffff)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                  },
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
                  onChange: (e: any) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    updatePolicy((p) => ({ ...p, maxCostPerReqUsd: v }));
                  },
                  style: {
                    backgroundColor: "var(--surface-inset, #101010)",
                    color: "var(--text-primary, #ffffff)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                  },
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
                  fontWeight: policy.forceFree ? "600" : "500",
                },
              },
              h("input", {
                type: "checkbox",
                className: "nm-check",
                checked: policy.forceFree,
                onChange: (e: any) => updatePolicy((p) => ({ ...p, forceFree: Boolean(e.target.checked) })),
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
                onChange: (e: any) => setOnlyAutoEligible(Boolean(e.target.checked)),
              }),
              "Só elegíveis (Auto)"
            )
          ),
          h("input", {
            type: "text",
            className: "nm-input",
            placeholder: "Filtrar modelo...",
            value: searchFilter,
            onChange: (e: any) => setSearchFilter(e.target.value),
            style: { width: "170px", fontSize: "11.5px" },
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
            borderColor: activeWinner ? "var(--nm-primary-border)" : "var(--nm-border)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
          h(
            "span",
            { className: "nm-pill", "data-tone": "accent" },
            activeWinner?.pinned ? "FIXADO" : "AUTO #1"
          ),
          h(
            "span",
            { className: "nm-mono", style: { fontSize: "13px", fontWeight: "700", color: "var(--nm-fg)" } },
            activeWinner ? activeWinner.model : "Nenhum elegível"
          ),
          activeWinner &&
            h(
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
        agentsList.length > 0 &&
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            h(
              "select",
              {
                className: "nm-select",
                value: selectedAgentKey,
                onChange: (e: any) => setSelectedAgentKey(e.target.value),
                style: { fontSize: "11.5px" },
              },
              agentsList.map((a) =>
                h("option", { key: a.key, value: a.key }, `${a.name || a.key} (${a.config?.model || "padrão"})`)
              )
            ),
            activeWinner &&
              h(
                "button",
                {
                  type: "button",
                  className: "nm-btn",
                  "data-variant": "soft",
                  onClick: () => handleApplyModel(activeWinner.model, activeWinner.group),
                  disabled: applyingModel !== null,
                  style: { padding: "5px 10px", fontSize: "11.5px" },
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
                  letterSpacing: "0.04em",
                },
              },
              ["#", "Modelo", "Auto-Designação", "Score", "Saúde", "Chamadas", "Latência", "Custo", "Ações"].map((col) =>
                h("th", { key: col, style: { padding: "9px 12px", fontWeight: "600" } }, col)
              )
            )
          ),
          h(
            "tbody",
            null,
            visibleRows.length === 0
              ? h(
                  "tr",
                  null,
                  h(
                    "td",
                    { colSpan: 9, style: { padding: "24px", textAlign: "center", color: "var(--text-tertiary, #808080)" } },
                    "Nenhum modelo corresponde aos critérios atuais."
                  )
                )
              : visibleRows.map((row, idx) => {
                  const isPinned = pinnedForTier === row.model;
                  const healthLabel =
                    row.online === true
                      ? `OK · ${fmtMs(row.pingLatencyMs)}`
                      : row.online === false
                      ? `Erro`
                      : "—";
                  const healthColor =
                    row.online === true ? "var(--green-11, #3dd68c)" : row.online === false ? "var(--red-11, #ff9592)" : "var(--text-tertiary, #808080)";

                  return h(
                    "tr",
                    {
                      key: row.model,
                      style: {
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        opacity: row.autoAssignBlocked ? 0.65 : 1,
                      },
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
                      row.isFree &&
                        h(
                          "span",
                          { style: { marginLeft: "6px", fontSize: "9px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "var(--affordance-subtle, #282828)", color: "var(--text-secondary, #c7c7c7)" } },
                          "FREE"
                        ),
                      isPinned &&
                        h(
                          "span",
                          { className: "nm-pill", "data-tone": "accent", style: { marginLeft: "6px", fontSize: "9.5px", padding: "1px 6px" } },
                          "FIXADO"
                        )
                    ),
                    // Controle 1-clique em 3 estados: Auto | VIP | Bloq.
                    h(
                      "td",
                      { style: { padding: "8px 12px" } },
                      onSetModelAccessMode
                        ? h(
                            "div",
                            { className: "nm-mode-group" },
                            ([
                              { id: "auto", label: "Auto" },
                              { id: "vip", label: "VIP" },
                              { id: "blocked", label: "Bloq." },
                            ] as Array<{ id: ModelAccessMode; label: string }>).map((opt) =>
                              h(
                                "button",
                                {
                                  key: opt.id,
                                  type: "button",
                                  className: "nm-mode-btn",
                                  "data-active": row.accessMode === opt.id ? opt.id : undefined,
                                  onClick: () => onSetModelAccessMode(row.model, opt.id),
                                  title:
                                    opt.id === "auto"
                                      ? "Liberado para pool automático dos agentes"
                                      : opt.id === "vip"
                                      ? "Reservado apenas para Iris e Conselho"
                                      : "Bloqueado para roteamento automático",
                                },
                                opt.label
                              )
                            )
                          )
                        : h(
                            "button",
                            {
                              onClick: () => toggleAutoAssignBlock(row.model),
                              className: "nm-btn",
                              style: { padding: "3px 8px", fontSize: "11px" },
                            },
                            row.autoAssignBlocked ? "Bloq." : "Auto"
                          )
                    ),
                    h(
                      "td",
                      { style: { padding: "8px 12px", fontFamily: "monospace", fontWeight: "600", color: "var(--nm-fg)" } },
                      `${row.score}`,
                      row.toolCallOk !== null &&
                        h(
                          "span",
                          {
                            className: "nm-pill",
                            "data-tone": row.toolCallOk ? "ok" : "danger",
                            style: { marginLeft: "6px", fontSize: "9.5px", padding: "1px 5px" },
                            title: row.toolCallOk ? "Tool-Calling validado" : "Falha no Tool-Calling",
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
                              cursor: "pointer",
                            },
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
                              cursor: "pointer",
                            },
                          },
                          "Testar"
                        ),
                        agentsList.length > 0 &&
                          h(
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
