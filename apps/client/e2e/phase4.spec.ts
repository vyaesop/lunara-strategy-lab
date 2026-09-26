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

test("simulation: background with sources, counterfactual labelling, completion and debrief", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUpAndSkip(page, "Chancellor");
  await page.goto("/app/simulations");
  const card = page.locator(".panel").filter({ hasText: "After Königgrätz" });
  await card.getByRole("button", { name: /Background and sources/ }).click();
  await expect(card.getByText("Claims and certainty")).toBeVisible();
  await expect(card.getByText("Pflanze").first()).toBeVisible();
  await card.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForURL(/\/app\/simulations\//);

  // Turn 1: counterfactual choice.
  await page.getByText("Back the march on Vienna").click();
  await page.locator("textarea").first().fill("Press the advantage before Austria regroups.");
  await page.getByRole("button", { name: "Decide" }).click();
  await expect(page.getByText("Counterfactual branch").first()).toBeVisible();
  // Turn 2 and 3: historical choices.
  await page.getByText("Persuade the king, with the Crown Prince").click();
  await page.locator("textarea").first().fill("End it before France moves.");
  await page.getByRole("button", { name: "Decide" }).click();
  await page.getByText("Moderate terms plus secret defensive alliances").click();
  await page.getByRole("button", { name: "Decide" }).click();
  await expect(page.getByRole("heading", { name: "Debrief" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/decisions matched the record/)).toBeVisible();
  await expect(page.getByText("The historical record", { exact: true })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("war room: convene three roles, ask a follow-up, record a decision", async ({ page }) => {
  await signUpAndSkip(page, "General");
  await page.goto("/app/war-room");
  await page.locator("input").first().fill("Enter the South");
  await page.locator("textarea").first().fill("Five months of cash, two regions. I lean South. Plan: build the feature first, hire two reps, launch in month three.");
  // Disable operator and auditor to keep it to three roles.
  await page.getByRole("button", { name: "Operator" }).click();
  await page.getByRole("button", { name: "Auditor" }).click();
  await page.getByRole("button", { name: "Convene council" }).click();
  await page.waitForURL(/\/app\/war-room\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Strategist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skeptic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opponent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operator" })).toHaveCount(0);

  await page.locator("select").first().selectOption("opponent");
  await page.getByPlaceholder("Follow-up question").fill("What do you do in week two?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("You", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Decision").fill("Run three weeks of discovery first");
  await page.getByPlaceholder("Rationale").fill("The skeptic's point stands.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: "Your decision" })).toBeVisible();
  await expect(page.getByText("decided")).toBeVisible();
});
