import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "creation",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /creation.test.ts/,
    },
    {
      name: "e2e",
      use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read"] },
      testIgnore: /creation.test.ts/,
    },
  ],
});
