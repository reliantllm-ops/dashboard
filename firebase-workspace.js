const STORAGE_KEY = "engineering-workspace-pages";
const SIDEBAR_MINIMIZED_KEY = "engineering-workspace-sidebar-minimized";
const UI_SETTINGS_KEY = "engineering-workspace-ui-settings";
const CHART_CLASS = "chart-block";
const SHAPE_BLOCK_CLASS = "editor-shape-block";
const CHART_DATA_ATTRIBUTE = "data-chart";
const SHAPE_DATA_ATTRIBUTE = "data-shape";
const TABBED_CONTAINER_CLASS = "tabbed-container-block";
const TABBED_CONTAINER_ATTRIBUTE = "data-tabbed-container";
const CHART_TYPES = ["bar", "line", "area", "donut"];
const CHART_COLORS = ["#0c66e4", "#579dff", "#36b37e", "#f5cd47", "#e56910"];
const BODY_TEXT_BLOCK_CLASS = "editor-text-block";
const BODY_TEXT_BLOCK_ATTRIBUTE = "data-block-type";
const BODY_TEXT_BLOCK_VALUE = "text";
const SHAPE_TYPES = [
  "rectangle",
  "rounded-rectangle",
  "circle",
  "oval",
  "triangle",
  "diamond",
  "sleek-button",
  "minimal-button",
  "glassy-button",
  "pill-button"
];

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
  routeMode: "workspace-home",
  sidebarMinimized: loadSidebarMinimized(),
  tabAreaDrawMode: false,
  uiSettings: loadUiSettings()
};

const chartEditorState = {
  chartElement: null,
  originalChart: null,
  open: false
};

const tabAreaEditorState = {
  containerElement: null
};

const shapeEditorState = {
  shapeElement: null,
  pageListOpen: false,
  linkPickerMode: null
};

const tabAreaColorPickerState = {
  open: false,
  target: null,
  originalColor: "#ffffff",
  draftColor: "#ffffff",
  hue: 0,
  saturation: 0,
  value: 100,
  draggingSpectrum: false
};

const tabAreaGradientEditorState = {
  draggingStopIndex: null,
  originalData: null,
  draftData: null
};

const tabAreaFillEditorState = {
  originalData: null,
  draftData: null
};

const shapePaintEditorState = {
  open: false,
  target: "fill",
  draggingStopIndex: null,
  originalData: null,
  draftData: null
};

const shapePaintColorPickerState = {
  open: false,
  target: null,
  originalColor: "#ffffff",
  draftColor: "#ffffff",
  hue: 0,
  saturation: 0,
  value: 100,
  draggingSpectrum: false
};

const settingsModalState = {
  open: false,
  tab: "library",
  x: 120,
  y: 120
};

const libraryPaintEditorState = {
  open: false,
  target: "fill",
  draggingStopIndex: null,
  originalData: null,
  draftData: null
};

const libraryPaintColorPickerState = {
  open: false,
  target: null,
  originalColor: "#ffffff",
  draftColor: "#ffffff",
  hue: 0,
  saturation: 0,
  value: 100,
  draggingSpectrum: false
};

let selectedChartElement = null;
let selectedShapeElement = null;
let draggedChartElement = null;
let chartDropReferenceNode = null;
let chartDropIndicator = null;
let chartDropRange = null;
let chartResizeState = null;
let tabAreaDrawState = null;
let tabContainerDragState = null;
let tabContainerResizeState = null;
let shapeDragState = null;
let shapeResizeState = null;
let settingsModalDragState = null;
let objectMarqueeState = null;
let multiObjectDragState = null;
const marqueeSelectedObjectElements = new Set();

const elements = {
  pageList: document.querySelector("#page-list"),
  pageCount: document.querySelector("#page-count"),
  editorForm: document.querySelector("#editor-form"),
  publishedTitle: document.querySelector("#published-title"),
  publishedBody: document.querySelector("#published-body"),
  pageTitleEditor: document.querySelector("#page-title-editor"),
  bodyEditor: document.querySelector("#page-body-editor"),
  richToolbar: document.querySelector("#rich-toolbar"),
  shapeMenu: document.querySelector("#shape-menu"),
  shapeMenuTrigger: document.querySelector("#shape-menu-trigger"),
  shapeMenuDropdown: document.querySelector("#shape-menu-dropdown"),
  buttonMenu: document.querySelector("#button-menu"),
  buttonMenuTrigger: document.querySelector("#button-menu-trigger"),
  buttonMenuDropdown: document.querySelector("#button-menu-dropdown"),
  insertImageButton: document.querySelector("#insert-image-button"),
  insertImageInput: document.querySelector("#insert-image-input"),
  chartMenu: document.querySelector("#chart-menu"),
  chartMenuTrigger: document.querySelector("#chart-menu-trigger"),
  chartMenuDropdown: document.querySelector("#chart-menu-dropdown"),
  chartEditorFlyout: document.querySelector("#chart-editor-flyout"),
  tabAreaEditorFlyout: document.querySelector("#tab-area-editor-flyout"),
  shapeEditorFlyout: document.querySelector("#shape-editor-flyout"),
  fontFamilySelect: document.querySelector("#font-family-select"),
  fontSizeSelect: document.querySelector("#font-size-select"),
  createTabAreaButton: document.querySelector("#create-tab-area-button"),
  generateContentButton: document.querySelector("#generate-content-button"),
  newPageButton: document.querySelector("#new-page-button"),
  duplicatePageButton: document.querySelector("#duplicate-page-button"),
  deletePageButton: document.querySelector("#delete-page-button"),
  bottomBarSettingsButton: document.querySelector("#bottom-bar-settings-button"),
  settingsModalBackdrop: document.querySelector("#settings-modal-backdrop"),
  settingsModal: document.querySelector("#settings-modal"),
  settingsModalHeader: document.querySelector("#settings-modal-header"),
  settingsModalCloseButton: document.querySelector("#settings-modal-close-button"),
  settingsTabLibrary: document.querySelector("#settings-tab-library"),
  settingsTabToptabs: document.querySelector("#settings-tab-toptabs"),
  settingsPanelLibrary: document.querySelector("#settings-panel-library"),
  settingsPanelToptabs: document.querySelector("#settings-panel-toptabs"),
  sidebarToggleButton: document.querySelector("#sidebar-toggle-button"),
  pageRouteLink: document.querySelector("#page-route-link"),
  topEditRouteLink: document.querySelector("#top-edit-route-link"),
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
  chartCancelButton: document.querySelector("#chart-cancel-button"),
  tabAreaCloseButton: document.querySelector("#tab-area-close-button"),
  tabAreaFillButton: document.querySelector("#tab-area-fill-button"),
  tabAreaFillSwatch: document.querySelector("#tab-area-fill-swatch"),
  tabAreaFillInput: document.querySelector("#tab-area-fill-input"),
  tabAreaFillPanel: document.querySelector("#tab-area-fill-panel"),
  tabAreaColorPopup: document.querySelector("#tab-area-color-popup"),
  tabAreaColorSpectrum: document.querySelector("#tab-area-color-spectrum"),
  tabAreaColorSpectrumHandle: document.querySelector("#tab-area-color-spectrum-handle"),
  tabAreaColorHueInput: document.querySelector("#tab-area-color-hue-input"),
  tabAreaColorRInput: document.querySelector("#tab-area-color-r-input"),
  tabAreaColorGInput: document.querySelector("#tab-area-color-g-input"),
  tabAreaColorBInput: document.querySelector("#tab-area-color-b-input"),
  tabAreaColorEyedropperButton: document.querySelector("#tab-area-color-eyedropper-button"),
  tabAreaFillModeInputs: document.querySelectorAll('input[name="tab-area-fill-mode"]'),
  tabAreaFillSolidPanel: document.querySelector("#tab-area-fill-solid-panel"),
  tabAreaFillGradientPanel: document.querySelector("#tab-area-fill-gradient-panel"),
  tabAreaGradientTypeInput: document.querySelector("#tab-area-gradient-type-input"),
  tabAreaGradientDirectionField: document.querySelector("#tab-area-gradient-direction-field"),
  tabAreaGradientDirectionInput: document.querySelector("#tab-area-gradient-direction-input"),
  tabAreaGradientPreview: document.querySelector("#tab-area-gradient-preview"),
  tabAreaRemoveStopButton: document.querySelector("#tab-area-remove-stop-button"),
  tabAreaAddStopButton: document.querySelector("#tab-area-add-stop-button"),
  tabAreaGradientStops: document.querySelector("#tab-area-gradient-stops"),
  tabAreaFillOpacityField: document.querySelector("#tab-area-fill-opacity-field"),
  tabAreaFillOpacityInput: document.querySelector("#tab-area-fill-opacity-input"),
  tabAreaFillOpacityValue: document.querySelector("#tab-area-fill-opacity-value"),
  tabAreaFillOkButton: document.querySelector("#tab-area-fill-ok-button"),
  tabAreaFillCancelButton: document.querySelector("#tab-area-fill-cancel-button"),
  tabAreaTitleInput: document.querySelector("#tab-area-title-input"),
  tabAreaRadiusInput: document.querySelector("#tab-area-radius-input"),
  tabAreaHideHeaderInput: document.querySelector("#tab-area-hide-header-input"),
  tabAreaHideBorderInput: document.querySelector("#tab-area-hide-border-input"),
  shapeCloseButton: document.querySelector("#shape-close-button"),
  shapeEditorTitle: document.querySelector("#shape-editor-title"),
  shapeEditorSubtitle: document.querySelector("#shape-editor-subtitle"),
  shapeFillButton: document.querySelector("#shape-fill-button"),
  shapeFillSwatch: document.querySelector("#shape-fill-swatch"),
  shapeOutlineButton: document.querySelector("#shape-outline-button"),
  shapeOutlineSwatch: document.querySelector("#shape-outline-swatch"),
  shapeOutlineWeightInput: document.querySelector("#shape-outline-weight-input"),
  shapeLinkInput: document.querySelector("#shape-link-input"),
  shapeLinkPageButton: document.querySelector("#shape-link-page-button"),
  shapeLinkTabButton: document.querySelector("#shape-link-tab-button"),
  shapeLinkPageList: document.querySelector("#shape-link-page-list"),
  shapePaintPanel: document.querySelector("#shape-paint-panel"),
  shapePaintTargetLabel: document.querySelector("#shape-paint-target-label"),
  shapePaintTargetNote: document.querySelector("#shape-paint-target-note"),
  shapePaintModeInputs: document.querySelectorAll('input[name="shape-paint-mode"]'),
  shapePaintSolidPanel: document.querySelector("#shape-paint-solid-panel"),
  shapePaintGradientPanel: document.querySelector("#shape-paint-gradient-panel"),
  shapePaintGradientTypeInput: document.querySelector("#shape-paint-gradient-type-input"),
  shapePaintGradientDirectionField: document.querySelector("#shape-paint-gradient-direction-field"),
  shapePaintGradientDirectionInput: document.querySelector("#shape-paint-gradient-direction-input"),
  shapePaintGradientPreview: document.querySelector("#shape-paint-gradient-preview"),
  shapePaintAddStopButton: document.querySelector("#shape-paint-add-stop-button"),
  shapePaintRemoveStopButton: document.querySelector("#shape-paint-remove-stop-button"),
  shapePaintGradientStops: document.querySelector("#shape-paint-gradient-stops"),
  shapePaintColorPopup: document.querySelector("#shape-paint-color-popup"),
  shapePaintColorSpectrum: document.querySelector("#shape-paint-color-spectrum"),
  shapePaintColorSpectrumHandle: document.querySelector("#shape-paint-color-spectrum-handle"),
  shapePaintColorHueInput: document.querySelector("#shape-paint-color-hue-input"),
  shapePaintColorRInput: document.querySelector("#shape-paint-color-r-input"),
  shapePaintColorGInput: document.querySelector("#shape-paint-color-g-input"),
  shapePaintColorBInput: document.querySelector("#shape-paint-color-b-input"),
  shapePaintColorEyedropperButton: document.querySelector("#shape-paint-color-eyedropper-button"),
  shapePaintOpacityField: document.querySelector("#shape-paint-opacity-field"),
  shapePaintOpacityInput: document.querySelector("#shape-paint-opacity-input"),
  shapePaintOpacityValue: document.querySelector("#shape-paint-opacity-value"),
  shapePaintOkButton: document.querySelector("#shape-paint-ok-button"),
  shapePaintCancelButton: document.querySelector("#shape-paint-cancel-button"),
  libraryFillButton: document.querySelector("#library-fill-button"),
  libraryFillSwatch: document.querySelector("#library-fill-swatch"),
  libraryOutlineButton: document.querySelector("#library-outline-button"),
  libraryOutlineSwatch: document.querySelector("#library-outline-swatch"),
  libraryPaintPanel: document.querySelector("#library-paint-panel"),
  libraryPaintTargetLabel: document.querySelector("#library-paint-target-label"),
  libraryPaintTargetNote: document.querySelector("#library-paint-target-note"),
  libraryPaintModeInputs: document.querySelectorAll('input[name="library-paint-mode"]'),
  libraryPaintSolidPanel: document.querySelector("#library-paint-solid-panel"),
  libraryPaintGradientPanel: document.querySelector("#library-paint-gradient-panel"),
  libraryPaintGradientPreview: document.querySelector("#library-paint-gradient-preview"),
  libraryPaintGradientTypeInput: document.querySelector("#library-paint-gradient-type-input"),
  libraryPaintGradientDirectionField: document.querySelector("#library-paint-gradient-direction-field"),
  libraryPaintGradientDirectionInput: document.querySelector("#library-paint-gradient-direction-input"),
  libraryPaintAddStopButton: document.querySelector("#library-paint-add-stop-button"),
  libraryPaintRemoveStopButton: document.querySelector("#library-paint-remove-stop-button"),
  libraryPaintGradientStops: document.querySelector("#library-paint-gradient-stops"),
  libraryPaintColorPopup: document.querySelector("#library-paint-color-popup"),
  libraryPaintColorSpectrum: document.querySelector("#library-paint-color-spectrum"),
  libraryPaintColorSpectrumHandle: document.querySelector("#library-paint-color-spectrum-handle"),
  libraryPaintColorHueInput: document.querySelector("#library-paint-color-hue-input"),
  libraryPaintColorRInput: document.querySelector("#library-paint-color-r-input"),
  libraryPaintColorGInput: document.querySelector("#library-paint-color-g-input"),
  libraryPaintColorBInput: document.querySelector("#library-paint-color-b-input"),
  libraryPaintColorEyedropperButton: document.querySelector("#library-paint-color-eyedropper-button"),
  libraryPaintOpacityField: document.querySelector("#library-paint-opacity-field"),
  libraryPaintOpacityInput: document.querySelector("#library-paint-opacity-input"),
  libraryPaintOpacityValue: document.querySelector("#library-paint-opacity-value"),
  libraryPaintOkButton: document.querySelector("#library-paint-ok-button"),
  libraryPaintCancelButton: document.querySelector("#library-paint-cancel-button")
};

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

function loadSidebarMinimized() {
  try {
    return localStorage.getItem(SIDEBAR_MINIMIZED_KEY) === "true";
  } catch {
    return false;
  }
}

function defaultLibrarySelectionStyle() {
  return {
    fillMode: "solid",
    fillColor: "#ff6b35",
    fillGradientStops: defaultTabAreaGradientStops("#ff8f66", "#ff6b35"),
    fillGradientType: "linear",
    fillGradientDirection: "to right",
    fillOpacity: 0.12,
    outlineMode: "solid",
    outlineColor: "#ff6b35",
    outlineGradientStops: defaultTabAreaGradientStops("#ff8f66", "#ff6b35"),
    outlineGradientType: "linear",
    outlineGradientDirection: "to right",
    outlineOpacity: 0.24,
    outlineWeight: 1
  };
}

function normalizeLibrarySelectionStyle(style = {}) {
  const defaults = defaultLibrarySelectionStyle();
  return {
    fillMode: style.fillMode === "gradient" ? "gradient" : "solid",
    fillColor: normalizeHexColor(style.fillColor, defaults.fillColor),
    fillGradientStops: normalizeTabAreaGradientStops(style.fillGradientStops, style.fillColor || defaults.fillColor, defaults.fillGradientStops.at(-1)?.color || defaults.fillColor),
    fillGradientType: style.fillGradientType === "radial" ? "radial" : "linear",
    fillGradientDirection: String(style.fillGradientDirection || defaults.fillGradientDirection),
    fillOpacity: clampNumber(style.fillOpacity, 0, 1, defaults.fillOpacity),
    outlineMode: style.outlineMode === "gradient" ? "gradient" : "solid",
    outlineColor: normalizeHexColor(style.outlineColor, defaults.outlineColor),
    outlineGradientStops: normalizeTabAreaGradientStops(style.outlineGradientStops, style.outlineColor || defaults.outlineColor, defaults.outlineGradientStops.at(-1)?.color || defaults.outlineColor),
    outlineGradientType: style.outlineGradientType === "radial" ? "radial" : "linear",
    outlineGradientDirection: String(style.outlineGradientDirection || defaults.outlineGradientDirection),
    outlineOpacity: clampNumber(style.outlineOpacity, 0, 1, defaults.outlineOpacity),
    outlineWeight: clampNumber(style.outlineWeight, 0, 8, defaults.outlineWeight)
  };
}

function normalizeUiSettings(settings = {}) {
  return {
    librarySelection: normalizeLibrarySelectionStyle(settings.librarySelection)
  };
}

function loadUiSettings() {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    return raw ? normalizeUiSettings(JSON.parse(raw)) : normalizeUiSettings();
  } catch {
    return normalizeUiSettings();
  }
}

function saveUiSettings() {
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(normalizeUiSettings(state.uiSettings)));
  } catch {
    // Ignore storage failures.
  }
}

function saveLocalPages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pages));
}

function saveSidebarMinimized() {
  try {
    localStorage.setItem(SIDEBAR_MINIMIZED_KEY, String(state.sidebarMinimized));
  } catch {
    // Ignore storage failures for UI-only state.
  }
}

function renderSaveState(label) {
  return label;
}

function paintCssValue(
  mode = "solid",
  color = "#ffffff",
  stops = defaultTabAreaGradientStops(),
  opacity = 1,
  gradientType = "linear",
  gradientDirection = "to right"
) {
  if (mode !== "gradient") {
    return hexToRgba(color, opacity);
  }

  const normalizedStops = normalizeTabAreaGradientStops(stops, color, color);
  const stopList = normalizedStops
    .map((stop) => `${hexToRgba(stop.color, opacity)} ${stop.offset}%`)
    .join(", ");
  if (gradientType === "radial") {
    return `radial-gradient(circle at center, ${stopList})`;
  }
  return `linear-gradient(${gradientDirection || "to right"}, ${stopList})`;
}

function paintBorderCssValue(
  mode = "solid",
  color = "#ffffff",
  stops = defaultTabAreaGradientStops(),
  opacity = 1,
  gradientType = "linear",
  gradientDirection = "to right"
) {
  if (mode !== "gradient") {
    const solid = hexToRgba(color, opacity);
    return `linear-gradient(${solid}, ${solid})`;
  }

  return paintCssValue(mode, color, stops, opacity, gradientType, gradientDirection);
}

function gradientStopSliderValue(
  color = "#ffffff",
  stops = defaultTabAreaGradientStops(),
  opacity = 1
) {
  return paintCssValue("gradient", color, stops, opacity, "linear", "to right");
}

function setOpacityDisplay(element, value) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.textContent = `${clampNumber(value, 0, 100, 100)}%`;
}

function applyUiSettingsToDocument() {
  const librarySelection = normalizeLibrarySelectionStyle(state.uiSettings?.librarySelection);
  document.documentElement.style.setProperty(
    "--library-page-active-fill",
    paintCssValue(librarySelection.fillMode, librarySelection.fillColor, librarySelection.fillGradientStops, librarySelection.fillOpacity, librarySelection.fillGradientType, librarySelection.fillGradientDirection)
  );
  document.documentElement.style.setProperty(
    "--library-page-active-outline",
    paintBorderCssValue(librarySelection.outlineMode, librarySelection.outlineColor, librarySelection.outlineGradientStops, librarySelection.outlineOpacity, librarySelection.outlineGradientType, librarySelection.outlineGradientDirection)
  );
  document.documentElement.style.setProperty("--library-page-active-outline-width", `${librarySelection.outlineWeight}px`);
}

function renderPageCount() {
  elements.pageCount.textContent = `${state.pages.length} pages`;
}

function renderSidebarMinimizedState() {
  document.body.classList.toggle("sidebar-minimized", state.sidebarMinimized);

  if (elements.sidebarToggleButton) {
    const label = state.sidebarMinimized ? "Expand left panel" : "Minimize left panel";
    elements.sidebarToggleButton.setAttribute("aria-label", label);
    elements.sidebarToggleButton.setAttribute("title", label);
  }
}

function renderTabAreaDrawState() {
  document.body.classList.toggle("tab-area-draw-mode", state.tabAreaDrawMode);

  if (elements.createTabAreaButton) {
    elements.createTabAreaButton.setAttribute("aria-pressed", state.tabAreaDrawMode ? "true" : "false");
    elements.createTabAreaButton.classList.toggle("is-active", state.tabAreaDrawMode);
  }
}

function toggleTabAreaDrawMode(forceValue = !state.tabAreaDrawMode) {
  state.tabAreaDrawMode = Boolean(forceValue);
  if (!state.tabAreaDrawMode && tabAreaDrawState?.previewElement?.isConnected) {
    tabAreaDrawState.previewElement.remove();
  }
  if (!state.tabAreaDrawMode) {
    tabAreaDrawState = null;
  }
  renderTabAreaDrawState();
}

function toggleSidebarMinimized() {
  state.sidebarMinimized = !state.sidebarMinimized;
  saveSidebarMinimized();
  renderSidebarMinimizedState();
}

function parseRoute() {
  const hash = window.location.hash || "#/";

  if (hash.startsWith("#/page/")) {
    return { mode: "page", pageId: decodeURIComponent(hash.slice(7)) };
  }

  if (hash.startsWith("#/edit/")) {
    return { mode: "workspace-edit", pageId: decodeURIComponent(hash.slice(7)) };
  }

  return { mode: "workspace-edit", pageId: null };
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

function normalizeHexColor(value, fallback = "#ffffff") {
  const normalized = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

function hexToRgb(color) {
  const hex = normalizeHexColor(color, "#ffffff").slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function hexToRgba(color, alpha = 1) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampNumber(alpha, 0, 1, 1)})`;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => clampNumber(value, 0, 255, 0).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv(r, g, b) {
  const red = clampNumber(r, 0, 255, 0) / 255;
  const green = clampNumber(g, 0, 255, 0) / 255;
  const blue = clampNumber(b, 0, 255, 0) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * (((blue - red) / delta) + 2);
    } else {
      hue = 60 * (((red - green) / delta) + 4);
    }
  }

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round((max === 0 ? 0 : (delta / max) * 100)),
    v: Math.round(max * 100)
  };
}

function hsvToRgb(h, s, v) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clampNumber(s, 0, 100, 0) / 100;
  const value = clampNumber(v, 0, 100, 0) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma; green = x;
  } else if (hue < 120) {
    red = x; green = chroma;
  } else if (hue < 180) {
    green = chroma; blue = x;
  } else if (hue < 240) {
    green = x; blue = chroma;
  } else if (hue < 300) {
    red = x; blue = chroma;
  } else {
    red = chroma; blue = x;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

function defaultTabAreaGradientStops(start = "#ffffff", end = "#e9eef7") {
  return [
    { stopId: `stop-${Math.random().toString(36).slice(2, 10)}`, color: normalizeHexColor(start, "#ffffff"), offset: 0 },
    { stopId: `stop-${Math.random().toString(36).slice(2, 10)}`, color: normalizeHexColor(end, "#e9eef7"), offset: 100 }
  ];
}

function normalizeTabAreaGradientStops(stops, fallbackStart = "#ffffff", fallbackEnd = "#e9eef7") {
  const normalized = Array.isArray(stops)
    ? stops
        .map((stop, index) => ({
          stopId: String(stop?.stopId || `stop-${Math.random().toString(36).slice(2, 10)}`),
          color: normalizeHexColor(stop?.color, index === 0 ? fallbackStart : fallbackEnd),
          offset: clampNumber(stop?.offset, 0, 100, index === 0 ? 0 : 100)
        }))
        .filter((stop) => Number.isFinite(stop.offset))
    : [];

  const withFallback = normalized.length >= 2
    ? normalized
    : defaultTabAreaGradientStops(fallbackStart, fallbackEnd);

  return withFallback
    .map((stop, index) => ({
      stopId: String(stop.stopId || `stop-${Math.random().toString(36).slice(2, 10)}`),
      color: normalizeHexColor(stop.color, index === 0 ? fallbackStart : fallbackEnd),
      offset: clampNumber(stop.offset, 0, 100, index === 0 ? 0 : 100)
    }))
    .sort((left, right) => left.offset - right.offset);
}

function tabAreaFillValue(data = {}) {
  const container = normalizeTabbedContainerData(data);
  if (container.fillMode !== "gradient") {
    return hexToRgba(container.fillColor, container.fillOpacity);
  }

  return paintCssValue(
    "gradient",
    container.fillColor,
    container.gradientStops,
    container.fillOpacity,
    container.fillGradientType,
    container.fillGradientDirection
  );
}

function tabAreaHeaderFillValue(data = {}) {
  const container = normalizeTabbedContainerData(data);
  if (container.fillMode !== "gradient") {
    return hexToRgba(container.fillColor, container.fillOpacity);
  }

  return gradientStopSliderValue(
    container.fillColor,
    container.gradientStops,
    container.fillOpacity
  );
}

function interpolateHexColor(startColor, endColor, ratio = 0.5) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const mix = clampNumber(ratio, 0, 1, 0.5);
  return rgbToHex(
    Math.round(start.r + (end.r - start.r) * mix),
    Math.round(start.g + (end.g - start.g) * mix),
    Math.round(start.b + (end.b - start.b) * mix)
  );
}

function gradientColorAtOffset(stops, offset, fallbackColor = "#ffffff") {
  const normalizedStops = normalizeTabAreaGradientStops(stops, fallbackColor, fallbackColor);
  const targetOffset = clampNumber(offset, 0, 100, 0);
  const exactMatch = normalizedStops.find((stop) => stop.offset === targetOffset);
  if (exactMatch) {
    return exactMatch.color;
  }

  let leftStop = normalizedStops[0];
  let rightStop = normalizedStops[normalizedStops.length - 1];
  for (let index = 0; index < normalizedStops.length - 1; index += 1) {
    const current = normalizedStops[index];
    const next = normalizedStops[index + 1];
    if (targetOffset >= current.offset && targetOffset <= next.offset) {
      leftStop = current;
      rightStop = next;
      break;
    }
  }

  if (targetOffset <= leftStop.offset) {
    return leftStop.color;
  }
  if (targetOffset >= rightStop.offset) {
    return rightStop.color;
  }

  const span = Math.max(1, rightStop.offset - leftStop.offset);
  const ratio = (targetOffset - leftStop.offset) / span;
  return interpolateHexColor(leftStop.color, rightStop.color, ratio);
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

function enhanceShapes(root, mode = "published") {
  root.querySelectorAll(`[${SHAPE_DATA_ATTRIBUTE}]`).forEach((element) => {
    const shape = decodeShapeData(element.getAttribute(SHAPE_DATA_ATTRIBUTE));
    element.outerHTML = buildShapeMarkup(shape, mode);
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

function defaultTabbedContainerData(overrides = {}) {
  const base = {
    id: blockId("tabs"),
    title: "",
    x: 40,
    y: 40,
    width: 420,
    height: 260,
    fillColor: "#ffffff",
    fillMode: "solid",
    gradientStops: defaultTabAreaGradientStops("#ffffff", "#e9eef7"),
    fillGradientType: "linear",
    fillGradientDirection: "to right",
    fillOpacity: 1,
    borderRadius: 12,
    hideHeaderInDirectView: false,
    hideBorderInDirectView: false,
    activeTabId: "tab-1",
    tabs: [
      {
        id: "tab-1",
        label: "Tab 1",
        content: "<p>Start writing inside this tab.</p>"
      }
    ]
  };

  return normalizeTabbedContainerData({ ...base, ...overrides });
}

function normalizeTabbedContainerData(data = {}) {
  const fallbackTabs = [
    {
      id: "tab-1",
      label: "Tab 1",
      content: "<p>Start writing inside this tab.</p>"
    }
  ];
  const normalizedTabs = Array.isArray(data.tabs) && data.tabs.length
    ? data.tabs.map((tab, index) => ({
        id: String(tab?.id || `tab-${index + 1}`),
        label: String(tab?.label || `Tab ${index + 1}`).trim() || `Tab ${index + 1}`,
        content: String(tab?.content || "<p></p>").trim() || "<p></p>"
      }))
    : fallbackTabs;

  const activeTabId = normalizedTabs.some((tab) => tab.id === data.activeTabId)
    ? data.activeTabId
    : normalizedTabs[0].id;

  return {
    id: String(data.id || blockId("tabs")),
    title: String(data.title || "").trim(),
    x: clampNumber(data.x, 0, 2400, 40),
    y: clampNumber(data.y, 0, 2400, 40),
    width: clampNumber(data.width, 180, 1600, 420),
    height: clampNumber(data.height, 140, 1200, 260),
    fillColor: normalizeHexColor(data.fillColor, "#ffffff"),
    fillMode: data.fillMode === "gradient" ? "gradient" : "solid",
    gradientStops: normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7"),
    fillGradientType: data.fillGradientType === "radial" ? "radial" : "linear",
    fillGradientDirection: String(data.fillGradientDirection || "to right"),
    fillOpacity: clampNumber(data.fillOpacity, 0, 1, 1),
    borderRadius: clampNumber(data.borderRadius, 0, 48, 12),
    hideHeaderInDirectView: data.hideHeaderInDirectView === true,
    hideBorderInDirectView: data.hideBorderInDirectView === true,
    activeTabId,
    tabs: normalizedTabs
  };
}

function encodeTabbedContainerData(data) {
  return encodeURIComponent(JSON.stringify(normalizeTabbedContainerData(data)));
}

function decodeTabbedContainerData(value) {
  try {
    return normalizeTabbedContainerData(JSON.parse(decodeURIComponent(value || "")));
  } catch {
    return defaultTabbedContainerData();
  }
}

function tabbedContainerStyle(data) {
  const container = normalizeTabbedContainerData(data);
  return [
    `left:${container.x}px`,
    `top:${container.y}px`,
    `width:${container.width}px`,
    `height:${container.height}px`,
    `--tab-area-fill:${tabAreaFillValue(container)}`,
    `--tab-area-header-fill:${tabAreaHeaderFillValue(container)}`,
    `border-radius:${container.borderRadius}px`
  ].join("; ");
}

function renderEmbeddedCanvasContent(html = "<p></p>", mode = "editor") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html || "").trim() || "<p></p>";
  enhanceCharts(wrapper, mode);
  enhanceShapes(wrapper, mode);
  return wrapper.innerHTML;
}

function buildTabbedContainerMarkup(data, mode = "editor") {
  const container = normalizeTabbedContainerData(data);
  const activeTab = container.tabs.find((tab) => tab.id === container.activeTabId) || container.tabs[0];
  const headerHiddenInDirectView = mode === "published" && container.hideHeaderInDirectView;
  const borderHiddenInDirectView = mode === "published" && container.hideBorderInDirectView;
  const tabsMarkup = container.tabs.map((tab) => {
    const activeClass = tab.id === container.activeTabId ? " is-active" : "";
    return `
      <button class="tabbed-container-tab${activeClass}" type="button" data-tab-id="${escapeHtml(tab.id)}">
        <span class="tabbed-container-tab-label">${escapeHtml(tab.label)}</span>
      </button>
    `;
  }).join("");
  const controlsMarkup = mode === "editor"
    ? `
      <div class="tabbed-container-controls" contenteditable="false">
        <button class="tabbed-container-control" type="button" data-tab-action="add" aria-label="Add tab">+</button>
        <button class="tabbed-container-control" type="button" data-tab-action="remove" aria-label="Delete current tab">-</button>
        <button class="tabbed-container-control" type="button" data-tab-action="settings" aria-label="Edit tab area">&#9881;</button>
        <button class="tabbed-container-control" type="button" data-tab-action="delete-container" aria-label="Delete tab area">&#215;</button>
      </div>
    `
    : "";

  return `
    <div class="${TABBED_CONTAINER_CLASS}${borderHiddenInDirectView ? " is-direct-border-hidden" : ""}" ${TABBED_CONTAINER_ATTRIBUTE}="${encodeTabbedContainerData(container)}" style="${tabbedContainerStyle(container)}" contenteditable="false">
      <div class="tabbed-container-header${headerHiddenInDirectView ? " is-direct-hidden" : ""}" contenteditable="false">
        <div class="tabbed-container-tabs">${tabsMarkup}</div>
        ${controlsMarkup}
      </div>
      <div class="tabbed-container-content">
        <div class="tabbed-container-panel" ${mode === "editor" ? 'contenteditable="true"' : ""}>${renderEmbeddedCanvasContent(activeTab?.content || "<p></p>", mode)}</div>
      </div>
      ${mode === "editor" ? '<button class="tabbed-container-resize-handle tabbed-container-resize-handle-top" type="button" data-tab-resize="top" aria-label="Resize top edge"></button><button class="tabbed-container-resize-handle tabbed-container-resize-handle-right" type="button" data-tab-resize="right" aria-label="Resize right edge"></button><button class="tabbed-container-resize-handle tabbed-container-resize-handle-bottom" type="button" data-tab-resize="bottom" aria-label="Resize bottom edge"></button><button class="tabbed-container-resize-handle tabbed-container-resize-handle-left" type="button" data-tab-resize="left" aria-label="Resize left edge"></button><button class="tabbed-container-resize-handle tabbed-container-resize-handle-corner" type="button" data-tab-resize="corner" aria-label="Resize tab area"></button>' : ""}
    </div>
  `;
}

function setTabbedContainerData(containerElement, nextData, mode = "editor") {
  if (!(containerElement instanceof HTMLElement)) {
    return;
  }

  const data = normalizeTabbedContainerData(nextData);
  containerElement.setAttribute(TABBED_CONTAINER_ATTRIBUTE, encodeTabbedContainerData(data));
  containerElement.setAttribute("style", tabbedContainerStyle(data));

  const panel = containerElement.querySelector(".tabbed-container-panel");
  if (panel instanceof HTMLElement) {
    const activeTab = data.tabs.find((tab) => tab.id === data.activeTabId) || data.tabs[0];
    panel.innerHTML = renderEmbeddedCanvasContent(activeTab?.content || "<p></p>", mode);
    panel.setAttribute("contenteditable", mode === "editor" ? "true" : "false");
  }

  const tabs = containerElement.querySelector(".tabbed-container-tabs");
  if (tabs instanceof HTMLElement) {
    tabs.innerHTML = data.tabs.map((tab) => {
      const activeClass = tab.id === data.activeTabId ? " is-active" : "";
      return `
        <button class="tabbed-container-tab${activeClass}" type="button" data-tab-id="${escapeHtml(tab.id)}">
          <span class="tabbed-container-tab-label">${escapeHtml(tab.label)}</span>
        </button>
      `;
    }).join("");
  }
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

function makeTabbedContainerBlock(container) {
  return {
    id: blockId("tabs"),
    type: "tabbed-container",
    container: normalizeTabbedContainerData(container)
  };
}

function makeShapeBlock(shape) {
  return {
    id: blockId("shape"),
    type: "shape",
    shape: normalizeShapeData(shape)
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

      if (block?.type === "tabbed-container") {
        return {
          id: block.id || blockId("tabs"),
          type: "tabbed-container",
          container: normalizeTabbedContainerData(block.container)
        };
      }

      if (block?.type === "shape") {
        return {
          id: block.id || blockId("shape"),
          type: "shape",
          shape: normalizeShapeData(block.shape)
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

    if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement && node.hasAttribute(TABBED_CONTAINER_ATTRIBUTE)) {
      flushTextNodes();
      blocks.push(makeTabbedContainerBlock(decodeTabbedContainerData(node.getAttribute(TABBED_CONTAINER_ATTRIBUTE))));
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement && node.hasAttribute(SHAPE_DATA_ATTRIBUTE)) {
      flushTextNodes();
      blocks.push(makeShapeBlock(shapeElementData(node)));
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

    if (block.type === "tabbed-container") {
      return `<div ${TABBED_CONTAINER_ATTRIBUTE}="${encodeTabbedContainerData(block.container)}"></div>`;
    }

    if (block.type === "shape") {
      return `<div ${SHAPE_DATA_ATTRIBUTE}="${encodeShapeData(block.shape)}"></div>`;
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

    if (block.type === "tabbed-container") {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildTabbedContainerMarkup(block.container, mode);
      const element = wrapper.firstElementChild;
      if (element) {
        element.setAttribute("data-block-id", block.id || blockId("tabs"));
        return wrapper.innerHTML;
      }
      return "";
    }

    if (block.type === "shape") {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildShapeMarkup(block.shape, mode);
      const element = wrapper.firstElementChild;
      if (element) {
        element.setAttribute("data-block-id", block.id || blockId("shape"));
        return wrapper.innerHTML;
      }
      return "";
    }

    return mode === "editor" ? textBlockMarkup(block) : (String(block.html || "").trim() || "<p></p>");
  }).join("");
}

function defaultExampleBodyBlocks() {
  return sourceToBodyBlocks(`# Example Page

Use this page as a starting point for team updates, operating notes, or project briefs.

## Overview
- Purpose: summarize the page in one sentence
- Owner: platform engineering
- Status: active draft

## This Week
- Ship the highest-priority milestone
- Resolve the main operational blocker
- Confirm dependencies with partner teams

## Key Metrics
- Delivery predictability: 91%
- Open incidents: 2
- Current risk level: medium

## Decisions
- Keep rollout behind a feature flag
- Review analytics after the first release window
- Reassess scope after customer feedback

## Next Steps
- Update this section with action items
- Add charts if the page needs visual reporting
- Publish once the draft is ready for readers`);
}

function textFromBodyBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "chart") {
      const chart = normalizeChartData(block.chart);
      return [chart.title, chart.subtitle, ...chart.series.map((item) => item.label)].join(" ");
    }

    if (block.type === "tabbed-container") {
      const container = normalizeTabbedContainerData(block.container);
      return container.tabs.map((tab) => `${tab.label} ${tab.content}`).join(" ");
    }

    if (block.type === "shape") {
      const shape = normalizeShapeData(block.shape);
      const wrapper = document.createElement("div");
      wrapper.innerHTML = shape.textHtml || "";
      return wrapper.textContent || shapeTypeLabel(shape.type);
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

    if (element.classList.contains(TABBED_CONTAINER_CLASS)) {
      return [{
        id: element.getAttribute("data-block-id") || blockId("tabs"),
        type: "tabbed-container",
        container: decodeTabbedContainerData(element.getAttribute(TABBED_CONTAINER_ATTRIBUTE))
      }];
    }

    if (element.classList.contains(SHAPE_BLOCK_CLASS)) {
      return [{
        id: element.getAttribute("data-block-id") || blockId("shape"),
        type: "shape",
        shape: shapeElementData(element)
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

function clearSelectedShape() {
  if (selectedShapeElement?.isConnected) {
    selectedShapeElement.classList.remove("shape-block-selected");
  }

  selectedShapeElement = null;
}

function clearMarqueeSelectedObjects() {
  marqueeSelectedObjectElements.forEach((element) => {
    if (element instanceof HTMLElement && element.isConnected) {
      element.classList.remove("object-marquee-selected");
    }
  });
  marqueeSelectedObjectElements.clear();
}

function clearObjectSelectionState() {
  clearSelectedChart();
  clearSelectedShape();
  clearMarqueeSelectedObjects();
}

function selectableEditorObjects() {
  return Array.from(elements.bodyEditor.querySelectorAll(`.${CHART_CLASS}, .${SHAPE_BLOCK_CLASS}, .${TABBED_CONTAINER_CLASS}, .editor-inline-image`))
    .filter((element) => element instanceof HTMLElement);
}

function marqueeSelectedMovableObjects() {
  return Array.from(marqueeSelectedObjectElements).filter((element) => (
    element instanceof HTMLElement
    && element.isConnected
    && (element.classList.contains(SHAPE_BLOCK_CLASS) || element.classList.contains(TABBED_CONTAINER_CLASS))
  ));
}

function createMultiObjectDragState() {
  const objects = marqueeSelectedMovableObjects();
  if (!objects.length) {
    return null;
  }

  const items = objects.map((element) => {
    if (element.classList.contains(SHAPE_BLOCK_CLASS)) {
      const data = shapeElementData(element);
      if (!data) {
        return null;
      }
      return { element, type: "shape", startX: data.x, startY: data.y };
    }

    if (element.classList.contains(TABBED_CONTAINER_CLASS)) {
      const data = tabbedContainerElementData(element);
      if (!data) {
        return null;
      }
      return { element, type: "tabbed-container", startX: data.x, startY: data.y };
    }

    return null;
  }).filter(Boolean);

  return items.length ? { items } : null;
}

function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function updateMarqueeSelection(previewElement) {
  if (!(previewElement instanceof HTMLElement)) {
    clearMarqueeSelectedObjects();
    return;
  }

  const previewRect = previewElement.getBoundingClientRect();
  clearMarqueeSelectedObjects();
  selectableEditorObjects().forEach((element) => {
    if (rectsIntersect(previewRect, element.getBoundingClientRect())) {
      element.classList.add("object-marquee-selected");
      marqueeSelectedObjectElements.add(element);
    }
  });
}

function currentSelectedChartElement() {
  if (selectedChartElement?.isConnected) {
    return selectedChartElement;
  }

  const chartElement = elements.bodyEditor.querySelector(`.${CHART_CLASS}.chart-block-selected`);
  if (chartElement instanceof HTMLElement) {
    selectedChartElement = chartElement;
    return chartElement;
  }

  return null;
}

function selectChart(chartElement) {
  if (!(chartElement instanceof HTMLElement)) {
    return;
  }

  if (selectedChartElement === chartElement) {
    return;
  }

  clearMarqueeSelectedObjects();
  clearSelectedChart();
  selectedChartElement = chartElement;
  selectedChartElement.classList.add("chart-block-selected");
}

function currentSelectedShapeElement() {
  if (selectedShapeElement?.isConnected) {
    return selectedShapeElement;
  }

  const shapeElement = elements.bodyEditor.querySelector(`.${SHAPE_BLOCK_CLASS}.shape-block-selected`);
  if (shapeElement instanceof HTMLElement) {
    selectedShapeElement = shapeElement;
    return shapeElement;
  }

  return null;
}

function selectShape(shapeElement) {
  if (!(shapeElement instanceof HTMLElement)) {
    return;
  }

  if (selectedShapeElement === shapeElement) {
    return;
  }

  clearMarqueeSelectedObjects();
  clearSelectedShape();
  selectedShapeElement = shapeElement;
  selectedShapeElement.classList.add("shape-block-selected");
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

function defaultShapeData(type = "rectangle") {
  const normalizedType = SHAPE_TYPES.includes(type) ? type : "rectangle";
  const presets = {
    rectangle: {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 180,
      height: 120,
      textHtml: "<div>Text</div>"
    },
    "rounded-rectangle": {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 180,
      height: 120,
      textHtml: "<div>Text</div>"
    },
    circle: {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 160,
      height: 160,
      textHtml: "<div>Text</div>"
    },
    oval: {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 188,
      height: 124,
      textHtml: "<div>Text</div>"
    },
    triangle: {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 180,
      height: 140,
      textHtml: "<div>Text</div>"
    },
    diamond: {
      fillColor: "#dfefff",
      fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
      outlineColor: "#0c66e4",
      outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
      outlineWeight: 2,
      width: 180,
      height: 132,
      textHtml: "<div>Text</div>"
    },
    "sleek-button": {
      fillMode: "gradient",
      fillColor: "#2f7cf7",
      fillGradientStops: defaultTabAreaGradientStops("#4b9bff", "#1459d9"),
      outlineMode: "solid",
      outlineColor: "#0a3ea6",
      outlineGradientStops: defaultTabAreaGradientStops("#1b66e8", "#0a3ea6"),
      outlineWeight: 1,
      width: 184,
      height: 58,
      textHtml: "<div>Button</div>"
    },
    "minimal-button": {
      fillColor: "#ffffff",
      fillGradientStops: defaultTabAreaGradientStops("#ffffff", "#eef3fb"),
      outlineColor: "#8ea3bf",
      outlineGradientStops: defaultTabAreaGradientStops("#8ea3bf", "#6b7d96"),
      outlineWeight: 1,
      width: 176,
      height: 54,
      textHtml: "<div>Button</div>"
    },
    "glassy-button": {
      fillMode: "gradient",
      fillColor: "#8fd6ff",
      fillGradientStops: defaultTabAreaGradientStops("#d8f1ff", "#6ec3ff"),
      outlineMode: "solid",
      outlineColor: "#4d98d8",
      outlineGradientStops: defaultTabAreaGradientStops("#6ec3ff", "#4d98d8"),
      outlineWeight: 1,
      width: 184,
      height: 58,
      textHtml: "<div>Button</div>"
    },
    "pill-button": {
      fillMode: "gradient",
      fillColor: "#eff4ff",
      fillGradientStops: defaultTabAreaGradientStops("#ffffff", "#d9e7ff"),
      outlineMode: "solid",
      outlineColor: "#7c94c6",
      outlineGradientStops: defaultTabAreaGradientStops("#a0b7e8", "#7c94c6"),
      outlineWeight: 1,
      width: 192,
      height: 56,
      textHtml: "<div>Button</div>"
    }
  };

  return normalizeShapeData({
    type: normalizedType,
    fillMode: "solid",
    fillColor: "#dfefff",
    fillGradientStops: defaultTabAreaGradientStops("#dfefff", "#a9cfff"),
    outlineMode: "solid",
    outlineColor: "#0c66e4",
    outlineGradientStops: defaultTabAreaGradientStops("#0c66e4", "#579dff"),
    outlineWeight: 2,
    fillOpacity: 1,
    outlineOpacity: 1,
    x: 24,
    y: 24,
    width: 180,
    height: 120,
    textHtml: "<div>Text</div>",
    linkPage: "",
    ...(presets[normalizedType] || presets.rectangle)
  });
}

function shapeTypeLabel(type = "rectangle") {
  switch (type) {
    case "rounded-rectangle":
      return "Rounded rectangle";
    case "circle":
      return "Circle";
    case "oval":
      return "Oval";
    case "triangle":
      return "Triangle";
    case "diamond":
      return "Diamond";
    case "sleek-button":
      return "Sleek button";
    case "minimal-button":
      return "Minimal button";
    case "glassy-button":
      return "Glassy button";
    case "pill-button":
      return "Pill button";
    default:
      return "Rectangle";
  }
}

function normalizeShapeData(data = {}) {
  const fillColor = normalizeHexColor(data.fillColor, "#dfefff");
  const outlineColor = normalizeHexColor(data.outlineColor, "#0c66e4");
  const type = SHAPE_TYPES.includes(data.type)
    ? data.type
    : "rectangle";

  return {
    type,
    fillMode: data.fillMode === "gradient" ? "gradient" : "solid",
    fillColor,
    fillGradientStops: normalizeTabAreaGradientStops(data.fillGradientStops, fillColor, "#a9cfff"),
    fillGradientType: data.fillGradientType === "radial" ? "radial" : "linear",
    fillGradientDirection: String(data.fillGradientDirection || "to right"),
    outlineMode: data.outlineMode === "gradient" ? "gradient" : "solid",
    outlineColor,
    outlineGradientStops: normalizeTabAreaGradientStops(data.outlineGradientStops, outlineColor, "#579dff"),
    outlineGradientType: data.outlineGradientType === "radial" ? "radial" : "linear",
    outlineGradientDirection: String(data.outlineGradientDirection || "to right"),
    outlineWeight: clampNumber(data.outlineWeight, 0, 24, 2),
    fillOpacity: clampNumber(data.fillOpacity, 0, 1, 1),
    outlineOpacity: clampNumber(data.outlineOpacity, 0, 1, 1),
    x: Math.max(0, Math.round(Number(data.x) || 0)),
    y: Math.max(0, Math.round(Number(data.y) || 0)),
    width: Math.max(96, Math.round(Number(data.width) || 180)),
    height: Math.max(64, Math.round(Number(data.height) || 120)),
    textHtml: String(data.textHtml || "<div>Text</div>"),
    linkPage: String(data.linkPage || "").trim()
  };
}

function encodeShapeData(data) {
  return encodeURIComponent(JSON.stringify(normalizeShapeData(data)));
}

function decodeShapeData(value) {
  try {
    return normalizeShapeData(JSON.parse(decodeURIComponent(value || "")));
  } catch {
    return defaultShapeData();
  }
}

function resolveShapeLink(linkValue = "") {
  const normalized = String(linkValue || "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("#/tab/")) {
    const parts = normalized.split("/");
    const containerId = decodeURIComponent(parts[2] || "");
    const tabId = decodeURIComponent(parts[3] || "");
    if (containerId && tabId) {
      return { type: "tab", containerId, tabId };
    }
  }

  if (normalized.startsWith("#/page/")) {
    const pageId = decodeURIComponent(normalized.slice(7));
    const routeMatch = state.pages.find((page) => page.id === pageId);
    if (routeMatch) {
      return { type: "internal", pageId: routeMatch.id };
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    return { type: "external", href: normalized };
  }

  if (/^www\./i.test(normalized)) {
    return { type: "external", href: `https://${normalized}` };
  }

  const exactIdMatch = state.pages.find((page) => page.id === normalized);
  if (exactIdMatch) {
    return { type: "internal", pageId: exactIdMatch.id };
  }

  const normalizedLower = normalized.toLowerCase();
  const titleMatch = state.pages.find((page) => String(page.title || "").trim().toLowerCase() === normalizedLower) || null;
  if (titleMatch) {
    return { type: "internal", pageId: titleMatch.id };
  }

  return null;
}

function shapePaintValue(
  mode = "solid",
  solidColor = "#ffffff",
  gradientStops = defaultTabAreaGradientStops(),
  opacity = 1,
  gradientType = "linear",
  gradientDirection = "to right"
) {
  return mode === "gradient"
    ? paintCssValue(
        "gradient",
        solidColor,
        normalizeTabAreaGradientStops(gradientStops, solidColor, "#e9eef7"),
        opacity,
        gradientType,
        gradientDirection
      )
    : hexToRgba(solidColor, opacity);
}

function shapeFillAttribute(mode, color, gradientId) {
  return mode === "gradient" ? `url(#${gradientId})` : normalizeHexColor(color, "#ffffff");
}

function linearGradientVector(direction = "to right") {
  switch (String(direction || "to right")) {
    case "to left":
      return { x1: "100%", y1: "0%", x2: "0%", y2: "0%" };
    case "to bottom":
      return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
    case "to top":
      return { x1: "0%", y1: "100%", x2: "0%", y2: "0%" };
    case "to bottom right":
      return { x1: "0%", y1: "0%", x2: "100%", y2: "100%" };
    case "to bottom left":
      return { x1: "100%", y1: "0%", x2: "0%", y2: "100%" };
    case "to top right":
      return { x1: "0%", y1: "100%", x2: "100%", y2: "0%" };
    case "to top left":
      return { x1: "100%", y1: "100%", x2: "0%", y2: "0%" };
    case "to right":
    default:
      return { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };
  }
}

function shapeGradientStopsMarkup(gradientId, stops, gradientType = "linear", gradientDirection = "to right") {
  if (gradientType === "radial") {
    return `
      <radialGradient id="${gradientId}" cx="50%" cy="50%" r="75%">
        ${stops.map((stop) => `<stop offset="${stop.offset}%" stop-color="${stop.color}"></stop>`).join("")}
      </radialGradient>
    `;
  }
  const vector = linearGradientVector(gradientDirection);
  return `
    <linearGradient id="${gradientId}" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}">
      ${stops.map((stop) => `<stop offset="${stop.offset}%" stop-color="${stop.color}"></stop>`).join("")}
    </linearGradient>
  `;
}

function shapeSvgMarkup(shapeData = defaultShapeData(), gradientPrefix = "shape") {
  const data = normalizeShapeData(shapeData);
  const fillGradientId = `${gradientPrefix}-fill-gradient`;
  const outlineGradientId = `${gradientPrefix}-outline-gradient`;
  const dropShadowId = `${gradientPrefix}-shadow`;
  const glossGradientId = `${gradientPrefix}-gloss`;
  const defs = `
    <defs>
      ${data.fillMode === "gradient" ? shapeGradientStopsMarkup(fillGradientId, data.fillGradientStops, data.fillGradientType, data.fillGradientDirection) : ""}
      ${data.outlineMode === "gradient" ? shapeGradientStopsMarkup(outlineGradientId, data.outlineGradientStops, data.outlineGradientType, data.outlineGradientDirection) : ""}
      <filter id="${dropShadowId}" x="-20%" y="-40%" width="140%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.18"></feDropShadow>
      </filter>
      <linearGradient id="${glossGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"></stop>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.2"></stop>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
  `;
  const fill = shapeFillAttribute(data.fillMode, data.fillColor, fillGradientId);
  const minimalFill = data.type === "minimal-button" && data.fillMode !== "gradient"
    ? hexToRgba(data.fillColor, 0.16)
    : fill;
  const fillOpacity = data.fillOpacity;
  const stroke = shapeFillAttribute(data.outlineMode, data.outlineColor, outlineGradientId);
  const strokeOpacity = data.outlineOpacity;
  const strokeWidth = data.outlineWeight;

  switch (data.type) {
    case "rounded-rectangle":
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="11" y="13" width="118" height="62" rx="18" ry="18" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"></rect></svg>`;
    case "circle":
      return `<svg viewBox="0 0 140 88" aria-hidden="true" focusable="false">${defs}<circle cx="70" cy="44" r="31" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"></circle></svg>`;
    case "oval":
      return `<svg viewBox="0 0 140 88" aria-hidden="true" focusable="false">${defs}<ellipse cx="70" cy="44" rx="43" ry="29" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"></ellipse></svg>`;
    case "triangle":
      return `<svg viewBox="0 0 140 88" aria-hidden="true" focusable="false">${defs}<polygon points="70,12 126,74 14,74" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linejoin="round"></polygon></svg>`;
    case "diamond":
      return `<svg viewBox="0 0 140 88" aria-hidden="true" focusable="false">${defs}<polygon points="70,10 122,44 70,78 18,44" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linejoin="round"></polygon></svg>`;
    case "sleek-button":
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="10" y="18" width="120" height="44" rx="16" ry="16" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${Math.max(1, strokeWidth)}" filter="url(#${dropShadowId})"></rect><rect x="13" y="21" width="114" height="18" rx="12" ry="12" fill="url(#${glossGradientId})" opacity="0.52"></rect></svg>`;
    case "minimal-button":
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="10" y="18" width="120" height="44" rx="16" ry="16" fill="${minimalFill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${Math.max(1, strokeWidth)}"></rect></svg>`;
    case "glassy-button":
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="10" y="18" width="120" height="44" rx="16" ry="16" fill="${fill}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${Math.max(1, strokeWidth)}" fill-opacity="${Number((fillOpacity * 0.88).toFixed(4))}" filter="url(#${dropShadowId})"></rect><rect x="14" y="21" width="112" height="16" rx="10" ry="10" fill="#ffffff" fill-opacity="0.48"></rect><rect x="12" y="20" width="116" height="40" rx="15" ry="15" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1"></rect></svg>`;
    case "pill-button":
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="8" y="18" width="124" height="42" rx="21" ry="21" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${Math.max(1, strokeWidth)}"></rect><rect x="14" y="22" width="112" height="14" rx="9" ry="9" fill="url(#${glossGradientId})" opacity="0.42"></rect></svg>`;
    case "rectangle":
    default:
      return `<svg viewBox="0 0 140 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}<rect x="11" y="13" width="118" height="62" rx="4" ry="4" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"></rect></svg>`;
  }
}

function shapeInlineStyle(shapeData = defaultShapeData(), mode = "editor") {
  const data = normalizeShapeData(shapeData);
  return [
    `left:${data.x}px`,
    `top:${data.y}px`,
    `width:${data.width}px`,
    `height:${data.height}px`,
    mode !== "editor" && data.linkPage ? "cursor:pointer" : ""
  ].join("; ");
}

function shapeEditorHandlesMarkup(mode = "editor") {
  if (mode !== "editor") {
    return "";
  }

  return `
    <button class="shape-resize-handle shape-resize-handle-nw" type="button" data-shape-resize="nw" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-n" type="button" data-shape-resize="n" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-ne" type="button" data-shape-resize="ne" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-e" type="button" data-shape-resize="e" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-se" type="button" data-shape-resize="se" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-s" type="button" data-shape-resize="s" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-sw" type="button" data-shape-resize="sw" aria-label="Resize shape"></button>
    <button class="shape-resize-handle shape-resize-handle-w" type="button" data-shape-resize="w" aria-label="Resize shape"></button>
  `;
}

function shapeInnerMarkup(shapeData = defaultShapeData(), mode = "editor") {
  const data = normalizeShapeData(shapeData);
  const gradientPrefix = `shape-${Math.random().toString(36).slice(2, 8)}`;
  return `
    <div class="editor-shape-art" aria-hidden="true">${shapeSvgMarkup(data, gradientPrefix)}</div>
    <div class="editor-shape-text" contenteditable="${mode === "editor" ? "true" : "false"}" spellcheck="false">${data.textHtml}</div>
    ${shapeEditorHandlesMarkup(mode)}
  `;
}

function buildShapeMarkup(shapeData = defaultShapeData(), mode = "editor") {
  const data = normalizeShapeData(shapeData);
  const blockIdValue = blockId("shape");
  return `<div class="${SHAPE_BLOCK_CLASS}" ${SHAPE_DATA_ATTRIBUTE}="${encodeShapeData(data)}" data-shape-type="${escapeHtml(data.type)}" data-block-id="${escapeHtml(blockIdValue)}" contenteditable="false" style="${shapeInlineStyle(data, mode)}">${shapeInnerMarkup(data, mode)}</div>`;
}

function shapeElementData(shapeElement) {
  if (!(shapeElement instanceof HTMLElement)) {
    return null;
  }

  const data = decodeShapeData(shapeElement.getAttribute(SHAPE_DATA_ATTRIBUTE));
  const textElement = shapeElement.querySelector(".editor-shape-text");
  if (textElement instanceof HTMLElement) {
    data.textHtml = textElement.innerHTML.trim() || "<div>Text</div>";
  }
  return normalizeShapeData(data);
}

function setShapeElementData(shapeElement, nextData) {
  if (!(shapeElement instanceof HTMLElement)) {
    return;
  }

  const data = normalizeShapeData(nextData);
  shapeElement.setAttribute(SHAPE_DATA_ATTRIBUTE, encodeShapeData(data));
  shapeElement.setAttribute("data-shape-type", data.type);
  shapeElement.setAttribute("style", shapeInlineStyle(data, "editor"));
  shapeElement.innerHTML = shapeInnerMarkup(data, "editor");
}

function closeShapeMenu() {
  elements.shapeMenuDropdown.hidden = true;
  elements.shapeMenuTrigger.setAttribute("aria-expanded", "false");
}

function closeButtonMenu() {
  elements.buttonMenuDropdown.hidden = true;
  elements.buttonMenuTrigger.setAttribute("aria-expanded", "false");
}

function openShapeMenu() {
  closeButtonMenu();
  elements.shapeMenuDropdown.hidden = false;
  elements.shapeMenuTrigger.setAttribute("aria-expanded", "true");
}

function toggleShapeMenu() {
  if (elements.shapeMenuDropdown.hidden) {
    closeChartMenu();
    openShapeMenu();
    return;
  }

  closeShapeMenu();
}

function openButtonMenu() {
  closeShapeMenu();
  closeChartMenu();
  elements.buttonMenuDropdown.hidden = false;
  elements.buttonMenuTrigger.setAttribute("aria-expanded", "true");
}

function toggleButtonMenu() {
  if (elements.buttonMenuDropdown.hidden) {
    openButtonMenu();
    return;
  }

  closeButtonMenu();
}

function shapeCanvasForElement(element) {
  if (!(element instanceof HTMLElement)) {
    return elements.bodyEditor;
  }

  return element.closest(".tabbed-container-panel") || elements.bodyEditor;
}

function shapePositionFromSelection(containerElement, range, shapeData = defaultShapeData()) {
  const canvas = containerElement instanceof HTMLElement ? containerElement : elements.bodyEditor;
  const data = normalizeShapeData(shapeData);
  const canvasRect = canvas.getBoundingClientRect();
  const fallbackX = canvas.scrollLeft + 24;
  const fallbackY = canvas.scrollTop + 24;

  if (!(range instanceof Range)) {
    return { x: fallbackX, y: fallbackY };
  }

  const rangeRect = range.getBoundingClientRect();
  if (!rangeRect || (!rangeRect.width && !rangeRect.height && !rangeRect.top && !rangeRect.left)) {
    return { x: fallbackX, y: fallbackY };
  }

  return {
    x: Math.max(0, Math.round(rangeRect.left - canvasRect.left + canvas.scrollLeft)),
    y: Math.max(0, Math.round(rangeRect.top - canvasRect.top + canvas.scrollTop - Math.min(16, data.height / 5)))
  };
}

function insertShapeAtCursor(shapeType = "rectangle") {
  const target = selectionTarget();
  const wrapper = document.createElement("div");
  const baseShape = defaultShapeData(shapeType);
  wrapper.innerHTML = buildShapeMarkup(baseShape);
  const shapeNode = wrapper.firstElementChild;
  if (!(shapeNode instanceof HTMLElement)) {
    return;
  }

  const tabPanel = target?.range?.startContainer?.nodeType === Node.TEXT_NODE
    ? target.range.startContainer.parentElement?.closest(".tabbed-container-panel")
    : target?.range?.startContainer?.closest?.(".tabbed-container-panel");
  const canvas = tabPanel instanceof HTMLElement ? tabPanel : elements.bodyEditor;
  const position = shapePositionFromSelection(canvas, target?.range, baseShape);
  const shapeData = { ...baseShape, ...position };
  setShapeElementData(shapeNode, shapeData);
  canvas.appendChild(shapeNode);

  if (tabPanel instanceof HTMLElement) {
    const containerElement = tabPanel.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
    tabPanel.focus();
  } else {
    elements.bodyEditor.focus();
  }

  openShapeEditor(shapeNode);
  handleLiveEdit();
}

function placeCaretAfterInsertedNode(node) {
  const selection = window.getSelection();
  if (!selection || !(node instanceof Node)) {
    return;
  }

  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertImageAtCursor(src, alt = "") {
  if (!src) {
    return;
  }

  const image = document.createElement("img");
  image.className = "editor-inline-image";
  image.src = src;
  image.alt = alt || "Inserted image";

  const target = selectionTarget();
  const tabPanel = target?.range?.startContainer?.nodeType === Node.TEXT_NODE
    ? target.range.startContainer.parentElement?.closest(".tabbed-container-panel")
    : target?.range?.startContainer?.closest?.(".tabbed-container-panel");

  if (tabPanel instanceof HTMLElement) {
    if (target?.range) {
      target.range.deleteContents();
      target.range.insertNode(image);
      placeCaretAfterInsertedNode(image);
    } else {
      tabPanel.appendChild(image);
    }
    const containerElement = tabPanel.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
    tabPanel.focus();
    handleLiveEdit();
    return;
  }

  const textBlock = target?.range
    ? (closestTextBlock(target.range.startContainer) || ensureEditorTextBlock())
    : ensureEditorTextBlock();

  if (!(textBlock instanceof HTMLElement)) {
    return;
  }

  if (target?.range && textBlock.contains(target.range.startContainer)) {
    target.range.deleteContents();
    target.range.insertNode(image);
    placeCaretAfterInsertedNode(image);
  } else {
    textBlock.appendChild(image);
  }

  textBlock.focus();
  handleLiveEdit();
}

function tabbedContainerElementData(containerElement) {
  if (!(containerElement instanceof HTMLElement)) {
    return null;
  }

  return decodeTabbedContainerData(containerElement.getAttribute(TABBED_CONTAINER_ATTRIBUTE));
}

function activeTabbedContainerPanel(containerElement) {
  return containerElement?.querySelector?.(".tabbed-container-panel") || null;
}

function syncTabbedContainerActiveContent(containerElement) {
  const data = tabbedContainerElementData(containerElement);
  const panel = activeTabbedContainerPanel(containerElement);
  if (!data || !(panel instanceof HTMLElement)) {
    return data;
  }

  const activeTab = data.tabs.find((tab) => tab.id === data.activeTabId);
  if (activeTab) {
    activeTab.content = panel.innerHTML.trim() || "<p></p>";
  }

  containerElement.setAttribute(TABBED_CONTAINER_ATTRIBUTE, encodeTabbedContainerData(data));
  return data;
}

function syncAllTabbedContainerContent() {
  elements.bodyEditor.querySelectorAll(`.${TABBED_CONTAINER_CLASS}`).forEach((containerElement) => {
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
  });
}

function createTabbedContainerAtRect(rect) {
  const container = defaultTabbedContainerData(rect);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildTabbedContainerMarkup(container, "editor");
  const element = wrapper.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.setAttribute("data-block-id", blockId("tabs"));
  elements.bodyEditor.appendChild(element);
  const panel = activeTabbedContainerPanel(element);
  if (panel instanceof HTMLElement) {
    panel.focus();
  }
  handleLiveEdit();
}

function moveTabbedContainerTo(containerElement, nextLeft, nextTop) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  data.x = Math.max(0, Math.round(nextLeft));
  data.y = Math.max(0, Math.round(nextTop));
  setTabbedContainerData(containerElement, data, "editor");
}

function resizeTabbedContainerTo(containerElement, nextWidth, nextHeight) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  data.width = Math.max(180, Math.round(nextWidth));
  data.height = Math.max(140, Math.round(nextHeight));
  setTabbedContainerData(containerElement, data, "editor");
}

function resizeTabbedContainerFrame(containerElement, nextLeft, nextTop, nextWidth, nextHeight) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  data.x = Math.max(0, Math.round(nextLeft));
  data.y = Math.max(0, Math.round(nextTop));
  data.width = Math.max(180, Math.round(nextWidth));
  data.height = Math.max(140, Math.round(nextHeight));
  setTabbedContainerData(containerElement, data, "editor");
}

function syncShapeCanvasContent(shapeElement) {
  const panel = shapeElement?.closest?.(".tabbed-container-panel");
  const containerElement = panel?.closest?.(`.${TABBED_CONTAINER_CLASS}`);
  if (containerElement instanceof HTMLElement) {
    syncTabbedContainerActiveContent(containerElement);
  }
}

function moveShapeTo(shapeElement, nextX, nextY) {
  const data = shapeElementData(shapeElement);
  if (!data) {
    return;
  }

  data.x = Math.max(0, Math.round(nextX));
  data.y = Math.max(0, Math.round(nextY));
  setShapeElementData(shapeElement, data);
  syncShapeCanvasContent(shapeElement);
}

function resizeShapeFrame(shapeElement, nextX, nextY, nextWidth, nextHeight) {
  const data = shapeElementData(shapeElement);
  if (!data) {
    return;
  }

  data.x = Math.max(0, Math.round(nextX));
  data.y = Math.max(0, Math.round(nextY));
  data.width = Math.max(96, Math.round(nextWidth));
  data.height = Math.max(64, Math.round(nextHeight));
  setShapeElementData(shapeElement, data);
  syncShapeCanvasContent(shapeElement);
}

function switchTabbedContainerTab(containerElement, tabId, mode = "editor") {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data || !data.tabs.some((tab) => tab.id === tabId)) {
    return;
  }

  data.activeTabId = tabId;
  setTabbedContainerData(containerElement, data, mode);
  if (mode === "editor") {
    const panel = activeTabbedContainerPanel(containerElement);
    if (panel instanceof HTMLElement) {
      panel.focus();
    }
    handleLiveEdit();
    return;
  }

  syncPublishedBodyLayout();
}

function addTabbedContainerTab(containerElement) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  const nextIndex = data.tabs.length + 1;
  const nextId = `tab-${Math.random().toString(36).slice(2, 8)}`;
  data.tabs.push({
    id: nextId,
    label: `Tab ${nextIndex}`,
    content: "<p></p>"
  });
  data.activeTabId = nextId;
  setTabbedContainerData(containerElement, data, "editor");
  const panel = activeTabbedContainerPanel(containerElement);
  if (panel instanceof HTMLElement) {
    panel.focus();
  }
  handleLiveEdit();
}

function removeTabbedContainerTab(containerElement) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  if (data.tabs.length <= 1) {
    containerElement.remove();
    handleLiveEdit();
    return;
  }

  const activeIndex = data.tabs.findIndex((tab) => tab.id === data.activeTabId);
  data.tabs = data.tabs.filter((tab) => tab.id !== data.activeTabId);
  data.activeTabId = data.tabs[Math.max(0, activeIndex - 1)]?.id || data.tabs[0].id;
  setTabbedContainerData(containerElement, data, "editor");
  const panel = activeTabbedContainerPanel(containerElement);
  if (panel instanceof HTMLElement) {
    panel.focus();
  }
  handleLiveEdit();
}

function renameTabbedContainerTab(containerElement, tabId) {
  const data = syncTabbedContainerActiveContent(containerElement);
  if (!data) {
    return;
  }

  const tab = data.tabs.find((entry) => entry.id === tabId);
  if (!tab) {
    return;
  }

  const tabButton = containerElement.querySelector(`[data-tab-id="${CSS.escape(tabId)}"]`);
  const labelElement = tabButton?.querySelector(".tabbed-container-tab-label");
  if (!(tabButton instanceof HTMLButtonElement) || !(labelElement instanceof HTMLElement)) {
    return;
  }

  if (tabButton.querySelector(".tabbed-container-tab-input")) {
    tabButton.querySelector(".tabbed-container-tab-input")?.focus();
    return;
  }

  const originalLabel = tab.label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = originalLabel;
  input.className = "tabbed-container-tab-input";
  input.setAttribute("aria-label", "Tab name");
  labelElement.replaceWith(input);
  tabButton.classList.add("is-editing");
  input.focus();
  input.select();

  const finishRename = (commit) => {
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("keydown", handleKeyDown);
    tabButton.classList.remove("is-editing");

    const nextLabel = input.value.trim() || "";
    const nextSpan = document.createElement("span");
    nextSpan.className = "tabbed-container-tab-label";
    nextSpan.textContent = commit && nextLabel ? nextLabel : originalLabel;
    input.replaceWith(nextSpan);

    if (!commit) {
      return;
    }

    tab.label = nextLabel || originalLabel;
    setTabbedContainerData(containerElement, data, "editor");
    handleLiveEdit();
  };

  const handleBlur = () => {
    finishRename(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      finishRename(false);
      tabButton.focus();
    }
  };

  input.addEventListener("blur", handleBlur);
  input.addEventListener("keydown", handleKeyDown);
}

function renderStoredBody(body) {
  const blocks = Array.isArray(body) ? normalizeBodyBlocks({ bodyBlocks: body }) : sourceToBodyBlocks(body);
  return blocks.map((block) => {
    if (block.type === "chart") {
      return buildChartBlockMarkup(block.chart, "published");
    }

    if (block.type === "tabbed-container") {
      return buildTabbedContainerMarkup(block.container, "published");
    }

    if (block.type === "shape") {
      return buildShapeMarkup(block.shape, "published");
    }

    return String(block.html || "").trim() || "<p></p>";
  }).join("");
}

function syncPublishedBodyLayout() {
  if (!(elements.publishedBody instanceof HTMLElement)) {
    return;
  }

  elements.publishedBody.style.minHeight = "";
  elements.publishedBody.style.minWidth = "";
  const absoluteBlocks = Array.from(
    elements.publishedBody.querySelectorAll(`:scope > .${TABBED_CONTAINER_CLASS}, :scope > .${SHAPE_BLOCK_CLASS}`)
  );
  const bottomMost = absoluteBlocks.reduce((maxBottom, element) => {
    if (!(element instanceof HTMLElement)) {
      return maxBottom;
    }
    return Math.max(maxBottom, element.offsetTop + element.offsetHeight);
  }, 0);
  const rightMost = absoluteBlocks.reduce((maxRight, element) => {
    if (!(element instanceof HTMLElement)) {
      return maxRight;
    }
    return Math.max(maxRight, element.offsetLeft + element.offsetWidth);
  }, 0);

  const computedStyle = window.getComputedStyle(elements.publishedBody);
  const paddingBottom = Number.parseFloat(computedStyle.paddingBottom || "0") || 0;
  const paddingRight = Number.parseFloat(computedStyle.paddingRight || "0") || 0;
  if (bottomMost > 0) {
    elements.publishedBody.style.minHeight = `${Math.ceil(bottomMost + paddingBottom)}px`;
  }
  if (rightMost > 0) {
    elements.publishedBody.style.minWidth = `${Math.ceil(rightMost + paddingRight)}px`;
  }
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
    title: page.title || "Untitiled page",
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

function truncateLibraryTitle(title) {
  const normalizedTitle = String(title || "Untitiled page");
  return normalizedTitle.length > 25 ? `${normalizedTitle.slice(0, 25)}...` : normalizedTitle;
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
        <div class="page-item ${activeClass}">
          <div class="page-item-header">
            <button class="page-item-link" data-page-id="${page.id}" type="button">
              <svg class="page-item-icon" aria-hidden="true" viewBox="0 0 16 16" focusable="false">
                <path d="M3 1.5h6.8L13 4.7v9.8H3V1.5Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M9.8 1.5v3.2H13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
              <h3>${escapeHtml(truncateLibraryTitle(page.title))}</h3>
            </button>
          </div>
        </div>
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
  tabAreaEditorState.containerElement = null;
  clearObjectSelectionState();
  elements.pageTitleEditor.textContent = page.title || "Untitiled page";
  elements.bodyEditor.innerHTML = bodyBlocksToRenderedHtml(page.bodyBlocks || [makeTextBlock()], "editor");
  elements.deletePageButton.disabled = state.pages.length === 1;
  updateToolbarSelectionState();
}

function loadExampleContentIntoEditor() {
  clearObjectSelectionState();
  chartEditorState.chartElement = null;
  chartEditorState.originalChart = null;
  tabAreaEditorState.containerElement = null;
  renderChartEditorFlyout();
  renderTabAreaEditorFlyout();
  elements.pageTitleEditor.textContent = "Untitiled page";
  elements.bodyEditor.innerHTML = bodyBlocksToRenderedHtml(defaultExampleBodyBlocks(), "editor");
  updateToolbarSelectionState();
  renderSaveState("Unsaved");
}

function renderPublishedPage() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  elements.publishedTitle.textContent = page.title || "Untitiled page";
  elements.publishedBody.innerHTML = renderStoredBody(page.bodyBlocks || page.body);
  syncPublishedBodyLayout();
}

function renderRouteLinks() {
  const page = getActivePage();
  if (!page) {
    return;
  }

  const pageHash = `#/page/${encodeURIComponent(page.id)}`;
  const editHash = `#/edit/${encodeURIComponent(page.id)}`;

  elements.pageRouteLink.href = pageHash;
  elements.topEditRouteLink.href = editHash;
  elements.editRouteLink.href = editHash;
  elements.pageRouteLink.hidden = state.routeMode === "page";
  elements.topEditRouteLink.hidden = state.routeMode !== "page";
  elements.editRouteLink.hidden = state.routeMode === "workspace-edit";
}

function renderAll() {
  applyUiSettingsToDocument();
  applyRoute();
  ensureActivePage();
  renderSidebarMinimizedState();
  renderTabAreaDrawState();
  renderPageList();
  renderEditor();
  renderChartEditorFlyout();
  renderTabAreaEditorFlyout();
  renderSettingsModal();
  renderPublishedPage();
  renderRouteLinks();
  renderPageCount();
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
  const title = (elements.pageTitleEditor.textContent || "").replaceAll("\u200B", "").trim() || "Untitiled page";
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
    id: uniqueIdFromTitle("Untitiled page"),
    title: "Untitiled page",
    category: "Reference",
    tags: ["new"],
    summary: "Describe what this page covers.",
    body: "<p>Start writing here.</p>"
  });

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

  state.pages.unshift(page);
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  setRoute("workspace-edit", page.id);
  renderAll();
}

async function deletePageById(pageId) {
  if (state.pages.length === 1) {
    return;
  }

  const deletingActivePage = pageId === state.activePageId;
  const nextRouteMode = state.routeMode === "page" ? "page" : "workspace-edit";
  state.pages = state.pages.filter((page) => page.id !== pageId);

  if (deletingActivePage) {
    state.activePageId = state.pages[0].id;
  }

  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Deleted");

  if (deletingActivePage) {
    setRoute(nextRouteMode, state.activePageId);
    renderAll();
    return;
  }

  renderPageList();
  renderPageCount();
}

async function deleteActivePage() {
  await deletePageById(state.activePageId);
}

function activePageHasUnsavedChanges() {
  const active = getActivePage();
  if (!active) {
    return false;
  }

  const currentTitle = (elements.pageTitleEditor.textContent || "").replaceAll("\u200B", "").trim() || "Untitiled page";
  return active.title !== currentTitle || active.body !== bodyBlocksToStorageHtml(editorBodyBlocks());
}

async function saveActivePageDraft() {
  const active = getActivePage();
  if (!active) {
    return null;
  }

  if (!activePageHasUnsavedChanges()) {
    return active;
  }

  const page = buildPageFromForm(active?.id);
  const index = state.pages.findIndex((entry) => entry.id === active.id);
  state.pages[index] = { ...active, ...page };
  state.activePageId = page.id;
  saveLocalPages();
  state.lastSavedAt = new Date();
  renderSaveState("Saved");
  return page;
}

async function updateActivePageFromForm() {
  const page = await saveActivePageDraft();
  if (!page) {
    return null;
  }

  setRoute(state.routeMode === "page" ? "page" : "workspace-edit", page.id);
  renderAll();
  return page;
}

function handleLiveEdit() {
  if (activePageHasUnsavedChanges()) {
    renderSaveState("Unsaved");
  }
}

function renderChartEditorFlyout() {
  elements.chartEditorFlyout.hidden = !chartEditorState.chartElement;
}

function closeTabAreaColorPopup() {
  const shouldRestoreSavedView = tabAreaColorPickerState.open;
  tabAreaColorPickerState.open = false;
  tabAreaColorPickerState.target = null;
  tabAreaColorPickerState.draggingSpectrum = false;
  elements.tabAreaColorPopup.hidden = true;
  if (shouldRestoreSavedView && tabAreaEditorState.containerElement instanceof HTMLElement && tabAreaEditorState.containerElement.isConnected) {
    const data = tabbedContainerElementData(tabAreaEditorState.containerElement);
    if (data) {
      renderTabAreaGradientStops(data);
      elements.tabAreaFillSwatch.style.background = tabAreaFillValue(data);
    }
  }
}

function ensureTabAreaGradientDraft(data) {
  if (!data) {
    return null;
  }

  if (!tabAreaGradientEditorState.originalData) {
    tabAreaGradientEditorState.originalData = normalizeTabbedContainerData(data);
  }

  if (!tabAreaGradientEditorState.draftData) {
    tabAreaGradientEditorState.draftData = normalizeTabbedContainerData(data);
  }

  return tabAreaGradientEditorState.draftData;
}

function clearTabAreaGradientDraft() {
  tabAreaGradientEditorState.originalData = null;
  tabAreaGradientEditorState.draftData = null;
}

function ensureTabAreaFillDraft(data) {
  if (!data) {
    return null;
  }

  if (!tabAreaFillEditorState.originalData) {
    tabAreaFillEditorState.originalData = normalizeTabbedContainerData(data);
  }

  if (!tabAreaFillEditorState.draftData) {
    tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  }

  return tabAreaFillEditorState.draftData;
}

function clearTabAreaFillDraft() {
  tabAreaFillEditorState.originalData = null;
  tabAreaFillEditorState.draftData = null;
  clearTabAreaGradientDraft();
}

function applyTabAreaPreviewToContainer(data) {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected || !data) {
    return;
  }

  setTabbedContainerData(tabAreaEditorState.containerElement, normalizeTabbedContainerData(data), "editor");
}

function previewTabbedContainerData() {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    return null;
  }

  let data = tabAreaFillEditorState.draftData
    ? normalizeTabbedContainerData(tabAreaFillEditorState.draftData)
    : tabbedContainerElementData(tabAreaEditorState.containerElement);
  if (!data) {
    return null;
  }

  if (!tabAreaColorPickerState.open || !tabAreaColorPickerState.target) {
    return data;
  }

  const previewColor = normalizeHexColor(tabAreaColorPickerState.draftColor, "#ffffff");
  if (tabAreaColorPickerState.target.type === "solid") {
    return {
      ...data,
      fillColor: previewColor
    };
  }

  if (tabAreaColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(
      tabAreaColorPickerState.target.index,
      0,
      Math.max(0, data.gradientStops.length - 1),
      0
    );
    const gradientStops = data.gradientStops.map((stop, index) => (
      index === stopIndex ? { ...stop, color: previewColor } : stop
    ));
    return {
      ...data,
      gradientStops: normalizeTabAreaGradientStops(gradientStops, data.fillColor, "#e9eef7")
    };
  }

  return data;
}

function renderTabAreaColorPopup() {
  elements.tabAreaColorPopup.hidden = !tabAreaColorPickerState.open;
  if (!tabAreaColorPickerState.open) {
    return;
  }

  const color = normalizeHexColor(tabAreaColorPickerState.draftColor, "#ffffff");
  const { r, g, b } = hexToRgb(color);
  elements.tabAreaColorSpectrum.style.background = `hsl(${tabAreaColorPickerState.hue} 100% 50%)`;
  elements.tabAreaColorSpectrumHandle.style.left = `${tabAreaColorPickerState.saturation}%`;
  elements.tabAreaColorSpectrumHandle.style.top = `${100 - tabAreaColorPickerState.value}%`;
  elements.tabAreaColorHueInput.value = String(tabAreaColorPickerState.hue);
  elements.tabAreaColorRInput.value = r;
  elements.tabAreaColorGInput.value = g;
  elements.tabAreaColorBInput.value = b;
  elements.tabAreaColorEyedropperButton.disabled = !window.EyeDropper;

  const previewData = previewTabbedContainerData();
  if (previewData) {
    applyTabAreaPreviewToContainer(previewData);
    elements.tabAreaFillSwatch.style.background = tabAreaFillValue(previewData);
    elements.tabAreaGradientPreview.style.background = tabAreaFillValue({
      ...previewData,
      fillMode: "gradient"
    });
    if (previewData.fillMode === "gradient") {
      renderTabAreaGradientStops(previewData);
    }
  }
}

function commitOpenColorPreviewToDraft() {
  if (!tabAreaColorPickerState.open || !tabAreaColorPickerState.target) {
    return;
  }

  const data = ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement));
  if (!data) {
    return;
  }

  const nextColor = normalizeHexColor(tabAreaColorPickerState.draftColor, tabAreaColorPickerState.originalColor);
  if (tabAreaColorPickerState.target.type === "solid") {
    data.fillColor = nextColor;
    elements.tabAreaFillInput.value = nextColor;
  }

  if (tabAreaColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(
      tabAreaColorPickerState.target.index,
      0,
      Math.max(0, data.gradientStops.length - 1),
      0
    );
    if (data.gradientStops[stopIndex]) {
      data.gradientStops[stopIndex].color = nextColor;
      data.gradientStops = normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
    }
  }

  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
}

function openTabAreaColorPopup(target, color) {
  commitOpenColorPreviewToDraft();
  tabAreaColorPickerState.open = true;
  tabAreaColorPickerState.target = target;
  tabAreaColorPickerState.originalColor = normalizeHexColor(color, "#ffffff");
  tabAreaColorPickerState.draftColor = normalizeHexColor(color, "#ffffff");
  const rgb = hexToRgb(tabAreaColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  tabAreaColorPickerState.hue = hsv.h;
  tabAreaColorPickerState.saturation = hsv.s;
  tabAreaColorPickerState.value = hsv.v;
  renderTabAreaColorPopup();
}

function updateTabAreaColorDraftFromInputs() {
  if (!tabAreaColorPickerState.open) {
    return;
  }

  tabAreaColorPickerState.draftColor = rgbToHex(
    elements.tabAreaColorRInput.value,
    elements.tabAreaColorGInput.value,
    elements.tabAreaColorBInput.value
  );
  const rgb = hexToRgb(tabAreaColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  tabAreaColorPickerState.hue = hsv.h;
  tabAreaColorPickerState.saturation = hsv.s;
  tabAreaColorPickerState.value = hsv.v;
  renderTabAreaColorPopup();
}

function updateTabAreaColorDraftFromHsv() {
  const rgb = hsvToRgb(
    tabAreaColorPickerState.hue,
    tabAreaColorPickerState.saturation,
    tabAreaColorPickerState.value
  );
  tabAreaColorPickerState.draftColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  renderTabAreaColorPopup();
}

function updateTabAreaSpectrumFromPointer(clientX, clientY) {
  if (!tabAreaColorPickerState.open) {
    return;
  }

  const rect = elements.tabAreaColorSpectrum.getBoundingClientRect();
  const relativeX = ((clientX - rect.left) / rect.width) * 100;
  const relativeY = ((clientY - rect.top) / rect.height) * 100;
  tabAreaColorPickerState.saturation = clampNumber(relativeX, 0, 100, tabAreaColorPickerState.saturation);
  tabAreaColorPickerState.value = 100 - clampNumber(relativeY, 0, 100, 100 - tabAreaColorPickerState.value);
  updateTabAreaColorDraftFromHsv();
}

function beginTabAreaSpectrumDrag(event) {
  tabAreaColorPickerState.draggingSpectrum = true;
  updateTabAreaSpectrumFromPointer(event.clientX, event.clientY);
}

function updateTabAreaHue() {
  if (!tabAreaColorPickerState.open) {
    return;
  }

  tabAreaColorPickerState.hue = clampNumber(elements.tabAreaColorHueInput.value, 0, 360, tabAreaColorPickerState.hue);
  updateTabAreaColorDraftFromHsv();
}

function syncTabAreaColorFromHex(color) {
  tabAreaColorPickerState.draftColor = normalizeHexColor(color, tabAreaColorPickerState.draftColor);
  const rgb = hexToRgb(tabAreaColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  tabAreaColorPickerState.hue = hsv.h;
  tabAreaColorPickerState.saturation = hsv.s;
  tabAreaColorPickerState.value = hsv.v;
  renderTabAreaColorPopup();
}

async function pickTabAreaColorWithEyedropper() {
  if (!window.EyeDropper || !tabAreaColorPickerState.open) {
    return;
  }

  try {
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open();
    syncTabAreaColorFromHex(result?.sRGBHex);
  } catch {
    // Ignore cancelled eyedropper sessions.
  }
}

function applyTabAreaColorPopup() {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    closeTabAreaColorPopup();
    return;
  }

  const data = ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement));
  if (!data || !tabAreaColorPickerState.target) {
    closeTabAreaColorPopup();
    return;
  }

  const nextColor = normalizeHexColor(tabAreaColorPickerState.draftColor, tabAreaColorPickerState.originalColor);

  if (tabAreaColorPickerState.target.type === "solid") {
    data.fillColor = nextColor;
    elements.tabAreaFillInput.value = nextColor;
  }

  if (tabAreaColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(
      tabAreaColorPickerState.target.index,
      0,
      Math.max(0, data.gradientStops.length - 1),
      0
    );
    if (data.gradientStops[stopIndex]) {
      data.gradientStops[stopIndex].color = nextColor;
      data.gradientStops = normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
    }
  }

  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  closeTabAreaColorPopup();
  renderTabAreaEditorFlyout();
}

function closeTabAreaFillPanel({ restoreOriginal = true } = {}) {
  if (restoreOriginal && tabAreaFillEditorState.originalData) {
    applyTabAreaPreviewToContainer(tabAreaFillEditorState.originalData);
  }
  elements.tabAreaFillPanel.hidden = true;
  elements.tabAreaFillButton.setAttribute("aria-expanded", "false");
  closeTabAreaColorPopup();
  clearTabAreaFillDraft();
}

function openTabAreaFillPanel() {
  const data = tabbedContainerElementData(tabAreaEditorState.containerElement);
  if (data) {
    ensureTabAreaFillDraft(data);
    if (selectedTabAreaFillMode() === "gradient") {
      ensureTabAreaGradientDraft(tabAreaFillEditorState.draftData);
      const gradientData = tabAreaFillEditorState.draftData || data;
      const targetIndex = tabAreaColorPickerState.target?.type === "gradient-stop"
        ? clampNumber(tabAreaColorPickerState.target.index, 0, Math.max(0, gradientData.gradientStops.length - 1), 0)
        : 0;
      const selectedStop = gradientData.gradientStops[targetIndex] || gradientData.gradientStops[0];
      if (selectedStop) {
        openTabAreaColorPopup({ type: "gradient-stop", index: targetIndex }, selectedStop.color);
      }
    } else {
      openTabAreaColorPopup({ type: "solid" }, tabAreaFillEditorState.draftData?.fillColor || data.fillColor);
    }
  }
  elements.tabAreaFillPanel.hidden = false;
  elements.tabAreaFillButton.setAttribute("aria-expanded", "true");
}

function toggleTabAreaFillPanel() {
  if (elements.tabAreaFillPanel.hidden) {
    openTabAreaFillPanel();
    return;
  }

  closeTabAreaFillPanel();
}

function renderTabAreaEditorFlyout() {
  elements.tabAreaEditorFlyout.hidden = !tabAreaEditorState.containerElement;

  if (!tabAreaEditorState.containerElement) {
    elements.tabAreaGradientStops.innerHTML = "";
    closeTabAreaFillPanel();
    return;
  }

  const data = previewTabbedContainerData();
  if (!data) {
    return;
  }

  if (data.fillMode === "gradient") {
    const targetIndex = tabAreaColorPickerState.target?.type === "gradient-stop"
      ? clampNumber(tabAreaColorPickerState.target.index, 0, Math.max(0, data.gradientStops.length - 1), 0)
      : 0;
    const selectedStop = data.gradientStops[targetIndex] || data.gradientStops[0];
    if (
      selectedStop
      && (!tabAreaColorPickerState.open
        || tabAreaColorPickerState.target?.type !== "gradient-stop"
        || tabAreaColorPickerState.target.index !== targetIndex)
    ) {
      openTabAreaColorPopup({ type: "gradient-stop", index: targetIndex }, selectedStop.color);
    }
  }

  elements.tabAreaFillInput.value = data.fillColor;
  elements.tabAreaFillSwatch.style.background = tabAreaFillValue(data);
  elements.tabAreaFillOpacityField.hidden = false;
  elements.tabAreaFillOpacityInput.value = String(Math.round(data.fillOpacity * 100));
  setOpacityDisplay(elements.tabAreaFillOpacityValue, elements.tabAreaFillOpacityInput.value);
  elements.tabAreaTitleInput.value = data.title || "";
  elements.tabAreaGradientPreview.style.background = tabAreaFillValue({
    ...data,
    fillMode: "gradient"
  });
  elements.tabAreaColorPopup.hidden = data.fillMode === "gradient"
    ? false
    : !tabAreaColorPickerState.open;
  elements.tabAreaFillSolidPanel.hidden = data.fillMode !== "solid";
  elements.tabAreaFillGradientPanel.hidden = data.fillMode !== "gradient";
  elements.tabAreaGradientTypeInput.value = data.fillGradientType;
  elements.tabAreaGradientDirectionField.hidden = data.fillGradientType === "radial";
  elements.tabAreaGradientDirectionInput.value = data.fillGradientDirection;
  [...elements.tabAreaFillModeInputs].forEach((input) => {
    input.checked = input.value === data.fillMode;
  });
  renderTabAreaGradientStops(data);
  elements.tabAreaRadiusInput.value = data.borderRadius;
  elements.tabAreaHideHeaderInput.checked = data.hideHeaderInDirectView;
  elements.tabAreaHideBorderInput.checked = data.hideBorderInDirectView;
}

function openTabAreaEditor(containerElement) {
  if (!(containerElement instanceof HTMLElement)) {
    return;
  }

  closeShapeEditor();
  tabAreaEditorState.containerElement = containerElement;
  renderTabAreaEditorFlyout();
}

function closeTabAreaEditor() {
  tabAreaEditorState.containerElement = null;
  tabAreaGradientEditorState.draggingStopIndex = null;
  clearTabAreaGradientDraft();
  closeTabAreaFillPanel();
  renderTabAreaEditorFlyout();
}

function shapePaintTargetField(baseName) {
  return shapePaintEditorState.target === "outline" ? `outline${baseName}` : `fill${baseName}`;
}

function shapePaintTargetOpacityField() {
  return shapePaintEditorState.target === "outline" ? "outlineOpacity" : "fillOpacity";
}

function shapePaintTargetGradientTypeField() {
  return shapePaintEditorState.target === "outline" ? "outlineGradientType" : "fillGradientType";
}

function shapePaintTargetGradientDirectionField() {
  return shapePaintEditorState.target === "outline" ? "outlineGradientDirection" : "fillGradientDirection";
}

function ensureShapePaintDraft(data) {
  if (!data) {
    return null;
  }

  if (!shapePaintEditorState.originalData) {
    shapePaintEditorState.originalData = normalizeShapeData(data);
  }

  if (!shapePaintEditorState.draftData) {
    shapePaintEditorState.draftData = normalizeShapeData(data);
  }

  return shapePaintEditorState.draftData;
}

function clearShapePaintDraft() {
  shapePaintEditorState.draggingStopIndex = null;
  shapePaintEditorState.originalData = null;
  shapePaintEditorState.draftData = null;
}

function applyShapePreviewToElement(data) {
  if (!(shapeEditorState.shapeElement instanceof HTMLElement) || !shapeEditorState.shapeElement.isConnected || !data) {
    return;
  }

  setShapeElementData(shapeEditorState.shapeElement, data);
  const containerElement = shapeEditorState.shapeElement.closest(`.${TABBED_CONTAINER_CLASS}`);
  if (containerElement instanceof HTMLElement) {
    syncTabbedContainerActiveContent(containerElement);
  }
  handleLiveEdit();
}

function closeShapePaintColorPopup() {
  shapePaintColorPickerState.open = false;
  shapePaintColorPickerState.target = null;
  shapePaintColorPickerState.draggingSpectrum = false;
  elements.shapePaintColorPopup.hidden = true;
}

function clearShapeGradientStopSelection() {
  if (shapePaintColorPickerState.target?.type !== "gradient-stop" && shapePaintEditorState.draggingStopIndex == null) {
    return;
  }

  commitOpenShapeColorPreviewToDraft();
  shapePaintEditorState.draggingStopIndex = null;
  closeShapePaintColorPopup();
  renderShapeEditorFlyout();
}

function previewShapeData() {
  if (!(shapeEditorState.shapeElement instanceof HTMLElement) || !shapeEditorState.shapeElement.isConnected) {
    return null;
  }

  const data = shapePaintEditorState.draftData
    ? normalizeShapeData(shapePaintEditorState.draftData)
    : shapeElementData(shapeEditorState.shapeElement);
  if (!data) {
    return null;
  }

  if (!shapePaintColorPickerState.open || !shapePaintColorPickerState.target) {
    return data;
  }

  const previewColor = normalizeHexColor(shapePaintColorPickerState.draftColor, "#ffffff");
  const colorField = shapePaintTargetField("Color");
  const stopsField = shapePaintTargetField("GradientStops");

  if (shapePaintColorPickerState.target.type === "solid") {
    return {
      ...data,
      [colorField]: previewColor
    };
  }

  if (shapePaintColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(
      shapePaintColorPickerState.target.index,
      0,
      Math.max(0, data[stopsField].length - 1),
      0
    );
    return {
      ...data,
      [stopsField]: normalizeTabAreaGradientStops(
        data[stopsField].map((stop, index) => (index === stopIndex ? { ...stop, color: previewColor } : stop)),
        data[colorField],
        data[stopsField][data[stopsField].length - 1]?.color || data[colorField]
      )
    };
  }

  return data;
}

function renderShapePaintStops(data) {
  const stopsField = shapePaintTargetField("GradientStops");
  const colorField = shapePaintTargetField("Color");
  const selectedStopIndex = shapePaintColorPickerState.target?.type === "gradient-stop"
    ? clampNumber(shapePaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0)
    : null;

  elements.shapePaintRemoveStopButton.hidden = selectedStopIndex == null;
  elements.shapePaintRemoveStopButton.disabled = data[stopsField].length <= 2;
  if (selectedStopIndex != null) {
    elements.shapePaintRemoveStopButton.setAttribute("data-stop-index", String(selectedStopIndex));
  } else {
    elements.shapePaintRemoveStopButton.removeAttribute("data-stop-index");
  }

  elements.shapePaintGradientStops.innerHTML = `
    <div class="tab-area-gradient-stop-slider" style="background:${shapePaintValue("gradient", data[colorField], data[stopsField])}">
      ${data[stopsField].map((stop, index) => `
        <button
          class="tab-area-gradient-stop-thumb${selectedStopIndex === index ? " is-selected" : ""}"
          type="button"
          data-shape-stop-drag="${index}"
          data-shape-stop-color="${escapeHtml(stop.color)}"
          style="left:${stop.offset}%"
          aria-label="Gradient stop ${index + 1} at ${stop.offset}%"
        >
          <span class="tab-area-gradient-stop-thumb-inner" style="background:${stop.color}" aria-hidden="true"></span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderShapePaintColorPopup() {
  elements.shapePaintColorPopup.hidden = !shapePaintColorPickerState.open;
  if (!shapePaintColorPickerState.open) {
    return;
  }

  const color = normalizeHexColor(shapePaintColorPickerState.draftColor, "#ffffff");
  const { r, g, b } = hexToRgb(color);
  elements.shapePaintColorSpectrum.style.background = `hsl(${shapePaintColorPickerState.hue} 100% 50%)`;
  elements.shapePaintColorSpectrumHandle.style.left = `${shapePaintColorPickerState.saturation}%`;
  elements.shapePaintColorSpectrumHandle.style.top = `${100 - shapePaintColorPickerState.value}%`;
  elements.shapePaintColorHueInput.value = String(shapePaintColorPickerState.hue);
  elements.shapePaintColorRInput.value = r;
  elements.shapePaintColorGInput.value = g;
  elements.shapePaintColorBInput.value = b;
  elements.shapePaintColorEyedropperButton.disabled = !window.EyeDropper;

  const previewData = previewShapeData();
  if (previewData) {
    applyShapePreviewToElement(previewData);
    elements.shapeFillSwatch.style.background = shapePaintValue(previewData.fillMode, previewData.fillColor, previewData.fillGradientStops);
    elements.shapeOutlineSwatch.style.background = shapePaintValue(previewData.outlineMode, previewData.outlineColor, previewData.outlineGradientStops);
    const stopsField = shapePaintTargetField("GradientStops");
    const colorField = shapePaintTargetField("Color");
    elements.shapePaintGradientPreview.style.background = shapePaintValue("gradient", previewData[colorField], previewData[stopsField]);
    if ([...elements.shapePaintModeInputs].find((input) => input.checked)?.value === "gradient") {
      renderShapePaintStops(previewData);
    }
  }
}

function commitOpenShapeColorPreviewToDraft() {
  if (!shapePaintColorPickerState.open || !shapePaintColorPickerState.target) {
    return;
  }

  const colorField = shapePaintTargetField("Color");
  const stopsField = shapePaintTargetField("GradientStops");
  const data = ensureShapePaintDraft(shapeElementData(shapeEditorState.shapeElement));
  if (!data) {
    return;
  }

  const nextColor = normalizeHexColor(shapePaintColorPickerState.draftColor, shapePaintColorPickerState.originalColor);
  if (shapePaintColorPickerState.target.type === "solid") {
    data[colorField] = nextColor;
  }

  if (shapePaintColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(shapePaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0);
    if (data[stopsField][stopIndex]) {
      data[stopsField][stopIndex].color = nextColor;
      data[stopsField] = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    }
  }

  shapePaintEditorState.draftData = normalizeShapeData(data);
}

function renderShapeEditorFlyout() {
  elements.shapeEditorFlyout.hidden = !shapeEditorState.shapeElement;

  if (!shapeEditorState.shapeElement) {
    elements.shapePaintGradientStops.innerHTML = "";
    elements.shapeLinkPageList.innerHTML = "";
    elements.shapeLinkPageList.hidden = true;
    elements.shapeLinkPageButton.setAttribute("aria-expanded", "false");
    elements.shapeLinkTabButton.setAttribute("aria-expanded", "false");
    elements.shapeEditorTitle.textContent = "Edit shape";
    elements.shapeEditorSubtitle.textContent = "Shape settings";
    elements.shapePaintTargetLabel.textContent = "Fill";
    elements.shapePaintTargetNote.textContent = "Edit the selected shape fill.";
    closeShapePaintPanel({ restoreOriginal: false });
    return;
  }

  const data = previewShapeData() || shapeElementData(shapeEditorState.shapeElement);
  if (!data) {
    return;
  }

  const shapeLabel = shapeTypeLabel(data.type);
  elements.shapeEditorTitle.textContent = `Edit ${shapeLabel.toLowerCase()}`;
  elements.shapeEditorSubtitle.textContent = `${shapeLabel} settings`;
  elements.shapeOutlineWeightInput.value = String(data.outlineWeight);
  elements.shapeLinkInput.value = data.linkPage;
  elements.shapePaintOpacityField.hidden = false;
  elements.shapePaintOpacityInput.value = String(Math.round(data[shapePaintTargetOpacityField()] * 100));
  setOpacityDisplay(elements.shapePaintOpacityValue, elements.shapePaintOpacityInput.value);
  elements.shapeLinkPageButton.setAttribute("aria-expanded", shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "page" ? "true" : "false");
  elements.shapeLinkTabButton.setAttribute("aria-expanded", shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "tab" ? "true" : "false");
  elements.shapeLinkPageList.hidden = !shapeEditorState.pageListOpen;
  if (shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "page") {
    elements.shapeLinkPageList.innerHTML = state.pages.map((page) => `
      <button class="button button-secondary shape-link-page-item" type="button" data-shape-link-page="${escapeHtml(page.id)}">${escapeHtml(page.title || page.id)}</button>
    `).join("") || `<div class="field-note">No pages available.</div>`;
  } else if (shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "tab") {
    const tabTargets = Array.from(elements.bodyEditor.querySelectorAll(`.${TABBED_CONTAINER_CLASS}`)).flatMap((containerElement) => {
      if (!(containerElement instanceof HTMLElement)) {
        return [];
      }
      const container = tabbedContainerElementData(containerElement);
      if (!container) {
        return [];
      }
      const containerLabel = container.title || "Untitled tab area";
      return container.tabs.map((tab) => ({
        containerId: container.id,
        tabId: tab.id,
        label: `${containerLabel} / ${tab.label}`
      }));
    });
    elements.shapeLinkPageList.innerHTML = tabTargets.map((target) => `
      <button class="button button-secondary shape-link-page-item" type="button" data-shape-link-tab="${escapeHtml(target.containerId)}" data-shape-link-tab-id="${escapeHtml(target.tabId)}">${escapeHtml(target.label)}</button>
    `).join("") || `<div class="field-note">No tab areas available.</div>`;
  } else {
    elements.shapeLinkPageList.innerHTML = "";
  }
  elements.shapeFillSwatch.style.background = shapePaintValue(data.fillMode, data.fillColor, data.fillGradientStops);
  elements.shapeOutlineSwatch.style.background = shapePaintValue(data.outlineMode, data.outlineColor, data.outlineGradientStops);
  if (!elements.shapePaintPanel.hidden) {
    const modeField = shapePaintTargetField("Mode");
    const stopsField = shapePaintTargetField("GradientStops");
    const colorField = shapePaintTargetField("Color");
    const targetLabel = shapePaintEditorState.target === "outline" ? "Outline" : "Fill";
    const mode = data[modeField];
    elements.shapePaintTargetLabel.textContent = targetLabel;
    elements.shapePaintTargetNote.textContent = `Edit the selected shape ${targetLabel.toLowerCase()}.`;
    [...elements.shapePaintModeInputs].forEach((input) => {
      input.checked = input.value === mode;
    });
    elements.shapePaintSolidPanel.hidden = mode !== "solid";
    elements.shapePaintGradientPanel.hidden = mode !== "gradient";
    elements.shapePaintGradientPreview.style.background = shapePaintValue("gradient", data[colorField], data[stopsField]);
    renderShapePaintStops(data);
    renderShapePaintColorPopup();
  }
}

function openShapeEditor(shapeElement) {
  if (!(shapeElement instanceof HTMLElement)) {
    return;
  }

  closeChartEditor({ revert: false });
  closeTabAreaEditor();
  selectShape(shapeElement);
  shapeEditorState.shapeElement = shapeElement;
  shapeEditorState.pageListOpen = false;
  shapeEditorState.linkPickerMode = null;
  clearShapePaintDraft();
  closeShapePaintPanel({ restoreOriginal: false });
  renderShapeEditorFlyout();
}

function focusShapeText(shapeElement) {
  const textElement = shapeElement?.querySelector?.(".editor-shape-text");
  if (!(textElement instanceof HTMLElement)) {
    return;
  }

  textElement.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(textElement);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function closeShapeEditor() {
  shapeEditorState.shapeElement = null;
  shapeEditorState.pageListOpen = false;
  shapeEditorState.linkPickerMode = null;
  clearShapePaintDraft();
  closeShapePaintPanel({ restoreOriginal: false });
  clearSelectedShape();
  renderShapeEditorFlyout();
}

function openShapePaintColorPopup(target, color) {
  shapePaintColorPickerState.open = true;
  shapePaintColorPickerState.target = target;
  shapePaintColorPickerState.originalColor = normalizeHexColor(color, "#ffffff");
  shapePaintColorPickerState.draftColor = normalizeHexColor(color, "#ffffff");
  const rgb = hexToRgb(shapePaintColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  shapePaintColorPickerState.hue = hsv.h;
  shapePaintColorPickerState.saturation = hsv.s;
  shapePaintColorPickerState.value = hsv.v;
  renderShapePaintColorPopup();
}

function selectedShapePaintMode() {
  return [...elements.shapePaintModeInputs].find((input) => input.checked)?.value === "gradient" ? "gradient" : "solid";
}

function openShapePaintPanel(target) {
  if (!(shapeEditorState.shapeElement instanceof HTMLElement) || !shapeEditorState.shapeElement.isConnected) {
    return;
  }

  commitOpenShapeColorPreviewToDraft();
  const data = ensureShapePaintDraft(shapeElementData(shapeEditorState.shapeElement));
  if (!data) {
    return;
  }

  shapePaintEditorState.target = target;
  const modeField = shapePaintTargetField("Mode");
  const colorField = shapePaintTargetField("Color");
  [...elements.shapePaintModeInputs].forEach((input) => {
    input.checked = input.value === data[modeField];
  });

  elements.shapePaintPanel.hidden = false;
  elements.shapeFillButton.setAttribute("aria-expanded", target === "fill" ? "true" : "false");
  elements.shapeOutlineButton.setAttribute("aria-expanded", target === "outline" ? "true" : "false");
  elements.shapePaintTargetLabel.textContent = target === "outline" ? "Outline" : "Fill";
  elements.shapePaintTargetNote.textContent = `Edit the selected shape ${target}.`;

  if (data[modeField] === "gradient") {
    closeShapePaintColorPopup();
  } else {
    openShapePaintColorPopup({ type: "solid" }, data[colorField]);
  }

  renderShapeEditorFlyout();
}

function closeShapePaintPanel({ restoreOriginal = true } = {}) {
  if (restoreOriginal && shapePaintEditorState.originalData) {
    applyShapePreviewToElement(shapePaintEditorState.originalData);
  }

  elements.shapePaintPanel.hidden = true;
  elements.shapeFillButton.setAttribute("aria-expanded", "false");
  elements.shapeOutlineButton.setAttribute("aria-expanded", "false");
  closeShapePaintColorPopup();
  clearShapePaintDraft();
}

function updateShapeFromFlyout() {
  if (!(shapeEditorState.shapeElement instanceof HTMLElement) || !shapeEditorState.shapeElement.isConnected) {
    closeShapeEditor();
    return;
  }

  const data = shapeElementData(shapeEditorState.shapeElement);
  if (!data) {
    return;
  }

  data.outlineWeight = clampNumber(elements.shapeOutlineWeightInput.value, 0, 24, data.outlineWeight);
  data.linkPage = elements.shapeLinkInput.value.trim();
  setShapeElementData(shapeEditorState.shapeElement, data);
  handleLiveEdit();
  renderShapeEditorFlyout();
}

function updateShapeOpacityFromFlyout() {
  if (!(shapeEditorState.shapeElement instanceof HTMLElement) || !shapeEditorState.shapeElement.isConnected) {
    closeShapeEditor();
    return;
  }

  updateShapePaintData((data) => {
    const opacityField = shapePaintTargetOpacityField();
    data[opacityField] = clampNumber(elements.shapePaintOpacityInput.value, 0, 100, Math.round(data[opacityField] * 100)) / 100;
  });
  setOpacityDisplay(elements.shapePaintOpacityValue, elements.shapePaintOpacityInput.value);
}

function updateShapePaintData(mutator) {
  const data = ensureShapePaintDraft(shapeElementData(shapeEditorState.shapeElement));
  if (!data) {
    return;
  }

  mutator(data);
  shapePaintEditorState.draftData = normalizeShapeData(data);
  applyShapePreviewToElement(shapePaintEditorState.draftData);
  renderShapeEditorFlyout();
}

function currentLibrarySelectionStyle() {
  return normalizeLibrarySelectionStyle(state.uiSettings?.librarySelection);
}

function libraryPaintTargetField(baseName) {
  return libraryPaintEditorState.target === "outline" ? `outline${baseName}` : `fill${baseName}`;
}

function libraryPaintTargetOpacityField() {
  return libraryPaintEditorState.target === "outline" ? "outlineOpacity" : "fillOpacity";
}

function libraryPaintTargetGradientTypeField() {
  return libraryPaintEditorState.target === "outline" ? "outlineGradientType" : "fillGradientType";
}

function libraryPaintTargetGradientDirectionField() {
  return libraryPaintEditorState.target === "outline" ? "outlineGradientDirection" : "fillGradientDirection";
}

function ensureLibraryPaintDraft(data = currentLibrarySelectionStyle()) {
  if (!libraryPaintEditorState.originalData) {
    libraryPaintEditorState.originalData = normalizeLibrarySelectionStyle(data);
  }
  if (!libraryPaintEditorState.draftData) {
    libraryPaintEditorState.draftData = normalizeLibrarySelectionStyle(data);
  }
  return libraryPaintEditorState.draftData;
}

function clearLibraryPaintDraft() {
  libraryPaintEditorState.draggingStopIndex = null;
  libraryPaintEditorState.originalData = null;
  libraryPaintEditorState.draftData = null;
}

function applyLibrarySelectionPreview(style) {
  const nextStyle = normalizeLibrarySelectionStyle(style);
  document.documentElement.style.setProperty(
    "--library-page-active-fill",
    paintCssValue(nextStyle.fillMode, nextStyle.fillColor, nextStyle.fillGradientStops, nextStyle.fillOpacity, nextStyle.fillGradientType, nextStyle.fillGradientDirection)
  );
  document.documentElement.style.setProperty(
    "--library-page-active-outline",
    paintBorderCssValue(nextStyle.outlineMode, nextStyle.outlineColor, nextStyle.outlineGradientStops, nextStyle.outlineOpacity, nextStyle.outlineGradientType, nextStyle.outlineGradientDirection)
  );
  document.documentElement.style.setProperty("--library-page-active-outline-width", `${nextStyle.outlineWeight}px`);
}

function closeLibraryPaintColorPopup({ force = false } = {}) {
  if (
    !force
    && !elements.libraryPaintPanel.hidden
    && selectedLibraryPaintMode() === "gradient"
    && libraryPaintEditorState.target
  ) {
    const data = previewLibrarySelectionStyle();
    if (ensureLibraryPaintGradientStopSelection(data)) {
      renderLibraryPaintColorPopup();
      return;
    }
  }
  libraryPaintColorPickerState.open = false;
  libraryPaintColorPickerState.target = null;
  libraryPaintColorPickerState.draggingSpectrum = false;
  elements.libraryPaintColorPopup.hidden = true;
}

function previewLibrarySelectionStyle() {
  const data = libraryPaintEditorState.draftData
    ? normalizeLibrarySelectionStyle(libraryPaintEditorState.draftData)
    : currentLibrarySelectionStyle();

  if (!libraryPaintColorPickerState.open || !libraryPaintColorPickerState.target) {
    return data;
  }

  const previewColor = normalizeHexColor(libraryPaintColorPickerState.draftColor, "#ffffff");
  const colorField = libraryPaintTargetField("Color");
  const stopsField = libraryPaintTargetField("GradientStops");

  if (libraryPaintColorPickerState.target.type === "solid") {
    return { ...data, [colorField]: previewColor };
  }

  if (libraryPaintColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(libraryPaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0);
    return {
      ...data,
      [stopsField]: normalizeTabAreaGradientStops(
        data[stopsField].map((stop, index) => (index === stopIndex ? { ...stop, color: previewColor } : stop)),
        data[colorField],
        data[colorField]
      )
    };
  }

  return data;
}

function renderLibraryPaintStops(data) {
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  const selectedStopIndex = libraryPaintColorPickerState.target?.type === "gradient-stop"
    ? clampNumber(libraryPaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0)
    : null;

  elements.libraryPaintRemoveStopButton.hidden = selectedStopIndex == null;
  elements.libraryPaintRemoveStopButton.disabled = data[stopsField].length <= 2;
  if (selectedStopIndex != null) {
    elements.libraryPaintRemoveStopButton.setAttribute("data-stop-index", String(selectedStopIndex));
  } else {
    elements.libraryPaintRemoveStopButton.removeAttribute("data-stop-index");
  }

  elements.libraryPaintGradientStops.innerHTML = `
    <div class="tab-area-gradient-stop-slider" style="background:${gradientStopSliderValue(data[colorField], data[stopsField], data[libraryPaintTargetOpacityField()])}">
      ${data[stopsField].map((stop, index) => `
        <button
          class="tab-area-gradient-stop-thumb${selectedStopIndex === index ? " is-selected" : ""}${index === 0 || index === data[stopsField].length - 1 ? " is-default-stop" : ""}"
          type="button"
          data-library-stop-drag="${index}"
          data-library-stop-color="${escapeHtml(stop.color)}"
          style="left:${stop.offset}%"
          aria-label="Gradient stop ${index + 1} at ${stop.offset}%"
        >
          <span class="tab-area-gradient-stop-thumb-inner" style="background:${stop.color}" aria-hidden="true"></span>
        </button>
      `).join("")}
    </div>
  `;
}

function ensureLibraryPaintGradientStopSelection(data, { forceFirstStop = false } = {}) {
  const stopsField = libraryPaintTargetField("GradientStops");
  const stops = Array.isArray(data?.[stopsField]) ? data[stopsField] : [];
  if (!stops.length) {
    closeLibraryPaintColorPopup();
    return false;
  }

  const currentIndex = libraryPaintColorPickerState.target?.type === "gradient-stop"
    ? clampNumber(libraryPaintColorPickerState.target.index, 0, Math.max(0, stops.length - 1), 0)
    : 0;
  const nextIndex = forceFirstStop ? 0 : currentIndex;
  const nextStop = stops[nextIndex] || stops[0];
  if (!nextStop) {
    closeLibraryPaintColorPopup();
    return false;
  }

  const shouldResetPicker = forceFirstStop
    || !libraryPaintColorPickerState.open
    || libraryPaintColorPickerState.target?.type !== "gradient-stop";

  libraryPaintColorPickerState.open = true;
  libraryPaintColorPickerState.target = { type: "gradient-stop", index: nextIndex };

  if (shouldResetPicker) {
    const nextColor = normalizeHexColor(nextStop.color, "#ffffff");
    libraryPaintColorPickerState.originalColor = nextColor;
    libraryPaintColorPickerState.draftColor = nextColor;
    const rgb = hexToRgb(nextColor);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    libraryPaintColorPickerState.hue = hsv.h;
    libraryPaintColorPickerState.saturation = hsv.s;
    libraryPaintColorPickerState.value = hsv.v;
  }

  return true;
}

function renderLibraryPaintColorPopup() {
  const gradientModeActive = selectedLibraryPaintMode() === "gradient";
  if (gradientModeActive) {
    const previewData = previewLibrarySelectionStyle();
    if (!ensureLibraryPaintGradientStopSelection(previewData)) {
      elements.libraryPaintColorPopup.hidden = true;
      return;
    }
  }

  const shouldShow = gradientModeActive || libraryPaintColorPickerState.open;
  elements.libraryPaintColorPopup.hidden = !shouldShow;
  if (!shouldShow || !libraryPaintColorPickerState.target) {
    return;
  }

  const color = normalizeHexColor(libraryPaintColorPickerState.draftColor, "#ffffff");
  const { r, g, b } = hexToRgb(color);
  elements.libraryPaintColorSpectrum.style.background = `hsl(${libraryPaintColorPickerState.hue} 100% 50%)`;
  elements.libraryPaintColorSpectrumHandle.style.left = `${libraryPaintColorPickerState.saturation}%`;
  elements.libraryPaintColorSpectrumHandle.style.top = `${100 - libraryPaintColorPickerState.value}%`;
  elements.libraryPaintColorHueInput.value = String(libraryPaintColorPickerState.hue);
  elements.libraryPaintColorRInput.value = r;
  elements.libraryPaintColorGInput.value = g;
  elements.libraryPaintColorBInput.value = b;
  elements.libraryPaintColorEyedropperButton.disabled = !window.EyeDropper;

  const previewData = previewLibrarySelectionStyle();
  applyLibrarySelectionPreview(previewData);
  elements.libraryFillSwatch.style.background = paintCssValue(previewData.fillMode, previewData.fillColor, previewData.fillGradientStops, previewData.fillOpacity, previewData.fillGradientType, previewData.fillGradientDirection);
  elements.libraryOutlineSwatch.style.background = paintCssValue(previewData.outlineMode, previewData.outlineColor, previewData.outlineGradientStops, previewData.outlineOpacity, previewData.outlineGradientType, previewData.outlineGradientDirection);
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  elements.libraryPaintGradientPreview.style.background = paintCssValue(
    "gradient",
    previewData[colorField],
    previewData[stopsField],
    previewData[libraryPaintTargetOpacityField()],
    previewData[libraryPaintTargetGradientTypeField()],
    previewData[libraryPaintTargetGradientDirectionField()]
  );
  if ([...elements.libraryPaintModeInputs].find((input) => input.checked)?.value === "gradient") {
    renderLibraryPaintStops(previewData);
  }
}

function openLibraryPaintColorPopup(target, color) {
  libraryPaintColorPickerState.open = true;
  libraryPaintColorPickerState.target = target;
  libraryPaintColorPickerState.originalColor = normalizeHexColor(color, "#ffffff");
  libraryPaintColorPickerState.draftColor = normalizeHexColor(color, "#ffffff");
  const rgb = hexToRgb(libraryPaintColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  libraryPaintColorPickerState.hue = hsv.h;
  libraryPaintColorPickerState.saturation = hsv.s;
  libraryPaintColorPickerState.value = hsv.v;
  renderLibraryPaintColorPopup();
}

function commitOpenLibraryColorPreviewToDraft() {
  if (!libraryPaintColorPickerState.open || !libraryPaintColorPickerState.target) {
    return;
  }
  const data = ensureLibraryPaintDraft();
  const colorField = libraryPaintTargetField("Color");
  const stopsField = libraryPaintTargetField("GradientStops");
  const nextColor = normalizeHexColor(libraryPaintColorPickerState.draftColor, libraryPaintColorPickerState.originalColor);
  if (libraryPaintColorPickerState.target.type === "solid") {
    data[colorField] = nextColor;
  } else if (libraryPaintColorPickerState.target.type === "gradient-stop") {
    const stopIndex = clampNumber(libraryPaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0);
    if (data[stopsField][stopIndex]) {
      data[stopsField][stopIndex].color = nextColor;
      data[stopsField] = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    }
  }
  libraryPaintEditorState.draftData = normalizeLibrarySelectionStyle(data);
}

function updateLibraryPaintData(mutator) {
  const data = ensureLibraryPaintDraft();
  mutator(data);
  libraryPaintEditorState.draftData = normalizeLibrarySelectionStyle(data);
  applyLibrarySelectionPreview(libraryPaintEditorState.draftData);
  renderSettingsModal();
}

function selectedLibraryPaintMode() {
  return [...elements.libraryPaintModeInputs].find((input) => input.checked)?.value === "gradient" ? "gradient" : "solid";
}

function openLibraryPaintPanel(target) {
  commitOpenLibraryColorPreviewToDraft();
  const data = ensureLibraryPaintDraft();
  libraryPaintEditorState.target = target;
  const modeField = libraryPaintTargetField("Mode");
  const colorField = libraryPaintTargetField("Color");
  const stopsField = libraryPaintTargetField("GradientStops");
  [...elements.libraryPaintModeInputs].forEach((input) => { input.checked = input.value === data[modeField]; });
  elements.libraryPaintPanel.hidden = false;
  elements.libraryFillButton.setAttribute("aria-expanded", target === "fill" ? "true" : "false");
  elements.libraryOutlineButton.setAttribute("aria-expanded", target === "outline" ? "true" : "false");
  if (data[modeField] === "gradient") {
    libraryPaintEditorState.draggingStopIndex = 0;
    if (!ensureLibraryPaintGradientStopSelection(data, { forceFirstStop: true })) {
      closeLibraryPaintColorPopup();
    }
  } else {
    openLibraryPaintColorPopup({ type: "solid" }, data[colorField]);
  }
  renderSettingsModal();
}

function closeLibraryPaintPanel({ restoreOriginal = true } = {}) {
  if (restoreOriginal && libraryPaintEditorState.originalData) {
    applyLibrarySelectionPreview(libraryPaintEditorState.originalData);
  }
  elements.libraryPaintPanel.hidden = true;
  elements.libraryFillButton.setAttribute("aria-expanded", "false");
  elements.libraryOutlineButton.setAttribute("aria-expanded", "false");
  closeLibraryPaintColorPopup({ force: true });
  clearLibraryPaintDraft();
}

function updateLibraryPaintMode() {
  const modeField = libraryPaintTargetField("Mode");
  const colorField = libraryPaintTargetField("Color");
  const stopsField = libraryPaintTargetField("GradientStops");
  updateLibraryPaintData((data) => {
    data[modeField] = selectedLibraryPaintMode();
  });
  if (selectedLibraryPaintMode() === "gradient") {
    const draft = libraryPaintEditorState.draftData;
    libraryPaintEditorState.draggingStopIndex = 0;
    if (!ensureLibraryPaintGradientStopSelection(draft, { forceFirstStop: true })) {
      closeLibraryPaintColorPopup();
    }
  } else {
    const draft = libraryPaintEditorState.draftData;
    openLibraryPaintColorPopup({ type: "solid" }, draft?.[colorField] || "#ffffff");
  }
}

function addLibraryGradientStop() {
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  const modeField = libraryPaintTargetField("Mode");
  updateLibraryPaintData((data) => {
    const normalizedStops = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    const previousStop = normalizedStops[normalizedStops.length - 2] || normalizedStops[0];
    const lastStop = normalizedStops[normalizedStops.length - 1] || previousStop;
    normalizedStops.splice(normalizedStops.length - 1, 0, {
      stopId: `stop-${Math.random().toString(36).slice(2, 10)}`,
      color: lastStop.color,
      offset: Math.round((previousStop.offset + lastStop.offset) / 2)
    });
    data[modeField] = "gradient";
    data[stopsField] = normalizeTabAreaGradientStops(normalizedStops, data[colorField], data[colorField]);
  });
}

function removeLibraryGradientStop(index) {
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  updateLibraryPaintData((data) => {
    if (data[stopsField].length <= 2) {
      return;
    }
    data[stopsField] = normalizeTabAreaGradientStops(
      data[stopsField].filter((_, stopIndex) => stopIndex !== index),
      data[colorField],
      data[colorField]
    );
  });
  closeLibraryPaintColorPopup();
}

function updateLibraryPaintOpacity() {
  updateLibraryPaintData((data) => {
    const opacityField = libraryPaintTargetOpacityField();
    data[opacityField] = clampNumber(elements.libraryPaintOpacityInput.value, 0, 100, Math.round(data[opacityField] * 100)) / 100;
  });
  setOpacityDisplay(elements.libraryPaintOpacityValue, elements.libraryPaintOpacityInput.value);
}

function updateLibraryGradientOptions() {
  updateLibraryPaintData((data) => {
    data[libraryPaintTargetGradientTypeField()] = elements.libraryPaintGradientTypeInput.value === "radial" ? "radial" : "linear";
    data[libraryPaintTargetGradientDirectionField()] = elements.libraryPaintGradientDirectionInput.value || "to right";
  });
}

function updateLibraryPaintDraftFromInputs() {
  if (!libraryPaintColorPickerState.open) {
    return;
  }
  libraryPaintColorPickerState.draftColor = rgbToHex(
    elements.libraryPaintColorRInput.value,
    elements.libraryPaintColorGInput.value,
    elements.libraryPaintColorBInput.value
  );
  const rgb = hexToRgb(libraryPaintColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  libraryPaintColorPickerState.hue = hsv.h;
  libraryPaintColorPickerState.saturation = hsv.s;
  libraryPaintColorPickerState.value = hsv.v;
  renderLibraryPaintColorPopup();
}

function updateLibraryPaintDraftFromHsv() {
  const rgb = hsvToRgb(
    libraryPaintColorPickerState.hue,
    libraryPaintColorPickerState.saturation,
    libraryPaintColorPickerState.value
  );
  libraryPaintColorPickerState.draftColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  renderLibraryPaintColorPopup();
}

function updateLibraryPaintSpectrumFromPointer(clientX, clientY) {
  if (!libraryPaintColorPickerState.open) {
    return;
  }
  const rect = elements.libraryPaintColorSpectrum.getBoundingClientRect();
  const relativeX = ((clientX - rect.left) / rect.width) * 100;
  const relativeY = ((clientY - rect.top) / rect.height) * 100;
  libraryPaintColorPickerState.saturation = clampNumber(relativeX, 0, 100, libraryPaintColorPickerState.saturation);
  libraryPaintColorPickerState.value = 100 - clampNumber(relativeY, 0, 100, 100 - libraryPaintColorPickerState.value);
  updateLibraryPaintDraftFromHsv();
}

function beginLibraryPaintSpectrumDrag(event) {
  libraryPaintColorPickerState.draggingSpectrum = true;
  updateLibraryPaintSpectrumFromPointer(event.clientX, event.clientY);
}

function updateLibraryPaintHue() {
  if (!libraryPaintColorPickerState.open) {
    return;
  }
  libraryPaintColorPickerState.hue = clampNumber(elements.libraryPaintColorHueInput.value, 0, 360, libraryPaintColorPickerState.hue);
  updateLibraryPaintDraftFromHsv();
}

async function pickLibraryPaintColorWithEyedropper() {
  if (!window.EyeDropper || !libraryPaintColorPickerState.open) {
    return;
  }
  try {
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open();
    libraryPaintColorPickerState.draftColor = normalizeHexColor(result?.sRGBHex, libraryPaintColorPickerState.draftColor);
    const rgb = hexToRgb(libraryPaintColorPickerState.draftColor);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    libraryPaintColorPickerState.hue = hsv.h;
    libraryPaintColorPickerState.saturation = hsv.s;
    libraryPaintColorPickerState.value = hsv.v;
    renderLibraryPaintColorPopup();
  } catch {
    // Ignore cancel.
  }
}

function applyLibraryPaintColorPopup() {
  commitOpenLibraryColorPreviewToDraft();
  closeLibraryPaintColorPopup();
  renderSettingsModal();
}

function updateLibraryGradientStopDrag(clientX, clientY) {
  if (libraryPaintEditorState.draggingStopIndex == null) {
    return;
  }
  const slider = elements.libraryPaintGradientStops.querySelector(".tab-area-gradient-stop-slider");
  if (!(slider instanceof HTMLElement)) {
    return;
  }
  const rect = slider.getBoundingClientRect();
  const deleteThreshold = 18;
  if (clientY < rect.top - deleteThreshold || clientY > rect.bottom + deleteThreshold) {
    const stopIndex = clampNumber(libraryPaintEditorState.draggingStopIndex, 0, 100, 0);
    libraryPaintEditorState.draggingStopIndex = null;
    removeLibraryGradientStop(stopIndex);
    return;
  }
  const offset = clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100, 0);
  const stopIndex = clampNumber(libraryPaintEditorState.draggingStopIndex, 0, 100, 0);
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  updateLibraryPaintData((data) => {
    const movingStop = data[stopsField][stopIndex];
    if (!movingStop) {
      return;
    }
    movingStop.offset = offset;
    data[stopsField] = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    const nextIndex = data[stopsField].findIndex((stop) => stop.stopId === movingStop.stopId);
    if (nextIndex >= 0) {
      libraryPaintEditorState.draggingStopIndex = nextIndex;
      if (libraryPaintColorPickerState.target?.type === "gradient-stop") {
        libraryPaintColorPickerState.target.index = nextIndex;
      }
    }
  });
}

function addLibraryGradientStopAtOffset(offset) {
  const stopsField = libraryPaintTargetField("GradientStops");
  const colorField = libraryPaintTargetField("Color");
  const modeField = libraryPaintTargetField("Mode");
  updateLibraryPaintData((data) => {
    const normalizedStops = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    const nextOffset = clampNumber(offset, 0, 100, 0);
    const nextColor = gradientColorAtOffset(normalizedStops, nextOffset, data[colorField]);
    const stopId = `stop-${Math.random().toString(36).slice(2, 10)}`;
    normalizedStops.push({ stopId, color: nextColor, offset: nextOffset });
    data[modeField] = "gradient";
    data[stopsField] = normalizeTabAreaGradientStops(normalizedStops, data[colorField], data[colorField]);
    const nextIndex = data[stopsField].findIndex((stop) => stop.stopId === stopId);
    if (nextIndex >= 0) {
      libraryPaintEditorState.draggingStopIndex = nextIndex;
      openLibraryPaintColorPopup({ type: "gradient-stop", index: nextIndex }, nextColor);
    }
  });
}

function saveLibrarySelectionSettings() {
  commitOpenLibraryColorPreviewToDraft();
  state.uiSettings.librarySelection = normalizeLibrarySelectionStyle(libraryPaintEditorState.draftData || currentLibrarySelectionStyle());
  saveUiSettings();
  closeLibraryPaintPanel({ restoreOriginal: false });
  applyUiSettingsToDocument();
  renderPageList();
  renderSettingsModal();
}

function renderSettingsModal() {
  elements.settingsModal.hidden = !settingsModalState.open;
  elements.settingsModalBackdrop.hidden = !settingsModalState.open;
  elements.settingsModal.style.left = `${settingsModalState.x}px`;
  elements.settingsModal.style.top = `${settingsModalState.y}px`;
  elements.settingsTabLibrary.classList.toggle("is-active", settingsModalState.tab === "library");
  elements.settingsTabLibrary.setAttribute("aria-selected", settingsModalState.tab === "library" ? "true" : "false");
  elements.settingsTabToptabs.classList.toggle("is-active", settingsModalState.tab === "toptabs");
  elements.settingsTabToptabs.setAttribute("aria-selected", settingsModalState.tab === "toptabs" ? "true" : "false");
  elements.settingsPanelLibrary.hidden = settingsModalState.tab !== "library";
  elements.settingsPanelToptabs.hidden = settingsModalState.tab !== "toptabs";
  const data = previewLibrarySelectionStyle();
  elements.libraryFillSwatch.style.background = paintCssValue(data.fillMode, data.fillColor, data.fillGradientStops, data.fillOpacity, data.fillGradientType, data.fillGradientDirection);
  elements.libraryOutlineSwatch.style.background = paintCssValue(data.outlineMode, data.outlineColor, data.outlineGradientStops, data.outlineOpacity, data.outlineGradientType, data.outlineGradientDirection);
  elements.libraryPaintTargetLabel.textContent = libraryPaintEditorState.target === "outline" ? "Outline" : "Fill";
  elements.libraryPaintTargetNote.textContent = `Edit the selected library page ${libraryPaintEditorState.target}.`;
  elements.libraryPaintOpacityField.hidden = false;
  elements.libraryPaintOpacityInput.value = String(Math.round(data[libraryPaintTargetOpacityField()] * 100));
  setOpacityDisplay(elements.libraryPaintOpacityValue, elements.libraryPaintOpacityInput.value);
  if (!elements.libraryPaintPanel.hidden) {
    const modeField = libraryPaintTargetField("Mode");
    const stopsField = libraryPaintTargetField("GradientStops");
    const colorField = libraryPaintTargetField("Color");
    const gradientTypeField = libraryPaintTargetGradientTypeField();
    const gradientDirectionField = libraryPaintTargetGradientDirectionField();
    const mode = data[modeField];
    [...elements.libraryPaintModeInputs].forEach((input) => { input.checked = input.value === mode; });
    elements.libraryPaintSolidPanel.hidden = mode !== "solid";
    elements.libraryPaintGradientPanel.hidden = mode !== "gradient";
    elements.libraryPaintGradientTypeInput.value = data[gradientTypeField];
    elements.libraryPaintGradientDirectionField.hidden = data[gradientTypeField] === "radial";
    elements.libraryPaintGradientDirectionInput.value = data[gradientDirectionField];
    elements.libraryPaintGradientPreview.style.background = paintCssValue(
      "gradient",
      data[colorField],
      data[stopsField],
      data[libraryPaintTargetOpacityField()],
      data[gradientTypeField],
      data[gradientDirectionField]
    );
    renderLibraryPaintStops(data);
    renderLibraryPaintColorPopup();
  }
}

function clampSettingsModalPosition(nextX, nextY) {
  const modalWidth = elements.settingsModal.offsetWidth || 620;
  const modalHeight = elements.settingsModal.offsetHeight || 520;
  const maxX = Math.max(12, window.innerWidth - modalWidth - 12);
  const maxY = Math.max(12, window.innerHeight - modalHeight - 12);
  settingsModalState.x = clampNumber(nextX, 12, maxX, 120);
  settingsModalState.y = clampNumber(nextY, 12, maxY, 120);
}

function updateShapePaintMode() {
  const modeField = shapePaintTargetField("Mode");
  const colorField = shapePaintTargetField("Color");
  updateShapePaintData((data) => {
    data[modeField] = selectedShapePaintMode();
  });

  if (selectedShapePaintMode() === "gradient") {
    closeShapePaintColorPopup();
  } else {
    const draft = shapePaintEditorState.draftData;
    openShapePaintColorPopup({ type: "solid" }, draft?.[colorField] || "#ffffff");
  }
}

function addShapeGradientStop() {
  const stopsField = shapePaintTargetField("GradientStops");
  const colorField = shapePaintTargetField("Color");
  updateShapePaintData((data) => {
    const normalizedStops = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[stopsField][data[stopsField].length - 1]?.color || data[colorField]);
    const previousStop = normalizedStops[normalizedStops.length - 2] || normalizedStops[0];
    const lastStop = normalizedStops[normalizedStops.length - 1] || previousStop;
    normalizedStops.splice(normalizedStops.length - 1, 0, {
      color: lastStop.color,
      offset: normalizedStops.length === 1 ? 100 : Math.round((previousStop.offset + lastStop.offset) / 2)
    });
    data[shapePaintTargetField("Mode")] = "gradient";
    data[stopsField] = normalizeTabAreaGradientStops(normalizedStops, data[colorField], lastStop.color);
  });
}

function addShapeGradientStopAtOffset(offset) {
  const stopsField = shapePaintTargetField("GradientStops");
  const colorField = shapePaintTargetField("Color");
  updateShapePaintData((data) => {
    const normalizedStops = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    const nextOffset = clampNumber(offset, 0, 100, 0);
    const nextColor = gradientColorAtOffset(normalizedStops, nextOffset, data[colorField]);
    const stopId = `stop-${Math.random().toString(36).slice(2, 10)}`;
    normalizedStops.push({
      stopId,
      color: nextColor,
      offset: nextOffset
    });
    data[shapePaintTargetField("Mode")] = "gradient";
    data[stopsField] = normalizeTabAreaGradientStops(normalizedStops, data[colorField], data[colorField]);
    const nextIndex = data[stopsField].findIndex((stop) => stop.stopId === stopId);
    if (nextIndex >= 0) {
      shapePaintEditorState.draggingStopIndex = nextIndex;
      openShapePaintColorPopup({ type: "gradient-stop", index: nextIndex }, nextColor);
    }
  });
}

function removeShapeGradientStop(index) {
  const stopsField = shapePaintTargetField("GradientStops");
  const colorField = shapePaintTargetField("Color");
  updateShapePaintData((data) => {
    if (data[stopsField].length <= 2) {
      return;
    }
    data[stopsField] = normalizeTabAreaGradientStops(
      data[stopsField].filter((_, stopIndex) => stopIndex !== index),
      data[colorField],
      data[colorField]
    );
  });
  closeShapePaintColorPopup();
}

function updateShapeGradientStopDrag(clientX) {
  if (
    !(shapeEditorState.shapeElement instanceof HTMLElement)
    || !shapeEditorState.shapeElement.isConnected
    || shapePaintEditorState.draggingStopIndex == null
  ) {
    return;
  }

  const slider = elements.shapePaintGradientStops.querySelector(".tab-area-gradient-stop-slider");
  if (!(slider instanceof HTMLElement)) {
    return;
  }

  const rect = slider.getBoundingClientRect();
  const offset = clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100, 0);
  const stopIndex = clampNumber(shapePaintEditorState.draggingStopIndex, 0, 100, 0);
  const stopsField = shapePaintTargetField("GradientStops");
  const colorField = shapePaintTargetField("Color");

  updateShapePaintData((data) => {
    const movingStop = data[stopsField][stopIndex];
    if (!movingStop) {
      return;
    }
    movingStop.offset = offset;
    data[stopsField] = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
    const nextIndex = data[stopsField].findIndex((stop) => stop.stopId === movingStop.stopId);
    if (nextIndex >= 0) {
      shapePaintEditorState.draggingStopIndex = nextIndex;
      if (shapePaintColorPickerState.target?.type === "gradient-stop") {
        shapePaintColorPickerState.target.index = nextIndex;
      }
    }
  });
}

function updateShapePaintDraftFromInputs() {
  if (!shapePaintColorPickerState.open) {
    return;
  }

  shapePaintColorPickerState.draftColor = rgbToHex(
    elements.shapePaintColorRInput.value,
    elements.shapePaintColorGInput.value,
    elements.shapePaintColorBInput.value
  );
  const rgb = hexToRgb(shapePaintColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  shapePaintColorPickerState.hue = hsv.h;
  shapePaintColorPickerState.saturation = hsv.s;
  shapePaintColorPickerState.value = hsv.v;
  renderShapePaintColorPopup();
}

function updateShapePaintDraftFromHsv() {
  const rgb = hsvToRgb(
    shapePaintColorPickerState.hue,
    shapePaintColorPickerState.saturation,
    shapePaintColorPickerState.value
  );
  shapePaintColorPickerState.draftColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  renderShapePaintColorPopup();
}

function updateShapePaintSpectrumFromPointer(clientX, clientY) {
  if (!shapePaintColorPickerState.open) {
    return;
  }

  const rect = elements.shapePaintColorSpectrum.getBoundingClientRect();
  const relativeX = ((clientX - rect.left) / rect.width) * 100;
  const relativeY = ((clientY - rect.top) / rect.height) * 100;
  shapePaintColorPickerState.saturation = clampNumber(relativeX, 0, 100, shapePaintColorPickerState.saturation);
  shapePaintColorPickerState.value = 100 - clampNumber(relativeY, 0, 100, 100 - shapePaintColorPickerState.value);
  updateShapePaintDraftFromHsv();
}

function beginShapePaintSpectrumDrag(event) {
  shapePaintColorPickerState.draggingSpectrum = true;
  updateShapePaintSpectrumFromPointer(event.clientX, event.clientY);
}

function updateShapePaintHue() {
  if (!shapePaintColorPickerState.open) {
    return;
  }

  shapePaintColorPickerState.hue = clampNumber(elements.shapePaintColorHueInput.value, 0, 360, shapePaintColorPickerState.hue);
  updateShapePaintDraftFromHsv();
}

function syncShapePaintColorFromHex(color) {
  shapePaintColorPickerState.draftColor = normalizeHexColor(color, shapePaintColorPickerState.draftColor);
  const rgb = hexToRgb(shapePaintColorPickerState.draftColor);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  shapePaintColorPickerState.hue = hsv.h;
  shapePaintColorPickerState.saturation = hsv.s;
  shapePaintColorPickerState.value = hsv.v;
  renderShapePaintColorPopup();
}

async function pickShapePaintColorWithEyedropper() {
  if (!window.EyeDropper || !shapePaintColorPickerState.open) {
    return;
  }

  try {
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open();
    syncShapePaintColorFromHex(result?.sRGBHex);
  } catch {
    // Ignore cancelled eyedropper sessions.
  }
}

function applyShapePaintColorPopup() {
  const colorField = shapePaintTargetField("Color");
  const stopsField = shapePaintTargetField("GradientStops");
  updateShapePaintData((data) => {
    const nextColor = normalizeHexColor(shapePaintColorPickerState.draftColor, shapePaintColorPickerState.originalColor);
    if (shapePaintColorPickerState.target?.type === "solid") {
      data[colorField] = nextColor;
      return;
    }

    if (shapePaintColorPickerState.target?.type === "gradient-stop") {
      const stopIndex = clampNumber(shapePaintColorPickerState.target.index, 0, Math.max(0, data[stopsField].length - 1), 0);
      if (data[stopsField][stopIndex]) {
        data[stopsField][stopIndex].color = nextColor;
        data[stopsField] = normalizeTabAreaGradientStops(data[stopsField], data[colorField], data[colorField]);
      }
    }
  });
  closeShapePaintColorPopup();
}

function selectedTabAreaFillMode() {
  return [...elements.tabAreaFillModeInputs].find((input) => input.checked)?.value === "gradient"
    ? "gradient"
    : "solid";
}

function tabAreaGradientStopsFromFlyout(data) {
  return normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
}

function renderTabAreaGradientStops(data) {
  const selectedStopIndex = tabAreaColorPickerState.target?.type === "gradient-stop"
    ? clampNumber(tabAreaColorPickerState.target.index, 0, Math.max(0, data.gradientStops.length - 1), 0)
    : null;

  elements.tabAreaRemoveStopButton.hidden = selectedStopIndex == null;
  elements.tabAreaRemoveStopButton.disabled = data.gradientStops.length <= 2;
  if (selectedStopIndex != null) {
    elements.tabAreaRemoveStopButton.setAttribute("data-stop-index", String(selectedStopIndex));
  } else {
    elements.tabAreaRemoveStopButton.removeAttribute("data-stop-index");
  }

  elements.tabAreaGradientStops.innerHTML = `
    <div class="tab-area-gradient-stop-slider" style="background:${gradientStopSliderValue(data.fillColor, data.gradientStops, data.fillOpacity)}">
      ${data.gradientStops.map((stop, index) => `
        <button
          class="tab-area-gradient-stop-thumb${selectedStopIndex === index ? " is-selected" : ""}"
          type="button"
          data-tab-stop-drag="${index}"
          data-tab-stop-color="${escapeHtml(stop.color)}"
          style="left:${stop.offset}%"
          aria-label="Gradient stop ${index + 1} at ${stop.offset}%"
        >
          <span class="tab-area-gradient-stop-thumb-inner" style="background:${stop.color}" aria-hidden="true"></span>
        </button>
      `).join("")}
    </div>
  `;
}

function addTabAreaGradientStop() {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    return;
  }

  const data = ensureTabAreaGradientDraft(ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement)));
  if (!data) {
    return;
  }

  const normalizedStops = normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
  const previousStop = normalizedStops[normalizedStops.length - 2] || normalizedStops[0];
  const lastStop = normalizedStops[normalizedStops.length - 1] || previousStop;
  const nextOffset = normalizedStops.length === 1
    ? 100
    : Math.round((previousStop.offset + lastStop.offset) / 2);
  normalizedStops.splice(normalizedStops.length - 1, 0, {
    color: lastStop.color,
    offset: nextOffset
  });

  data.fillMode = "gradient";
  data.gradientStops = normalizeTabAreaGradientStops(normalizedStops, data.fillColor, "#e9eef7");
  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  applyTabAreaPreviewToContainer(tabAreaFillEditorState.draftData);
  renderTabAreaEditorFlyout();
}

function addTabAreaGradientStopAtOffset(offset) {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    return;
  }

  const data = ensureTabAreaGradientDraft(ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement)));
  if (!data) {
    return;
  }

  const normalizedStops = normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
  const nextOffset = clampNumber(offset, 0, 100, 0);
  const nextColor = gradientColorAtOffset(normalizedStops, nextOffset, data.fillColor);
  const stopId = `stop-${Math.random().toString(36).slice(2, 10)}`;
  normalizedStops.push({
    stopId,
    color: nextColor,
    offset: nextOffset
  });

  data.fillMode = "gradient";
  data.gradientStops = normalizeTabAreaGradientStops(normalizedStops, data.fillColor, "#e9eef7");
  const nextIndex = data.gradientStops.findIndex((stop) => stop.stopId === stopId);
  if (nextIndex >= 0) {
    tabAreaGradientEditorState.draggingStopIndex = nextIndex;
    openTabAreaColorPopup({ type: "gradient-stop", index: nextIndex }, nextColor);
  }
  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  applyTabAreaPreviewToContainer(tabAreaFillEditorState.draftData);
  renderTabAreaEditorFlyout();
}

function removeGradientStop(index) {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    return;
  }

  const data = ensureTabAreaGradientDraft(ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement)));
  if (!data || data.gradientStops.length <= 2) {
    return;
  }

  data.gradientStops = normalizeTabAreaGradientStops(
    data.gradientStops.filter((_, stopIndex) => stopIndex !== index),
    data.fillColor,
    "#e9eef7"
  );
  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  applyTabAreaPreviewToContainer(tabAreaFillEditorState.draftData);
  closeTabAreaColorPopup();
  renderTabAreaEditorFlyout();
}

function confirmFillDraft() {
  if (
    !(tabAreaEditorState.containerElement instanceof HTMLElement) ||
    !tabAreaEditorState.containerElement.isConnected ||
    !tabAreaFillEditorState.draftData
  ) {
    return;
  }

  commitOpenColorPreviewToDraft();
  const data = normalizeTabbedContainerData(tabAreaFillEditorState.draftData);
  setTabbedContainerData(tabAreaEditorState.containerElement, data, "editor");
  renderPublishedPage();
  handleLiveEdit();
  closeTabAreaFillPanel({ restoreOriginal: false });
  renderTabAreaEditorFlyout();
}

function cancelFillDraft() {
  closeTabAreaFillPanel();
  renderTabAreaEditorFlyout();
}

function updateGradientStopDrag(clientX) {
  if (
    !(tabAreaEditorState.containerElement instanceof HTMLElement) ||
    !tabAreaEditorState.containerElement.isConnected ||
    tabAreaGradientEditorState.draggingStopIndex == null
  ) {
    return;
  }

  const slider = elements.tabAreaGradientStops.querySelector(".tab-area-gradient-stop-slider");
  if (!(slider instanceof HTMLElement)) {
    return;
  }

  const rect = slider.getBoundingClientRect();
  const offset = clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100, 0);
  const data = ensureTabAreaGradientDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement));
  if (!data || !data.gradientStops[tabAreaGradientEditorState.draggingStopIndex]) {
    return;
  }

  const movingStop = data.gradientStops[tabAreaGradientEditorState.draggingStopIndex];
  movingStop.offset = offset;
  data.gradientStops = normalizeTabAreaGradientStops(data.gradientStops, data.fillColor, "#e9eef7");
  const nextIndex = data.gradientStops.findIndex((stop) => stop.stopId === movingStop.stopId);
  if (nextIndex >= 0) {
    tabAreaGradientEditorState.draggingStopIndex = nextIndex;
    if (tabAreaColorPickerState.target?.type === "gradient-stop") {
      tabAreaColorPickerState.target.index = nextIndex;
    }
  }
  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  applyTabAreaPreviewToContainer(tabAreaFillEditorState.draftData);
  renderTabAreaEditorFlyout();
}

function updateTabAreaFromFlyout() {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    closeTabAreaEditor();
    return;
  }

  const data = syncTabbedContainerActiveContent(tabAreaEditorState.containerElement);
  if (!data) {
    return;
  }

  data.fillMode = selectedTabAreaFillMode();
  data.title = elements.tabAreaTitleInput.value.trim();
  data.fillColor = normalizeHexColor(elements.tabAreaFillInput.value, data.fillColor);
  data.fillOpacity = clampNumber(elements.tabAreaFillOpacityInput.value, 0, 100, Math.round(data.fillOpacity * 100)) / 100;
  data.fillGradientType = elements.tabAreaGradientTypeInput.value === "radial" ? "radial" : "linear";
  data.fillGradientDirection = elements.tabAreaGradientDirectionInput.value || "to right";
  data.gradientStops = tabAreaGradientStopsFromFlyout(data);
  elements.tabAreaFillSwatch.style.background = tabAreaFillValue(data);
  elements.tabAreaGradientPreview.style.background = tabAreaFillValue({
    ...data,
    fillMode: "gradient"
  });
  elements.tabAreaFillSolidPanel.hidden = data.fillMode !== "solid";
  elements.tabAreaFillGradientPanel.hidden = data.fillMode !== "gradient";
  elements.tabAreaGradientDirectionField.hidden = data.fillGradientType === "radial";
  data.borderRadius = clampNumber(elements.tabAreaRadiusInput.value, 0, 48, data.borderRadius);
  data.hideHeaderInDirectView = elements.tabAreaHideHeaderInput.checked;
  data.hideBorderInDirectView = elements.tabAreaHideBorderInput.checked;
  setTabbedContainerData(tabAreaEditorState.containerElement, data, "editor");
  renderPublishedPage();
  handleLiveEdit();
}

function updateTabAreaFillOpacityFromFlyout() {
  if (!(tabAreaEditorState.containerElement instanceof HTMLElement) || !tabAreaEditorState.containerElement.isConnected) {
    closeTabAreaEditor();
    return;
  }

  const data = ensureTabAreaGradientDraft(ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement)));
  if (!data) {
    return;
  }

  data.fillOpacity = clampNumber(elements.tabAreaFillOpacityInput.value, 0, 100, Math.round(data.fillOpacity * 100)) / 100;
  tabAreaFillEditorState.draftData = normalizeTabbedContainerData(data);
  applyTabAreaPreviewToContainer(tabAreaFillEditorState.draftData);
  renderTabAreaEditorFlyout();
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
  closeShapeMenu();
  closeButtonMenu();
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
  if (state.tabAreaDrawMode) {
    return;
  }

  if (objectMarqueeState) {
    return;
  }

  if (event.button != null && event.button !== 0) {
    return;
  }

  if (!(event.target instanceof Element)) {
    return;
  }

  if (event.target.closest("button, a, input, select, textarea")) {
    return;
  }

  const chartElement = event.target.closest(`.${CHART_CLASS}`);
  if (chartElement) {
    closeShapeEditor();
    selectChart(chartElement);
    elements.bodyEditor.focus();
    return;
  }

  const shapeElement = event.target.closest(`.${SHAPE_BLOCK_CLASS}`);
  if (shapeElement) {
    clearSelectedChart();
    selectShape(shapeElement);
    elements.bodyEditor.focus();
    return;
  }

  clearObjectSelectionState();
  closeShapeEditor();

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
  if (!(chartNode instanceof HTMLElement)) {
    return;
  }

  const target = selectionTarget();
  const tabPanel = target?.range?.startContainer?.nodeType === Node.TEXT_NODE
    ? target.range.startContainer.parentElement?.closest(".tabbed-container-panel")
    : target?.range?.startContainer?.closest?.(".tabbed-container-panel");

  if (tabPanel instanceof HTMLElement) {
    tabPanel.appendChild(chartNode);
    const containerElement = tabPanel.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
    openChartEditor(chartNode);
    tabPanel.focus();
    handleLiveEdit();
    return;
  }

  if (!target) {
    const textBlock = ensureEditorTextBlock();
    textBlock.after(chartNode);
    openChartEditor(chartNode);
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
  closeShapeEditor();
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
  const activeChart = currentSelectedChartElement();
  if (!activeChart) {
    clearSelectedChart();
    return false;
  }

  const tabPanel = activeChart.closest(".tabbed-container-panel");
  const nextBlock = activeChart.nextElementSibling;
  const previousBlock = activeChart.previousElementSibling;
  const chartToRemove = activeChart;
  clearSelectedChart();
  chartToRemove.remove();

  if (tabPanel instanceof HTMLElement) {
    const containerElement = tabPanel.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
    closeChartEditor({ revert: false });
    handleLiveEdit();
    return true;
  }

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

function deleteSelectedShape() {
  const activeShape = currentSelectedShapeElement();
  if (!activeShape) {
    clearSelectedShape();
    return false;
  }

  const tabPanel = activeShape.closest(".tabbed-container-panel");
  const nextBlock = activeShape.nextElementSibling;
  const previousBlock = activeShape.previousElementSibling;
  clearSelectedShape();
  activeShape.remove();

  if (tabPanel instanceof HTMLElement) {
    const containerElement = tabPanel.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      syncTabbedContainerActiveContent(containerElement);
    }
    closeShapeEditor();
    handleLiveEdit();
    return true;
  }

  if (nextBlock instanceof HTMLElement && nextBlock.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)) {
    focusTextBlockStart(nextBlock);
  } else if (previousBlock instanceof HTMLElement && previousBlock.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)) {
    focusTextBlockStart(previousBlock);
  } else {
    const trailingParagraph = ensureEditorTextBlock();
    focusTextBlockStart(trailingParagraph);
  }

  closeShapeEditor();
  handleLiveEdit();
  return true;
}

function deleteMarqueeSelectedObjects() {
  const targets = Array.from(marqueeSelectedObjectElements).filter((element) => element instanceof HTMLElement && element.isConnected);
  if (!targets.length) {
    clearMarqueeSelectedObjects();
    return false;
  }

  const affectedContainers = new Set();
  let removedTopLevelBlock = false;

  if (targets.some((element) => element.classList.contains(CHART_CLASS))) {
    closeChartEditor({ revert: false });
  }
  if (targets.some((element) => element.classList.contains(SHAPE_BLOCK_CLASS))) {
    closeShapeEditor();
  }
  if (targets.some((element) => element.classList.contains(TABBED_CONTAINER_CLASS))) {
    closeTabAreaEditor();
  }

  targets.forEach((element) => {
    const tabPanel = element.closest(".tabbed-container-panel");
    const containerElement = tabPanel?.closest?.(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      affectedContainers.add(containerElement);
    } else if (
      element.parentElement === elements.bodyEditor
      && !element.matches(`[${BODY_TEXT_BLOCK_ATTRIBUTE}="${BODY_TEXT_BLOCK_VALUE}"]`)
    ) {
      removedTopLevelBlock = true;
    }

    element.remove();
  });

  affectedContainers.forEach((containerElement) => {
    if (containerElement instanceof HTMLElement && containerElement.isConnected) {
      syncTabbedContainerActiveContent(containerElement);
    }
  });

  clearObjectSelectionState();
  if (removedTopLevelBlock) {
    ensureEditorTextBlock();
  }
  elements.bodyEditor.focus();
  handleLiveEdit();
  return true;
}

function handleSelectedObjectDeleteKey(event) {
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return false;
  }

  if (!(event.target instanceof HTMLElement)) {
    return deleteMarqueeSelectedObjects() || deleteSelectedChart() || deleteSelectedShape();
  }

  if (event.target.closest("input, textarea, select, .editor-shape-text")) {
    return false;
  }

  return deleteMarqueeSelectedObjects() || deleteSelectedChart() || deleteSelectedShape();
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

elements.pageList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-page-id]");
  if (!button) {
    return;
  }

  await saveActivePageDraft();
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

elements.pageRouteLink.addEventListener("click", async (event) => {
  event.preventDefault();
  const page = await updateActivePageFromForm();
  setRoute("page", page.id);
});

elements.topEditRouteLink.addEventListener("click", async (event) => {
  event.preventDefault();
  const page = await saveActivePageDraft();
  if (!page) {
    return;
  }

  setRoute("workspace-edit", page.id);
});

elements.editRouteLink.addEventListener("click", async (event) => {
  event.preventDefault();
  const page = await saveActivePageDraft();
  if (!page) {
    return;
  }

  setRoute("workspace-edit", page.id);
});

elements.newPageButton.addEventListener("click", async () => {
  await saveActivePageDraft();
  await createBlankPage();
});

elements.duplicatePageButton.addEventListener("click", async () => {
  await saveActivePageDraft();
  await duplicateActivePage();
});

elements.deletePageButton.addEventListener("mousedown", (event) => {
  if (currentSelectedChartElement() || currentSelectedShapeElement()) {
    event.preventDefault();
  }
});

elements.deletePageButton.addEventListener("click", async () => {
  if (deleteSelectedChart()) {
    return;
  }
  if (deleteSelectedShape()) {
    return;
  }
  await deleteActivePage();
});

elements.pageTitleEditor.addEventListener("input", handleLiveEdit);
elements.bodyEditor.addEventListener("input", handleLiveEdit);
elements.bodyEditor.addEventListener("input", (event) => {
  const shapeText = event.target.closest(".editor-shape-text");
  const shapeElement = shapeText?.closest?.(`.${SHAPE_BLOCK_CLASS}`);
  if (shapeElement instanceof HTMLElement) {
    const data = shapeElementData(shapeElement);
    if (data) {
      data.textHtml = shapeText.innerHTML.trim() || "<div>Text</div>";
      shapeElement.setAttribute(SHAPE_DATA_ATTRIBUTE, encodeShapeData(data));
      syncShapeCanvasContent(shapeElement);
    }
  }

  const panel = event.target.closest(".tabbed-container-panel");
  const containerElement = panel?.closest?.(`.${TABBED_CONTAINER_CLASS}`);
  if (!(containerElement instanceof HTMLElement)) {
    return;
  }

  syncTabbedContainerActiveContent(containerElement);
});
elements.bodyEditor.addEventListener("click", (event) => {
  const targetElement = event.target instanceof Element
    ? event.target
    : event.target instanceof Node
      ? event.target.parentElement
      : null;
  if (!(targetElement instanceof Element)) {
    return;
  }

  const tabActionButton = targetElement.closest("[data-tab-action]");
  if (tabActionButton instanceof HTMLElement) {
    const containerElement = tabActionButton.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (!(containerElement instanceof HTMLElement)) {
      return;
    }

    const action = tabActionButton.getAttribute("data-tab-action");
    if (action === "add") {
      addTabbedContainerTab(containerElement);
      return;
    }

    if (action === "remove") {
      removeTabbedContainerTab(containerElement);
      return;
    }

    if (action === "settings") {
      openTabAreaEditor(containerElement);
      return;
    }

    if (action === "delete-container") {
      if (tabAreaEditorState.containerElement === containerElement) {
        closeTabAreaEditor();
      }
      containerElement.remove();
      handleLiveEdit();
      return;
    }
  }

  const tabButton = targetElement.closest("[data-tab-id]");
  if (tabButton instanceof HTMLElement) {
    if (targetElement.closest(".tabbed-container-tab-input")) {
      return;
    }
    const containerElement = tabButton.closest(`.${TABBED_CONTAINER_CLASS}`);
    if (containerElement instanceof HTMLElement) {
      if (event.detail >= 2) {
        event.preventDefault();
        event.stopPropagation();
        renameTabbedContainerTab(containerElement, tabButton.getAttribute("data-tab-id"));
        return;
      }
      switchTabbedContainerTab(containerElement, tabButton.getAttribute("data-tab-id"), "editor");
      return;
    }
  }

  const settingsButton = targetElement.closest("[data-chart-settings='true']");
  if (!(settingsButton instanceof HTMLElement)) {
    const shapeElement = targetElement.closest(`.${SHAPE_BLOCK_CLASS}`);
    if (shapeElement instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      openShapeEditor(shapeElement);
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const chartElement = settingsButton.closest(`.${CHART_CLASS}`);
  if (chartElement instanceof HTMLElement) {
    openChartEditor(chartElement);
  }
});
elements.bodyEditor.addEventListener("dblclick", (event) => {
  const targetElement = event.target instanceof Element
    ? event.target
    : event.target instanceof Node
      ? event.target.parentElement
      : null;
  if (!(targetElement instanceof Element)) {
    return;
  }

  const shapeElement = targetElement.closest(`.${SHAPE_BLOCK_CLASS}`);
  if (shapeElement instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    openShapeEditor(shapeElement);
    focusShapeText(shapeElement);
    return;
  }

  const tabButton = targetElement.closest("[data-tab-id]");
  if (!(tabButton instanceof HTMLElement)) {
    return;
  }

  const containerElement = tabButton.closest(`.${TABBED_CONTAINER_CLASS}`);
  if (containerElement instanceof HTMLElement) {
    renameTabbedContainerTab(containerElement, tabButton.getAttribute("data-tab-id"));
  }
});
elements.publishedBody.addEventListener("click", (event) => {
  const targetElement = event.target instanceof Element
    ? event.target
    : event.target instanceof Node
      ? event.target.parentElement
      : null;
  if (!(targetElement instanceof Element)) {
    return;
  }

  const shapeElement = targetElement.closest(`.${SHAPE_BLOCK_CLASS}`);
  if (shapeElement instanceof HTMLElement) {
    const shape = shapeElementData(shapeElement);
    const linkTarget = resolveShapeLink(shape?.linkPage);
    if (linkTarget?.type === "tab") {
      event.preventDefault();
      const match = Array.from(elements.publishedBody.querySelectorAll(`.${TABBED_CONTAINER_CLASS}`)).find((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        return tabbedContainerElementData(element)?.id === linkTarget.containerId;
      });
      if (match instanceof HTMLElement) {
        switchTabbedContainerTab(match, linkTarget.tabId, "published");
      }
      return;
    }
    if (linkTarget?.type === "internal") {
      event.preventDefault();
      setRoute("page", linkTarget.pageId);
      return;
    }
    if (linkTarget?.type === "external") {
      event.preventDefault();
      window.open(linkTarget.href, "_blank", "noopener,noreferrer");
      return;
    }
  }

  const tabButton = targetElement.closest("[data-tab-id]");
  if (!(tabButton instanceof HTMLElement)) {
    return;
  }

  const containerElement = tabButton.closest(`.${TABBED_CONTAINER_CLASS}`);
  if (containerElement instanceof HTMLElement) {
    switchTabbedContainerTab(containerElement, tabButton.getAttribute("data-tab-id"), "published");
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
  if (handleSelectedObjectDeleteKey(event)) {
    event.preventDefault();
  }
});
elements.bodyEditor.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  if (!(event.target instanceof Element)) {
    return;
  }

  const shapeResizeHandle = event.target.closest("[data-shape-resize]");
  if (shapeResizeHandle instanceof HTMLElement) {
    const shapeElement = shapeResizeHandle.closest(`.${SHAPE_BLOCK_CLASS}`);
    const data = shapeElementData(shapeElement);
    if (shapeElement instanceof HTMLElement && data) {
      event.preventDefault();
      event.stopPropagation();
      openShapeEditor(shapeElement);
      shapeResizeState = {
        shapeElement,
        mode: shapeResizeHandle.getAttribute("data-shape-resize"),
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: data.x,
        startY: data.y,
        startWidth: data.width,
        startHeight: data.height
      };
      return;
    }
  }

  const shapeElement = event.target.closest(`.${SHAPE_BLOCK_CLASS}`);
  if (shapeElement instanceof HTMLElement && !event.target.closest(".editor-shape-text")) {
    const data = shapeElementData(shapeElement);
    if (data) {
      event.preventDefault();
      event.stopPropagation();
      if (shapeElement.classList.contains("object-marquee-selected")) {
        const nextMultiDragState = createMultiObjectDragState();
        if (nextMultiDragState) {
          multiObjectDragState = {
            ...nextMultiDragState,
            startClientX: event.clientX,
            startClientY: event.clientY
          };
          return;
        }
      }
      openShapeEditor(shapeElement);
      shapeDragState = {
        shapeElement,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: data.x,
        startY: data.y
      };
      return;
    }
  }

  const tabResizeHandle = event.target.closest("[data-tab-resize]");
  if (tabResizeHandle instanceof HTMLElement) {
    const containerElement = tabResizeHandle.closest(`.${TABBED_CONTAINER_CLASS}`);
    const data = tabbedContainerElementData(containerElement);
    if (containerElement instanceof HTMLElement && data) {
      event.preventDefault();
      event.stopPropagation();
      tabContainerResizeState = {
        containerElement,
        mode: tabResizeHandle.getAttribute("data-tab-resize"),
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: data.x,
        startTop: data.y,
        startWidth: data.width,
        startHeight: data.height
      };
      return;
    }
  }

  const tabHeader = event.target.closest(".tabbed-container-header");
  if (tabHeader instanceof HTMLElement
      && !event.target.closest(".tabbed-container-tab, .tabbed-container-control, .tabbed-container-panel")) {
    const containerElement = tabHeader.closest(`.${TABBED_CONTAINER_CLASS}`);
    const data = tabbedContainerElementData(containerElement);
    if (containerElement instanceof HTMLElement && data) {
      event.preventDefault();
      if (containerElement.classList.contains("object-marquee-selected")) {
        const nextMultiDragState = createMultiObjectDragState();
        if (nextMultiDragState) {
          multiObjectDragState = {
            ...nextMultiDragState,
            startClientX: event.clientX,
            startClientY: event.clientY
          };
          return;
        }
      }
      tabContainerDragState = {
        containerElement,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: data.x,
        startTop: data.y
      };
      return;
    }
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
elements.bodyEditor.addEventListener("mousedown", (event) => {
  if (
    event.button === 0
    && event.target === elements.bodyEditor
    && !state.tabAreaDrawMode
  ) {
    event.preventDefault();
    closeChartEditor({ revert: false });
    closeShapeEditor();
    closeTabAreaEditor();
    clearObjectSelectionState();

    const rect = elements.bodyEditor.getBoundingClientRect();
    const startX = event.clientX - rect.left + elements.bodyEditor.scrollLeft;
    const startY = event.clientY - rect.top + elements.bodyEditor.scrollTop;
    const previewElement = document.createElement("div");
    previewElement.className = "object-marquee-preview";
    previewElement.style.left = `${startX}px`;
    previewElement.style.top = `${startY}px`;
    previewElement.style.width = "0px";
    previewElement.style.height = "0px";
    elements.bodyEditor.appendChild(previewElement);
    objectMarqueeState = { startX, startY, previewElement };
    return;
  }

  if (!state.tabAreaDrawMode || event.button !== 0) {
    return;
  }

  if (!(event.target instanceof Element) || event.target.closest(`.${TABBED_CONTAINER_CLASS}, .${CHART_CLASS}, button, a, input, select, textarea`)) {
    return;
  }

  event.preventDefault();
  const rect = elements.bodyEditor.getBoundingClientRect();
  const startX = event.clientX - rect.left + elements.bodyEditor.scrollLeft;
  const startY = event.clientY - rect.top + elements.bodyEditor.scrollTop;
  const previewElement = document.createElement("div");
  previewElement.className = "tab-area-draw-preview";
  previewElement.style.left = `${startX}px`;
  previewElement.style.top = `${startY}px`;
  previewElement.style.width = "0px";
  previewElement.style.height = "0px";
  elements.bodyEditor.appendChild(previewElement);
  tabAreaDrawState = { startX, startY, previewElement };
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

elements.generateContentButton.addEventListener("click", () => {
  loadExampleContentIntoEditor();
});

elements.createTabAreaButton.addEventListener("click", () => {
  toggleTabAreaDrawMode();
});

elements.sidebarToggleButton.addEventListener("click", () => {
  toggleSidebarMinimized();
});

elements.bottomBarSettingsButton.addEventListener("click", () => {
  settingsModalState.open = true;
  clampSettingsModalPosition(settingsModalState.x, settingsModalState.y);
  renderSettingsModal();
});
elements.settingsModalHeader.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element) || event.target.closest("button, input, select, textarea, label")) {
    return;
  }
  event.preventDefault();
  settingsModalDragState = {
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: settingsModalState.x,
    startY: settingsModalState.y
  };
});
elements.settingsModalCloseButton.addEventListener("click", () => {
  settingsModalState.open = false;
  closeLibraryPaintPanel();
  renderSettingsModal();
});
elements.settingsModalBackdrop.addEventListener("click", () => {
  settingsModalState.open = false;
  closeLibraryPaintPanel();
  renderSettingsModal();
});
elements.settingsTabLibrary.addEventListener("click", () => {
  settingsModalState.tab = "library";
  renderSettingsModal();
});
elements.settingsTabToptabs.addEventListener("click", () => {
  settingsModalState.tab = "toptabs";
  renderSettingsModal();
});

elements.chartMenuTrigger.addEventListener("click", () => {
  toggleChartMenu();
});

elements.shapeMenuTrigger.addEventListener("click", () => {
  toggleShapeMenu();
});

elements.buttonMenuTrigger.addEventListener("click", () => {
  toggleButtonMenu();
});

elements.shapeMenuDropdown.addEventListener("click", (event) => {
  const item = event.target.closest("[data-shape-type]");
  if (!item) {
    return;
  }

  insertShapeAtCursor(item.getAttribute("data-shape-type"));
  closeShapeMenu();
});
elements.buttonMenuDropdown.addEventListener("click", (event) => {
  const item = event.target.closest("[data-button-type]");
  if (!item) {
    return;
  }

  insertShapeAtCursor(item.getAttribute("data-button-type"));
  closeButtonMenu();
});
elements.insertImageButton.addEventListener("click", () => {
  elements.insertImageInput.click();
});
elements.insertImageInput.addEventListener("change", () => {
  const [file] = Array.from(elements.insertImageInput.files || []);
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    insertImageAtCursor(String(reader.result || ""), file.name.replace(/\.[^.]+$/, ""));
    elements.insertImageInput.value = "";
  });
  reader.readAsDataURL(file);
});

elements.shapeOutlineWeightInput.addEventListener("input", updateShapeFromFlyout);
elements.shapeOutlineWeightInput.addEventListener("change", updateShapeFromFlyout);
elements.shapeLinkInput.addEventListener("input", updateShapeFromFlyout);
elements.shapeLinkInput.addEventListener("change", updateShapeFromFlyout);
elements.shapeLinkPageButton.addEventListener("click", (event) => {
  event.stopPropagation();
  shapeEditorState.pageListOpen = !(shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "page");
  shapeEditorState.linkPickerMode = shapeEditorState.pageListOpen ? "page" : null;
  renderShapeEditorFlyout();
});
elements.shapeLinkTabButton.addEventListener("click", (event) => {
  event.stopPropagation();
  shapeEditorState.pageListOpen = !(shapeEditorState.pageListOpen && shapeEditorState.linkPickerMode === "tab");
  shapeEditorState.linkPickerMode = shapeEditorState.pageListOpen ? "tab" : null;
  renderShapeEditorFlyout();
});
elements.shapeLinkPageList.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-shape-link-page]");
  if (pageButton instanceof HTMLElement) {
    const pageId = pageButton.getAttribute("data-shape-link-page");
    const page = state.pages.find((entry) => entry.id === pageId);
    if (!page) {
      return;
    }

    elements.shapeLinkInput.value = `#/page/${encodeURIComponent(page.id)}`;
    shapeEditorState.pageListOpen = false;
    shapeEditorState.linkPickerMode = null;
    updateShapeFromFlyout();
    return;
  }

  const tabButton = event.target.closest("[data-shape-link-tab]");
  if (!(tabButton instanceof HTMLElement)) {
    return;
  }

  const containerId = tabButton.getAttribute("data-shape-link-tab");
  const tabId = tabButton.getAttribute("data-shape-link-tab-id");
  if (!containerId || !tabId) {
    return;
  }

  elements.shapeLinkInput.value = `#/tab/${encodeURIComponent(containerId)}/${encodeURIComponent(tabId)}`;
  shapeEditorState.pageListOpen = false;
  shapeEditorState.linkPickerMode = null;
  updateShapeFromFlyout();
});
elements.shapeFillButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openShapePaintPanel("fill");
});
elements.shapeOutlineButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openShapePaintPanel("outline");
});
elements.shapePaintModeInputs.forEach((field) => {
  field.addEventListener("change", updateShapePaintMode);
});
elements.shapePaintAddStopButton.addEventListener("click", addShapeGradientStop);
elements.shapePaintRemoveStopButton.addEventListener("click", () => {
  const stopIndex = Number(elements.shapePaintRemoveStopButton.getAttribute("data-stop-index"));
  if (Number.isFinite(stopIndex)) {
    removeShapeGradientStop(stopIndex);
  }
});
elements.shapePaintGradientStops.addEventListener("pointerdown", (event) => {
  const dragButton = event.target.closest("[data-shape-stop-drag]");
  const slider = event.target.closest(".tab-area-gradient-stop-slider");
  if (!dragButton) {
    if (slider instanceof HTMLElement) {
      const rect = slider.getBoundingClientRect();
      const offset = clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 0);
      addShapeGradientStopAtOffset(offset);
    }
    return;
  }

  commitOpenShapeColorPreviewToDraft();
  const stopIndex = Number(dragButton.getAttribute("data-shape-stop-drag"));
  shapePaintEditorState.draggingStopIndex = stopIndex;
  openShapePaintColorPopup({ type: "gradient-stop", index: stopIndex }, dragButton.getAttribute("data-shape-stop-color"));
  updateShapeGradientStopDrag(event.clientX);
});
elements.shapePaintColorSpectrum.addEventListener("pointerdown", beginShapePaintSpectrumDrag);
[
  elements.shapePaintColorRInput,
  elements.shapePaintColorGInput,
  elements.shapePaintColorBInput
].forEach((field) => {
  field.addEventListener("input", updateShapePaintDraftFromInputs);
  field.addEventListener("change", updateShapePaintDraftFromInputs);
});
elements.shapePaintColorHueInput.addEventListener("input", updateShapePaintHue);
elements.shapePaintColorHueInput.addEventListener("change", updateShapePaintHue);
elements.shapePaintColorEyedropperButton.addEventListener("click", pickShapePaintColorWithEyedropper);
elements.shapePaintOpacityInput.addEventListener("input", updateShapeOpacityFromFlyout);
elements.shapePaintOpacityInput.addEventListener("change", updateShapeOpacityFromFlyout);
elements.shapePaintOkButton.addEventListener("click", () => {
  applyShapePaintColorPopup();
  closeShapePaintPanel({ restoreOriginal: false });
  renderShapeEditorFlyout();
});
elements.shapePaintCancelButton.addEventListener("click", () => {
  closeShapePaintPanel();
  renderShapeEditorFlyout();
});
elements.shapeCloseButton.addEventListener("click", closeShapeEditor);
elements.libraryFillButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openLibraryPaintPanel("fill");
});
elements.libraryOutlineButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openLibraryPaintPanel("outline");
});
elements.libraryPaintModeInputs.forEach((field) => {
  field.addEventListener("change", updateLibraryPaintMode);
});
elements.libraryPaintAddStopButton.addEventListener("click", addLibraryGradientStop);
elements.libraryPaintRemoveStopButton.addEventListener("click", () => {
  const stopIndex = Number(elements.libraryPaintRemoveStopButton.getAttribute("data-stop-index"));
  if (Number.isFinite(stopIndex)) {
    removeLibraryGradientStop(stopIndex);
  }
});
elements.libraryPaintGradientStops.addEventListener("pointerdown", (event) => {
  const dragButton = event.target.closest("[data-library-stop-drag]");
  const slider = event.target.closest(".tab-area-gradient-stop-slider");
  if (!dragButton) {
    if (slider instanceof HTMLElement) {
      const rect = slider.getBoundingClientRect();
      addLibraryGradientStopAtOffset(clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 0));
    }
    return;
  }
  commitOpenLibraryColorPreviewToDraft();
  const stopIndex = Number(dragButton.getAttribute("data-library-stop-drag"));
  libraryPaintEditorState.draggingStopIndex = stopIndex;
  openLibraryPaintColorPopup({ type: "gradient-stop", index: stopIndex }, dragButton.getAttribute("data-library-stop-color"));
  updateLibraryGradientStopDrag(event.clientX, event.clientY);
});
elements.libraryPaintColorSpectrum.addEventListener("pointerdown", beginLibraryPaintSpectrumDrag);
[
  elements.libraryPaintColorRInput,
  elements.libraryPaintColorGInput,
  elements.libraryPaintColorBInput
].forEach((field) => {
  field.addEventListener("input", updateLibraryPaintDraftFromInputs);
  field.addEventListener("change", updateLibraryPaintDraftFromInputs);
});
elements.libraryPaintColorHueInput.addEventListener("input", updateLibraryPaintHue);
elements.libraryPaintColorHueInput.addEventListener("change", updateLibraryPaintHue);
elements.libraryPaintColorEyedropperButton.addEventListener("click", pickLibraryPaintColorWithEyedropper);
elements.libraryPaintOpacityInput.addEventListener("input", updateLibraryPaintOpacity);
elements.libraryPaintOpacityInput.addEventListener("change", updateLibraryPaintOpacity);
elements.libraryPaintGradientTypeInput.addEventListener("change", updateLibraryGradientOptions);
elements.libraryPaintGradientDirectionInput.addEventListener("change", updateLibraryGradientOptions);
elements.libraryPaintOkButton.addEventListener("click", saveLibrarySelectionSettings);
elements.libraryPaintCancelButton.addEventListener("click", () => {
  closeLibraryPaintPanel();
  renderSettingsModal();
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
  if (!event.target.closest("#shape-menu")) {
    closeShapeMenu();
  }

  if (!event.target.closest("#button-menu")) {
    closeButtonMenu();
  }

  if (!event.target.closest("#chart-menu")) {
    closeChartMenu();
  }

  if (!event.target.closest(".tab-area-fill-picker")) {
    closeTabAreaFillPanel();
  }

  if (!event.target.closest(".shape-editor-flyout .tab-area-fill-picker") && !event.target.closest(".shape-paint-panel")) {
    closeShapePaintPanel();
  }

  if (settingsModalState.open && !event.target.closest("#library-paint-panel") && !event.target.closest("#library-fill-button") && !event.target.closest("#library-outline-button")) {
    closeLibraryPaintPanel();
    renderSettingsModal();
  }

  if (!event.target.closest(".shape-link-picker") && !event.target.closest(".shape-link-page-list")) {
    if (shapeEditorState.pageListOpen) {
      shapeEditorState.pageListOpen = false;
      shapeEditorState.linkPickerMode = null;
      renderShapeEditorFlyout();
    }
  }
});
document.addEventListener("click", (event) => {
  if (
    event.target.closest(".shape-paint-panel")
    && !event.target.closest("#shape-paint-color-popup")
    && !event.target.closest("[data-shape-stop-drag]")
    && shapePaintColorPickerState.target?.type === "gradient-stop"
    && shapePaintEditorState.draggingStopIndex == null
  ) {
    clearShapeGradientStopSelection();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && chartEditorState.open) {
    closeShapeMenu();
    closeChartMenu();
  }

  if (event.key === "Escape" && shapeEditorState.shapeElement) {
    closeShapeEditor();
  }

  if (event.key === "Escape" && state.tabAreaDrawMode) {
    toggleTabAreaDrawMode(false);
  }

  if (state.routeMode === "workspace-edit" && handleSelectedObjectDeleteKey(event)) {
    event.preventDefault();
  }
});
document.addEventListener("pointermove", (event) => {
  if (objectMarqueeState?.previewElement?.isConnected) {
    const rect = elements.bodyEditor.getBoundingClientRect();
    const currentX = event.clientX - rect.left + elements.bodyEditor.scrollLeft;
    const currentY = event.clientY - rect.top + elements.bodyEditor.scrollTop;
    const left = Math.max(0, Math.min(objectMarqueeState.startX, currentX));
    const top = Math.max(0, Math.min(objectMarqueeState.startY, currentY));
    const width = Math.abs(currentX - objectMarqueeState.startX);
    const height = Math.abs(currentY - objectMarqueeState.startY);
    objectMarqueeState.previewElement.style.left = `${left}px`;
    objectMarqueeState.previewElement.style.top = `${top}px`;
    objectMarqueeState.previewElement.style.width = `${width}px`;
    objectMarqueeState.previewElement.style.height = `${height}px`;
    updateMarqueeSelection(objectMarqueeState.previewElement);
  }

  if (tabAreaDrawState?.previewElement?.isConnected) {
    const rect = elements.bodyEditor.getBoundingClientRect();
    const currentX = event.clientX - rect.left + elements.bodyEditor.scrollLeft;
    const currentY = event.clientY - rect.top + elements.bodyEditor.scrollTop;
    const left = Math.max(0, Math.min(tabAreaDrawState.startX, currentX));
    const top = Math.max(0, Math.min(tabAreaDrawState.startY, currentY));
    const width = Math.abs(currentX - tabAreaDrawState.startX);
    const height = Math.abs(currentY - tabAreaDrawState.startY);
    tabAreaDrawState.previewElement.style.left = `${left}px`;
    tabAreaDrawState.previewElement.style.top = `${top}px`;
    tabAreaDrawState.previewElement.style.width = `${width}px`;
    tabAreaDrawState.previewElement.style.height = `${height}px`;
  }

  if (shapeDragState?.shapeElement?.isConnected) {
    const deltaX = event.clientX - shapeDragState.startClientX;
    const deltaY = event.clientY - shapeDragState.startClientY;
    moveShapeTo(
      shapeDragState.shapeElement,
      shapeDragState.startX + deltaX,
      shapeDragState.startY + deltaY
    );
  }

  if (shapeResizeState?.shapeElement?.isConnected) {
    const deltaX = event.clientX - shapeResizeState.startClientX;
    const deltaY = event.clientY - shapeResizeState.startClientY;
    let nextX = shapeResizeState.startX;
    let nextY = shapeResizeState.startY;
    let nextWidth = shapeResizeState.startWidth;
    let nextHeight = shapeResizeState.startHeight;

    if (shapeResizeState.mode.includes("e")) {
      nextWidth = shapeResizeState.startWidth + deltaX;
    }
    if (shapeResizeState.mode.includes("s")) {
      nextHeight = shapeResizeState.startHeight + deltaY;
    }
    if (shapeResizeState.mode.includes("w")) {
      nextX = shapeResizeState.startX + deltaX;
      nextWidth = shapeResizeState.startWidth - deltaX;
    }
    if (shapeResizeState.mode.includes("n")) {
      nextY = shapeResizeState.startY + deltaY;
      nextHeight = shapeResizeState.startHeight - deltaY;
    }

    if (nextWidth < 96) {
      if (shapeResizeState.mode.includes("w")) {
        nextX -= 96 - nextWidth;
      }
      nextWidth = 96;
    }

    if (nextHeight < 64) {
      if (shapeResizeState.mode.includes("n")) {
        nextY -= 64 - nextHeight;
      }
      nextHeight = 64;
    }

    resizeShapeFrame(
      shapeResizeState.shapeElement,
      nextX,
      nextY,
      nextWidth,
      nextHeight
    );
  }

  if (multiObjectDragState?.items?.length) {
    const deltaX = event.clientX - multiObjectDragState.startClientX;
    const deltaY = event.clientY - multiObjectDragState.startClientY;
    multiObjectDragState.items.forEach((item) => {
      if (!(item.element instanceof HTMLElement) || !item.element.isConnected) {
        return;
      }

      if (item.type === "shape") {
        moveShapeTo(item.element, item.startX + deltaX, item.startY + deltaY);
        return;
      }

      if (item.type === "tabbed-container") {
        moveTabbedContainerTo(item.element, item.startX + deltaX, item.startY + deltaY);
      }
    });
  }

  if (tabContainerDragState?.containerElement?.isConnected) {
    const deltaX = event.clientX - tabContainerDragState.startClientX;
    const deltaY = event.clientY - tabContainerDragState.startClientY;
    moveTabbedContainerTo(
      tabContainerDragState.containerElement,
      tabContainerDragState.startLeft + deltaX,
      tabContainerDragState.startTop + deltaY
    );
  }

  if (settingsModalDragState) {
    const deltaX = event.clientX - settingsModalDragState.startClientX;
    const deltaY = event.clientY - settingsModalDragState.startClientY;
    clampSettingsModalPosition(
      settingsModalDragState.startX + deltaX,
      settingsModalDragState.startY + deltaY
    );
    renderSettingsModal();
  }

  if (tabContainerResizeState?.containerElement?.isConnected) {
    const deltaX = event.clientX - tabContainerResizeState.startClientX;
    const deltaY = event.clientY - tabContainerResizeState.startClientY;
    let nextLeft = tabContainerResizeState.startLeft;
    let nextTop = tabContainerResizeState.startTop;
    let nextWidth = tabContainerResizeState.startWidth;
    let nextHeight = tabContainerResizeState.startHeight;

    if (tabContainerResizeState.mode === "right" || tabContainerResizeState.mode === "corner") {
      nextWidth = tabContainerResizeState.startWidth + deltaX;
    }

    if (tabContainerResizeState.mode === "left") {
      nextLeft = tabContainerResizeState.startLeft + deltaX;
      nextWidth = tabContainerResizeState.startWidth - deltaX;
    }

    if (tabContainerResizeState.mode === "bottom" || tabContainerResizeState.mode === "corner") {
      nextHeight = tabContainerResizeState.startHeight + deltaY;
    }

    if (tabContainerResizeState.mode === "top") {
      nextTop = tabContainerResizeState.startTop + deltaY;
      nextHeight = tabContainerResizeState.startHeight - deltaY;
    }

    if (nextWidth < 180) {
      if (tabContainerResizeState.mode === "left") {
        nextLeft -= 180 - nextWidth;
      }
      nextWidth = 180;
    }

    if (nextHeight < 140) {
      if (tabContainerResizeState.mode === "top") {
        nextTop -= 140 - nextHeight;
      }
      nextHeight = 140;
    }

    resizeTabbedContainerFrame(
      tabContainerResizeState.containerElement,
      nextLeft,
      nextTop,
      nextWidth,
      nextHeight
    );
  }

  if (tabAreaGradientEditorState.draggingStopIndex != null) {
    updateGradientStopDrag(event.clientX);
  }

  if (shapePaintEditorState.draggingStopIndex != null) {
    updateShapeGradientStopDrag(event.clientX);
  }

  if (libraryPaintEditorState.draggingStopIndex != null) {
    updateLibraryGradientStopDrag(event.clientX, event.clientY);
  }

  if (!chartResizeState) {
    if (tabAreaColorPickerState.draggingSpectrum) {
      updateTabAreaSpectrumFromPointer(event.clientX, event.clientY);
    }
    if (shapePaintColorPickerState.draggingSpectrum) {
      updateShapePaintSpectrumFromPointer(event.clientX, event.clientY);
    }
    if (libraryPaintColorPickerState.draggingSpectrum) {
      updateLibraryPaintSpectrumFromPointer(event.clientX, event.clientY);
    }
    return;
  }

  resizeChartFromPointer(event.clientX);

  if (tabAreaColorPickerState.draggingSpectrum) {
    updateTabAreaSpectrumFromPointer(event.clientX, event.clientY);
  }
  if (shapePaintColorPickerState.draggingSpectrum) {
    updateShapePaintSpectrumFromPointer(event.clientX, event.clientY);
  }
  if (libraryPaintColorPickerState.draggingSpectrum) {
    updateLibraryPaintSpectrumFromPointer(event.clientX, event.clientY);
  }
});
document.addEventListener("pointerup", () => {
  if (objectMarqueeState?.previewElement?.isConnected) {
    updateMarqueeSelection(objectMarqueeState.previewElement);
    objectMarqueeState.previewElement.remove();
    objectMarqueeState = null;
  }

  if (tabAreaDrawState?.previewElement?.isConnected) {
    const previewRect = tabAreaDrawState.previewElement.getBoundingClientRect();
    const editorRect = elements.bodyEditor.getBoundingClientRect();
    const width = Math.round(previewRect.width);
    const height = Math.round(previewRect.height);
    const left = Math.round(previewRect.left - editorRect.left + elements.bodyEditor.scrollLeft);
    const top = Math.round(previewRect.top - editorRect.top + elements.bodyEditor.scrollTop);
    tabAreaDrawState.previewElement.remove();
    tabAreaDrawState = null;
    toggleTabAreaDrawMode(false);

    if (width >= 140 && height >= 110) {
      createTabbedContainerAtRect({ x: left, y: top, width, height });
    }
  }

  if (tabContainerDragState?.containerElement?.isConnected) {
    handleLiveEdit();
  }
  tabContainerDragState = null;

  if (tabContainerResizeState?.containerElement?.isConnected) {
    handleLiveEdit();
  }
  tabContainerResizeState = null;

  if (shapeDragState?.shapeElement?.isConnected || shapeResizeState?.shapeElement?.isConnected) {
    handleLiveEdit();
  }
  shapeDragState = null;
  shapeResizeState = null;
  if (multiObjectDragState?.items?.some((item) => item.element instanceof HTMLElement && item.element.isConnected)) {
    handleLiveEdit();
  }
  multiObjectDragState = null;
  settingsModalDragState = null;

  if (!chartResizeState) {
    tabAreaColorPickerState.draggingSpectrum = false;
    tabAreaGradientEditorState.draggingStopIndex = null;
    shapePaintEditorState.draggingStopIndex = null;
    libraryPaintEditorState.draggingStopIndex = null;
    shapePaintColorPickerState.draggingSpectrum = false;
    libraryPaintColorPickerState.draggingSpectrum = false;
    return;
  }

  endChartResize();
  tabAreaColorPickerState.draggingSpectrum = false;
  tabAreaGradientEditorState.draggingStopIndex = null;
  shapePaintEditorState.draggingStopIndex = null;
  shapePaintColorPickerState.draggingSpectrum = false;
  libraryPaintEditorState.draggingStopIndex = null;
  libraryPaintColorPickerState.draggingSpectrum = false;
});

elements.chartCancelButton.addEventListener("click", () => closeChartEditor({ revert: true }));
elements.chartSaveButton.addEventListener("click", saveChartEditor);
elements.tabAreaCloseButton.addEventListener("click", closeTabAreaEditor);
elements.tabAreaFillButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleTabAreaFillPanel();
});
elements.tabAreaAddStopButton.addEventListener("click", addTabAreaGradientStop);
elements.tabAreaRemoveStopButton.addEventListener("click", () => {
  const stopIndex = Number(elements.tabAreaRemoveStopButton.getAttribute("data-stop-index"));
  if (Number.isFinite(stopIndex)) {
    removeGradientStop(stopIndex);
  }
});
elements.tabAreaGradientStops.addEventListener("pointerdown", (event) => {
  const dragButton = event.target.closest("[data-tab-stop-drag]");
  const slider = event.target.closest(".tab-area-gradient-stop-slider");
  if (!dragButton) {
    if (slider instanceof HTMLElement) {
      const rect = slider.getBoundingClientRect();
      const offset = clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 0);
      addTabAreaGradientStopAtOffset(offset);
    }
    return;
  }

  const stopIndex = Number(dragButton.getAttribute("data-tab-stop-drag"));
  openTabAreaColorPopup(
    { type: "gradient-stop", index: stopIndex },
    dragButton.getAttribute("data-tab-stop-color")
  );
  tabAreaGradientEditorState.draggingStopIndex = stopIndex;
  updateGradientStopDrag(event.clientX);
});
elements.tabAreaColorSpectrum.addEventListener("pointerdown", (event) => {
  beginTabAreaSpectrumDrag(event);
});
[
  elements.tabAreaColorRInput,
  elements.tabAreaColorGInput,
  elements.tabAreaColorBInput
].forEach((field) => {
  field.addEventListener("input", updateTabAreaColorDraftFromInputs);
  field.addEventListener("change", updateTabAreaColorDraftFromInputs);
});
elements.tabAreaColorHueInput.addEventListener("input", updateTabAreaHue);
elements.tabAreaColorHueInput.addEventListener("change", updateTabAreaHue);
elements.tabAreaColorEyedropperButton.addEventListener("click", pickTabAreaColorWithEyedropper);
elements.tabAreaFillOpacityInput.addEventListener("input", updateTabAreaFillOpacityFromFlyout);
elements.tabAreaFillOpacityInput.addEventListener("change", updateTabAreaFillOpacityFromFlyout);
elements.tabAreaGradientTypeInput.addEventListener("change", updateTabAreaFromFlyout);
elements.tabAreaGradientDirectionInput.addEventListener("change", updateTabAreaFromFlyout);
elements.tabAreaFillModeInputs.forEach((field) => {
  field.addEventListener("change", () => {
    const draftData = ensureTabAreaFillDraft(syncTabbedContainerActiveContent(tabAreaEditorState.containerElement));
    if (selectedTabAreaFillMode() === "gradient") {
      ensureTabAreaGradientDraft(draftData);
      const gradientData = tabAreaFillEditorState.draftData || draftData;
      const selectedStop = gradientData?.gradientStops?.[0];
      if (selectedStop) {
        openTabAreaColorPopup({ type: "gradient-stop", index: 0 }, selectedStop.color);
      }
    } else {
      clearTabAreaGradientDraft();
      openTabAreaColorPopup({ type: "solid" }, draftData?.fillColor || elements.tabAreaFillInput.value);
    }
    updateTabAreaFromFlyout();
  });
});
elements.tabAreaFillOkButton.addEventListener("click", confirmFillDraft);
elements.tabAreaFillCancelButton.addEventListener("click", cancelFillDraft);
[
  elements.tabAreaTitleInput,
  elements.tabAreaFillInput,
  elements.tabAreaRadiusInput,
  elements.tabAreaHideHeaderInput,
  elements.tabAreaHideBorderInput
].forEach((field) => {
  field.addEventListener("input", updateTabAreaFromFlyout);
  field.addEventListener("change", updateTabAreaFromFlyout);
});

window.addEventListener("hashchange", async () => {
  await saveActivePageDraft();
  applyRoute();
  renderAll();
});

applyRoute();
renderAll();
