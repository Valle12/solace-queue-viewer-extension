import { loadEnvFile } from "node:process";
import { expect, test, type Page } from "./freshFixture";

let solaceEmail: string;
let solacePassword: string;

async function waitForConfiguration(
  page: Page,
  configIndex: number,
  expectedClusterUrl: string,
) {
  await page.waitForFunction(
    ({ index, url }) => {
      const config = document.querySelector(
        `#configuration-${index}`,
      ) as HTMLInputElement | null;
      return config && config.value === url;
    },
    { index: configIndex, url: expectedClusterUrl },
    { timeout: 5000 },
  );
}

test.beforeAll(() => {
  loadEnvFile();
  solaceEmail = process.env.SOLACE_EMAIL;
  solacePassword = process.env.SOLACE_PASSWORD;
});

test("test if popup loads correctly", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  const locatorInfo = page.getByText("Last info: -");
  await expect(locatorInfo).toBeVisible();
  await expect(locatorInfo).toHaveCount(1);
  await page.locator("#errors-tab > .button > .content").click();
  const locatorErrors = page.getByText("No errors");
  await expect(locatorErrors).toBeVisible();
  await expect(locatorErrors).toHaveCount(1);
  await page.locator("#settings-tab > .button > .content").click();
  const locatorSettings = page.getByText("No Configurations");
  await expect(locatorSettings).toBeVisible();
  await expect(locatorSettings).toHaveCount(1);
});

test("test if invalid credentials can't be saved", async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await page.locator("#settings-tab > .button > .content").click();
  await page
    .locator("md-icon-button")
    .filter({ hasText: "add" })
    .locator("#button")
    .click();
  const locatorClusterUrl = page.getByRole("textbox", {
    name: "Solace Cluster URL",
  });
  await locatorClusterUrl.fill("h");
  await expect(
    page.getByText("circle Provide URL as shown").getByRole("alert"),
  ).toBeVisible();
  await locatorClusterUrl.fill("https://google.com:123");
  const locatorAlert = page
    .getByRole("alert")
    .getByText('Provide URL as shown in "How');
  await expect(locatorAlert).toBeHidden();
  const locatorConnectionUrl = page.getByRole("textbox", {
    name: "Connection URL",
  });
  await locatorConnectionUrl.fill("w");
  await expect(locatorAlert).toBeVisible();
  await locatorConnectionUrl.fill("wss://hello.world:443");
  await expect(locatorAlert).toBeHidden();
  const locatorPassword = page.getByRole("textbox", {
    name: "Connection Password",
  });
  await locatorPassword.fill("test");
  const locatorUsername = page.getByRole("textbox", {
    name: "Connection Username",
  });
  await locatorUsername.fill("solace-cloud-client");
  const locatorVPN = page.getByRole("textbox", { name: "Connection VPN" });
  await locatorVPN.fill("sqv");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button")
    .click();
  const locatorAlertInvalid = page
    .getByText("circle Invalid connection")
    .getByRole("alert");
  await expect(locatorAlertInvalid).toBeVisible();
  await expect(locatorAlertInvalid).toContainText(
    "Invalid connection credentials",
  );
});

test("test if valid credentials can be saved", async ({
  page,
  extensionId,
}) => {
  await page.goto("https://console.solace.cloud/login");
  await page.getByRole("textbox", { name: "Email" }).fill(solaceEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(solacePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Cluster Manager Cluster").click();
  await page.getByText("aks-germanywestcentral").click();
  await page.locator('[data-qa="service-hostname"]').textContent();
  await page.getByRole("tab", { name: "Connect" }).click();
  await page.getByRole("button", { name: "Connect with JavaScript" }).click();
  await page.getByText("Solace JavaScript APIweb-").click();
  const username = (await page
    .locator('[data-qa="service-username"]')
    .textContent()) as string;
  await page.locator('[data-qa="view_password_password"]').click();
  const password = (await page
    .locator('[data-qa="service-password"]')
    .textContent()) as string;
  const vpn = (await page
    .locator('[data-qa="service-vpn"]')
    .textContent()) as string;
  const connectionUrl = (await page
    .locator('[data-qa="connecthost-uri-0-0"]')
    .textContent()) as string;
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await page.locator("#settings-tab > .button > .content").click();
  await page.locator("#button").click();
  const locatorClusterUrl = page.getByRole("textbox", {
    name: "Solace Cluster URL",
  });
  await locatorClusterUrl.fill("https://1:943");
  const locatorConnectionUrl = page.getByRole("textbox", {
    name: "Connection URL",
  });
  await locatorConnectionUrl.fill("wss://hello.world:443");
  const locatorPassword = page.getByRole("textbox", {
    name: "Connection Password",
  });
  await locatorPassword.fill(password);
  const locatorUsername = page.getByRole("textbox", {
    name: "Connection Username",
  });
  await locatorUsername.fill(username);
  const locatorVPN = page.getByRole("textbox", { name: "Connection VPN" });
  await locatorVPN.fill(vpn);
  const locatorSaveButton = page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button");
  await locatorSaveButton.click();
  const locatorAlert = page.getByRole("alert");
  await expect(locatorAlert).toContainText("Invalid connection credentials");
  await locatorConnectionUrl.fill(connectionUrl);
  await expect(locatorAlert).toBeHidden();
  await locatorSaveButton.click();
  const locatorDeleteButton = page
    .locator("md-icon-button")
    .filter({ hasText: "delete" })
    .locator("#button");
  await expect(locatorDeleteButton).toBeVisible();
  const locatorSettings = page.getByLabel("settings Settings");
  await expect(locatorSettings).toContainText("Configurations (1)");
  await expect(locatorDeleteButton).toBeVisible();
  await page
    .locator("md-icon-button")
    .filter({ hasText: "add" })
    .locator("#button")
    .click();
  await locatorClusterUrl.fill("https://2:943");
  await locatorConnectionUrl.fill(connectionUrl);
  await locatorPassword.fill(password);
  await locatorUsername.fill(username);
  await locatorVPN.fill(vpn);
  await locatorSaveButton.click();
  await expect(locatorSettings).toContainText("Configurations (2)");
  await waitForConfiguration(page, 1, "https://2:943");
  const locatorChevronRight = page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_right" })
    .locator("#button");
  await locatorChevronRight.click();
  await waitForConfiguration(page, 0, "https://1:943");
  await locatorChevronRight.click();
  await waitForConfiguration(page, 1, "https://2:943");
  await locatorChevronRight.click();
  await waitForConfiguration(page, 0, "https://1:943");
  const locatorChevronLeft = page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_left" })
    .locator("#button");
  await locatorChevronLeft.click();
  await waitForConfiguration(page, 1, "https://2:943");
  await locatorChevronLeft.click();
  await waitForConfiguration(page, 0, "https://1:943");
  await locatorChevronLeft.click();
  await waitForConfiguration(page, 1, "https://2:943");
  await locatorDeleteButton.click();
  await expect(locatorSettings).toContainText("Configurations (1)");
  await waitForConfiguration(page, 0, "https://1:943");
  await locatorDeleteButton.click();
  await expect(locatorSettings).toContainText("No Configurations");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button")
    .click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    "Configurations (1)",
  );
});
