import { expect, test } from "@playwright/test";

test("operator can execute and reset a synthetic invoice action", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Computer-Use Flight Simulator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review a clean invoice dispute" })).toBeVisible();
  await page.getByRole("button", { name: "Submit dispute" }).click();
  await expect(page.getByText(/Action recorded:/)).toBeVisible();
  await expect(page.getByText("dispute_submitted")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("operations-console.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(page.getByText("review_required")).toBeVisible();
});
