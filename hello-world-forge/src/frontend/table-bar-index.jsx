import React, { useEffect, useMemo, useState } from "react";
import ForgeReconciler, {
  Frame,
  SectionMessage,
  Stack,
  Strong,
  Text,
  useConfig
} from "@forge/react";
import { events, requestConfluence, view } from "@forge/bridge";

const DEFAULT_TITLE = "Table bar chart";
const DEFAULT_BAR_COLOR = "#0052CC";
const DEFAULT_BACKGROUND_COLOR = "#FFFFFF";
const DEFAULT_BAR_GRADIENT_START_COLOR = "#0052CC";
const DEFAULT_BAR_GRADIENT_END_COLOR = "#00B8D9";
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
const DEFAULT_LEFT_PLOT_PADDING = 0;
const DEFAULT_BAR_WIDTH = 48;
const DEFAULT_BAR_GAP = 12;
const DEFAULT_AXIS_INTERVAL = 10;
const PROPERTY_KEY = "forge_table_sources_v1";
const FRAME_RESOURCE = "bar-chart-2-frame";
const FRAME_READY_EVENT = "bar-chart-2:ready";
const FRAME_UPDATE_EVENT = "bar-chart-2:update";
const COLOR_OPTIONS = [
  { label: "Blue", value: "blue", hex: "#0052CC" },
  { label: "Green", value: "green", hex: "#36B37E" },
  { label: "Red", value: "red", hex: "#DE350B" },
  { label: "Orange", value: "orange", hex: "#FF8B00" },
  { label: "Purple", value: "purple", hex: "#6554C0" },
  { label: "Teal", value: "teal", hex: "#00B8D9" }
];

const normalizeDimension = (rawValue, fallback, min, max) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
};

const isHexColor = (value) => /^#([0-9a-fA-F]{6})$/.test(String(value ?? "").trim());

const normalizeBackgroundColor = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  return isHexColor(value) ? value.toUpperCase() : DEFAULT_BACKGROUND_COLOR;
};

const normalizeBackgroundMode = (rawValue) => (String(rawValue ?? "").trim() === "gradient" ? "gradient" : "solid");
const normalizeBarMode = (rawValue) => (String(rawValue ?? "").trim() === "solid" ? "solid" : "gradient");

const colorValueToHex = (rawValue, fallbackHex) => {
  const value = String(rawValue ?? "").trim();
  if (isHexColor(value)) {
    return value.toUpperCase();
  }

  const option = COLOR_OPTIONS.find((entry) => entry.value === value);
  return option ? option.hex : fallbackHex;
};

const getProperty = async (pageId) => {
  const response = await requestConfluence(`/wiki/rest/api/content/${pageId}/property/${PROPERTY_KEY}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Unable to load source property (${response.status}).`);
  }
  return response.json();
};

const CustomBarChart = ({ payload }) => {
  useEffect(() => {
    let subscription;

    const pushState = () => {
      void events.emit(FRAME_UPDATE_EVENT, payload);
    };

    pushState();

    void events.on(FRAME_READY_EVENT, pushState).then((nextSubscription) => {
      subscription = nextSubscription;
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [payload]);

  return <Frame resource={FRAME_RESOURCE} height={`${payload.height + 112}px`} width="100%" />;
};

const App = () => {
  const config = useConfig() ?? {};
  const [currentPageId, setCurrentPageId] = useState("");
  const [sourceState, setSourceState] = useState({ loading: true, rows: [], sourceName: "", error: "" });

  useEffect(() => {
    let mounted = true;

    const loadContext = async () => {
      try {
        const context = await view.getContext();
        if (!mounted) {
          return;
        }
        setCurrentPageId(String(context?.extension?.content?.id ?? ""));
      } catch {
        if (!mounted) {
          return;
        }
        setCurrentPageId("");
      }
    };

    void loadContext();

    return () => {
      mounted = false;
    };
  }, []);

  const sourcePageId = String(config.sourcePageId ?? "").trim() || currentPageId;
  const sourceKey = String(config.sourceKey ?? "").trim();

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      if (!sourcePageId || !sourceKey) {
        setSourceState({
          loading: false,
          rows: [],
          sourceName: "",
          error: "Configure both Source page ID and Source key."
        });
        return;
      }

      try {
        const property = await getProperty(sourcePageId);
        const source = property?.value?.[sourceKey];

        if (!source) {
          throw new Error("The selected table source was not found.");
        }

        const rows = Array.isArray(source.rows) ? source.rows : [];
        if (!rows.length) {
          throw new Error("The selected source does not contain any chart rows.");
        }

        if (!cancelled) {
          setSourceState({
            loading: false,
            rows,
            sourceName: String(source.sourceName ?? sourceKey),
            error: ""
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSourceState({
            loading: false,
            rows: [],
            sourceName: "",
            error: error instanceof Error ? error.message : "Unable to load source data."
          });
        }
      }
    };

    setSourceState((previous) => ({ ...previous, loading: true, error: "" }));
    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [sourceKey, sourcePageId]);

  const title = String(config.title ?? "").trim() || sourceState.sourceName || DEFAULT_TITLE;
  const barMode = config.barMode ? normalizeBarMode(config.barMode) : config.useGradient === false ? "solid" : "gradient";
  const barColor = colorValueToHex(config.barColor ?? config.color, DEFAULT_BAR_COLOR);
  const backgroundMode = normalizeBackgroundMode(config.backgroundMode);
  const backgroundColor = normalizeBackgroundColor(config.backgroundColor);
  const backgroundGradientStartColor = normalizeBackgroundColor(config.backgroundGradientStartColor ?? config.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
  const backgroundGradientEndColor = normalizeBackgroundColor(config.backgroundGradientEndColor ?? "#E9F2FF");
  const legacyStart = Array.isArray(config.gradientStops) && config.gradientStops[0] ? config.gradientStops[0].color : config.gradientStartColor ?? config.color;
  const legacyEnd = Array.isArray(config.gradientStops) && config.gradientStops[config.gradientStops.length - 1]
    ? config.gradientStops[config.gradientStops.length - 1].color
    : config.gradientEndColor ?? config.color;
  const barGradientStartColor = colorValueToHex(config.barGradientStartColor ?? legacyStart, DEFAULT_BAR_GRADIENT_START_COLOR);
  const barGradientEndColor = colorValueToHex(config.barGradientEndColor ?? legacyEnd, DEFAULT_BAR_GRADIENT_END_COLOR);
  const width = normalizeDimension(config.width, DEFAULT_WIDTH, 240, 900);
  const height = normalizeDimension(config.height, DEFAULT_HEIGHT, 240, 700);
  const leftPlotPadding = normalizeDimension(config.leftPlotPadding, DEFAULT_LEFT_PLOT_PADDING, 0, 120);
  const barWidth = normalizeDimension(config.barWidth, DEFAULT_BAR_WIDTH, 12, 120);
  const barGap = normalizeDimension(config.barGap, DEFAULT_BAR_GAP, 0, 48);
  const axisInterval = normalizeDimension(config.axisInterval, DEFAULT_AXIS_INTERVAL, 1, 100);

  const rows = useMemo(
    () =>
      sourceState.rows.map((row) => ({
        label: String(row.label ?? ""),
        value: Number(row.value ?? 0)
      })),
    [sourceState.rows]
  );

  if (sourceState.loading) {
    return (
      <SectionMessage appearance="info" title="Loading source">
        <Text>Loading table source...</Text>
      </SectionMessage>
    );
  }

  if (sourceState.error) {
    return (
      <Stack space="space.100">
        <Text>
          <Strong>Table bar chart view</Strong>
        </Text>
        <SectionMessage appearance="warning" title="Source error">
          <Text>{sourceState.error}</Text>
        </SectionMessage>
      </Stack>
    );
  }

  const payload = {
    title,
    rows,
    width,
    height,
    leftPlotPadding,
    barWidth,
    barGap,
    axisInterval,
    barMode,
    barColor,
    backgroundMode,
    backgroundColor,
    backgroundGradientStartColor,
    backgroundGradientEndColor,
    barGradientStartColor,
    barGradientEndColor
  };

  return (
    <Stack space="space.100">
      <Text>
        <Strong>{title}</Strong>
      </Text>
      <CustomBarChart payload={payload} />
      <SectionMessage appearance="info" title="Data source">
        <Text>
          Reading source <Strong>{sourceKey}</Strong> from page <Strong>{sourcePageId}</Strong>.
        </Text>
      </SectionMessage>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
