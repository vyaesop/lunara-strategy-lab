import { expect, test, type Page } from "@playwright/test";

async function signUpAndSkip(page: Page, name: string) {
  await page.goto("/signup");
  await page.locator("input[autocomplete=name]").fill(name);
  await page.locator("input[type=email]").fill(`${name.toLowerCase()}-${Date.now()}@example.test`);
  await page.locator("input[type=password]").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app\/onboarding/);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL(/\/app$/);
}

test("management game: play twelve months and debrief", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUpAndSkip(page, "Trader");
  await page.goto("/app/game");
  await page.getByRole("button", { name: "New year" }).click();
  await page.waitForURL(/\/app\/game\//);
  for (let m = 1; m <= 12; m++) {
    await expect(page.getByRole("heading", { name: `Month ${m} of 12` })).toBeVisible();
    // Buy modestly so cash and capacity never block the plan.
    await page.locator("input[type=number]").nth(0).fill("380");
    await page.getByRole("button", { name: /End month/ }).click();
    await expect(page.getByRole("heading", { name: `Month ${m} results` })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Year complete" })).toBeVisible();
  await page.getByRole("button", { name: "Generate debrief" }).click();
  await expect(page.getByText(/Your rank 1 of 1/)).toBeVisible({ timeout: 20_000 });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("monthly challenge: all stages through adversarial review to assessment", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signUpAndSkip(page, "Adviser");
  await page.goto("/app/challenges");
  await page.getByRole("button", { name: "Start an attempt" }).click();
  await page.waitForURL(/\/app\/challenges\//);
  // 1 situation
  const areas = page.locator("textarea");
  await areas.nth(0).fill("A concession decision under political pressure.");
  await areas.nth(1).fill("Port loses money");
  await areas.nth(2).fill("Who controls the consortium");
  await page.getByRole("button", { name: "Continue" }).click();
  // 2 hypotheses
  await expect(page.getByRole("heading", { name: /Competing hypotheses/ })).toBeVisible();
  const inputs = page.locator("input[type=text], input:not([type])");
  await inputs.nth(0).fill("The deal is designed to divert cargo");
  await inputs.nth(1).fill("The port can be fixed without a concession");
  await page.getByRole("button", { name: "Continue" }).click();
  // 3 information
  await expect(page.getByRole("heading", { name: /Gather information/ })).toBeVisible();
  await page.locator("li").filter({ hasText: "consortium's ownership" }).getByRole("button", { name: "Take" }).click();
  await expect(page.getByText("Consortium ownership")).toBeVisible();
  await page.getByRole("button", { name: "Finish gathering" }).click();
  // 4 tree (skip)
  await expect(page.getByRole("heading", { name: /Scenario tree/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  // 5 anticipation
  await expect(page.getByRole("heading", { name: /Anticipate responses/ })).toBeVisible();
  await page.getByPlaceholder("Actor").nth(0).fill("Consortium");
  await page.getByPlaceholder("Likely response").nth(0).fill("Lobbies the PM");
  await page.getByPlaceholder("Actor").nth(1).fill("Union");
  await page.getByPlaceholder("Likely response").nth(1).fill("Strikes if lay-offs");
  await page.getByRole("button", { name: "Continue" }).click();
  // 6 strategy
  await expect(page.getByRole("heading", { name: /Primary and fallback/ })).toBeVisible();
  const st = page.locator("textarea");
  await st.nth(0).fill("Run a competitive process with minimum terms.");
  await st.nth(1).fill("State-led crane replacement.");
  await st.nth(2).fill("Development bank will lend");
  await page.getByRole("button", { name: "Continue" }).click();
  // 7 decision
  await expect(page.getByRole("heading", { name: /Final decision/ })).toBeVisible();
  await page.locator("input").first().fill("Do not sign the draft; reframe.");
  await page.locator("textarea").first().fill("Ownership and missing clauses.");
  await page.getByRole("button", { name: "Submit decision" }).click();
  // 8 adversarial
  await expect(page.getByRole("heading", { name: /Adversarial review/ })).toBeVisible({ timeout: 20_000 });
  const answers = page.locator("textarea");
  const n = await answers.count();
  for (let i = 0; i < n; i++) await answers.nth(i).fill("Because the contract has no volume commitment.");
  await page.getByRole("button", { name: /Defend and get assessed/ }).click();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("first attempt")).toBeVisible();
  await expect(page.getByText("Reference analysis")).toBeVisible();
});
