const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");
const {
  collectConfluenceDiagnostics,
  ensureEditorOpen,
  findConfigurationFrame,
  openMacroConfiguration
} = require("./confluence-helpers");

const targetUrl = process.env.CONFLUENCE_EDIT_URL || process.env.CONFLUENCE_PAGE_URL;
const macroTitle = process.env.CONFLUENCE_MACRO_TITLE || "bar chart 2";
const cdpUrl = process.env.CONFLUENCE_CDP_URL || "http://127.0.0.1:9222";
const outputDir = path.join(os.tmpdir(), "dashboard-confluence-attach");

async function main() {
  if (!targetUrl) {
    throw new Error("Set CONFLUENCE_EDIT_URL or CONFLUENCE_PAGE_URL before running the attach harness.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.connectOverCDP(cdpUrl);

  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error(`No browser context was available at ${cdpUrl}. Start Chrome with --remote-debugging-port=9222 first.`);
    }

    const page = await context.newPage();

    await page.setViewportSize({ width: 1720, height: 1400 });
    try {
      await ensureEditorOpen(page, targetUrl);
    } catch (error) {
      const fallbackState = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body ? document.body.innerText.slice(0, 2000) : "",
        visibleTestIds: Array.from(document.querySelectorAll("[data-testid]"))
          .slice(0, 50)
          .map((node) => node.getAttribute("data-testid")),
        visibleRoles: Array.from(document.querySelectorAll("[role]"))
          .slice(0, 50)
          .map((node) => ({
            role: node.getAttribute("role"),
            text: (node.textContent || "").trim().slice(0, 120)
          }))
      }));

      await page.screenshot({ path: path.join(outputDir, "editor-not-ready.png"), fullPage: true });
      await fs.writeFile(path.join(outputDir, "editor-not-ready.json"), JSON.stringify(fallbackState, null, 2));
      throw error;
    }
    await openMacroConfiguration(page, { macroTitle });

    const started = Date.now();
    let configFrame = null;
    while (Date.now() - started < 60_000) {
      configFrame = await findConfigurationFrame(page);
      if (configFrame) {
        break;
      }

      await page.waitForTimeout(1000);
    }

    if (!configFrame) {
      throw new Error("Unable to find the Forge configuration frame after opening the macro.");
    }

    await configFrame.locator("body").waitFor({ state: "visible" });
    await configFrame.locator(".shell").waitFor({ state: "visible" });
    await configFrame.locator(".preview").waitFor({ state: "visible" });

    const previewChildren = await configFrame.locator("#preview-root > *").count();
    if (previewChildren === 0) {
      throw new Error("The preview column rendered, but no preview content was mounted into #preview-root.");
    }

    await page.screenshot({ path: path.join(outputDir, "confluence-editor.png"), fullPage: true });
    await configFrame.locator("body").screenshot({ path: path.join(outputDir, "confluence-config-frame.png") });
    await configFrame.locator(".preview").screenshot({ path: path.join(outputDir, "confluence-preview-column.png") });

    const diagnostics = await collectConfluenceDiagnostics(page, configFrame);
    await fs.writeFile(path.join(outputDir, "confluence-diagnostics.json"), JSON.stringify(diagnostics, null, 2));

    console.log(`Artifacts written to ${outputDir}`);
    console.log(JSON.stringify(diagnostics, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
