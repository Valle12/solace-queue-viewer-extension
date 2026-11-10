import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch {}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    // Without them a missing element only fails at the test timeout, without saying which one
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "creation",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /creation.test.ts/,
      // A retry can't succeed: the email is already registered, so no new activation mail is sent
      retries: 0,
    },
    {
      name: "e2e",
      use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read"] },
      testIgnore: /creation.test.ts/,
      // Also applies to beforeAll hooks; logging in and loading the console is slow on CI
      timeout: 120_000,
    },
  ],
});
