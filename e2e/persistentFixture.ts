import { test as base, type BrowserContext } from "@playwright/test";
import { getExtensionId, launchCurrentExtensionContext } from "./extension";

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
      const context = await launchCurrentExtensionContext("credentials", [
        "clipboard-read",
        "clipboard-write",
      ]);

      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  workerExtensionId: [
    async ({ workerContext }, use) => {
      await use(await getExtensionId(workerContext));
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
