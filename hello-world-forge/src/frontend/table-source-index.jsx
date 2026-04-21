import React, { useEffect, useMemo, useState } from "react";
import ForgeReconciler, {
  DynamicTable,
  SectionMessage,
  Stack,
  Strong,
  Text,
  useConfig
} from "@forge/react";
import { requestConfluence, view } from "@forge/bridge";

const PROPERTY_KEY = "forge_table_sources_v1";

const extractText = (node) => {
  if (!node || typeof node !== "object") {
    return "";
  }

  if (node.type === "text") {
    return String(node.text ?? "");
  }

  if (!Array.isArray(node.content)) {
    return "";
  }

  return node.content.map(extractText).join("").trim();
};

const findFirstTable = (node) => {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (node.type === "table") {
    return node;
  }

  if (!Array.isArray(node.content)) {
    return null;
  }

  for (const child of node.content) {
    const table = findFirstTable(child);
    if (table) {
      return table;
    }
  }

  return null;
};

const parseTableFromBody = (macroBody) => {
  const table = findFirstTable(macroBody);
  if (!table) {
    throw new Error("Add a Confluence table inside this macro.");
  }

  const matrix = (table.content ?? [])
    .filter((row) => row?.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .filter((cell) => cell?.type === "tableCell" || cell?.type === "tableHeader")
        .map((cell) => extractText(cell))
    )
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim()));

  if (!matrix.length) {
    throw new Error("The table is empty.");
  }

  const chartRows = matrix
    .map((cells, index) => {
      const label = String(cells[0] ?? "").trim();
      const valueText = String(cells[1] ?? "").trim();
      const value = Number(valueText.replace(/,/g, ""));
      return { label, valueText, value, index };
    })
    .filter((row, index) => {
      if (!row.label && !row.valueText) {
        return false;
      }
      if (index === 0 && !Number.isFinite(row.value)) {
        return false;
      }
      return true;
    });

  const invalidRow = chartRows.find((row) => !row.label || !Number.isFinite(row.value));
  if (invalidRow) {
    throw new Error("Column 1 must contain labels and column 2 must contain numeric values.");
  }

  if (!chartRows.length) {
    throw new Error("The table needs at least one data row.");
  }

  return {
    matrix,
    rows: chartRows.map((row) => ({ label: row.label, value: row.value }))
  };
};

const buildDynamicTable = (matrix) => {
  const columnCount = Math.max(...matrix.map((row) => row.length), 0);
  const firstRow = matrix[0] ?? [];
  const head = {
    cells: Array.from({ length: columnCount }, (_, index) => ({
      key: `head-${index}`,
      content: firstRow[index] || `Column ${index + 1}`
    }))
  };

  const bodyRows = matrix.slice(1).map((row, rowIndex) => ({
    key: `row-${rowIndex}`,
    cells: Array.from({ length: columnCount }, (_, columnIndex) => ({
      key: `cell-${rowIndex}-${columnIndex}`,
      content: row[columnIndex] || ""
    }))
  }));

  return { head, rows: bodyRows };
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

const saveProperty = async (pageId, sourceKey, payload) => {
  const existing = await getProperty(pageId);
  const nextValue = {
    ...(existing?.value || {}),
    [sourceKey]: payload
  };

  if (existing?.id) {
    const response = await requestConfluence(`/wiki/rest/api/content/${pageId}/property/${PROPERTY_KEY}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: PROPERTY_KEY,
        value: nextValue,
        version: {
          number: Number(existing.version?.number || 1) + 1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Unable to update source property (${response.status}).`);
    }

    return;
  }

  const response = await requestConfluence(`/wiki/rest/api/content/${pageId}/property`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      key: PROPERTY_KEY,
      value: nextValue
    })
  });

  if (!response.ok) {
    throw new Error(`Unable to create source property (${response.status}).`);
  }
};

const App = () => {
  const config = useConfig() ?? {};
  const [contextState, setContextState] = useState({ macroBody: null, pageId: "", isEditing: false, loading: true, error: "" });
  const [saveState, setSaveState] = useState({ message: "", error: "" });

  useEffect(() => {
    let mounted = true;

    const loadContext = async () => {
      try {
        const context = await view.getContext();
        if (!mounted) {
          return;
        }
        setContextState({
          macroBody: context?.extension?.macro?.body ?? null,
          pageId: String(context?.extension?.content?.id ?? ""),
          isEditing: Boolean(context?.extension?.isEditing),
          loading: false,
          error: ""
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        setContextState({
          macroBody: null,
          pageId: "",
          isEditing: false,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load macro context."
        });
      }
    };

    void loadContext();

    return () => {
      mounted = false;
    };
  }, []);

  const sourceKey = String(config.sourceKey ?? "").trim();
  const sourceName = String(config.sourceName ?? "").trim();

  const parsed = useMemo(() => {
    if (!contextState.macroBody) {
      return null;
    }

    return parseTableFromBody(contextState.macroBody);
  }, [contextState.macroBody]);

  useEffect(() => {
    let cancelled = false;

    const persist = async () => {
      if (!contextState.pageId || !sourceKey || !parsed || !contextState.isEditing) {
        return;
      }

      try {
        await saveProperty(contextState.pageId, sourceKey, {
          sourceKey,
          sourceName: sourceName || sourceKey,
          pageId: contextState.pageId,
          rows: parsed.rows,
          matrix: parsed.matrix,
          updatedAt: new Date().toISOString()
        });

        if (!cancelled) {
          setSaveState({
            message: `Saved source ${sourceKey}`,
            error: ""
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSaveState({
            message: "",
            error: error instanceof Error ? error.message : "Unable to save table source."
          });
        }
      }
    };

    void persist();

    return () => {
      cancelled = true;
    };
  }, [contextState.isEditing, contextState.pageId, parsed, sourceKey, sourceName]);

  if (contextState.loading) {
    return (
      <SectionMessage appearance="info" title="Loading table source">
        <Text>Loading macro context...</Text>
      </SectionMessage>
    );
  }

  if (contextState.error) {
    return (
      <SectionMessage appearance="error" title="Table source error">
        <Text>{contextState.error}</Text>
      </SectionMessage>
    );
  }

  if (!sourceKey) {
    return (
      <SectionMessage appearance="warning" title="Configure source key">
        <Text>Open Configure and set a source key before using this table as a shared data source.</Text>
      </SectionMessage>
    );
  }

  let parsedTable;
  try {
    parsedTable = parsed ?? parseTableFromBody(contextState.macroBody);
  } catch (error) {
    return (
      <SectionMessage appearance="warning" title="Add a valid table">
        <Text>{error instanceof Error ? error.message : "Unable to parse table body."}</Text>
      </SectionMessage>
    );
  }

  const tableData = buildDynamicTable(parsedTable.matrix);

  return (
    <Stack space="space.200">
      <Text>
        <Strong>{sourceName || sourceKey}</Strong>
      </Text>
      {saveState.error ? (
        <SectionMessage appearance="error" title="Source save error">
          <Text>{saveState.error}</Text>
        </SectionMessage>
      ) : null}
      {saveState.message ? (
        <SectionMessage appearance="info" title="Source status">
          <Text>{saveState.message}</Text>
        </SectionMessage>
      ) : null}
      <DynamicTable head={tableData.head} rows={tableData.rows} />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
