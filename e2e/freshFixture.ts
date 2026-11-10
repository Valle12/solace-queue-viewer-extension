import { test as base, type BrowserContext } from "@playwright/test";
import { getExtensionId, launchExtensionContext } from "./extension";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await launchExtensionContext("");
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    await use(await getExtensionId(context));
  },
});
export const expect = test.expect;
export type { Page } from "@playwright/test";
