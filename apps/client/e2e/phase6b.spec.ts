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

test("negotiation: talk, propose, get countered, accept their offer, debrief reveals incentives", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await signUpAndSkip(page, "Closer");
  await page.goto("/app/negotiations");
  const card = page.locator(".panel").filter({ hasText: "The Offer" });
  await card.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/app\/negotiations\//);
  await page.getByPlaceholder(/Say something/).fill("What flexibility is there on the start date?");
  await page.getByPlaceholder(/Say something/).press("Enter");
  await expect(page.locator(".rounded-xl").filter({ hasText: /mock coach|Priya|band|start/i }).last()).toBeVisible({ timeout: 15_000 });

  const form = page.locator("form").filter({ hasText: "Propose" });
  await form.locator("input[type=number]").nth(0).fill("112");
  await form.locator("input[type=number]").nth(1).fill("10");
  await form.locator("input[type=number]").nth(2).fill("4");
  await form.getByRole("button", { name: "Propose" }).click();
  await expect(page.getByRole("heading", { name: "Their current offer" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Accept their offer" }).click();
  await expect(page.getByText("Deal reached")).toBeVisible();
  await page.getByRole("button", { name: "Generate debrief" }).click();
  await expect(page.getByText("The counterpart's simulated incentives")).toBeVisible({ timeout: 20_000 });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("missions: build a custom mission, answer steps in order, debrief", async ({ page }) => {
  await signUpAndSkip(page, "Commander");
  await page.goto("/app/missions");
  await page.getByRole("button", { name: "Build a custom mission" }).click();
  const builder = page.locator("form").filter({ hasText: "Create mission" });
  await builder.locator("input").first().fill("Hire a first salesperson");
  await builder.locator("textarea").nth(0).fill("Decide whether and how.");
  await builder.locator("textarea").nth(1).fill("A defensible hiring decision");
  await builder.getByPlaceholder("Prompt").nth(0).fill("What must be true for this hire to pay back within a year?");
  await builder.getByPlaceholder("Prompt").nth(1).fill("Decide, with a trigger to revisit.");
  await builder.getByRole("button", { name: "Create mission" }).click();
  const card = page.locator(".panel").filter({ hasText: "Hire a first salesperson" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/app\/missions\//);
  await page.getByPlaceholder("Your response").fill("Twenty leads a month and a 15% close rate.");
  await page.getByRole("button", { name: "Save step" }).click();
  await page.getByPlaceholder("Your response").fill("Hire on a six-month contract; revisit if fewer than 10 leads by month three.");
  await page.getByRole("button", { name: "Save step" }).click();
  await page.getByRole("button", { name: "Generate debrief" }).click();
  await expect(page.getByText(/Overall \d+/)).toBeVisible({ timeout: 20_000 });
});
