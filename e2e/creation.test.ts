import { faker } from "@faker-js/faker";
import { test } from "@playwright/test";
import { MailSlurp } from "mailslurp-client";
import { loadEnvFile } from "node:process";

test("creation", async ({ page }) => {
  loadEnvFile();
  const solaceEmail = process.env.SOLACE_EMAIL;
  const solacePassword = process.env.SOLACE_PASSWORD;
  const mailslurpApiKey = process.env.MAILSLURP_API_KEY;

  await page.goto("https://console.solace.cloud/login");
  await page.getByText("Sign Up").click();
  await page.locator("#email").click();
  await page.locator("#email").fill(solaceEmail);
  await page.locator("#firstName").click();
  await page.locator("#firstName").fill(faker.person.firstName());
  await page.locator("#lastName").click();
  await page.locator("#lastName").fill(faker.person.lastName());
  await page.locator("#company").click();
  await page.locator("#company").fill(faker.company.name());
  await page.locator("#fakeinput_jobTitle").click();
  await page.locator("#dropdownjs_jobTitle").getByText("Developer").click();
  await page.locator("#fakeinput_intent").click();
  await page
    .locator("#dropdownjs_intent")
    .getByText("Evaluate the Solace platform")
    .click();
  await page.locator("#password").click();
  await page.locator("#password").fill(solacePassword);
  await page.locator("#confirm").click();
  await page.locator("#confirm").fill(solacePassword);
  await page.getByText("I agree to the").click();
  await page.getByRole("button", { name: "Sign Up" }).click();

  const mailslurpClient = new MailSlurp({ apiKey: mailslurpApiKey });
  const inbox = await mailslurpClient.inboxController.getInboxByEmailAddress({
    emailAddress: solaceEmail,
  });
  if (!inbox.inboxId) throw new Error("Inbox ID not found");
  const email = await mailslurpClient.waitForLatestEmail(inbox.inboxId);
  const regex = /https:\/\/console\.solace\.cloud\/login\?token=[^"]+/;
  const match = email.body?.match(regex);
  if (!match) throw new Error("Verification link not found in email");
  const verificationLink = match[0];

  await page.goto(verificationLink);
  await page.getByRole("textbox", { name: "Email" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(solaceEmail);
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill(solacePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Cluster Manager Cluster").click();
  await page.locator("#empty-panel-btn").click();
  await page.getByTestId("name").click();
  await page.getByTestId("name").fill("Test");
  await page.locator("#cloud").click();
  await page.getByText("Microsoft Azure").click();
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByText("aks-germanywestcentral").click();
  await page.getByRole("button", { name: "Create Service" }).click();
});
