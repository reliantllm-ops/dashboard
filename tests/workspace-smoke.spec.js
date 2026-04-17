const { test, expect } = require("@playwright/test");

const pageListItems = '[data-page-id]';
const textBlock = '[data-block-type="text"]';

async function resetWorkspace(page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("engineering-workspace-pages");
  });
}

async function updateFirstTextBlock(page, html) {
  await page.locator(textBlock).first().evaluate((element, nextHtml) => {
    element.innerHTML = nextHtml;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, html);
}

test.beforeEach(async ({ page }) => {
  await resetWorkspace(page);
  await page.goto("/");
});

test("loads the default workspace", async ({ page }) => {
  await expect(page.locator("#page-count")).toHaveText("3 pages");
  await expect(page.locator("#published-title")).toHaveText("Engineering Command Center");
  await expect(page.locator(pageListItems)).toHaveCount(3);
});

test("creates, edits, publishes, duplicates, and deletes a page", async ({ page }) => {
  await page.getByRole("button", { name: "New page" }).click();
  await expect(page.locator("#page-count")).toHaveText("4 pages");

  await updateFirstTextBlock(page, "<p>Smoke test body content.</p>");
  await page.getByRole("button", { name: "Save page" }).click();

  await page.getByRole("link", { name: "Publish page" }).click();
  await expect(page).toHaveURL(/#\/page\/untitled-page/);
  await expect(page.locator("#published-body")).toContainText("Smoke test body content.");

  await page.getByRole("link", { name: "Edit page" }).click();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#page-count")).toHaveText("5 pages");

  await expect(page.locator(pageListItems).first()).toContainText("Untitled page copy");
  await page.getByRole("button", { name: "Delete page" }).click();
  await expect(page.locator("#page-count")).toHaveText("4 pages");
});
