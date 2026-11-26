// Design System nativo do NexusMind Gateway alinhado ao OrgFy Factory (CodeDen + Buzz Desktop).
// Regra canônica (docs/BUZZ_THEME_INHERITANCE.md):
//   - Herda 100% do tema claro/escuro e acento personalizado do Buzz Desktop
//     (--affordance-accent-prominent, --text-on-accent, --accent-3, --accent-7, --accent-link).
//   - Herda 100% da tipografia padrão do Buzz (font-family: inherit em container e controles).
//   - Escopado em [data-nexusmind-root="true"] para nunca vazar estilos para o host.

export const NEXUSMIND_THEME_CSS = `
[data-nexusmind-root="true"] {
  --nm-bg: var(--bg-app, var(--surface-base, #101010));
  --nm-fg: var(--text-primary, var(--text-standard, #f3f4f6));
  --nm-fg-secondary: var(--text-secondary, var(--text-subtle, #c7c7c7));
  --nm-muted: var(--text-tertiary, var(--text-metadata, #9ca3af));
  --nm-card: var(--bg-panel, var(--surface-panel, #18181b));
  --nm-surface: var(--affordance-subtle, var(--surface-inset, #202024));
  --nm-surface-hover: var(--affordance-subtle-hover, #2a2a30);
  --nm-inset: var(--surface-inset, var(--bg-app, #121215));
  --nm-selected: var(--affordance-selected, #2c2c32);
  --nm-border: var(--border-primary, var(--border-standard, rgba(255, 255, 255, 0.09)));
  --nm-border-strong: var(--border-prominent, var(--border-control, rgba(255, 255, 255, 0.16)));

  /* Acento 100% herdado do Buzz Desktop (Bee, Citrus, Cobalt, Iris, Magenta, Mono) */
  --nm-primary: var(--affordance-accent-prominent, var(--accent-9, #3dd68c));
  --nm-primary-hover: var(--affordance-accent-prominent-hover, var(--accent-10, var(--nm-primary)));
  --nm-primary-pressed: var(--affordance-accent-prominent-pressed, var(--accent-pressed, var(--nm-primary)));
  --nm-primary-fg: var(--text-on-accent, var(--accent-contrast, #08120c));
  --nm-primary-soft: var(--accent-3, color-mix(in srgb, var(--nm-primary) 14%, transparent));
  --nm-primary-border: var(--accent-7, color-mix(in srgb, var(--nm-primary) 42%, transparent));
  --nm-primary-text: var(--accent-link, var(--accent-11, var(--nm-primary)));

  /* Semânticos */
  --nm-ok: var(--green-11, #3dd68c);
  --nm-ok-soft: var(--green-3, rgba(61, 214, 140, 0.13));
  --nm-ok-border: var(--green-7, rgba(61, 214, 140, 0.35));
  --nm-warn: var(--amber-11, #fbbf24);
  --nm-warn-soft: var(--amber-3, rgba(245, 158, 11, 0.13));
  --nm-warn-border: var(--amber-7, rgba(245, 158, 11, 0.38));
  --nm-danger: var(--red-11, #f87171);
  --nm-danger-soft: var(--red-3, rgba(239, 68, 68, 0.14));
  --nm-danger-border: var(--red-7, rgba(239, 68, 68, 0.42));
  --nm-info: var(--blue-11, #60a5fa);
  --nm-info-soft: var(--blue-3, rgba(56, 189, 248, 0.13));
  --nm-info-border: var(--blue-7, rgba(56, 189, 248, 0.35));

  --nm-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  color: var(--nm-fg);
  font-family: inherit;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

[data-nexusmind-root="true"] *,
[data-nexusmind-root="true"] *::before,
[data-nexusmind-root="true"] *::after {
  box-sizing: border-box;
}

[data-nexusmind-root="true"] button,
[data-nexusmind-root="true"] input,
[data-nexusmind-root="true"] select,
[data-nexusmind-root="true"] textarea {
  font-family: inherit;
  font-size: inherit;
}

.nm-workspace {
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background: transparent;
}

.nm-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 26px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.nm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--nm-border);
}

.nm-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--nm-primary-soft);
  border: 1px solid var(--nm-primary-border);
  color: var(--nm-primary-text);
  flex-shrink: 0;
}

.nm-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 12px;
  overflow: hidden;
}

.nm-card-pad {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 12px;
  padding: 14px 16px;
}

.nm-surface {
  background: var(--nm-surface);
  border: 1px solid var(--nm-border);
  border-radius: 9px;
}

.nm-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.nm-kpi-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 10px;
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.14s ease;
}

.nm-kpi-card:hover {
  border-color: var(--nm-border-strong);
}

.nm-kpi-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--nm-muted);
}

.nm-kpi-val {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--nm-fg);
}

.nm-bar-track {
  height: 4px;
  border-radius: 9999px;
  background: var(--nm-surface);
  overflow: hidden;
}

.nm-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--nm-primary);
  transition: width 0.25s ease;
}

.nm-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--nm-border);
  background: var(--nm-card);
}

.nm-seg-btn {
  padding: 5px 11px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--nm-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.nm-seg-btn:hover {
  color: var(--nm-fg);
}

.nm-seg-btn[data-active="true"] {
  background: var(--nm-selected);
  color: var(--nm-fg);
  font-weight: 600;
}

.nm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--nm-border);
  background: var(--nm-surface);
  color: var(--nm-fg);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.nm-btn:hover:not(:disabled) {
  background: var(--nm-surface-hover);
  border-color: var(--nm-border-strong);
}

.nm-btn[data-variant="primary"] {
  background: var(--nm-primary);
  border-color: var(--nm-primary);
  color: var(--nm-primary-fg);
  font-weight: 600;
}

.nm-btn[data-variant="primary"]:hover:not(:disabled) {
  background: var(--nm-primary-hover);
  border-color: var(--nm-primary-hover);
  color: var(--nm-primary-fg);
}

.nm-btn[data-variant="primary"]:active:not(:disabled) {
  background: var(--nm-primary-pressed);
  border-color: var(--nm-primary-pressed);
  color: var(--nm-primary-fg);
}

.nm-btn[data-variant="soft"] {
  background: var(--nm-primary-soft);
  border-color: var(--nm-primary-border);
  color: var(--nm-primary-text);
  font-weight: 600;
}

.nm-btn[data-variant="ghost"] {
  background: transparent;
  border-color: transparent;
  color: var(--nm-muted);
}

.nm-btn[data-variant="ghost"]:hover:not(:disabled) {
  background: var(--nm-surface);
  color: var(--nm-fg);
}

.nm-btn[data-variant="danger"] {
  background: var(--nm-danger-soft);
  border-color: var(--nm-danger-border);
  color: var(--nm-danger);
}

.nm-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.nm-input, .nm-select {
  border-radius: 7px;
  background: var(--nm-inset);
  border: 1px solid var(--nm-border);
  color: var(--nm-fg);
  font-size: 12px;
  padding: 5px 10px;
  outline: none;
  transition: border-color 0.12s ease;
}

.nm-input:focus, .nm-select:focus {
  border-color: var(--nm-primary-border);
}

.nm-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--nm-font-mono);
  border: 1px solid var(--nm-border);
  background: var(--nm-surface);
  color: var(--nm-fg-secondary);
  white-space: nowrap;
}

.nm-pill[data-tone="accent"] {
  background: var(--nm-primary-soft);
  border-color: var(--nm-primary-border);
  color: var(--nm-primary-text);
}

.nm-pill[data-tone="ok"] {
  background: var(--nm-ok-soft);
  border-color: var(--nm-ok-border);
  color: var(--nm-ok);
}

.nm-pill[data-tone="warn"] {
  background: var(--nm-warn-soft);
  border-color: var(--nm-warn-border);
  color: var(--nm-warn);
}

.nm-pill[data-tone="danger"] {
  background: var(--nm-danger-soft);
  border-color: var(--nm-danger-border);
  color: var(--nm-danger);
}

.nm-pill[data-tone="info"] {
  background: var(--nm-info-soft);
  border-color: var(--nm-info-border);
  color: var(--nm-info);
}

.nm-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-top: 1px solid var(--nm-border);
  transition: background 0.12s ease;
}

.nm-list-row:first-child {
  border-top: none;
}

.nm-list-row:hover {
  background: var(--nm-surface);
}

.nm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.nm-table th {
  text-align: left;
  padding: 9px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nm-muted);
  border-bottom: 1px solid var(--nm-border);
}

.nm-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--nm-border);
}

.nm-table tbody tr:last-child td {
  border-bottom: none;
}

.nm-table tbody tr:hover {
  background: var(--nm-surface);
}

.nm-check {
  cursor: pointer;
  accent-color: var(--nm-primary);
  width: 14px;
  height: 14px;
}

.nm-mono { font-family: var(--nm-font-mono); }
.nm-num { font-variant-numeric: tabular-nums; }
`;
