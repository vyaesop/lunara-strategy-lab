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

test("investigation: actions reveal evidence, linked hypothesis, conclusion and evaluation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUpAndSkip(page, "Sleuth");

  await page.getByRole("link", { name: "Inference Lab" }).first().click();
  await expect(page.getByRole("heading", { name: "Investigations" })).toBeVisible();
  const card = page.locator(".panel").filter({ hasText: "The Warehouse Fire" });
  await card.getByRole("button", { name: "Open case" }).click();
  await page.waitForURL(/\/app\/inference\//);
  await expect(page.getByText("12/12 points")).toBeVisible();

  // Take the scene walk, then the electrical report it unlocks.
  const action = (label: string) => page.locator("li").filter({ hasText: label }).getByRole("button", { name: "Take" });
  await action("Walk the fire scene").click();
  await expect(page.getByText("10/12 points")).toBeVisible();
  await expect(page.getByText("Scene examination")).toBeVisible();
  await action("electrical engineer").click();
  await expect(page.getByText("7/12 points")).toBeVisible();

  // Hypothesis linked to revealed evidence.
  await page.getByRole("button", { name: "Add" }).click();
  const form = page.locator("form").filter({ hasText: "Record hypothesis" });
  await form.locator("textarea").first().fill("An overloaded extension lead started the fire.");
  await form.locator("select").first().selectOption("ent-electrical");
  const originRow = form.locator("li").filter({ hasText: "Scene examination" });
  await originRow.locator("select").first().selectOption("supports");
  const engineerRow = form.locator("li").filter({ hasText: "Electrical engineer" });
  await engineerRow.locator("select").first().selectOption("supports");
  await form.getByRole("button", { name: "Record hypothesis" }).click();
  await expect(page.getByText("An overloaded extension lead started the fire.").first()).toBeVisible();

  // Conclude.
  page.on("dialog", (d) => d.accept());
  const conclude = page.locator("form").filter({ hasText: "Submit conclusion" });
  await conclude.locator("select").selectOption({ index: 1 });
  await conclude.locator("textarea").fill("Scene and engineer's report converge on an accidental fault.");
  await conclude.getByRole("button", { name: "Submit conclusion" }).click();
  await expect(page.getByRole("heading", { name: "Evaluation" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Conclusion matches the ground truth")).toBeVisible();
  await expect(page.getByText(/What actually happened/)).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("scenario tree: add nodes, save, reopen, structural critique", async ({ page }) => {
  await signUpAndSkip(page, "Mapper");
  await page.goto("/app/trees");
  await page.locator("input[placeholder='Regional launch plan']").fill("Launch plan");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/app\/trees\//);
  const url = page.url();

  // Select the root node, add a decision as its child, then an outcome under the decision.
  await page.locator(".react-flow__node").first().click();
  await page.getByRole("button", { name: "+ Decision" }).click();
  await page.getByRole("button", { name: "+ Outcome" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("saved")).toBeVisible();
  await expect(page.getByText("v2")).toBeVisible();

  await page.goto(url);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  await page.getByRole("button", { name: "Critique" }).click();
  await page.getByRole("button", { name: "Independent" }).click();
  await expect(page.getByText(/is not a decision/)).toBeVisible();
});
