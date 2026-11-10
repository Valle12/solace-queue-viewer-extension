import {
  expect,
  type BrowserContext,
  type Page,
  type Response,
} from "@playwright/test";

/** Appcues onboarding tours and surveys overlay the console and intercept clicks */
export async function blockAppcues(context: BrowserContext) {
  await context.route(/^https:\/\/[^/]*appcues\.(com|net)\//, route =>
    route.abort(),
  );
}

/** Opens the console, signs in unless the profile still has a valid session */
export async function signIn(page: Page) {
  // /home redirects to /login without a session. An expired session (e.g. after
  // a browser restart) shows the console first and redirects once its requests failed
  await page.goto("https://console.solace.cloud/home");
  await page.waitForLoadState("networkidle");
  const emailInput = page.getByRole("textbox", { name: "Email" });
  await expect(
    emailInput.or(page.getByText("Cluster Manager Cluster")),
  ).toBeVisible({ timeout: 30_000 });
  if (!(await emailInput.isVisible())) return;

  await emailInput.fill(process.env.SOLACE_EMAIL);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(process.env.SOLACE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

/** Opens the Broker Manager in a new tab and shows the messages of the queue */
export async function openQueueMessages(page: Page, queueName: string) {
  await openService(page);
  await page.getByRole("tab", { name: "Manage" }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Queues" }).click();
  const brokerPage = await popupPromise;
  await openQueue(brokerPage, queueName);
  await brokerPage.getByRole("link", { name: "Messages Queued" }).click();
  return brokerPage;
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

/** Whether the request of the Broker Manager changes this queue */
function isQueueRequest(response: Response, method: string, queueName: string) {
  return (
    response.request().method() === method &&
    decodeURIComponent(new URL(response.url()).pathname).endsWith(
      `/queues/${queueName}`,
    )
  );
}

/** Whether the Broker Manager loaded its queue list, optionally searched for a name */
function isQueueList(response: Response, search?: string) {
  return (
    response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/queues") &&
    (!search || decodeURIComponent(response.url()).includes(`*${search}*`))
  );
}

/** Dialogs close with a delay, the next click could otherwise hit the one closing */
async function waitForDialogsClosed(page: Page) {
  await expect(page.locator("ux-dialog-container")).toHaveCount(0);
}

// After every change the Broker Manager loads its queue list again, a bit later.
// The helpers wait for that, otherwise the list renders again during the next
// steps and clears a selection, then "Delete" deletes nothing and gets stuck

/** Creates a queue in the Broker Manager's queue list */
export async function createQueue(page: Page, queueName: string) {
  await page.getByRole("button", { name: "add Queue" }).click();
  await page.getByRole("textbox", { name: "Queue Name" }).fill(queueName);
  await page.getByRole("button", { name: "Create" }).click({ delay: 250 });
  // Apply saves the settings of the queue only after the click returned
  const applied = page.waitForResponse(response =>
    isQueueRequest(response, "PATCH", queueName),
  );
  const listed = page.waitForResponse(response => isQueueList(response));
  await page.getByRole("button", { name: "Apply" }).click();
  expect((await applied).ok()).toBe(true);
  await listed;
  await waitForDialogsClosed(page);
}

/** Subscribes the queue to the topic, so messages published to it end up in the queue */
export async function subscribeQueue(
  page: Page,
  queueName: string,
  topic: string,
) {
  await openQueue(page, queueName);
  await page.getByRole("link", { name: "Subscriptions" }).click();
  await page.getByRole("button", { name: "add Subscription" }).click();
  await page
    .getByRole("textbox", { name: "Type in a topic or paste new" })
    .fill(topic);
  await page.getByRole("button", { name: "Create" }).click();
}

/** Opens Try Me! in the Broker Manager and connects its publisher */
export async function connectPublisher(page: Page, password: string) {
  await page.getByRole("link", { name: "Try Me!" }).click();
  await page.getByText("navigate_next").nth(3).click();
  await page.locator("#pubPassword").fill(password);
  await page.getByRole("button", { name: "Connect" }).first().click();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
}

/** Publishes the message several times with Try Me!, which counts all messages it published */
export async function publishMessages(
  page: Page,
  topic: string,
  message: string,
  count: number,
  publishedCount: number,
) {
  await page.locator("#pubTopic").fill(topic);
  await page.locator("#pubMessage").fill(message);
  await page
    .getByRole("button", { name: "Publish" })
    .click({ clickCount: count, delay: 50 });
  await expect(page.locator("#tab-publish")).toContainText(
    `${publishedCount} Direct0 Persistent`,
  );
}

/** Opens a queue in the Broker Manager's queue list */
export async function openQueue(page: Page, queueName: string) {
  const cell = await searchQueue(page, queueName);
  await cell.click();
}

/** Deletes a queue in the Broker Manager's queue list */
export async function deleteQueue(page: Page, queueName: string) {
  const searched = page.waitForResponse(response =>
    isQueueList(response, queueName),
  );
  const cell = await searchQueue(page, queueName);
  await searched;
  await cell.waitFor();
  // The checkbox input is hidden behind a box drawn with CSS. Only check it,
  // clicking a row that is already selected would unselect it
  const checkbox = page.locator(`#ck_Queue_${queueName}`);
  if (!(await checkbox.isChecked())) await checkbox.dispatchEvent("click");
  await expect(checkbox).toBeChecked();
  await page.getByRole("button", { name: "tune Action" }).click();
  // Not "Delete All Messages", which only empties the queue
  await page.getByRole("link", { name: "delete Delete", exact: true }).click();
  const deleted = page.waitForResponse(response =>
    isQueueRequest(response, "DELETE", queueName),
  );
  const listed = page.waitForResponse(response => isQueueList(response));
  const dialog = page
    .locator("ux-dialog-container")
    .filter({ hasText: "will be deleted" });
  // The dialog fades in, a click before it is fully shown gets lost and leaves
  // the dialog invisible in front of the page
  await expect(dialog).toHaveCSS("opacity", "1");
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  expect((await deleted).ok()).toBe(true);
  await listed;
  await waitForDialogsClosed(page);
  await expect(cell).toBeHidden({ timeout: 15_000 });
}
