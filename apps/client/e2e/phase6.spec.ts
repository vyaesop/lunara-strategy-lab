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

test("strategy lab: project with items and suggestions, decision journal, daily briefing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUpAndSkip(page, "Operator");

  // Project
  await page.goto("/app/projects");
  await page.locator("input").first().fill("Launch South");
  await page.locator("textarea").first().fill("Five months of cash, two regions.");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/app\/projects\//);
  await page.getByPlaceholder("Add to assumptions").fill("The feature takes ten weeks");
  await page.getByPlaceholder("Add to assumptions").press("Enter");
  await expect(page.getByText("The feature takes ten weeks")).toBeVisible();
  await page.getByRole("button", { name: /Suggest structure/ }).click();
  await expect(page.getByRole("heading", { name: /Suggestions/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Accept" }).first().click();
  await page.getByRole("button", { name: "Close" }).click();

  // Journal
  await page.goto("/app/journal");
  await page.getByRole("button", { name: "Log a decision" }).click();
  const form = page.locator("form").filter({ hasText: "Save decision" });
  await form.locator("input").nth(0).fill("Discovery first");
  await form.locator("textarea").nth(0).fill("Two regions, limited cash.");
  await form.locator("input").nth(1).fill("Credible growth evidence");
  await form.locator("input").nth(2).fill("Three weeks of discovery calls").catch(async () => form.getByPlaceholder("What will happen").fill("x"));
  // Chosen action and rationale are required.
  const inputs = form.locator("input[type='text'], input:not([type])");
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i);
    if ((await el.inputValue()) === "" && (await el.getAttribute("required")) !== null) await el.fill("Three weeks of discovery calls");
  }
  const areas = form.locator("textarea");
  const areaCount = await areas.count();
  for (let i = 0; i < areaCount; i++) {
    const el = areas.nth(i);
    if ((await el.inputValue()) === "" && (await el.getAttribute("required")) !== null) await el.fill("Cheap information before expensive commitment.");
  }
  await form.getByPlaceholder("What will happen").fill("At least 5 of 10 operators say they would pay");
  await form.getByPlaceholder("%").fill("60");
  await form.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Discovery first")).toBeVisible();
  await page.getByText("Discovery first").click();
  await page.getByRole("button", { name: "Happened" }).click();
  await expect(page.getByText("happened", { exact: true })).toBeVisible();

  // Briefing
  await page.goto("/app/briefing");
  await expect(page.getByRole("heading", { name: "1. Puzzle" })).toBeVisible();
  await page.locator("textarea").first().fill("My answer");
  await page.getByRole("button", { name: "Commit and reveal" }).click();
  await expect(page.getByText("Your answer")).toBeVisible();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByText("self-marked incorrect")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
