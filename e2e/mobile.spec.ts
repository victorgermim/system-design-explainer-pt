import { expect, test } from "@playwright/test";

test("phones get a drawer nav and a tiered component list", async ({ page }) => {
  await page.goto("/systems/uber/");

  // Drawer navigation.
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await expect(page.getByRole("dialog", { name: "Navegação" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar navegação" }).click();

  // List view instead of the canvas.
  const architecture = page.locator("#architecture");
  await architecture.scrollIntoViewIfNeeded();
  await expect(architecture.locator(".react-flow")).toHaveCount(0);
  await architecture.getByRole("button", { name: /Pareamento \/ despacho/ }).click();

  // Full-screen details panel.
  await expect(page.getByRole("heading", { name: "Pareamento / despacho" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await expect(page.getByRole("heading", { name: "Pareamento / despacho" })).toHaveCount(0);
});
