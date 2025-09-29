import { test, expect } from "@playwright/test";

test("Task auf Dashboard abschließen", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(process.env.E2E_USER_EMAIL ?? "admin@mysight.local");
  await page.getByLabel("Passwort").fill(process.env.E2E_USER_PASSWORD ?? "Passw0rd!");
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL("**/dashboard");
  const completeButton = page.getByRole("button", { name: /abschließen/i }).first();
  if (await completeButton.isVisible()) {
    await completeButton.click();
    await expect(completeButton).not.toBeVisible();
  } else {
    await expect(page.getByText(/Aktuell keine Tasks im FLOW/i)).toBeVisible();
  }
});
