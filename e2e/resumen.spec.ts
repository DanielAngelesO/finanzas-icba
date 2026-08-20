import { expect, test } from "@playwright/test";

test.describe("Resumen móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("muestra un dock de filtros flotante al desplazarse y sincroniza la URL", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resumen?period=202608");
    await expect(page.getByRole("region", { name: "Filtros del resumen" })).toBeVisible();

    const dock = page.locator(".dashboard-floating-bar");
    await expect(dock).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(dock).toBeVisible();
    await expect(page.locator(".dashboard-floating-period")).toBeVisible();

    const scopeToggle = dock.getByRole("button", {
      name: "Filtrar por solo aportes: diezmos y ofrendas",
    });
    await expect(scopeToggle).toHaveAttribute("aria-pressed", "true");
    await scopeToggle.click();
    await expect(page).toHaveURL(/income=all/);
    await expect(scopeToggle).toHaveAttribute("aria-pressed", "false");

    await dock.getByRole("combobox", { name: "Período" }).selectOption("202607");
    await expect(page).toHaveURL(/period=202607/);
    await expect(page).toHaveURL(/income=all/);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(dock).toBeHidden();
  });

  test("elimina los bloques de fecha de corte y comparación del contexto", async ({ page }) => {
    await page.goto("/resumen?period=202608");
    await expect(page.getByRole("region", { name: "Filtros del resumen" })).toBeVisible();

    await expect(page.getByText("Fecha de corte")).toHaveCount(0);
    await expect(page.getByText("Comparación", { exact: true })).toHaveCount(0);
    await expect(page.locator(".dashboard-context-detail")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Filtros del resumen" })).toBeVisible();
  });
});
