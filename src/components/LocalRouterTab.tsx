import type { Context } from "@buzz/author";
import {
  LOCAL_ROUTER_BASE_URL,
  type RouterHealthResponse,
  type RouterMetricsResponse,
  type TierProbeResult,
  getRouterHealth,
  getRouterMetrics,
  installRouterLaunchAgent,
  registerRouterProviderViaPlugin,
  resetRouterCircuits,
  startOrRestartLocalRouter,
  stopLocalRouter,
  testRouterTier,
} from "../services/local-router";

const TIER_DISPLAY: Array<{ alias: string; groupKey: string; label: string; badge?: string }> = [
  { alias: "tier/vip-iris", groupKey: "group/vip-iris", label: "VIP Iris (CEO)", badge: "Sticky Retry 2×5s" },
  { alias: "tier/diretoria", groupKey: "group/vip-leadership", label: "Diretoria & Conselho" },
  { alias: "tier/frontier", groupKey: "group/frontier", label: "Frontier / Arquitetura" },
  { alias: "tier/reasoning", groupKey: "group/reasoning", label: "Raciocínio / QA" },
  { alias: "tier/code", groupKey: "group/code", label: "Código / Dev" },
  { alias: "tier/fast", groupKey: "group/fast", label: "Rápido / Operações" },
];

function formatUptime(sec?: number): string {
  if (!sec || sec < 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatShortTime(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(11, 19) || "—";
  }
}

export function createLocalRouterTabComponent(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  return function LocalRouterTab(props: {
    onNotify?: (msg: { type: "success" | "error" | "info"; text: string }) => void;
  }) {
    const [health, setHealth] = React.useState<RouterHealthResponse | null>(null);
    const [metrics, setMetrics] = React.useState<RouterMetricsResponse | null>(null);
    const [busyAction, setBusyAction] = React.useState<string | null>(null);
    const [tierProbes, setTierProbes] = React.useState<Record<string, TierProbeResult>>({});
    const [testingTier, setTestingTier] = React.useState<string | null>(null);

    const refreshAll = React.useCallback(async () => {
      const [hRes, mRes] = await Promise.all([getRouterHealth(ctx), getRouterMetrics(ctx)]);
      setHealth(hRes);
      setMetrics(mRes);
    }, []);

    React.useEffect(() => {
      void refreshAll();
      const timer = setInterval(() => {
        void refreshAll();
      }, 8000);
      return () => clearInterval(timer);
    }, [refreshAll]);

    const runAction = async (
      actionId: string,
      fn: () => Promise<{ ok: boolean; message: string }>
    ) => {
      setBusyAction(actionId);
      try {
        const res = await fn();
        props.onNotify?.({ type: res.ok ? "success" : "error", text: res.message });
        await refreshAll();
      } finally {
        setBusyAction(null);
      }
    };

    const handleProbeTier = async (tierAlias: string) => {
      setTestingTier(tierAlias);
      try {
        const res = await testRouterTier(ctx, tierAlias);
        setTierProbes((prev) => ({ ...prev, [tierAlias]: res }));
        props.onNotify?.({
          type: res.ok ? "success" : "error",
          text: res.ok
            ? `${tierAlias} → ${res.actualModel || "OK"} (${res.provider || "router"}, hop ${res.hop}, ${res.latencyMs}ms)`
            : `${tierAlias} falhou: ${res.error || `HTTP ${res.status}`}`,
        });
        await refreshAll();
      } finally {
        setTestingTier(null);
      }
    };

    const isOnline = Boolean(health?.online);
    const openModelCircuits = health?.open_circuits || {};
    const openProviderCircuits = health?.open_provider_circuits || {};
    const totalOpenCircuits =
      Object.keys(openModelCircuits).length + Object.keys(openProviderCircuits).length;
    const absorbedEntries = Object.entries(metrics?.absorbed_errors || {});
    const totalAbsorbed = absorbedEntries.reduce((acc, [, n]) => acc + Number(n || 0), 0);

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "14px" } },

      // 1. Barra de Controle do Daemon Local
      h(
        "div",
        {
          className: "nm-surface",
          style: {
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
          h(
            "span",
            {
              className: "nm-pill",
              "data-tone": isOnline ? "ok" : "err",
              style: { fontSize: "11px", fontWeight: 600 },
            },
            isOnline ? "Online" : "Offline"
          ),
          h(
            "span",
            { className: "nm-mono", style: { fontSize: "12px", fontWeight: 600, color: "var(--nm-fg)" } },
            LOCAL_ROUTER_BASE_URL
          ),
          isOnline &&
            h(
              "span",
              { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } },
              `v${health?.version || "2.0"} · PID ${health?.pid || "—"} · Uptime ${formatUptime(health?.uptime_sec)}`
            )
        ),
        h(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "primary",
              disabled: busyAction !== null,
              onClick: () => runAction("start", () => startOrRestartLocalRouter(ctx)),
            },
            busyAction === "start" ? "Iniciando..." : isOnline ? "Reiniciar" : "Iniciar Roteador"
          ),
          isOnline &&
            h(
              "button",
              {
                type: "button",
                className: "nm-btn",
                disabled: busyAction !== null,
                onClick: () => runAction("stop", () => stopLocalRouter(ctx)),
              },
              busyAction === "stop" ? "Parando..." : "Parar"
            ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: busyAction !== null || !isOnline,
              onClick: () => runAction("reset", () => resetRouterCircuits(ctx)),
            },
            busyAction === "reset" ? "Limpando..." : "Resetar Circuitos"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: busyAction !== null,
              onClick: () => runAction("register", () => registerRouterProviderViaPlugin(ctx)),
            },
            busyAction === "register" ? "Registrando..." : "Registrar Goose & Pi"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              disabled: busyAction !== null,
              onClick: () => runAction("launchagent", () => installRouterLaunchAgent(ctx)),
            },
            busyAction === "launchagent" ? "Instalando..." : "Auto-Start macOS"
          ),
          h(
            "button",
            {
              type: "button",
              className: "nm-btn",
              "data-variant": "ghost",
              onClick: () => void refreshAll(),
            },
            "Atualizar"
          )
        )
      ),

      // 2. KPI Strip (4 cards)
      h(
        "div",
        { className: "nm-kpi-grid" },
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "TAXA DE SUCESSO"),
          h(
            "div",
            { className: "nm-kpi-val" },
            `${(metrics?.success_rate_pct ?? 100).toFixed(1)}%`
          ),
          h(
            "div",
            { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `${metrics?.ok_count ?? 0}/${metrics?.window_size ?? 0} HTTP 200 · ${metrics?.failed_count ?? 0} falhas`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "RECUPERAÇÕES EM VOO"),
          h("div", { className: "nm-kpi-val" }, String(metrics?.hops_recovered ?? 0)),
          h(
            "div",
            { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `${totalAbsorbed} erro(s) upstream absorvidos`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "LATÊNCIA MEDIANA (P50)"),
          h(
            "div",
            { className: "nm-kpi-val" },
            metrics?.p50_latency_ms ? `${(metrics.p50_latency_ms / 1000).toFixed(2)}s` : "—"
          ),
          h(
            "div",
            { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `SSE Keepalive 15s · Hot-path determinístico`
          )
        ),
        h(
          "div",
          { className: "nm-kpi-card" },
          h("span", { className: "nm-kpi-label" }, "CIRCUITOS ABERTOS"),
          h("div", { className: "nm-kpi-val" }, String(totalOpenCircuits)),
          h(
            "div",
            { className: "nm-num", style: { fontSize: "11px", color: "var(--nm-muted)" } },
            `${Object.keys(openModelCircuits).length} modelo(s) · ${Object.keys(openProviderCircuits).length} provedor(es)`
          )
        )
      ),

      // 3. Circuitos Abertos (apenas se houver algum em cooldown)
      totalOpenCircuits > 0 &&
        h(
          "div",
          {
            className: "nm-surface",
            style: {
              padding: "12px 14px",
              borderColor: "var(--nm-warn-border)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            },
          },
          h(
            "div",
            { style: { fontSize: "12px", fontWeight: 600, color: "var(--nm-warn)" } },
            "Circuit Breakers Ativos (Cooldown 180s)"
          ),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
            ...Object.entries(openProviderCircuits).map(([prov, info]) =>
              h(
                "span",
                {
                  key: `prov-${prov}`,
                  className: "nm-pill",
                  "data-tone": "err",
                  title: info.reason,
                },
                `PROVEDOR ${prov} · ${Math.round(info.remaining_sec)}s`
              )
            ),
            ...Object.entries(openModelCircuits).map(([mod, info]) =>
              h(
                "span",
                {
                  key: `mod-${mod}`,
                  className: "nm-pill",
                  "data-tone": "warn",
                  title: info.reason,
                },
                `${mod} · ${Math.round(info.remaining_sec)}s`
              )
            )
          )
        ),

      // 4. Escadas Ativas por Tier (Top-5 do Control Plane)
      h(
        "div",
        {
          className: "nm-surface",
          style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h(
            "span",
            { style: { fontSize: "13px", fontWeight: 600, color: "var(--nm-fg)" } },
            "Escadas de Failover por Tier (model-control-plane.json)"
          ),
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--nm-muted)" } },
            "Priority routing (preserva Prompt Cache) · Intercalação entre provedores"
          )
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          TIER_DISPLAY.map((tier) => {
            const ladder = health?.tierFallbackGroups?.[tier.groupKey] || [];
            const probe = tierProbes[tier.alias];
            const isTesting = testingTier === tier.alias;
            return h(
              "div",
              {
                key: tier.alias,
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "9px 11px",
                  borderRadius: "8px",
                  backgroundColor: "var(--surface-inset, #101010)",
                  border: "1px solid var(--border-primary, #2a2a2a)",
                },
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "5px", minWidth: "220px", flex: 1 } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                  h(
                    "code",
                    { className: "nm-mono", style: { fontSize: "12px", fontWeight: 600, color: "var(--nm-fg)" } },
                    tier.alias
                  ),
                  h("span", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, tier.label),
                  tier.badge &&
                    h(
                      "span",
                      { className: "nm-pill", "data-tone": "accent", style: { fontSize: "10px" } },
                      tier.badge
                    )
                ),
                h(
                  "div",
                  { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
                  ladder.length === 0
                    ? h("span", { style: { fontSize: "11px", color: "var(--nm-muted)" } }, "Aguardando Control Plane...")
                    : ladder.slice(0, 5).map((item, idx) => {
                        const modOpen = Boolean(openModelCircuits[item.model.toLowerCase()]);
                        const provOpen = Boolean(openProviderCircuits[item.provider.toLowerCase()]);
                        const tone = modOpen || provOpen ? "warn" : idx === 0 ? "ok" : undefined;
                        return h(
                          "span",
                          {
                            key: `${tier.alias}-${item.model}`,
                            className: "nm-pill nm-mono",
                            "data-tone": tone,
                            style: { fontSize: "10.5px" },
                            title: `${item.provider}${modOpen ? " (circuito modelo aberto)" : provOpen ? " (circuito provedor aberto)" : ""}`,
                          },
                          `#${idx + 1} ${item.model}`
                        );
                      })
                )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                probe &&
                  h(
                    "span",
                    {
                      className: "nm-pill nm-mono",
                      "data-tone": probe.ok ? "ok" : "err",
                      style: { fontSize: "10.5px" },
                    },
                    probe.ok
                      ? `${probe.actualModel || "OK"} · hop ${probe.hop} · ${probe.latencyMs}ms`
                      : `HTTP ${probe.status || "ERR"}`
                  ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "nm-btn",
                    disabled: !isOnline || isTesting,
                    onClick: () => void handleProbeTier(tier.alias),
                    style: { fontSize: "11px", padding: "4px 10px" },
                  },
                  isTesting ? "Testando..." : "Testar"
                )
              )
            );
          })
        )
      ),

      // 5. Telemetria Recente (Últimas Requisições)
      h(
        "div",
        {
          className: "nm-surface",
          style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" },
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h(
            "span",
            { style: { fontSize: "13px", fontWeight: 600, color: "var(--nm-fg)" } },
            "Últimas Requisições no Roteador"
          ),
          absorbedEntries.length > 0 &&
            h(
              "span",
              { className: "nm-mono", style: { fontSize: "11px", color: "var(--nm-muted)" } },
              `Erros absorvidos: ${absorbedEntries.slice(0, 3).map(([k, v]) => `${k} (${v}×)`).join(" · ")}`
            )
        ),
        (metrics?.recent_events || []).length === 0
          ? h(
              "div",
              { style: { fontSize: "12px", color: "var(--nm-muted)", padding: "12px 0" } },
              "Nenhuma requisição registrada ainda em router-telemetry.jsonl."
            )
          : h(
              "div",
              { style: { overflowX: "auto" } },
              h(
                "table",
                { style: { width: "100%", borderCollapse: "collapse", fontSize: "11.5px" } },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    { style: { textAlign: "left", color: "var(--nm-muted)", borderBottom: "1px solid var(--border-primary, #2e2e2e)" } },
                    ["Hora", "Tier", "Modelo Real", "Provedor", "Hop", "Status", "Latência"].map((col) =>
                      h("th", { key: col, style: { padding: "6px 8px", fontWeight: 500 } }, col)
                    )
                  )
                ),
                h(
                  "tbody",
                  null,
                  (metrics?.recent_events || []).slice(0, 15).map((ev, idx) =>
                    h(
                      "tr",
                      {
                        key: `${ev.ts}-${idx}`,
                        style: { borderBottom: "1px solid var(--border-primary, #222222)" },
                      },
                      h("td", { className: "nm-mono", style: { padding: "6px 8px", color: "var(--nm-muted)" } }, formatShortTime(ev.ts)),
                      h("td", { className: "nm-mono", style: { padding: "6px 8px", color: "var(--nm-fg)" } }, ev.requested_model),
                      h("td", { className: "nm-mono", style: { padding: "6px 8px", color: "var(--nm-fg-secondary)" } }, ev.actual_model || "—"),
                      h("td", { className: "nm-mono", style: { padding: "6px 8px", color: "var(--nm-muted)" } }, ev.provider || "—"),
                      h(
                        "td",
                        { style: { padding: "6px 8px" } },
                        h(
                          "span",
                          {
                            className: "nm-pill nm-mono",
                            "data-tone": ev.hop > 0 ? "warn" : "ok",
                            style: { fontSize: "10px" },
                          },
                          ev.sticky_attempt && ev.sticky_attempt > 0
                            ? `sticky #${ev.sticky_attempt}`
                            : `hop ${ev.hop}`
                        )
                      ),
                      h(
                        "td",
                        { style: { padding: "6px 8px" } },
                        h(
                          "span",
                          {
                            className: "nm-pill nm-mono",
                            "data-tone": ev.status === 200 ? "ok" : "err",
                            style: { fontSize: "10px" },
                          },
                          String(ev.status)
                        )
                      ),
                      h(
                        "td",
                        { className: "nm-mono nm-num", style: { padding: "6px 8px", color: "var(--nm-muted)" } },
                        `${ev.latency_ms}ms`
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
