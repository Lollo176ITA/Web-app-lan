import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "https://127.0.0.1:5173",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "rm -rf .tmp/playwright-storage && mkdir -p .tmp && STORAGE_ROOT=.tmp/playwright-storage npm run dev",
    ignoreHTTPSErrors: true,
    url: "https://127.0.0.1:5173",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 900 }
      }
    }
  ]
});
