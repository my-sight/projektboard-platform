import { test, expect } from "@playwright/test";

test.describe("Authentifizierung", () => {
  test("Login-Seite akzeptiert Credentials und leitet auf Dashboard um", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("mysight Login")).toBeVisible();
    await page.getByLabel("E-Mail").fill(process.env.E2E_USER_EMAIL ?? "admin@mysight.local");
    await page.getByLabel("Passwort").fill(process.env.E2E_USER_PASSWORD ?? "Passw0rd!");
    await page.getByRole("button", { name: /anmelden/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Meine Boards/i })).toBeVisible();
  });
});
