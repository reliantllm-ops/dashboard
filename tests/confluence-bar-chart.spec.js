const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  collectConfluenceDiagnostics,
  ensureEditorOpen,
  findConfigurationFrame,
  openMacroConfiguration
} = require("./confluence-helpers");

const targetUrl = process.env.CONFLUENCE_EDIT_URL || process.env.CONFLUENCE_PAGE_URL || "";
const macroTitle = process.env.CONFLUENCE_MACRO_TITLE || "bar chart 2";

test("bar chart 2 configuration preview renders in Confluence", async ({ page }, testInfo) => {
  test.skip(!targetUrl, "Set CONFLUENCE_EDIT_URL or CONFLUENCE_PAGE_URL before running the Confluence harness.");

  await page.setViewportSize({ width: 1720, height: 1400 });
  await ensureEditorOpen(page, targetUrl);
  await openMacroConfiguration(page, { macroTitle });

  await expect
    .poll(async () => Boolean(await findConfigurationFrame(page)), {
      message: "waiting for Forge configuration frame"
    })
    .toBeTruthy();

  const configFrame = await findConfigurationFrame(page);
  await configFrame.locator("body").waitFor({ state: "visible" });
  await configFrame.locator(".shell").waitFor({ state: "visible" });
  await configFrame.locator(".preview").waitFor({ state: "visible" });

  await expect(configFrame.locator(".live-title")).toHaveText(/live preview/i);
  await expect
    .poll(async () => configFrame.locator("#preview-root > *").count(), {
      message: "waiting for preview content"
    })
    .toBeGreaterThan(0);

  const outputDir = testInfo.outputDir;
  await page.screenshot({ path: path.join(outputDir, "confluence-editor.png"), fullPage: true });
  await configFrame.locator("body").screenshot({ path: path.join(outputDir, "confluence-config-frame.png") });
  await configFrame.locator(".preview").screenshot({ path: path.join(outputDir, "confluence-preview-column.png") });

  const diagnostics = await collectConfluenceDiagnostics(page, configFrame);
  const diagnosticsPath = path.join(outputDir, "confluence-diagnostics.json");
  await fs.writeFile(diagnosticsPath, JSON.stringify(diagnostics, null, 2));

  await testInfo.attach("confluence-diagnostics", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json"
  });
});
