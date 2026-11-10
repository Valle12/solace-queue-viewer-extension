import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { resolve } from "path";
import { blockAppcues } from "./solaceConsole";

export type Configuration = {
  clusterUrl: string;
  connectionUrl: string;
  password: string;
  username: string;
  vpn: string;
};

/** Starts chromium with the built extension, an empty userDataDir creates a fresh profile */
export async function launchExtensionContext(
  userDataDir: string,
  permissions: string[] = [],
) {
  const pathToExtension = resolve("dist");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: "chromium",
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
    permissions,
  });
  await blockAppcues(context);
  return context;
}

async function getServiceWorker(context: BrowserContext) {
  const [serviceWorker] = context.serviceWorkers();
  return (
    serviceWorker ??
    (await context.waitForEvent("serviceworker", { timeout: 30_000 }))
  );
}

export async function getExtensionId(context: BrowserContext) {
  const serviceWorker = await getServiceWorker(context);
  return serviceWorker.url().split("/")[2];
}

export function popupUrl(extensionId: string) {
  return `chrome-extension://${extensionId}/src/popup/popup.html`;
}

/** Adds a configuration in the popup and waits until it is stored */
export async function saveConfiguration(
  page: Page,
  extensionId: string,
  config: Configuration,
  expectedCount = 1,
) {
  if (!page.url().startsWith(popupUrl(extensionId))) {
    await page.goto(popupUrl(extensionId));
  }

  await page.locator("#settings-tab > .button > .content").click();
  await page
    .locator("md-icon-button")
    .filter({ hasText: "add" })
    .locator("#button")
    .click();
  await page
    .getByRole("textbox", { name: "Solace Cluster URL" })
    .fill(config.clusterUrl);
  await page
    .getByRole("textbox", { name: "Connection URL" })
    .fill(config.connectionUrl);
  await page
    .getByRole("textbox", { name: "Connection Password" })
    .fill(config.password);
  await page
    .getByRole("textbox", { name: "Connection Username" })
    .fill(config.username);
  await page.getByRole("textbox", { name: "Connection VPN" }).fill(config.vpn);
  await page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button")
    .click();
  // Saving verifies the credentials against the broker first
  await expect(page.getByLabel("settings Settings")).toContainText(
    `Configurations (${expectedCount})`,
    { timeout: 15_000 },
  );
  // The counter is updated before the configuration is written to the storage
  await expect
    .poll(() => storedClusterUrls(page))
    .toContain(config.clusterUrl);
}

/** Cluster urls with saved credentials, read in an extension page */
export async function storedClusterUrls(page: Page) {
  return page.evaluate(
    async () =>
      ((await chrome.storage.local.get("clusterUrls")).clusterUrls as
        | string[]
        | undefined) ?? [],
  );
}

/** Opens the popup settings on the configuration of the cluster */
export async function showConfiguration(
  page: Page,
  extensionId: string,
  clusterUrl: string,
) {
  await page.goto(popupUrl(extensionId));
  await page.locator("#settings-tab > .button > .content").click();
  const clusterUrlField = page.locator("md-outlined-text-field.cluster-url");
  const shownClusterUrl = () =>
    clusterUrlField.evaluate(field => (field as HTMLInputElement).value);
  // Only one configuration is shown at a time, step through them
  await expect(async () => {
    if ((await shownClusterUrl()) !== clusterUrl) {
      await page
        .locator("md-icon-button")
        .filter({ hasText: "chevron_right" })
        .locator("#button")
        .click();
    }
    expect(await shownClusterUrl()).toBe(clusterUrl);
  }).toPass({ timeout: 15_000 });
}

/** Deletes the configuration of the cluster in the popup and waits until it is removed from the storage */
export async function deleteConfiguration(
  page: Page,
  extensionId: string,
  clusterUrl: string,
  remainingCount: number,
) {
  await showConfiguration(page, extensionId, clusterUrl);
  await page
    .locator("md-icon-button")
    .filter({ hasText: "delete" })
    .locator("#button")
    .click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    remainingCount === 0
      ? "No Configurations"
      : `Configurations (${remainingCount})`,
  );
  await expect
    .poll(() => storedClusterUrls(page))
    .not.toContain(clusterUrl);
}

/** Stops the service worker of the extension, like Chrome does after ~30 s without events */
export async function stopServiceWorker(page: Page, extensionId: string) {
  const cdp = await page.context().newCDPSession(page);
  const versions = new Map<
    string,
    { scriptURL: string; runningStatus: string; status: string }
  >();
  cdp.on("ServiceWorker.workerVersionUpdated", event => {
    for (const version of event.versions)
      versions.set(version.versionId, version);
  });
  await cdp.send("ServiceWorker.enable");
  const activeVersionId = () =>
    [...versions.entries()].find(
      ([, version]) =>
        version.scriptURL.startsWith(`chrome-extension://${extensionId}/`) &&
        version.status === "activated",
    )?.[0];

  await expect.poll(activeVersionId).toBeDefined();
  await cdp.send("ServiceWorker.stopWorker", {
    versionId: activeVersionId() as string,
  });
  await expect
    .poll(() => versions.get(activeVersionId() as string)?.runningStatus)
    .toBe("stopped");
  await cdp.detach();
}

/** Clears infos and errors, so following assertions can only match new ones */
export async function resetStatus(popupPage: Page) {
  await popupPage.evaluate(() => chrome.storage.session.remove("status"));
  await expect(popupPage.locator("#infos-panel")).toContainText(
    "Last info: -",
  );
}
