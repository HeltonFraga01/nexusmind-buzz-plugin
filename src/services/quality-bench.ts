// ─────────────────────────────────────────────────────────────────────────────
// NEXUSMIND QUALITY BENCH & TOOL-CALLING PROBE ENGINE (v3.0)
// Testa qualidade real dos modelos no Gateway muito além de HTTP 200:
//   1. Tool-Calling Fidelity: verifica se o modelo emite tool_calls / tool_use
//      válido com argumentos JSON bem-formados (sem upstream_malformed_function_call)
//   2. Stream & Completion Integrity: valida resposta não-vazia sem corte de stream
//   3. Latency (ms) + Classificação exata de erros (weekly_limit, 404, malformed_tool,
//      stream_cut, rate_limit, 5xx, timeout)
// ─────────────────────────────────────────────────────────────────────────────

import type { Context } from "@buzz/author";
import type { CanonicalGroupDef } from "./smart-router";

export type GatewayErrorKind =
  | "ok"
  | "weekly_limit"
  | "rate_limit"
  | "not_found"
  | "malformed_tool"
  | "stream_cut"
  | "auth_error"
  | "server_error"
  | "timeout"
  | "unknown";

export interface QualityProbeResult {
  model: string;
  group: string;
  testedAt: string;
  online: boolean;
  toolCallOk: boolean;
  streamOk: boolean;
  latencyMs: number | null;
  qualityScore: number; // 0..100
  errorKind: GatewayErrorKind;
  errorMsg?: string;
}

export const LOCAL_STORAGE_QUALITY_BENCH_KEY = "nexusmind_quality_bench_v1";
export const SHARED_QUALITY_BENCH_PATH = "/Users/heltonfraga/.buzz/.scratch/nexusmind-quality-bench.json";

export function classifyGatewayError(errorText: string, httpStatus?: number): GatewayErrorKind {
  const txt = String(errorText || "").toLowerCase();
  if (txt.includes("weekly limit") || (txt.includes("limit") && txt.includes("resets"))) {
    return "weekly_limit";
  }
  if (
    txt.includes("malformed_function_call") ||
    txt.includes("malformed function") ||
    txt.includes("invalid tool") ||
    txt.includes("tool_use") && txt.includes("invalid")
  ) {
    return "malformed_tool";
  }
  if (
    txt.includes("stream ended") ||
    txt.includes("upstream response stream") ||
    txt.includes("unexpected eof") ||
    txt.includes("premature close")
  ) {
    return "stream_cut";
  }
  if (httpStatus === 404 || txt.includes("resource not found") || txt.includes("(404)") || txt.includes("model not found")) {
    return "not_found";
  }
  if (httpStatus === 429 || txt.includes("429") || txt.includes("rate limit") || txt.includes("too many requests") || txt.includes("quota")) {
    return "rate_limit";
  }
  if (httpStatus === 401 || httpStatus === 403 || txt.includes("unauthorized") || txt.includes("invalid api key") || txt.includes("forbidden")) {
    return "auth_error";
  }
  if (txt.includes("timeout") || txt.includes("timed out") || txt.includes("aborted") || txt.includes("etimedout")) {
    return "timeout";
  }
  if ((typeof httpStatus === "number" && httpStatus >= 500) || /\b50[0234]\b/.test(txt) || txt.includes("server error") || txt.includes("bad gateway")) {
    return "server_error";
  }
  return "unknown";
}

export function loadSavedQualityBench(): Record<string, QualityProbeResult> {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.(LOCAL_STORAGE_QUALITY_BENCH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveQualityBench(
  ctx: Context | null | undefined,
  results: Record<string, QualityProbeResult>
): Promise<void> {
  try {
    (globalThis as any)?.localStorage?.setItem?.(LOCAL_STORAGE_QUALITY_BENCH_KEY, JSON.stringify(results));
  } catch {}
  const host = (ctx as any)?.host;
  if (typeof host?.writeFile === "function") {
    try {
      await host.writeFile(
        SHARED_QUALITY_BENCH_PATH,
        JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            count: Object.keys(results).length,
            results,
          },
          null,
          2
        )
      );
    } catch {}
  }
}

/**
 * Executa uma sonda de qualidade real (Tool-Calling + Integridade + Latência) contra o Gateway NexusMind.
 */
export async function runModelQualityProbe(
  ctx: Context,
  modelId: string,
  group: CanonicalGroupDef
): Promise<QualityProbeResult> {
  const testedAt = new Date().toISOString();
  const host = (ctx as any)?.host;
  if (typeof host?.request !== "function") {
    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: false,
      toolCallOk: false,
      streamOk: false,
      latencyMs: null,
      qualityScore: 0,
      errorKind: "unknown",
      errorMsg: "ctx.host.request indisponível",
    };
  }

  const isAnthropic = group.id === "nexusmind_anthropic";
  const url = isAnthropic
    ? "https://api.nexusmind.digital/v1/messages"
    : "https://api.nexusmind.digital/v1/chat/completions";

  const headers: Record<string, string> = isAnthropic
    ? {
        "x-api-key": group.defaultKey,
        Authorization: `Bearer ${group.defaultKey}`,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/NexusMindQualityBench",
      }
    : {
        Authorization: `Bearer ${group.defaultKey}`,
        "Content-Type": "application/json",
        "User-Agent": "BuzzDesktop/NexusMindQualityBench",
      };

  const body = isAnthropic
    ? {
        model: modelId,
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content: 'Chame a ferramenta check_status com {"service":"orgfy"} agora.',
          },
        ],
        tools: [
          {
            name: "check_status",
            description: "Verifica o status de um serviço da fábrica",
            input_schema: {
              type: "object",
              properties: { service: { type: "string" } },
              required: ["service"],
            },
          },
        ],
      }
    : {
        model: modelId,
        max_tokens: 120,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: 'Chame a ferramenta check_status com {"service":"orgfy"} agora.',
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "check_status",
              description: "Verifica o status de um serviço da fábrica",
              parameters: {
                type: "object",
                properties: { service: { type: "string" } },
                required: ["service"],
              },
            },
          },
        ],
        tool_choice: "auto",
      };

  const t0 = Date.now();
  try {
    const res = await host.request({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(body),
      timeoutMs: 14000,
    });
    const latencyMs = Date.now() - t0;
    const rawBody = String(res?.body || "");

    if (!res || res.status < 200 || res.status >= 300) {
      const errKind = classifyGatewayError(rawBody, res?.status);
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: errKind,
        errorMsg: `HTTP ${res?.status ?? "err"} · ${rawBody.slice(0, 120)}`,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: "stream_cut",
        errorMsg: "Resposta JSON truncada/inválida",
      };
    }

    // Verifica erro embutido no payload mesmo com HTTP 200
    if (parsed?.error) {
      const errText = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
      const errKind = classifyGatewayError(errText, res.status);
      return {
        model: modelId,
        group: group.id,
        testedAt,
        online: false,
        toolCallOk: false,
        streamOk: false,
        latencyMs,
        qualityScore: 0,
        errorKind: errKind,
        errorMsg: errText.slice(0, 140),
      };
    }

    let toolCallOk = false;
    let streamOk = false;

    if (isAnthropic) {
      const blocks = Array.isArray(parsed?.content) ? parsed.content : [];
      const toolUse = blocks.find((b: any) => b?.type === "tool_use" && b?.name === "check_status");
      if (toolUse && toolUse.input && typeof toolUse.input === "object") {
        toolCallOk = true;
        streamOk = true;
      } else if (blocks.some((b: any) => b?.type === "text" && String(b?.text || "").trim().length > 0)) {
        streamOk = true;
      }
    } else {
      const msg = parsed?.choices?.[0]?.message;
      const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
      const tc = toolCalls.find((c: any) => c?.function?.name === "check_status");
      if (tc) {
        try {
          const args =
            typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
          if (args && typeof args === "object") {
            toolCallOk = true;
            streamOk = true;
          }
        } catch {
          // Argumentos malformados
          toolCallOk = false;
          streamOk = true;
        }
      } else if (typeof msg?.content === "string" && msg.content.trim().length > 0) {
        streamOk = true;
      }
    }

    // Score composto (0..100):
    // - 45 pts: Tool-Calling válido (crítico para agentes Goose/OrgFy)
    // - 30 pts: Stream / resposta íntegra
    // - 25 pts: Velocidade (latência)
    const speedPts = Math.max(0, Math.min(25, Math.round(25 - (latencyMs / 1000) * 2.5)));
    const qualityScore = (toolCallOk ? 45 : 0) + (streamOk ? 30 : 0) + speedPts;

    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: true,
      toolCallOk,
      streamOk,
      latencyMs,
      qualityScore,
      errorKind: "ok",
      ...(toolCallOk ? {} : { errorMsg: "Respondeu texto mas não executou tool_call estruturado" }),
    };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    const msg = String(err?.message || err);
    return {
      model: modelId,
      group: group.id,
      testedAt,
      online: false,
      toolCallOk: false,
      streamOk: false,
      latencyMs,
      qualityScore: 0,
      errorKind: classifyGatewayError(msg),
      errorMsg: msg.slice(0, 140),
    };
  }
}

/**
 * Roda benchmark de qualidade em lote (concorrência controlada = 2) e persiste os resultados.
 */
export async function runBatchQualityBench(
  ctx: Context,
  candidates: Array<{ model: string; group: CanonicalGroupDef }>,
  onProgress?: (done: number, total: number, latest: QualityProbeResult) => void
): Promise<Record<string, QualityProbeResult>> {
  const existing = loadSavedQualityBench();
  const next: Record<string, QualityProbeResult> = { ...existing };
  const total = candidates.length;
  let done = 0;

  const queue = [...candidates];
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const res = await runModelQualityProbe(ctx, item.model, item.group);
      next[item.model] = res;
      done += 1;
      try {
        onProgress?.(done, total, res);
      } catch {}
    }
  };

  await Promise.all([worker(), worker()]);
  await saveQualityBench(ctx, next);
  return next;
}
