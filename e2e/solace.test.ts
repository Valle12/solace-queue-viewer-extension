import JSZip from "jszip";
import { readFile, unlink } from "node:fs/promises";
import {
  deleteConfiguration,
  getExtensionId,
  launchExtensionContext,
  popupUrl,
  resetStatus,
  saveConfiguration,
  showConfiguration,
  stopServiceWorker,
} from "./extension";
import { expect, test, type Page } from "./persistentFixture";
import {
  connectPublisher,
  createQueue,
  deleteQueue,
  openQueue,
  openQueueMessages,
  openService,
  publishMessages,
  signIn,
  subscribeQueue,
} from "./solaceConsole";

let clusterUrl: string;
let connectionUrl: string;
let username: string;
let password: string;
let vpn: string;
let date = Date.now();
let queueName = `queue-${date}`;
let queueCreated = false;
// Queues are searched by parts of their name, so it must not contain the first one
const secondQueueName = `second-${date}`;
const secondTopic = `test2/${date}`;
const secondQueueJson = { queue: "second" };
let secondQueueCreated = false;
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
    await signIn(page);

    // Connection details of the cluster, the profile of the tests starts empty
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

  // Delete the queues of this run, otherwise they pile up on the test broker.
  // Also runs when a test failed, every retry creates its own queues
  test.afterAll(async ({ page }) => {
    if (!queueCreated && !secondQueueCreated) return;
    await page.goto("https://console.solace.cloud/home");
    await openService(page);
    await page.getByRole("tab", { name: "Manage" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Queues" }).click();
    const queuesPage = await popupPromise;
    if (queueCreated) await deleteQueue(queuesPage, queueName);
    if (secondQueueCreated) await deleteQueue(queuesPage, secondQueueName);
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
    await createQueue(page2, queueName);
    queueCreated = true;
    const topic = `test/${date}`;
    await subscribeQueue(page2, queueName, topic);
    await connectPublisher(page2, password);

    // 5 normal JSON messages
    message1 = JSON.stringify(exampleJson, null, 2);
    await publishMessages(page2, topic, JSON.stringify(exampleJson), 5, 5);

    // 5 normal JSON messages with slight change
    message2 = JSON.stringify(exampleJson2, null, 2);
    const message2Raw = JSON.stringify(exampleJson2);
    await publishMessages(page2, topic, message2Raw, 5, 10);

    // 5 normal JSON messages with extra string data
    message3 = JSON.stringify(exampleJson2, null, 2);
    await publishMessages(page2, topic, `test${message2Raw}string`, 5, 15);

    // 5 corrupted normal JSON messages
    message4 = JSON.stringify(exampleJson2.items, null, 2);
    await publishMessages(page2, topic, message2Raw.substring(1), 5, 20);

    // 5 array JSON messages
    message5 = JSON.stringify(exampleJson2.items, null, 2);
    await publishMessages(
      page2,
      topic,
      JSON.stringify(exampleJson2.items),
      5,
      25,
    );

    // 5 array JSON messages with extra string data
    message6 = JSON.stringify(exampleJson2.items, null, 2);
    await publishMessages(
      page2,
      topic,
      `test${JSON.stringify(exampleJson2.items)}string`,
      5,
      30,
    );

    // 5 corrupted array JSON messages
    message7 = JSON.stringify(exampleJson2.items[0], null, 2);
    await publishMessages(
      page2,
      topic,
      JSON.stringify(exampleJson2.items).substring(1),
      5,
      35,
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

  // Messages are collected per tab, browsing another queue in the same tab
  // must not mix the messages of both queues
  test("download all only contains the messages of the browsed queue", async ({
    page,
  }) => {
    await page.goto("https://console.solace.cloud/home");
    await openService(page);

    await test.step("create a second queue with other messages", async () => {
      await page.getByRole("tab", { name: "Manage" }).click();
      const popupPromise = page.waitForEvent("popup");
      await page.getByRole("link", { name: "Queues" }).click();
      const queuesPage = await popupPromise;
      await createQueue(queuesPage, secondQueueName);
      secondQueueCreated = true;
      await subscribeQueue(queuesPage, secondQueueName, secondTopic);
      await connectPublisher(queuesPage, password);
      await publishMessages(
        queuesPage,
        secondTopic,
        JSON.stringify(secondQueueJson),
        3,
        3,
      );
      await queuesPage.close();
    });

    const brokerPage = await openQueueMessages(page, queueName);

    await test.step("download all messages of the first queue", async () => {
      await brokerPage.locator("#process-button").click();
      // The messages arrive one after the other
      await expect(async () => {
        const files = await downloadAllMessages(brokerPage);
        expect(Object.keys(files).length).toBeGreaterThanOrEqual(29);
      }).toPass({ timeout: 30_000 });
      await brokerPage.locator("#process-button").click();
      await expect(
        brokerPage.locator("#process-button svg path"),
      ).toHaveAttribute("d", playIcon);
    });

    await test.step("the second queue in the same tab only downloads its own messages", async () => {
      await brokerPage.getByRole("link", { name: "navigate_before" }).click();
      await openQueue(brokerPage, secondQueueName);
      await brokerPage.getByRole("link", { name: "Messages Queued" }).click();
      // Try Me! publishes direct messages, the broker can drop one of them
      const queued = Number.parseInt(
        (await brokerPage
          .getByText(/^\d+ Messages Queued$/)
          .first()
          .textContent()) ?? "",
        10,
      );
      expect(queued).toBeGreaterThan(0);
      await brokerPage.locator("#process-button").click();
      await expect(async () => {
        const files = await downloadAllMessages(brokerPage);
        // All messages of this queue, none of the one browsed before
        expect(Object.keys(files)).toHaveLength(queued);
        for (const content of Object.values(files)) {
          expect(JSON.parse(content)).toEqual(secondQueueJson);
        }
      }).toPass({ timeout: 30_000 });
    });
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
      await signIn(page);
      const page2 = await openQueueMessages(page, queueName);
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

  // Existing users add environments to an already registered content script,
  // a different path than the first credentials. The test account only has one
  // real cluster, so the existing environment uses a made up cluster url
  test("another environment works right away, after a browser restart and until it is removed", async () => {
    // Fresh browser with its own login, restarted once
    test.slow();
    const otherClusterUrl = "https://other-environment.invalid:943";
    const profile = test.info().outputPath("profile");
    let context = await launchExtensionContext(profile);
    try {
      let extensionId = await getExtensionId(context);
      const page = context.pages()[0] || (await context.newPage());
      let popupPage = await context.newPage();

      await test.step("save the credentials of an existing environment", async () => {
        await saveConfiguration(popupPage, extensionId, {
          clusterUrl: otherClusterUrl,
          connectionUrl,
          password,
          username,
          vpn,
        });
      });

      let page2 = await test.step("open a cluster without credentials", async () => {
        await signIn(page);
        const brokerPage = await openQueueMessages(page, queueName);
        await brokerPage.locator(messagesTable).waitFor();
        await expect(brokerPage.locator("#process-button")).toBeHidden();
        return brokerPage;
      });

      await test.step("add its credentials, the open tab gets the button", async () => {
        await saveConfiguration(
          popupPage,
          extensionId,
          { clusterUrl, connectionUrl, password, username, vpn },
          2,
        );
        await expect(
          page2.locator("#process-button svg path"),
        ).toHaveAttribute("d", playIcon, { timeout: 15_000 });
        await page2.locator("#process-button").click();
        await expect(
          page2.locator("#process-button svg path"),
        ).toHaveAttribute("d", stopIcon);
        await popupPage.locator("#infos-tab > .button > .content").click();
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: Successfully connected to queue",
          { timeout: 30_000 },
        );
      });

      await test.step("infos are kept when Chrome stops the idle service worker", async () => {
        await stopServiceWorker(popupPage, extensionId);
        await popupPage.reload();
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: Successfully connected to queue",
        );
        // The next message starts the service worker again
        await page2.locator("#process-button").click();
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: Successfully disconnected from queue",
        );
      });

      page2 = await test.step("the credentials still apply after a browser restart", async () => {
        await context.close();
        context = await launchExtensionContext(profile);
        extensionId = await getExtensionId(context);
        const restartedPage = context.pages()[0] || (await context.newPage());
        popupPage = await context.newPage();
        await popupPage.goto(popupUrl(extensionId));
        // Infos and errors are only kept for one browser session
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: -",
        );
        await signIn(restartedPage);
        const brokerPage = await openQueueMessages(restartedPage, queueName);
        await expect(
          brokerPage.locator("#process-button svg path"),
        ).toHaveAttribute("d", playIcon, { timeout: 15_000 });
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: Successfully connected to session",
          { timeout: 30_000 },
        );
        return brokerPage;
      });

      await test.step("a wrong password is reported", async () => {
        // The popup refuses to save invalid credentials, so change the stored ones
        await popupPage.evaluate(
          url =>
            chrome.storage.local.set({ [`${url}.password`]: "wrong password" }),
          clusterUrl,
        );
        await page2.reload();
        await popupPage.locator("#errors-tab > .button > .content").click();
        await expect(popupPage.locator("#errors-panel")).toContainText(
          "Connection to session failed",
          { timeout: 30_000 },
        );
      });

      await test.step("fixing the password in the popup works after a reload", async () => {
        await showConfiguration(popupPage, extensionId, clusterUrl);
        await popupPage
          .getByRole("textbox", { name: "Connection Password" })
          .fill(password);
        await popupPage
          .locator("md-icon-button")
          .filter({ hasText: "save" })
          .locator("#button")
          .click();
        await expect
          .poll(() =>
            popupPage.evaluate(async url => {
              const key = `${url}.password`;
              return (await chrome.storage.local.get(key))[key];
            }, clusterUrl),
          )
          .toBe(password);
        // The info of the session from before the wrong password must not count
        await resetStatus(popupPage);
        await page2.reload();
        await popupPage.locator("#infos-tab > .button > .content").click();
        await expect(popupPage.locator("#infos-panel")).toContainText(
          "Last info: Successfully connected to session",
          { timeout: 30_000 },
        );
        await expect(
          page2.locator("#process-button svg path"),
        ).toHaveAttribute("d", playIcon);
      });

      await test.step("removing the credentials removes the button", async () => {
        await deleteConfiguration(popupPage, extensionId, clusterUrl, 1);
        await page2.reload();
        await page2.locator(messagesTable).waitFor();
        await expect(page2.locator("#process-button")).toBeHidden();
      });
    } finally {
      await context.close();
    }
  });
});

/** Clicks "download all" and returns the content of the files in the zip */
async function downloadAllMessages(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-button").click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const files: Record<string, string> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    files[name] = await file.async("string");
  }
  return files;
}

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
