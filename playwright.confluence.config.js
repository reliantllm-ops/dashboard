const fs = require("fs");
const path = require("path");
const { defineConfig } = require("@playwright/test");

const storageStatePath = process.env.CONFLUENCE_STORAGE_STATE || path.join("tests", ".auth", "confluence.json");
const use = {
  baseURL: process.env.CONFLUENCE_BASE_URL || "https://reliantdash.atlassian.net",
  browserName: "chromium",
  channel: process.env.CONFLUENCE_BROWSER_CHANNEL || "chrome",
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
  video: "retain-on-failure"
};

if (fs.existsSync(storageStatePath)) {
  use.storageState = storageStatePath;
}

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: /confluence-.*\.(spec|setup)\.js/,
  timeout: 180_000,
  outputDir: path.join(process.env.TEMP || process.cwd(), "dashboard-confluence-test-results"),
  expect: {
    timeout: 20_000
  },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use
});
