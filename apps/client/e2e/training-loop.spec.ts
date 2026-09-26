import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "correct-horse-battery";

async function signUp(page: Page, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.locator("input[autocomplete=name]").fill(name);
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app\/onboarding/);
  return email;
}

test.describe("training loop", () => {
  test("sign up, onboard, complete a coached session with assessment, see progress", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Think like a strategist/ })).toBeVisible();

    await signUp(page, "Loop");
    await page.getByRole("button", { name: "Reason more rigorously" }).click();
    await page.getByRole("button", { name: "Deductive reasoning" }).click();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByRole("heading", { name: /Ready/ })).toBeVisible();
    await expect(page.getByText(/Recommended because/).first()).toBeVisible();

    // Start the recommended deductive exercise from the catalog.
    await page.getByRole("link", { name: "Train" }).first().click();
    await page.getByRole("link", { name: /The Locked Archive/ }).click();
    await page.getByRole("button", { name: "Start session" }).click();
    await page.waitForURL(/\/app\/sessions\//);
    const sessionUrl = page.url();

    await page.locator("textarea").first().fill("A ledger is missing; I must state what the logs prove and whom they exclude.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/mock coach/)).toBeVisible();

    // Hypothesis with evidence links.
    await page.getByRole("button", { name: "Add" }).click();
    const hypForm = page.locator("form").filter({ hasText: "Record hypothesis" });
    await hypForm.locator("textarea").nth(0).fill("Bram used Cato's badge at 18:20.");
    await hypForm.locator("textarea").nth(1).fill("Badge found in Bram's desk");
    await hypForm.getByRole("button", { name: "Record hypothesis" }).click();
    await expect(page.getByText("Bram used Cato's badge at 18:20.")).toBeVisible();

    // One hint, then phases to the decision.
    await page.getByRole("button", { name: /Hint 1 of 5/ }).click();
    await expect(page.getByRole("button", { name: /Hint 2 of 5/ })).toBeVisible();
    for (const label of ["Move to Challenge", "Move to Revision", "Move to Decision"]) {
      await page.getByRole("button", { name: label }).click();
    }
    const decision = page.locator("form").filter({ hasText: "Submit decision" });
    await decision.locator("input").first().fill("Bram or Cato; the evidence cannot decide");
    await decision.locator("textarea").first().fill("Ada left at 17:45; Dana entered after the ledger was gone.");
    await decision.getByRole("button", { name: /Submit decision/ }).click();
    await expect(page.getByRole("heading", { name: "Debrief" })).toBeVisible();
    await expect(page.getByText(/Correct final answer/)).toBeVisible();

    // Assessment and completion.
    await page.getByRole("button", { name: "Assess my reasoning" }).click();
    await expect(page.getByText(/Overall \d+/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unaided \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Complete session" }).click();
    await expect(page.getByText("completed").first()).toBeVisible();

    // Resume works: reload the session URL and see the assessment again.
    await page.goto(sessionUrl);
    await expect(page.getByText(/Overall \d+/)).toBeVisible();

    // Progress shows skill evidence and the command center recommends something else.
    await page.getByRole("link", { name: "Progress" }).first().click();
    await expect(page.getByText(/1 obs\./).first()).toBeVisible();
    await page.getByRole("link", { name: "Command Center" }).first().click();
    await expect(page.getByText(/Completed/).first()).toBeVisible();
    await expect(page.getByText("Recommended next")).toBeVisible();
    await expect(page.getByText("The Locked Archive").first()).toBeVisible(); // in recent sessions

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("another user cannot open someone else's session", async ({ browser }) => {
    const a = await browser.newPage();
    await signUp(a, "Owner");
    await a.getByRole("button", { name: "Skip for now" }).click();
    await a.waitForURL(/\/app$/);
    await a.goto("/app/train/ex-miracle-cohort");
    await a.getByRole("button", { name: "Start session" }).click();
    await a.waitForURL(/\/app\/sessions\//);
    const url = a.url();
    await a.close();

    const ctx = await browser.newContext();
    const b = await ctx.newPage();
    await signUp(b, "Other");
    await b.getByRole("button", { name: "Skip for now" }).click();
    await b.waitForURL(/\/app$/);
    await b.goto(url);
    await expect(b.getByText(/not found/i)).toBeVisible();
    await ctx.close();
  });

  test("mobile layout uses bottom tabs", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await signUp(page, "Mobile");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByRole("heading", { name: /Ready/ })).toBeVisible();
    const tabs = page.locator("nav.fixed a");
    await expect(tabs).toHaveCount(4);
    await ctx.close();
  });
});
