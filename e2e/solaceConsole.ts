import { expect, type BrowserContext, type Page } from "@playwright/test";

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

/** Filters the Broker Manager's queue list, it is paginated (20 per page) */
async function searchQueue(page: Page, queueName: string) {
  await page.getByText("Queue Name").first().waitFor();
  const search = page.getByPlaceholder("Search by name");
  await search.fill(queueName);
  await search.press("Enter");
  return page.getByRole("cell", { name: queueName });
}

/** Opens a queue in the Broker Manager's queue list */
export async function openQueue(page: Page, queueName: string) {
  const cell = await searchQueue(page, queueName);
  await cell.click();
}

/** Deletes a queue in the Broker Manager's queue list */
export async function deleteQueue(page: Page, queueName: string) {
  const cell = await searchQueue(page, queueName);
  await cell.waitFor();
  // The checkbox input is hidden behind a box drawn with CSS
  await page.locator(`#ck_Queue_${queueName}`).dispatchEvent("click");
  await page.getByRole("button", { name: "tune Action" }).click();
  // Not "Delete All Messages", which only empties the queue
  await page.getByRole("link", { name: "delete Delete", exact: true }).click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(cell).toBeHidden();
}
