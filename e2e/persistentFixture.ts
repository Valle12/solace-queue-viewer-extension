import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

export const test = base.extend<
  {
    context: BrowserContext;
    extensionId: string;
  },
  {
    workerContext: BrowserContext;
    workerExtensionId: string;
  }
>({
  workerContext: [
    async ({}, use) => {
      const pathToExtension = path.resolve("dist");

      const context = await chromium.launchPersistentContext("credentials", {
        headless: false,
        channel: "chromium",
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
        permissions: ["clipboard-read", "clipboard-write"],
      });

      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  workerExtensionId: [
    async ({ workerContext }, use) => {
      let [serviceWorker] = workerContext.serviceWorkers();
      if (!serviceWorker)
        serviceWorker = await workerContext.waitForEvent("serviceworker");

      const extensionId = serviceWorker.url().split("/")[2];
      await use(extensionId);
    },
    { scope: "worker" },
  ],
  context: async ({ workerContext }, use) => {
    await use(workerContext);
  },
  extensionId: async ({ workerExtensionId }, use) => {
    await use(workerExtensionId);
  },
});

export const expect = test.expect;
export type { Page } from "@playwright/test";
