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
const DEFAULT_GRADIENT_START_COLOR = "blue";
const DEFAULT_GRADIENT_END_COLOR = "teal";
const DEFAULT_GRADIENT_STOPS = [
  { color: DEFAULT_GRADIENT_START_COLOR, offset: 0 },
  { color: DEFAULT_GRADIENT_END_COLOR, offset: 100 }
];
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
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

const normalizeDimension = (rawValue, fallback, min, max) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
};

const normalizeGradientStops = (rawValue, fallbackStartColor, fallbackEndColor) => {
  if (!Array.isArray(rawValue)) {
    return [
      { color: normalizeColor(fallbackStartColor), offset: 0 },
      { color: normalizeColor(fallbackEndColor), offset: 100 }
    ];
  }

  const normalized = rawValue
    .map((stop, index) => ({
      color: normalizeColor(stop?.color),
      offset: normalizeDimension(stop?.offset, index === 0 ? 0 : 100, 0, 100)
    }))
    .sort((left, right) => left.offset - right.offset);

  return normalized.length >= 2
    ? normalized
    : [
        { color: normalizeColor(fallbackStartColor), offset: 0 },
        { color: normalizeColor(fallbackEndColor), offset: 100 }
      ];
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
  const gradientStartColor = normalizeColor(config.gradientStartColor ?? color ?? DEFAULT_GRADIENT_START_COLOR);
  const gradientEndColor = normalizeColor(config.gradientEndColor ?? color ?? DEFAULT_GRADIENT_END_COLOR);
  const gradientStops = normalizeGradientStops(
    config.gradientStops,
    gradientStartColor ?? DEFAULT_GRADIENT_STOPS[0].color,
    gradientEndColor ?? DEFAULT_GRADIENT_STOPS[1].color
  );
  const colorOption = COLOR_OPTIONS.find((option) => option.value === color) ?? COLOR_OPTIONS[0];
  const gradientStartOption = COLOR_OPTIONS.find((option) => option.value === gradientStartColor) ?? COLOR_OPTIONS[0];
  const gradientEndOption = COLOR_OPTIONS.find((option) => option.value === gradientEndColor) ?? COLOR_OPTIONS[COLOR_OPTIONS.length - 1];
  const width = normalizeDimension(config.width, DEFAULT_WIDTH, 240, 900);
  const height = normalizeDimension(config.height, DEFAULT_HEIGHT, 240, 700);
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
    barWidth,
    barGap,
    axisInterval,
    useGradient: true,
    color,
    colorHex: colorOption.hex,
    gradientStartColor,
    gradientStartHex: gradientStartOption.hex,
    gradientEndColor,
    gradientEndHex: gradientEndOption.hex,
    gradientStops: gradientStops.map((stop) => ({
      color: stop.color,
      offset: stop.offset,
      hex: (COLOR_OPTIONS.find((option) => option.value === stop.color) ?? colorOption).hex
    }))
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
