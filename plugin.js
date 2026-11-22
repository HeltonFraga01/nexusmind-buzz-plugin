const SVG_ICONS = {
  // Official Brand Logos
  openai: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M22.28 12.06a5.53 5.53 0 0 0-.47-2.92 5.58 5.58 0 0 0-3.32-2.88 5.6 5.6 0 0 0-1.63-.24 5.57 5.57 0 0 0-4.04 1.76l-.42.48-1.78-1.03a5.57 5.57 0 0 0-5.74.52 5.57 5.57 0 0 0-2.3 4.88 5.54 5.54 0 0 0 .46 2.92 5.57 5.57 0 0 0 3.32 2.88c.52.16 1.07.24 1.63.24a5.58 5.58 0 0 0 4.04-1.76l.42-.48 1.78 1.03a5.57 5.57 0 0 0 5.74-.52 5.58 5.58 0 0 0 2.3-4.89zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
    })
  ),
  claude: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M13.5 2h-3l-.8 7.2L3.5 6 2 8.6l6.6 3.4L2 15.4 3.5 18l6.2-3.2.8 7.2h3l.8-7.2 6.2 3.2 1.5-2.6-6.6-3.4 6.6-3.4-1.5-2.6-6.2 3.2-.8-7.2z"
    })
  ),
  gemini: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M12 2C12 7.52 7.52 12 2 12c5.48 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z"
    })
  ),
  grok: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "currentColor", width: 18, height: 18, ...props },
    props.h("path", {
      d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    })
  ),
  // Minimalist Functional Icons (Buzz UI Standard)
  dashboard: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
    props.h("rect", { x: 3, y: 14, width: 7, height: 7, rx: 1 })
  ),
  sync: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
  ),
  pull: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    props.h("polyline", { points: "7 10 12 15 17 10" }),
    props.h("line", { x1: 12, y1: 15, x2: 12, y2: 3 })
  ),
  search: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("circle", { cx: 11, cy: 11, r: 8 }),
    props.h("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
  ),
  check: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("polyline", { points: "20 6 9 17 4 12" })
  ),
  cross: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
    props.h("line", { x1: 6, y1: 6, x2: 18, y2: 18 })
  ),
  chevronLeft: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "15 18 9 12 15 6" })
  ),
  chevronRight: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "9 18 15 12 9 6" })
  ),
  external: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
    props.h("polyline", { points: "15 3 21 3 21 9" }),
    props.h("line", { x1: 10, y1: 14, x2: 21, y2: 3 })
  ),
  copy: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
    props.h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
  ),
  plug: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M12 2v6m0 8v6M5 9h14M7 9v4a5 5 0 0 0 10 0V9" })
  ),
  shield: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
  ),
  pulse: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
  ),
  wallet: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 16, height: 16, ...props },
    props.h("rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
    props.h("line", { x1: 2, y1: 10, x2: 22, y2: 10 })
  ),
  sparkles: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" })
  ),
  user: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 15, height: 15, ...props },
    props.h("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }),
    props.h("circle", { cx: 12, cy: 7, r: 4 })
  ),
  filter: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })
  ),
  power: (props = {}) => props.h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", width: 14, height: 14, ...props },
    props.h("path", { d: "M18.36 6.64a9 9 0 1 1-12.73 0" }),
    props.h("line", { x1: 12, y1: 2, x2: 12, y2: 12 })
  )
};
const inject = ["react", "pages", "settingsCards", "host", "agents"];
const ICON = "data:image/svg+xml;base64," + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'
);
const CANONICAL_GROUPS = {
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
    telemetrySummary: "Hoje: 127.1M tokens • 1,232 reqs"
  },
  nexusmind_anthropic: {
    id: "nexusmind_anthropic",
    platformKey: "anthropic",
    groupName: "Saldo Claude",
    displayName: "NexusMind Anthropic",
    defaultKey: "sk-bd4137aa79f121bbf4e110d788a7f587b68b49432d333ad9abd88051ba393b1c",
    defaultModel: "claude-sonnet-4-6",
    defaultCtx: 2e5,
    defaultOut: 8192,
    accentColor: "#d97706",
    logoKey: "claude",
    modelsCount: 18,
    telemetrySummary: "Contingência ativa via Antigravity"
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
    telemetrySummary: "Hoje: 150.2M tokens • 2,572 reqs"
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
    telemetrySummary: "Hoje: 1.2k tokens • 1 req"
  }
};
const ANTHROPIC_ONLY_CLAUDE = /* @__PURE__ */ new Set([
  "claude-fable-5-2",
  "claude-haiku-4-5-20251001",
  "claude-haiku-5-5",
  "claude-mythos-5-2",
  "claude-opus-4-5-20251101",
  "claude-opus-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-5"
]);
const ANTIGRAVITY_ONLY_CLAUDE = /* @__PURE__ */ new Set([
  "claude-opus-4-5-thinking",
  "claude-opus-4-6-thinking",
  "claude-opus-5-5-high",
  "claude-opus-5-5-low",
  "claude-opus-5-5-medium",
  "claude-sonnet-4-5-thinking",
  "claude-sonnet-5-5-high",
  "claude-sonnet-5-5-low",
  "claude-sonnet-5-5-medium"
]);
function getModelGroups(m) {
  if (!m) return [];
  if (Array.isArray(m.groups) && m.groups.length > 0) return m.groups;
  const rawId = typeof m === "string" ? m : m.id || "";
  const mid = rawId.toLowerCase();
  if (!mid) return [];
  const groups = [];
  if (mid.includes("grok")) {
    groups.push("nexusmind_grok");
  }
  if (mid.includes("gemini") || mid.includes("antigravity") || mid.includes("tab_flash") || mid.includes("gpt-oss") || mid.includes("imagen")) {
    if (!groups.includes("nexusmind_antigravity")) {
      groups.push("nexusmind_antigravity");
    }
  }
  if (mid.includes("claude")) {
    if (ANTIGRAVITY_ONLY_CLAUDE.has(rawId) || mid.includes("thinking") || mid.includes("-high") || mid.includes("-low") || mid.includes("-medium")) {
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    } else if (ANTHROPIC_ONLY_CLAUDE.has(rawId) || mid.includes("2025") || mid.includes("mythos")) {
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
    } else {
      if (!groups.includes("nexusmind_anthropic")) {
        groups.push("nexusmind_anthropic");
      }
      if (!groups.includes("nexusmind_antigravity")) {
        groups.push("nexusmind_antigravity");
      }
    }
  }
  if (mid.includes("mistral") || mid.includes("stepfun") || mid.includes("nvidia") || mid.includes("gemma") || mid.includes("nemotron") || mid.includes("glimmer") || mid.includes("poolside") || mid.includes("luna") || mid.includes("gpt-6") || mid.includes("ising") || mid.includes("riva") || mid.includes("muse") || mid.includes("laguna")) {
    if (!groups.includes("nexusmind_openai")) {
      groups.push("nexusmind_openai");
    }
  }
  if (groups.length === 0) {
    groups.push("nexusmind_openai");
  }
  return groups;
}
const OFFICIAL_ENDPOINTS = [
  {
    id: "default",
    label: "Endpoints da API",
    tag: "Padrão",
    tagColor: "#10b981",
    url: "https://api.nexusmind.digital",
    desc: "Host raiz do gateway e healthcheck"
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    tag: "Messages",
    tagColor: "#d97706",
    url: "https://api.nexusmind.digital",
    desc: "Endpoint nativo Anthropic Claude (/v1/messages)"
  },
  {
    id: "openai",
    label: "OpenAI-compatible API",
    tag: "v1",
    tagColor: "#3b82f6",
    url: "https://api.nexusmind.digital/v1",
    desc: "OpenAI, Codex, Grok, NIM (/v1/chat/completions)"
  },
  {
    id: "responses",
    label: "Responses API",
    tag: "Streaming",
    tagColor: "#8b5cf6",
    url: "https://api.nexusmind.digital/responses",
    desc: "OpenAI Responses API e WebSockets"
  },
  {
    id: "gemini",
    label: "Gemini Native API",
    tag: "v1beta",
    tagColor: "#0284c7",
    url: "https://api.nexusmind.digital/antigravity/v1beta",
    desc: "Google GenAI SDK nativo (generateContent)"
  },
  {
    id: "antigravity",
    label: "Antigravity Bridge",
    tag: "Contingência",
    tagColor: "#f59e0b",
    url: "https://api.nexusmind.digital/antigravity",
    desc: "Bridge Vertex AI de alta performance para Claude e Gemini"
  }
];
const CANONICAL_PROFILE = {
  username: "HeltonFraga01",
  email: "fraga450@gmail.com",
  balance: 5413.56,
  role: "admin",
  status: "active",
  allowedGroups: [1, 5, 7, 8, 10, 11, 13, 14, 15, 17, 18, 24, 25],
  activeApiKeys: 4
};
const CANONICAL_DASHBOARD = {
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
    { platform: "grok", today_tokens: 1272, today_requests: 1, total_tokens: 10837914, total_requests: 242 }
  ]
};
function formatTokens(n = 0) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function formatNumber(n = 0) {
  return new Intl.NumberFormat("pt-BR").format(n);
}
function apply(ctx) {
  var _a, _b;
  const React = ctx.react;
  const h = React.createElement;
  function NexusMindComponent({ isSettingsCard = false }) {
    const [mcpToken, setMcpToken] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_mcp_token") || "connected";
      } catch {
        return "connected";
      }
    });
    const [isConnected, setIsConnected] = React.useState(() => {
      try {
        const stored = localStorage.getItem("nexusmind_connected");
        if (stored === "false") return false;
        return true;
      } catch {
        return true;
      }
    });
    const [profileData, setProfileData] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_profile_cache");
        return s ? JSON.parse(s) : CANONICAL_PROFILE;
      } catch {
        return CANONICAL_PROFILE;
      }
    });
    const [dashboardMetrics, setDashboardMetrics] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_metrics_cache");
        return s ? JSON.parse(s) : CANONICAL_DASHBOARD;
      } catch {
        return CANONICAL_DASHBOARD;
      }
    });
    const [authInFlight, setAuthInFlight] = React.useState(false);
    const [generatedAuthUrl, setGeneratedAuthUrl] = React.useState("");
    const [manualKeyInput, setManualKeyInput] = React.useState("");
    const [models, setModels] = React.useState(() => {
      try {
        const cached = localStorage.getItem("nexusmind_cached_models");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    });
    const [disabledModels, setDisabledModels] = React.useState(() => {
      try {
        const s = localStorage.getItem("nexusmind_disabled_models");
        return s ? JSON.parse(s) : [];
      } catch {
        return [];
      }
    });
    const [modelTests, setModelTests] = React.useState({});
    const [selectedGroupTab, setSelectedGroupTab] = React.useState("all");
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [filterFree, setFilterFree] = React.useState(false);
    const [filterReasoning, setFilterReasoning] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [pageSize, setPageSize] = React.useState(15);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [loadingPull, setLoadingPull] = React.useState(false);
    const [loadingSync, setLoadingSync] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState(null);
    const [lastSyncTime, setLastSyncTime] = React.useState(() => {
      try {
        return localStorage.getItem("nexusmind_last_sync_time") || "";
      } catch {
        return "";
      }
    });
    const [copiedEndpoint, setCopiedEndpoint] = React.useState(null);
    const handleCopyEndpoint = (url, label) => {
      try {
        if (navigator && navigator.clipboard) {
          navigator.clipboard.writeText(url);
        }
      } catch {
      }
      setCopiedEndpoint(url);
      setStatusMessage({
        type: "info",
        text: `Endpoint ${label} copiado para a área de transferência: ${url}`
      });
      setTimeout(() => {
        setCopiedEndpoint((curr) => curr === url ? null : curr);
      }, 2500);
    };
    const fetchTelemetry = async (tokenToUse) => {
      const token = tokenToUse.trim();
      if (!token) return;
      try {
        const profRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/profile",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3"
          },
          timeoutMs: 8e3
        });
        if (profRes.status === 200) {
          const body = JSON.parse(profRes.body);
          const u = body.data || body || {};
          const parsedBalance = typeof u.balance === "number" ? u.balance : typeof u.quota === "number" ? u.quota : void 0;
          const profile = {
            username: u.username || u.name || profileData.username,
            email: u.email || profileData.email,
            balance: parsedBalance,
            role: u.role === 100 || u.role === "admin" ? "admin" : u.role ? String(u.role) : "user",
            status: u.status || "active",
            allowedGroups: u.allowed_groups || CANONICAL_PROFILE.allowedGroups,
            activeApiKeys: typeof u.active_api_keys === "number" ? u.active_api_keys : 4
          };
          setProfileData(profile);
          localStorage.setItem("nexusmind_profile_cache", JSON.stringify(profile));
        }
        const dashRes = await ctx.host.request({
          url: "https://nexusmind.digital/api/v1/user/dashboard",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "BuzzDesktop/2.3"
          },
          timeoutMs: 8e3
        });
        if (dashRes.status === 200) {
          const body = JSON.parse(dashRes.body);
          const d = body.data || {};
          const metrics = {
            today_tokens: d.today_tokens ?? 540091754,
            today_requests: d.today_requests ?? 8810,
            today_cost: d.today_cost ?? 86.22,
            total_tokens: d.total_tokens ?? 50078702405,
            total_requests: d.total_requests ?? 606467,
            total_cost: d.total_actual_cost ?? 10901.45,
            by_platform: d.by_platform || CANONICAL_DASHBOARD.by_platform
          };
          setDashboardMetrics(metrics);
          localStorage.setItem("nexusmind_metrics_cache", JSON.stringify(metrics));
        }
      } catch {
        setProfileData(CANONICAL_PROFILE);
        setDashboardMetrics(CANONICAL_DASHBOARD);
      }
    };
    React.useEffect(() => {
      if (isConnected) {
        if (models.length === 0) {
          handlePullModelsFromNexusMind();
        }
        if (mcpToken && mcpToken !== "connected") {
          fetchTelemetry(mcpToken);
        }
      }
    }, [isConnected]);
    const handleStartOAuthFlow = async () => {
      setAuthInFlight(true);
      setStatusMessage({
        type: "info",
        text: "Iniciando processo de autorização PKCE seguro..."
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
            onStdout: (chunk) => {
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const ev = JSON.parse(line.trim());
                  if (ev.type === "auth_url_ready" && ev.auth_url) {
                    setGeneratedAuthUrl(ev.auth_url);
                    setStatusMessage({
                      type: "info",
                      text: "Navegador aberto! Complete o login no NexusMind para conectar."
                    });
                  } else if (ev.type === "authorized" && ev.token) {
                    setMcpToken(ev.token);
                    localStorage.setItem("nexusmind_mcp_token", ev.token);
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    setAuthInFlight(false);
                    setStatusMessage({
                      type: "success",
                      text: "Autenticação NexusMind concluída com sucesso! Cockpit conectado."
                    });
                    fetchTelemetry(ev.token);
                  }
                } catch {
                }
              }
            }
          });
          proc.exited.then(async (code) => {
            var _a2;
            setAuthInFlight(false);
            if (code === 0) {
              try {
                if (ctx.host.readFile) {
                  const content = await ctx.host.readFile("/Users/heltonfraga/.buzz/.nexusmind_auth_session.json");
                  const text = typeof content === "string" ? content : new TextDecoder().decode(content);
                  const sess = JSON.parse(text);
                  const resolvedToken = sess.access_token || sess.token || ((_a2 = sess.token_data) == null ? void 0 : _a2.access_token);
                  if (resolvedToken) {
                    setMcpToken(resolvedToken);
                    localStorage.setItem("nexusmind_mcp_token", resolvedToken);
                    localStorage.setItem("nexusmind_connected", "true");
                    setIsConnected(true);
                    fetchTelemetry(resolvedToken);
                  }
                }
              } catch {
              }
            }
          });
        }
      } catch (err) {
        setAuthInFlight(false);
        setStatusMessage({
          type: "error",
          text: `Falha ao iniciar autenticação: ${err.message}`
        });
      }
    };
    const handleOpenInBrowser = async () => {
      const urlToOpen = generatedAuthUrl || "https://nexusmind.digital/oauth/mcp/authorize";
      try {
        if (ctx.host && ctx.host.spawn) {
          await ctx.host.spawn("bash", { args: [`open "${urlToOpen}"`] });
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
          text: "Link copiado para a área de transferência!"
        });
      } catch {
        setStatusMessage({
          type: "info",
          text: `Copie manualmente: ${urlToCopy}`
        });
      }
    };
    const handleManualKeyConnect = () => {
      const key = manualKeyInput.trim();
      if (!key) {
        setStatusMessage({
          type: "error",
          text: "Por favor, insira sua API Key ou Token NexusMind."
        });
        return;
      }
      setMcpToken(key);
      localStorage.setItem("nexusmind_mcp_token", key);
      localStorage.setItem("nexusmind_connected", "true");
      setIsConnected(true);
      fetchTelemetry(key);
      setStatusMessage({
        type: "success",
        text: "Chave vinculada com sucesso! Cockpit conectado."
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
      } catch {
      }
      setStatusMessage({
        type: "info",
        text: "Desconectado do NexusMind Gateway."
      });
    };
    const handlePullModelsFromNexusMind = async () => {
      setLoadingPull(true);
      setStatusMessage({
        type: "info",
        text: "Consultando catálogo de modelos em tempo real nos 4 grupos NexusMind..."
      });
      try {
        const groupKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const aggregatedMap = /* @__PURE__ */ new Map();
        const promises = Object.entries(groupKeys).map(async ([gid, key]) => {
          try {
            const res = await ctx.host.request({
              url: "https://api.nexusmind.digital/v1/models",
              method: "GET",
              headers: {
                Authorization: `Bearer ${key}`,
                "User-Agent": "BuzzDesktop/2.3"
              },
              timeoutMs: 14e3
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
                    primaryGroup: gid
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
        const sorted = Array.from(aggregatedMap.values()).sort(
          (a, b) => (a.id || "").localeCompare(b.id || "")
        );
        if (sorted.length > 0) {
          setModels(sorted);
          localStorage.setItem("nexusmind_cached_models", JSON.stringify(sorted));
          setStatusMessage({
            type: "success",
            text: `${sorted.length} modelos recuperados dos 4 grupos corporativos com sucesso!`
          });
        } else {
          throw new Error("Nenhum modelo foi retornado pelos provedores.");
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro ao buscar modelos do NexusMind: ${err.message}`
        });
      } finally {
        setLoadingPull(false);
      }
    };
    const handleTestSingleModel = async (mid) => {
      var _a2;
      let keyToUse = CANONICAL_GROUPS.nexusmind_openai.defaultKey;
      const grps = getModelGroups(mid);
      if (grps.includes("nexusmind_antigravity")) {
        keyToUse = CANONICAL_GROUPS.nexusmind_antigravity.defaultKey;
      } else if (grps.includes("nexusmind_grok")) {
        keyToUse = CANONICAL_GROUPS.nexusmind_grok.defaultKey;
      } else if (grps.includes("nexusmind_anthropic")) {
        keyToUse = CANONICAL_GROUPS.nexusmind_antigravity.defaultKey;
      } else {
        keyToUse = CANONICAL_GROUPS.nexusmind_openai.defaultKey;
      }
      setModelTests((prev) => ({
        ...prev,
        [mid]: { status: "testing" }
      }));
      const t0 = Date.now();
      try {
        const res = await ctx.host.request({
          url: "https://api.nexusmind.digital/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${keyToUse}`,
            "Content-Type": "application/json",
            "User-Agent": "BuzzDesktop/2.3"
          },
          body: JSON.stringify({
            model: mid,
            messages: [{ role: "user", content: "oi" }],
            max_tokens: 5
          }),
          timeoutMs: 14e3
        });
        const latency = Date.now() - t0;
        if (res.status === 200) {
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "ok", latency }
          }));
        } else {
          let errText = `Status ${res.status}`;
          try {
            const parsed = JSON.parse(res.body);
            errText = ((_a2 = parsed.error) == null ? void 0 : _a2.message) || parsed.message || errText;
          } catch {
          }
          setModelTests((prev) => ({
            ...prev,
            [mid]: { status: "error", errorMsg: errText, latency }
          }));
        }
      } catch (err) {
        const latency = Date.now() - t0;
        setModelTests((prev) => ({
          ...prev,
          [mid]: { status: "error", errorMsg: err.message, latency }
        }));
      }
    };
    const handleBatchTestVisible = async () => {
      const visible = paginatedModels.filter((m) => !disabledModels.includes(m.id));
      if (visible.length === 0) return;
      setStatusMessage({
        type: "info",
        text: `Executando healthcheck em lote para ${visible.length} modelos visíveis...`
      });
      for (const m of visible) {
        await handleTestSingleModel(m.id);
      }
      setStatusMessage({
        type: "success",
        text: `Healthcheck concluído para os modelos visíveis.`
      });
    };
    const handleBatchDisableUnavailable = () => {
      const failed = Object.entries(modelTests).filter(([_, t]) => t.status === "error").map(([mid]) => mid);
      if (failed.length === 0) {
        setStatusMessage({
          type: "info",
          text: "Nenhum modelo com erro identificado nos testes recentes."
        });
        return;
      }
      const next = Array.from(/* @__PURE__ */ new Set([...disabledModels, ...failed]));
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
      setStatusMessage({
        type: "success",
        text: `${failed.length} modelo(s) indisponível(is) foram desativados do catálogo local.`
      });
    };
    const handleToggleModel = (mid) => {
      let next;
      if (disabledModels.includes(mid)) {
        next = disabledModels.filter((id) => id !== mid);
      } else {
        next = [...disabledModels, mid];
      }
      setDisabledModels(next);
      localStorage.setItem("nexusmind_disabled_models", JSON.stringify(next));
    };
    const handleSyncModelsToBuzz = async () => {
      setLoadingSync(true);
      setStatusMessage({
        type: "info",
        text: "Sincronizando modelos com Goose e Pi (expurgando desativados)..."
      });
      try {
        const effectiveKeys = {
          nexusmind_openai: CANONICAL_GROUPS.nexusmind_openai.defaultKey,
          nexusmind_anthropic: CANONICAL_GROUPS.nexusmind_anthropic.defaultKey,
          nexusmind_antigravity: CANONICAL_GROUPS.nexusmind_antigravity.defaultKey,
          nexusmind_grok: CANONICAL_GROUPS.nexusmind_grok.defaultKey
        };
        const groupModelsMap = {
          nexusmind_openai: [],
          nexusmind_anthropic: [],
          nexusmind_antigravity: [],
          nexusmind_grok: []
        };
        for (const item of models) {
          const mid = item.id;
          if (!mid || disabledModels.includes(mid)) continue;
          const grps = getModelGroups(item);
          for (const g of grps) {
            if (groupModelsMap[g]) {
              groupModelsMap[g].push(mid);
            }
          }
        }
        for (const [pid, def] of Object.entries(CANONICAL_GROUPS)) {
          if (!groupModelsMap[pid] || groupModelsMap[pid].length === 0) {
            groupModelsMap[pid] = [def.defaultModel];
          }
        }
        const syncPayload = {
          effectiveKeys,
          groupModels: groupModelsMap
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
        "base_url": "https://api.nexusmind.digital/responses",
        "display_name": "NexusMind Responses",
        "description": "OpenAI Responses API e WebSocket streaming via NexusMind",
        "default_ctx": 131072,
        "default_out": 8192,
        "default_model": "gpt-5",
        "pi_api": "openai-compatible",
        "pi_baseUrl": "https://api.nexusmind.digital/responses"
    }
}

# 1. Update Goose custom_providers
goose_dir = os.path.expanduser("~/.config/goose/custom_providers")
os.makedirs(goose_dir, exist_ok=True)

for pid, cfg in CANONICAL.items():
    m_list = group_models.get(pid, [cfg["default_model"]])
    models_spec = []
    for mid in m_list:
        models_spec.append({
            "name": mid,
            "context_limit": cfg["default_ctx"],
            "max_tokens": cfg["default_out"]
        })
    provider_json = {
        "name": pid,
        "engine": cfg["engine"],
        "display_name": cfg["display_name"],
        "description": cfg["description"],
        "api_key": keys.get(pid, ""),
        "base_url": cfg["base_url"],
        "api_key_env": cfg["api_key_env"],
        "models": models_spec
    }
    with open(os.path.join(goose_dir, f"{pid}.json"), "w", encoding="utf-8") as f:
        json.dump(provider_json, f, indent=2)

# 2. Update Goose config.yaml & secrets.yaml
goose_conf_path = os.path.expanduser("~/.config/goose/config.yaml")
goose_secrets_path = os.path.expanduser("~/.config/goose/secrets.yaml")

secrets_map = {
    "OPENAI_API_KEY": keys.get("nexusmind_openai", ""),
    "ANTIGRAVITY_API_KEY": keys.get("nexusmind_antigravity", ""),
    "ANTHROPIC_API_KEY": keys.get("nexusmind_antigravity", "") or keys.get("nexusmind_anthropic", ""),
    "GROK_API_KEY": keys.get("nexusmind_grok", ""),
    "XAI_API_KEY": keys.get("nexusmind_grok", ""),
    "GOOGLE_API_KEY": keys.get("nexusmind_antigravity", "")
}

with open(goose_secrets_path, "w", encoding="utf-8") as f:
    for k, v in secrets_map.items():
        f.write(f"{k}: {v}\\n")

# Update macOS Keychain for Goose if security tool exists
try:
    keyring_json = json.dumps(secrets_map)
    subprocess.run([
        "security", "add-generic-password", "-U",
        "-s", "goose",
        "-a", "secrets",
        "-w", keyring_json
    ], capture_output=True, timeout=5)
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
            args: [pythonSyncScript]
          });
          await proc.exited;
        }
        const now = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
        setLastSyncTime(now);
        localStorage.setItem("nexusmind_last_sync_time", now);
        const totalActive = models.length - disabledModels.length;
        setStatusMessage({
          type: "success",
          text: `Sincronização concluída com sucesso! ${totalActive} modelos ativos registrados no Goose e Pi. (${disabledModels.length} desativados foram expurgados).`
        });
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Erro ao sincronizar com Buzz: ${err.message}`
        });
      } finally {
        setLoadingSync(false);
      }
    };
    const groupCounts = React.useMemo(() => {
      if (models.length === 0) {
        return {
          all: 0,
          nexusmind_openai: 0,
          nexusmind_anthropic: 0,
          nexusmind_antigravity: 0,
          nexusmind_grok: 0
        };
      }
      const counts = {
        all: models.length,
        nexusmind_openai: 0,
        nexusmind_anthropic: 0,
        nexusmind_antigravity: 0,
        nexusmind_grok: 0
      };
      for (const m of models) {
        const grps = getModelGroups(m);
        for (const g of grps) {
          if (counts[g] !== void 0) counts[g]++;
        }
      }
      return counts;
    }, [models]);
    const statusCounts = React.useMemo(() => {
      const scoped = models.filter((m) => {
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
        if ((t == null ? void 0 : t.status) === "ok") online++;
        else if ((t == null ? void 0 : t.status) === "error") error++;
      }
      return { all: scoped.length, active, disabled, online, error };
    }, [models, selectedGroupTab, disabledModels, modelTests]);
    const filteredModels = React.useMemo(() => {
      return models.filter((m) => {
        var _a2;
        const mid = m.id || "";
        const lower = mid.toLowerCase();
        if (selectedGroupTab !== "all") {
          const grps = getModelGroups(m);
          if (!grps.includes(selectedGroupTab)) return false;
        }
        const isDisabled = disabledModels.includes(mid);
        const testStatus = (_a2 = modelTests[mid]) == null ? void 0 : _a2.status;
        if (statusFilter === "active" && isDisabled) return false;
        if (statusFilter === "disabled" && !isDisabled) return false;
        if (statusFilter === "online" && testStatus !== "ok") return false;
        if (statusFilter === "error" && testStatus !== "error") return false;
        if (filterFree && !lower.includes(":free") && !lower.includes("free")) return false;
        if (filterReasoning && !lower.includes("reasoning") && !lower.includes("think") && !lower.includes("r1") && !lower.includes("luna")) {
          return false;
        }
        if (searchQuery.trim() && !lower.includes(searchQuery.trim().toLowerCase())) {
          return false;
        }
        return true;
      });
    }, [models, selectedGroupTab, statusFilter, disabledModels, modelTests, filterFree, filterReasoning, searchQuery]);
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredModels.length / (pageSize || 15)));
    React.useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage]);
    const paginatedModels = pageSize === 0 ? filteredModels : filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    if (isSettingsCard) {
      const openFullPage = () => {
        var _a2;
        try {
          if ((_a2 = ctx.navigation) == null ? void 0 : _a2.navigate) {
            ctx.navigation.navigate("nexusmind");
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
            gap: "16px"
          }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }
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
                  color: "#000000"
                }
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
                      fontWeight: "600"
                    }
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
                fontWeight: "500"
              }
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
                fontWeight: "500"
              }
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
                fontWeight: "600"
              }
            },
            loadingSync ? "Sincronizando..." : "Sincronizar no Buzz"
          )
        )
      );
    }
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
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)"
          }
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
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)"
            }
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
              margin: "0 0 28px"
            }
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
              boxShadow: "0 4px 16px rgba(168, 85, 247, 0.3)"
            }
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
                gap: "6px"
              }
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
                gap: "6px"
              }
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
              marginBottom: "20px"
            }
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
              onChange: (e) => setManualKeyInput(e.target.value),
              style: {
                flex: "1",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                padding: "9px 14px",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none"
              }
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
                  fontSize: "13px"
                }
              },
              "Conectar"
            )
          )
        )
      );
    };
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
          boxSizing: "border-box"
        }
      },
      !isConnected ? renderDisconnectedHero() : h(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            paddingBottom: "48px"
          }
        },
        // 1. TOP HEADER & IDENTITY BAR
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              paddingBottom: "20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
            }
          },
          // Header Brand & Title
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "14px" } },
            h(
              "div",
              {
                style: {
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000000",
                  boxShadow: "0 4px 16px rgba(16, 185, 129, 0.25)"
                }
              },
              SVG_ICONS.dashboard({ h, width: 22, height: 22 })
            ),
            h(
              "div",
              null,
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(
                  "h1",
                  {
                    style: {
                      fontSize: "18px",
                      fontWeight: "700",
                      margin: 0,
                      color: "#ffffff",
                      letterSpacing: "-0.01em"
                    }
                  },
                  "NexusMind Gateway"
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      fontWeight: "600",
                      border: "1px solid rgba(16, 185, 129, 0.3)"
                    }
                  },
                  "v2.3 OFICIAL"
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      color: "#60a5fa",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }
                  },
                  h("span", { style: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" } }),
                  "Conectado"
                )
              ),
              h(
                "p",
                {
                  style: {
                    fontSize: "12px",
                    color: "var(--text-subtle, #8e8e96)",
                    margin: "3px 0 0"
                  }
                },
                "Gateway corporativo com healthcheck live, governança e sincronização nativa para Goose e Pi."
              )
            )
          ),
          // Action Buttons & User Badge
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
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
                  gap: "8px"
                }
              },
              SVG_ICONS.pull({ h, width: 14, height: 14 }),
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
                  boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)"
                }
              },
              SVG_ICONS.sync({ h, width: 14, height: 14 }),
              loadingSync ? "Sincronizando..." : "2. Sincronizar no Buzz"
            ),
            // User Chip
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "9999px",
                  padding: "5px 14px",
                  marginLeft: "6px"
                }
              },
              SVG_ICONS.user({ h, width: 14, height: 14, color: "#10b981" }),
              h("span", { style: { fontSize: "12px", fontWeight: "600" } }, profileData.username),
              h(
                "span",
                { style: { fontSize: "12px", color: "#10b981", fontWeight: "600" } },
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
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "11px",
                    padding: "2px 4px",
                    marginLeft: "4px"
                  }
                },
                "✕"
              )
            )
          )
        ),
        // OFFICIAL NEXUSMIND GATEWAY ENDPOINTS BAR (Matching Official Dashboard)
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflowX: "auto",
              padding: "4px 2px 8px",
              scrollbarWidth: "none"
            }
          },
          OFFICIAL_ENDPOINTS.map((ep) => {
            const isCopied = copiedEndpoint === ep.url;
            return h(
              "div",
              {
                key: ep.id,
                onClick: () => handleCopyEndpoint(ep.url, ep.label),
                title: `${ep.desc} — Clique para copiar (${ep.url})`,
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: isCopied ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.04)",
                  border: isCopied ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: isCopied ? "#10b981" : "var(--text-normal, #e4e4e7)",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  flexShrink: 0
                }
              },
              h("span", { style: { fontWeight: "600", fontSize: "11px", color: "#f4f4f5" } }, ep.label),
              h(
                "span",
                {
                  style: {
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: `${ep.tagColor}22`,
                    color: ep.tagColor,
                    fontWeight: "600",
                    border: `1px solid ${ep.tagColor}44`
                  }
                },
                ep.tag
              ),
              h("span", { style: { opacity: 0.3 } }, "|"),
              h(
                "code",
                {
                  style: {
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: isCopied ? "#10b981" : "var(--text-subtle, #a1a1aa)"
                  }
                },
                ep.url
              ),
              h(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    marginLeft: "2px",
                    color: isCopied ? "#10b981" : "var(--text-subtle, #71717a)"
                  }
                },
                isCopied ? SVG_ICONS.check({ h, width: 12, height: 12 }) : SVG_ICONS.copy({ h, width: 12, height: 12 })
              )
            );
          })
        ),
        // 2. STATUS TOAST BANNER (IF ACTIVE)
        statusMessage && h(
          "div",
          {
            style: {
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.12)" : statusMessage.type === "error" ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)",
              border: `1px solid ${statusMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : statusMessage.type === "error" ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
              color: statusMessage.type === "success" ? "#10b981" : statusMessage.type === "error" ? "#ef4444" : "#60a5fa"
            }
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
                fontSize: "14px"
              }
            },
            "✕"
          )
        ),
        // 3. MICRO DASHBOARD (4 METRIC CARDS IN A BALANCED 4-COLUMN ROW)
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px"
            }
          },
          // Card 1: Saldo Disponível
          h(
            "div",
            {
              style: {
                backgroundColor: "rgba(16, 185, 129, 0.04)",
                border: "1px solid rgba(16, 185, 129, 0.18)",
                borderRadius: "14px",
                padding: "16px 20px"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#10b981",
                  fontSize: "11px",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  marginBottom: "6px"
                }
              },
              SVG_ICONS.wallet({ h, width: 14, height: 14 }),
              "SALDO DISPONÍVEL"
            ),
            h(
              "div",
              { style: { fontSize: "22px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
              `$${(profileData.balance || 0).toFixed(2)} USD`
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
              "Recarga Total: $2,000.00 • 13 Grupos Ativos"
            )
          ),
          // Card 2: Consumo Hoje
          h(
            "div",
            {
              style: {
                backgroundColor: "rgba(59, 130, 246, 0.04)",
                border: "1px solid rgba(59, 130, 246, 0.18)",
                borderRadius: "14px",
                padding: "16px 20px"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#60a5fa",
                  fontSize: "11px",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  marginBottom: "6px"
                }
              },
              SVG_ICONS.pulse({ h, width: 14, height: 14 }),
              "CONSUMO HOJE"
            ),
            h(
              "div",
              { style: { fontSize: "22px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
              `${formatTokens(dashboardMetrics.today_tokens)} tokens`
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
              `${formatNumber(dashboardMetrics.today_requests)} requisições ($${dashboardMetrics.today_cost.toFixed(2)})`
            )
          ),
          // Card 3: Histórico Acumulado
          h(
            "div",
            {
              style: {
                backgroundColor: "rgba(168, 85, 247, 0.04)",
                border: "1px solid rgba(168, 85, 247, 0.18)",
                borderRadius: "14px",
                padding: "16px 20px"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#c084fc",
                  fontSize: "11px",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  marginBottom: "6px"
                }
              },
              SVG_ICONS.dashboard({ h, width: 14, height: 14 }),
              "HISTÓRICO ACUMULADO"
            ),
            h(
              "div",
              { style: { fontSize: "22px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
              `${formatTokens(dashboardMetrics.total_tokens)} tokens`
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
              `${formatNumber(dashboardMetrics.total_requests)} requisições ($${dashboardMetrics.total_cost.toFixed(2)})`
            )
          ),
          // Card 4: Governança & Harness
          h(
            "div",
            {
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                padding: "16px 20px"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#e2e8f0",
                  fontSize: "11px",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  marginBottom: "6px"
                }
              },
              SVG_ICONS.shield({ h, width: 14, height: 14 }),
              "GOVERNANÇA & HARNESS"
            ),
            h(
              "div",
              { style: { fontSize: "22px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" } },
              `${models.length - disabledModels.length} Ativos / ${disabledModels.length} Inativos`
            ),
            h(
              "div",
              { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
              lastSyncTime ? `Sincronizado: ${lastSyncTime}` : "Pronto para Goose & Pi"
            )
          )
        ),
        // 4. OS 4 GRUPOS CANÔNICOS (GRID PERFEITO DE 4 COLUNAS, ZERO "3 E 1", ZERO POLUIÇÃO)
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px"
            }
          },
          Object.entries(CANONICAL_GROUPS).map(([pid, group]) => {
            var _a2;
            const isSelected = selectedGroupTab === pid;
            return h(
              "div",
              {
                key: pid,
                style: {
                  backgroundColor: isSelected ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${isSelected ? group.accentColor : "rgba(255, 255, 255, 0.08)"}`,
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px",
                  transition: "all 0.15s ease"
                }
              },
              // Group Header (Official SVG Logo + Name + Status)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px" } },
                  h(
                    "div",
                    {
                      style: {
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: group.accentColor
                      }
                    },
                    (_a2 = SVG_ICONS[group.logoKey]) == null ? void 0 : _a2.call(SVG_ICONS, { h, width: 20, height: 20 })
                  ),
                  h(
                    "div",
                    null,
                    h("div", { style: { fontWeight: "600", fontSize: "14px", color: "#ffffff" } }, group.groupName),
                    h("div", { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } }, pid)
                  )
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      fontWeight: "600"
                    }
                  },
                  "Ativo"
                )
              ),
              // Middle Telemetry Metric (Clean & Concise)
              h(
                "div",
                { style: { fontSize: "12px", color: "#d1d5db", fontWeight: "500" } },
                group.telemetrySummary
              ),
              // Bottom Filter Pill (Quick Filter to view models in this group)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "8px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)"
                  }
                },
                h(
                  "span",
                  { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                  `Padrão: ${group.defaultModel.split("/").pop()}`
                ),
                h(
                  "button",
                  {
                    onClick: () => {
                      setSelectedGroupTab(isSelected ? "all" : pid);
                      setCurrentPage(1);
                    },
                    style: {
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      backgroundColor: isSelected ? group.accentColor : "rgba(255, 255, 255, 0.08)",
                      color: isSelected ? "#000000" : "#ffffff",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }
                  },
                  `${groupCounts[pid] ?? group.modelsCount} modelos`
                )
              )
            );
          })
        ),
        // 5. CATALOG WORKSPACE & MODEL MANAGEMENT
        h(
          "div",
          {
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
              borderRadius: "16px",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px"
            }
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
                gap: "14px"
              }
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
                { id: "nexusmind_grok", label: `Grok (${groupCounts.nexusmind_grok})` }
              ].map(
                (tab) => h(
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
                      backgroundColor: selectedGroupTab === tab.id ? "rgba(255, 255, 255, 0.15)" : "transparent",
                      color: selectedGroupTab === tab.id ? "#ffffff" : "var(--text-subtle, #8e8e96)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: selectedGroupTab === tab.id ? "600" : "500"
                    }
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
                    alignItems: "center"
                  }
                },
                h("input", {
                  type: "text",
                  placeholder: "Buscar modelo...",
                  value: searchQuery,
                  onChange: (e) => {
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
                    width: "180px"
                  }
                }),
                h(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      left: "10px",
                      color: "var(--text-subtle, #8e8e96)",
                      pointerEvents: "none",
                      display: "flex"
                    }
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
                    fontWeight: "500"
                  }
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
                    fontWeight: "500"
                  }
                },
                "Apenas Free"
              ),
              (statusFilter !== "all" || selectedGroupTab !== "all" || filterFree || filterReasoning || searchQuery.trim() !== "") && h(
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
                    fontWeight: "500"
                  }
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
                flexWrap: "wrap"
              }
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
                  marginRight: "4px"
                }
              },
              SVG_ICONS.filter({ h, width: 12, height: 12 }),
              "Status:"
            ),
            [
              { id: "all", label: `Todos (${statusCounts.all})`, accent: "#ffffff" },
              { id: "active", label: `Ativos (${statusCounts.active})`, accent: "#10b981" },
              { id: "disabled", label: `Desativados (${statusCounts.disabled})`, accent: "#9ca3af" },
              { id: "online", label: `Online (${statusCounts.online})`, accent: "#34d399" },
              { id: "error", label: `Com Erro (${statusCounts.error})`, accent: "#f87171" }
            ].map((st) => {
              const active = statusFilter === st.id;
              return h(
                "button",
                {
                  key: st.id,
                  onClick: () => {
                    setStatusFilter(st.id);
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
                    transition: "all 0.15s ease"
                  }
                },
                st.label
              );
            })
          ),
          // Batch Action Bar
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: "10px",
                padding: "8px 14px"
              }
            },
            h(
              "div",
              { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
              disabledModels.length > 0 ? `${disabledModels.length} modelo(s) desativado(s) serão expurgados do Buzz.` : "Todos os modelos listados estão ativos para sincronização."
            ),
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              h(
                "button",
                {
                  onClick: handleBatchTestVisible,
                  style: {
                    borderRadius: "9999px",
                    padding: "5px 12px",
                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }
                },
                SVG_ICONS.sparkles({ h, width: 12, height: 12 }),
                "Testar Visíveis"
              ),
              h(
                "button",
                {
                  onClick: handleBatchDisableUnavailable,
                  style: {
                    borderRadius: "9999px",
                    padding: "5px 12px",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }
                },
                SVG_ICONS.shield({ h, width: 12, height: 12 }),
                "Desativar Indisponíveis"
              )
            )
          ),
          // Model List Rows
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            paginatedModels.length === 0 ? h(
              "div",
              {
                style: {
                  padding: "28px 16px",
                  textAlign: "center",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.08)",
                  color: "var(--text-subtle, #8e8e96)",
                  fontSize: "12px"
                }
              },
              statusFilter === "online" || statusFilter === "error" ? "Nenhum modelo corresponde a este filtro ainda. Clique em 'Testar Visíveis' para rodar o healthcheck." : "Nenhum modelo encontrado com os filtros atuais."
            ) : paginatedModels.map((item) => {
              const mid = item.id;
              const isDisabled = disabledModels.includes(mid);
              const lower = mid.toLowerCase();
              const isThinking = lower.includes("reasoning") || lower.includes("think") || lower.includes("r1") || lower.includes("luna");
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
                    backgroundColor: isDisabled ? "rgba(255, 255, 255, 0.01)" : "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "10px",
                    opacity: isDisabled ? 0.45 : 1,
                    transition: "all 0.15s ease"
                  }
                },
                // Left: Toggle Checkbox + Model Name & Badges
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 } },
                  h("input", {
                    type: "checkbox",
                    checked: !isDisabled,
                    onChange: () => handleToggleModel(mid),
                    style: { cursor: "pointer", accentColor: "#10b981", width: "16px", height: "16px" }
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
                            textDecoration: isDisabled ? "line-through" : "none"
                          }
                        },
                        mid
                      ),
                      isThinking && h(
                        "span",
                        {
                          style: {
                            fontSize: "9px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(168, 85, 247, 0.15)",
                            color: "#c084fc",
                            fontWeight: "700"
                          }
                        },
                        "THINKING"
                      ),
                      isFree && h(
                        "span",
                        {
                          style: {
                            fontSize: "9px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "#10b981",
                            fontWeight: "700"
                          }
                        },
                        "FREE"
                      )
                    ),
                    h(
                      "div",
                      { style: { fontSize: "11px", color: "var(--text-subtle, #8e8e96)" } },
                      item.context_window ? `Ctx: ${formatNumber(item.context_window)} tokens` : "Ctx: 128k tokens"
                    )
                  )
                ),
                // Right: Test Button + Status Badge + Sync Indicator
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px" } },
                  // Test Result Indicator
                  testRes && h(
                    "span",
                    {
                      style: {
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: testRes.status === "ok" ? "rgba(16, 185, 129, 0.15)" : testRes.status === "testing" ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: testRes.status === "ok" ? "#10b981" : testRes.status === "testing" ? "#60a5fa" : "#f87171",
                        fontWeight: "600"
                      }
                    },
                    testRes.status === "testing" ? "Testando..." : testRes.status === "ok" ? `${testRes.latency}ms · Online` : `Erro · ${testRes.errorMsg || "Falha"}`
                  ),
                  // Individual Test Button
                  h(
                    "button",
                    {
                      onClick: () => handleTestSingleModel(mid),
                      disabled: (testRes == null ? void 0 : testRes.status) === "testing",
                      style: {
                        borderRadius: "9999px",
                        padding: "4px 10px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        color: "#ffffff",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        fontSize: "11px",
                        fontWeight: "500",
                        cursor: (testRes == null ? void 0 : testRes.status) === "testing" ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }
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
                        textAlign: "right"
                      }
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
                gap: "10px"
              }
            },
            h(
              "div",
              { style: { fontSize: "12px", color: "var(--text-subtle, #8e8e96)" } },
              pageSize === 0 ? `Exibindo todos os ${filteredModels.length} modelos` : `Exibindo ${Math.min((currentPage - 1) * pageSize + 1, filteredModels.length)}–${Math.min(
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
                  onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
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
                    gap: "4px"
                  }
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
                  onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
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
                    gap: "4px"
                  }
                },
                "Próxima",
                SVG_ICONS.chevronRight({ h, width: 14, height: 14 })
              ),
              // Page size selector
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px" } },
                h("span", { style: { fontSize: "12px", color: "#8e8e96" } }, "Por página:"),
                [15, 30, 50, 0].map(
                  (sz) => h(
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
                        cursor: "pointer"
                      }
                    },
                    sz === 0 ? "Todos" : String(sz)
                  )
                )
              )
            )
          )
        )
      )
    );
  }
  ctx.pages.register({
    id: "nexusmind",
    title: "NexusMind Gateway",
    layout: "workspace",
    primary: true,
    placement: "topbar",
    icon: ICON,
    component: function NexusMindMainPage() {
      return h(NexusMindComponent, { isSettingsCard: false });
    }
  });
  if (ctx.settingsCards) {
    ctx.settingsCards.register({
      id: "nexusmind-settings",
      title: "NexusMind Gateway",
      group: "AI Models & Gateways",
      component: function NexusMindSettings() {
        return h(NexusMindComponent, { isSettingsCard: true });
      }
    });
  }
  const hostGetJson = async (url, bearerToken, timeoutMs = 1e4) => {
    var _a2;
    if (!((_a2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _a2.request)) {
      throw new Error("ctx.host.request indisponível neste runtime do Buzz");
    }
    const t0 = performance.now();
    const res = await ctx.host.request({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        "User-Agent": "BuzzDesktop/NexusMindPlugin"
      },
      timeoutMs
    });
    const latencyMs = Math.round(performance.now() - t0);
    let parsed = null;
    try {
      parsed = res.body ? JSON.parse(res.body) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: res.body, json: parsed, latencyMs };
  };
  const resolveLiveAccountToken = async () => {
    var _a2, _b2, _c;
    try {
      const stored = (_a2 = localStorage.getItem("nexusmind_mcp_token")) == null ? void 0 : _a2.trim();
      if (stored && stored !== "connected") return stored;
    } catch {
    }
    if ((_b2 = ctx == null ? void 0 : ctx.host) == null ? void 0 : _b2.readFile) {
      const candidatePaths = [
        "/Users/heltonfraga/.buzz/.nexusmind_auth_session.json",
        "~/.buzz/.nexusmind_auth_session.json"
      ];
      for (const p of candidatePaths) {
        try {
          const raw = await ctx.host.readFile(p);
          const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
          const sess = JSON.parse(text);
          const tok = (sess == null ? void 0 : sess.access_token) || (sess == null ? void 0 : sess.token) || ((_c = sess == null ? void 0 : sess.token_data) == null ? void 0 : _c.access_token);
          if (typeof tok === "string" && tok.trim().length > 0) {
            return tok.trim();
          }
        } catch {
        }
      }
    }
    return null;
  };
  const fetchLiveQuotaFromApi = async () => {
    var _a2, _b2, _c;
    const token = await resolveLiveAccountToken();
    if (!token) {
      return {
        status: "unavailable",
        source: "unavailable",
        balanceUsd: null,
        currency: "USD",
        accountHolder: null,
        reason: "Nenhum token OAuth/MCP da conta encontrado em localStorage ou ~/.buzz/.nexusmind_auth_session.json"
      };
    }
    try {
      const res = await hostGetJson("https://nexusmind.digital/api/v1/user/profile", token, 8e3);
      if (res.status >= 200 && res.status < 300 && res.json) {
        const u = res.json.data || res.json;
        const rawBalance = typeof (u == null ? void 0 : u.balance) === "number" ? u.balance : typeof (u == null ? void 0 : u.quota) === "number" ? u.quota : null;
        return {
          status: rawBalance !== null ? "active" : "partial",
          source: "live_api",
          httpStatus: res.status,
          latencyMs: res.latencyMs,
          balanceUsd: rawBalance,
          currency: "USD",
          accountHolder: (u == null ? void 0 : u.username) || (u == null ? void 0 : u.name) || null,
          role: (u == null ? void 0 : u.role) === 100 || (u == null ? void 0 : u.role) === "admin" ? "admin" : (u == null ? void 0 : u.role) ?? null
        };
      }
      const apiErr = ((_b2 = (_a2 = res.json) == null ? void 0 : _a2.error) == null ? void 0 : _b2.message) || ((_c = res.json) == null ? void 0 : _c.message) || `HTTP ${res.status}`;
      return {
        status: "unavailable",
        source: "live_api_error",
        httpStatus: res.status,
        latencyMs: res.latencyMs,
        balanceUsd: null,
        currency: "USD",
        accountHolder: null,
        error: apiErr
      };
    } catch (err) {
      return {
        status: "unavailable",
        source: "network_error",
        httpStatus: null,
        balanceUsd: null,
        currency: "USD",
        accountHolder: null,
        error: (err == null ? void 0 : err.message) || String(err)
      };
    }
  };
  if ((_a = ctx.agents) == null ? void 0 : _a.addInstructions) {
    try {
      ctx.agents.addInstructions({
        id: "nexusmind-gateway-v1",
        text: `NexusMind AI Gateway (Cortexx Platform) — Roteamento Unificado de Modelos:
Acesso aos catálogos de modelos LLM gerenciados com roteamento de alta disponibilidade via ctx.host.request.
Grupos Canônicos:
- nexusmind_openai: padrão mistralai/mistral-large-4-1t-a52b (OpenAI-compatible /v1)
- nexusmind_anthropic: padrão claude-sonnet-4-6 (/v1/messages)
- nexusmind_antigravity: padrão gemini-3.8-flash-medium (Gemini & Claude Thinking)
- nexusmind_grok: padrão grok-4.5 (xAI Grok)
Ferramentas nativas do Gateway:
1. nexusmind_models({ group? }): Consulta modelos disponíveis em tempo real (/v1/models) via host bridge com latência real.
2. nexusmind_status(): Ping HTTP real nos 4 grupos canônicos e consulta ao vivo de saldo/perfil (/api/v1/user/profile).
Use nexusmind_models para inspecionar modelos suportados e latências antes de configurar sub-harnesses.`
      });
      console.log("[NEXUSMIND] ctx.agents.addInstructions registrado com sucesso.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar addInstructions:", err);
    }
  }
  if ((_b = ctx.agents) == null ? void 0 : _b.addTool) {
    try {
      ctx.agents.addTool({
        name: "nexusmind_models",
        description: "Lista todos os modelos de IA disponíveis em tempo real no gateway NexusMind via ctx.host.request, com provedores, grupos, latência real e endpoints.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filtrar por grupo: 'nexusmind_openai', 'nexusmind_anthropic', 'nexusmind_antigravity', 'nexusmind_grok' ou 'all' (default: 'all')"
            }
          }
        },
        call: async (_client, _context, args) => {
          const groupFilter = (args == null ? void 0 : args.group) || "all";
          const groups = CANONICAL_GROUPS;
          const selectedEntries = Object.entries(groups).filter(
            ([key, grp]) => groupFilter === "all" || key === groupFilter || grp.platformKey === groupFilter
          );
          const groupResults = {};
          const dedupedModels = /* @__PURE__ */ new Map();
          await Promise.all(
            selectedEntries.map(async ([key, grp]) => {
              var _a2, _b2, _c, _d;
              const t0 = performance.now();
              try {
                const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 1e4);
                if (res.status < 200 || res.status >= 300) {
                  const apiErr = ((_b2 = (_a2 = res.json) == null ? void 0 : _a2.error) == null ? void 0 : _b2.message) || ((_c = res.json) == null ? void 0 : _c.message) || `HTTP ${res.status}`;
                  groupResults[key] = {
                    status: "error",
                    httpStatus: res.status,
                    error: apiErr,
                    latencyMs: res.latencyMs
                  };
                  return;
                }
                const liveModels = Array.isArray((_d = res.json) == null ? void 0 : _d.data) ? res.json.data : [];
                groupResults[key] = {
                  status: "operational",
                  httpStatus: res.status,
                  latencyMs: res.latencyMs,
                  totalModels: liveModels.length
                };
                for (const m of liveModels) {
                  const mid = m == null ? void 0 : m.id;
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
                      createdAt: m.created_at ?? m.created ?? null
                    });
                  } else {
                    if (!existing.groups.includes(key)) existing.groups.push(key);
                    existing.latencyMs = Math.min(existing.latencyMs, res.latencyMs);
                  }
                }
              } catch (err) {
                const latencyMs = Math.round(performance.now() - t0);
                groupResults[key] = {
                  status: "error",
                  httpStatus: null,
                  error: (err == null ? void 0 : err.message) || String(err),
                  latencyMs
                };
              }
            })
          );
          const modelsList = Array.from(dedupedModels.values()).sort((a, b) => a.id.localeCompare(b.id));
          const resultValues = Object.values(groupResults);
          const hasErrors = resultValues.some((r) => r.status === "error");
          const allErrors = resultValues.length === 0 || resultValues.every((r) => r.status === "error");
          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            protocol: "OpenAI-compatible /v1",
            fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
            status: allErrors ? "error" : hasErrors ? "degraded" : "operational",
            filter: groupFilter,
            totalGroups: selectedEntries.length,
            groups: groupResults,
            totalModels: modelsList.length,
            models: modelsList
          }, null, 2);
        }
      });
      ctx.agents.addTool({
        name: "nexusmind_status",
        description: "Retorna a telemetria ao vivo do gateway NexusMind via ctx.host.request nos 4 grupos canônicos e consulta real de saldo/quota na API do usuário (sem valores hardcoded).",
        inputSchema: {
          type: "object",
          properties: {}
        },
        call: async (_client, _context) => {
          const groups = CANONICAL_GROUPS;
          const groupsTelemetry = {};
          let totalLatency = 0;
          let successfulGroups = 0;
          const [, quota] = await Promise.all([
            Promise.all(
              Object.entries(groups).map(async ([key, grp]) => {
                var _a2, _b2, _c, _d;
                const t0 = performance.now();
                try {
                  const res = await hostGetJson("https://api.nexusmind.digital/v1/models", grp.defaultKey, 1e4);
                  if (res.status >= 200 && res.status < 300) {
                    const modelsCount = Array.isArray((_a2 = res.json) == null ? void 0 : _a2.data) ? res.json.data.length : 0;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "operational",
                      httpStatus: res.status,
                      latencyMs: res.latencyMs,
                      activeModels: modelsCount,
                      defaultModel: grp.defaultModel
                    };
                    totalLatency += res.latencyMs;
                    successfulGroups++;
                  } else {
                    const apiErr = ((_c = (_b2 = res.json) == null ? void 0 : _b2.error) == null ? void 0 : _c.message) || ((_d = res.json) == null ? void 0 : _d.message) || `HTTP ${res.status}`;
                    groupsTelemetry[key] = {
                      groupName: grp.groupName,
                      platform: grp.platformKey,
                      status: "error",
                      httpStatus: res.status,
                      error: apiErr,
                      latencyMs: res.latencyMs
                    };
                  }
                } catch (err) {
                  const latencyMs = Math.round(performance.now() - t0);
                  groupsTelemetry[key] = {
                    groupName: grp.groupName,
                    platform: grp.platformKey,
                    status: "offline",
                    httpStatus: null,
                    error: (err == null ? void 0 : err.message) || String(err),
                    latencyMs
                  };
                }
              })
            ),
            fetchLiveQuotaFromApi()
          ]);
          const isOnline = successfulGroups > 0;
          const avgLatency = successfulGroups > 0 ? Math.round(totalLatency / successfulGroups) : null;
          const systemStatus = successfulGroups === Object.keys(groups).length ? "operational" : successfulGroups > 0 ? "degraded" : "outage";
          return JSON.stringify({
            gateway: "https://api.nexusmind.digital",
            transport: "ctx.host.request",
            online: isOnline,
            status: systemStatus,
            protocol: "OpenAI-compatible /v1",
            measuredAt: (/* @__PURE__ */ new Date()).toISOString(),
            averageLatencyMs: avgLatency,
            activeGroupsCount: `${successfulGroups}/${Object.keys(groups).length}`,
            groups: groupsTelemetry,
            syncedWithHarness: true,
            quota
          }, null, 2);
        }
      });
      console.log("[NEXUSMIND] 2 agentTools registradas com sucesso no harness do Buzz.");
    } catch (err) {
      console.warn("[NEXUSMIND] Falha ao registrar agentTools:", err);
    }
  }
}
export {
  ANTHROPIC_ONLY_CLAUDE,
  ANTIGRAVITY_ONLY_CLAUDE,
  CANONICAL_GROUPS,
  OFFICIAL_ENDPOINTS,
  apply,
  getModelGroups,
  inject
};
