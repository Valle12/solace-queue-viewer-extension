import { test as base, type BrowserContext } from "@playwright/test";
import { getExtensionId, launchExtensionContext } from "./extension";

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
  // One browser for all tests of a worker, so the serial tests share the login
  // and the saved configuration. Its profile is new on every run, like on CI:
  // a reused one would keep an outdated background script (Chrome only registers
  // the service worker of an unpacked extension again when its version changes)
  workerContext: [
    async ({}, use) => {
      const context = await launchExtensionContext("", [
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
