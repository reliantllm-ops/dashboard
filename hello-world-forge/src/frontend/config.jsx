import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  Frame,
  Inline,
  Pressable,
  Range,
  SectionMessage,
  Stack,
  Strong,
  Text,
  TextArea,
  Textfield,
  xcss
} from "@forge/react";
import { events, view } from "@forge/bridge";

const DEFAULTS = {
  title: "Quarterly sales",
  data: `Q1,12
Q2,18
Q3,9
Q4,22`,
  color: "blue",
  gradientStartColor: "blue",
  gradientEndColor: "teal",
  gradientStops: [
    { color: "blue", offset: 0 },
    { color: "teal", offset: 100 }
  ],
  axisInterval: 10,
  width: 480,
  height: 320,
  barWidth: 48,
  barGap: 12,
  useGradient: true
};

const FRAME_RESOURCE = "bar-chart-2-frame";
const FRAME_READY_EVENT = "bar-chart-2:ready";
const FRAME_UPDATE_EVENT = "bar-chart-2:update";

const COLOR_OPTIONS = [
  { label: "Blue", value: "blue", hex: "#0052CC", background: "color.background.accent.blue.bolder" },
  { label: "Green", value: "green", hex: "#36B37E", background: "color.background.accent.green.bolder" },
  { label: "Red", value: "red", hex: "#DE350B", background: "color.background.accent.red.bolder" },
  { label: "Orange", value: "orange", hex: "#FF8B00", background: "color.background.accent.orange.bolder" },
  { label: "Purple", value: "purple", hex: "#6554C0", background: "color.background.accent.purple.bolder" },
  { label: "Teal", value: "teal", hex: "#00B8D9", background: "color.background.accent.teal.bolder" }
];

const tileStyles = xcss({
  width: "16px",
  height: "16px",
  borderRadius: "border.radius.100"
});

const selectedTileStyles = xcss({
  width: "16px",
  height: "16px",
  borderRadius: "border.radius.100",
  borderWidth: "border.width.selected",
  borderStyle: "solid",
  borderColor: "color.border.selected"
});

const gradientPreviewStyles = xcss({
  width: "48px",
  height: "16px",
  borderRadius: "border.radius.100",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderColor: "color.border"
});

const sliderWrapStyles = xcss({
  width: "20%"
});

const sliderInlineStyles = xcss({
  marginBlockStart: "space.negative.025"
});

const controlsColumnStyles = xcss({
  width: "35%"
});

const previewColumnStyles = xcss({
  width: "65%",
  borderInlineStartWidth: "border.width.selected",
  borderInlineStartStyle: "solid",
  borderInlineStartColor: "color.border.selected",
  paddingInlineStart: "space.250"
});

const stopRowStyles = xcss({
  paddingBlock: "space.100",
  paddingInline: "space.100",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderColor: "color.border",
  borderRadius: "border.radius.200"
});

const stopOffsetFieldStyles = xcss({
  width: "72px"
});

const axisIntervalFieldStyles = xcss({
  width: "96px"
});

const accordionBodyStyles = xcss({
  paddingBlockStart: "space.100"
});

const footerActionBoxStyles = xcss({
  minWidth: "96px",
  minHeight: "36px",
  paddingInline: "space.150",
  paddingBlock: "space.100",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderColor: "color.border",
  borderRadius: "border.radius.100"
});

const normalizeColor = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  return COLOR_OPTIONS.some((option) => option.value === value) ? value : DEFAULTS.color;
};

const normalizeDimension = (rawValue, fallback, min, max) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
};

const normalizeAxisInterval = (rawValue) => normalizeDimension(rawValue, DEFAULTS.axisInterval, 1, 100);

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

const normalizeTextValue = (rawValue, fallback = "") => {
  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (rawValue && typeof rawValue === "object") {
    const targetValue = rawValue.target?.value ?? rawValue.currentTarget?.value;
    if (typeof targetValue === "string") {
      return targetValue;
    }
  }

  return fallback;
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

const buildGradientPreview = (stops) =>
  `linear-gradient(135deg, ${stops
    .map((stop) => {
      const option = COLOR_OPTIONS.find((item) => item.value === stop.color) ?? COLOR_OPTIONS[0];
      return `${option.hex} ${stop.offset}%`;
    })
    .join(", ")})`;

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

const ColorTile = ({ option, selected, onSelect }) => (
  <Pressable onClick={() => onSelect(option.value)}>
    <Box xcss={selected ? selectedTileStyles : tileStyles} backgroundColor={option.background} />
  </Pressable>
);

const App = () => {
  const [config, setConfig] = useState(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeriesOpen, setIsSeriesOpen] = useState(false);
  const [isGradientOpen, setIsGradientOpen] = useState(false);
  const [isSizingOpen, setIsSizingOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      try {
        const context = await view.getContext();
        const existingConfig = context?.extension?.config ?? {};

        if (isMounted) {
          setConfig({
            title: String(existingConfig.title ?? DEFAULTS.title),
            data: String(existingConfig.data ?? DEFAULTS.data),
            color: normalizeColor(existingConfig.color),
            gradientStartColor: normalizeColor(existingConfig.gradientStartColor ?? existingConfig.color ?? DEFAULTS.gradientStartColor),
            gradientEndColor: normalizeColor(existingConfig.gradientEndColor ?? existingConfig.color ?? DEFAULTS.gradientEndColor),
            gradientStops: normalizeGradientStops(
              existingConfig.gradientStops,
              existingConfig.gradientStartColor ?? existingConfig.color ?? DEFAULTS.gradientStartColor,
              existingConfig.gradientEndColor ?? existingConfig.color ?? DEFAULTS.gradientEndColor
            ),
            axisInterval: normalizeAxisInterval(existingConfig.axisInterval),
            width: normalizeDimension(existingConfig.width, DEFAULTS.width, 240, 900),
            height: normalizeDimension(existingConfig.height, DEFAULTS.height, 240, 700),
            barWidth: normalizeDimension(existingConfig.barWidth, DEFAULTS.barWidth, 12, 120),
            barGap: normalizeDimension(existingConfig.barGap, DEFAULTS.barGap, 0, 48),
            useGradient: true
          });
          setIsLoading(false);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load macro configuration.");
          setIsLoading(false);
        }
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field) => (value) => {
    setConfig((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateTextField = (field) => (value) => {
    setConfig((current) => ({
      ...current,
      [field]: normalizeTextValue(value, String(current[field] ?? ""))
    }));
  };

  const updateGradientStop = (index, updates) => {
    setConfig((current) => {
      const gradientStops = normalizeGradientStops(
        current.gradientStops,
        current.gradientStartColor ?? current.color ?? DEFAULTS.gradientStartColor,
        current.gradientEndColor ?? current.color ?? DEFAULTS.gradientEndColor
      );

      return {
        ...current,
        gradientStops: gradientStops.map((stop, stopIndex) =>
          stopIndex === index
            ? {
                ...stop,
                ...updates
              }
            : stop
        )
      };
    });
  };

  const addGradientStop = () => {
    setConfig((current) => {
      const gradientStops = normalizeGradientStops(
        current.gradientStops,
        current.gradientStartColor ?? current.color ?? DEFAULTS.gradientStartColor,
        current.gradientEndColor ?? current.color ?? DEFAULTS.gradientEndColor
      );

      if (gradientStops.length >= 5) {
        return current;
      }

      const lastStop = gradientStops[gradientStops.length - 1] ?? DEFAULTS.gradientStops[1];
      const nextOffset = Math.min(100, Math.round((lastStop.offset + 100) / 2));

      return {
        ...current,
        gradientStops: [...gradientStops, { color: lastStop.color, offset: nextOffset }]
      };
    });
  };

  const removeGradientStop = (index) => {
    setConfig((current) => {
      const gradientStops = normalizeGradientStops(
        current.gradientStops,
        current.gradientStartColor ?? current.color ?? DEFAULTS.gradientStartColor,
        current.gradientEndColor ?? current.color ?? DEFAULTS.gradientEndColor
      );

      return {
        ...current,
        gradientStops:
          gradientStops.length <= 2 ? gradientStops : gradientStops.filter((_, stopIndex) => stopIndex !== index)
      };
    });
  };

  const submit = async () => {
    setIsSaving(true);
    setError("");

    try {
      const gradientStops = normalizeGradientStops(
        config.gradientStops,
        config.gradientStartColor ?? config.color ?? DEFAULTS.gradientStartColor,
        config.gradientEndColor ?? config.color ?? DEFAULTS.gradientEndColor
      );

      await view.submit({
        config: {
          title: String(config.title ?? "").trim() || DEFAULTS.title,
          data: String(config.data ?? "").trim() || DEFAULTS.data,
          color: normalizeColor(config.color),
          gradientStartColor: gradientStops[0].color,
          gradientEndColor: gradientStops[gradientStops.length - 1].color,
          gradientStops,
          axisInterval: normalizeAxisInterval(config.axisInterval),
          width: normalizeDimension(config.width, DEFAULTS.width, 240, 900),
          height: normalizeDimension(config.height, DEFAULTS.height, 240, 700),
          barWidth: normalizeDimension(config.barWidth, DEFAULTS.barWidth, 12, 120),
          barGap: normalizeDimension(config.barGap, DEFAULTS.barGap, 0, 48),
          useGradient: true
        }
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save macro configuration.");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Text>Loading configuration...</Text>;
  }

  const normalizedGradientStops = normalizeGradientStops(
    config.gradientStops,
    config.gradientStartColor ?? config.color ?? DEFAULTS.gradientStartColor,
    config.gradientEndColor ?? config.color ?? DEFAULTS.gradientEndColor
  );
  const selectedColor = COLOR_OPTIONS.find((option) => option.value === config.color) ?? COLOR_OPTIONS[0];
  const selectedGradientStartColor =
    COLOR_OPTIONS.find((option) => option.value === normalizedGradientStops[0]?.color) ?? selectedColor;
  const selectedGradientEndColor =
    COLOR_OPTIONS.find((option) => option.value === normalizedGradientStops[normalizedGradientStops.length - 1]?.color) ?? selectedColor;
  let previewRows = [];
  let previewError = "";

  try {
    previewRows = parseRows(config.data);
  } catch (loadError) {
    previewError = loadError instanceof Error ? loadError.message : "Unable to build preview.";
  }

  const previewPayload = {
    title: String(config.title ?? "").trim() || DEFAULTS.title,
    rows: previewRows,
    width: normalizeDimension(config.width, DEFAULTS.width, 240, 900),
    height: normalizeDimension(config.height, DEFAULTS.height, 240, 700),
    barWidth: normalizeDimension(config.barWidth, DEFAULTS.barWidth, 12, 120),
    barGap: normalizeDimension(config.barGap, DEFAULTS.barGap, 0, 48),
    axisInterval: normalizeAxisInterval(config.axisInterval),
    useGradient: true,
    color: selectedColor.value,
    colorHex: selectedColor.hex,
    gradientStartColor: selectedGradientStartColor.value,
    gradientStartHex: selectedGradientStartColor.hex,
    gradientEndColor: selectedGradientEndColor.value,
    gradientEndHex: selectedGradientEndColor.hex,
    gradientStops: normalizedGradientStops.map((stop) => ({
      color: stop.color,
      offset: stop.offset,
      hex: (COLOR_OPTIONS.find((option) => option.value === stop.color) ?? selectedColor).hex
    }))
  };

  return (
    <Stack space="space.200">
      <Text>
        <Strong>Bar chart configuration</Strong>
      </Text>
      {error ? (
        <SectionMessage appearance="error" title="Configuration error">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}

      <Inline space="space.200" alignBlock="start" shouldWrap={false}>
        <Box xcss={controlsColumnStyles}>
          <Stack space="space.200">
            <Stack space="space.050">
              <Pressable onClick={() => setIsSeriesOpen((current) => !current)}>
                <Inline space="space.050" alignBlock="center">
                  <Text>Series</Text>
                  <Text>{isSeriesOpen ? "−" : "+"}</Text>
                </Inline>
              </Pressable>

              {isSeriesOpen ? (
                <Box xcss={accordionBodyStyles}>
                  <Stack space="space.100">
                    <TextArea
                      name="data"
                      value={config.data}
                      onChange={updateTextField("data")}
                      placeholder={"Q1,12\nQ2,18\nQ3,9"}
                      isMonospaced
                    />
                    <Inline space="space.100" alignBlock="center">
                      <Text>Axis interval</Text>
                      <Box xcss={axisIntervalFieldStyles}>
                        <Textfield
                          name="axisInterval"
                          type="number"
                          value={String(config.axisInterval)}
                          onChange={updateTextField("axisInterval")}
                        />
                      </Box>
                    </Inline>
                  </Stack>
                </Box>
              ) : null}
            </Stack>

            <Stack space="space.050">
              <Pressable onClick={() => setIsGradientOpen((current) => !current)}>
                <Inline space="space.050" alignBlock="center">
                  <Text>Gradient</Text>
                  <Text>{isGradientOpen ? "−" : "+"}</Text>
                </Inline>
              </Pressable>

              {isGradientOpen ? (
                <Box xcss={accordionBodyStyles}>
                  <Stack space="space.100">
                    <Inline space="space.100" alignBlock="center">
                      <Text>
                        <Strong>Multiple stops</Strong>
                      </Text>
                      <Box
                        xcss={gradientPreviewStyles}
                        style={{
                          background: buildGradientPreview(normalizedGradientStops)
                        }}
                      />
                      <Button appearance="subtle" onClick={addGradientStop} isDisabled={normalizedGradientStops.length >= 5}>
                        Add stop
                      </Button>
                    </Inline>

                    {normalizedGradientStops.map((stop, index) => (
                      <Box key={`gradient-stop-${index}`} xcss={stopRowStyles}>
                        <Stack space="space.100">
                          <Inline space="space.100" alignBlock="center">
                            <Text>
                              <Strong>Stop {index + 1}</Strong>
                            </Text>
                            <Box
                              xcss={gradientPreviewStyles}
                              style={{
                                background:
                                  (COLOR_OPTIONS.find((option) => option.value === stop.color) ?? selectedColor).hex
                              }}
                            />
                            <Button
                              appearance="subtle"
                              onClick={() => removeGradientStop(index)}
                              isDisabled={normalizedGradientStops.length <= 2}
                            >
                              Remove
                            </Button>
                          </Inline>

                          <Inline space="space.0" shouldWrap>
                            {COLOR_OPTIONS.map((option) => (
                              <ColorTile
                                key={`gradient-stop-${index}-${option.value}`}
                                option={option}
                                selected={stop.color === option.value}
                                onSelect={(value) => updateGradientStop(index, { color: value })}
                              />
                            ))}
                          </Inline>

                          <Inline space="space.100" alignBlock="center" shouldWrap={false}>
                            <Text>Position: {stop.offset}%</Text>
                            <Box xcss={sliderWrapStyles}>
                              <Range
                                name={`gradient-stop-offset-${index}`}
                                value={Number(stop.offset)}
                                onChange={(value) =>
                                  updateGradientStop(index, {
                                    offset: normalizeDimension(value, stop.offset, 0, 100)
                                  })
                                }
                                min={0}
                                max={100}
                                step={1}
                              />
                            </Box>
                            <Box xcss={stopOffsetFieldStyles}>
                              <Textfield
                                name={`gradient-stop-offset-input-${index}`}
                                value={String(stop.offset)}
                                onChange={(value) =>
                                  updateGradientStop(index, {
                                    offset: normalizeDimension(value, stop.offset, 0, 100)
                                  })
                                }
                              />
                            </Box>
                          </Inline>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>

            <Stack space="space.050">
              <Pressable onClick={() => setIsSizingOpen((current) => !current)}>
                <Inline space="space.050" alignBlock="center">
                  <Text>Sizing</Text>
                  <Text>{isSizingOpen ? "−" : "+"}</Text>
                </Inline>
              </Pressable>

              {isSizingOpen ? (
                <Box xcss={accordionBodyStyles}>
                  <Stack space="space.050">
                    <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
                      <Text>Chart width: {config.width}px</Text>
                      <Box xcss={sliderWrapStyles}>
                        <Range
                          name="width"
                          value={Number(config.width)}
                          onChange={updateField("width")}
                          min={240}
                          max={900}
                          step={10}
                        />
                      </Box>
                    </Inline>

                    <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
                      <Text>Chart height: {config.height}px</Text>
                      <Box xcss={sliderWrapStyles}>
                        <Range
                          name="height"
                          value={Number(config.height)}
                          onChange={updateField("height")}
                          min={240}
                          max={700}
                          step={10}
                        />
                      </Box>
                    </Inline>

                    <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
                      <Text>Bar width: {config.barWidth}px</Text>
                      <Box xcss={sliderWrapStyles}>
                        <Range
                          name="barWidth"
                          value={Number(config.barWidth)}
                          onChange={updateField("barWidth")}
                          min={12}
                          max={120}
                          step={2}
                        />
                      </Box>
                    </Inline>

                    <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
                      <Text>Bar spacing: {config.barGap}px</Text>
                      <Box xcss={sliderWrapStyles}>
                        <Range
                          name="barGap"
                          value={Number(config.barGap)}
                          onChange={updateField("barGap")}
                          min={0}
                          max={48}
                          step={1}
                        />
                      </Box>
                    </Inline>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Stack>
        </Box>

        <Box xcss={previewColumnStyles}>
          <Stack space="space.100">
            <Text>
              <Strong>Live preview</Strong>
            </Text>
            {previewError ? (
              <SectionMessage appearance="warning" title="Preview unavailable">
                <Text>{previewError}</Text>
              </SectionMessage>
            ) : (
              <CustomBarChart payload={previewPayload} />
            )}
          </Stack>
        </Box>
      </Inline>

      <Inline space="space.150" alignBlock="center">
        <Pressable onClick={submit} isDisabled={isSaving}>
          <Box xcss={footerActionBoxStyles}>
            <Text>Save</Text>
          </Box>
        </Pressable>
        <Pressable onClick={() => view.close()} isDisabled={isSaving}>
          <Box xcss={footerActionBoxStyles}>
            <Text>Cancel</Text>
          </Box>
        </Pressable>
      </Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
