import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseProject } from "./firebase-config.js";

const STORAGE_KEY = "engineering-workspace-pages";
const CHART_CLASS = "chart-block";
const CHART_DATA_ATTRIBUTE = "data-chart";
const CHART_TYPES = ["bar", "line", "area", "donut"];
const CHART_COLORS = ["#0c66e4", "#579dff", "#36b37e", "#f5cd47", "#e56910"];
const BODY_TEXT_BLOCK_CLASS = "editor-text-block";
const BODY_TEXT_BLOCK_ATTRIBUTE = "data-block-type";
const BODY_TEXT_BLOCK_VALUE = "text";

const defaultPages = [
  {
    id: "home-dashboard",
    title: "Engineering Command Center",
    category: "Dashboard",
    tags: ["dashboard", "metrics", "leadership"],
    summary: "High-level summary of engineering performance, operational load, and near-term priorities.",
    body: `# Weekly Pulse

## Delivery
- Lead time: 2.8 days
- Deployments this week: 22
- Sprint completion forecast: 91%

## Reliability
- MTTR: 46 minutes
- Open sev-2 incidents: 2
- Highest pressure area: API gateway latency

## Focus this week
- Stabilize self-hosted CI runner capacity
- Finish trace instrumentation for event pipeline
- Remove single-threaded release approvals
`
  },
  {
    id: "platform-oncall",
    title: "Platform On-Call Runbook",
    category: "Runbook",
    tags: ["platform", "incident", "on-call"],
    summary: "Escalation path and first-response checklist for platform incidents.",
    body: `# Incident Intake

Use this page during the first 15 minutes of an incident.

## Triage
- Confirm blast radius
- Assign incident commander
- Start Slack bridge and timeline

## Checks
- Review deploys from the last 60 minutes
- Inspect API gateway health
- Validate database saturation metrics

## Escalation
- Platform manager
- SRE primary
- Security on-call if customer data is impacted
`
  },
  {
    id: "system-architecture",
    title: "Core System Architecture",
    category: "Architecture",
    tags: ["architecture", "services", "reference"],
    summary: "Living notes on service boundaries and operational ownership.",
    body: `# Service Map

## Entry Layer
- Web app
- API gateway
- Authentication service

## Domain Services
- Orders
- Catalog
- Billing
- Search

## Shared Infrastructure
- PostgreSQL
- Kafka
- Redis
- Observability stack

## Ownership
- Platform owns runtime and delivery systems
- Product squads own domain services
`
  }
];

const state = {
  pages: loadLocalPages(),
  activePageId: null,
  searchTerm: "",
  lastSavedAt: null,
  syncMode: firebaseProject.enabled ? "firebase" : "local",
  authReady: false,
  user: null,
  routeMode: "workspace-home"
};

const chartEditorState = {
  chartElement: null,
  originalChart: null,
  open: false
};

let selectedChartElement = null;
let draggedChartElement = null;
let chartDropReferenceNode = null;
let chartDropIndicator = null;
let chartDropRange = null;
let chartResizeState = null;

const elements = {
  pageList: document.querySelector("#page-list"),
  pageCount: document.querySelector("#page-count"),
  editorForm: document.querySelector("#editor-form"),
  publishedTitle: document.querySelector("#published-title"),
  publishedBody: document.querySelector("#published-body"),
  bodyEditor: document.querySelector("#page-body-editor"),
  richToolbar: document.querySelector("#rich-toolbar"),
  chartMenu: document.querySelector("#chart-menu"),
  chartMenuTrigger: document.querySelector("#chart-menu-trigger"),
  chartMenuDropdown: document.querySelector("#chart-menu-dropdown"),
  chartEditorFlyout: document.querySelector("#chart-editor-flyout"),
  fontFamilySelect: document.querySelector("#font-family-select"),
  fontSizeSelect: document.querySelector("#font-size-select"),
  newPageButton: document.querySelector("#new-page-button"),
  duplicatePageButton: document.querySelector("#duplicate-page-button"),
  deletePageButton: document.querySelector("#delete-page-button"),
  syncMode: document.querySelector("#sync-mode"),
  authStatus: document.querySelector("#auth-status"),
  signInButton: document.querySelector("#sign-in-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  pageRouteLink: document.querySelector("#page-route-link"),
  editRouteLink: document.querySelector("#edit-route-link"),
  chartTitleInput: document.querySelector("#chart-title-input"),
  chartSubtitleInput: document.querySelector("#chart-subtitle-input"),
  chartDataInput: document.querySelector("#chart-data-input"),
  chartShowTitleInput: document.querySelector("#chart-show-title-input"),
  chartShowLegendInput: document.querySelector("#chart-show-legend-input"),
  chartShowLabelsInput: document.querySelector("#chart-show-labels-input"),
  chartShowValuesInput: document.querySelector("#chart-show-values-input"),
  chartTitleSizeInput: document.querySelector("#chart-title-size-input"),
  chartLabelSizeInput: document.querySelector("#chart-label-size-input"),
  chartValueSizeInput: document.querySelector("#chart-value-size-input"),
  chartLegendSizeInput: document.querySelector("#chart-legend-size-input"),
  chartSurfaceColorInput: document.querySelector("#chart-surface-color-input"),
  chartBorderColorInput: document.querySelector("#chart-border-color-input"),
  chartTextColorInput: document.querySelector("#chart-text-color-input"),
  chartMutedColorInput: document.querySelector("#chart-muted-color-input"),
  chartAccentColorInput: document.querySelector("#chart-accent-color-input"),
  chartAccentSecondaryInput: document.querySelector("#chart-accent-secondary-input"),
  chartTrackColorInput: document.querySelector("#chart-track-color-input"),
  chartLegendPositionInput: document.querySelector("#chart-legend-position-input"),
  chartSaveButton: document.querySelector("#chart-save-button"),
  chartCancelButton: document.querySelector("#chart-cancel-button")
};

let auth = null;
let db = null;
let unsubscribePages = null;

function loadLocalPages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...defaultPages];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...defaultPages];
    }

    return parsed;
  } catch {
    return [...defaultPages];
  }
}

function saveLocalPages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pages));
}

function renderSaveState(label) {
  return label;
}

function renderPageCount() {
  elements.pageCount.textContent = `${state.pages.length} pages`;
}

function renderSyncState() {
  if (state.syncMode === "firebase") {
    elements.syncMode.textContent = "Firebase";
    if (state.user) {
      const label = state.user.displayName || state.user.email || "Signed-in user";
      elements.authStatus.textContent = `Cloud sync enabled for ${label}.`;
    } else if (state.authReady) {
      elements.authStatus.textContent = "Sign in with Google to load and edit shared workspace pages.";
    } else {
      elements.authStatus.textContent = "Connecting to Firebase authentication.";
    }
  } else {
    elements.syncMode.textContent = "Local mode";
    elements.authStatus.textContent = "Connect Firebase config to enable shared pages and Google sign-in.";
  }

  elements.signInButton.disabled = state.syncMode !== "firebase" || !state.authReady || !!state.user;
  elements.signOutButton.disabled = state.syncMode !== "firebase" || !state.user;
}

function parseRoute() {
  const hash = window.location.hash || "#/";

  if (hash.startsWith("#/page/")) {
    return { mode: "page", pageId: decodeURIComponent(hash.slice(7)) };
  }

  if (hash.startsWith("#/edit/")) {
    return { mode: "workspace-edit", pageId: decodeURIComponent(hash.slice(7)) };
  }

  return { mode: "workspace-home", pageId: null };
}

function setRoute(mode, pageId) {
  const nextHash = mode === "page"
    ? `#/page/${encodeURIComponent(pageId)}`
    : mode === "workspace-edit"
      ? `#/edit/${encodeURIComponent(pageId)}`
      : "#/";

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
    return;
  }

  applyRoute();
}

function applyRoute() {
  const route = parseRoute();
  state.routeMode = route.mode;

  if (route.pageId && state.pages.some((page) => page.id === route.pageId)) {
    state.activePageId = route.pageId;
  } else {
    ensureActivePage();
  }

  document.body.classList.toggle("page-mode", state.routeMode === "page");
  document.body.classList.toggle("workspace-home-mode", state.routeMode === "workspace-home");
}

function ensureActivePage() {
  if (!state.pages.length) {
    state.pages = [...defaultPages];
  }

  const activeExists = state.pages.some((page) => page.id === state.activePageId);
  if (!activeExists) {
    state.activePageId = state.pages[0]?.id ?? null;
  }
}

function getActivePage() {
  ensureActivePage();
  return state.pages.find((page) => page.id === state.activePageId);
}

function filteredPages() {
  const term = state.searchTerm.trim().toLowerCase();
  if (!term) {
    return state.pages;
  }

  return state.pages.filter((page) => {
    const haystack = [
      page.title,
      page.body,
      textFromBodyBlocks(page.bodyBlocks || [])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdown(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(source) {
  const safe = escapeHtml(source || "");
  const lines = safe.split("\n");
  const html = [];
  let inList = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      html.push(inCodeBlock ? "</code></pre>" : "<pre><code>");
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      html.push(`${line}\n`);
      continue;
    }

    if (!line.trim()) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (line.trim() === "---") {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push("<hr>");
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }

  if (inCodeBlock) {
    html.push("</code></pre>");
  }

  return html.join("");
}

function chartId() {
  return `chart-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultChartStyle() {
  return {
    showTitle: true,
    showLegend: true,
    showLabels: true,
    showValues: true,
    titleSize: 18,
    labelSize: 13,
    valueSize: 12,
    legendSize: 13,
    surfaceColor: "#ffffff",
    borderColor: "#d8d9dc",
    textColor: "#172b4d",
    mutedColor: "#5e6c84",
    accentColor: "#0c66e4",
    accentSecondary: "#579dff",
    trackColor: "#eceff1",
    legendPosition: "right",
    widthPercent: 100
  };
}

function defaultChartData(type = "bar") {
  return {
    id: chartId(),
    title: "Team progress",
    subtitle: "",
    type,
    style: defaultChartStyle(),
    series: [
      { label: "Platform", value: 72 },
      { label: "API", value: 58 },
      { label: "Reliability", value: 91 }
    ]
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeChartStyle(style = {}) {
  const defaults = defaultChartStyle();
  return {
    showTitle: style.showTitle !== false,
    showLegend: style.showLegend !== false,
    showLabels: style.showLabels !== false,
    showValues: style.showValues !== false,
    titleSize: clampNumber(style.titleSize, 14, 40, defaults.titleSize),
    labelSize: clampNumber(style.labelSize, 10, 24, defaults.labelSize),
    valueSize: clampNumber(style.valueSize, 10, 24, defaults.valueSize),
    legendSize: clampNumber(style.legendSize, 10, 24, defaults.legendSize),
    surfaceColor: String(style.surfaceColor || defaults.surfaceColor),
    borderColor: String(style.borderColor || defaults.borderColor),
    textColor: String(style.textColor || defaults.textColor),
    mutedColor: String(style.mutedColor || defaults.mutedColor),
    accentColor: String(style.accentColor || defaults.accentColor),
    accentSecondary: String(style.accentSecondary || defaults.accentSecondary),
    trackColor: String(style.trackColor || defaults.trackColor),
    legendPosition: style.legendPosition === "bottom" ? "bottom" : "right",
    widthPercent: clampNumber(style.widthPercent, 35, 100, defaults.widthPercent)
  };
}

function normalizeChartData(data = {}) {
  const rawSeries = Array.isArray(data.series) ? data.series : [];
  const series = rawSeries
    .map((item) => ({
      label: String(item.label || "").trim(),
      value: Number(item.value)
    }))
    .filter((item) => item.label && Number.isFinite(item.value))
    .map((item) => ({
      label: item.label,
      value: Math.max(0, Math.min(100, item.value))
    }));

  return {
    id: data.id || chartId(),
    title: String(data.title || "Team progress").trim() || "Team progress",
    subtitle: String(data.subtitle || "").trim(),
    type: CHART_TYPES.includes(data.type) ? data.type : "bar",
    style: normalizeChartStyle(data.style),
    series: series.length ? series : defaultChartData().series
  };
}

function encodeChartData(data) {
  return encodeURIComponent(JSON.stringify(normalizeChartData(data)));
}

function decodeChartData(value) {
  try {
    return normalizeChartData(JSON.parse(decodeURIComponent(value || "")));
  } catch {
    return defaultChartData();
  }
}

function seriesColorAt(style, index) {
  if (index === 0) return style.accentColor;
  if (index === 1) return style.accentSecondary;
  return CHART_COLORS[index % CHART_COLORS.length];
}

function chartRowsMarkup(series, style) {
  if (!series.length) {
    return '<p class="chart-empty">No chart data yet.</p>';
  }

  return series.map((item) => `
    <div class="chart-row">
      ${style.showLabels ? `<span class="chart-label" style="font-size:${style.labelSize}px">${escapeHtml(item.label)}</span>` : "<span></span>"}
      <div class="chart-track" style="background:${style.trackColor}">
        <div class="chart-fill" style="width:${item.value}%; background:linear-gradient(90deg, ${style.accentColor} 0%, ${style.accentSecondary} 100%)"></div>
      </div>
      ${style.showValues ? `<span class="chart-value" style="font-size:${style.valueSize}px">${Math.round(item.value)}%</span>` : "<span></span>"}
    </div>
  `).join("");
}

function chartLegendMarkup(chart) {
  if (!chart.style.showLegend) {
    return "";
  }

  return `
    <div class="chart-legend">
      ${chart.series.map((item, index) => `
        <div class="chart-legend-item">
          <span class="chart-donut-swatch" style="background:${seriesColorAt(chart.style, index)}"></span>
          <span class="chart-label" style="font-size:${chart.style.legendSize}px">${escapeHtml(item.label)}</span>
          ${chart.style.showValues ? `<span class="chart-value" style="font-size:${chart.style.legendSize}px">${Math.round(item.value)}%</span>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function chartPoints(series, width = 320, height = 160, padding = 18) {
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;
  return series.map((item, index) => {
    const x = padding + step * index;
    const y = height - padding - ((height - padding * 2) * item.value) / 100;
    return { x, y, label: item.label, value: item.value };
  });
}

function renderCartesianChart(chart) {
  const { series, type, style } = chart;
  const points = chartPoints(series);
  const width = 320;
  const height = 160;
  const baseline = height - 18;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPointX = points[points.length - 1]?.x ?? 18;
  const firstPointX = points[0]?.x ?? 18;
  const areaPath = `${path} L ${lastPointX} ${baseline} L ${firstPointX} ${baseline} Z`;
  const bars = points.map((point, index) => `
    <g>
      <rect x="${point.x - 18}" y="${point.y}" width="36" height="${baseline - point.y}" rx="10" fill="${seriesColorAt(style, index)}"></rect>
      ${style.showLabels ? `<text x="${point.x}" y="${baseline + 18}" text-anchor="middle" fill="${style.mutedColor}" font-size="${style.labelSize}">${escapeHtml(point.label)}</text>` : ""}
    </g>
  `).join("");
  const dots = points.map((point) => `
    <g>
      <circle cx="${point.x}" cy="${point.y}" r="4" fill="${style.accentColor}"></circle>
      ${style.showValues ? `<text x="${point.x}" y="${point.y - 10}" text-anchor="middle" fill="${style.textColor}" font-size="${style.valueSize}">${Math.round(point.value)}%</text>` : ""}
      ${style.showLabels ? `<text x="${point.x}" y="${baseline + 18}" text-anchor="middle" fill="${style.mutedColor}" font-size="${style.labelSize}">${escapeHtml(point.label)}</text>` : ""}
    </g>
  `).join("");

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
      <line class="chart-axis" x1="18" y1="${baseline}" x2="${width - 18}" y2="${baseline}"></line>
      <line class="chart-grid" x1="18" y1="18" x2="${width - 18}" y2="18"></line>
      <line class="chart-grid" x1="18" y1="${(height - 18 + 18) / 2}" x2="${width - 18}" y2="${(height - 18 + 18) / 2}"></line>
      ${type === "bar" ? bars : ""}
      ${type === "area" ? `<path class="chart-series-area" d="${areaPath}"></path>` : ""}
      ${type === "line" || type === "area" ? `<path class="chart-series-line" d="${path}" stroke="${style.accentColor}"></path>${dots}` : ""}
    </svg>
  `;
}

function renderDonutChart(chart) {
  const { series, style } = chart;
  const total = series.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 0;
  const segments = series.map((item, index) => {
    const length = (item.value / total) * 314;
    const segment = `
      <circle
        class="chart-donut-segment"
        cx="60"
        cy="60"
        r="50"
        stroke="${seriesColorAt(style, index)}"
        stroke-width="20"
        stroke-dasharray="${length} 314"
        stroke-dashoffset="${-offset}"
      ></circle>
    `;
    offset += length;
    return segment;
  }).join("");
  const legendClass = style.legendPosition === "bottom" ? " chart-donut-layout-bottom" : "";

  return `
    <div class="chart-donut-layout${legendClass}">
      <svg class="chart-donut-svg" viewBox="0 0 120 120" role="img" aria-hidden="true">
        <circle class="chart-donut-track" cx="60" cy="60" r="50" stroke="${style.trackColor}" stroke-width="20"></circle>
        ${segments}
      </svg>
      ${style.showLegend ? `<div class="chart-donut-legend">${chart.series.map((item, index) => `
        <div class="chart-donut-item">
          <span class="chart-donut-swatch" style="background:${seriesColorAt(style, index)}"></span>
          ${style.showLabels ? `<span class="chart-label">${escapeHtml(item.label)}</span>` : "<span></span>"}
          ${style.showValues ? `<span class="chart-value">${Math.round(item.value)}%</span>` : "<span></span>"}
        </div>
      `).join("")}</div>` : ""}
    </div>
  `;
}

function chartVisualizationMarkup(chart) {
  if (chart.type === "donut") {
    return renderDonutChart(chart);
  }

  if (chart.type === "bar") {
    return `<div class="chart-bars">${chartRowsMarkup(chart.series, chart.style)}</div>${chartLegendMarkup(chart)}`;
  }

  return `${renderCartesianChart(chart)}${chartLegendMarkup(chart)}`;
}

function chartInlineStyle(chart) {
  const { style } = chart;
  return [
    `background:${style.surfaceColor}`,
    `border-color:${style.borderColor}`,
    `color:${style.textColor}`,
    `--chart-muted:${style.mutedColor}`,
    `width:${style.widthPercent}%`
  ].join("; ");
}

function buildChartBlockMarkup(data, mode = "editor") {
  const chart = normalizeChartData(data);
    const settingsButton = mode === "editor"
        ? '<button class="button button-secondary chart-settings-button" type="button" data-chart-settings="true" aria-label="Edit chart settings">&#9881;</button>'
        : "";
    const draggable = mode === "editor" ? ' draggable="true"' : "";
    const resizeHandle = mode === "editor"
      ? '<button class="chart-resize-handle" type="button" data-chart-resize="true" aria-label="Resize chart"></button>'
      : "";

    return `
      <div class="${CHART_CLASS}" ${CHART_DATA_ATTRIBUTE}="${encodeChartData(chart)}" contenteditable="false"${draggable} style="${chartInlineStyle(chart)}">
        <div class="chart-block-header">
        <div>
          ${chart.style.showTitle ? `<h3 class="chart-block-title" style="font-size:${chart.style.titleSize}px">${escapeHtml(chart.title)}</h3>` : ""}
          ${chart.subtitle ? `<p class="chart-block-subtitle" style="color:${chart.style.mutedColor}; font-size:${chart.style.labelSize}px">${escapeHtml(chart.subtitle)}</p>` : ""}
        </div>
        ${settingsButton}
        </div>
        ${chartVisualizationMarkup(chart)}
        ${resizeHandle}
      </div>
    `;
}

function enhanceCharts(root, mode = "published") {
  root.querySelectorAll(`[${CHART_DATA_ATTRIBUTE}]`).forEach((element) => {
    const chart = decodeChartData(element.getAttribute(CHART_DATA_ATTRIBUTE));
    element.outerHTML = buildChartBlockMarkup(chart, mode);
  });
}

function parseChartText(value) {
  const series = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, rawValue] = line.split(",");
      return { label: (label || "").trim(), value: Number((rawValue || "").trim()) };
    })
    .filter((item) => item.label && Number.isFinite(item.value));

  return series.length ? series : defaultChartData().series;
}

function chartText(data) {
  return normalizeChartData(data).series.map((item) => `${item.label},${item.value}`).join("\n");
}

function populateChartStyleForm(style) {
  elements.chartShowTitleInput.checked = style.showTitle;
  elements.chartShowLegendInput.checked = style.showLegend;
  elements.chartShowLabelsInput.checked = style.showLabels;
  elements.chartShowValuesInput.checked = style.showValues;
  elements.chartTitleSizeInput.value = style.titleSize;
  elements.chartLabelSizeInput.value = style.labelSize;
  elements.chartValueSizeInput.value = style.valueSize;
  elements.chartLegendSizeInput.value = style.legendSize;
  elements.chartSurfaceColorInput.value = style.surfaceColor;
  elements.chartBorderColorInput.value = style.borderColor;
  elements.chartTextColorInput.value = style.textColor;
  elements.chartMutedColorInput.value = style.mutedColor;
  elements.chartAccentColorInput.value = style.accentColor;
  elements.chartAccentSecondaryInput.value = style.accentSecondary;
  elements.chartTrackColorInput.value = style.trackColor;
  elements.chartLegendPositionInput.value = style.legendPosition;
}

function chartStyleFromForm() {
  return normalizeChartStyle({
    showTitle: elements.chartShowTitleInput.checked,
    showLegend: elements.chartShowLegendInput.checked,
    showLabels: elements.chartShowLabelsInput.checked,
    showValues: elements.chartShowValuesInput.checked,
    titleSize: elements.chartTitleSizeInput.value,
    labelSize: elements.chartLabelSizeInput.value,
    valueSize: elements.chartValueSizeInput.value,
    legendSize: elements.chartLegendSizeInput.value,
    surfaceColor: elements.chartSurfaceColorInput.value,
    borderColor: elements.chartBorderColorInput.value,
    textColor: elements.chartTextColorInput.value,
    mutedColor: elements.chartMutedColorInput.value,
    accentColor: elements.chartAccentColorInput.value,
    accentSecondary: elements.chartAccentSecondaryInput.value,
    trackColor: elements.chartTrackColorInput.value,
    legendPosition: elements.chartLegendPositionInput.value
  });
}

function chartFromForm(existingChart) {
  return normalizeChartData({
    ...existingChart,
    title: elements.chartTitleInput.value,
    subtitle: elements.chartSubtitleInput.value,
    style: chartStyleFromForm(),
    series: parseChartText(elements.chartDataInput.value)
  });
}

function replaceEditedChart(nextChart) {
  if (!chartEditorState.chartElement?.isConnected) {
    return;
  }

  const previousElement = chartEditorState.chartElement;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildChartBlockMarkup(nextChart, "editor");
  const nextElement = wrapper.firstElementChild;
  if (!nextElement) {
    return;
  }

  nextElement.setAttribute("data-block-id", previousElement.getAttribute("data-block-id") || blockId("chart"));

  previousElement.replaceWith(nextElement);
  chartEditorState.chartElement = nextElement;
  if (selectedChartElement === previousElement) {
    selectedChartElement = nextElement;
    selectedChartElement.classList.add("chart-block-selected");
  } else if (selectedChartElement?.isConnected === false) {
    selectedChartElement = null;
  }
}

function setChartElementData(chartElement, nextChart) {
  if (!(chartElement instanceof HTMLElement)) {
    return;
  }

  const chart = normalizeChartData(nextChart);
  chartElement.setAttribute(CHART_DATA_ATTRIBUTE, encodeChartData(chart));
  chartElement.setAttribute("style", chartInlineStyle(chart));
}

function blockId(prefix = "block") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeTextBlock(html = "<p></p>") {
  return {
    id: blockId("text"),
    type: "text",
    html: String(html || "").trim() || "<p></p>"
  };
}

function makeChartBlock(chart) {
  return {
    id: blockId("chart"),
    type: "chart",
    chart: normalizeChartData(chart)
  };
}

function normalizeBodyBlocks(page = {}) {
  if (Array.isArray(page.bodyBlocks) && page.bodyBlocks.length) {
    return page.bodyBlocks.map((block) => {
      if (block?.type === "chart") {
        return {
          id: block.id || blockId("chart"),
          type: "chart",
          chart: normalizeChartData(block.chart)
        };
      }

      return {
        id: block?.id || blockId("text"),
        type: "text",
        html: String(block?.html || "").trim() || "<p></p>"
      };
    });
  }

  return sourceToBodyBlocks(page.body);
}

function textBlockMarkup(block) {
  const html = String(block?.html || "").trim() || "<p></p>";
  return `<div class="${BODY_TEXT_BLOCK_CLASS}" ${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}" data-block-id="${escapeHtml(block.id || blockId("text"))}" contenteditable="true">${html}</div>`;
}

function sourceToBodyBlocks(source) {
  const trimmed = String(source || "").trim();
  const container = document.createElement("div");
  if (!trimmed) {
    container.innerHTML = "<p></p>";
  } else if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    container.innerHTML = trimmed;
  } else {
    container.innerHTML = renderMarkdown(trimmed);
  }

  return bodyBlocksFromContainer(container);
}

function bodyBlocksFromContainer(container) {
  const blocks = [];
  let textNodes = [];
  const flushTextNodes = () => {
    if (!textNodes.length) {
      return;
    }

    const wrapper = document.createElement("div");
    textNodes.forEach((node) => wrapper.appendChild(node));
    const html = wrapper.innerHTML.trim();
    blocks.push(makeTextBlock(html || "<p></p>"));
    textNodes = [];
  };

  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement && node.hasAttribute(CHART_DATA_ATTRIBUTE)) {
      flushTextNodes();
      blocks.push(makeChartBlock(decodeChartData(node.getAttribute(CHART_DATA_ATTRIBUTE))));
      return;
    }

    textNodes.push(node.cloneNode(true));
  });

  flushTextNodes();
  return blocks.length ? blocks : [makeTextBlock()];
}

function bodyBlocksToStorageHtml(blocks) {
  return blocks.map((block) => {
    if (block.type === "chart") {
      return `<div ${CHART_DATA_ATTRIBUTE}="${encodeChartData(block.chart)}"></div>`;
    }

    return String(block.html || "").trim() || "<p></p>";
  }).join("");
}

function bodyBlocksToRenderedHtml(blocks, mode = "published") {
  return blocks.map((block) => {
    if (block.type === "chart") {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildChartBlockMarkup(block.chart, mode);
      const element = wrapper.firstElementChild;
      if (element) {
        element.setAttribute("data-block-id", block.id || blockId("chart"));
        return wrapper.innerHTML;
      }
      return "";
    }

    return mode === "editor" ? textBlockMarkup(block) : (String(block.html || "").trim() || "<p></p>");
  }).join("");
}

function textFromBodyBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "chart") {
      const chart = normalizeChartData(block.chart);
      return [chart.title, chart.subtitle, ...chart.series.map((item) => item.label)].join(" ");
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = block.html || "";
    return wrapper.textContent || "";
  }).join(" ");
}

function editorTextBlocks() {
  return Array.from(elements.bodyEditor.querySelectorAll(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`));
}

function closestTextBlock(node) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element?.closest?.(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`) || null;
}

function ensureEditorTextBlock() {
  const existing = editorTextBlocks().at(-1);
  if (existing) {
    return existing;
  }

  const block = document.createElement("div");
  block.className = BODY_TEXT_BLOCK_CLASS;
  block.setAttribute(BODY_TEXT_BLOCK_ATTRIBUTE, BODY_TEXT_BLOCK_VALUE);
  block.setAttribute("data-block-id", blockId("text"));
  block.setAttribute("contenteditable", "true");
  block.innerHTML = "<p></p>";
  elements.bodyEditor.appendChild(block);
  return block;
}

function editorBodyBlocks() {
  const blocks = Array.from(elements.bodyEditor.children).flatMap((element) => {
    if (!(element instanceof HTMLElement)) {
      return [];
    }

    if (element.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)) {
      const html = element.innerHTML.replaceAll("\u200B", "").trim() || "<p></p>";
      return [{
        id: element.getAttribute("data-block-id") || blockId("text"),
        type: "text",
        html
      }];
    }

    if (element.classList.contains(CHART_CLASS)) {
      return [{
        id: element.getAttribute("data-block-id") || blockId("chart"),
        type: "chart",
        chart: decodeChartData(element.getAttribute(CHART_DATA_ATTRIBUTE))
      }];
    }

    return [];
  });

  return blocks.length ? blocks : [makeTextBlock()];
}

function clearSelectedChart() {
  if (selectedChartElement?.isConnected) {
    selectedChartElement.classList.remove("chart-block-selected");
  }

  selectedChartElement = null;
}

function selectChart(chartElement) {
  if (!(chartElement instanceof HTMLElement)) {
    return;
  }

  if (selectedChartElement === chartElement) {
    return;
  }

  clearSelectedChart();
  selectedChartElement = chartElement;
  selectedChartElement.classList.add("chart-block-selected");
}

function chartDraggedNodes(chartElement = draggedChartElement) {
  return chartElement instanceof HTMLElement ? [chartElement] : [];
}

function isChartDraggedNode(node) {
  return chartDraggedNodes().includes(node);
}

function clearChartDropMarker() {
  chartDropReferenceNode = null;
  chartDropRange = null;
  if (chartDropIndicator) {
    chartDropIndicator.remove();
    chartDropIndicator = null;
  }
}

function ensureChartDropIndicator() {
  if (chartDropIndicator?.isConnected) {
    return chartDropIndicator;
  }

  chartDropIndicator = document.createElement("div");
  chartDropIndicator.className = "chart-drop-indicator";
  chartDropIndicator.hidden = true;
  elements.bodyEditor.appendChild(chartDropIndicator);
  return chartDropIndicator;
}

function bodyDropBlocks() {
  return Array.from(elements.bodyEditor.children).filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (isChartDraggedNode(element)) {
      return false;
    }

    return element.classList.contains(CHART_CLASS)
      || element.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`);
  });
}

function setChartDropMarker(referenceNode, offsetTop) {
  if (!(referenceNode instanceof HTMLElement) && referenceNode !== null) {
    clearChartDropMarker();
    return;
  }

  if (chartDropReferenceNode === referenceNode && chartDropIndicator?.isConnected && chartDropIndicator.style.top === `${Math.max(0, offsetTop - 1)}px`) {
    return;
  }

  chartDropReferenceNode = referenceNode;
  const indicator = ensureChartDropIndicator();
  indicator.hidden = false;
  indicator.style.top = `${Math.max(0, offsetTop - 1)}px`;
}

function pointCaretRange(clientX, clientY) {
  const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition?.offsetNode) {
    const range = document.createRange();
    range.setStart(caretPosition.offsetNode, caretPosition.offset);
    range.collapse(true);
    return range;
  }

  const caretRange = document.caretRangeFromPoint?.(clientX, clientY);
  if (caretRange) {
    caretRange.collapse(true);
    return caretRange;
  }

  return null;
}

function rangeLineOffsetTop(range, fallbackElement) {
  const editorRect = elements.bodyEditor.getBoundingClientRect();
  const scrollTop = elements.bodyEditor.scrollTop;
  const rects = range.getClientRects();
  const rect = rects.length ? rects[0] : range.getBoundingClientRect();
  const fallbackRect = fallbackElement.getBoundingClientRect();
  const top = rect.height ? rect.top : fallbackRect.top;
  return top - editorRect.top + scrollTop;
}

function bodyDropGroups() {
  return bodyDropBlocks().map((block) => ({ first: block, last: block }));
}

function bodyDropSlots() {
  const editorRect = elements.bodyEditor.getBoundingClientRect();
  const scrollTop = elements.bodyEditor.scrollTop;
  const groups = bodyDropGroups();

  if (!groups.length) {
    return [{
      referenceNode: null,
      viewportY: editorRect.top + 12,
      offsetTop: 12 + scrollTop
    }];
  }

  const slots = groups.map((group) => {
    const rect = group.first.getBoundingClientRect();
    return {
      referenceNode: group.first,
      viewportY: rect.top,
      offsetTop: rect.top - editorRect.top + scrollTop
    };
  });

  const lastRect = groups.at(-1).last.getBoundingClientRect();
  slots.push({
    referenceNode: null,
    viewportY: lastRect.bottom,
    offsetTop: lastRect.bottom - editorRect.top + scrollTop
  });

  return slots;
}

function updateChartDropTarget(clientX, clientY) {
  const pointElement = document.elementFromPoint(clientX, clientY);
  const textBlock = closestTextBlock(pointElement);
  if (textBlock instanceof HTMLElement) {
    const range = pointCaretRange(clientX, clientY);
    if (range && textBlock.contains(range.startContainer)) {
      chartDropRange = range.cloneRange();
      setChartDropMarker(textBlock, rangeLineOffsetTop(chartDropRange, textBlock));
      return;
    }

    chartDropRange = null;
    setChartDropMarker(textBlock, rangeLineOffsetTop(document.createRange(), textBlock));
    return;
  }

  chartDropRange = null;
  const slots = bodyDropSlots();
  if (!slots.length) {
    clearChartDropMarker();
    return;
  }

  let bestSlot = slots[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  slots.forEach((slot) => {
    const distance = Math.abs(clientY - slot.viewportY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSlot = slot;
    }
  });

  setChartDropMarker(bestSlot.referenceNode, bestSlot.offsetTop);
}

function moveChartToReference(chartElement, referenceNode = null) {
  if (!(chartElement instanceof HTMLElement)) {
    return false;
  }

  if (referenceNode instanceof HTMLElement) {
    if (isChartDraggedNode(referenceNode)) {
      return false;
    }
    referenceNode.before(chartElement);
  } else {
    elements.bodyEditor.appendChild(chartElement);
  }

  selectChart(chartElement);
  handleLiveEdit();
  return true;
}

function insertChartAtTextRange(chartElement, textBlock, range) {
  if (!(chartElement instanceof HTMLElement) || !(textBlock instanceof HTMLElement) || !range) {
    return false;
  }

  const safeRange = range.cloneRange();
  if (!textBlock.contains(safeRange.startContainer)) {
    return false;
  }

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(textBlock);
  beforeRange.setEnd(safeRange.startContainer, safeRange.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(textBlock);
  afterRange.setStart(safeRange.startContainer, safeRange.startOffset);

  const beforeWrapper = document.createElement("div");
  beforeWrapper.appendChild(beforeRange.cloneContents());
  const afterWrapper = document.createElement("div");
  afterWrapper.appendChild(afterRange.cloneContents());

  const beforeHtml = beforeWrapper.innerHTML.replaceAll("\u200B", "").trim();
  const afterHtml = afterWrapper.innerHTML.replaceAll("\u200B", "").trim();

  const fragment = document.createDocumentFragment();
  if (beforeHtml) {
    const beforeBlock = textBlock.cloneNode(false);
    beforeBlock.innerHTML = beforeHtml;
    fragment.appendChild(beforeBlock);
  }

  fragment.appendChild(chartElement);

  const afterBlock = textBlock.cloneNode(false);
  afterBlock.innerHTML = afterHtml || "<p></p>";
  fragment.appendChild(afterBlock);

  textBlock.replaceWith(fragment);
  selectChart(chartElement);
  handleLiveEdit();
  return true;
}

function moveChartToEnd(chartElement) {
  return moveChartToReference(chartElement, null);
}

function renderStoredBody(body) {
  const blocks = Array.isArray(body) ? normalizeBodyBlocks({ bodyBlocks: body }) : sourceToBodyBlocks(body);
  return blocks.map((block) => {
    if (block.type === "chart") {
      return buildChartBlockMarkup(block.chart, "published");
    }

    return String(block.html || "").trim() || "<p></p>";
  }).join("");
}

function getEditorBodyHtml() {
  return bodyBlocksToStorageHtml(editorBodyBlocks());
}

function selectionInsideEditor() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;

  if (!elements.bodyEditor.contains(container)) {
    return null;
  }

  return { selection, range };
}

function selectionTarget() {
  const liveTarget = selectionInsideEditor();
  if (liveTarget) {
    return liveTarget;
  }

  const textBlock = ensureEditorTextBlock();
  textBlock.focus();
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }

  const range = document.createRange();
  range.selectNodeContents(textBlock);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return { selection, range };
}

function wrapSelection(tagName) {
  const target = selectionTarget();
  if (!target || target.range.collapsed) {
    return;
  }

  const { selection, range } = target;
  const wrapper = document.createElement(tagName);

  try {
    range.surroundContents(wrapper);
  } catch {
    const content = range.extractContents();
    wrapper.appendChild(content);
    range.insertNode(wrapper);
  }

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
  handleLiveEdit();
}

function styleSelection(styleName, styleValue) {
  const target = selectionTarget();
  if (!target || target.range.collapsed) {
    return;
  }

  const { selection, range } = target;
  const wrapper = document.createElement("span");
  wrapper.style[styleName] = styleValue;

  try {
    range.surroundContents(wrapper);
  } catch {
    const content = range.extractContents();
    wrapper.appendChild(content);
    range.insertNode(wrapper);
  }

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
  handleLiveEdit();
}

function closestSelectValue(select, actualValue, normalizer = (value) => value) {
  const normalizedActual = normalizer(actualValue);
  const options = Array.from(select.options);
  const exact = options.find((option) => normalizer(option.value) === normalizedActual);
  return exact?.value || options[0]?.value || "";
}

function updateToolbarSelectionState() {
  const liveTarget = selectionInsideEditor();
  const container = liveTarget
    ? (liveTarget.range.startContainer.nodeType === Node.TEXT_NODE
        ? liveTarget.range.startContainer.parentNode
        : liveTarget.range.startContainer)
    : ensureEditorTextBlock();
  const computedStyle = window.getComputedStyle(container);

  elements.fontFamilySelect.value = closestSelectValue(
    elements.fontFamilySelect,
    computedStyle.fontFamily,
    (value) => value.replaceAll("\"", "").replaceAll("'", "").toLowerCase()
  );
  elements.fontSizeSelect.value = closestSelectValue(elements.fontSizeSelect, computedStyle.fontSize);
}

function normalizePage(page) {
  const bodyBlocks = normalizeBodyBlocks(page);
  const body = page.body || bodyBlocksToStorageHtml(bodyBlocks);
  return {
    id: page.id,
    title: page.title || "Untitled page",
    category: page.category || "Reference",
    tags: Array.isArray(page.tags) ? page.tags : [],
    summary: page.summary || "",
    body,
    bodyBlocks,
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
    updatedBy: page.updatedBy || ""
  };
}

state.pages = state.pages.map(normalizePage);

function renderPageList() {
  const pages = filteredPages();

  if (!pages.length) {
    elements.pageList.innerHTML = '<p class="empty-state">No pages match this search.</p>';
    return;
  }

  elements.pageList.innerHTML = pages
    .map((page) => {
      const activeClass = page.id === state.activePageId ? "active" : "";

      return `
        <button class="page-item ${activeClass}" data-page-id="${page.id}" type="button">
          <div class="page-item-header">
            <h3>${escapeHtml(page.title)}</h3>
            <span class="pill">${escapeHtml(page.category)}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  chartEditorState.chartElement = null;
  chartEditorState.originalChart = null;
  clearSelectedChart();
  elements.bodyEditor.innerHTML = bodyBlocksToRenderedHtml(page.bodyBlocks || [makeTextBlock()], "editor");
  elements.deletePageButton.disabled = state.pages.length === 1 || (state.syncMode === "firebase" && !state.user);
  updateToolbarSelectionState();
}

function renderPublishedPage() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  elements.publishedTitle.textContent = page.title || "Untitled page";
  elements.publishedBody.innerHTML = renderStoredBody(page.bodyBlocks || page.body);
}

function renderRouteLinks() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  const pageHash = `#/page/${encodeURIComponent(page.id)}`;
  const editHash = `#/edit/${encodeURIComponent(page.id)}`;

  elements.pageRouteLink.href = pageHash;
  elements.editRouteLink.href = editHash;
  elements.pageRouteLink.hidden = state.routeMode === "page";
  elements.editRouteLink.hidden = state.routeMode === "workspace-edit";
}

function renderAll() {
  applyRoute();
  ensureActivePage();
  renderPageList();
  renderEditor();
  renderChartEditorFlyout();
  renderPublishedPage();
  renderRouteLinks();
  renderPageCount();
  renderSyncState();
}

function uniqueIdFromTitle(title) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const base = slug || "page";
  let candidate = base;
  let counter = 2;

  while (state.pages.some((page) => page.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function buildPageFromForm(existingId = null) {
  const active = getActivePage();
  const title = active?.title || "Untitled page";
  const bodyBlocks = editorBodyBlocks();
  return {
    id: existingId || uniqueIdFromTitle(title),
    title,
    category: active?.category || "Reference",
    tags: active?.tags || [],
    summary: active?.summary || "",
    body: bodyBlocksToStorageHtml(bodyBlocks),
    bodyBlocks
  };
}

async function createBlankPage() {
  const page = normalizePage({
    id: uniqueIdFromTitle("Untitled page"),
    title: "Untitled page",
    category: "Reference",
    tags: ["new"],
    summary: "Describe what this page covers.",
    body: "# Untitled page\n\nStart writing here."
  });

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, true);
    return;
  }

  state.pages.unshift(page);
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute("workspace-edit", page.id);
  renderAll();
}

async function duplicateActivePage() {
  const active = getActivePage();
  const page = normalizePage({
    ...active,
    id: uniqueIdFromTitle(`${active.title} copy`),
    title: `${active.title} copy`
  });

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, true);
    return;
  }

  state.pages.unshift(page);
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute("workspace-edit", page.id);
  renderAll();
}

async function deleteActivePage() {
  if (state.pages.length === 1) {
    return;
  }

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await deleteDoc(doc(db, "pages", state.activePageId));
    renderSaveState("Deleted");
    return;
  }

  state.pages = state.pages.filter((page) => page.id !== state.activePageId);
  state.activePageId = state.pages[0].id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Deleted");
  setRoute("workspace-home", state.activePageId);
  renderAll();
}

async function upsertFirebasePage(page, isNewPage) {
  const pageRef = doc(db, "pages", page.id);
  const payload = {
    ...page,
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.displayName || state.user?.email || "Unknown"
  };

  if (isNewPage) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(pageRef, payload, { merge: true });
  state.activePageId = page.id;
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute(state.routeMode === "page" ? "page" : "workspace-edit", page.id);
}

async function updateActivePageFromForm() {
  const active = getActivePage();
  const page = buildPageFromForm(active?.id);

  if (state.syncMode === "firebase") {
    if (!state.user) {
      renderSaveState("Sign in");
      return;
    }

    await upsertFirebasePage(page, false);
    return;
  }

  const index = state.pages.findIndex((entry) => entry.id === active.id);
  state.pages[index] = { ...active, ...page };
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute(state.routeMode === "page" ? "page" : "workspace-edit", page.id);
  renderAll();
}

function handleLiveEdit() {
  const active = getActivePage();
  if (!active) {
    return;
  }

  if (active.body !== bodyBlocksToStorageHtml(editorBodyBlocks())) {
    renderSaveState("Unsaved");
  }
}

function renderChartEditorFlyout() {
  elements.chartEditorFlyout.hidden = !chartEditorState.chartElement;
}

function closeChartMenu() {
  chartEditorState.open = false;
  elements.chartMenuDropdown.hidden = true;
  elements.chartMenuTrigger.setAttribute("aria-expanded", "false");
}

function resizeChartFromPointer(clientX) {
  if (!chartResizeState?.chartElement?.isConnected) {
    return;
  }

  const deltaX = clientX - chartResizeState.startClientX;
  const nextWidth = chartResizeState.startWidth + deltaX;
  const percent = Math.min(
    100,
    Math.max(35, (nextWidth / chartResizeState.editorWidth) * 100)
  );
  const chart = decodeChartData(chartResizeState.chartElement.getAttribute(CHART_DATA_ATTRIBUTE));
  chart.style.widthPercent = percent;
  setChartElementData(chartResizeState.chartElement, chart);
}

function endChartResize() {
  if (!chartResizeState?.chartElement?.isConnected) {
    chartResizeState = null;
    return;
  }

  chartResizeState.chartElement.classList.remove("chart-block-resizing");
  handleLiveEdit();
  chartResizeState = null;
}

function openChartMenu() {
  chartEditorState.open = true;
  elements.chartMenuDropdown.hidden = false;
  elements.chartMenuTrigger.setAttribute("aria-expanded", "true");
}

function toggleChartMenu() {
  if (chartEditorState.open) {
    closeChartMenu();
    return;
  }

  openChartMenu();
}

function focusTextBlockStart(block) {
  if (!(block instanceof HTMLElement)) {
    return;
  }

  block.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  const anchor = block.firstChild || block;
  range.setStart(anchor, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAfterNode(node) {
  elements.bodyEditor.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function ensureTrailingEditorParagraph() {
  return ensureEditorTextBlock();
}

function placeCaretFromPoint(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (event.target.closest("button, a, input, select, textarea")) {
    return;
  }

  const chartElement = event.target.closest(`.${CHART_CLASS}`);
  if (chartElement) {
    selectChart(chartElement);
    elements.bodyEditor.focus();
    return;
  }

  clearSelectedChart();

  const isEditorSurface = event.target === elements.bodyEditor;
  const textBlock = closestTextBlock(event.target);
  if (!isEditorSurface && !(textBlock instanceof HTMLElement)) {
    return;
  }

  if (textBlock instanceof HTMLElement) {
    return;
  }

  const trailingParagraph = ensureTrailingEditorParagraph();
  event.preventDefault();
  focusTextBlockStart(trailingParagraph);
}

function insertChartAtCursor(chartType = "bar") {
  const chart = defaultChartData(chartType);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildChartBlockMarkup(chart, "editor");
  const chartNode = wrapper.firstElementChild;

  const target = selectionTarget();
  if (!target || !chartNode) {
    const textBlock = ensureEditorTextBlock();
    textBlock.after(chartNode);
    selectChart(chartNode);
    handleLiveEdit();
    return;
  }

  const textBlock = closestTextBlock(target.range.startContainer) || ensureEditorTextBlock();
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(textBlock);
  beforeRange.setEnd(target.range.startContainer, target.range.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(textBlock);
  afterRange.setStart(target.range.endContainer, target.range.endOffset);

  const beforeWrapper = document.createElement("div");
  beforeWrapper.appendChild(beforeRange.cloneContents());
  const afterWrapper = document.createElement("div");
  afterWrapper.appendChild(afterRange.cloneContents());

  const beforeHtml = beforeWrapper.innerHTML.replaceAll("\u200B", "").trim();
  const afterHtml = afterWrapper.innerHTML.replaceAll("\u200B", "").trim();
  const beforeBlock = beforeHtml ? textBlock.cloneNode(false) : null;
  const afterBlock = afterHtml ? textBlock.cloneNode(false) : textBlock.cloneNode(false);

  if (beforeBlock) {
    beforeBlock.innerHTML = beforeHtml;
  }
  afterBlock.innerHTML = afterHtml || "<p></p>";

  const fragment = document.createDocumentFragment();
  if (beforeBlock) {
    fragment.appendChild(beforeBlock);
  }
  fragment.appendChild(chartNode);
  fragment.appendChild(afterBlock);
  textBlock.replaceWith(fragment);
  focusTextBlockStart(afterBlock);
  handleLiveEdit();
}

function openChartEditor(chartElement) {
  const chart = decodeChartData(chartElement.getAttribute(CHART_DATA_ATTRIBUTE));
  selectChart(chartElement);
  chartEditorState.chartElement = chartElement;
  chartEditorState.originalChart = chart;
  elements.chartTitleInput.value = chart.title;
  elements.chartSubtitleInput.value = chart.subtitle;
  elements.chartDataInput.value = chartText(chart);
  populateChartStyleForm(chart.style);
  renderChartEditorFlyout();
  elements.chartTitleInput.focus();
}

function closeChartEditor({ revert = false } = {}) {
  if (revert && chartEditorState.chartElement && chartEditorState.originalChart) {
    replaceEditedChart(chartEditorState.originalChart);
  }

  chartEditorState.chartElement = null;
  chartEditorState.originalChart = null;
  renderChartEditorFlyout();
}

function deleteSelectedChart() {
  if (!selectedChartElement?.isConnected) {
    clearSelectedChart();
    return false;
  }

  const nextBlock = selectedChartElement.nextElementSibling;
  const previousBlock = selectedChartElement.previousElementSibling;
  const chartToRemove = selectedChartElement;
  clearSelectedChart();
  chartToRemove.remove();

  if (nextBlock instanceof HTMLElement && nextBlock.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)) {
    focusTextBlockStart(nextBlock);
  } else if (previousBlock instanceof HTMLElement && previousBlock.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)) {
    focusTextBlockStart(previousBlock);
  } else {
    const trailingParagraph = ensureEditorTextBlock();
    focusTextBlockStart(trailingParagraph);
  }

  closeChartEditor({ revert: false });
  handleLiveEdit();
  return true;
}

function saveChartEditor() {
  if (!chartEditorState.chartElement) {
    closeChartEditor();
    return;
  }

  replaceEditedChart(chartFromForm(chartEditorState.originalChart));
  closeChartEditor();
  handleLiveEdit();
}

function previewChartEditorChanges() {
  if (!chartEditorState.chartElement || !chartEditorState.originalChart) {
    return;
  }

  replaceEditedChart(chartFromForm(chartEditorState.originalChart));
  handleLiveEdit();
}

async function seedFirebasePages() {
  const existing = await getDocs(collection(db, "pages"));
  if (!existing.empty) {
    return;
  }

  await Promise.all(
    defaultPages.map((page) =>
      setDoc(doc(db, "pages", page.id), {
        ...page,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: state.user?.displayName || state.user?.email || "Seed data"
      })
    )
  );
}

function connectFirebase() {
  const { enabled, config } = firebaseProject;
  if (!enabled || !config.apiKey || !config.projectId || !config.appId) {
    renderAll();
    return;
  }

  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  state.syncMode = "firebase";

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    state.authReady = true;
    renderSyncState();

    if (unsubscribePages) {
      unsubscribePages();
      unsubscribePages = null;
    }

      if (!user) {
        state.pages = loadLocalPages().map(normalizePage);
        state.activePageId = state.pages[0]?.id ?? null;
        renderAll();
        return;
      }

    const pagesQuery = query(collection(db, "pages"), orderBy("title"));
    unsubscribePages = onSnapshot(pagesQuery, async (snapshot) => {
      if (snapshot.empty) {
        await seedFirebasePages();
        return;
      }

      state.pages = snapshot.docs.map((entry) => normalizePage(entry.data()));
      ensureActivePage();
      renderAll();
    });
  });
}

async function handleSignIn() {
  if (!auth) {
    return;
  }

  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function handleSignOut() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

elements.pageList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-id]");
  if (!button) {
    return;
  }

  state.activePageId = button.getAttribute("data-page-id");
  if (state.routeMode === "workspace-edit") {
    setRoute("workspace-edit", state.activePageId);
  } else if (state.routeMode === "page") {
    setRoute("page", state.activePageId);
  } else {
    applyRoute();
  }
  renderAll();
  renderSaveState("Ready");
});

elements.editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await updateActivePageFromForm();
});

elements.newPageButton.addEventListener("click", async () => {
  await createBlankPage();
});

elements.duplicatePageButton.addEventListener("click", async () => {
  await duplicateActivePage();
});

elements.deletePageButton.addEventListener("click", async () => {
  await deleteActivePage();
});

elements.signInButton.addEventListener("click", async () => {
  await handleSignIn();
});

elements.signOutButton.addEventListener("click", async () => {
  await handleSignOut();
});

elements.bodyEditor.addEventListener("input", handleLiveEdit);
elements.bodyEditor.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const settingsButton = event.target.closest("[data-chart-settings='true']");
  if (!(settingsButton instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const chartElement = settingsButton.closest(`.${CHART_CLASS}`);
  if (chartElement instanceof HTMLElement) {
    openChartEditor(chartElement);
  }
});
elements.bodyEditor.addEventListener("dragstart", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (event.target.closest("[data-chart-resize='true']")) {
    event.preventDefault();
    return;
  }

  const chartElement = event.target.closest(`.${CHART_CLASS}`);
  if (!(chartElement instanceof HTMLElement)) {
    return;
  }

  draggedChartElement = chartElement;
  selectChart(chartElement);
  chartElement.classList.add("chart-block-dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "chart");
  }
});
elements.bodyEditor.addEventListener("dragover", (event) => {
  if (!draggedChartElement) {
    return;
  }

  event.preventDefault();
  updateChartDropTarget(event.clientX, event.clientY);
});
elements.bodyEditor.addEventListener("drop", (event) => {
  if (!draggedChartElement) {
    return;
  }

  event.preventDefault();
  updateChartDropTarget(event.clientX, event.clientY);

  if (chartDropReferenceNode instanceof HTMLElement
      && chartDropReferenceNode.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)
      && chartDropRange) {
    insertChartAtTextRange(draggedChartElement, chartDropReferenceNode, chartDropRange);
  } else if (chartDropReferenceNode instanceof HTMLElement) {
    moveChartToReference(draggedChartElement, chartDropReferenceNode);
  } else {
    moveChartToEnd(draggedChartElement);
  }

  draggedChartElement.classList.remove("chart-block-dragging");
  clearChartDropMarker();
  draggedChartElement = null;
});
elements.bodyEditor.addEventListener("dragend", () => {
  clearChartDropMarker();
  if (draggedChartElement?.isConnected) {
    draggedChartElement.classList.remove("chart-block-dragging");
  }
  draggedChartElement = null;
});
elements.bodyEditor.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && deleteSelectedChart()) {
    event.preventDefault();
  }
});
elements.bodyEditor.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const handle = event.target.closest("[data-chart-resize='true']");
  if (!(handle instanceof HTMLElement)) {
    return;
  }

  const chartElement = handle.closest(`.${CHART_CLASS}`);
  if (!(chartElement instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectChart(chartElement);

  const editorWidth = elements.bodyEditor.clientWidth - 24;
  chartResizeState = {
    chartElement,
    editorWidth: Math.max(editorWidth, 320),
    startClientX: event.clientX,
    startWidth: chartElement.getBoundingClientRect().width
  };

  chartElement.classList.add("chart-block-resizing");
});
["mouseup", "keyup", "focus"].forEach((eventName) => {
  elements.bodyEditor.addEventListener(eventName, () => {
    updateToolbarSelectionState();
  });
});
elements.bodyEditor.addEventListener("mousedown", placeCaretFromPoint);

elements.richToolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("select")) {
    return;
  }

  event.preventDefault();
});

elements.richToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-format]");
  if (!button) {
    return;
  }

  const format = button.getAttribute("data-format");
  if (format === "bold") {
    wrapSelection("strong");
    return;
  }

  if (format === "italic") {
    wrapSelection("em");
  }
});

elements.fontFamilySelect.addEventListener("change", () => {
  if (!elements.fontFamilySelect.value) {
    return;
  }

  styleSelection("fontFamily", elements.fontFamilySelect.value);
  updateToolbarSelectionState();
});

elements.fontSizeSelect.addEventListener("change", () => {
  if (!elements.fontSizeSelect.value) {
    return;
  }

  styleSelection("fontSize", elements.fontSizeSelect.value);
  updateToolbarSelectionState();
});

elements.chartMenuTrigger.addEventListener("click", () => {
  toggleChartMenu();
});

elements.chartMenuDropdown.addEventListener("click", (event) => {
  const item = event.target.closest("[data-chart-type]");
  if (!item) {
    return;
  }

  insertChartAtCursor(item.getAttribute("data-chart-type"));
  closeChartMenu();
});

[
  elements.chartTitleInput,
  elements.chartSubtitleInput,
  elements.chartDataInput,
  elements.chartShowTitleInput,
  elements.chartShowLegendInput,
  elements.chartShowLabelsInput,
  elements.chartShowValuesInput,
  elements.chartTitleSizeInput,
  elements.chartLabelSizeInput,
  elements.chartValueSizeInput,
  elements.chartLegendSizeInput,
  elements.chartSurfaceColorInput,
  elements.chartBorderColorInput,
  elements.chartTextColorInput,
  elements.chartMutedColorInput,
  elements.chartAccentColorInput,
  elements.chartAccentSecondaryInput,
  elements.chartTrackColorInput,
  elements.chartLegendPositionInput
].forEach((field) => {
  field.addEventListener("input", previewChartEditorChanges);
  field.addEventListener("change", previewChartEditorChanges);
});

document.addEventListener("mousedown", (event) => {
  if (!event.target.closest("#chart-menu")) {
    closeChartMenu();
  }
});
document.addEventListener("pointermove", (event) => {
  if (!chartResizeState) {
    return;
  }

  resizeChartFromPointer(event.clientX);
});
document.addEventListener("pointerup", () => {
  if (!chartResizeState) {
    return;
  }

  endChartResize();
});

elements.chartCancelButton.addEventListener("click", () => closeChartEditor({ revert: true }));
elements.chartSaveButton.addEventListener("click", saveChartEditor);

window.addEventListener("hashchange", () => {
  applyRoute();
  renderAll();
});

applyRoute();
renderAll();
connectFirebase();
