import { loadEnvFile } from "node:process";
import { expect, test } from "./freshFixture";

let solaceEmail: string;
let solacePassword: string;

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

test.only("test if valid credentials can be saved", async ({
  page,
  extensionId,
}) => {
  await page.goto("https://console.solace.cloud/login");
  await page.getByRole("textbox", { name: "Email" }).fill(solaceEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(solacePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Cluster Manager Cluster").click();
  await page.getByText("aks-germanywestcentral").click();
  const clusterUrl = `https://${await page
    .locator('[data-qa="service-hostname"]')
    .textContent()}:943`;
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
  await page
    .getByRole("textbox", { name: "Solace Cluster URL" })
    .fill("https://1:943");
  const locatorConnectionUrl = page.getByRole("textbox", {
    name: "Connection URL",
  });
  await locatorConnectionUrl.fill("wss://hello.world:443");
  await page
    .getByRole("textbox", { name: "Connection Password" })
    .fill(password);
  await page
    .getByRole("textbox", { name: "Connection Username" })
    .fill(username);
  await page.getByRole("textbox", { name: "Connection VPN" }).fill(vpn);
  const locatorSaveButton = page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button");
  await locatorSaveButton.click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid connection credentials",
  );
  await locatorConnectionUrl.fill(connectionUrl);
  await expect(page.getByRole("alert")).toBeHidden();
  await locatorSaveButton.click();
  await expect(
    page
      .locator("md-icon-button")
      .filter({ hasText: "delete" })
      .locator("#button"),
  ).toBeVisible(); // FIXME should also update UI directly without opening and closing the popup
  await page.goto("https://console.solace.cloud/login");
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await page.locator("#settings-tab > .button > .content").click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    "Configurations (1)",
  );
  await expect(
    page
      .locator("md-icon-button")
      .filter({ hasText: "delete" })
      .locator("#button"),
  ).toBeVisible();
  await page
    .locator("md-icon-button")
    .filter({ hasText: "add" })
    .locator("#button")
    .click();
  await page
    .getByRole("textbox", { name: "Solace Cluster URL" })
    .fill("https://2:943");
  await page
    .getByRole("textbox", { name: "Connection URL" })
    .fill(connectionUrl);
  await page
    .getByRole("textbox", { name: "Connection Password" })
    .fill(password);
  await page
    .getByRole("textbox", { name: "Connection Username" })
    .fill(username);
  await page.getByRole("textbox", { name: "Connection VPN" }).fill(vpn);
  await page
    .locator("md-icon-button")
    .filter({ hasText: "save" })
    .locator("#button")
    .click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    "Configurations (2)",
  );
  // TODO Find better solution instead of logging to use time
  // Probably put an id to the elements and wait for that
  // So the dom will be different for each configuration
  // Right now the elements stay the same, only text changes
  await page.waitForSelector("#configuration-1");
  await expect(page.locator("#configuration-1")).toHaveText("https://2:943");
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://2:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_right" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://1:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_right" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://2:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_right" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://1:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_left" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://2:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_left" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://1:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "chevron_left" })
    .locator("#button")
    .click();
  console.log("Before");
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://2:943");
  console.log("After");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "delete" })
    .locator("#button")
    .click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    "Configurations (1)",
  );
  await expect(
    page.getByRole("textbox", { name: "Solace Cluster URL" }),
  ).toHaveValue("https://1:943");
  await page
    .locator("md-icon-button")
    .filter({ hasText: "delete" })
    .locator("#button")
    .click();
  await expect(page.getByLabel("settings Settings")).toContainText(
    "Configurations (1)",
  ); // FIXME should be (0)
});
