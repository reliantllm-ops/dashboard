import React from "react";
import ForgeReconciler, {
  Image,
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
const DEFAULT_BAR_WIDTH = 48;
const DEFAULT_BAR_GAP = 12;
const DEFAULT_GRADIENT = false;
const COLOR_OPTIONS = [
  { label: "Blue", value: "blue", hex: "#0052CC", gradientHex: "#4C9AFF" },
  { label: "Green", value: "green", hex: "#36B37E", gradientHex: "#79F2C0" },
  { label: "Red", value: "red", hex: "#DE350B", gradientHex: "#FF8F73" },
  { label: "Orange", value: "orange", hex: "#FF8B00", gradientHex: "#FFC400" },
  { label: "Purple", value: "purple", hex: "#6554C0", gradientHex: "#998DD9" },
  { label: "Teal", value: "teal", hex: "#00B8D9", gradientHex: "#79E2F2" }
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

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

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

const buildChartSvg = ({ title, rows, width, height, colorHex, gradientHex, barWidth, barGap, useGradient }) => {
  const maxValue = Math.max(...rows.map((row) => row.value), 20, 1);
  const titleHeight = 20;
  const valueLabelHeight = 22;
  const plotTop = titleHeight + valueLabelHeight;
  const plotHeight = height;
  const axisGap = 8;
  const labelRowHeight = 24;
  const leftPad = 36;
  const rightPad = 12;
  const axisY = plotTop + plotHeight;
  const labelY = axisY + 18;
  const innerWidth = rows.length * barWidth + Math.max(0, rows.length - 1) * barGap;
  const svgWidth = Math.max(width, leftPad + innerWidth + rightPad);
  const svgHeight = axisY + axisGap + labelRowHeight;
  const plotRight = svgWidth - rightPad;
  const guides = [10, 20];

  const defs = useGradient
    ? `<defs>${rows
        .map(
          (_, index) =>
            `<linearGradient id="bar-gradient-${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${gradientHex}"/><stop offset="100%" stop-color="${colorHex}"/></linearGradient>`
        )
        .join("")}</defs>`
    : "";

  const guideMarkup = guides
    .map((guide) => {
      const y = plotTop + plotHeight - (guide / maxValue) * plotHeight;
      return `<line x1="${leftPad}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="#8590A2" stroke-width="1" />`;
    })
    .join("");

  const yLabels = guides
    .map((guide) => {
      const y = plotTop + plotHeight - (guide / maxValue) * plotHeight;
      return `<text x="${leftPad - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="#44546F">${guide}</text>`;
    })
    .join("");

  const bars = rows
    .map((row, index) => {
      const x = leftPad + index * (barWidth + barGap);
      const barHeight = Math.max(8, Math.round((row.value / maxValue) * plotHeight));
      const y = axisY - barHeight;
      const fill = useGradient ? `url(#bar-gradient-${index})` : colorHex;

      return [
        `<text x="${x + barWidth / 2}" y="${plotTop - 6}" text-anchor="middle" font-size="12" fill="#172B4D">${escapeXml(row.value)}</text>`,
        `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" ry="4" fill="${fill}" />`,
        `<text x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" font-size="12" fill="#172B4D">${escapeXml(row.label)}</text>`
      ].join("");
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    ${defs}
    <text x="0" y="14" font-size="14" font-weight="700" fill="#172B4D">${escapeXml(title)}</text>
    ${guideMarkup}
    <line x1="${leftPad}" y1="${plotTop}" x2="${leftPad}" y2="${axisY}" stroke="#172B4D" stroke-width="2" />
    <line x1="${leftPad}" y1="${axisY}" x2="${plotRight}" y2="${axisY}" stroke="#172B4D" stroke-width="2" />
    ${yLabels}
    ${bars}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const CustomBarChart = ({ title, rows, width, height, colorHex, gradientHex, barWidth, barGap, useGradient }) => (
  <Image
    src={buildChartSvg({ title, rows, width, height, colorHex, gradientHex, barWidth, barGap, useGradient })}
    alt={`${title} bar chart`}
  />
);

const App = () => {
  const config = useConfig() ?? {};
  const title = String(config.title ?? "").trim() || DEFAULT_TITLE;
  const color = normalizeColor(config.color);
  const colorOption = COLOR_OPTIONS.find((option) => option.value === color) ?? COLOR_OPTIONS[0];
  const width = normalizeDimension(config.width, DEFAULT_WIDTH, 240, 900);
  const height = normalizeDimension(config.height, DEFAULT_HEIGHT, 240, 700);
  const barWidth = normalizeDimension(config.barWidth, DEFAULT_BAR_WIDTH, 12, 120);
  const barGap = normalizeDimension(config.barGap, DEFAULT_BAR_GAP, 0, 48);
  const useGradient = Boolean(config.useGradient ?? DEFAULT_GRADIENT);

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
      <CustomBarChart
        title={title}
        width={width}
        height={height}
        rows={rows}
        colorHex={colorOption.hex}
        gradientHex={colorOption.gradientHex}
        barWidth={barWidth}
        barGap={barGap}
        useGradient={useGradient}
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
