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

/**
 * Like launchExtensionContext, but for a reused profile: Chrome only registers the
 * service worker of an unpacked extension again when the version changes, so the
 * profile keeps running the background script of an older build. Unloading the
 * extension once drops that registration, the relaunched browser registers the current build.
 */
export async function launchCurrentExtensionContext(
  userDataDir: string,
  permissions: string[] = [],
) {
  const staleContext = await launchExtensionContext(userDataDir, permissions);
  const serviceWorker = await getServiceWorker(staleContext);
  const unloaded = new Promise(resolve => {
    serviceWorker.once("close", resolve);
    setTimeout(resolve, 10_000);
  });
  // A command line extension stays unloaded after the reload, until the next launch
  try {
    await serviceWorker.evaluate(() => chrome.runtime.reload());
  } catch {
    // The worker can shut down before the evaluation returns
  }
  await unloaded;
  await staleContext.close();
  return launchExtensionContext(userDataDir, permissions);
}

async function getServiceWorker(context: BrowserContext) {
  const [serviceWorker] = context.serviceWorkers();
  return serviceWorker ?? (await context.waitForEvent("serviceworker"));
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
    .poll(() =>
      page.evaluate(
        async clusterUrl =>
          (
            (await chrome.storage.local.get("clusterUrls")).clusterUrls as
              | string[]
              | undefined
          )?.includes(clusterUrl) ?? false,
        config.clusterUrl,
      ),
    )
    .toBe(true);
}

/** Clears infos and errors, so following assertions can only match new ones */
export async function resetStatus(popupPage: Page) {
  await popupPage.evaluate(() => chrome.storage.session.remove("status"));
  await expect(popupPage.locator("#infos-panel")).toContainText(
    "Last info: -",
  );
}
