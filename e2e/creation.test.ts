import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import {
  MailSlurp,
  MatchOptionFieldEnum,
  MatchOptionShouldEnum,
} from "mailslurp-client";

test("creation", async ({ page }) => {
  test.setTimeout(300_000);

  const solaceEmail = process.env.SOLACE_EMAIL;
  const solacePassword = process.env.SOLACE_PASSWORD;
  const mailslurpApiKey = process.env.MAILSLURP_API_KEY;

  // Block Appcues onboarding tours, their overlay intercepts all clicks
  await page.route(/^https:\/\/[^/]*appcues\.(com|net)\//, (route) =>
    route.abort(),
  );

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
  const signUpTime = new Date(Date.now() - 60_000);
  await page.getByRole("button", { name: "Sign Up" }).click();

  const mailslurpClient = new MailSlurp({ apiKey: mailslurpApiKey });
  const inbox = await mailslurpClient.inboxController.getInboxByEmailAddress({
    emailAddress: solaceEmail,
  });
  if (!inbox.inboxId) throw new Error("Inbox ID not found");
  const email = await mailslurpClient.waitController.waitForMatchingFirstEmail({
    inboxId: inbox.inboxId,
    since: signUpTime,
    timeout: 60_000,
    matchOptions: {
      matches: [
        {
          field: MatchOptionFieldEnum.SUBJECT,
          should: MatchOptionShouldEnum.EQUAL,
          value: "Welcome to Solace Cloud",
        },
      ],
    },
  });
  const { links } = await mailslurpClient.emailController.getEmailLinks({
    emailId: email.id,
    selector: 'a[value="Activate"]',
  });
  const verificationLink = links[0];
  if (!verificationLink) throw new Error("Activate button not found in email");

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
  // "Create Service" is always enabled, so wait until the region's service
  // classes have loaded and the Connections select shows a value
  const connections = page.locator("#serviceClass");
  await expect(
    connections,
    "Connections not available (service limit reached or region unsupported?)",
  ).not.toHaveAttribute("aria-disabled", "true", { timeout: 60_000 });
  await expect(connections).toHaveText(/\d/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Create Service" }).click();
  // After creation the console navigates to the new service's details page
  await expect(page).toHaveURL(/\/mc\/services\/[a-z0-9]+\//, {
    timeout: 60_000,
  });
  await expect(page.getByText("Service Details").first()).toBeVisible();
});
