import type { BrowserContext, Page } from "@playwright/test";

/** Appcues onboarding tours and surveys overlay the console and intercept clicks */
export async function blockAppcues(context: BrowserContext) {
  await context.route(/^https:\/\/[^/]*appcues\.(com|net)\//, route =>
    route.abort(),
  );
}

/** Opens the "Test" service from the Cluster Manager on its Status tab */
export async function openService(page: Page) {
  await page.getByText("Cluster Manager Cluster").click();
  // Clicking the card before the list has loaded opens service "undefined"
  await page.getByText("Running", { exact: true }).first().waitFor();
  await page.getByText("aks-germanywestcentral").click();
  await page.waitForURL(/\/mc\/services\/(?!undefined)\w+\/status/);
  // Same for switching tabs before the service details have loaded
  await page.getByText("Service ID").first().waitFor();
}
