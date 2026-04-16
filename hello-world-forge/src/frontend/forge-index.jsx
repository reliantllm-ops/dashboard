import React from "react";
import ForgeReconciler, {
  BarChart,
  SectionMessage,
  Stack,
  Strong,
  Text,
  useConfig
} from "@forge/react";

const DEFAULT_TITLE = "Quarterly sales";
const DEFAULT_DATA = `Q1,12
Q2,18
Q3,9
Q4,22`;
const DEFAULT_COLOR = "blue";
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
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
        group: "bars",
        label,
        value: numericValue
      };
    });

const App = () => {
  const config = useConfig() ?? {};
  const title = String(config.title ?? "").trim() || DEFAULT_TITLE;
  const color = normalizeColor(config.color);
  const colorOption = COLOR_OPTIONS.find((option) => option.value === color) ?? COLOR_OPTIONS[0];
  const width = normalizeDimension(config.width, DEFAULT_WIDTH, 240, 900);
  const height = normalizeDimension(config.height, DEFAULT_HEIGHT, 240, 700);

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

  return (
    <Stack space="space.100">
      <Text>
        <Strong>Simple bar chart</Strong>
      </Text>
      <BarChart
        data={rows}
        xAccessor="label"
        yAccessor="value"
        title={title}
        width={width}
        height={height}
        colorAccessor="group"
        colorPalette={[{ key: "bars", value: colorOption.hex }]}
      />
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
