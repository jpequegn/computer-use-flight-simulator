import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4318", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start:e2e",
    port: 4318,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } }
  ]
});
