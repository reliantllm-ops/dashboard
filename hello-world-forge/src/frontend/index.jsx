import React, { useEffect } from "react";
import ForgeReconciler, {
  Frame,
  SectionMessage,
  Stack,
  Strong,
  Text,
  useConfig
} from "@forge/react";
import { events } from "@forge/bridge";

const DEFAULT_TITLE = "Quarterly sales";
const DEFAULT_DATA = `Q1,12
Q2,18
Q3,9
Q4,22`;
const DEFAULT_COLOR = "blue";
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

const normalizeColor = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  return COLOR_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_COLOR;
};

const isHexColor = (value) => /^#([0-9a-fA-F]{6})$/.test(String(value ?? "").trim());

const normalizeGradientColor = (rawValue, fallback = DEFAULT_COLOR) => {
  const value = String(rawValue ?? "").trim();
  if (COLOR_OPTIONS.some((option) => option.value === value)) {
    return value;
  }

  return isHexColor(value) ? value.toUpperCase() : fallback;
};

const normalizeDimension = (rawValue, fallback, min, max) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
};

const normalizeBackgroundColor = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(value) ? value.toUpperCase() : DEFAULT_BACKGROUND_COLOR;
};

const normalizeBackgroundMode = (rawValue) => (String(rawValue ?? "").trim() === "gradient" ? "gradient" : "solid");
const normalizeBarMode = (rawValue) => (String(rawValue ?? "").trim() === "solid" ? "solid" : "gradient");
const colorValueToHex = (rawValue, fallbackHex) => {
  const value = String(rawValue ?? "").trim();
  if (isHexColor(value)) return value.toUpperCase();
  const option = COLOR_OPTIONS.find((entry) => entry.value === value);
  return option ? option.hex : fallbackHex;
};

const parseRows = (rawValue) =>
  String(rawValue ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, value] = line.split(",").map((part) => part?.trim());
      const numericValue = Number(value);

      if (!label || !Number.isFinite(numericValue)) {
        throw new Error(`Line ${index + 1} must look like Label,Value`);
      }

      return {
        label,
        value: numericValue
      };
    });

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
  const title = String(config.title ?? "").trim() || DEFAULT_TITLE;
  const color = normalizeColor(config.color);
  const barMode = config.barMode ? normalizeBarMode(config.barMode) : config.useGradient === false ? "solid" : "gradient";
  const barColor = colorValueToHex(config.barColor ?? config.color, DEFAULT_BAR_COLOR);
  const backgroundMode = normalizeBackgroundMode(config.backgroundMode);
  const backgroundColor = normalizeBackgroundColor(config.backgroundColor);
  const backgroundGradientStartColor = normalizeBackgroundColor(config.backgroundGradientStartColor ?? config.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
  const backgroundGradientEndColor = normalizeBackgroundColor(config.backgroundGradientEndColor ?? "#E9F2FF");
  const colorOption = COLOR_OPTIONS.find((option) => option.value === color) ?? COLOR_OPTIONS[0];
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

  let rows = [];
  let errorMessage = "";

  try {
    rows = parseRows(config.data ?? DEFAULT_DATA);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to parse chart data.";
  }

  if (errorMessage) {
    return (
      <SectionMessage appearance="error" title="Chart data error">
        <Text>{errorMessage}</Text>
      </SectionMessage>
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
    color,
    backgroundMode,
    backgroundColor,
    backgroundGradientStartColor,
    backgroundGradientEndColor,
    colorHex: colorOption.hex,
    barGradientStartColor,
    barGradientEndColor
  };

  return (
    <Stack space="space.100">
      <Text>
        <Strong>Simple bar chart</Strong>
      </Text>
      <CustomBarChart payload={payload} />
      <SectionMessage appearance="info" title="Configuration">
        <Text>Use Configure in edit mode to change the chart title, color, and bar values.</Text>
      </SectionMessage>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
