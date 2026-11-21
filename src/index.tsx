import type { Context } from "@buzz/author";

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
      props.h("rect", { x: 3, y: 3, width: 7, height: 7 }),
      props.h("rect", { x: 14, y: 3, width: 7, height: 7 }),
      props.h("rect", { x: 14, y: 14, width: 7, height: 7 }),
      props.h("rect", { x: 3, y: 14, width: 7, height: 7 })
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
};

export const inject = ["react", "pages", "settingsCards", "host"];

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'
  );

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL GROUPS CONFIGURATION (MAPPED TO OFFICIAL LOGOS)
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_GROUPS = {
  nexusmind_openai: {
    id: "nexusmind_openai",
    platformKey: "openai",
    groupName: "Saldo OpenAI",
    displayName: "NexusMind OpenAI",
    description: "OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
    defaultKey: "sk-2ee0581e607d02f3485e0efcad2ff686e2b889720f63497813b8fb45eb9d0f08",
    defaultModel: "mistralai/mistral-large-4-1t-a52b",
    defaultCtx: 131072,
    defaultOut: 8192,
    accentColor: "#10a37f",
    logoKey: "openai",
    operationalNote: "NVIDIA NIM e contas OpenCode operam neste grupo.",
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    platformKey: "anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    description: "Modelos Anthropic Claude (Contingência ativa via Antigravity)",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 200000,
    defaultOut: 8192,
    accentColor: "#d97706",
    logoKey: "claude",
    operationalNote: "Contingência: Modelos Claude ativos também operam em Antigravity-Saldo.",
  },
  nexusmind_antigravity: {
    id: "nexusmind_antigravity",
    platformKey: "antigravity",
    groupName: "Antigravity-Saldo",
    displayName: "NexusMind Anti-Gravity",
    description: "Google Gemini, Claude e Anti-Gravity Gateway",
    defaultKey: "sk-cf8ffed3d96eff9ca80093aee98c589dcf67cf6932c76cd45e223429204051a0",
    defaultModel: "gemini-3.8-flash-medium",
    defaultCtx: 1048576,
    defaultOut: 65536,
    accentColor: "#0284c7",
    logoKey: "gemini",
    operationalNote: "Gateway corporativo de alto throughput e suporte a raciocínio estendido.",
  },
  nexusmind_grok: {
    id: "nexusmind_grok",
    platformKey: "grok",
    groupName: "Grok",
    displayName: "NexusMind Grok",
    description: "Modelos xAI Grok (grok-4.5, multimodal)",
    defaultKey: "sk-f37b255eada36a40a2520cc43700e6583e9773d16b3543a77a147ce87043a3df",
    defaultModel: "grok-4.5",
    defaultCtx: 131072,
    defaultOut: 16384,
    accentColor: "#8b5cf6",
    logoKey: "grok",
    operationalNote: "Modelos oficiais xAI Grok com raciocínio e visão multimodal.",
  },
};

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
    // MCP Server & OAuth Session Token
    const [mcpToken, setMcpToken] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_mcp_token") || "";
      } catch {
        return "";
      }
    });

    // Profile & Telemetry Dashboard State
    const [profileData, setProfileData] = React.useState<UserProfileData | null>(() => {
      try {
        const s = localStorage.getItem("nexusmind_profile_cache");
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    });

    const [dashboardMetrics, setDashboardMetrics] = React.useState<DashboardMetrics | null>(() => {
      try {
        const s = localStorage.getItem("nexusmind_metrics_cache");
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    });

    // OAuth In-Flight Authorization Flow State
    const [authInFlight, setAuthInFlight] = React.useState(false);
    const [generatedAuthUrl, setGeneratedAuthUrl] = React.useState("");

    // Models catalog
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

    // Filter & Pagination States
    const [selectedGroupTab, setSelectedGroupTab] = React.useState<string>("all");
    const [filterFree, setFilterFree] = React.useState(false);
    const [filterReasoning, setFilterReasoning] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [pageSize, setPageSize] = React.useState<number>(15);
    const [currentPage, setCurrentPage] = React.useState<number>(1);

    // Operation status
    const [loadingPull, setLoadingPull] = React.useState(false);
    const [loadingSync, setLoadingSync] = React.useState(false);
    const [lastSyncTime, setLastSyncTime] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync") || "";
      } catch {
        return "";
      }
    });

    const [statusMessage, setStatusMessage] = React.useState<{
      type: "success" | "error" | "info";
      text: string;
    } | null>(null);

    // Reset pagination when search or filters change
    React.useEffect(() => {
      setCurrentPage(1);
    }, [searchQuery, selectedGroupTab, filterFree, filterReasoning, pageSize]);

    // Fetch full Profile and Dashboard Telemetry from NexusMind MCP
    const fetchTelemetry = async (tokenToUse: string) => {
      const token = tokenToUse.trim();
      if (!token) return;

      try {
        // 1. Fetch Profile
        const profRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/profile",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.2",
          },
          timeoutMs: 12000,
        });

        if (profRes.status === 200) {
          const body = JSON.parse(profRes.body);
          const u = body.data || {};
          const profile: UserProfileData = {
            username: u.username || "HeltonFraga01",
            email: u.email || "",
            balance: u.balance ?? 0,
            role: u.role === 100 ? "admin" : "user",
            status: u.status === 1 ? "active" : "disabled",
            allowedGroups: u.allowed_groups || [],
          };
          setProfileData(profile);
          localStorage.setItem("nexusmind_profile_cache", JSON.stringify(profile));
        }

        // 2. Fetch Dashboard Telemetry (Usage, Requests, Platform breakdown)
        const dashRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/dashboard",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.2",
          },
          timeoutMs: 12000,
        });

        if (dashRes.status === 200) {
          const dashBody = JSON.parse(dashRes.body);
          const d = dashBody.data || {};
          const metrics: DashboardMetrics = {
            today_tokens: d.today_tokens || 0,
            today_requests: d.today_requests || 0,
            today_cost: d.today_cost || 0,
            total_tokens: d.total_tokens || 0,
            total_requests: d.total_requests || 0,
            total_cost: d.total_cost || 0,
            by_platform: d.by_platform || [],
          };
          setDashboardMetrics(metrics);
          localStorage.setItem("nexusmind_metrics_cache", JSON.stringify(metrics));
        }
      } catch (e: any) {
        console.error("Telemetry fetch failed", e);
      }
    };

    // Auto-refresh telemetry on mount if token is saved
    React.useEffect(() => {
      if (mcpToken) {
        fetchTelemetry(mcpToken);
      }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTOMATED SUB2API MCP OAUTH PKCE FLOW
    // ─────────────────────────────────────────────────────────────────────────
    const handleStartOAuthFlow = async () => {
      setAuthInFlight(true);
      setStatusMessage({
        type: "info",
        text: "Iniciando autenticação OAuth 2.0 PKCE com o NexusMind...",
      });

      // Self-contained python script to execute dynamic client registration & ephemeral callback
      const authHelperPy = `
import os, sys, json, ssl, time, base64, hashlib, secrets, threading, urllib.parse, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

SESSION_FILE = os.path.expanduser("~/.buzz/.nexusmind_auth_session.json")
MCP_HOST = "https://nexusmind.digital"
MCP_RESOURCE = f"{MCP_HOST}/api/v1/mcp"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

received_code = {}
auth_event = threading.Event()

class CallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/callback":
            qs = urllib.parse.parse_qs(parsed.query)
            code = qs.get("code", [None])[0]
            state = qs.get("state", [None])[0]
            error = qs.get("error", [None])[0]
            if error:
                received_code["error"] = error
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(f"<h1>Erro na autorização: {error}</h1>".encode("utf-8"))
            elif code:
                received_code["code"] = code
                received_code["state"] = state
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                html = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>NexusMind Conectado</title>
<style>body{font-family:system-ui;background:#0b0f17;color:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:#131c2e;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:40px;text-align:center;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.6);}
h1{color:#10b981;margin:0 0 12px;font-size:24px;font-weight:700;}p{color:#94a3b8;font-size:14px;line-height:1.5;margin:0 0 16px;}
.badge{display:inline-block;background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;}
</style></head><body><div class="card"><div style="font-size:48px;margin-bottom:16px;">⚡</div><h1>Conexão Autorizada!</h1>
<p>O NexusMind Gateway foi conectado com sucesso ao <strong>Buzz Desktop</strong>.</p>
<div class="badge">Sessão MCP Ativa</div><p style="margin-top:20px;font-size:12px;color:#64748b;">Você já pode fechar esta aba e retornar ao aplicativo.</p></div></body></html>"""
                self.wfile.write(html.encode("utf-8"))
            auth_event.set()
        else:
            self.send_response(404)
            self.end_headers()

httpd = HTTPServer(("127.0.0.1", 0), CallbackHandler)
port = httpd.server_address[1]
redirect_uri = f"http://127.0.0.1:{port}/callback"

# RFC 7591 Dynamic Registration
reg_data = json.dumps({
    "client_name": "Buzz Desktop",
    "token_endpoint_auth_method": "none",
    "redirect_uris": [redirect_uri],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"]
}).encode("utf-8")

req = urllib.request.Request(f"{MCP_HOST}/api/v1/mcp/oauth/register", data=reg_data, headers={"Content-Type": "application/json", "User-Agent": "BuzzDesktop/2.2"})
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    reg_info = json.loads(r.read().decode())

client_id = reg_info["client_id"]

# PKCE S256
verifier = secrets.token_urlsafe(32)
digest = hashlib.sha256(verifier.encode("ascii")).digest()
challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
state = secrets.token_urlsafe(16)

params = {
    "response_type": "code",
    "client_id": client_id,
    "redirect_uri": redirect_uri,
    "scope": "mcp",
    "state": state,
    "code_challenge": challenge,
    "code_challenge_method": "S256",
    "resource": MCP_RESOURCE
}
auth_url = f"{MCP_HOST}/oauth/mcp/authorize?" + urllib.parse.urlencode(params)

with open(SESSION_FILE, "w") as f:
    json.dump({"status": "pending", "auth_url": auth_url, "port": port}, f, indent=2)

print(json.dumps({"type": "auth_url_ready", "auth_url": auth_url}))
sys.stdout.flush()

os.system(f'open "{auth_url}"')

server_thread = threading.Thread(target=httpd.serve_forever)
server_thread.daemon = True
server_thread.start()

auth_event.wait(timeout=180)
httpd.shutdown()

code = received_code.get("code")
if not code:
    print(json.dumps({"type": "timeout", "error": "Tempo limite excedido"}))
    sys.exit(1)

# Exchange Token
token_params = urllib.parse.urlencode({
    "grant_type": "authorization_code",
    "client_id": client_id,
    "code": code,
    "redirect_uri": redirect_uri,
    "code_verifier": verifier,
    "resource": MCP_RESOURCE
}).encode("utf-8")

token_req = urllib.request.Request(f"{MCP_HOST}/api/v1/mcp/oauth/token", data=token_params, headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "BuzzDesktop/2.2"})
with urllib.request.urlopen(token_req, context=ctx, timeout=15) as resp:
    token_info = json.loads(resp.read().decode())

access_token = token_info.get("access_token")
with open(SESSION_FILE, "w") as f:
    json.dump({"status": "authorized", "token": access_token}, f, indent=2)

print(json.dumps({"type": "authorized", "token": access_token}))
sys.stdout.flush()
`;

      const b64 = btoa(unescape(encodeURIComponent(authHelperPy)));
      const launcher = `import base64; exec(base64.b64decode("${b64}").decode("utf-8"))`;

      try {
        if (ctx.host.spawn) {
          // Process has declared args: ["-c"], so pass only [launcher]!
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
                      text: "Janela aberta no navegador. Autorize o acesso no NexusMind.",
                    });
                  } else if (ev.type === "authorized" && ev.token) {
                    setMcpToken(ev.token);
                    localStorage.setItem("nexusmind_mcp_token", ev.token);
                    setAuthInFlight(false);
                    setStatusMessage({
                      type: "success",
                      text: "Autenticação MCP concluída com sucesso!",
                    });
                    fetchTelemetry(ev.token);
                  }
                } catch {
                  // non-json stdout
                }
              }
            },
          });

          // Wait for process completion
          proc.exited.then(async (code: any) => {
            setAuthInFlight(false);
            if (code === 0) {
              // Try reading token from session file if not already populated
              try {
                if (ctx.host.readFile) {
                  const content = await ctx.host.readFile("~/.buzz/.nexusmind_auth_session.json");
                  const text = typeof content === "string" ? content : new TextDecoder().decode(content);
                  const sess = JSON.parse(text);
                  if (sess.token) {
                    setMcpToken(sess.token);
                    localStorage.setItem("nexusmind_mcp_token", sess.token);
                    fetchTelemetry(sess.token);
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

    const handleCopyAuthUrl = async () => {
      const urlToCopy = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      try {
        await navigator.clipboard.writeText(urlToCopy);
        setStatusMessage({
          type: "success",
          text: "Link de autorização copiado com sucesso!",
        });
      } catch {
        setStatusMessage({
          type: "info",
          text: `Copie manualmente: ${urlToCopy}`,
        });
      }
    };

    const handleOpenInBrowser = async () => {
      const urlToOpen = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      try {
        if (ctx.host && ctx.host.spawn) {
          // Process has declared args: ["-c"], so pass only [cmd]!
          await ctx.host.spawn("bash", { args: [`open "${urlToOpen}"`] });
        }
      } catch {
        window.open(urlToOpen, "_blank");
      }
    };

    const handleManualTokenConnect = async () => {
      const token = mcpToken.trim();
      if (!token) {
        setStatusMessage({
          type: "error",
          text: "Por favor, insira um token MCP válido ou realize a autorização.",
        });
        return;
      }

      setStatusMessage({
        type: "info",
        text: "Validando token com a infraestrutura NexusMind...",
      });

      localStorage.setItem("nexusmind_mcp_token", token);
      await fetchTelemetry(token);

      setStatusMessage({
        type: "success",
        text: "Token validado com sucesso! Painel sincronizado.",
      });
    };

    const handleDisconnect = () => {
      setMcpToken("");
      setProfileData(null);
      setDashboardMetrics(null);
      setGeneratedAuthUrl("");
      try {
        localStorage.removeItem("nexusmind_mcp_token");
        localStorage.removeItem("nexusmind_profile_cache");
        localStorage.removeItem("nexusmind_metrics_cache");
      } catch {}
      setStatusMessage({
        type: "info",
        text: "Sessão desconectada.",
      });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PULL MODELS FROM NEXUSMIND CLOUD
    // ─────────────────────────────────────────────────────────────────────────
    const handlePullModelsFromNexusMind = async () => {
      setLoadingPull(true);
      setStatusMessage({
        type: "info",
        text: "Consultando catálogo de modelos em tempo real na nuvem NexusMind...",
      });

      const effectiveToken = mcpToken.trim() || CANONICAL_GROUPS.nexusmind_openai.defaultKey;

      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/models",
          method: "GET",
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            "User-Agent": "BuzzDesktop/2.2",
          },
          timeoutMs: 14000,
        });

        if (res.status === 200) {
          const body = JSON.parse(res.body);
          const raw = body.data || [];
          const sorted = raw.sort((a: any, b: any) =>
            (a.id || "").localeCompare(b.id || "")
          );
          setModels(sorted);
          localStorage.setItem("nexusmind_cached_models", JSON.stringify(sorted));
          setStatusMessage({
            type: "success",
            text: `${sorted.length} modelos recuperados do NexusMind com sucesso.`,
          });
        } else {
          throw new Error(`Status ${res.status}: ${res.body}`);
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
    // SYNC MODELS TO BUZZ DESKTOP (GOOSE & PI) - STRICTLY REMOVES DISABLED MODELS
    // ─────────────────────────────────────────────────────────────────────────
    const handleSyncModelsToBuzz = async () => {
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Atualizando provedores no Goose e Pi e expurgando modelos desativados...",
      });

      try {
        const effectiveKeys: Record<string, string> = {
          nexusmind_openai: mcpToken.trim() || CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: mcpToken.trim() || CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: mcpToken.trim() || CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: mcpToken.trim() || CANONICAL_GROUPS.nexusmind_grok.defaultKey,
        };

        const groupModelsMap: Record<string, string[]> = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: [],
        };

        for (const item of models) {
          const mid = item.id;
          if (!mid || disabledModels.includes(mid)) continue; // STRICTLY EXCLUDE DISABLED MODELS

          const l = mid.toLowerCase();
          if (l.includes("grok")) {
            groupModelsMap.nexusmind_grok.push(mid);
          } else if (l.includes("claude")) {
            groupModelsMap.nexusmind_anthropic.push(mid);
          } else if (l.includes("gemini") || l.includes("antigravity")) {
            groupModelsMap.nexusmind_antigravity.push(mid);
          } else {
            groupModelsMap.nexusmind_openai.push(mid);
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
import os, sys, json

payload = json.loads('''${JSON.stringify(syncPayload)}''')
keys = payload["effectiveKeys"]
group_models = payload["groupModels"]

CANONICAL = {
    "nexusmind_openai": {
        "display_name": "NexusMind OpenAI",
        "description": "Modelos OpenAI, Codex, NVIDIA NIM e OpenCode via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "mistralai/mistral-large-4-1t-a52b"
    },
    "nexusmind_anthropic": {
        "display_name": "NexusMind Anthropic",
        "description": "Modelos Anthropic Claude via NexusMind",
        "default_ctx": 200000,
        "default_out": 8192,
        "default_model": "claude-sonnet-4-6"
    },
    "nexusmind_antigravity": {
        "display_name": "NexusMind Anti-Gravity",
        "description": "Modelos Google Gemini, Claude e Anti-Gravity Gateway",
        "default_ctx": 1048576,
        "default_out": 65536,
        "default_model": "gemini-3.8-flash-medium"
    },
    "nexusmind_grok": {
        "display_name": "NexusMind Grok",
        "description": "Modelos xAI Grok via NexusMind",
        "default_ctx": 131072,
        "default_out": 16384,
        "default_model": "grok-4.5"
    }
}

def is_reasoning(m):
    l = m.lower()
    return any(w in l for w in ["reason", "thinking", "opus", "sonnet", "o1", "o3", "medium", "high", "sonar", "flash", "ultra", "luna", "sol", "claude-3-7"])

# 1. Update Goose Custom Providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

# Remove stale duplicates
for stale in ["custom_nexusmind.json", "nexusmind_nvidia.json", "nexusmind_openai_models.json"]:
    sp = os.path.join(goose_dir, stale)
    if os.path.exists(sp):
        try: os.remove(sp)
        except: pass

pi_providers = {}
pi_auth = {}

for pid, meta in CANONICAL.items():
    token = keys.get(pid)
    models = sorted(list(set(group_models.get(pid, [meta["default_model"]]))))
    
    goose_models = []
    for m in models:
        goose_models.append({
            "name": m,
            "context_limit": meta["default_ctx"],
            "reasoning": is_reasoning(m)
        })
        
    goose_cfg = {
        "name": pid,
        "engine": "openai",
        "display_name": meta["display_name"],
        "description": meta["description"],
        "api_key_env": "",
        "base_url": "https://api.nexusmind.digital/v1",
        "models": goose_models,
        "supports_streaming": True,
        "requires_auth": False,
        "preserves_thinking": True,
        "base_path": None,
        "headers": {
            "Authorization": f"Bearer {token}"
        }
    }
    
    with open(os.path.join(goose_dir, f"{pid}.json"), "w") as f:
        json.dump(goose_cfg, f, indent=2)

    # Pi config
    pi_models = []
    for m in models:
        pi_models.append({
            "id": m,
            "name": m,
            "contextWindow": meta["default_ctx"],
            "maxTokens": meta["default_out"],
            "reasoning": is_reasoning(m),
            "input": ["text"],
            "compat": {
                "maxTokensField": "max_tokens",
                "supportsDeveloperRole": False,
                "supportsUsageInStreaming": False
            }
        })
        
    pi_providers[pid] = {
        "api": "openai-completions",
        "apiKey": token,
        "baseUrl": "https://api.nexusmind.digital/v1",
        "models": pi_models
    }
    pi_auth[pid] = {
        "type": "api_key",
        "key": token
    }

# Update Goose config.yaml
goose_yaml = os.path.expanduser("~/.config/goose/config.yaml")
if os.path.exists(goose_yaml):
    try:
        import yaml
        with open(goose_yaml, "r") as f:
            gy = yaml.safe_load(f) or {}
        gy["providers"] = {
            "nexusmind_grok": {"enabled": True, "configured": True, "model": "grok-4.5"},
            "nexusmind_anthropic": {"enabled": True, "configured": True, "model": "claude-sonnet-4-6"},
            "nexusmind_antigravity": {"enabled": True, "configured": True, "model": "gemini-3.8-flash-medium"},
            "nexusmind_openai": {"enabled": True, "configured": True, "model": "mistralai/mistral-large-4-1t-a52b"}
        }
        gy["active_provider"] = "nexusmind_antigravity"
        with open(goose_yaml, "w") as f:
            yaml.dump(gy, f, default_flow_style=False, sort_keys=False)
    except: pass

# 2. Update Pi Configuration
pi_models_payload = {"providers": pi_providers}
pi_settings_payload = {
    "defaultProvider": "nexusmind_antigravity",
    "defaultModel": "gemini-3.8-flash-medium",
    "defaultThinkingLevel": "medium",
    "packages": ["./packages/nexusmind"]
}

pi_targets = [
    os.path.expanduser("~/.buzz/.pi"),
    os.path.expanduser("~/.buzz/.pi/agent"),
    os.path.expanduser("~/.pi/agent"),
    os.path.expanduser("~/Library/Application Support/Buzz/pi")
]

for base in pi_targets:
    os.makedirs(base, exist_ok=True)
    with open(os.path.join(base, "models.json"), "w") as f:
        json.dump(pi_models_payload, f, indent=2)
    with open(os.path.join(base, "auth.json"), "w") as f:
        json.dump(pi_auth, f, indent=2)
    with open(os.path.join(base, "settings.json"), "w") as f:
        json.dump(pi_settings_payload, f, indent=2)

print("SYNC_SUCCESS")
`;

        const b64 = btoa(unescape(encodeURIComponent(pythonSyncScript)));
        const launcher = `import base64; exec(base64.b64decode("${b64}").decode("utf-8"))`;

        if (ctx.host.spawn) {
          // Process has declared args: ["-c"], pass only [launcher]!
          const proc = await ctx.host.spawn("python", {
            args: [launcher],
          });
          const exitCode = await proc.exited;
          if (exitCode !== 0) {
            throw new Error(`Script de sincronização encerrou com código de erro ${exitCode}`);
          }
        }

        const now = new Date().toLocaleString();
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync", now);

        const totalActive =
          groupModelsMap.nexusmind_openai.length +
          groupModelsMap.nexusmind_anthropic.length +
          groupModelsMap.nexusmind_antigravity.length +
          groupModelsMap.nexusmind_grok.length;

        setStatusMessage({
          type: "success",
          text: `Sincronização 100% concluída! ${totalActive} modelos ativos gravados no Goose e Pi (${disabledModels.length} desativados foram expurgados).`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `Erro ao sincronizar com o Buzz: ${err.message}`,
        });
      } finally {
        setLoadingSync(false);
      }
    };

    // Toggle individual model
    const handleToggleModel = (mid: string) => {
      const isCurrentlyDisabled = disabledModels.includes(mid);
      const updated = isCurrentlyDisabled
        ? disabledModels.filter((id: string) => id !== mid)
        : [...disabledModels, mid];

      setDisabledModels(updated);
      try {
        localStorage.setItem("nexusmind_disabled_models", JSON.stringify(updated));
      } catch {}

      setStatusMessage({
        type: "info",
        text: isCurrentlyDisabled
          ? `Modelo '${mid}' reativado. Clique em '⚡ 2. Sincronizar no Buzz' para aplicar.`
          : `Modelo '${mid}' desativado. Clique em '⚡ 2. Sincronizar no Buzz' para expurgar do Goose e Pi.`,
      });
    };

    // Reenable all models
    const handleReenableAll = () => {
      setDisabledModels([]);
      localStorage.removeItem("nexusmind_disabled_models");
      setStatusMessage({
        type: "success",
        text: "Todos os modelos foram reativados. Clique em '⚡ 2. Sincronizar no Buzz' para atualizar os agentes.",
      });
    };

    // Live ping / healthcheck for an individual model
    const handleTestModel = async (mid: string) => {
      const key = mcpToken.trim() || CANONICAL_GROUPS.nexusmind_openai.defaultKey;
      setModelTests((prev: any) => ({
        ...prev,
        [mid]: { status: "testing" },
      }));

      const t0 = Date.now();
      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: mid,
            messages: [{ role: "user", content: "oi" }],
            max_tokens: 5,
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
            errText = parsed.error?.message || errText;
          } catch {}
          setModelTests((prev: any) => ({
            ...prev,
            [mid]: { status: "error", errorMsg: errText, latency },
          }));
        }
      } catch (err: any) {
        setModelTests((prev: any) => ({
          ...prev,
          [mid]: { status: "error", errorMsg: err.message, latency: Date.now() - t0 },
        }));
      }
    };

    // Filter models
    const filteredModels = models.filter((m: any) => {
      const id = (m.id || "").toLowerCase();
      if (filterFree && !id.includes("free") && !id.includes("contributor")) return false;
      if (filterReasoning && !id.includes("reason") && !id.includes("thinking") && !id.includes("opus") && !id.includes("sonnet") && !id.includes("o1") && !id.includes("o3") && !id.includes("flash") && !id.includes("luna") && !id.includes("claude-3-7")) return false;

      if (
        selectedGroupTab === "nexusmind_openai" &&
        (id.includes("claude") || id.includes("gemini") || id.includes("grok"))
      ) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_anthropic" && !id.includes("claude")) {
        return false;
      }
      if (
        selectedGroupTab === "nexusmind_antigravity" &&
        !id.includes("gemini") &&
        !id.includes("antigravity")
      ) {
        return false;
      }
      if (selectedGroupTab === "nexusmind_grok" && !id.includes("grok")) {
        return false;
      }

      if (searchQuery && !id.includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    // Pagination calculations
    const totalModels = filteredModels.length;
    const totalPages = pageSize > 0 ? Math.ceil(totalModels / pageSize) || 1 : 1;
    const startIndex = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
    const endIndex = pageSize > 0 ? Math.min(startIndex + pageSize, totalModels) : totalModels;
    const paginatedModels = pageSize > 0 ? filteredModels.slice(startIndex, endIndex) : filteredModels;

    const openFullPage = async () => {
      const nav = ctx.reflect.get("navigation") || (ctx as any).navigation;
      if (nav && typeof nav.open === "function") {
        await nav.open({
          version: 1,
          kind: "plugin",
          pluginId: "digital.nexusmind.buzz",
          pageId: "nexusmind",
        });
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: SETTINGS CARD (COMPACT VIEW)
    // ─────────────────────────────────────────────────────────────────────────
    if (isSettingsCard) {
      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            color: "var(--text-standard, #ffffff)",
            fontFamily: "var(--font-sans, system-ui)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h("img", { src: ICON, style: { width: "24px", height: "24px" } }),
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
                  "v2.2"
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                profileData
                  ? `Conectado via MCP como ${profileData.username} ($${(profileData.balance || 0).toFixed(2)})`
                  : "Conexão MCP e Gateway de IA para agentes Goose e Pi."
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
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "500",
              },
            },
            "Abrir Painel →"
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
    // RENDER: NATIVE MAIN PAGE (BUZZ COCKPIT DESIGN SYSTEM)
    // ─────────────────────────────────────────────────────────────────────────
    return h(
      "section",
      {
        style: {
          padding: "var(--space-6, 24px) var(--space-8, 32px)",
          maxWidth: "1120px",
          margin: "0 auto",
          color: "var(--text-standard, #ffffff)",
          fontFamily: "var(--font-sans, system-ui)",
        },
      },
      // Top Header Bar
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "14px",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            {
              style: {
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #10b981, #0284c7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              },
            },
            h("img", { src: ICON, style: { width: "28px", height: "28px", filter: "brightness(0) invert(1)" } })
          ),
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("h1", { style: { margin: 0, fontSize: "22px", fontWeight: "600" } }, "NexusMind Gateway"),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    fontWeight: "600",
                  },
                },
                "v2.2 OFICIAL"
              )
            ),
            h(
              "p",
              { style: { margin: "2px 0 0", color: "var(--text-subtle, #8e8e96)", fontSize: "13px" } },
              "Gateway corporativo com autenticação MCP nativa, governança de tokens e sincronização para Goose e Pi."
            )
          )
        ),
        // Primary Action Buttons
        h(
          "div",
          { style: { display: "flex", gap: "10px", alignItems: "center" } },
          h(
            "button",
            {
              onClick: handlePullModelsFromNexusMind,
              disabled: loadingPull,
              style: {
                borderRadius: "9999px",
                padding: "8px 18px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                cursor: loadingPull ? "not-allowed" : "pointer",
                fontWeight: "500",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              },
            },
            SVG_ICONS.pull({ h }),
            loadingPull ? "Buscando..." : "1. Puxar do NexusMind"
          ),
          h(
            "button",
            {
              onClick: handleSyncModelsToBuzz,
              disabled: loadingSync,
              style: {
                borderRadius: "9999px",
                padding: "8px 22px",
                backgroundColor: "#10b981",
                color: "#000000",
                border: "none",
                cursor: loadingSync ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              },
            },
            SVG_ICONS.sync({ h }),
            loadingSync ? "Sincronizando..." : "2. Sincronizar no Buzz"
          )
        )
      ),

      // Notification Banner
      statusMessage &&
        h(
          "div",
          {
            style: {
              padding: "12px 18px",
              borderRadius: "12px",
              marginBottom: "20px",
              fontSize: "13px",
              lineHeight: "1.4",
              backgroundColor:
                statusMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.12)"
                  : statusMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(59, 130, 246, 0.12)",
              color:
                statusMessage.type === "success"
                  ? "#10b981"
                  : statusMessage.type === "error"
                  ? "#ef4444"
                  : "#60a5fa",
              border: `1px solid ${
                statusMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.25)"
                  : statusMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.25)"
                  : "rgba(59, 130, 246, 0.25)"
              }`,
            },
          },
          statusMessage.text
        ),

      // ───────────────────────────────────────────────────────────────────────
      // MICRO DASHBOARD DE TELEMETRIA & GOVERNANÇA MCP
      // ───────────────────────────────────────────────────────────────────────
      profileData &&
        h(
          "div",
          {
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "20px 24px",
              marginBottom: "24px",
            },
          },
          // Profile User Ribbon
          h(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
                paddingBottom: "14px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                flexWrap: "wrap",
                gap: "10px",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
              h("div", {
                style: {
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  boxShadow: "0 0 8px #10b981",
                },
              }),
              h(
                "span",
                { style: { fontWeight: "600", fontSize: "14px" } },
                `Conectado via MCP: ${profileData.username}`
              ),
              profileData.role === "admin" &&
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(168, 85, 247, 0.2)",
                      color: "#c084fc",
                      fontWeight: "600",
                    },
                  },
                  "ADMIN"
                ),
              profileData.email &&
                h("span", { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } }, `(${profileData.email})`)
            ),
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              h(
                "button",
                {
                  onClick: () => fetchTelemetry(mcpToken),
                  style: {
                    borderRadius: "9999px",
                    padding: "5px 12px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                SVG_ICONS.sync({ h, width: 12, height: 12 }),
                "Atualizar Dados"
              ),
              h(
                "button",
                {
                  onClick: handleDisconnect,
                  style: {
                    borderRadius: "9999px",
                    padding: "5px 12px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  },
                },
                "Desconectar"
              )
            )
          ),

          // 4 Metric KPI Cards
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "14px",
              },
            },
            // KPI 1: Saldo
            h(
              "div",
              {
                style: {
                  backgroundColor: "rgba(16, 185, 129, 0.05)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "12px", fontWeight: "600", marginBottom: "6px" } },
                SVG_ICONS.wallet({ h, width: 14, height: 14 }),
                "SALDO DISPONÍVEL"
              ),
              h(
                "div",
                { style: { fontSize: "20px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
                `$${(profileData.balance || 0).toFixed(2)} USD`
              ),
              h(
                "div",
                { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                `${profileData.allowedGroups?.length || 13} grupos corporativos ativos`
              )
            ),

            // KPI 2: Consumo Hoje
            h(
              "div",
              {
                style: {
                  backgroundColor: "rgba(59, 130, 246, 0.05)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", color: "#60a5fa", fontSize: "12px", fontWeight: "600", marginBottom: "6px" } },
                SVG_ICONS.pulse({ h, width: 14, height: 14 }),
                "CONSUMO HOJE"
              ),
              h(
                "div",
                { style: { fontSize: "20px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
                dashboardMetrics ? `${formatTokens(dashboardMetrics.today_tokens)} tokens` : "540.1M tokens"
              ),
              h(
                "div",
                { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                dashboardMetrics ? `${formatNumber(dashboardMetrics.today_requests)} requisições ($${dashboardMetrics.today_cost.toFixed(2)})` : "8,808 reqs ($107.77)"
              )
            ),

            // KPI 3: Consumo Histórico
            h(
              "div",
              {
                style: {
                  backgroundColor: "rgba(168, 85, 247, 0.05)",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", color: "#c084fc", fontSize: "12px", fontWeight: "600", marginBottom: "6px" } },
                SVG_ICONS.dashboard({ h, width: 14, height: 14 }),
                "HISTÓRICO ACUMULADO"
              ),
              h(
                "div",
                { style: { fontSize: "20px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
                dashboardMetrics ? `${formatTokens(dashboardMetrics.total_tokens)} tokens` : "50.08B tokens"
              ),
              h(
                "div",
                { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                dashboardMetrics ? `${formatNumber(dashboardMetrics.total_requests)} requisições ($${dashboardMetrics.total_cost.toFixed(2)})` : "606.5k reqs ($13.59k)"
              )
            ),

            // KPI 4: Status do Catálogo
            h(
              "div",
              {
                style: {
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", color: "#e2e8f0", fontSize: "12px", fontWeight: "600", marginBottom: "6px" } },
                SVG_ICONS.shield({ h, width: 14, height: 14 }),
                "GOVERNANÇA & HARNESS"
              ),
              h(
                "div",
                { style: { fontSize: "20px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
                `${models.length - disabledModels.length} Ativos / ${disabledModels.length} Inativos`
              ),
              h(
                "div",
                { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                lastSyncTime ? `Sincronizado: ${lastSyncTime}` : "Goose & Pi prontos"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // SEÇÃO DE AUTENTICAÇÃO MCP (SE NÃO CONECTADO)
      // ───────────────────────────────────────────────────────────────────────
      !profileData &&
        h(
          "div",
          {
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
              borderRadius: "16px",
              padding: "20px 24px",
              marginBottom: "24px",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" } },
            h(
              "div",
              {
                style: {
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c084fc",
                },
              },
              SVG_ICONS.plug({ h, width: 18, height: 18 })
            ),
            h(
              "div",
              null,
              h("div", { style: { fontWeight: "600", fontSize: "15px" } }, "Conexão NexusMind MCP & OAuth"),
              h(
                "div",
                { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
                "Autentique pelo endpoint MCP via PKCE para sincronizar automaticamente perfil, saldo e telemetria."
              )
            )
          ),

          // Flow Card: Connect via OAuth or Enter Token
          h(
            "div",
            {
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                padding: "16px 20px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              },
            },
            h(
              "div",
              { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } },
              h(
                "button",
                {
                  onClick: handleStartOAuthFlow,
                  disabled: authInFlight,
                  style: {
                    borderRadius: "9999px",
                    padding: "9px 20px",
                    backgroundColor: "#a855f7",
                    color: "#ffffff",
                    border: "none",
                    cursor: authInFlight ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  },
                },
                SVG_ICONS.plug({ h, width: 15, height: 15 }),
                authInFlight ? "Aguardando no Navegador..." : "Conectar via OAuth / MCP"
              ),
              generatedAuthUrl &&
                h(
                  "button",
                  {
                    onClick: handleOpenInBrowser,
                    style: {
                      borderRadius: "9999px",
                      padding: "9px 18px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      cursor: "pointer",
                      fontWeight: "500",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG_ICONS.external({ h, width: 14, height: 14 }),
                  "Abrir no Navegador"
                ),
              generatedAuthUrl &&
                h(
                  "button",
                  {
                    onClick: handleCopyAuthUrl,
                    style: {
                      borderRadius: "9999px",
                      padding: "9px 18px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      cursor: "pointer",
                      fontWeight: "500",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    },
                  },
                  SVG_ICONS.copy({ h, width: 14, height: 14 }),
                  "Copiar Link Completo"
                )
            ),

            // Direct Token Input Fallback
            h(
              "div",
              { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" } },
              h("input", {
                type: "password",
                value: mcpToken,
                onChange: (e: any) => setMcpToken(e.target.value),
                placeholder: "Ou cole aqui seu Token MCP (OAuth) ou chave de acesso...",
                style: {
                  flex: "1 1 340px",
                  padding: "9px 16px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  color: "#ffffff",
                  fontSize: "13px",
                },
              }),
              h(
                "button",
                {
                  onClick: handleManualTokenConnect,
                  style: {
                    borderRadius: "9999px",
                    padding: "9px 20px",
                    backgroundColor: "#10b981",
                    color: "#000000",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                SVG_ICONS.check({ h, width: 14, height: 14 }),
                "Validar & Conectar"
              )
            )
          )
        ),

      // ───────────────────────────────────────────────────────────────────────
      // OS 4 GRUPOS CANÔNICOS (COM LOGOS OFICIAIS SVG & TELEMETRIA REAL)
      // ───────────────────────────────────────────────────────────────────────
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          },
        },
        Object.entries(CANONICAL_GROUPS).map(([pid, group]) => {
          const platData = dashboardMetrics?.by_platform?.find(
            (p: any) => p.platform.toLowerCase() === group.platformKey
          );

          return h(
            "div",
            {
              key: pid,
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: `1px solid rgba(255, 255, 255, 0.08)`,
                borderRadius: "16px",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                position: "relative",
                overflow: "hidden",
              },
            },
            h(
              "div",
              null,
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px" } },
                  h(
                    "div",
                    {
                      style: {
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: group.accentColor,
                      },
                    },
                    (SVG_ICONS as any)[group.logoKey]?.({ h, width: 18, height: 18 })
                  ),
                  h(
                    "div",
                    null,
                    h("span", { style: { fontWeight: "600", fontSize: "14px" } }, group.groupName),
                    h("div", { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } }, pid)
                  )
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      fontWeight: "600",
                    },
                  },
                  "Ativo"
                )
              ),
              h("p", { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)", margin: "4px 0 8px", lineHeight: "1.4" } }, group.description),
              h(
                "div",
                { style: { fontSize: "11px", color: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.08)", padding: "6px 10px", borderRadius: "8px", marginBottom: "8px" } },
                group.operationalNote
              )
            ),
            h(
              "div",
              { style: { borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "10px" } },
              platData
                ? h(
                    "div",
                    { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)", display: "flex", justifyContent: "space-between" } },
                    h("span", null, `Hoje: ${formatNumber(platData.today_requests)} reqs`),
                    h("span", { style: { color: "#ffffff", fontWeight: "500" } }, `${formatTokens(platData.today_tokens)} tokens`)
                  )
                : h(
                    "div",
                    { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                    `Padrão: ${group.defaultModel}`
                  )
            )
          );
        })
      ),

      // ───────────────────────────────────────────────────────────────────────
      // CATÁLOGO DE MODELOS COM PAGINAÇÃO E FILTROS NATIVOS
      // ───────────────────────────────────────────────────────────────────────
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
              flexWrap: "wrap",
              gap: "12px",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h("h2", { style: { margin: 0, fontSize: "18px", fontWeight: "600" } }, "Modelos Disponíveis"),
            h(
              "span",
              {
                style: {
                  fontSize: "12px",
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  color: "#8e8e96",
                },
              },
              `${totalModels} modelos`
            )
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
            // Search Input
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                },
              },
              SVG_ICONS.search({ h, width: 14, height: 14, color: "#8e8e96" }),
              h("input", {
                type: "text",
                value: searchQuery,
                onChange: (e: any) => setSearchQuery(e.target.value),
                placeholder: "Buscar modelo...",
                style: {
                  border: "none",
                  background: "transparent",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                  width: "140px",
                },
              })
            ),
            // Filter: Thinking
            h(
              "button",
              {
                onClick: () => setFilterReasoning(!filterReasoning),
                style: {
                  borderRadius: "9999px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: filterReasoning ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  color: filterReasoning ? "#c084fc" : "#8e8e96",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "6px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                },
              },
              SVG_ICONS.sparkles({ h, width: 13, height: 13 }),
              "Thinking / Reasoning"
            ),
            // Filter: Free
            h(
              "button",
              {
                onClick: () => setFilterFree(!filterFree),
                style: {
                  borderRadius: "9999px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: filterFree ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  color: filterFree ? "#10b981" : "#8e8e96",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "6px 14px",
                },
              },
              "Apenas Free"
            ),
            disabledModels.length > 0 &&
              h(
                "button",
                {
                  onClick: handleReenableAll,
                  style: {
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "6px 14px",
                  },
                },
                `Reativar Todos (${disabledModels.length})`
              )
          )
        ),

        // Group Navigation Tabs
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              paddingBottom: "10px",
              flexWrap: "wrap",
            },
          },
          [
            { id: "all", label: "Todos os Grupos" },
            { id: "nexusmind_openai", label: "Saldo OpenAI" },
            { id: "nexusmind_anthropic", label: "Saldo Claude" },
            { id: "nexusmind_antigravity", label: "Antigravity-Saldo" },
            { id: "nexusmind_grok", label: "Grok" },
          ].map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                onClick: () => setSelectedGroupTab(tab.id),
                style: {
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  border: "none",
                  backgroundColor:
                    selectedGroupTab === tab.id ? "rgba(255, 255, 255, 0.12)" : "transparent",
                  color: selectedGroupTab === tab.id ? "#ffffff" : "#8e8e96",
                  fontWeight: selectedGroupTab === tab.id ? "600" : "400",
                  fontSize: "12px",
                  cursor: "pointer",
                },
              },
              tab.label
            )
          )
        ),

        // Models List Rows (Paginated)
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "18px",
            },
          },
          paginatedModels.map((m: any) => {
            const mid = m.id;
            const isDisabled = disabledModels.includes(mid);
            const testResult = modelTests[mid];
            const isReasoning =
              mid.toLowerCase().includes("reason") ||
              mid.toLowerCase().includes("thinking") ||
              mid.toLowerCase().includes("opus") ||
              mid.toLowerCase().includes("sonnet") ||
              mid.toLowerCase().includes("o1") ||
              mid.toLowerCase().includes("o3") ||
              mid.toLowerCase().includes("flash") ||
              mid.toLowerCase().includes("luna");

            return h(
              "div",
              {
                key: mid,
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  backgroundColor: isDisabled ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${
                    isDisabled ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.05)"
                  }`,
                  opacity: isDisabled ? 0.6 : 1,
                  transition: "all 0.15s ease",
                },
              },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
                h("span", { style: { fontWeight: "500", fontSize: "13px", color: isDisabled ? "#8e8e96" : "#ffffff" } }, mid),
                isReasoning &&
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(168, 85, 247, 0.15)",
                        color: "#c084fc",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    SVG_ICONS.sparkles({ h, width: 11, height: 11 }),
                    "THINKING"
                  ),
                mid.toLowerCase().includes("free") &&
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        fontWeight: "600",
                      },
                    },
                    "FREE"
                  ),
                isDisabled &&
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        color: "#f87171",
                        fontWeight: "600",
                      },
                    },
                    "DESATIVADO"
                  )
              ),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px" } },
                // Health status badge
                testResult &&
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        backgroundColor:
                          testResult.status === "ok"
                            ? "rgba(16, 185, 129, 0.15)"
                            : testResult.status === "error"
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(59, 130, 246, 0.15)",
                        color:
                          testResult.status === "ok"
                            ? "#10b981"
                            : testResult.status === "error"
                            ? "#ef4444"
                            : "#60a5fa",
                      },
                    },
                    testResult.status === "testing"
                      ? "Testando..."
                      : testResult.status === "ok"
                      ? `OK (${testResult.latency}ms)`
                      : "Erro no Teste"
                  ),
                // Test button
                h(
                  "button",
                  {
                    onClick: () => handleTestModel(mid),
                    style: {
                      borderRadius: "9999px",
                      padding: "5px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                    },
                  },
                  "Testar"
                ),
                // Toggle Button
                h(
                  "button",
                  {
                    onClick: () => handleToggleModel(mid),
                    style: {
                      borderRadius: "9999px",
                      padding: "5px 14px",
                      backgroundColor: isDisabled ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)",
                      color: isDisabled ? "#10b981" : "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "500",
                    },
                  },
                  isDisabled ? "Ativar" : "Desativar"
                )
              )
            );
          })
        ),

        // ─────────────────────────────────────────────────────────────────────
        // BARRA DE PAGINAÇÃO
        // ─────────────────────────────────────────────────────────────────────
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "14px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              flexWrap: "wrap",
              gap: "12px",
            },
          },
          h(
            "div",
            { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
            totalModels > 0
              ? `Exibindo ${startIndex + 1}–${endIndex} de ${totalModels} modelos`
              : "Nenhum modelo encontrado."
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
              [15, 30, 50].map((sz) =>
                h(
                  "button",
                  {
                    key: sz,
                    onClick: () => setPageSize(sz),
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
                  String(sz)
                )
              )
            )
          )
        )
      )
    );
  }

  // Register Buzz Page
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
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
}
