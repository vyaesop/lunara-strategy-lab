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

test("library: add text, read, save excerpt, ask, generate questions into review, then review", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUpAndSkip(page, "Bookworm");
  await page.goto("/app/library");
  await page.locator("input").first().fill("Base rates");
  await page.locator("textarea").first().fill(
    "Base rates matter when a screen flags a rare event, because most flags are false positives. A likelihood ratio tells you how much a signal should move your belief. Multiply the prior odds by the ratio to get the posterior odds. Calibration means your stated confidence matches your accuracy over time.",
  );
  await page.getByRole("button", { name: /Add to library/ }).click();
  await page.waitForURL(/\/app\/library\//);
  await expect(page.getByRole("heading", { name: "Base rates" })).toBeVisible();

  // Select a passage programmatically, then generate questions from it.
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid=reader-text]") as HTMLElement;
    const range = document.createRange();
    range.setStart(el.firstChild!, 0);
    range.setEnd(el.firstChild!, 200);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "Selection" })).toBeVisible();
  await page.getByRole("button", { name: "Save excerpt" }).click();
  await expect(page.getByText("excerpt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate questions" }).click();
  await expect(page.getByRole("heading", { name: "Generated from the passage" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Save questions to review/ }).click();
  await expect(page.getByRole("heading", { name: "Generated from the passage" })).toHaveCount(0);

  // Ask about the document.
  await page.getByPlaceholder(/Ask/).fill("Why are most flags false positives?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/Only that passage was sent/)).toBeVisible();

  // Review the generated item.
  await page.goto("/app/review");
  await expect(page.getByText(/due$/).first()).toBeVisible();
  await page.getByRole("button", { name: "Reveal" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText("Nothing due")).toBeVisible();

  // Knowledge graph has the suggested concept, unconfirmed.
  await page.goto("/app/knowledge");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
