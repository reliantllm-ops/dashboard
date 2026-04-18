function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function dismissConfluenceChrome(page) {
  const dismissNames = [/got it/i, /dismiss/i, /close/i, /accept/i];

  for (const name of dismissNames) {
    const button = page.getByRole("button", { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
    }
  }
}

async function waitForEditorSurface(page) {
  const loadingIndicator = page.getByRole("img", { name: /loading feature flags/i });

  await loadingIndicator.waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});

  await page.waitForLoadState("domcontentloaded");

  const editorReady = async () => {
    const candidates = [
      page.locator(".ProseMirror"),
      page.locator('[contenteditable="true"]'),
      page.locator('[data-testid="editor-content-area"]'),
      page.locator('[data-testid="editor-scroll-container"]'),
      page.locator('[data-testid="fabric-editor-popup-scroll-parent"]')
    ];

    for (const locator of candidates) {
      if (await locator.first().isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  };

  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (await editorReady()) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error("Confluence editor did not become ready within 60 seconds.");
}

async function ensureEditorOpen(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await dismissConfluenceChrome(page);

  if (/\/edit(?:-v2)?\//i.test(targetUrl) || /mode=edit/i.test(targetUrl)) {
    await waitForEditorSurface(page);
    return;
  }

  const editButton = page.getByRole("button", { name: /^edit$/i }).first();
  if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
    await page.waitForLoadState("domcontentloaded");
  }

  await waitForEditorSurface(page);
}

async function firstVisibleLocator(locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  return null;
}

async function openMacroConfiguration(page, options = {}) {
  const macroTitle = options.macroTitle || "bar chart 2";
  const macroSelector = process.env.CONFLUENCE_MACRO_SELECTOR;
  const editButtonSelector = process.env.CONFLUENCE_MACRO_EDIT_SELECTOR;

  if (await hasConfigurationFrame(page)) {
    return;
  }

  let macroLocator;
  if (macroSelector) {
    macroLocator = page.locator(macroSelector).first();
  } else {
    const titlePattern = new RegExp(escapeRegex(macroTitle), "i");
    macroLocator = await firstVisibleLocator([
      page.locator('[data-node-type="extension"]').filter({ hasText: titlePattern }),
      page.locator('[data-testid*="extension"]').filter({ hasText: titlePattern }),
      page.locator(`iframe[title*="${macroTitle}"]`),
      page.getByText(titlePattern)
    ]);
  }

  if (!macroLocator || !(await macroLocator.isVisible().catch(() => false))) {
    throw new Error(
      "Unable to locate the macro in the Confluence editor. Set CONFLUENCE_MACRO_SELECTOR to a stable selector for the macro placeholder."
    );
  }

  await macroLocator.scrollIntoViewIfNeeded().catch(() => {});
  await macroLocator.click({ force: true });
  await page.waitForTimeout(1500);

  if (await hasConfigurationFrame(page)) {
    return;
  }

  if (editButtonSelector) {
    const editButton = page.locator(editButtonSelector).first();
    await editButton.click({ force: true });
  } else {
    const editButton = await firstVisibleLocator([
      page.getByRole("button", { name: /^edit$/i }),
      page.getByRole("button", { name: /edit macro/i }),
      page.getByRole("menuitem", { name: /^edit$/i }),
      page.getByText(/^edit$/i)
    ]);

    if (!editButton) {
      throw new Error(
        "Macro selected, but no edit control was found. Set CONFLUENCE_MACRO_EDIT_SELECTOR to the macro toolbar edit button."
      );
    }

    await editButton.click({ force: true });
  }

  await page.waitForTimeout(2500);
}

async function hasConfigurationFrame(page) {
  const frame = await findConfigurationFrame(page);
  return Boolean(frame);
}

async function findConfigurationFrame(page) {
  const preferredSelector = process.env.CONFLUENCE_CONFIG_IFRAME_SELECTOR;
  if (preferredSelector) {
    const element = page.locator(preferredSelector).first();
    if (await element.isVisible().catch(() => false)) {
      return await element.elementHandle().then((handle) => handle?.contentFrame());
    }
  }

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) {
      continue;
    }

    try {
      const hasPreview = await frame.evaluate(() => Boolean(document.querySelector("#preview-root, .preview, .shell")));
      if (hasPreview) {
        return frame;
      }
    } catch (error) {
      // Ignore transient cross-frame evaluation failures while Confluence is still mounting the dialog.
    }
  }

  return null;
}

async function collectConfluenceDiagnostics(page, frame) {
  const iframeDetails = [];
  const iframeCount = await page.locator("iframe").count().catch(() => 0);

  for (let index = 0; index < iframeCount; index += 1) {
    const locator = page.locator("iframe").nth(index);
    const box = await locator.boundingBox().catch(() => null);
    const metadata = await locator.evaluate((node) => ({
      id: node.id || null,
      name: node.getAttribute("name"),
      title: node.getAttribute("title"),
      src: node.getAttribute("src"),
      className: node.getAttribute("class")
    }));

    iframeDetails.push({
      index,
      ...metadata,
      boundingBox: box
    });
  }

  let frameDetails = null;
  if (frame) {
    frameDetails = await frame.evaluate(() => {
      const readRect = (element) =>
        element
          ? {
              width: Math.round(element.getBoundingClientRect().width),
              height: Math.round(element.getBoundingClientRect().height),
              top: Math.round(element.getBoundingClientRect().top),
              left: Math.round(element.getBoundingClientRect().left)
            }
          : null;

      const preview = document.querySelector(".preview");
      const previewRoot = document.querySelector("#preview-root");
      const shell = document.querySelector(".shell");
      const status = document.querySelector("#status");
      const svg = previewRoot ? previewRoot.querySelector("svg") : null;

      return {
        url: window.location.href,
        title: document.title,
        bodyWidth: document.body ? document.body.scrollWidth : null,
        bodyHeight: document.body ? document.body.scrollHeight : null,
        shellRect: readRect(shell),
        previewRect: readRect(preview),
        previewRootRect: readRect(previewRoot),
        statusText: status ? status.textContent : null,
        previewRootChildren: previewRoot ? previewRoot.children.length : 0,
        svgPresent: Boolean(svg),
        svgRect: readRect(svg),
        bodyTextSnippet: document.body ? document.body.innerText.slice(0, 500) : ""
      };
    });
  }

  return {
    pageUrl: page.url(),
    iframeDetails,
    frameDetails
  };
}

module.exports = {
  collectConfluenceDiagnostics,
  dismissConfluenceChrome,
  ensureEditorOpen,
  findConfigurationFrame,
  openMacroConfiguration
};
