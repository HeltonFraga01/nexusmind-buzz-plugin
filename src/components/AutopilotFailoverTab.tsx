// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND AUTOPILOT, VIP SHIELD & QUALITY BENCH TAB (v3.1 — Buzz Native)
// Painel agêntico de operação contínua do Gateway NexusMind:
//   1. Autopiloto & Watchdog ao vivo (detecção rápida + failover + wake)
//   2. Escudo VIP (Iris & Conselho protegidos; workers isolados no pool Auto)
//      + indicador ao vivo de saúde/Tool-Calling em cada chip de agente
//   3. Quarentena / Circuit Breaker (TTL automático + liberação em 1 clique)
//   4. Benchmark de Qualidade (Tool-Calling + Integridade + Latência) sem corte
//      oculto: Testar VIPs (reais + marcados + cadeia), Testar em Uso (todos os
//      agentes), Bench Pool Auto (Top 8) e Re-testar por linha + sync com OrgFy
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
  runModelQualityProbe,
  saveQualityBench,
  syncQualityBenchToOrgfyEval,
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

function isValidModelId(val: unknown): val is string {
  const s = String(val || "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return low !== "padrão" && low !== "padrao" && low !== "default" && low !== "none" && low !== "null";
}

function normalizeModelId(val: string): string {
  return String(val || "").trim().toLowerCase();
}

function uniqueModels(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (!isValidModelId(raw)) continue;
    const clean = raw.trim();
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
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
    const [benchScopeActive, setBenchScopeActive] = React.useState<string | null>(null);
    const [benchProgress, setBenchProgress] = React.useState("");
    const [singleTestingModel, setSingleTestingModel] = React.useState<string | null>(null);
    const [benchFilter, setBenchFilter] = React.useState<"all" | "vip" | "in_use" | "ok" | "issues">("all");
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

    // Mapa real de provedores a partir do catálogo e dos agentes ativos (evita erro de roteamento em modelos :free-high/-low)
    const providerHintByModel = React.useMemo(() => {
      const map = new Map<string, string>();
      for (const m of models || []) {
        const mid = String(m?.id || "").trim();
        const grp = m?.primaryGroup || (Array.isArray(m?.groups) ? m.groups[0] : undefined);
        if (mid && grp && groups[grp]) {
          map.set(mid.toLowerCase(), grp);
        }
      }
      for (const a of buzzAgents) {
        const mid = String(a?.config?.model || "").trim();
        const prov = String(a?.config?.provider || "").trim();
        if (isValidModelId(mid) && prov && groups[prov] && !map.has(mid.toLowerCase())) {
          map.set(mid.toLowerCase(), prov);
        }
      }
      return map;
    }, [models, buzzAgents]);

    const resolveGroupForModel = (modelId: string): CanonicalGroupDef => {
      const hinted = providerHintByModel.get(modelId.toLowerCase());
      if (hinted && groups[hinted]) return groups[hinted];
      // Evita jogar modelos OpenAI/OpenRouter (ex.: nous/...:free-high) para Antigravity por sufixo -high/-low
      if (modelId.includes("/") || modelId.toLowerCase().includes(":free")) {
        if (groups.nexusmind_openai) return groups.nexusmind_openai;
      }
      return inferCanonicalGroupForModel(modelId, groups);
    };

    // Conjuntos reais de modelos (VIPs ativos + marcados + cadeia, e todos os modelos em uso)
    const vipAgentActiveModels = React.useMemo(
      () => uniqueModels(vipAgents.map((a) => String(a?.config?.model || ""))),
      [vipAgents]
    );
    const allAgentActiveModels = React.useMemo(
      () => uniqueModels(buzzAgents.map((a) => String(a?.config?.model || ""))),
      [buzzAgents]
    );
    const allVipTargetModels = React.useMemo(
      () =>
        uniqueModels([
          ...vipAgentActiveModels,
          ...(vipPolicy.vipModels || []),
          ...(vipPolicy.vipFallbackChain || []),
        ]),
      [vipAgentActiveModels, vipPolicy.vipModels, vipPolicy.vipFallbackChain]
    );

    const vipModelSet = React.useMemo(
      () => new Set(allVipTargetModels.map(normalizeModelId)),
      [allVipTargetModels]
    );
    const inUseModelSet = React.useMemo(
      () => new Set(allAgentActiveModels.map(normalizeModelId)),
      [allAgentActiveModels]
    );

    const findBenchForModel = (rawModel: string | undefined): QualityProbeResult | null => {
      if (!isValidModelId(rawModel)) return null;
      const exact = qualityBench[rawModel.trim()];
      if (exact) return exact;
      const low = rawModel.trim().toLowerCase();
      const short = String(rawModel.split("/").pop() || rawModel).trim().toLowerCase();
      for (const [k, v] of Object.entries(qualityBench || {})) {
        const kl = k.toLowerCase();
        if (kl === low || kl === short || String(k.split("/").pop() || k).toLowerCase() === short) {
          return v;
        }
      }
      return null;
    };

    const quarantineList = Object.values(quarantines || {});
    const benchList = Object.values(qualityBench || {}).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.toolCallOk !== b.toolCallOk) return a.toolCallOk ? -1 : 1;
      return b.qualityScore - a.qualityScore;
    });
    const toolOkCount = benchList.filter((b) => b.online && b.toolCallOk).length;
    const benchIssuesCount = benchList.filter((b) => !b.online || !b.toolCallOk).length;
    const benchVipCount = benchList.filter((b) => vipModelSet.has(normalizeModelId(b.model))).length;
    const benchInUseCount = benchList.filter((b) => inUseModelSet.has(normalizeModelId(b.model))).length;

    const filteredBenchList = React.useMemo(() => {
      return benchList.filter((b) => {
        if (benchFilter === "vip") return vipModelSet.has(normalizeModelId(b.model));
        if (benchFilter === "in_use") return inUseModelSet.has(normalizeModelId(b.model));
        if (benchFilter === "ok") return b.online && b.toolCallOk;
        if (benchFilter === "issues") return !b.online || !b.toolCallOk;
        return true;
      });
    }, [benchList, benchFilter, vipModelSet, inUseModelSet]);

    const handleRunQualityBench = async (scope: "vip_all" | "in_use" | "auto_top") => {
      setBenchRunning(true);
      setBenchScopeActive(scope);
      try {
        let targetModels: string[] = [];
        let scopeLabel = "";
        if (scope === "vip_all") {
          targetModels = allVipTargetModels;
          scopeLabel = "VIPs (agentes VIP + marcados + cadeia)";
        } else if (scope === "in_use") {
          targetModels = allAgentActiveModels;
          scopeLabel = "modelos em uso nos agentes";
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
          scopeLabel = "Pool Auto (Top 8)";
        }

        if (targetModels.length === 0) {
          onNotify({ type: "info", text: `Nenhum modelo encontrado para testar em ${scopeLabel}.` });
          return;
        }

        const candidates = targetModels.map((m) => ({
          model: m,
          group: resolveGroupForModel(m),
        }));

        if (scope === "vip_all") setBenchFilter("vip");
        else if (scope === "in_use") setBenchFilter("in_use");
        else setBenchFilter("all");

        setBenchProgress(`Testando 0/${candidates.length} (${scopeLabel})...`);
        const updated = await runBatchQualityBench(ctx, candidates, (done, total, latest) => {
          setBenchProgress(
            `${done}/${total} · ${latest.model} (${
              latest.online ? (latest.toolCallOk ? `TC OK · ${latest.qualityScore}` : `Sem TC · ${latest.qualityScore}`) : latest.errorKind
            })`
          );
        });
        onUpdateQualityBench(updated);
        await syncQualityBenchToOrgfyEval(ctx, updated);

        const testedResults = targetModels.map((m) => updated[m]).filter(Boolean);
        const okTc = testedResults.filter((r) => r.online && r.toolCallOk).length;
        const failed = testedResults.filter((r) => !r.online || !r.toolCallOk).length;
        onNotify({
          type: failed > 0 ? "info" : "success",
          text: `Bench ${scopeLabel}: ${okTc}/${testedResults.length} OK em Tool-Calling${failed > 0 ? ` · ${failed} com falha` : ""}. Ranking e OrgFy sincronizados.`,
        });
      } finally {
        setBenchRunning(false);
        setBenchScopeActive(null);
        setBenchProgress("");
      }
    };

    const handleTestSingleBenchModel = async (modelId: string) => {
      setSingleTestingModel(modelId);
      try {
        const grp = resolveGroupForModel(modelId);
        const res = await runModelQualityProbe(ctx, modelId, grp);
        const next = { ...(qualityBench || {}), [modelId]: res };
        await saveQualityBench(ctx, next);
        await syncQualityBenchToOrgfyEval(ctx, next);
        onUpdateQualityBench(next);
        onNotify({
          type: res.online && res.toolCallOk ? "success" : "error",
          text:
            res.online && res.toolCallOk
              ? `${modelId}: OK (Tool-Calling + ${res.latencyMs}ms · ${res.qualityScore}/100).`
              : `${modelId}: ${res.errorMsg || res.errorKind} (${res.qualityScore}/100).`,
        });
      } finally {
        setSingleTestingModel(null);
      }
    };

    const handleClearBenchHistory = async () => {
      await saveQualityBench(ctx, {});
      onUpdateQualityBench({});
      onNotify({ type: "info", text: "Histórico do benchmark limpo." });
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
            `${allVipTargetModels.length} modelos VIP (${vipAgentActiveModels.length} em uso · ${vipPolicy.vipModels.length} marcados)`
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
            benchProgress || (benchIssuesCount > 0 ? `${benchIssuesCount} modelo(s) com erro ou sem TC` : "Valida tool_calls + stream + latência")
          )
        )
      ),

      // 2. Controles do Autopiloto + Ações Rápidas (com escopos claros e contagens reais)
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
              "data-bench-vip-all": "true",
              disabled: benchRunning || allVipTargetModels.length === 0,
              onClick: () => handleRunQualityBench("vip_all"),
              title: `Testa todos os ${allVipTargetModels.length} modelos VIP: modelos atuais dos agentes VIP + marcados como VIP + cadeia de fallback`,
            },
            benchRunning && benchScopeActive === "vip_all"
              ? "Testando VIPs..."
              : `Testar VIPs (${allVipTargetModels.length})`
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "soft",
              "data-bench-in-use": "true",
              disabled: benchRunning || allAgentActiveModels.length === 0,
              onClick: () => handleRunQualityBench("in_use"),
              title: `Testa todos os ${allAgentActiveModels.length} modelos distintos configurados nos agentes do Buzz agora`,
            },
            benchRunning && benchScopeActive === "in_use"
              ? "Testando em uso..."
              : `Testar em Uso (${allAgentActiveModels.length})`
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: benchRunning,
              onClick: () => handleRunQualityBench("auto_top"),
              title: "Testa os 8 melhores candidatos do pool automático para workers",
            },
            benchRunning && benchScopeActive === "auto_top"
              ? "Testando Pool..."
              : "Bench Pool Auto (Top 8)"
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

      // 4. Escudo VIP: Cadeia VIP + Agentes VIP vs Pool Automático (com status ao vivo do bench por agente)
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
        allVipTargetModels.length > 0 &&
          h(
            "div",
            { style: { fontSize: "11px", color: "var(--nm-muted)", lineHeight: "1.45" } },
            h("strong", { style: { color: "var(--nm-fg-secondary)", fontWeight: 600 } }, `Modelos incluídos em "Testar VIPs (${allVipTargetModels.length})": `),
            h("span", { className: "nm-mono" }, allVipTargetModels.join(" · "))
          ),
        buzzAgents.length > 0 &&
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px" } },
            buzzAgents.map((a) => {
              const vip = isVipAgent(a.name || a.key, vipPolicy);
              const rawModel = String(a.config?.model || "padrão");
              const shortModel = rawModel.split("/").pop() || rawModel;
              const bench = findBenchForModel(rawModel);
              const healthDotColor = !bench
                ? null
                : !bench.online
                ? "var(--nm-danger)"
                : bench.toolCallOk
                ? "var(--nm-ok)"
                : "var(--nm-warn)";
              const healthTitle = !bench
                ? "Modelo ainda não testado no Bench"
                : !bench.online
                ? `Falha no Bench: ${bench.errorMsg || bench.errorKind}`
                : bench.toolCallOk
                ? `Bench OK · Tool-Calling válido (${bench.latencyMs ?? "?"}ms · ${bench.qualityScore}/100)`
                : `Respondeu mas falhou em Tool-Calling (${bench.qualityScore}/100)`;

              return h(
                "div",
                {
                  key: a.key,
                  className: "nm-surface",
                  title: healthTitle,
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    borderColor:
                      bench && (!bench.online || !bench.toolCallOk)
                        ? "var(--nm-danger)"
                        : vip
                        ? "var(--nm-warn-border)"
                        : "var(--nm-border)",
                  },
                },
                healthDotColor &&
                  h("span", {
                    style: {
                      width: "7px",
                      height: "7px",
                      borderRadius: "999px",
                      backgroundColor: healthDotColor,
                      flexShrink: 0,
                    },
                  }),
                h("span", { style: { fontWeight: 600 } }, a.name || a.key),
                h("span", { className: "nm-mono", style: { fontSize: "10px", color: "var(--nm-muted)" } }, shortModel),
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

      // 5. Resultados do Benchmark de Qualidade (Tool-Calling + Stream + Filtros + Re-testar)
      benchList.length > 0 &&
        h(
          "div",
          { className: "nm-card", style: { overflowX: "auto" } },
          h(
            "div",
            {
              style: {
                padding: "10px 14px",
                borderBottom: "1px solid var(--nm-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
              h("span", { style: { fontSize: "12px", fontWeight: 600 } }, `Benchmark de Qualidade Real (${filteredBenchList.length}/${benchList.length})`),
              h(
                "div",
                { className: "nm-segmented" },
                ([
                  { id: "all", label: `Todos (${benchList.length})` },
                  { id: "vip", label: `VIPs (${benchVipCount})` },
                  { id: "in_use", label: `Em uso (${benchInUseCount})` },
                  { id: "ok", label: `TC OK (${toolOkCount})` },
                  { id: "issues", label: `Com problema (${benchIssuesCount})` },
                ] as const).map((tab) =>
                  h(
                    "button",
                    {
                      key: tab.id,
                      type: "button",
                      className: "nm-seg-btn",
                      "data-active": benchFilter === tab.id ? "true" : "false",
                      onClick: () => setBenchFilter(tab.id),
                      style: { fontSize: "10.5px", padding: "3px 7px" },
                    },
                    tab.label
                  )
                )
              )
            ),
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                "data-variant": "ghost",
                onClick: handleClearBenchHistory,
                style: { fontSize: "11px", padding: "3px 8px" },
              },
              "Limpar histórico"
            )
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
                ["Modelo", "Escopo", "Qualidade", "Tool-Call", "Stream", "Latência", "Status / Erro", "Ação"].map((col) =>
                  h("th", { key: col }, col)
                )
              )
            ),
            h(
              "tbody",
              null,
              filteredBenchList.length === 0
                ? h(
                    "tr",
                    null,
                    h("td", { colSpan: 8, style: { padding: "18px", textAlign: "center", color: "var(--nm-muted)", fontSize: "11.5px" } }, "Nenhum modelo testado neste filtro.")
                  )
                : filteredBenchList.slice(0, 30).map((b) => {
                    const isVipM = vipModelSet.has(normalizeModelId(b.model));
                    const isInUseM = inUseModelSet.has(normalizeModelId(b.model));
                    const isTestingThis = singleTestingModel === b.model;
                    return h(
                      "tr",
                      { key: b.model },
                      h(
                        "td",
                        { className: "nm-mono", style: { fontWeight: 500 } },
                        h("span", null, b.model),
                        h(
                          "span",
                          { style: { marginLeft: "6px", fontSize: "10px", color: "var(--nm-muted)" } },
                          String(b.group || "").replace("nexusmind_", "")
                        )
                      ),
                      h(
                        "td",
                        null,
                        h(
                          "div",
                          { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
                          isVipM && h("span", { className: "nm-pill", "data-tone": "warn", style: { fontSize: "9.5px" } }, "VIP"),
                          isInUseM && h("span", { className: "nm-pill", "data-tone": "info", style: { fontSize: "9.5px" } }, "Em uso"),
                          !isVipM && !isInUseM && h("span", { style: { fontSize: "10px", color: "var(--nm-muted)" } }, "Pool")
                        )
                      ),
                      h(
                        "td",
                        {
                          className: "nm-mono nm-num",
                          style: {
                            fontWeight: 700,
                            color: b.qualityScore >= 75 ? "var(--nm-ok)" : b.qualityScore >= 40 ? "var(--nm-warn)" : "var(--nm-danger)",
                          },
                        },
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
                      h("td", { style: { fontSize: "11px", color: b.online ? "var(--nm-muted)" : "var(--nm-danger)" } }, b.errorMsg || "Saudável"),
                      h(
                        "td",
                        null,
                        h(
                          "button",
                          {
                            type: "button",
                            className: "nm-btn",
                            disabled: isTestingThis || benchRunning,
                            onClick: () => handleTestSingleBenchModel(b.model),
                            style: { padding: "3px 7px", fontSize: "10px" },
                          },
                          isTestingThis ? "..." : "Re-testar"
                        )
                      )
                    );
                  })
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
