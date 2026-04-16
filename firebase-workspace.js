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
      page.body
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
    legendPosition: "right"
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
    legendPosition: style.legendPosition === "bottom" ? "bottom" : "right"
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
    `--chart-muted:${style.mutedColor}`
  ].join("; ");
}

function buildChartBlockMarkup(data, mode = "editor") {
  const chart = normalizeChartData(data);
  const settingsButton = mode === "editor"
    ? '<button class="button button-secondary chart-settings-button" type="button" data-chart-settings="true" aria-label="Edit chart settings">&#9881;</button>'
    : "";

  return `
    <div class="${CHART_CLASS}" ${CHART_DATA_ATTRIBUTE}="${encodeChartData(chart)}" contenteditable="false" style="${chartInlineStyle(chart)}">
      <div class="chart-block-header">
        <div>
          ${chart.style.showTitle ? `<h3 class="chart-block-title" style="font-size:${chart.style.titleSize}px">${escapeHtml(chart.title)}</h3>` : ""}
          ${chart.subtitle ? `<p class="chart-block-subtitle" style="color:${chart.style.mutedColor}; font-size:${chart.style.labelSize}px">${escapeHtml(chart.subtitle)}</p>` : ""}
        </div>
        ${settingsButton}
      </div>
      ${chartVisualizationMarkup(chart)}
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

  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildChartBlockMarkup(nextChart, "editor");
  const nextElement = wrapper.firstElementChild;
  if (!nextElement) {
    return;
  }

  chartEditorState.chartElement.replaceWith(nextElement);
  chartEditorState.chartElement = nextElement;
}

function renderStoredBody(body) {
  const source = String(body || "").trim();
  const container = document.createElement("div");
  if (!source) {
    container.innerHTML = "<p></p>";
    return container.innerHTML;
  }

  if (/<[a-z][\s\S]*>/i.test(source)) {
    container.innerHTML = source;
  } else {
    container.innerHTML = renderMarkdown(source);
  }

  enhanceCharts(container, "published");
  return container.innerHTML;
}

function getEditorBodyHtml() {
  const html = elements.bodyEditor.innerHTML.trim();
  return html || "<p></p>";
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

  elements.bodyEditor.focus();
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }

  const range = document.createRange();
  range.selectNodeContents(elements.bodyEditor);
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
    : elements.bodyEditor;
  const computedStyle = window.getComputedStyle(container);

  elements.fontFamilySelect.value = closestSelectValue(
    elements.fontFamilySelect,
    computedStyle.fontFamily,
    (value) => value.replaceAll("\"", "").replaceAll("'", "").toLowerCase()
  );
  elements.fontSizeSelect.value = closestSelectValue(elements.fontSizeSelect, computedStyle.fontSize);
}

function normalizePage(page) {
  return {
    id: page.id,
    title: page.title || "Untitled page",
    category: page.category || "Reference",
    tags: Array.isArray(page.tags) ? page.tags : [],
    summary: page.summary || "",
    body: page.body || "",
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
    updatedBy: page.updatedBy || ""
  };
}

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
  const source = String(page.body || "").trim();
  const container = document.createElement("div");
  if (!source) {
    container.innerHTML = "<p></p>";
  } else if (/<[a-z][\s\S]*>/i.test(source)) {
    container.innerHTML = source;
  } else {
    container.innerHTML = renderMarkdown(source);
  }
  enhanceCharts(container, "editor");
  elements.bodyEditor.innerHTML = container.innerHTML;
  elements.deletePageButton.disabled = state.pages.length === 1 || (state.syncMode === "firebase" && !state.user);
  updateToolbarSelectionState();
}

function renderPublishedPage() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  elements.publishedTitle.textContent = page.title || "Untitled page";
  elements.publishedBody.innerHTML = renderStoredBody(page.body);
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
  return {
    id: existingId || uniqueIdFromTitle(title),
    title,
    category: active?.category || "Reference",
    tags: active?.tags || [],
    summary: active?.summary || "",
    body: getEditorBodyHtml()
  };
}

async function createBlankPage() {
  const page = {
    id: uniqueIdFromTitle("Untitled page"),
    title: "Untitled page",
    category: "Reference",
    tags: ["new"],
    summary: "Describe what this page covers.",
    body: "# Untitled page\n\nStart writing here."
  };

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
  const page = {
    ...active,
    id: uniqueIdFromTitle(`${active.title} copy`),
    title: `${active.title} copy`
  };

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

  if (active.body !== getEditorBodyHtml()) {
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

function createChartTrailingParagraph() {
  const paragraph = document.createElement("p");
  paragraph.appendChild(document.createElement("br"));
  return paragraph;
}

function focusParagraphStart(paragraph) {
  elements.bodyEditor.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertChartAtCursor(chartType = "bar") {
  const chart = defaultChartData(chartType);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildChartBlockMarkup(chart, "editor");
  const chartNode = wrapper.firstElementChild;

  const target = selectionTarget();
  if (!target || !chartNode) {
    const trailingParagraph = createChartTrailingParagraph();
    elements.bodyEditor.append(chartNode, trailingParagraph);
    focusParagraphStart(trailingParagraph);
    handleLiveEdit();
    return;
  }

  target.range.deleteContents();
  target.range.insertNode(chartNode);

  const trailingParagraph = createChartTrailingParagraph();
  chartNode.insertAdjacentElement("afterend", trailingParagraph);
  focusParagraphStart(trailingParagraph);
  handleLiveEdit();
}

function openChartEditor(chartElement) {
  const chart = decodeChartData(chartElement.getAttribute(CHART_DATA_ATTRIBUTE));
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
      state.pages = loadLocalPages();
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
["mouseup", "keyup", "focus"].forEach((eventName) => {
  elements.bodyEditor.addEventListener(eventName, () => {
    updateToolbarSelectionState();
  });
});

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

elements.bodyEditor.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-chart-settings='true']");
  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const chartElement = button.closest(`[${CHART_DATA_ATTRIBUTE}]`);
  if (chartElement) {
    openChartEditor(chartElement);
  }
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

elements.chartCancelButton.addEventListener("click", () => closeChartEditor({ revert: true }));
elements.chartSaveButton.addEventListener("click", saveChartEditor);

window.addEventListener("hashchange", () => {
  applyRoute();
  renderAll();
});

applyRoute();
renderAll();
connectFirebase();
