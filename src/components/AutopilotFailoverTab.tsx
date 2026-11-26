// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND AUTOPILOT, VIP SHIELD & QUALITY BENCH TAB (v3.0 — Buzz Native)
// Painel agêntico de operação contínua do Gateway NexusMind:
//   1. Autopiloto & Watchdog ao vivo (detecção rápida + failover + wake)
//   2. Escudo VIP (Iris & Conselho protegidos; workers isolados no pool Auto)
//   3. Quarentena / Circuit Breaker (TTL automático + liberação em 1 clique)
//   4. Rotinas de Benchmark de Qualidade (Tool-Calling + Integridade + Latência)
//   5. Log em tempo real de failovers executados
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { CanonicalGroupDef } from "../services/smart-router";
import {
  type ModelRankingSnapshot,
  inferCanonicalGroupForModel,
} from "../services/model-ranking";
import {
  type VipPolicyConfig,
  applyQuickVipPreset,
  isVipAgent,
  toggleVipAgent,
} from "../services/vip-policy";
import {
  type QualityProbeResult,
  runBatchQualityBench,
} from "../services/quality-bench";
import {
  type AutopilotConfig,
  type FailoverEvent,
  type QuarantineEntry,
  executeAgentFailover,
  releaseQuarantine,
} from "../services/agentic-failover";

function fmtRemaining(expiresAt: string): string {
  const diff = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "expirando";
  const mins = Math.ceil(diff / 60000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function createAutopilotFailoverTabComponent(
  ctx: Context,
  groups: Record<string, CanonicalGroupDef>
) {
  const React = ctx.react;
  const h = React.createElement;

  return function AutopilotFailoverTab({
    models,
    disabledModels,
    vipPolicy,
    onUpdateVipPolicy,
    autopilotCfg,
    onUpdateAutopilotCfg,
    quarantines,
    onRefreshQuarantines,
    qualityBench,
    onUpdateQualityBench,
    failoverLog,
    onRefreshFailoverLog,
    rankingSnapshot,
    onNotify,
  }: {
    models: any[];
    disabledModels: string[];
    vipPolicy: VipPolicyConfig;
    onUpdateVipPolicy: (next: VipPolicyConfig) => void;
    autopilotCfg: AutopilotConfig;
    onUpdateAutopilotCfg: (next: AutopilotConfig) => void;
    quarantines: Record<string, QuarantineEntry>;
    onRefreshQuarantines: () => void;
    qualityBench: Record<string, QualityProbeResult>;
    onUpdateQualityBench: (next: Record<string, QualityProbeResult>) => void;
    failoverLog: FailoverEvent[];
    onRefreshFailoverLog: () => void;
    rankingSnapshot: ModelRankingSnapshot | null;
    onNotify: (msg: { type: "success" | "error" | "info"; text: string }) => void;
  }) {
    const [benchRunning, setBenchRunning] = React.useState(false);
    const [benchProgress, setBenchProgress] = React.useState("");
    const [failoverBusyAgent, setFailoverBusyAgent] = React.useState<string | null>(null);
    const [vipChainInput, setVipChainInput] = React.useState(() =>
      (vipPolicy.vipFallbackChain || []).join(", ")
    );

    React.useEffect(() => {
      setVipChainInput((vipPolicy.vipFallbackChain || []).join(", "));
    }, [vipPolicy.vipFallbackChain]);

    const buzzAgents = React.useMemo(() => {
      try {
        const snap = (ctx as any)?.agents?.snapshot?.() || {};
        const seen = new Set<string>();
        const list: any[] = [];
        for (const pool of [snap.running, snap.agents]) {
          if (!Array.isArray(pool)) continue;
          for (const a of pool) {
            if (!a?.key || seen.has(a.key)) continue;
            seen.add(a.key);
            list.push(a);
          }
        }
        return list.sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key)));
      } catch {
        return [];
      }
    }, [failoverLog.length, failoverBusyAgent]);

    const vipAgents = buzzAgents.filter((a) => isVipAgent(a.name || a.key, vipPolicy));
    const workerAgents = buzzAgents.filter((a) => !isVipAgent(a.name || a.key, vipPolicy));
    const quarantineList = Object.values(quarantines || {});
    const benchList = Object.values(qualityBench || {}).sort((a, b) => b.qualityScore - a.qualityScore);
    const toolOkCount = benchList.filter((b) => b.toolCallOk).length;

    const handleRunQualityBench = async (scope: "auto_top" | "vip_chain") => {
      setBenchRunning(true);
      try {
        let targetModels: string[] = [];
        if (scope === "vip_chain") {
          targetModels = Array.from(
            new Set([...(vipPolicy.vipFallbackChain || []), ...(vipPolicy.vipModels || [])])
          ).slice(0, 6);
        } else {
          const fromRank = (rankingSnapshot?.models || [])
            .filter((r) => r.accessMode === "auto" && !r.isDisabled)
            .slice(0, 8)
            .map((r) => r.model);
          targetModels =
            fromRank.length > 0
              ? fromRank
              : Object.values(groups)
                  .filter((g) => g.id !== "nexusmind_anthropic")
                  .map((g) => g.defaultModel);
        }

        if (targetModels.length === 0) {
          onNotify({ type: "info", text: "Nenhum modelo elegível encontrado para benchmark." });
          return;
        }

        const candidates = targetModels.map((m) => ({
          model: m,
          group: inferCanonicalGroupForModel(m, groups),
        }));

        setBenchProgress(`Testando 0/${candidates.length} (Tool-Calling + Stream)...`);
        const updated = await runBatchQualityBench(ctx, candidates, (done, total, latest) => {
          setBenchProgress(
            `${done}/${total} · ${latest.model} (${latest.online ? `Score ${latest.qualityScore}` : latest.errorKind})`
          );
        });
        onUpdateQualityBench(updated);
        onNotify({
          type: "success",
          text: `Benchmark de qualidade concluído (${candidates.length} modelos testados).`,
        });
      } finally {
        setBenchRunning(false);
        setBenchProgress("");
      }
    };

    const handleManualFailover = async (agent: any) => {
      setFailoverBusyAgent(agent.key);
      try {
        const evt = await executeAgentFailover(ctx, groups, {
          agentKeyOrName: agent.key,
          errorText: "Failover manual acionado no Cockpit NexusMind",
          trigger: "manual",
          rankingSnapshot,
          vipPolicy,
          qualityBench,
          disabledModels,
          wakeAfter: autopilotCfg.wakeOnFailover,
          notify: autopilotCfg.notifyOnFailover,
        });
        onRefreshQuarantines();
        onRefreshFailoverLog();
        onNotify({
          type: evt.applied ? "success" : "error",
          text: evt.applied
            ? `${evt.agentName}: ${evt.fromModel || "anterior"} → ${evt.toModel}`
            : evt.note || `Não foi possível trocar ${evt.agentName}.`,
        });
      } finally {
        setFailoverBusyAgent(null);
      }
    };

    const handleSaveVipChain = () => {
      const nextChain = vipChainInput
        .split(/[,\n]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      onUpdateVipPolicy({
        ...vipPolicy,
        vipFallbackChain: nextChain.length > 0 ? nextChain : vipPolicy.vipFallbackChain,
      });
      onNotify({ type: "success", text: `Cadeia VIP salva (${nextChain.length} modelos).` });
    };

    const handleQuickProtectVips = () => {
      const next = applyQuickVipPreset(vipPolicy, models);
      onUpdateVipPolicy(next);
      onNotify({
        type: "success",
        text: "Escudo VIP aplicado: Anthropic + GPT-6.1 Terra + modelos frontier travados para Iris e Conselho.",
      });
    };

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },

      // 1. KPI Strip do Autopiloto
      h(
        "div",
        { className: "nm-kpi-grid" },
        h(
          "div",
          { className: "nm-kpi-card" },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { className: "nm-kpi-label" }, "AUTOPILOTO FAILOVER"),
            h(
              "span",
              { className: "nm-pill", "data-tone": autopilotCfg.enabled ? "ok" : "warn" },
              autopilotCfg.enabled ? "ATIVO" : "PAUSADO"
            )
          ),
          h("div", { className: "nm-kpi-val" }, autopilotCfg.enabled ? "Vigilância 24/7" : "Manual"),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `Poll ${autopilotCfg.pollIntervalSec}s · ${failoverLog.length} eventos registrados`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "ESCUDO VIP (IRIS & CONSELHO)"),
          h("div", { className: "nm-kpi-val" }, `${vipAgents.length} VIP · ${workerAgents.length} Pool`),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `${vipPolicy.vipModels.length} modelos VIP · ${vipPolicy.blockedModels.length} bloqueados`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "CIRCUIT BREAKER (QUARENTENA)"),
          h(
            "div",
            { className: "nm-kpi-val", style: { color: quarantineList.length > 0 ? "var(--nm-danger)" : "var(--nm-ok)" } },
            `${quarantineList.length} isolado${quarantineList.length === 1 ? "" : "s"}`
          ),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            quarantineList.length > 0 ? "Auto-expira após TTL de cooldown" : "Nenhum modelo em quarentena"
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "BENCHMARK TOOL-CALLING"),
          h("div", { className: "nm-kpi-val" }, benchList.length > 0 ? `${toolOkCount}/${benchList.length} OK` : "Não rodado"),
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            benchProgress || "Valida tool_calls + stream + latência"
          )
        )
      ),

      // 2. Controles do Autopiloto + Ações Rápidas
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
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: autopilotCfg.enabled,
              onChange: (e: any) => onUpdateAutopilotCfg({ ...autopilotCfg, enabled: Boolean(e.target.checked) }),
            }),
            "Auto-Failover Inteligente"
          ),
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--nm-fg-secondary)", cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: autopilotCfg.wakeOnFailover,
              onChange: (e: any) => onUpdateAutopilotCfg({ ...autopilotCfg, wakeOnFailover: Boolean(e.target.checked) }),
            }),
            "Acordar agente após troca"
          ),
          h(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--nm-fg-secondary)", cursor: "pointer" } },
            h("input", {
              type: "checkbox",
              className: "nm-check",
              checked: vipPolicy.autoProtectAnthropic,
              onChange: (e: any) => onUpdateVipPolicy({ ...vipPolicy, autoProtectAnthropic: Boolean(e.target.checked) }),
            }),
            "Travar toda Anthropic como VIP"
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              onClick: handleQuickProtectVips,
            },
            "Proteger VIPs (1-clique)"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "primary",
              disabled: benchRunning,
              onClick: () => handleRunQualityBench("auto_top"),
            },
            benchRunning ? "Testando..." : "Rodar Bench Qualidade (Top 8)"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: benchRunning,
              onClick: () => handleRunQualityBench("vip_chain"),
            },
            "Testar Cadeia VIP"
          )
        )
      ),

      // 3. Quarentena / Circuit Breaker (se houver modelos isolados)
      quarantineList.length > 0 &&
        h(
          "div",
          { className: "nm-card" },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid var(--nm-border)",
              },
            },
            h("span", { style: { fontSize: "12px", fontWeight: 600, color: "var(--nm-danger)" } }, `Circuit Breaker — ${quarantineList.length} modelo(s) em quarentena`),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                onClick: () => {
                  releaseQuarantine();
                  onRefreshQuarantines();
                  onNotify({ type: "info", text: "Quarentena limpa para todos os modelos." });
                },
                style: { padding: "4px 9px", fontSize: "11px" },
              },
              "Liberar Todos"
            )
          ),
          quarantineList.map((q) =>
            h(
              "div",
              { key: q.model, className: "nm-list-row" },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "2px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h("span", { className: "nm-mono", style: { fontSize: "12px", fontWeight: 600 } }, q.model),
                  h("span", { className: "nm-pill", "data-tone": "danger" }, q.errorKind),
                  h("span", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, `expira em ${fmtRemaining(q.expiresAt)}`)
                ),
                h("div", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, `${q.reason}${q.lastAgent ? ` · ${q.lastAgent}` : ""}`)
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "nm-btn",
                  onClick: () => {
                    releaseQuarantine(q.model);
                    onRefreshQuarantines();
                  },
                  style: { padding: "4px 9px", fontSize: "11px" },
                },
                "Liberar"
              )
            )
          )
        ),

      // 4. Escudo VIP: Cadeia VIP + Agentes VIP vs Pool Automático
      h(
        "div",
        { className: "nm-card-pad", style: { display: "flex", flexDirection: "column", gap: "10px" } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
          h("span", { style: { fontSize: "12.5px", fontWeight: 600 } }, "Cadeia de Fallback Exclusiva VIP (Iris & Conselho)"),
          h("span", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, "Agentes VIP só trocam se falharem, e nunca caem para modelos fracos")
        ),
        h(
          "div",
          { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("input", {
            type: "text",
            className: "nm-input nm-mono",
            value: vipChainInput,
            onChange: (e: any) => setVipChainInput(e.target.value),
            placeholder: "claude-sonnet-4-6, claude-sonnet-5-5, claude-opus-4-6, gpt-6.1-terra",
            style: { flex: "1", minWidth: "260px" },
          }),
          h(
            "button",
            { type: "button", className: "nm-btn", "data-variant": "soft", onClick: handleSaveVipChain },
            "Salvar Cadeia VIP"
          )
        ),
        buzzAgents.length > 0 &&
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px" } },
            buzzAgents.map((a) => {
              const vip = isVipAgent(a.name || a.key, vipPolicy);
              return h(
                "div",
                {
                  key: a.key,
                  className: "nm-surface",
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    borderColor: vip ? "var(--nm-warn-border)" : "var(--nm-border)",
                  },
                },
                h("span", { style: { fontWeight: 600 } }, a.name || a.key),
                h("span", { className: "nm-mono", style: { fontSize: "10px", color: "var(--nm-muted)" } }, String(a.config?.model || "padrão").split("/").pop()),
                h(
                  "button",
                  {
                    type: "button",
                    className: "nm-pill",
                    "data-tone": vip ? "warn" : "info",
                    onClick: () => onUpdateVipPolicy(toggleVipAgent(vipPolicy, a.name || a.key)),
                    title: vip ? "Agente VIP protegido (clique para mover ao Pool Auto)" : "Agente no Pool Auto (clique para promover a VIP)",
                    style: { cursor: "pointer" },
                  },
                  vip ? "VIP" : "Pool"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "nm-btn",
                    "data-variant": "ghost",
                    disabled: failoverBusyAgent === a.key,
                    onClick: () => handleManualFailover(a),
                    title: "Forçar failover inteligente agora",
                    style: { padding: "1px 5px", fontSize: "10px" },
                  },
                  failoverBusyAgent === a.key ? "..." : "Trocar"
                )
              );
            })
          )
      ),

      // 5. Resultados do Benchmark de Qualidade (Tool-Calling + Stream)
      benchList.length > 0 &&
        h(
          "div",
          { className: "nm-card", style: { overflowX: "auto" } },
          h(
            "div",
            { style: { padding: "10px 14px", borderBottom: "1px solid var(--nm-border)", fontSize: "12px", fontWeight: 600 } },
            `Benchmark de Qualidade Real (${benchList.length} modelos testados)`
          ),
          h(
            "table",
            { className: "nm-table" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                ["Modelo", "Qualidade", "Tool-Call", "Stream", "Latência", "Status / Erro"].map((col) =>
                  h("th", { key: col }, col)
                )
              )
            ),
            h(
              "tbody",
              null,
              benchList.slice(0, 16).map((b) =>
                h(
                  "tr",
                  { key: b.model },
                  h("td", { className: "nm-mono", style: { fontWeight: 500 } }, b.model),
                  h(
                    "td",
                    { className: "nm-mono nm-num", style: { fontWeight: 700, color: b.qualityScore >= 75 ? "var(--nm-ok)" : b.qualityScore >= 40 ? "var(--nm-warn)" : "var(--nm-danger)" } },
                    `${b.qualityScore}/100`
                  ),
                  h(
                    "td",
                    null,
                    h("span", { className: "nm-pill", "data-tone": b.toolCallOk ? "ok" : "danger" }, b.toolCallOk ? "OK" : "Falhou")
                  ),
                  h(
                    "td",
                    null,
                    h("span", { className: "nm-pill", "data-tone": b.streamOk ? "ok" : "danger" }, b.streamOk ? "Íntegro" : "Corte")
                  ),
                  h("td", { className: "nm-mono nm-num", style: { color: "var(--nm-muted)" } }, b.latencyMs !== null ? `${b.latencyMs}ms` : "—"),
                  h("td", { style: { fontSize: "11px", color: b.online ? "var(--nm-muted)" : "var(--nm-danger)" } }, b.errorMsg || "Saudável")
                )
              )
            )
          )
        ),

      // 6. Histórico de Failovers
      h(
        "div",
        { className: "nm-card", style: { overflowX: "auto" } },
        h(
          "div",
          { style: { padding: "10px 14px", borderBottom: "1px solid var(--nm-border)", fontSize: "12px", fontWeight: 600 } },
          `Telemetria de Failovers (${failoverLog.length})`
        ),
        failoverLog.length === 0
          ? h(
              "div",
              { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--nm-muted)" } },
              "Nenhum failover disparado ainda. O watchdog monitora erros reais (404, weekly limit, stream ended, malformed_function_call) e troca automaticamente."
            )
          : h(
              "table",
              { className: "nm-table" },
              h(
                "thead",
                null,
                h("tr", null, ["Hora", "Agente", "Troca", "Erro", "Origem", "Resultado"].map((c) => h("th", { key: c }, c)))
              ),
              h(
                "tbody",
                null,
                failoverLog.slice(0, 15).map((ev) =>
                  h(
                    "tr",
                    { key: ev.id },
                    h("td", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, fmtTime(ev.timestamp)),
                    h(
                      "td",
                      null,
                      h("span", { style: { fontWeight: 600 } }, ev.agentName),
                      ev.isVip && h("span", { className: "nm-pill", "data-tone": "warn", style: { marginLeft: "6px", fontSize: "9.5px" } }, "VIP")
                    ),
                    h(
                      "td",
                      { className: "nm-mono", style: { fontSize: "11px" } },
                      `${ev.fromModel || "—"} → ${ev.toModel || "bloqueado"}`
                    ),
                    h("td", null, h("span", { className: "nm-pill", "data-tone": "danger" }, ev.errorKind)),
                    h("td", { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } }, ev.trigger),
                    h(
                      "td",
                      null,
                      h(
                        "span",
                        { className: "nm-pill", "data-tone": ev.applied ? "ok" : "warn" },
                        ev.applied ? (ev.wokeAgent ? "Aplicado + Wake" : "Aplicado") : "Protegido"
                      )
                    )
                  )
                )
              )
            )
      )
    );
  };
}
