import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(process.env.E2E_USER_EMAIL ?? "admin@mysight.local");
  await page.getByLabel("Passwort").fill(process.env.E2E_USER_PASSWORD ?? "Passw0rd!");
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("Board Interaktionen", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("öffnet Karte und legt Statusblock an", async ({ page }) => {
    const boardId = process.env.E2E_BOARD_ID ?? "demo-board-id";
    await page.goto(`/boards/${boardId}`);
    await expect(page.getByRole("heading", { name: /Phasenbasierte Übersicht/i })).toBeVisible();
    const firstCard = page.locator("[data-testid='board-card']").first();
    await expect(firstCard).toBeVisible();
    await firstCard.locator("text=✎").click();
    await expect(page.getByText(/Projekt/)).toBeVisible();
    await page.getByRole("button", { name: /Status/i }).click();
    await page.fill("textarea", "E2E Statusupdate");
    await page.getByRole("button", { name: /Statusblock anlegen/i }).click();
    await expect(page.getByText("E2E Statusupdate")).toBeVisible();
  });
});
