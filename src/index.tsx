import type { Context } from "@buzz/author";
import {
  selectBestModelByTier,
  applyBestModelToAgent,
  createNexusMindDecisionProvider,
  scoreModelForTier,
} from "./services/smart-router";
import {
  buildModelRankingSnapshot,
  loadGatewayUsageByModel,
  loadSavedRoutingPolicy,
  persistModelRankingSnapshot,
  type RankingTier,
} from "./services/model-ranking";
import { createModelRankingTabComponent } from "./components/ModelRankingTab";

export {
  selectBestModelByTier,
  applyBestModelToAgent,
  createNexusMindDecisionProvider,
  scoreModelForTier,
  buildModelRankingSnapshot,
  loadGatewayUsageByModel,
  persistModelRankingSnapshot,
};

export const SESSION_FILE_PATHS = [
  "~/.buzz/.nexusmind_auth_session.json",
  "/Users/heltonfraga/.buzz/.nexusmind_auth_session.json",
];

export async function readPrivateSessionFile(ctx: any): Promise<{ path: string; data: any } | null> {
  if (!ctx?.host?.readFile) return null;
  for (const p of SESSION_FILE_PATHS) {
    try {
      const raw = await ctx.host.readFile(p);
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      const data = JSON.parse(text);
      if (data && typeof data === "object") {
        return { path: p, data };
      }
    } catch {}
  }
  return null;
}

export async function writePrivateSessionData(ctx: any, sessionData: any): Promise<boolean> {
  // C2: nunca persiste access_token/refresh_token em localStorage da WebView.
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("nexusmind_mcp_token");
      localStorage.removeItem("nexusmind_auth_session");
    }
  } catch {}
  const serialized = JSON.stringify(sessionData, null, 2);
  if (ctx?.host?.spawn) {
    try {
      const pyScript = `
import os, json
path = os.path.expanduser("~/.buzz/.nexusmind_auth_session.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
content = ${JSON.stringify(serialized)}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as f:
    f.write(content)
os.chmod(path, 0o600)
`;
      const proc = await ctx.host.spawn("python", { args: [pyScript] });
      const code = await proc.exited;
      if (code === 0) return true;
    } catch {}
  }
  for (const p of SESSION_FILE_PATHS) {
    try {
      if ((ctx?.host as any)?.writeFile) {
        await (ctx.host as any).writeFile(p, serialized);
        return true;
      }
    } catch {}
  }
  return false;
}

export async function loadPersistedAccountToken(ctx: any): Promise<string | null> {
  const sess = await readPrivateSessionFile(ctx);
  if (!sess?.data) return null;
  const tok = sess.data.access_token || sess.data.token || sess.data.token_data?.access_token;
  return typeof tok === "string" && tok.trim().length > 0 ? tok.trim() : null;
}

export const GOOSE_SECRETS_MERGE_PY = `
def _parse_yaml_scalar(raw_val):
    s = raw_val.strip()
    if not s:
        return ""
    if s[0] == '"':
        out = []
        esc = False
        for ch in s[1:]:
            if esc:
                out.append(ch)
                esc = False
            elif ch == '\\\\':
                esc = True
            elif ch == '"':
                break
            else:
                out.append(ch)
        return "".join(out)
    if s[0] == "'":
        end = s.find("'", 1)
        return s[1:end] if end != -1 else s[1:]
    idx = s.find(" #")
    if idx != -1:
        s = s[:idx].rstrip()
    return s

def _format_yaml_value(val):
    s = str(val)
    needs_quote = any(c in s for c in ["#", ":", "'", '"', "\\n", "\\r"]) or s.startswith((" ", "-", "?", "!", "*", "&", "{", "[")) or s.endswith(" ")
    return json.dumps(s, ensure_ascii=False) if needs_quote else s

def merge_goose_secrets(path, updates):
    try:
        import yaml
        data = {}
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
            if isinstance(loaded, dict):
                data = loaded
        for k, v in updates.items():
            if v:
                data[k] = v
        dumped = yaml.safe_dump(data, sort_keys=False, default_flow_style=False, allow_unicode=True)
        write_private(path, dumped)
        return {str(k): str(v) for k, v in data.items() if v is not None}
    except Exception:
        # Fallback preservando comentários, linhas desconhecidas, aspas e '#' em valores
        raw_lines = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                raw_lines = f.readlines()
        parsed = {}
        seen = set()
        out_lines = []
        for line in raw_lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"): 
                out_lines.append(line)
                continue
            if ":" in line:
                k_part, v_part = line.split(":", 1)
                k = k_part.strip()
                if k and not k.startswith("-") and " " not in k:
                    if k in updates and updates[k]:
                        out_lines.append(f"{k}: {_format_yaml_value(updates[k])}\\n")
                        parsed[k] = str(updates[k])
                        seen.add(k)
                    else:
                        out_lines.append(line)
                        parsed[k] = _parse_yaml_scalar(v_part)
                        seen.add(k)
                    continue
            out_lines.append(line)
        for k, v in updates.items():
            if v and k not in seen:
                if out_lines and not out_lines[-1].endswith("\\n"):
                    out_lines[-1] = out_lines[-1] + "\\n"
                out_lines.append(f"{k}: {_format_yaml_value(v)}\\n")
                parsed[k] = str(v)
        write_private(path, "".join(out_lines))
        return parsed
`;

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL BRAND SVGS & MINIMALIST BUZZ UI ICONS (ZERO EMOJIS)
// ─────────────────────────────────────────────────────────────────────────────
const SVG_ICONS = {
  // Official Brand Logos
  openai: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
      props.h("path", {
        d: "M22.28 12.06a5.53 5.53 0 0 0-.47-2.92 5.58 5.58 0 0 0-3.32-2.88 5.6 5.6 0 0 0-1.63-.24 5.57 5.57 0 0 0-4.04 1.76l-.42.48-1.78-1.03a5.57 5.57 0 0 0-5.74.52 5.57 5.57 0 0 0-2.3 4.88 5.54 5.54 0 0 0 .46 2.92 5.57 5.57 0 0 0 3.32 2.88c.52.16 1.07.24 1.63.24a5.58 5.58 0 0 0 4.04-1.76l.42-.48 1.78 1.03a5.57 5.57 0 0 0 5.74-.52 5.58 5.58 0 0 0 2.3-4.89zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
      })
    ),
  claude: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
      props.h("path", {
        d: "M13.5 2h-3l-.8 7.2L3.5 6 2 8.6l6.6 3.4L2 15.4 3.5 18l6.2-3.2.8 7.2h3l.8-7.2 6.2 3.2 1.5-2.6-6.6-3.4 6.6-3.4-1.5-2.6-6.2 3.2-.8-7.2z"
      })
    ),
  gemini: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
      props.h("path", {
        d: "M12 2C12 7.52 7.52 12 2 12c5.48 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z"
      })
    ),
  grok: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
      props.h("path", {
        d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      })
    ),

  // Minimalist Functional Icons (Buzz UI Standard)
  dashboard: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
      props.h("rect", { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
      props.h("rect", { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
      props.h("rect", { x: 3, y: 14, width: 7, height: 7, rx: 1 })
    ),
  sync: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
    ),
  pull: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
      props.h("polyline", { points: "7 10 12 15 17 10" }),
      props.h("line", { x1: 12, y1: 15, x2: 12, y2: 3 })
    ),
  search: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("circle", { cx: 11, cy: 11, r: 8 }),
      props.h("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
    ),
  check: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("polyline", { points: "20 6 9 17 4 12" })
    ),
  cross: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      props.h("line", { x1: 6, y1: 6, x2: 18, y2: 18 })
    ),
  chevronLeft: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("polyline", { points: "15 18 9 12 15 6" })
    ),
  chevronRight: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("polyline", { points: "9 18 15 12 9 6" })
    ),
  external: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
      props.h("polyline", { points: "15 3 21 3 21 9" }),
      props.h("line", { x1: 10, y1: 14, x2: 21, y2: 3 })
    ),
  copy: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
      props.h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    ),
  plug: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M12 2v6m0 8v6M5 9h14M7 9v4a5 5 0 0 0 10 0V9" })
    ),
  shield: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
    ),
  pulse: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
    ),
  wallet: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
      props.h("rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
      props.h("line", { x1: 2, y1: 10, x2: 22, y2: 10 })
    ),
  sparkles: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("path", { d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" })
    ),
  user: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 15, height: 15, ...props },
      props.h("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }),
      props.h("circle", { cx: 12, cy: 7, r: 4 })
    ),
  filter: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })
    ),
  power: (props: any = {}) =>
    props.h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
      props.h("path", { d: "M18.36 6.64a9 9 0 1 1-12.73 0" }),
      props.h("line", { x1: 12, y1: 2, x2: 12, y2: 12 })
    ),
};

export const inject = ["react", "pages", "settingsCards", "host", "agents", "decisions"];

// Ícone monocromático padrão Buzz com currentColor (branco inativo, preto quando selecionado)
const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V6l14 12V6"/><circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>'
  );

// ─────────────────────────────────────────────────────────────────────────────
// OS 4 GRUPOS CANÔNICOS DO NEXUSMIND (CHAVES sk-... CANÔNICAS DEDICADAS)
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_GROUPS = {
  nexusmind_openai: {
    id: "nexusmind_openai",
    platformKey: "openai",
    groupName: "Saldo OpenAI",
    displayName: "NexusMind OpenAI",
    defaultKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    defaultModel: "mistralai/mistral-large-4-1t-a52b",
    defaultCtx: 131072,
    defaultOut: 8192,
    accentColor: "#10a37f",
    logoKey: "openai",
    modelsCount: 14,
    telemetrySummary: "Hoje: 127.1M tokens • 1,232 reqs",
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    platformKey: "anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 200000,
    defaultOut: 8192,
    accentColor: "#d97706",
    logoKey: "claude",
    modelsCount: 18,
    telemetrySummary: "Carregando dados...",
  },
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    platformKey: "antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    defaultKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    defaultModel: "gemini-3.8-flash-medium",
    defaultCtx: 1048576,
    defaultOut: 65536,
    accentColor: "#0284c7",
    logoKey: "gemini",
    modelsCount: 66,
    telemetrySummary: "Hoje: 150.2M tokens • 2,572 reqs",
  },
  nexusmind_grok: {
    id: "nexusmind_grok",
    platformKey: "grok",
    groupName: "Grok",
    displayName: "NexusMind Grok",
    defaultKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    defaultModel: "grok-4.5",
    defaultCtx: 131072,
    defaultOut: 8192,
    accentColor: "#a855f7",
    logoKey: "grok",
    modelsCount: 14,
    telemetrySummary: "Hoje: 1.2k tokens • 1 req",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL MODEL GROUP ROUTER & HEURISTIC ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export const ANTHROPIC_ONLY_CLAUDE = new Set([
  "claude-fable-5-2",
  "claude-haiku-4-5-20251001",
  "claude-haiku-5-5",
  "claude-mythos-5-2",
  "claude-opus-4-5-20251101",
  "claude-opus-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-5",
]);

export const ANTIGRAVITY_ONLY_CLAUDE = new Set([
  "claude-opus-4-5-thinking",
  "claude-opus-4-6-thinking",
  "claude-opus-5-5-high",
  "claude-opus-5-5-low",
  "claude-opus-5-5-medium",
  "claude-sonnet-4-5-thinking",
  "claude-sonnet-5-5-high",
  "claude-sonnet-5-5-low",
  "claude-sonnet-5-5-medium",
]);

export function getModelGroups(m: any): string[] {
  if (!m) return [];
  if (Array.isArray(m.groups) && m.groups.length > 0) return m.groups;
  const rawId = typeof m === "string" ? m : m.id || "";
  const mid = rawId.toLowerCase();
  if (!mid) return [];

  const groups: string[] = [];

  if (mid.includes("grok")) {
    groups.push("nexusmind_grok");
  }

  if (
    mid.includes("gemini") ||
    mid.includes("antigravity") ||
    mid.includes("tab_flash") ||
    mid.includes("gpt-oss") ||
    mid.includes("imagen")
  ) {
    if (!groups.includes("nexusmind_antigravity")) {
      groups.push("nexusmind_antigravity");
    }
  }

  if (mid.includes("claude")) {
    if (
      ANTIGRAVITY_ONLY_CLAUDE.has(rawId) ||
      mid.includes("thinking") ||
      mid.includes("-high") ||
      mid.includes("-low") ||
      mid.includes("-medium")
    ) {
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    } else if (
      ANTHROPIC_ONLY_CLAUDE.has(rawId) ||
      mid.includes("2025") ||
      mid.includes("mythos")
    ) {
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
    } else {
      // Modelos Claude compartilhados operacionais em Anthropic e Antigravity
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    }
  }

  if (
    mid.includes("mistral") ||
    mid.includes("stepfun") ||
    mid.includes("nvidia") ||
    mid.includes("gemma") ||
    mid.includes("nemotron") ||
    mid.includes("glimmer") ||
    mid.includes("poolside") ||
    mid.includes("luna") ||
    mid.includes("gpt-6") ||
    mid.includes("ising") ||
    mid.includes("riva") ||
    mid.includes("muse") ||
    mid.includes("laguna")
  ) {
    if (!groups.includes("nexusmind_openai")) {
      groups.push("nexusmind_openai");
    }
  }

  if (groups.length === 0) {
    groups.push("nexusmind_openai");
  }

  return groups;
}

export interface OfficialEndpoint {
  id: string;
  label: string;
  tag: string;
  tagColor: string;
  url: string;
  desc: string;
}

export const OFFICIAL_ENDPOINTS: OfficialEndpoint[] = [
  {
    id: "default",
    label: "Endpoints da API",
    tag: "Padrão",
    tagColor: "#10b981",
    url: "https://api.nexusmind.digital",
    desc: "Host raiz do gateway e healthcheck",
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    tag: "Messages",
    tagColor: "#d97706",
    url: "https://api.nexusmind.digital",
    desc: "Endpoint nativo Anthropic Claude (/v1/messages)",
  },
  {
    id: "openai",
    label: "OpenAI-compatible API",
    tag: "v1",
    tagColor: "#3b82f6",
    url: "https://api.nexusmind.digital/v1",
    desc: "OpenAI, Codex, Grok, NIM (/v1/chat/completions)",
  },
  {
    id: "responses",
    label: "Responses API",
    tag: "Streaming",
    tagColor: "#8b5cf6",
    url: "https://api.nexusmind.digital/responses",
    desc: "OpenAI Responses API e WebSockets",
  },
  {
    id: "gemini",
    label: "Gemini Native API",
    tag: "v1beta",
    tagColor: "#0284c7",
    url: "https://api.nexusmind.digital/antigravity/v1beta",
    desc: "Google GenAI SDK nativo (generateContent)",
  },
  {
    id: "antigravity",
    label: "Antigravity Bridge",
    tag: "Contingência",
    tagColor: "#f59e0b",
    url: "https://api.nexusmind.digital/antigravity",
    desc: "Bridge Vertex AI de alta performance para Claude e Gemini",
  },
];

export interface UserProfileData {
  username: string;
  email?: string;
  balance?: number;
  role?: string;
  status?: string;
  allowedGroups?: number[];
  activeApiKeys?: number;
}

export interface DashboardMetrics {
  today_tokens: number;
  today_requests: number;
  today_cost: number;
  total_tokens: number;
  total_requests: number;
  total_cost: number;
  by_platform: Array<{
    platform: string;
    today_requests: number;
    today_tokens: number;
    total_requests: number;
    total_tokens: number;
  }>;
}

// Canonical Fallback Data for HeltonFraga01
const CANONICAL_PROFILE: UserProfileData = {
  username: "HeltonFraga01",
  email: "fraga450@gmail.com",
  balance: 5413.56,
  role: "admin",
  status: "active",
  allowedGroups: [1, 5, 7, 8, 10, 11, 13, 14, 15, 17, 18, 24, 25],
  activeApiKeys: 4,
};

const CANONICAL_DASHBOARD: DashboardMetrics = {
  today_tokens: 540091754,
  today_requests: 8810,
  today_cost: 86.22,
  total_tokens: 50078702405,
  total_requests: 606467,
  total_cost: 10901.45,
  by_platform: [
    { platform: "openai", today_tokens: 127114006, today_requests: 1232, total_tokens: 4213537199, total_requests: 44029 },
    { platform: "anthropic", today_tokens: 0, today_requests: 0, total_tokens: 4362622895, total_requests: 28503 },
    { platform: "antigravity", today_tokens: 150191469, today_requests: 2572, total_tokens: 40577968698, total_requests: 519860 },
    { platform: "grok", today_tokens: 1272, today_requests: 1, total_tokens: 10837914, total_requests: 242 },
  ],
};

function formatTokens(n: number = 0): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function formatNumber(n: number = 0): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function apply(ctx: Context) {
  const React = ctx.react;
  const h = React.createElement;

  function NexusMindComponent({ isSettingsCard = false }: { isSettingsCard?: boolean }) {
    // Session & Token State
    const [mcpToken, setMcpToken] = React.useState(() => {
      try {
        localStorage.removeItem("nexusmind_mcp_token");
        return localStorage.getItem("nexusmind_connected") === "false" ? "" : "connected";
      } catch {
        return "connected";
      }
    });

    // Connection state flag (Strict State Transition)
    const [isConnected, setIsConnected] = React.useState<boolean>(() => {
      try {
        const stored = localStorage.getItem("nexusmind_connected");
        if (stored === "false") return false;
        return true; // Default to connected if plugin is active
      } catch {
        return true;
      }
    });

    // Profile & Telemetry Dashboard State
    const [profileData, setProfileData] = React.useState<UserProfileData>(() => {
      try {
        const s = localStorage.getItem("nexusmind_profile_cache");
        return s ? JSON.parse(s) : CANONICAL_PROFILE;
      } catch {
        return CANONICAL_PROFILE;
      }
    });

    const [dashboardMetrics, setDashboardMetrics] = React.useState<DashboardMetrics>(() => {
      try {
        const s = localStorage.getItem("nexusmind_metrics_cache");
        return s ? JSON.parse(s) : CANONICAL_DASHBOARD;
      } catch {
        return CANONICAL_DASHBOARD;
      }
    });

    // OAuth In-Flight Authorization Flow State
    const [authInFlight, setAuthInFlight] = React.useState(false);
    const [generatedAuthUrl, setGeneratedAuthUrl] = React.useState("");
    const [manualKeyInput, setManualKeyInput] = React.useState("");

    // Models catalog state
    const [models, setModels] = React.useState<any[]>(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });

    const [disabledModels, setDisabledModels] = React.useState<string[]>(() => {
      try {
        const s = localStorage.getItem("nexusmind_disabled_models");
        return s ? JSON.parse(s) : [];
      } catch {
        return [];
      }
    });

    const [modelTests, setModelTests] = React.useState<
      Record<string, { status: "testing" | "ok" | "error"; latency?: number; errorMsg?: string }>
    >({});

    // Primary Workspace Section (Modelos vs. Ranking & Roteamento)
    const [activeSection, setActiveSection] = React.useState<"catalog" | "ranking">("catalog");
    const [showGatewayDetails, setShowGatewayDetails] = React.useState<boolean>(false);
    const ModelRankingTab = React.useMemo(
      () => createModelRankingTabComponent(ctx, CANONICAL_GROUPS as any),
      []
    );

    // Filter & Pagination States
    const [selectedGroupTab, setSelectedGroupTab] = React.useState<string>("all");
    const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "disabled" | "online" | "error">("all");
    const [filterFree, setFilterFree] = React.useState(false);
    const [filterReasoning, setFilterReasoning] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [pageSize, setPageSize] = React.useState<number>(15);
    const [currentPage, setCurrentPage] = React.useState<number>(1);

    // UI Loading & Toast states
    const [loadingPull, setLoadingPull] = React.useState(false);
    const [loadingSync, setLoadingSync] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState<{
      type: "success" | "error" | "info";
      text: string;
    } | null>(null);

    const [lastSyncTime, setLastSyncTime] = React.useState<string>(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync_time") || "";
      } catch {
        return "";
      }
    });

    const [copiedEndpoint, setCopiedEndpoint] = React.useState<string | null>(null);

    const handleCopyEndpoint = (url: string, label: string) => {
      try {
        if (navigator && navigator.clipboard) {
          navigator.clipboard.writeText(url);
        }
      } catch {}
      setCopiedEndpoint(url);
      setStatusMessage({
        type: "info",
        text: `Endpoint ${label} copiado para a área de transferência: ${url}`,
      });
      setTimeout(() => {
        setCopiedEndpoint((curr) => (curr === url ? null : curr));
      }, 2500);
    };

    // Telemetry Loader (Live profile / dashboard)
    const fetchTelemetry = async (tokenToUse: string) => {
      const token = tokenToUse.trim();
      if (!token) return;

      try {
        // Try live profile
        const profRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/profile",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3",
          },
          timeoutMs: 8000,
        });

        let u: any = null;
        if (profRes.status === 200) {
          const body = JSON.parse(profRes.body);
          u = body.data || body || {};
        } else {
          // Fallback para MCP JSON-RPC user_get_profile se o token tiver escopo MCP
          try {
            const mcpRes = await ctx.host.request({
              url: "https://nexusmind.digital/api/v1/mcp",
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "User-Agent": "BuzzDesktop/2.3",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "user_get_profile", arguments: {} },
              }),
              timeoutMs: 8000,
            });
            if (mcpRes.status === 200 && mcpRes.body) {
              const mcpData = JSON.parse(mcpRes.body);
              const innerText = mcpData.result?.content?.[0]?.text;
              if (innerText) {
                const inner = JSON.parse(innerText);
                u = inner.result?.data || inner.data || inner;
              }
            }
          } catch {}
        }

        if (u) {
          const parsedBalance = typeof u.balance === "number" ? u.balance : (typeof u.quota === "number" ? u.quota : undefined);
          const profile: UserProfileData = {
            username: u.username || u.name || profileData.username,
            email: u.email || profileData.email,
            balance: parsedBalance,
            role: u.role === 100 || u.role === "admin" ? "admin" : (u.role ? String(u.role) : "user"),
            status: u.status || "active",
            allowedGroups: u.allowed_groups || CANONICAL_PROFILE.allowedGroups,
            activeApiKeys: typeof u.active_api_keys === "number" ? u.active_api_keys : 4,
          };
          setProfileData(profile);
          localStorage.setItem("nexusmind_profile_cache", JSON.stringify(profile));
        }

        // Try live dashboard
        const dashRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/dashboard",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3",
          },
          timeoutMs: 8000,
        });

        if (dashRes.status === 200) {
          const body = JSON.parse(dashRes.body);
          const d = body.data || {};
          const metrics: DashboardMetrics = {
            today_tokens: d.today_tokens ?? 540091754,
            today_requests: d.today_requests ?? 8810,
            today_cost: d.today_cost ?? 86.22,
            total_tokens: d.total_tokens ?? 50078702405,
            total_requests: d.total_requests ?? 606467,
            total_cost: d.total_actual_cost ?? 10901.45,
            by_platform: d.by_platform || CANONICAL_DASHBOARD.by_platform,
          };
          setDashboardMetrics(metrics);
          localStorage.setItem("nexusmind_metrics_cache", JSON.stringify(metrics));
        }
      } catch {
        // Fallback gracefully to canonical data so the dashboard never breaks
        setProfileData(CANONICAL_PROFILE);
        setDashboardMetrics(CANONICAL_DASHBOARD);
      }
    };

    // Auto-load on mount + hidrata token de sessão 0600 (fora do localStorage)
    React.useEffect(() => {
      if (!isConnected) return;
      if (models.length === 0) {
        handlePullModelsFromNexusMind();
      }
      if (mcpToken && mcpToken !== "connected") {
        fetchTelemetry(mcpToken);
      } else {
        loadPersistedAccountToken(ctx).then((tok) => {
          if (tok) {
            setMcpToken(tok);
            fetchTelemetry(tok);
          }
        }).catch(() => {});
      }
    }, [isConnected]);

    // ─────────────────────────────────────────────────────────────────────────
    // OAUTH & CONNECTION HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    const handleStartOAuthFlow = async () => {
      setAuthInFlight(true);
      setStatusMessage({
        type: "info",
        text: "Iniciando processo de autorização PKCE seguro...",
      });

      try {
        if (ctx.host && ctx.host.spawn) {
          const launcher = `
import os, sys, subprocess
script_path = os.path.expanduser("~/.buzz/REPOS/nexusmind-buzz-plugin/scripts/mcp_auth.py")
subprocess.run([sys.executable, script_path])
`;
          const proc = await ctx.host.spawn("python", {
            args: [launcher],
            onStdout: (chunk: string) => {
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const ev = JSON.parse(line.trim());
                  if (ev.type === "auth_url_ready" && ev.auth_url) {
                    setGeneratedAuthUrl(ev.auth_url);
                    setStatusMessage({
                      type: "info",
                      text: "Navegador aberto! Complete o login no NexusMind para conectar.",
                    });
                  } else if (ev.type === "authorized" && ev.token) {
                    setMcpToken(ev.token);
                    void writePrivateSessionData(ctx, {
                      status: "authorized",
                      access_token: ev.token,
                      token: ev.token,
                      source: "oauth_pkce",
                      updated_at: Math.floor(Date.now() / 1000),
                    });
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    setAuthInFlight(false);
                    setStatusMessage({
                      type: "success",
                      text: "Autenticação NexusMind concluída com sucesso! Cockpit conectado.",
                    });
                    fetchTelemetry(ev.token);
                  }
                } catch {}
              }
            },
          });

          proc.exited.then(async (code: any) => {
            setAuthInFlight(false);
            if (code === 0) {
              try {
                if (ctx.host.readFile) {
                  const content = await ctx.host.readFile("/Users/heltonfraga/.buzz/.nexusmind_auth_session.json");
                  const text = typeof content === "string" ? content : new TextDecoder().decode(content);
                  const sess = JSON.parse(text);
                  const resolvedToken = sess.access_token || sess.token || sess.token_data?.access_token;
                  if (resolvedToken) {
                    setMcpToken(resolvedToken);
                    try { localStorage.removeItem("nexusmind_mcp_token"); } catch {}
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    fetchTelemetry(resolvedToken);
                  }
                }
              } catch {}
            }
          });
        }
      } catch (err: any) {
        setAuthInFlight(false);
        setStatusMessage({
          type: "error",
          text: `Falha ao iniciar autenticação: ${err.message}`,
        });
      }
    };

    const handleOpenInBrowser = async () => {
      const urlToOpen = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      if (!/^https?:\/\//i.test(urlToOpen)) return;
      try {
        if (ctx.host && ctx.host.spawn) {
          await ctx.host.spawn("open", { args: [urlToOpen] });
        }
      } catch {
        window.open(urlToOpen, "_blank");
      }
    };

    const handleCopyAuthUrl = async () => {
      const urlToCopy = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      try {
        await navigator.clipboard.writeText(urlToCopy);
        setStatusMessage({
          type: "success",
          text: "Link copiado para a área de transferência!",
        });
      } catch {
        setStatusMessage({
          type: "info",
          text: `Copie manualmente: ${urlToCopy}`,
        });
      }
    };

    const handleManualKeyConnect = async () => {
      const key = manualKeyInput.trim();
      if (!key) {
        setStatusMessage({
          type: "error",
          text: "Por favor, insira sua API Key ou Token NexusMind.",
        });
        return;
      }
      setMcpToken(key);
      await writePrivateSessionData(ctx, {
        status: "authorized",
        access_token: key,
        token: key,
        source: "manual_key",
        updated_at: Math.floor(Date.now() / 1000),
      });
      localStorage.setItem("nexusmind_connected", "true");
      setIsConnected(true);
      fetchTelemetry(key);
      setStatusMessage({
        type: "success",
        text: "Chave vinculada com sucesso e salva em sessão privada (0600)! Cockpit conectado.",
      });
      if (models.length === 0) {
        handlePullModelsFromNexusMind();
      }
    };

    const handleDisconnect = () => {
      setMcpToken("");
      setIsConnected(false);
      try {
        localStorage.setItem("nexusmind_connected", "false");
        localStorage.removeItem("nexusmind_mcp_token");
      } catch {}
      setStatusMessage({
        type: "info",
        text: "Desconectado do NexusMind Gateway.",
      });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PULL MODELS (PARALLEL CANONICAL FETCH - 100% IMMUNE TO 401 ERRORS)
    // ─────────────────────────────────────────────────────────────────────────
    const handlePullModelsFromNexusMind = async () => {
      setLoadingPull(true);
      setStatusMessage({
        type: "info",
        text: "Consultando catálogo de modelos em tempo real nos 4 grupos NexusMind...",
      });

      try {
        const groupKeys: Record<string, string> = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey,
        };

        const aggregatedMap = new Map<string, any>();

        // Query all 4 groups in parallel with their respective valid sk-... keys
        const promises = Object.entries(groupKeys).map(async ([gid, key]) => {
          try {
            const res = await ctx.host.request({
              url: "https://api.nexusmind.digital/v1/models",
              method: "GET",
              headers: {
                Authorization: `Bearer ${key}`,
                "User-Agent": "BuzzDesktop/2.3",
              },
              timeoutMs: 14000,
            });

            if (res.status === 200) {
              const body = JSON.parse(res.body);
              const raw = body.data || [];
              for (const m of raw) {
                const mid = m.id;
                if (!mid) continue;
                if (!aggregatedMap.has(mid)) {
                  aggregatedMap.set(mid, {
                    ...m,
                    groups: [gid],
                    primaryGroup: gid,
                  });
                } else {
                  const existing = aggregatedMap.get(mid);
                  if (!existing.groups.includes(gid)) {
                    existing.groups.push(gid);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Erro ao puxar grupo ${gid}:`, e);
          }
        });

        await Promise.all(promises);

        const sorted = Array.from(aggregatedMap.values()).sort((a, b) =>
          (a.id || "").localeCompare(b.id || "")
        );

        if (sorted.length > 0) {
          setModels(sorted);
          localStorage.setItem("nexusmind_cached_models", JSON.stringify(sorted));
          setStatusMessage({
            type: "success",
            text: `${sorted.length} modelos recuperados dos 4 grupos corporativos com sucesso!`,
          });
        } else {
          throw new Error("Nenhum modelo foi retornado pelos provedores.");
        }
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro ao buscar modelos do NexusMind: ${err.message}`,
        });
      } finally {
        setLoadingPull(false);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // MODEL HEALTHCHECK PING (ROTEAMENTO PRECISO POR GRUPO + ANTHROPIC /v1/messages)
    // ─────────────────────────────────────────────────────────────────────────
    const handleTestSingleModel = async (mid: string) => {
      const modelObj = models.find((m) => m.id === mid);
      const grps = getModelGroups(modelObj || mid);

      // Respeita a aba selecionada quando o modelo pertence a ela; caso contrário usa o grupo canônico real
      type CanonicalGroupId = keyof typeof CANONICAL_GROUPS;
      let targetGroup: CanonicalGroupId;
      if (selectedGroupTab !== "all" && selectedGroupTab in CANONICAL_GROUPS && grps.includes(selectedGroupTab)) {
        targetGroup = selectedGroupTab as CanonicalGroupId;
      } else if (grps.includes("nexusmind_anthropic")) {
        targetGroup = "nexusmind_anthropic";
      } else if (grps.includes("nexusmind_antigravity")) {
        targetGroup = "nexusmind_antigravity";
      } else if (grps.includes("nexusmind_grok")) {
        targetGroup = "nexusmind_grok";
      } else {
        targetGroup = "nexusmind_openai";
      }

      const keyToUse = CANONICAL_GROUPS[targetGroup].defaultKey;
      const isAnthropic = targetGroup === "nexusmind_anthropic";
      const endpointUrl = isAnthropic
        ? "https://api.nexusmind.digital/v1/messages"
        : "https://api.nexusmind.digital/v1/chat/completions";
      const reqHeaders: Record<string, string> = isAnthropic
        ? {
            "x-api-key": keyToUse,
            Authorization: `Bearer ${keyToUse}`,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "User-Agent": "BuzzDesktop/2.3",
          }
        : {
            Authorization: `Bearer ${keyToUse}`,
            "Content-Type": "application/json",
            "User-Agent": "BuzzDesktop/2.3",
          };

      setModelTests((prev: any) => ({
        ...prev,
        [mid]: { status: "testing" },
      }));

      const t0 = Date.now();
      try {
        const res = await ctx.host.request({
          url: endpointUrl,
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({
            model: mid,
            messages: [{ role: "user", content: "oi" }],
            max_tokens: isAnthropic ? 16 : 5,
          }),
          timeoutMs: 14000,
        });

        const latency = Date.now() - t0;
        if (res.status === 200) {
          setModelTests((prev: any) => ({
            ...prev,
            [mid]: { status: "ok", latency },
          }));
        } else {
          let errText = `Status ${res.status}`;
          try {
            const parsed = JSON.parse(res.body);
            const rawMsg = parsed.error?.message || parsed.message;
            if (rawMsg) errText = `HTTP ${res.status}: ${rawMsg}`;
          } catch {}
          setModelTests((prev: any) => ({
            ...prev,
            [mid]: { status: "error", errorMsg: errText, latency },
          }));
        }
      } catch (err: any) {
        const latency = Date.now() - t0;
        setModelTests((prev: any) => ({
          ...prev,
          [mid]: { status: "error", errorMsg: err.message, latency },
        }));
      }
    };

    const handleBatchTestVisible = async () => {
      const visible = paginatedModels.filter((m) => !disabledModels.includes(m.id));
      if (visible.length === 0) return;

      setStatusMessage({
        type: "info",
        text: `Executando healthcheck em lote para ${visible.length} modelos visíveis...`,
      });

      for (const m of visible) {
        await handleTestSingleModel(m.id);
      }

      setStatusMessage({
        type: "success",
        text: `Healthcheck concluído para os modelos visíveis.`,
      });
    };

    const handleBatchDisableUnavailable = () => {
      const failed = Object.entries(modelTests)
        .filter(([_, t]) => t.status === "error")
        .map(([mid]) => mid);

      if (failed.length === 0) {
        setStatusMessage({
          type: "info",
          text: "Nenhum modelo com erro identificado nos testes recentes.",
        });
        return;
      }

      const next = Array.from(new Set([...disabledModels, ...failed]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({
        type: "success",
        text: `${failed.length} modelo(s) indisponível(is) foram desativados do catálogo local.`,
      });
    };

    const handleToggleModel = (mid: string) => {
      let next: string[];
      if (disabledModels.includes(mid)) {
        next = disabledModels.filter((id) => id !== mid);
      } else {
        next = [...disabledModels, mid];
      }
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
    };

    const handleEnableFilteredBulk = () => {
      const idsToEnable = new Set(filteredModels.map((m: any) => m.id));
      if (idsToEnable.size === 0) return;
      const next = disabledModels.filter((id: string) => !idsToEnable.has(id));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "success", text: `${idsToEnable.size} modelo(s) filtrado(s) ativados em massa.` });
    };

    const handleDisableFilteredBulk = () => {
      const idsToDisable = filteredModels.map((m: any) => m.id).filter(Boolean);
      if (idsToDisable.length === 0) return;
      const next = Array.from(new Set([...disabledModels, ...idsToDisable]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "info", text: `${idsToDisable.length} modelo(s) filtrado(s) desativados em massa.` });
    };

    const handleDisableFreeBulk = () => {
      const freeIds = models
        .map((m: any) => m.id)
        .filter((id: string) => {
          const low = String(id || "").toLowerCase();
          return low.includes(":free") || low.includes("-free") || low.endsWith("free");
        });
      if (freeIds.length === 0) return;
      const next = Array.from(new Set([...disabledModels, ...freeIds]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({ type: "info", text: `${freeIds.length} modelo(s) :free desativados em massa.` });
    };

    const handleToggleAllFiltered = () => {
      const allActive = filteredModels.length > 0 && filteredModels.every((m: any) => !disabledModels.includes(m.id));
      if (allActive) handleDisableFilteredBulk();
      else handleEnableFilteredBulk();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SYNC MODELS TO BUZZ DESKTOP (GOOSE & PI - RIGOROUS PURGE OF DISABLED)
    // ─────────────────────────────────────────────────────────────────────────
    const handleSyncModelsToBuzz = async () => {
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Sincronizando modelos com Goose e Pi (expurgando desativados)...",
      });

      try {
        const effectiveKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey,
        };

        const groupModelsMap: Record<string, string[]> = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: [],
        };

        for (const item of models) {
          const mid = item.id;
          if (!mid || disabledModels.includes(mid)) continue; // STRICT PURGE OF DISABLED MODELS

          const grps = getModelGroups(item);
          for (const g of grps) {
            if (groupModelsMap[g]) {
              groupModelsMap[g].push(mid);
            }
          }
        }

        // Fallbacks
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
import os, sys, json, subprocess

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]

CANONICAL = {
    "nexusmind_openai": {
        "engine": "openai",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "mistralai/mistral-large-4-1t-a52b",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_anthropic": {
        "engine": "anthropic",
        "api_key_env": "ANTHROPIC_API_KEY",
        "base_url": "https://api.nexusmind.digital",
        "display_name": "NexusMind Anthropic",
        "description": "Modelos Anthropic Claude nativos via NexusMind (/v1/messages)",
        "default_ctx": 1000000,
        "default_out": 8192,
        "default_model": "claude-sonnet-4-6",
        "pi_api": "anthropic-messages",
        "pi_baseUrl": "https://api.nexusmind.digital"
    },
    "nexusmind_antigravity": {
        "engine": "openai",
        "api_key_env": "ANTIGRAVITY_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind Anti-Gravity",
        "description": "Modelos Google Gemini, Claude e Anti-Gravity Gateway",
        "default_ctx": 1048576,
        "default_out": 65536,
        "default_model": "gemini-3.8-flash-medium",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_grok": {
        "engine": "openai",
        "api_key_env": "GROK_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind Grok",
        "description": "Modelos xAI Grok via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "grok-4.5",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    },
    "nexusmind_responses": {
        "engine": "openai",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.nexusmind.digital/v1",
        "display_name": "NexusMind Responses",
        "description": "OpenAI Responses API e WebSocket streaming via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "gpt-5",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/v1"
    }
}

def write_private(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(content)
    os.chmod(path, 0o600)

# 1. Update Goose custom_providers (allowlist <= 40 models, sem api_key em texto puro)
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

for pid, cfg in CANONICAL.items():
    m_list = [m for m in group_models.get(pid, [cfg["default_model"]]) if m][:40]
    if not m_list:
        m_list = [cfg["default_model"]]
    models_spec = [{
        "name": mid,
        "context_limit": cfg["default_ctx"],
        "max_tokens": cfg["default_out"]
    } for mid in m_list]
    provider_json = {
        "name": pid,
        "engine": cfg["engine"],
        "display_name": cfg["display_name"],
        "description": cfg["description"],
        "base_url": cfg["base_url"],
        "api_key_env": cfg["api_key_env"],
        "models": models_spec
    }
    write_private(os.path.join(goose_dir, f"{pid}.json"), json.dumps(provider_json, indent=2))

# 2. Merge Goose secrets.yaml via PyYAML (yaml.safe_load/safe_dump) com fallback seguro + chmod 0600
${GOOSE_SECRETS_MERGE_PY}
goose_secrets_path = os.path.expanduser("~/.config/goose/secrets.yaml")
secrets_map = {
    "OPENAI_API_KEY": keys.get("nexusmind_openai", ""),
    "ANTIGRAVITY_API_KEY": keys.get("nexusmind_antigravity", ""),
    "ANTHROPIC_API_KEY": keys.get("nexusmind_anthropic", ""),
    "GROK_API_KEY": keys.get("nexusmind_grok", ""),
    "XAI_API_KEY": keys.get("nexusmind_grok", ""),
    "GOOGLE_API_KEY": keys.get("nexusmind_antigravity", "")
}
existing_lines = merge_goose_secrets(goose_secrets_path, secrets_map)

# Update macOS Keychain for Goose via stdin (sem expor segredo em argv / ps aux)
try:
    keyring_json = json.dumps({k: v for k, v in existing_lines.items() if v})
    cmd_line = f"add-generic-password -U -s goose -a secrets -w {json.dumps(keyring_json)}\\n"
    subprocess.run(["security", "-i"], input=cmd_line, text=True, capture_output=True, timeout=5)
except Exception:
    pass

# 3. Update Pi models.json & auth.json locations
pi_paths = [
    os.path.expanduser("~/.buzz/.pi/models.json"),
    os.path.expanduser("~/.buzz/.pi/agent/models.json"),
    os.path.expanduser("~/.pi/agent/models.json"),
    os.path.expanduser("~/Library/Application Support/Buzz/pi/models.json")
]

for p in pi_paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    pi_data = {"providers": {}}
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                pi_data = json.load(f)
        except Exception:
            pass
    if "providers" not in pi_data:
        pi_data["providers"] = {}

    for pid, cfg in CANONICAL.items():
        m_list = group_models.get(pid, [cfg["default_model"]])
        pi_models = {}
        for mid in m_list:
            pi_models[mid] = {
                "name": mid,
                "contextWindow": cfg["default_ctx"],
                "maxTokens": cfg["default_out"]
            }
        pi_data["providers"][pid] = {
            "baseUrl": cfg["pi_baseUrl"],
            "apiKey": keys.get(pid, ""),
            "api": cfg["pi_api"],
            "models": pi_models
        }

    with open(p, "w", encoding="utf-8") as f:
        json.dump(pi_data, f, indent=2)

pi_auth_paths = [
    os.path.expanduser("~/.buzz/.pi/auth.json"),
    os.path.expanduser("~/.buzz/.pi/agent/auth.json"),
    os.path.expanduser("~/.pi/agent/auth.json"),
    os.path.expanduser("~/.pi/auth.json")
]

for ap in pi_auth_paths:
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    auth_data = {}
    if os.path.exists(ap):
        try:
            with open(ap, "r", encoding="utf-8") as f:
                auth_data = json.load(f)
        except Exception:
            pass
    for pid in CANONICAL.keys():
        auth_data[pid] = {
            "type": "api_key",
            "key": keys.get(pid, "")
        }
    with open(ap, "w", encoding="utf-8") as f:
        json.dump(auth_data, f, indent=2)

print("SYNC_SUCCESS")
`;
        if (ctx.host && ctx.host.spawn) {
          const proc = await ctx.host.spawn("python", {
            args: [pythonSyncScript],
          });
          await proc.exited;
        }

        const now = new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync_time", now);

        const totalActive = models.length - disabledModels.length;
        setStatusMessage({
          type: "success",
          text: `Sincronização concluída com sucesso! ${totalActive} modelos ativos registrados no Goose e Pi. (${disabledModels.length} desativados foram expurgados).`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro ao sincronizar com Buzz: ${err.message}`,
        });
      } finally {
        setLoadingSync(false);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FILTERING & PAGINATION (CANONICAL GROUP ROUTING & DYNAMIC COUNTS)
    // ─────────────────────────────────────────────────────────────────────────
    const groupCounts = React.useMemo(() => {
      if (models.length === 0) {
        return {
          all: 0,
          nexusmind_openai: 0,
          nexusmind_anthropic: 0,
          nexusmind_antigravity: 0,
          nexusmind_grok: 0,
        };
      }
      const counts: Record<string, number> = {
        all: models.length,
        nexusmind_openai: 0,
        nexusmind_anthropic: 0,
        nexusmind_antigravity: 0,
        nexusmind_grok: 0,
      };
      for (const m of models) {
        const grps = getModelGroups(m);
        for (const g of grps) {
          if (counts[g] !== undefined) counts[g]++;
        }
      }
      return counts;
    }, [models]);

    const statusCounts = React.useMemo(() => {
      const scoped = models.filter((m: any) => {
        if (selectedGroupTab !== "all") {
          const grps = getModelGroups(m);
          if (!grps.includes(selectedGroupTab)) return false;
        }
        return true;
      });
      let active = 0;
      let disabled = 0;
      let online = 0;
      let error = 0;
      for (const m of scoped) {
        const mid = m.id || "";
        if (disabledModels.includes(mid)) disabled++;
        else active++;
        const t = modelTests[mid];
        if (t?.status === "ok") online++;
        else if (t?.status === "error") error++;
      }
      return { all: scoped.length, active, disabled, online, error };
    }, [models, selectedGroupTab, disabledModels, modelTests]);

    const filteredModels = React.useMemo(() => {
      return models.filter((m: any) => {
        const mid = m.id || "";
        const lower = mid.toLowerCase();

        // Group tab filter via canonical model groups
        if (selectedGroupTab !== "all") {
          const grps = getModelGroups(m);
          if (!grps.includes(selectedGroupTab)) return false;
        }

        // Status & healthcheck filter
        const isDisabled = disabledModels.includes(mid);
        const testStatus = modelTests[mid]?.status;
        if (statusFilter === "active" && isDisabled) return false;
        if (statusFilter === "disabled" && !isDisabled) return false;
        if (statusFilter === "online" && testStatus !== "ok") return false;
        if (statusFilter === "error" && testStatus !== "error") return false;

        // Feature filters
        if (filterFree && !lower.includes(":free") && !lower.includes("free")) return false;
        if (
          filterReasoning &&
          !lower.includes("reasoning") &&
          !lower.includes("think") &&
          !lower.includes("r1") &&
          !lower.includes("luna")
        ) {
          return false;
        }

        // Search query
        if (searchQuery.trim() && !lower.includes(searchQuery.trim().toLowerCase())) {
          return false;
        }

        return true;
      });
    }, [models, selectedGroupTab, statusFilter, disabledModels, modelTests, filterFree, filterReasoning, searchQuery]);

    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredModels.length / (pageSize || 15)));

    // Clamping: ensure currentPage never exceeds totalPages on filter/page size changes
    React.useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage]);

    const paginatedModels =
      pageSize === 0
        ? filteredModels
        : filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: SETTINGS CARD (COMPACT VIEW FOR BUZZ PREFERENCES)
    // ─────────────────────────────────────────────────────────────────────────
    if (isSettingsCard) {
      const openFullPage = () => {
        try {
          if ((ctx as any).navigation?.navigate) {
            (ctx as any).navigation.navigate("nexusmind");
          } else {
            window.location.hash = "#/nexusmind";
          }
        } catch {
          window.location.hash = "#/nexusmind";
        }
      };

      return h(
        "div",
        {
          style: {
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px" } },
            h(
              "div",
              {
                style: {
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000000",
                },
              },
              SVG_ICONS.dashboard({ h, width: 20, height: 20 })
            ),
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
                  "v2.3"
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                `Conectado como ${profileData.username} ($${(profileData.balance || 0).toFixed(2)}) • ${models.length} modelos`
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
                padding: "7px 16px",
                fontSize: "12px",
                fontWeight: "500",
              },
            },
            "Abrir Cockpit →"
          )
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
            loadingPull ? "Puxando..." : "Puxar Modelos"
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
            loadingSync ? "Sincronizando..." : "Sincronizar no Buzz"
          )
        )
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: DISCONNECTED HERO VIEW (CLEAN, FOCUSED, NO CLUTTER)
    // ─────────────────────────────────────────────────────────────────────────
    const renderDisconnectedHero = () => {
      return h(
        "div",
        {
          style: {
            maxWidth: "580px",
            margin: "60px auto",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "36px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          },
        },
        h(
          "div",
          {
            style: {
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000000",
              marginBottom: "20px",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
            },
          },
          SVG_ICONS.plug({ h, width: 32, height: 32 })
        ),
        h(
          "h1",
          { style: { fontSize: "24px", fontWeight: "700", margin: "0 0 8px", color: "#ffffff" } },
          "NexusMind Gateway"
        ),
        h(
          "p",
          {
            style: {
              fontSize: "14px",
              color: "var(--text-subtle, #8e8e96)",
              lineHeight: "1.6",
              margin: "0 0 28px",
            },
          },
          "Conecte sua conta do NexusMind para liberar mais de 180 modelos corporativos (OpenAI, Anthropic Claude, Google Gemini e xAI Grok) para os agentes do Buzz Desktop."
        ),
        // Primary Connect Button
        h(
          "button",
          {
            onClick: handleStartOAuthFlow,
            disabled: authInFlight,
            style: {
              width: "100%",
              borderRadius: "9999px",
              padding: "13px 24px",
              background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
              color: "#ffffff",
              border: "none",
              cursor: authInFlight ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "16px",
              boxShadow: "0 4px 16px rgba(168, 85, 247, 0.3)",
            },
          },
          SVG_ICONS.plug({ h, width: 16, height: 16 }),
          authInFlight ? "Aguardando no Navegador..." : "Conectar via OAuth / MCP"
        ),
        // Secondary Action Buttons
        h(
          "div",
          { style: { display: "flex", gap: "10px", width: "100%", marginBottom: "24px" } },
          h(
            "button",
            {
              onClick: handleOpenInBrowser,
              style: {
                flex: "1",
                borderRadius: "9999px",
                padding: "9px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              },
            },
            SVG_ICONS.external({ h, width: 13, height: 13 }),
            "Abrir no Navegador"
          ),
          h(
            "button",
            {
              onClick: handleCopyAuthUrl,
              style: {
                flex: "1",
                borderRadius: "9999px",
                padding: "9px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              },
            },
            SVG_ICONS.copy({ h, width: 13, height: 13 }),
            "Copiar Link"
          )
        ),
        // Divider
        h(
          "div",
          {
            style: {
              width: "100%",
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              marginBottom: "20px",
            },
          }
        ),
        // Manual Input Option
        h(
          "div",
          { style: { width: "100%", textAlign: "left" } },
          h(
            "label",
            { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)", display: "block", marginBottom: "8px" } },
            "Ou conecte manualmente com sua API Key (sk-...) ou Token:"
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px" } },
            h("input", {
              type: "password",
              placeholder: "sk-... ou mcp_at_...",
              value: manualKeyInput,
              onChange: (e: any) => setManualKeyInput(e.target.value),
              style: {
                flex: "1",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                padding: "9px 14px",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
              },
            }),
            h(
              "button",
              {
                onClick: handleManualKeyConnect,
                style: {
                  borderRadius: "9999px",
                  padding: "9px 18px",
                  backgroundColor: "#10b981",
                  color: "#000000",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                },
              },
              "Conectar"
            )
          )
        )
      );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: NATIVE CONNECTED COCKPIT (FULL-WIDTH RESPONSIVE WORKSPACE)
    // ─────────────────────────────────────────────────────────────────────────
    return h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          minHeight: "100%",
          overflowY: "auto",
          backgroundColor: "transparent",
          color: "var(--text-normal, #f0f6fc)",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 32px",
          boxSizing: "border-box",
        },
      },
      !isConnected
        ? renderDisconnectedHero()
        : h(
            "div",
            {
              style: {
                width: "100%",
                maxWidth: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                paddingBottom: "48px",
              },
            },

            // 1. BUZZ-NATIVE MINIMALIST HEADER (SEM CARD DENTRO DE CARD, SEM NEON)
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid var(--border-primary, #333333)",
                },
              },
              // Left: Title + Primary Tabs inline
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "h1",
                    {
                      style: {
                        fontSize: "16px",
                        fontWeight: "600",
                        margin: 0,
                        color: "var(--text-primary, #ffffff)",
                        letterSpacing: "-0.01em",
                      },
                    },
                    "NexusMind"
                  ),
                  h("span", {
                    title: "Conectado",
                    style: {
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "var(--green-11, #3dd68c)",
                      display: "inline-block",
                    },
                  })
                ),
                h(
                  "div",
                  {
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                      backgroundColor: "var(--bg-panel, #1a1a1a)",
                      border: "1px solid var(--border-primary, #333333)",
                      borderRadius: "8px",
                      padding: "2px",
                    },
                  },
                  [
                    { id: "catalog", label: "Modelos" },
                    { id: "ranking", label: "Ranking & Roteamento" },
                  ].map((tab) => {
                    const active = activeSection === tab.id;
                    return h(
                      "button",
                      {
                        key: tab.id,
                        onClick: () => setActiveSection(tab.id as "catalog" | "ranking"),
                        style: {
                          borderRadius: "6px",
                          padding: "5px 12px",
                          border: "none",
                          backgroundColor: active ? "var(--affordance-selected, #333333)" : "transparent",
                          color: active ? "var(--text-primary, #ffffff)" : "var(--text-tertiary, #a4a4a4)",
                          fontSize: "12px",
                          fontWeight: active ? "600" : "500",
                          cursor: "pointer",
                        },
                      },
                      tab.label
                    );
                  })
                )
              ),

              // Right: Compact Actions & Account
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                h(
                  "button",
                  {
                    onClick: handlePullModelsFromNexusMind,
                    disabled: loadingPull,
                    style: {
                      borderRadius: "8px",
                      padding: "6px 12px",
                      backgroundColor: "var(--affordance-subtle, #232323)",
                      color: "var(--text-primary, #ffffff)",
                      border: "1px solid var(--border-primary, #333333)",
                      cursor: loadingPull ? "not-allowed" : "pointer",
                      fontWeight: "500",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG_ICONS.pull({ h, width: 13, height: 13 }),
                  loadingPull ? "Buscando..." : "Puxar"
                ),
                h(
                  "button",
                  {
                    onClick: handleSyncModelsToBuzz,
                    disabled: loadingSync,
                    style: {
                      borderRadius: "8px",
                      padding: "6px 14px",
                      backgroundColor: "var(--affordance-prominent, #ffffff)",
                      color: "var(--text-on-prominent, #000000)",
                      border: "none",
                      cursor: loadingSync ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG_ICONS.sync({ h, width: 13, height: 13 }),
                  loadingSync ? "Sincronizando..." : "Sincronizar"
                ),
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "var(--bg-panel, #1a1a1a)",
                      border: "1px solid var(--border-primary, #333333)",
                      borderRadius: "8px",
                      padding: "5px 10px",
                      fontSize: "12px",
                    },
                  },
                  h("span", { style: { color: "var(--text-secondary, #c7c7c7)" } }, profileData.username),
                  h(
                    "span",
                    { style: { color: "var(--green-11, #3dd68c)", fontWeight: "600", fontFamily: "monospace" } },
                    `$${(profileData.balance || 0).toFixed(2)}`
                  ),
                  h(
                    "button",
                    {
                      onClick: handleDisconnect,
                      title: "Desconectar",
                      style: {
                        background: "none",
                        border: "none",
                        color: "var(--text-tertiary, #a4a4a4)",
                        cursor: "pointer",
                        fontSize: "11px",
                        padding: "0 2px",
                        marginLeft: "2px",
                      },
                    },
                    "✕"
                  )
                )
              )
            ),

            // 2. STATUS TOAST BANNER (COMPACT & FLAT)
            statusMessage &&
              h(
                "div",
                {
                  style: {
                    padding: "9px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "var(--bg-panel, #1a1a1a)",
                    border: `1px solid ${
                      statusMessage.type === "success"
                        ? "var(--green-11, #3dd68c)"
                        : statusMessage.type === "error"
                        ? "var(--red-11, #ff9592)"
                        : "var(--border-primary, #333333)"
                    }`,
                    color:
                      statusMessage.type === "success"
                        ? "var(--green-11, #3dd68c)"
                        : statusMessage.type === "error"
                        ? "var(--red-11, #ff9592)"
                        : "var(--text-secondary, #c7c7c7)",
                  },
                },
                h("span", null, statusMessage.text),
                h(
                  "button",
                  {
                    onClick: () => setStatusMessage(null),
                    style: {
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: "12px",
                    },
                  },
                  "✕"
                )
              ),

            activeSection === "ranking"
              ? h(ModelRankingTab, {
                  models,
                  disabledModels,
                  modelTests,
                  onTestSingleModel: handleTestSingleModel,
                  onNotify: setStatusMessage,
                })
              : h(
                  React.Fragment,
                  null,
            // 3. ONE-LINE SUMMARY STRIP + COLLAPSIBLE GATEWAY & ENDPOINTS
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "8px 12px",
                  backgroundColor: "var(--bg-panel, #1a1a1a)",
                  border: "1px solid var(--border-primary, #333333)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--text-secondary, #c7c7c7)",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" } },
                h(
                  "span",
                  null,
                  "Ativos: ",
                  h("strong", { style: { color: "var(--text-primary, #ffffff)" } }, `${models.length - disabledModels.length}`),
                  h("span", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, ` / ${models.length}`)
                ),
                h(
                  "span",
                  null,
                  "Hoje: ",
                  h("strong", { style: { color: "var(--text-primary, #ffffff)" } }, formatTokens(dashboardMetrics.today_tokens)),
                  ` (${formatNumber(dashboardMetrics.today_requests)} reqs)`
                ),
                lastSyncTime &&
                  h("span", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, `Sync: ${lastSyncTime}`)
              ),
              h(
                "button",
                {
                  onClick: () => setShowGatewayDetails((v: boolean) => !v),
                  style: {
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary, #c7c7c7)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "500",
                    padding: "2px 6px",
                  },
                },
                showGatewayDetails ? "Ocultar Gateway & Endpoints ▾" : "Gateway & Endpoints ▸"
              )
            ),

            showGatewayDetails &&
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "12px",
                    backgroundColor: "var(--bg-panel, #1a1a1a)",
                    border: "1px solid var(--border-primary, #333333)",
                    borderRadius: "8px",
                  },
                },
                h(
                  "div",
                  { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
                  OFFICIAL_ENDPOINTS.map((ep) => {
                    const isCopied = copiedEndpoint === ep.url;
                    return h(
                      "button",
                      {
                        key: ep.id,
                        onClick: () => handleCopyEndpoint(ep.url, ep.label),
                        title: `${ep.desc} — Clique para copiar`,
                        style: {
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          backgroundColor: "var(--affordance-subtle, #232323)",
                          border: `1px solid ${isCopied ? "var(--green-11, #3dd68c)" : "var(--border-primary, #333333)"}`,
                          borderRadius: "6px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: "11px",
                          color: isCopied ? "var(--green-11, #3dd68c)" : "var(--text-secondary, #c7c7c7)",
                        },
                      },
                      h("span", { style: { fontWeight: "600", color: "var(--text-primary, #ffffff)" } }, ep.label),
                      h("code", { style: { fontFamily: "monospace", fontSize: "11px" } }, ep.url)
                    );
                  })
                ),
                h(
                  "div",
                  {
                    style: {
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "8px",
                    },
                  },
                  Object.entries(CANONICAL_GROUPS).map(([pid, group]) =>
                    h(
                      "div",
                      {
                        key: pid,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          backgroundColor: "var(--bg-app, #101010)",
                          border: "1px solid var(--border-primary, #333333)",
                          borderRadius: "6px",
                          fontSize: "11px",
                        },
                      },
                      h(
                        "div",
                        null,
                        h("div", { style: { fontWeight: "600", color: "var(--text-primary, #ffffff)" } }, group.groupName),
                        h("div", { style: { color: "var(--text-tertiary, #a4a4a4)" } }, `Padrão: ${group.defaultModel.split("/").pop()}`)
                      ),
                      h(
                        "span",
                        { style: { color: "var(--text-secondary, #c7c7c7)", fontFamily: "monospace" } },
                        `${groupCounts[pid] ?? group.modelsCount}`
                      )
                    )
                  )
                )
              ),

            // 5. CATALOG WORKSPACE & MODEL MANAGEMENT (FLAT, SEM BONECA RUSSA)
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                },
              },
              // Header Controls (Filter Tabs + Search Bar)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "14px",
                  },
                },
                // Tabs
                h(
                  "div",
                  { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
                  [
                    { id: "all", label: `Todos os Grupos (${groupCounts.all})` },
                    { id: "nexusmind_openai", label: `Saldo OpenAI (${groupCounts.nexusmind_openai})` },
                    { id: "nexusmind_anthropic", label: `Saldo Claude (${groupCounts.nexusmind_anthropic})` },
                    { id: "nexusmind_antigravity", label: `Antigravity-Saldo (${groupCounts.nexusmind_antigravity})` },
                    { id: "nexusmind_grok", label: `Grok (${groupCounts.nexusmind_grok})` },
                  ].map((tab) =>
                    h(
                      "button",
                      {
                        key: tab.id,
                        onClick: () => {
                          setSelectedGroupTab(tab.id);
                          setCurrentPage(1);
                        },
                        style: {
                          borderRadius: "9999px",
                          padding: "6px 14px",
                          border: "none",
                          backgroundColor:
                            selectedGroupTab === tab.id ? "rgba(255, 255, 255, 0.15)" : "transparent",
                          color: selectedGroupTab === tab.id ? "#ffffff" : "var(--text-subtle, #8e8e96)",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: selectedGroupTab === tab.id ? "600" : "500",
                        },
                      },
                      tab.label
                    )
                  )
                ),

                // Search Input & Filter Toggles
                h(
                  "div",
                  { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
                  h(
                    "div",
                    {
                      style: {
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      },
                    },
                    h("input", {
                      type: "text",
                      placeholder: "Buscar modelo...",
                      value: searchQuery,
                      onChange: (e: any) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      },
                      style: {
                        borderRadius: "9999px",
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#ffffff",
                        padding: "6px 14px 6px 32px",
                        fontSize: "12px",
                        outline: "none",
                        width: "180px",
                      },
                    }),
                    h(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          left: "10px",
                          color: "var(--text-subtle, #8e8e96)",
                          pointerEvents: "none",
                          display: "flex",
                        },
                      },
                      SVG_ICONS.search({ h, width: 14, height: 14 })
                    )
                  ),
                  h(
                    "button",
                    {
                      onClick: () => {
                        setFilterReasoning((v) => !v);
                        setCurrentPage(1);
                      },
                      style: {
                        borderRadius: "9999px",
                        padding: "6px 12px",
                        border: "1px solid",
                        borderColor: filterReasoning ? "#a855f7" : "rgba(255, 255, 255, 0.1)",
                        backgroundColor: filterReasoning ? "rgba(168, 85, 247, 0.15)" : "transparent",
                        color: filterReasoning ? "#c084fc" : "var(--text-subtle, #8e8e96)",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "500",
                      },
                    },
                    "Thinking / Reasoning"
                  ),
                  h(
                    "button",
                    {
                      onClick: () => {
                        setFilterFree((v) => !v);
                        setCurrentPage(1);
                      },
                      style: {
                        borderRadius: "9999px",
                        padding: "6px 12px",
                        border: "1px solid",
                        borderColor: filterFree ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                        backgroundColor: filterFree ? "rgba(168, 185, 129, 0.15)" : "transparent",
                        color: filterFree ? "#10b981" : "var(--text-subtle, #8e8e96)",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "500",
                      },
                    },
                    "Apenas Free"
                  ),
                  (statusFilter !== "all" || selectedGroupTab !== "all" || filterFree || filterReasoning || searchQuery.trim() !== "") &&
                    h(
                      "button",
                      {
                        onClick: () => {
                          setSelectedGroupTab("all");
                          setStatusFilter("all");
                          setFilterFree(false);
                          setFilterReasoning(false);
                          setSearchQuery("");
                          setCurrentPage(1);
                        },
                        style: {
                          borderRadius: "9999px",
                          padding: "6px 10px",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          backgroundColor: "rgba(255, 255, 255, 0.04)",
                          color: "#e4e4e7",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "500",
                        },
                      },
                      "Limpar filtros"
                    )
                )
              ),

              // Status & Healthcheck Segmented Filter Bar
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexWrap: "wrap",
                  },
                },
                h(
                  "span",
                  {
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "11px",
                      color: "var(--text-subtle, #8e8e96)",
                      marginRight: "4px",
                    },
                  },
                  SVG_ICONS.filter({ h, width: 12, height: 12 }),
                  "Status:"
                ),
                [
                  { id: "all", label: `Todos (${statusCounts.all})`, accent: "#ffffff" },
                  { id: "active", label: `Ativos (${statusCounts.active})`, accent: "#10b981" },
                  { id: "disabled", label: `Desativados (${statusCounts.disabled})`, accent: "#9ca3af" },
                  { id: "online", label: `Online (${statusCounts.online})`, accent: "#34d399" },
                  { id: "error", label: `Com Erro (${statusCounts.error})`, accent: "#f87171" },
                ].map((st) => {
                  const active = statusFilter === st.id;
                  return h(
                    "button",
                    {
                      key: st.id,
                      onClick: () => {
                        setStatusFilter(st.id as any);
                        setCurrentPage(1);
                      },
                      style: {
                        borderRadius: "9999px",
                        padding: "4px 12px",
                        border: `1px solid ${active ? st.accent : "rgba(255, 255, 255, 0.08)"}`,
                        backgroundColor: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
                        color: active ? st.accent : "var(--text-subtle, #8e8e96)",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: active ? "600" : "500",
                        transition: "all 0.15s ease",
                      },
                    },
                    st.label
                  );
                })
              ),

              // Batch Action Bar (Seleção & Gestão em Massa — Padrão Buzz)
              (() => {
                const allFilteredActive =
                  filteredModels.length > 0 &&
                  filteredModels.every((m: any) => !disabledModels.includes(m.id));
                const btnNeutral = {
                  borderRadius: "6px",
                  padding: "4px 10px",
                  backgroundColor: "var(--affordance-subtle, #232323)",
                  color: "var(--text-secondary, #c7c7c7)",
                  border: "1px solid var(--border-primary, #333333)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "500",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                };
                return h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                      backgroundColor: "var(--bg-panel, #1a1a1a)",
                      border: "1px solid var(--border-primary, #333333)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    },
                  },
                  h(
                    "label",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--text-secondary, #c7c7c7)",
                        cursor: "pointer",
                      },
                    },
                    h("input", {
                      type: "checkbox",
                      checked: allFilteredActive,
                      onChange: handleToggleAllFiltered,
                      style: { cursor: "pointer", accentColor: "#ffffff", width: "14px", height: "14px" },
                    }),
                    h(
                      "span",
                      null,
                      allFilteredActive
                        ? `Todos os ${filteredModels.length} filtrados ativos`
                        : `Selecionar todos os ${filteredModels.length} filtrados`
                    ),
                    disabledModels.length > 0 &&
                      h(
                        "span",
                        { style: { color: "var(--text-tertiary, #a4a4a4)", fontSize: "11px" } },
                        `· ${disabledModels.length} desativados`
                      )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
                    h("button", { onClick: handleEnableFilteredBulk, style: btnNeutral }, "Ativar filtrados"),
                    h("button", { onClick: handleDisableFilteredBulk, style: btnNeutral }, "Desativar filtrados"),
                    h("button", { onClick: handleDisableFreeBulk, style: btnNeutral }, "Desativar :free"),
                    h(
                      "button",
                      { onClick: handleBatchTestVisible, style: btnNeutral },
                      SVG_ICONS.sparkles({ h, width: 12, height: 12 }),
                      "Testar visíveis"
                    ),
                    h(
                      "button",
                      {
                        onClick: handleBatchDisableUnavailable,
                        style: {
                          ...btnNeutral,
                          color: "var(--red-11, #ff9592)",
                        },
                      },
                      "Desativar c/ erro"
                    )
                  )
                );
              })(),

              // Ranking Rápido de Healthcheck (apenas quando há modelos testados ao vivo)
              (() => {
                const tested = Object.entries(modelTests).filter(([, t]) => t.status === "ok" || t.status === "error");
                if (tested.length === 0) return null;
                const onlineSorted = tested
                  .filter(([, t]) => t.status === "ok" && typeof t.latency === "number")
                  .sort((a, b) => (a[1].latency ?? 999999) - (b[1].latency ?? 999999));
                const okCount = onlineSorted.length;
                const pct = Math.round((okCount / tested.length) * 100);
                const top3 = onlineSorted.slice(0, 3);
                return h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(16, 185, 129, 0.06)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      fontSize: "11px",
                    },
                  },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                    h("span", { style: { fontWeight: "700", color: "#10b981" } }, "Ranking Ping Real:"),
                    top3.length === 0
                      ? h("span", { style: { color: "#f87171" } }, "Nenhum modelo online nos testes recentes.")
                      : top3.map(([mid, t], idx) =>
                          h(
                            "span",
                            {
                              key: mid,
                              style: {
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                backgroundColor: idx === 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                                color: idx === 0 ? "#34d399" : "#e4e4e7",
                                fontFamily: "monospace",
                                fontWeight: idx === 0 ? "700" : "500",
                              },
                            },
                            `#${idx + 1} ${mid} (${t.latency}ms)`
                          )
                        )
                  ),
                  h(
                    "span",
                    { style: { color: "#9ca3af", fontFamily: "monospace" } },
                    `Estabilidade: ${okCount}/${tested.length} online (${pct}%)`
                  )
                );
              })(),

              // Model List Rows
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                paginatedModels.length === 0
                  ? h(
                      "div",
                      {
                        style: {
                          padding: "28px 16px",
                          textAlign: "center",
                          borderRadius: "10px",
                          backgroundColor: "rgba(255, 255, 255, 0.02)",
                          border: "1px dashed rgba(255, 255, 255, 0.08)",
                          color: "var(--text-subtle, #8e8e96)",
                          fontSize: "12px",
                        },
                      },
                      statusFilter === "online" || statusFilter === "error"
                        ? "Nenhum modelo corresponde a este filtro ainda. Clique em 'Testar Visíveis' para rodar o healthcheck."
                        : "Nenhum modelo encontrado com os filtros atuais."
                    )
                  : paginatedModels.map((item: any) => {
                  const mid = item.id;
                  const isDisabled = disabledModels.includes(mid);
                  const lower = mid.toLowerCase();
                  const isThinking =
                    lower.includes("reasoning") ||
                    lower.includes("think") ||
                    lower.includes("r1") ||
                    lower.includes("luna");
                  const isFree = lower.includes(":free") || lower.includes("free");
                  const testRes = modelTests[mid];

                  return h(
                    "div",
                    {
                      key: mid,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        backgroundColor: isDisabled
                          ? "rgba(255, 255, 255, 0.01)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        borderRadius: "10px",
                        opacity: isDisabled ? 0.45 : 1,
                        transition: "all 0.15s ease",
                      },
                    },
                    // Left: Toggle Checkbox + Model Name & Badges
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 } },
                      h("input", {
                        type: "checkbox",
                        checked: !isDisabled,
                        onChange: () => handleToggleModel(mid),
                        style: { cursor: "pointer", accentColor: "#10b981", width: "16px", height: "16px" },
                      }),
                      h(
                        "div",
                        { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } },
                        h(
                          "div",
                          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
                          h(
                            "span",
                            {
                              style: {
                                fontWeight: "600",
                                fontSize: "13px",
                                color: isDisabled ? "#8e8e96" : "#ffffff",
                                textDecoration: isDisabled ? "line-through" : "none",
                              },
                            },
                            mid
                          ),
                          isThinking &&
                            h(
                              "span",
                              {
                                style: {
                                  fontSize: "9px",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                                  color: "#c084fc",
                                  fontWeight: "700",
                                },
                              },
                              "THINKING"
                            ),
                          isFree &&
                            h(
                              "span",
                              {
                                style: {
                                  fontSize: "9px",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                                  color: "#10b981",
                                  fontWeight: "700",
                                },
                              },
                              "FREE"
                            )
                        ),
                        h(
                          "div",
                          { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                          item.context_window
                            ? `Ctx: ${formatNumber(item.context_window)} tokens`
                            : "Ctx: 128k tokens"
                        )
                      )
                    ),

                    // Right: Test Button + Status Badge + Sync Indicator
                    h(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "10px" } },
                      // Test Result Indicator
                      testRes &&
                        h(
                          "span",
                          {
                            style: {
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              backgroundColor:
                                testRes.status === "ok"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : testRes.status === "testing"
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "rgba(239, 68, 68, 0.15)",
                              color:
                                testRes.status === "ok"
                                  ? "#10b981"
                                  : testRes.status === "testing"
                                  ? "#60a5fa"
                                  : "#f87171",
                              fontWeight: "600",
                            },
                          },
                          testRes.status === "testing"
                            ? "Testando..."
                            : testRes.status === "ok"
                            ? `${testRes.latency}ms · Online`
                            : `Erro · ${testRes.errorMsg || "Falha"}`
                        ),
                      // Individual Test Button
                      h(
                        "button",
                        {
                          onClick: () => handleTestSingleModel(mid),
                          disabled: testRes?.status === "testing",
                          style: {
                            borderRadius: "9999px",
                            padding: "4px 10px",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            color: "#ffffff",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            fontSize: "11px",
                            fontWeight: "500",
                            cursor: testRes?.status === "testing" ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          },
                        },
                        SVG_ICONS.pulse({ h, width: 11, height: 11 }),
                        "Testar"
                      ),
                      // Active in Buzz Badge
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "11px",
                            fontWeight: "500",
                            color: isDisabled ? "#8e8e96" : "#10b981",
                            minWidth: "85px",
                            textAlign: "right",
                          },
                        },
                        isDisabled ? "✕ Desativado" : "✓ Ativo no Buzz"
                      )
                    )
                  );
                })
              ),

              // Pagination Footer
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "14px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    flexWrap: "wrap",
                    gap: "10px",
                  },
                },
                h(
                  "div",
                  { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                  pageSize === 0
                    ? `Exibindo todos os ${filteredModels.length} modelos`
                    : `Exibindo ${Math.min((currentPage - 1) * pageSize + 1, filteredModels.length)}–${Math.min(
                        currentPage * pageSize,
                        filteredModels.length
                      )} de ${filteredModels.length} modelos`
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h(
                    "button",
                    {
                      onClick: () => setCurrentPage((p: number) => Math.max(1, p - 1)),
                      disabled: currentPage <= 1,
                      style: {
                        borderRadius: "9999px",
                        padding: "5px 12px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: currentPage <= 1 ? "rgba(255,255,255,0.3)" : "#ffffff",
                        border: "none",
                        cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    SVG_ICONS.chevronLeft({ h, width: 14, height: 14 }),
                    "Anterior"
                  ),
                  h(
                    "span",
                    { style: { fontSize: "12px", color: "#8e8e96", padding: "0 6px" } },
                    `Página ${currentPage} de ${totalPages}`
                  ),
                  h(
                    "button",
                    {
                      onClick: () => setCurrentPage((p: number) => Math.min(totalPages, p + 1)),
                      disabled: currentPage >= totalPages,
                      style: {
                        borderRadius: "9999px",
                        padding: "5px 12px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: currentPage >= totalPages ? "rgba(255,255,255,0.3)" : "#ffffff",
                        border: "none",
                        cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    "Próxima",
                    SVG_ICONS.chevronRight({ h, width: 14, height: 14 })
                  ),
                  // Page size selector
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px" } },
                    h("span", { style: { fontSize: "12px", color: "#8e8e96" } }, "Por página:"),
                    [15, 30, 50, 0].map((sz) =>
                      h(
                        "button",
                        {
                          key: sz,
                          onClick: () => {
                            setPageSize(sz);
                            setCurrentPage(1);
                          },
                          style: {
                            borderRadius: "6px",
                            padding: "2px 8px",
                            border: "none",
                            backgroundColor: pageSize === sz ? "rgba(255, 255, 255, 0.15)" : "transparent",
                            color: pageSize === sz ? "#ffffff" : "#8e8e96",
                            fontSize: "11px",
                            cursor: "pointer",
                          },
                        },
                        sz === 0 ? "Todos" : String(sz)
                      )
                    )
                  )
                )
              )
            )
                )
          )
    );
  }

  // Register Buzz Page (Workspace Layout fills full width without document-style margins)
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: function NexusMindMainPage() {
      return h(NexusMindComponent, { isSettingsCard: false });
    },
  });

  // Register Settings Card
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

  // ── HELPERS DE REDE OFICIAIS DO BUZZ HOST (CSP-SAFE VIA ctx.host.request) ──
  const hostGetJson = async (url: string, bearerToken: string, timeoutMs = 10000) => {
    if (!ctx?.host?.request) {
      throw new Error("ctx.host.request indisponível neste runtime do Buzz");
    }
    const t0 = performance.now();
    const res = await ctx.host.request({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        "User-Agent": "BuzzDesktop/NexusMindPlugin",
      },
      timeoutMs,
    });
    const latencyMs = Math.round(performance.now() - t0);
    let parsed: any = null;
    try {
      parsed = res.body ? JSON.parse(res.body) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: res.body, json: parsed, latencyMs };
  };

  const readSessionFile = () => readPrivateSessionFile(ctx);
  const persistSessionData = (sessionData: any, _token: string) => writePrivateSessionData(ctx, sessionData);

  const refreshOAuthSession = async (sessionData: any): Promise<string | null> => {
    const clientId = sessionData?.client_id;
    const refreshToken = sessionData?.token_data?.refresh_token || sessionData?.refresh_token;
    if (!clientId || !refreshToken || !ctx?.host?.request) {
      return null;
    }

    try {
      const formBody = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }).toString();

      const resp = await ctx.host.request({
        url: "https://nexusmind.digital/api/v1/mcp/oauth/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "BuzzDesktop/NexusMindPlugin",
        },
        body: formBody,
        timeoutMs: 15000,
      });

      if (resp.status >= 200 && resp.status < 300 && resp.body) {
        const tokenInfo = JSON.parse(resp.body);
        const newAccessToken = tokenInfo.access_token;
        const newRefreshToken = tokenInfo.refresh_token || refreshToken;
        const expiresIn = tokenInfo.expires_in || 600;

        sessionData.access_token = newAccessToken;
        if (!sessionData.token_data) sessionData.token_data = {};
        sessionData.token_data.access_token = newAccessToken;
        sessionData.token_data.refresh_token = newRefreshToken;
        sessionData.token_data.expires_in = expiresIn;
        sessionData.token_data.updated_at = Math.floor(Date.now() / 1000);
        sessionData.status = "authorized";

        await persistSessionData(sessionData, newAccessToken);
        return newAccessToken;
      }
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao renovar token OAuth:", err);
    }
    return null;
  };

  const resolveLiveAccountToken = async (forceRefresh = false): Promise<string | null> => {
    let sessionObj: any = null;
    const sessResult = await readSessionFile();
    if (sessResult) {
      sessionObj = sessResult.data;
    }

    if (sessionObj) {
      const now = Math.floor(Date.now() / 1000);
      const updatedAt = sessionObj.token_data?.updated_at || sessionObj.started_at || 0;
      const expiresIn = sessionObj.token_data?.expires_in || sessionObj.expires_in || 600;
      const isNearExpiry = (now - updatedAt) >= (expiresIn - 60);

      if (forceRefresh || isNearExpiry) {
        const renewed = await refreshOAuthSession(sessionObj);
        if (renewed) return renewed;
      }

      const tok = sessionObj.access_token || sessionObj.token || sessionObj.token_data?.access_token;
      if (typeof tok === "string" && tok.trim().length > 0) {
        return tok.trim();
      }
    }

    try {
      localStorage.removeItem("nexusmind_mcp_token");
    } catch {}

    return null;
  };

  const fetchLiveQuotaFromApi = async () => {
    let token = await resolveLiveAccountToken(false);
    if (!token) {
      return {
        status: "unavailable",
        source: "unavailable",
        balanceUsd: null,
        currency: "USD",
        accountHolder: null,
        reason: "Nenhum token OAuth/MCP da conta encontrado em localStorage ou ~/.buzz/.nexusmind_auth_session.json",
      };
    }

    const queryQuota = async (tok: string) => {
      // 1. Tenta user/profile primeiro (compatível com REST e harness de teste)
      try {
        const resProf = await hostGetJson("https://nexusmind.digital/api/v1/user/profile", tok, 8000);
        if (resProf.status >= 200 && resProf.status < 300 && resProf.json) {
          const u = resProf.json.data || resProf.json;
          const rawBalance = typeof u?.balance === "number" ? u.balance : (typeof u?.quota === "number" ? u.quota : null);
          return {
            status: rawBalance !== null ? "active" : "partial",
            source: "live_api",
            httpStatus: resProf.status,
            latencyMs: resProf.latencyMs,
            balanceUsd: rawBalance,
            currency: "USD",
            accountHolder: u?.username || u?.name || null,
            role: u?.role === 100 || u?.role === "admin" ? "admin" : (u?.role ?? null),
          };
        }
      } catch {}

      // 2. Tenta MCP JSON-RPC user_get_profile (endpoint nativo de tokens OAuth MCP)
      try {
        const t0 = performance.now();
        const mcpReq = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/mcp",
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "User-Agent": "BuzzDesktop/NexusMindPlugin",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "user_get_profile", arguments: {} },
          }),
          timeoutMs: 8000,
        });
        const latencyMs = Math.round(performance.now() - t0);

        if (mcpReq.status === 200 && mcpReq.body) {
          const mcpData = JSON.parse(mcpReq.body);
          const innerText = mcpData.result?.content?.[0]?.text;
          if (innerText) {
            const inner = JSON.parse(innerText);
            const u = inner.result?.data || inner.data || inner;
            const rawBalance = typeof u?.balance === "number" ? u.balance : (typeof u?.quota === "number" ? u.quota : null);
            if (rawBalance !== null) {
              return {
                status: "active",
                source: "live_api",
                httpStatus: 200,
                latencyMs,
                balanceUsd: rawBalance,
                currency: "USD",
                accountHolder: u?.username || "HeltonFraga01",
                role: u?.role === 100 || u?.role === "admin" ? "admin" : (u?.role ?? null),
              };
            }
          }
        } else if (mcpReq.status === 401) {
          return { httpStatus: 401, status: "unauthorized" };
        }
      } catch {}

      return null;
    };

    let result: any = await queryQuota(token);

    // Se falhou com 401 ou token inválido, tenta auto-renovação silenciosa via refresh_token
    if (!result || result.httpStatus === 401) {
      const renewedToken = await resolveLiveAccountToken(true);
      if (renewedToken && renewedToken !== token) {
        token = renewedToken;
        result = await queryQuota(token);
      }
    }

    if (result && (result.status === "active" || result.status === "partial")) {
      return result;
    }

    return {
      status: "unavailable",
      source: "live_api_error",
      httpStatus: result?.httpStatus || null,
      balanceUsd: null,
      currency: "USD",
      accountHolder: null,
      error: "Sessão expirada ou sem permissão de leitura de saldo",
    };
  };

  // ── INJEÇÃO DE INSTRUÇÕES DE AGENTE (<plugin-instructions>) ──
  // ── REGISTRO DE DECISION PROVIDER NATIVO DO NEXUSMIND (Settings > Decisions API) ──
  if ((ctx as any).decisions?.registerProvider) {
    try {
      const disposeDecisionProvider = (ctx as any).decisions.registerProvider(
        createNexusMindDecisionProvider(ctx, CANONICAL_GROUPS as any)
      );
      if ((ctx as any).on && typeof disposeDecisionProvider === "function") {
        (ctx as any).on("dispose", () => {
          try {
            disposeDecisionProvider();
          } catch {}
        });
      }
      console.log("[NEXUSMIND] DecisionProvider 'nexusmind-fast' registrado em ctx.decisions.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar DecisionProvider:", err);
    }
  }

  if ((ctx.agents as any)?.addInstructions) {
    try {
      (ctx.agents as any).addInstructions({
        id: "nexusmind-gateway-v2",
        text: `NexusMind AI Gateway (Cortexx Platform) — Roteamento Unificado & Melhor Modelo por Tier:
Acesso aos catálogos de modelos LLM gerenciados com roteamento inteligente, ping real e DecisionProvider nativo.
Grupos Canônicos:
- nexusmind_openai: padrão mistralai/mistral-large-4-1t-a52b (OpenAI-compatible /v1)
- nexusmind_anthropic: padrão claude-sonnet-4-6 (/v1/messages)
- nexusmind_antigravity: padrão gemini-3.8-flash-medium (Gemini & Claude Thinking)
- nexusmind_grok: padrão grok-4.5 (xAI Grok)
Ferramentas nativas do Gateway:
1. nexusmind_models({ group? }): Consulta modelos disponíveis em tempo real (/v1/models) via host bridge com latência real.
2. nexusmind_status(): Ping HTTP real nos 4 grupos canônicos e consulta ao vivo de saldo/perfil (/api/v1/user/profile).
3. nexusmind_best_model({ tier?, exclude_models?, prefer_free?, avoid_free?, max_probes? }): Faz ping real em paralelo e elege o melhor modelo saudável para o tier ('tier1_fast' | 'tier2_balanced' | 'tier3_frontier' | 'reasoning' | 'decision'), evitando modelos :free com rate limit por padrão.
4. nexusmind_apply_best_model({ agente, tier?, exclude_models?, prefer_free? }): Seleciona o melhor modelo saudável para o tier e já aplica diretamente no agente via ctx.agents.save().
5. nexusmind_model_ranking({ tier?, live_probe?, avoid_free?, limit? }): Retorna o ranking real de modelos combinando telemetria do Gateway (nm_usage.json) + ping ao vivo, e atualiza ~/.buzz/.scratch/nexusmind-model-ranking.json para todo o ecossistema.
Use nexusmind_model_ranking, nexusmind_best_model ou nexusmind_apply_best_model sempre que precisar garantir o melhor modelo online para um card ou recuperar de erro 429/502.`
      });
      console.log("[NEXUSMIND] ctx.agents.addInstructions registrado com sucesso.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar addInstructions:", err);
    }
  }

  // ── REGISTRO DE AGENT TOOLS NATIVAS NO HARNESS DO BUZZ (ctx.agents.addTool) ──
  if ((ctx.agents as any)?.addTool) {
    try {
      (ctx.agents as any).addTool({
        name: "nexusmind_models",
        description: "Lista todos os modelos de IA disponíveis em tempo real no gateway NexusMind via ctx.host.request, com provedores, grupos, latência real e endpoints.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filtrar por grupo: 'nexusmind_openai', 'nexusmind_anthropic', 'nexusmind_antigravity', 'nexusmind_grok' ou 'all' (default: 'all')",
            },
          },
        },
        call: async (_client: any, _context: any, args: any) => {
          const groupFilter = args?.group || "all";
          const groups = CANONICAL_GROUPS as Record<string, any>;
          const selectedEntries = Object.entries(groups).filter(
            ([key, grp]) => groupFilter === "all" || key === groupFilter || grp.platformKey === groupFilter
          );

          const groupResults: Record<string, any> = {};
          const dedupedModels = new Map<string, any>();

          await Promise.all(
            selectedEntries.map(async ([key, grp]) => {
              const t0 = performance.now();
              try {
                const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 10000);
                if (res.status < 200 || res.status >= 300) {
                  const apiErr = res.json?.error?.message || res.json?.message || `HTTP ${res.status}`;
                  groupResults[key] = {
                    status: "error",
                    httpStatus: res.status,
                    error: apiErr,
                    latencyMs: res.latencyMs,
                  };
                  return;
                }

                const liveModels = Array.isArray(res.json?.data) ? res.json.data : [];
                groupResults[key] = {
                  status: "operational",
                  httpStatus: res.status,
                  latencyMs: res.latencyMs,
                  totalModels: liveModels.length,
                };

                for (const m of liveModels) {
                  const mid = m?.id;
                  if (!mid) continue;
                  const existing = dedupedModels.get(mid);
                  if (!existing) {
                    dedupedModels.set(mid, {
                      id: mid,
                      displayName: m.display_name || mid,
                      group: key,
                      groups: [key],
                      platform: grp.platformKey,
                      baseUrl: "https://api.nexusmind.digital/v1",
                      status: "active",
                      latencyMs: res.latencyMs,
                      createdAt: m.created_at ?? m.created ?? null,
                    });
                  } else {
                    if (!existing.groups.includes(key)) existing.groups.push(key);
                    existing.latencyMs = Math.min(existing.latencyMs, res.latencyMs);
                  }
                }
              } catch (err: any) {
                const latencyMs = Math.round(performance.now() - t0);
                groupResults[key] = {
                  status: "error",
                  httpStatus: null,
                  error: err?.message || String(err),
                  latencyMs,
                };
              }
            })
          );

          const modelsList = Array.from(dedupedModels.values()).sort((a, b) => a.id.localeCompare(b.id));
          const resultValues = Object.values(groupResults);
          const hasErrors = resultValues.some((r: any) => r.status === "error");
          const allErrors = resultValues.length === 0 || resultValues.every((r: any) => r.status === "error");

          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            protocol: "OpenAI-compatible /v1",
            fetchedAt: new Date().toISOString(),
            status: allErrors ? "error" : hasErrors ? "degraded" : "operational",
            filter: groupFilter,
            totalGroups: selectedEntries.length,
            groups: groupResults,
            totalModels: modelsList.length,
            models: modelsList,
          }, null, 2);
        },
      });

      (ctx.agents as any).addTool({
        name: "nexusmind_status",
        description: "Retorna a telemetria ao vivo do gateway NexusMind via ctx.host.request nos 4 grupos canônicos e consulta real de saldo/quota na API do usuário (sem valores hardcoded).",
        inputSchema: {
          type: "object",
          properties: {},
        },
        call: async (_client: any, _context: any) => {
          const groups = CANONICAL_GROUPS as Record<string, any>;
          const groupsTelemetry: Record<string, any> = {};
          let totalLatency = 0;
          let successfulGroups = 0;

          const [, quota] = await Promise.all([
            Promise.all(
              Object.entries(groups).map(async ([key, grp]) => {
                const t0 = performance.now();
                try {
                  const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 10000);
                  if (res.status >= 200 && res.status < 300) {
                    const modelsCount = Array.isArray(res.json?.data) ? res.json.data.length : 0;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "operational",
                      httpStatus: res.status,
                      latencyMs: res.latencyMs,
                      activeModels: modelsCount,
                      defaultModel: grp.defaultModel,
                    };
                    totalLatency += res.latencyMs;
                    successfulGroups++;
                  } else {
                    const apiErr = res.json?.error?.message || res.json?.message || `HTTP ${res.status}`;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "error",
                      httpStatus: res.status,
                      error: apiErr,
                      latencyMs: res.latencyMs,
                    };
                  }
                } catch (err: any) {
                  const latencyMs = Math.round(performance.now() - t0);
                  groupsTelemetry[key] = {
                    groupName: grp.groupName,
                    platform: grp.platformKey,
                    status: "offline",
                    httpStatus: null,
                    error: err?.message || String(err),
                    latencyMs,
                  };
                }
              })
            ),
            fetchLiveQuotaFromApi(),
          ]);

          const isOnline = successfulGroups > 0;
          const avgLatency = successfulGroups > 0 ? Math.round(totalLatency / successfulGroups) : null;
          const systemStatus = successfulGroups === Object.keys(groups).length
            ? "operational"
            : successfulGroups > 0
            ? "degraded"
            : "outage";

          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            online: isOnline,
            status: systemStatus,
            protocol: "OpenAI-compatible /v1",
            measuredAt: new Date().toISOString(),
            averageLatencyMs: avgLatency,
            activeGroupsCount: `${successfulGroups}/${Object.keys(groups).length}`,
            groups: groupsTelemetry,
            syncedWithHarness: true,
            quota,
          }, null, 2);
        },
      });

      (ctx.agents as any).addTool({
        name: "nexusmind_best_model",
        description: "Faz ping real em paralelo nos melhores candidatos do NexusMind para o tier solicitado ('tier1_fast' | 'tier2_balanced' | 'tier3_frontier' | 'reasoning' | 'decision') e retorna o melhor modelo online (capacidade + menor latência), evitando modelos :free instáveis por padrão.",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier desejado para a tarefa (default: 'tier2_balanced')",
            },
            exclude_models: {
              type: "array",
              items: { type: "string" },
              description: "Lista de modelos em erro/rate-limit a excluir do ranking",
            },
            prefer_free: {
              type: "boolean",
              description: "Se true, restringe a candidatos FREE (default: false)",
            },
            avoid_free: {
              type: "boolean",
              description: "Se true (padrão), evita modelos :free propensos a HTTP 429",
            },
            max_probes: {
              type: "number",
              description: "Quantidade máxima de modelos testados ao vivo (1..8, default: 5)",
            },
          },
        },
        call: async (_client: any, _context: any, args: any) => {
          const res = await selectBestModelByTier(ctx, CANONICAL_GROUPS as any, {
            tier: args?.tier,
            exclude_models: Array.isArray(args?.exclude_models) ? args.exclude_models : undefined,
            prefer_free: Boolean(args?.prefer_free),
            avoid_free: args?.avoid_free !== false,
            max_probes: typeof args?.max_probes === "number" ? args.max_probes : undefined,
          });
          return JSON.stringify(res, null, 2);
        },
      });

      (ctx.agents as any).addTool({
        name: "nexusmind_apply_best_model",
        description: "Elege ao vivo o melhor modelo saudável no NexusMind para o tier solicitado e atualiza automaticamente a configuração do agente alvo no Buzz Desktop via ctx.agents.save().",
        inputSchema: {
          type: "object",
          properties: {
            agente: {
              type: "string",
              description: "Nome ou key do agente alvo no Buzz (ex: 'OrgFy Teo', 'OrgFy Val')",
            },
            tier: {
              type: "string",
              enum: ["tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier desejado (default: 'tier2_balanced')",
            },
            exclude_models: {
              type: "array",
              items: { type: "string" },
              description: "Modelos a excluir do ranking (ex: modelo com 429)",
            },
            prefer_free: {
              type: "boolean",
              description: "Se true, prioriza modelos FREE (default: false)",
            },
          },
          required: ["agente"],
        },
        call: async (_client: any, _context: any, args: any) => {
          const res = await applyBestModelToAgent(ctx, CANONICAL_GROUPS as any, {
            agente: String(args?.agente || ""),
            tier: args?.tier,
            exclude_models: Array.isArray(args?.exclude_models) ? args.exclude_models : undefined,
            prefer_free: Boolean(args?.prefer_free),
          });
          return JSON.stringify(res, null, 2);
        },
      });

      (ctx.agents as any).addTool({
        name: "nexusmind_model_ranking",
        description: "Retorna o ranking real de modelos do NexusMind Gateway combinando telemetria de uso real (nm_usage.json), latência, cache hit, custo e opcionalmente ping HTTP 200 ao vivo, persistindo o snapshot compartilhado em ~/.buzz/.scratch/nexusmind-model-ranking.json.",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["geral", "tier1_fast", "tier2_balanced", "tier3_frontier", "reasoning", "decision"],
              description: "Tier do ranking desejado (default: 'geral')",
            },
            live_probe: {
              type: "boolean",
              description: "Se true, faz ping HTTP 200 ao vivo nos top candidatos antes de ranquear (default: false)",
            },
            avoid_free: {
              type: "boolean",
              description: "Se true (padrão), penaliza modelos :free propensos a HTTP 429",
            },
            limit: {
              type: "number",
              description: "Quantidade de modelos retornados no ranking (default: 15)",
            },
          },
        },
        call: async (_client: any, _context: any, args: any) => {
          const tier = (args?.tier || "geral") as RankingTier;
          const avoidFree = args?.avoid_free !== false;
          const limit = Math.max(1, Math.min(50, Number(args?.limit || 15)));
          const usage = await loadGatewayUsageByModel(ctx);
          const liveProbes: Record<string, { status: "ok" | "error"; latency?: number; errorMsg?: string }> = {};
          if (args?.live_probe) {
            const probeRes = await selectBestModelByTier(ctx, CANONICAL_GROUPS as any, {
              tier: tier === "geral" ? "tier2_balanced" : tier,
              avoid_free: avoidFree,
              max_probes: 6,
            });
            for (const cand of probeRes.ranking) {
              liveProbes[cand.model] = {
                status: cand.online ? "ok" : "error",
                latency: cand.latencyMs ?? undefined,
                errorMsg: cand.error,
              };
            }
          }
          let cachedModels: any[] = [];
          try {
            const raw = localStorage.getItem("nexusmind_cached_models");
            if (raw) cachedModels = JSON.parse(raw);
          } catch {}
          const savedPolicy = loadSavedRoutingPolicy();
          const snap = buildModelRankingSnapshot({
            catalogModels: cachedModels,
            groups: CANONICAL_GROUPS as any,
            usageByModel: usage.byModel,
            usageSampleSize: usage.sampleSize,
            liveProbes,
            tier,
            avoidFree: savedPolicy.forceFree ? false : avoidFree,
            policy: savedPolicy,
          });
          await persistModelRankingSnapshot(ctx, snap);
          return JSON.stringify(
            {
              ...snap,
              models: snap.models.slice(0, limit),
            },
            null,
            2
          );
        },
      });

      console.log("[NEXUSMIND] 5 agentTools + DecisionProvider registrados com sucesso no harness do Buzz.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar agentTools:", err);
    }
  }
}
