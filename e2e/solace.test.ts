import JSZip from "jszip";
import { readFile, unlink } from "node:fs/promises";
import {
  getExtensionId,
  launchExtensionContext,
  popupUrl,
  resetStatus,
  saveConfiguration,
} from "./extension";
import { expect, test, type Page } from "./persistentFixture";
import { deleteQueue, openQueue, openService } from "./solaceConsole";

let solaceEmail: string;
let solacePassword: string;
let clusterUrl: string;
let connectionUrl: string;
let username: string;
let password: string;
let vpn: string;
let date = Date.now();
let queueName = `queue-${date}`;
let queueCreated = false;
let message1: string;
let message2: string;
let message3: string;
let message4: string;
let message5: string;
let message6: string;
let message7: string;
let firstId: string;
// Same selector the extension uses to find the messages table
const messagesTable = "div.table-container table.table.table-sm";
// Paths of the svg icons the extension inserts
const playIcon = "M320-200v-560l440 280-440 280Z";
const stopIcon = "M240-240v-480h480v480H240Z";
const downloadIcon =
  "M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z";

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

test.describe.serial("Solace", () => {
  test.beforeAll(async ({ page, extensionId }) => {
    solaceEmail = process.env.SOLACE_EMAIL;
    solacePassword = process.env.SOLACE_PASSWORD;

    // /home redirects to /login when the persistent session has expired
    await page.goto("https://console.solace.cloud/home");
    const emailInput = page.getByRole("textbox", { name: "Email" });
    await expect(
      emailInput.or(page.getByText("Cluster Manager Cluster")),
    ).toBeVisible({ timeout: 30_000 });
    if (await emailInput.isVisible()) {
      await emailInput.fill(solaceEmail);
      await page
        .getByRole("textbox", { name: "Password" })
        .fill(solacePassword);
      await page.getByRole("button", { name: "Sign in" }).click();
    }

    // Always read the connection details, the saved configuration may belong
    // to an older cluster (e.g. after the cluster or account was recreated)
    await openService(page);
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
    clusterUrl = `https://${new URL(connectionUrl).hostname}:943`;

    await page.goto(popupUrl(extensionId));
    const { clusterUrls } = await page.evaluate(() =>
      chrome.storage.local.get("clusterUrls"),
    );
    if ((clusterUrls as string[] | undefined)?.includes(clusterUrl)) return;

    // Replace configurations of other clusters with the current one
    await page.evaluate(() => chrome.storage.local.clear());
    await page.reload();
    await saveConfiguration(page, extensionId, {
      clusterUrl,
      connectionUrl,
      password,
      username,
      vpn,
    });
  });

  // Tests open their own Broker Manager tabs, close them so their sessions
  // can't change the infos shown in the popup of later tests
  test.afterEach(async ({ context }) => {
    if (!clusterUrl) return;
    for (const openPage of context.pages()) {
      if (openPage.url().startsWith(clusterUrl)) await openPage.close();
    }
  });

  // Delete the queue of this run, otherwise they pile up on the test broker.
  // Also runs when a test failed, every retry creates its own queue
  test.afterAll(async ({ page }) => {
    if (!queueCreated) return;
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const queuesPage = await popupPromise;
    await deleteQueue(queuesPage, queueName);
    await queuesPage.close();
  });

  test("create queue and fill with content", async ({ page, extensionId }) => {
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    let expansionPage = await page.context().newPage();
    await expansionPage.goto(popupUrl(extensionId));
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
    queueCreated = true;
    await openQueue(page2, queueName);
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
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    // The status outlives tabs, reset it so only the new Broker Manager can set it
    let expansionPage = await page.context().newPage();
    await expansionPage.goto(popupUrl(extensionId));
    await resetStatus(expansionPage);
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const page2 = await popupPromise;
    // The popup updates live, the extension connects once the Broker Manager has loaded (slow on CI)
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: Successfully connected to session",
      { timeout: 30_000 },
    );
    await expansionPage.close();
    await openQueue(page2, queueName);
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    await expect(page2.locator("#process-button")).toBeVisible();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      playIcon,
    );
    await page2.locator("#process-button").click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      stopIcon,
    );
    await expect(page2.locator("#download-button svg path")).toHaveAttribute(
      "d",
      downloadIcon,
    );
    expansionPage = await page2.context().newPage();
    await expansionPage.goto(popupUrl(extensionId));
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: Successfully connected to queue",
      { timeout: 15_000 },
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

    const downloadPromise = page2.waitForEvent("download");
    await page2.locator("#download-button").click();
    const download = await downloadPromise;
    const savedPath = `./credentials/downloads/${download.suggestedFilename()}`;
    expect(savedPath).toBe(`./credentials/downloads/all_messages.zip`);
    await download.saveAs(savedPath);
    const zipData = await readFile(savedPath);
    const zip = await JSZip.loadAsync(zipData);
    expect(Object.keys(zip.files).length).toBeGreaterThanOrEqual(29);
    await unlink(savedPath);

    await page2.locator("#process-button").click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      playIcon,
    );
    expansionPage = await page2.context().newPage();
    await expansionPage.goto(popupUrl(extensionId));
    await expect(expansionPage.locator("#infos-panel")).toContainText(
      "Last info: Successfully disconnected from queue",
    );
    await expansionPage.close();
    await page2.locator("#fakeinput_rowsPerPage").click();
    await page2.locator("#dropdownjs_rowsPerPage").getByText("20").click();
    await page2.getByRole("button", { name: "Next" }).click();
    await page2
      .locator(messagesTable)
      .locator("span")
      // Exact match, otherwise hidden spans like the replication group message
      // id ("rmid1:...00000038") can match and waitFor never resolves
      .filter({ hasText: new RegExp(`^\\s*${parseInt(firstId) + 20 + 11}\\s*$`) })
      .first()
      .waitFor();
    await testMessage(
      page2,
      11,
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
    await page2.getByRole("button", { name: "First" }).click();
    await page2
      .locator(messagesTable)
      .locator("span")
      .filter({ hasText: new RegExp(`^\\s*${firstId.trim()}\\s*$`) })
      .first()
      .waitFor();
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
  });

  test("test error in popup from opening message without starting process", async ({
    page,
    extensionId,
  }) => {
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    // The errors outlive tabs, reset them so only this click can add the error
    const extensionPage = await page.context().newPage();
    await extensionPage.goto(popupUrl(extensionId));
    await resetStatus(extensionPage);
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const page2 = await popupPromise;
    await openQueue(page2, queueName);
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    // The content script adds the click listener of the table together with the button
    await expect(page2.locator("#process-button")).toBeVisible();
    await page2
      .locator(messagesTable)
      .locator("tbody")
      .nth(1)
      .click();
    await extensionPage.locator("#errors-tab > .button > .content").click();
    await expect(extensionPage.locator("#errors-panel")).toContainText(
      "Message not saved before. Is the process running?",
    );
    await extensionPage.close();
  });

  test("test navigating away from queue while process is active", async ({
    page,
  }) => {
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const page2 = await popupPromise;
    await openQueue(page2, queueName);
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    await page2.locator("#process-button").click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      stopIcon,
    );
    await expect(page2.locator("#download-button svg path")).toHaveAttribute(
      "d",
      downloadIcon,
    );
    await page2.getByRole("link", { name: "navigate_before" }).click();
    await openQueue(page2, queueName);
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      playIcon,
    );
    await page2.locator("#process-button").click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      stopIcon,
    );
    await expect(page2.locator("#download-button svg path")).toHaveAttribute(
      "d",
      downloadIcon,
    );
    await page2.goBack();
    await page2.getByRole("link", { name: "Messages Queued" }).click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      playIcon,
    );
    await page2.locator("#process-button").click();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      stopIcon,
    );
    await expect(page2.locator("#download-button svg path")).toHaveAttribute(
      "d",
      downloadIcon,
    );
    await page2.reload();
    await expect(page2.locator("#process-button svg path")).toHaveAttribute(
      "d",
      playIcon,
    );
    // TODO think about auto reconnecting after a refresh
    // the content script is reinjected, so the connection is interrupted and variables are reset to their default values
    // maybe save the state for each clusterurl in the background script and try to reconnect if state was connected before the refresh
  });

  // Regression: credentials of a new cluster were only picked up after a
  // browser restart (sometimes days later), now they apply right after saving
  test("start button appears right after saving credentials, without browser restart", async () => {
    // Fresh browser with its own login
    test.slow();
    const context = await launchExtensionContext("");
    try {
      const extensionId = await getExtensionId(context);
      const page = context.pages()[0] || (await context.newPage());
      await page.goto("https://console.solace.cloud/login");
      await page.getByRole("textbox", { name: "Email" }).fill(solaceEmail);
      await page
        .getByRole("textbox", { name: "Password" })
        .fill(solacePassword);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(url => !url.pathname.includes("/login"), {
        timeout: 30000,
      });
      await openService(page);
      await page.getByRole("tab", { name: "Manage" }).click();
      const popupPromise = page.waitForEvent("popup");
      await page.getByRole("link", { name: "Queues" }).click();
      const page2 = await popupPromise;
      await openQueue(page2, queueName);
      await page2.getByRole("link", { name: "Messages Queued" }).click();
      await page2.locator(messagesTable).waitFor();
      // No credentials saved yet
      await expect(page2.locator("#process-button")).toBeHidden();

      // Save them while the Broker Manager stays open
      const popupPage = await context.newPage();
      await saveConfiguration(popupPage, extensionId, {
        clusterUrl,
        connectionUrl,
        password,
        username,
        vpn,
      });

      // The open tab gets the content script injected, no reload needed
      await expect(page2.locator("#process-button svg path")).toHaveAttribute(
        "d",
        playIcon,
        { timeout: 15_000 },
      );
      await page2.locator("#process-button").click();
      await expect(page2.locator("#process-button svg path")).toHaveAttribute(
        "d",
        stopIcon,
      );
      await popupPage.locator("#infos-tab > .button > .content").click();
      await expect(popupPage.locator("#infos-panel")).toContainText(
        "Last info: Successfully connected to queue",
        { timeout: 30_000 },
      );

      // New page loads get the registered content script
      await page2.reload();
      await expect(page2.locator("#process-button svg path")).toHaveAttribute(
        "d",
        playIcon,
        { timeout: 15_000 },
      );
    } finally {
      await context.close();
    }
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
    .locator(messagesTable)
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
      .locator(messagesTable)
      .locator("tbody")
      .nth(1 + index)
      .locator("tr")
      .nth(1)
      .locator("td compose div")
      .last(),
  ).toMatchAriaSnapshot(snapshot1);
  await page.getByRole("button", { name: "Copy message to clipboard" }).click();
  let expectedClipboard: string;
  if (index === 0) {
    firstId = (await page
      .locator(messagesTable)
      .locator("tbody")
      .nth(1)
      .locator("tr")
      .nth(0)
      .locator("td")
      .nth(2)
      .locator("span")
      .textContent()) as string;
    expectedClipboard = 'ExampleAirline"';
  } else if (index === 11) {
    expectedClipboard = 'origin"';
  } else if (index < 23) {
    expectedClipboard = 'ExampleAirline2"';
  } else {
    expectedClipboard = 'origin"';
  }
  // The copy button writes the clipboard asynchronously
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain(expectedClipboard);

  if (json) {
    await page
      .getByRole("button", { name: "Format message to pretty JSON" })
      .click();
    await expect(
      page
        .locator(messagesTable)
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
    .locator(messagesTable)
    .locator("tbody")
    .nth(1 + index)
    .locator("tr")
    .nth(0)
    .click();
}
