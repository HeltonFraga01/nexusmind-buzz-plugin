/**
 * Serviço de controle e observabilidade do NexusMind Local Router (porta 4199).
 * 100% compatível com o manifest HTTPS-only do Buzz Desktop:
 * toda comunicação local usa ctx.host.spawn("python") + scripts/local_router.py CLI,
 * sem precisar declarar origens HTTP não-HTTPS em networkOrigins.
 */

export const LOCAL_ROUTER_HOST = "127.0.0.1";
export const LOCAL_ROUTER_PORT = 4199;
export const LOCAL_ROUTER_BASE_URL = `http://${LOCAL_ROUTER_HOST}:${LOCAL_ROUTER_PORT}`;
export const LOCAL_ROUTER_SCRIPT_PATH = "~/.buzz/REPOS/nexusmind-buzz-plugin/scripts/local_router.py";
export const LOCAL_ROUTER_TELEMETRY_PATH = "~/.buzz/.scratch/router-telemetry.jsonl";

export interface RouterCircuitInfo {
  remaining_sec: number;
  reason: string;
}

export interface RouterHealthResponse {
  online: boolean;
  service?: string;
  version?: string;
  pid?: number;
  uptime_sec?: number;
  stats?: {
    total_requests: number;
    ok_requests: number;
    fallback_recoveries: number;
    vip_sticky_recoveries?: number;
    failed_requests: number;
  };
  open_circuits: Record<string, RouterCircuitInfo>;
  open_provider_circuits: Record<string, RouterCircuitInfo>;
  vip_sticky_policy?: {
    tier: string;
    retries: number;
    delay_sec: number;
  };
  discovery_report?: {
    updatedAt?: string;
    totalCatalog4Apis?: number;
    activeCandidates?: number;
    testedNow?: number;
    approvedCount?: number;
    autoApprovedCount?: number;
    vipApprovedCount?: number;
    apis?: Array<{ provider: string; platform: string; online: boolean; rawCount: number; approvedCount?: number }>;
  } | null;
  tierFallbackGroups: Record<string, Array<{ model: string; provider: string; score?: number }>>;
  error?: string;
}

export interface RouterTelemetryEvent {
  ts: string;
  requested_model: string;
  actual_model: string | null;
  provider: string | null;
  hop: number;
  sticky_attempt?: number;
  status: number;
  stream?: boolean;
  latency_ms: number;
  total_latency_ms?: number;
  failed_attempts?: Array<{
    model: string;
    provider?: string;
    status: number;
    error?: string;
  }>;
}

export interface RouterMetricsResponse {
  online: boolean;
  window_size: number;
  ok_count: number;
  failed_count: number;
  success_rate_pct: number;
  hops_recovered: number;
  p50_latency_ms: number;
  by_tier: Record<string, number>;
  by_model: Record<string, number>;
  absorbed_errors: Record<string, number>;
  open_circuits: Record<string, RouterCircuitInfo>;
  open_provider_circuits: Record<string, RouterCircuitInfo>;
  recent_events: RouterTelemetryEvent[];
}

export interface TierProbeResult {
  tier: string;
  ok: boolean;
  status: number;
  actualModel: string | null;
  provider: string | null;
  hop: number;
  latencyMs: number;
  error?: string;
}

function parseJsonSafe(raw: string | undefined | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runRouterCliArgs(ctx: any, cliArgs: string[]): Promise<{ code: number; stdout: string }> {
  if (!ctx?.host?.spawn) {
    throw new Error("ctx.host.spawn indisponível neste runtime.");
  }
  const pyCode = [
    "import os, sys, subprocess",
    "script = os.path.expanduser('~/.buzz/REPOS/nexusmind-buzz-plugin/scripts/local_router.py')",
    `cmd = [sys.executable, script] + ${JSON.stringify(cliArgs)}`,
    "res = subprocess.run(cmd, capture_output=True, text=True)",
    "print(res.stdout or res.stderr)",
    "sys.exit(res.returncode)",
  ].join("\n");

  let stdout = "";
  const proc = await ctx.host.spawn("python", {
    args: [pyCode],
    onStdout: (chunk: string) => {
      stdout += chunk;
    },
  });
  const code = Number(await proc.exited);
  return { code, stdout: stdout.trim() };
}

export async function getRouterHealth(ctx: any): Promise<RouterHealthResponse> {
  try {
    const { stdout } = await runRouterCliArgs(ctx, ["--health-json"]);
    const wrap = parseJsonSafe(stdout);
    const data = wrap?.body;
    if (wrap?.ok && wrap?.status === 200 && data?.ok) {
      return {
        online: true,
        service: data.service,
        version: data.version || "2.0",
        pid: data.pid,
        uptime_sec: data.uptime_sec,
        stats: data.stats,
        open_circuits: data.open_circuits || {},
        open_provider_circuits: data.open_provider_circuits || {},
        vip_sticky_policy: data.vip_sticky_policy,
        discovery_report: data.discovery_report || null,
        tierFallbackGroups: data.tierFallbackGroups || {},
      };
    }
    return {
      online: false,
      open_circuits: {},
      open_provider_circuits: {},
      tierFallbackGroups: {},
      error: wrap?.error || "Roteador local offline na porta 4199",
    };
  } catch (err: any) {
    return {
      online: false,
      open_circuits: {},
      open_provider_circuits: {},
      tierFallbackGroups: {},
      error: err?.message || "Roteador local offline na porta 4199",
    };
  }
}

export async function getRouterMetrics(ctx: any): Promise<RouterMetricsResponse> {
  try {
    const { stdout } = await runRouterCliArgs(ctx, ["--metrics-json"]);
    const wrap = parseJsonSafe(stdout);
    const data = wrap?.body;
    if (wrap?.ok && wrap?.status === 200 && data?.ok) {
      return {
        online: true,
        window_size: Number(data.window_size || 0),
        ok_count: Number(data.ok_count || 0),
        failed_count: Number(data.failed_count || 0),
        success_rate_pct: Number(data.success_rate_pct ?? 100),
        hops_recovered: Number(data.hops_recovered || 0),
        p50_latency_ms: Number(data.p50_latency_ms || 0),
        by_tier: data.by_tier || {},
        by_model: data.by_model || {},
        absorbed_errors: data.absorbed_errors || {},
        open_circuits: data.open_circuits || {},
        open_provider_circuits: data.open_provider_circuits || {},
        recent_events: Array.isArray(data.recent_events) ? data.recent_events : [],
      };
    }
  } catch {}

  // Fallback offline: lê ~/.buzz/.scratch/router-telemetry.jsonl diretamente via host.readFile
  if (typeof ctx?.host?.readFile === "function") {
    for (const p of [
      LOCAL_ROUTER_TELEMETRY_PATH,
      "/Users/heltonfraga/.buzz/.scratch/router-telemetry.jsonl",
    ]) {
      try {
        const raw = await ctx.host.readFile(p);
        if (!raw) continue;
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        const lines = text.split("\n").filter((l) => l.trim().length > 0).slice(-300);
        const events: RouterTelemetryEvent[] = [];
        for (const l of lines) {
          const parsed = parseJsonSafe(l);
          if (parsed) events.push(parsed);
        }
        const okCount = events.filter((e) => Number(e.status) === 200).length;
        const hops = events.filter((e) => Number(e.status) === 200 && Number(e.hop) > 0).length;
        const lats = events.map((e) => Number(e.latency_ms || 0)).filter((n) => n > 0).sort((a, b) => a - b);
        const p50 = lats.length > 0 ? lats[Math.floor(lats.length / 2)] : 0;
        const byTier: Record<string, number> = {};
        const byModel: Record<string, number> = {};
        const absorbed: Record<string, number> = {};
        for (const ev of events) {
          const t = String(ev.requested_model || "unknown");
          byTier[t] = (byTier[t] || 0) + 1;
          if (ev.actual_model) {
            const mk = `${ev.actual_model} (${ev.provider || "nexusmind"})`;
            byModel[mk] = (byModel[mk] || 0) + 1;
          }
          for (const fa of ev.failed_attempts || []) {
            const ak = `${fa.model} HTTP ${fa.status}`;
            absorbed[ak] = (absorbed[ak] || 0) + 1;
          }
        }
        return {
          online: false,
          window_size: events.length,
          ok_count: okCount,
          failed_count: events.length - okCount,
          success_rate_pct: events.length > 0 ? Math.round((okCount / events.length) * 10000) / 100 : 100,
          hops_recovered: hops,
          p50_latency_ms: p50,
          by_tier: byTier,
          by_model: byModel,
          absorbed_errors: absorbed,
          open_circuits: {},
          open_provider_circuits: {},
          recent_events: events.slice(-20).reverse(),
        };
      } catch {}
    }
  }

  return {
    online: false,
    window_size: 0,
    ok_count: 0,
    failed_count: 0,
    success_rate_pct: 100,
    hops_recovered: 0,
    p50_latency_ms: 0,
    by_tier: {},
    by_model: {},
    absorbed_errors: {},
    open_circuits: {},
    open_provider_circuits: {},
    recent_events: [],
  };
}

export async function resetRouterCircuits(ctx: any): Promise<{ ok: boolean; message: string }> {
  try {
    const { stdout } = await runRouterCliArgs(ctx, ["--reset-circuits"]);
    const wrap = parseJsonSafe(stdout);
    const data = wrap?.body;
    if (wrap?.ok && wrap?.status === 200 && data?.ok) {
      return {
        ok: true,
        message: `Circuitos limpos: ${data.models_cleared ?? 0} modelo(s) e ${data.providers_cleared ?? 0} provedor(es).`,
      };
    }
    return { ok: false, message: wrap?.error || "Falha ao limpar circuitos." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Roteador local não respondeu." };
  }
}

export async function startOrRestartLocalRouter(ctx: any): Promise<{ ok: boolean; message: string }> {
  try {
    const { code } = await runRouterCliArgs(ctx, ["--start-daemon"]);
    if (code !== 0) {
      return { ok: false, message: `Falha ao iniciar roteador (exit ${code}).` };
    }
    await new Promise((r) => setTimeout(r, 900));
    const health = await getRouterHealth(ctx);
    if (health.online) {
      return {
        ok: true,
        message: `Roteador Local v${health.version || "2.0"} ativo na porta ${LOCAL_ROUTER_PORT} (PID ${health.pid || "-"}).`,
      };
    }
    return {
      ok: false,
      message: "Processo disparado, mas /health ainda não respondeu. Verifique ~/.buzz/.scratch/local-router.log.",
    };
  } catch (err: any) {
    return { ok: false, message: `Erro ao iniciar roteador: ${err?.message || String(err)}` };
  }
}

export async function stopLocalRouter(ctx: any): Promise<{ ok: boolean; message: string }> {
  try {
    const { code } = await runRouterCliArgs(ctx, ["--stop-daemon"]);
    return code === 0
      ? { ok: true, message: "Roteador local parado." }
      : { ok: false, message: `Falha ao parar roteador (exit ${code}).` };
  } catch (err: any) {
    return { ok: false, message: `Erro ao parar roteador: ${err?.message || String(err)}` };
  }
}

export async function registerRouterProviderViaPlugin(ctx: any): Promise<{ ok: boolean; message: string }> {
  try {
    const { code, stdout } = await runRouterCliArgs(ctx, ["--register-provider"]);
    if (code === 0) {
      return { ok: true, message: "Provedor nexusmind_router registrado no Goose e no Pi." };
    }
    return { ok: false, message: `Falha ao registrar provedor (exit ${code}): ${stdout.slice(0, 140)}` };
  } catch (err: any) {
    return { ok: false, message: `Erro ao registrar provedor: ${err?.message || String(err)}` };
  }
}

export async function runRouterDiscoveryEval(
  ctx: any,
  options: { maxModels?: number; force?: boolean } = {}
): Promise<{ ok: boolean; message: string; report?: any }> {
  try {
    const cliArgs = ["--discover-and-eval", "--max-models", String(options.maxModels ?? 80)];
    if (options.force) cliArgs.push("--force");
    const { code, stdout } = await runRouterCliArgs(ctx, cliArgs);
    const parsed = parseJsonSafe(stdout);
    if (code === 0 && parsed?.ok) {
      return {
        ok: true,
        report: parsed,
        message: `Descoberta 4 APIs concluída: ${parsed.totalCatalog4Apis ?? 0} modelos no catálogo, ${parsed.activeCandidates ?? 0} ativos, ${parsed.approvedCount ?? 0} aprovados (${parsed.autoApprovedCount ?? 0} Auto · ${parsed.vipApprovedCount ?? 0} VIP).`,
      };
    }
    return { ok: false, message: `Falha na descoberta/eval (exit ${code}): ${stdout.slice(0, 140)}` };
  } catch (err: any) {
    return { ok: false, message: `Erro ao descobrir/testar modelos: ${err?.message || String(err)}` };
  }
}

export async function installRouterLaunchAgent(ctx: any): Promise<{ ok: boolean; message: string }> {
  try {
    const { code, stdout } = await runRouterCliArgs(ctx, ["--install-launchagent"]);
    const parsed = parseJsonSafe(stdout);
    if (code === 0 && parsed?.ok) {
      return {
        ok: true,
        message: parsed.loaded
          ? `LaunchAgent instalado e ativo (${parsed.label}). Sobrevive a reinícios do Mac.`
          : `Plist gravado em ${parsed.plist_path}. Execute launchctl bootstrap se necessário.`,
      };
    }
    return { ok: false, message: `Falha ao instalar LaunchAgent (exit ${code}).` };
  } catch (err: any) {
    return { ok: false, message: `Erro ao instalar LaunchAgent: ${err?.message || String(err)}` };
  }
}

export async function testRouterTier(ctx: any, tierId: string): Promise<TierProbeResult> {
  const t0 = Date.now();
  try {
    const { stdout } = await runRouterCliArgs(ctx, ["--probe-tier", tierId]);
    const wrap = parseJsonSafe(stdout);
    const headers = wrap?.headers || {};
    return {
      tier: tierId,
      ok: Boolean(wrap?.ok && wrap?.status === 200),
      status: Number(wrap?.status || 0),
      actualModel: headers["x-nexusmind-actual-model"] || null,
      provider: headers["x-nexusmind-provider"] || null,
      hop: Number(headers["x-nexusmind-fallback-hop"] || 0),
      latencyMs: Number(wrap?.latency_ms || Date.now() - t0),
      error: wrap?.ok ? undefined : String(wrap?.error || `HTTP ${wrap?.status || "ERR"}`).slice(0, 140),
    };
  } catch (err: any) {
    return {
      tier: tierId,
      ok: false,
      status: 0,
      actualModel: null,
      provider: null,
      hop: 0,
      latencyMs: Date.now() - t0,
      error: err?.message || "Falha de comunicação com roteador local",
    };
  }
}
