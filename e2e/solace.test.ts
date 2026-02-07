import { readFile, unlink } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { expect, test, type Page } from "./persistentFixture";

let solaceEmail: string;
let solacePassword: string;
let clusterUrl: string;
let connectionUrl: string;
let username: string;
let password: string;
let vpn: string;
let date = Date.now();
let queueName = `queue-${date}`;
let message1: string;
let message2: string;
let message3: string;
let message4: string;
let message5: string;
let message6: string;
let message7: string;

const exampleJson = {
  airline: "ExampleAirline",
  region: "Ontario",
  requestId: 44334,
  flight: {
    flightModel: "boeing737",
    flightRoute: "international",
  },
  items: [
    {
      origin: "yow",
      destination: "ewr",
      status: "boarding",
    },
  ],
  totalPassengers: 300,
  lastUpdated: "2024-01-05T14:30:00",
};

const exampleJson2 = JSON.parse(JSON.stringify(exampleJson));
exampleJson2.airline = "ExampleAirline2";

// TODO test leaving queue (navigating, reloading etc) ends connection
// TODO test opening message without starting process shows error message in popup
// TODO test start button not being visible without saved credentials (probably needs freshFixture)
test.describe.serial.only("Solace", () => {
  test.beforeAll(async ({ page, extensionId }) => {
    loadEnvFile();
    solaceEmail = process.env.SOLACE_EMAIL;
    solacePassword = process.env.SOLACE_PASSWORD;

    // load extension context
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    const clusterUrls = await page.evaluate(() =>
      chrome.storage.local.get("clusterUrls"),
    );

    const configurations = clusterUrls.clusterUrls as undefined | string[];
    if (configurations && configurations.length > 0) {
      const savedPassword = await page.evaluate(
        configuration => chrome.storage.local.get(`${configuration}.password`),
        configurations[0],
      );
      password = savedPassword[`${configurations[0]}.password`] as string;
    }

    await page.goto("https://console.solace.cloud/login");
    await page.getByRole("textbox", { name: "Email" }).fill(solaceEmail);
    await page.getByRole("textbox", { name: "Password" }).fill(solacePassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    if (configurations && configurations.length > 0) return;

    await page.getByText("Cluster Manager Cluster").click();
    await page.getByText("aks-germanywestcentral").click();
    clusterUrl = (await page
      .locator('[data-qa="service-hostname"]')
      .textContent()) as string;
    await page.getByRole("tab", { name: "Connect" }).click();
    await page.getByRole("button", { name: "Connect with JavaScript" }).click();
    await page.getByText("Solace JavaScript APIweb-").click();
    username = (await page
      .locator('[data-qa="service-username"]')
      .textContent()) as string;
    await page.locator('[data-qa="view_password_password"]').click();
    password = (await page
      .locator('[data-qa="service-password"]')
      .textContent()) as string;
    vpn = (await page
      .locator('[data-qa="service-vpn"]')
      .textContent()) as string;
    connectionUrl = (await page
      .locator('[data-qa="connecthost-uri-0-0"]')
      .textContent()) as string;
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await page.locator("#settings-tab > .button > .content").click();
    await page.locator("#button").click();
    const locatorClusterUrl = page.getByRole("textbox", {
      name: "Solace Cluster URL",
    });
    await locatorClusterUrl.fill(`https://${clusterUrl}:943`);
    const locatorConnectionUrl = page.getByRole("textbox", {
      name: "Connection URL",
    });
    await locatorConnectionUrl.fill(connectionUrl);
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
  });

  test("create queue and fill with content", async ({ page, extensionId }) => {
    await page.goto("https://console.solace.cloud/login");
    await page.getByText("Cluster Manager Cluster").click();
    await page
      .locator("div")
      .filter({ hasText: /^Testaks-germanywestcentral$/ })
      .first()
      .click();
    let expansionPage = await page.context().newPage();
    await expansionPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`,
    );
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: -",
    );
    await expansionPage.close();
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const page2 = await popupPromise;
    await page2.getByRole("button", { name: "add Queue" }).click();
    await page2.getByRole("textbox", { name: "Queue Name" }).fill(queueName);
    await page2.getByRole("button", { name: "Create" }).click({
      delay: 250,
    });
    await page2.getByRole("button", { name: "Apply" }).click();
    await page2.getByRole("cell", { name: queueName }).click();
    await page2.getByRole("link", { name: "Subscriptions" }).click();
    await page2.getByRole("button", { name: "add Subscription" }).click();
    await page2
      .getByRole("textbox", { name: "Type in a topic or paste new" })
      .fill(`test/${date}`);
    await page2.getByRole("button", { name: "Create" }).click();
    await page2.getByRole("link", { name: "Try Me!" }).click();
    await page2.getByText("navigate_next").nth(3).click();
    await page2.locator("#pubPassword").fill(password);

    await page2.getByRole("button", { name: "Connect" }).first().click();
    await expect(
      page2.getByRole("button", { name: "Disconnect" }),
    ).toBeVisible();
    await page2.locator("#pubTopic").fill(`test/${date}`);

    // 5 normal JSON messages
    message1 = JSON.stringify(exampleJson, null, 2);
    await page2.locator("#pubMessage").fill(JSON.stringify(exampleJson));
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "5 Direct0 Persistent",
    );

    // 5 normal JSON messages with slight change
    message2 = JSON.stringify(exampleJson2, null, 2);
    const message2Raw = JSON.stringify(exampleJson2);
    await page2.locator("#pubMessage").fill(message2Raw);
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "10 Direct0 Persistent",
    );

    // 5 normal JSON messages with extra string data
    message3 = JSON.stringify(exampleJson2, null, 2);
    await page2.locator("#pubMessage").fill(`test${message2Raw}string`);
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "15 Direct0 Persistent",
    );

    // 5 corrupted normal JSON messages
    message4 = JSON.stringify(exampleJson2.items, null, 2);
    await page2.locator("#pubMessage").fill(message2Raw.substring(1));
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "20 Direct0 Persistent",
    );

    // 5 array JSON messages
    message5 = JSON.stringify(exampleJson2.items, null, 2);
    await page2.locator("#pubMessage").fill(JSON.stringify(exampleJson2.items));
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "25 Direct0 Persistent",
    );

    // 5 array JSON messages with extra string data
    message6 = JSON.stringify(exampleJson2.items, null, 2);
    await page2
      .locator("#pubMessage")
      .fill(`test${JSON.stringify(exampleJson2.items)}string`);
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "30 Direct0 Persistent",
    );

    // 5 corrupted array JSON messages
    message7 = JSON.stringify(exampleJson2.items[0], null, 2);
    await page2
      .locator("#pubMessage")
      .fill(JSON.stringify(exampleJson2.items).substring(1));
    await page2
      .getByRole("button", { name: "Publish" })
      .click({ clickCount: 5, delay: 50 });
    await expect(page2.locator("#tab-publish")).toContainText(
      "35 Direct0 Persistent",
    );
  });

  test("verify messages in extension", async ({ page, extensionId }) => {
    await page.goto("https://console.solace.cloud/login");
    await page.getByText("Cluster Manager Cluster").click();
    await page
      .locator("div")
      .filter({ hasText: /^Testaks-germanywestcentral$/ })
      .first()
      .click();
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const page2 = await popupPromise;
    let expansionPage = await page2.context().newPage();
    await expansionPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`,
    );
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: Successfully connected to session",
    );
    await expansionPage.close();
    await page2.getByRole("cell", { name: queueName }).click();
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    await expect(
      page2.getByRole("button").filter({ hasText: /^$/ }),
    ).toBeVisible();
    expect(
      await page2
        .getByRole("button")
        .filter({ hasText: /^$/ })
        .locator("svg path")
        .getAttribute("d"),
    ).toBe("M320-200v-560l440 280-440 280Z");
    await page2.getByRole("button").filter({ hasText: /^$/ }).click();
    expect(
      await page2
        .getByRole("button")
        .filter({ hasText: /^$/ })
        .locator("svg path")
        .getAttribute("d"),
    ).toBe("M240-240v-480h480v480H240Z");
    expansionPage = await page2.context().newPage();
    await expansionPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`,
    );
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: Successfully connected to queue",
    );
    await expansionPage.close();
    await page2.locator("#fakeinput_rowsPerPage").click();
    await page2.locator("#dropdownjs_rowsPerPage").getByText("50").click();

    // verify messages
    await testMessage(
      page2,
      0,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: "/: \\\\{ \\"airline\\": \\"ExampleAirline\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"
    `,
      `- text: "/\\\\{ \\"airline\\": \\"ExampleAirline\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"`,
      message1,
    );
    await testMessage(
      page2,
      6,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: "/: \\\\{ \\"airline\\": \\"ExampleAirline2\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"
    `,
      `- text: "/\\\\{ \\"airline\\": \\"ExampleAirline2\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"`,
      message2,
    );
    await testMessage(
      page2,
      12,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: "/: \\\\{ \\"airline\\": \\"ExampleAirline2\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"
    `,
      `- text: "/\\\\{ \\"airline\\": \\"ExampleAirline2\\", \\"region\\": \\"Ontario\\", \\"requestId\\": \\\\d+, \\"flight\\": \\\\{ \\"flightModel\\": \\"boeing737\\", \\"flightRoute\\": \\"international\\" \\\\}, \\"items\\": \\\\[ \\\\{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" \\\\} \\\\], \\"totalPassengers\\": \\\\d+, \\"lastUpdated\\": \\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\" \\\\}/"`,
      message3,
    );
    await testMessage(
      page2,
      18,
      false,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: "/: \\"airline\\":\\"ExampleAirline2\\",\\"region\\":\\"Ontario\\",\\"requestId\\":\\\\d+,\\"flight\\":\\\\{\\"flightModel\\":\\"boeing737\\",\\"flightRoute\\":\\"international\\"\\\\},\\"items\\":\\\\[\\\\{\\"origin\\":\\"yow\\",\\"destination\\":\\"ewr\\",\\"status\\":\\"boarding\\"\\\\}\\\\],\\"totalPassengers\\":\\\\d+,\\"lastUpdated\\":\\"\\\\d+-\\\\d+-05T14:\\\\d+:\\\\d+\\"\\\\}/"
    `,
      "",
      message4,
    );
    await testMessage(
      page2,
      23,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: ": [ { \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" } ]"
    `,
      `- text: "[ { \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" } ]"`,
      message5,
    );
    await testMessage(
      page2,
      28,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: ": [ { \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" } ]"
    `,
      `- text: "[ { \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" } ]"`,
      message6,
    );
    await testMessage(
      page2,
      33,
      true,
      `
    - strong: Topic
    - text: "/: test\\\\/\\\\d+/"
    - strong: Message
    - text: ": { \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" }"
    `,
      `- text: "{ \\"origin\\": \\"yow\\", \\"destination\\": \\"ewr\\", \\"status\\": \\"boarding\\" }"`,
      message7,
    );

    await page2.getByRole("button").filter({ hasText: /^$/ }).click();
    expect(
      await page2
        .getByRole("button")
        .filter({ hasText: /^$/ })
        .locator("svg path")
        .getAttribute("d"),
    ).toBe("M320-200v-560l440 280-440 280Z");
  });
});

async function testMessage(
  page: Page,
  index: number,
  json: boolean,
  snapshot1: string,
  snapshot2: string,
  jsonContent: string,
) {
  await page
    .locator("table.table.table-sm")
    .nth(1)
    .locator("tbody")
    .nth(1 + index)
    .click();
  await expect(
    page.getByRole("button", { name: "Copy message to clipboard" }),
  ).toBeVisible();
  if (json) {
    await expect(
      page.getByRole("button", { name: "Format message to pretty JSON" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download JSON" }),
    ).toBeVisible();
  }

  await expect(
    page
      .locator("table.table.table-sm")
      .nth(1)
      .locator("tbody")
      .nth(1 + index)
      .locator("tr")
      .nth(1)
      .locator("td compose div")
      .last(),
  ).toMatchAriaSnapshot(snapshot1);
  await page.getByRole("button", { name: "Copy message to clipboard" }).click();
  const clipboard = expect(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  if (index === 0) {
    clipboard.toContain('ExampleAirline"');
  } else if (index < 23) {
    clipboard.toContain('ExampleAirline2"');
  } else {
    clipboard.toContain('origin"');
  }

  if (json) {
    await page
      .getByRole("button", { name: "Format message to pretty JSON" })
      .click();
    await expect(
      page
        .locator("table.table.table-sm")
        .nth(1)
        .locator("tbody")
        .nth(1 + index)
        .locator("tr")
        .nth(1)
        .locator("pre"),
    ).toMatchAriaSnapshot(snapshot2);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download JSON" }).click();
    const download = await downloadPromise;
    const savedPath = `./credentials/downloads/${download.suggestedFilename()}`;
    expect(savedPath).toBe(`./credentials/downloads/test_${date}.json`);
    await download.saveAs(savedPath);
    const content = await readFile(savedPath, "utf-8");
    expect(content).toBe(jsonContent);
    await unlink(savedPath);
  }

  await page
    .locator("table.table.table-sm")
    .nth(1)
    .locator("tbody")
    .nth(1 + index)
    .locator("tr")
    .nth(0)
    .click();
}
