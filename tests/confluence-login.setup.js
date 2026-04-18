const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const storageStatePath = process.env.CONFLUENCE_STORAGE_STATE || path.join("tests", ".auth", "confluence.json");
const baseUrl = process.env.CONFLUENCE_BASE_URL || "https://reliantdash.atlassian.net";
const targetUrl = process.env.CONFLUENCE_EDIT_URL || baseUrl;

test("save Confluence login state", async ({ page, context }) => {
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await expect
    .poll(
      async () => {
        const url = page.url();
        const atlassianLoginVisible = await page.getByRole("heading", { name: /log in to continue/i }).isVisible().catch(() => false);
        const googleLoginVisible = await page.getByRole("heading", { name: /^sign in$/i }).isVisible().catch(() => false);
        const editorMarkers = [
          page.locator(".ProseMirror"),
          page.locator('[contenteditable="true"]'),
          page.locator('[data-testid="editor-content-area"]'),
          page.locator('[aria-label*="Confluence"]')
        ];

        let editorVisible = false;
        for (const locator of editorMarkers) {
          if (await locator.first().isVisible().catch(() => false)) {
            editorVisible = true;
            break;
          }
        }

        return {
          url,
          atlassianLoginVisible,
          googleLoginVisible,
          editorVisible
        };
      },
      {
        timeout: 600_000,
        message: "waiting for successful Confluence login"
      }
    )
    .toEqual(
      expect.objectContaining({
        url: expect.stringMatching(/atlassian\.net/),
        atlassianLoginVisible: false,
        googleLoginVisible: false,
        editorVisible: true
      })
    );

  await context.storageState({ path: storageStatePath });
});
