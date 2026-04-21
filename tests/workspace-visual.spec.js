const { test, expect } = require("@playwright/test");

async function resetWorkspace(page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("engineering-workspace-pages");
    window.localStorage.removeItem("engineering-workspace-sidebar-minimized");
  });
}

async function disableCaretBlink(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        caret-color: transparent !important;
      }
    `
  });
}

test.beforeEach(async ({ page }) => {
  await resetWorkspace(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await disableCaretBlink(page);
});

test("workspace edit view matches baseline", async ({ page }) => {
  await expect(page).toHaveScreenshot("workspace-edit-view.png", {
    fullPage: true,
    animations: "disabled"
  });
});

test("workspace publish view matches baseline", async ({ page }) => {
  await page.getByRole("link", { name: "Publish page" }).click();

  await expect(page).toHaveScreenshot("workspace-publish-view.png", {
    fullPage: true,
    animations: "disabled"
  });
});

test("workspace collapsed sidebar matches baseline", async ({ page }) => {
  await page.getByRole("button", { name: "Minimize left panel" }).click();

  await expect(page).toHaveScreenshot("workspace-collapsed-sidebar.png", {
    fullPage: true,
    animations: "disabled"
  });
});
