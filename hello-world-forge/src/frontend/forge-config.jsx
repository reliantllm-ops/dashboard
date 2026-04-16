import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  BarChart,
  Box,
  Button,
  ButtonGroup,
  Inline,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
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
import { view } from "@forge/bridge";

const DEFAULTS = {
  title: "Quarterly sales",
  data: `Q1,12
Q2,18
Q3,9
Q4,22`,
  color: "blue",
  width: 480,
  height: 320
};

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

const triggerTileStyles = xcss({
  width: "16px",
  height: "16px",
  borderRadius: "border.radius.100",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderColor: "color.border"
});

const popupHandleStyles = xcss({
  width: "100%",
  height: "8px",
  borderTopWidth: "border.width.selected",
  borderTopStyle: "solid",
  borderTopColor: "color.border.selected"
});

const sliderWrapStyles = xcss({
  width: "20%"
});

const sliderInlineStyles = xcss({
  marginBlockStart: "space.negative.025"
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

const ColorTile = ({ option, selected, onSelect }) => (
  <Pressable onClick={() => onSelect(option.value)}>
    <Box
      xcss={selected ? selectedTileStyles : tileStyles}
      backgroundColor={option.background}
    />
  </Pressable>
);

const App = () => {
  const [config, setConfig] = useState(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
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
            width: normalizeDimension(existingConfig.width, DEFAULTS.width, 240, 900),
            height: normalizeDimension(existingConfig.height, DEFAULTS.height, 240, 700)
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

  const submit = async () => {
    setIsSaving(true);
    setError("");

    try {
      await view.submit({
        config: {
          title: String(config.title ?? "").trim() || DEFAULTS.title,
          data: String(config.data ?? "").trim() || DEFAULTS.data,
          color: normalizeColor(config.color),
          width: normalizeDimension(config.width, DEFAULTS.width, 240, 900),
          height: normalizeDimension(config.height, DEFAULTS.height, 240, 700)
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

  const selectedColor = COLOR_OPTIONS.find((option) => option.value === config.color) ?? COLOR_OPTIONS[0];
  let previewRows = [];
  let previewError = "";

  try {
    previewRows = parseRows(config.data);
  } catch (error) {
    previewError = error instanceof Error ? error.message : "Unable to build preview.";
  }

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

      <Textfield name="title" value={config.title} onChange={updateField("title")} placeholder="Quarterly sales" />

      <TextArea
        name="data"
        value={config.data}
        onChange={updateField("data")}
        placeholder={"Q1,12\nQ2,18\nQ3,9"}
        isMonospaced
      />

      <Stack space="space.100">
        <Inline space="space.050" alignBlock="center">
          <Button appearance="subtle" onClick={() => setIsColorModalOpen(true)}>
            Bar color
          </Button>
          <Pressable onClick={() => setIsColorModalOpen(true)}>
            <Box xcss={triggerTileStyles} backgroundColor={selectedColor.background} />
          </Pressable>
        </Inline>
      </Stack>

      <Stack space="space.050">
        <Pressable onClick={() => setIsSizingOpen((current) => !current)}>
          <Inline space="space.050" alignBlock="center">
            <Text>Sizing</Text>
            <Text>{isSizingOpen ? "[-]" : "[+]"}</Text>
          </Inline>
        </Pressable>

        {isSizingOpen ? (
          <Stack space="space.050">
            <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
              <Text>Chart width: {config.width}px</Text>
              <Box xcss={sliderWrapStyles}>
                <Range name="width" value={Number(config.width)} onChange={updateField("width")} min={240} max={900} step={10} />
              </Box>
            </Inline>

            <Inline space="space.050" alignBlock="center" xcss={sliderInlineStyles}>
              <Text>Chart height: {config.height}px</Text>
              <Box xcss={sliderWrapStyles}>
                <Range name="height" value={Number(config.height)} onChange={updateField("height")} min={240} max={700} step={10} />
              </Box>
            </Inline>
          </Stack>
        ) : null}
      </Stack>

      <Stack space="space.100">
        <Text>
          <Strong>Live preview</Strong>
        </Text>
        {previewError ? (
          <SectionMessage appearance="warning" title="Preview unavailable">
            <Text>{previewError}</Text>
          </SectionMessage>
        ) : (
          <BarChart
            data={previewRows}
            xAccessor="label"
            yAccessor="value"
            title={String(config.title ?? "").trim() || DEFAULTS.title}
            width={normalizeDimension(config.width, DEFAULTS.width, 240, 900)}
            height={normalizeDimension(config.height, DEFAULTS.height, 240, 700)}
            colorAccessor="group"
            colorPalette={[{ key: "bars", value: selectedColor.hex }]}
          />
        )}
      </Stack>

      <ButtonGroup>
        <Button appearance="primary" onClick={submit} isDisabled={isSaving}>
          Save
        </Button>
        <Button appearance="subtle" onClick={() => view.close()} isDisabled={isSaving}>
          Cancel
        </Button>
      </ButtonGroup>

      <ModalTransition>
        {isColorModalOpen && (
          <Modal onClose={() => setIsColorModalOpen(false)}>
            <ModalHeader>
              <ModalTitle>Bar color</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.150">
                <Box xcss={popupHandleStyles} />
                <Inline space="space.0" shouldWrap>
                  {COLOR_OPTIONS.map((option) => (
                    <ColorTile
                      key={`modal-${option.value}`}
                      option={option}
                      selected={config.color === option.value}
                      onSelect={updateField("color")}
                    />
                  ))}
                </Inline>
                <Text>Selecting a color updates the live preview behind this dialog.</Text>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button appearance="primary" onClick={() => setIsColorModalOpen(false)}>
                Done
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
