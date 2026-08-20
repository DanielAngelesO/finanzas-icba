import { expect, test, type Page } from "@playwright/test";

const fitsViewport = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("Vistas sin desbordamiento horizontal en móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Resumen cabe en el ancho de la pantalla en ambas pestañas de análisis", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resumen?period=202608");
    await expect(page.getByRole("region", { name: "Filtros del resumen" })).toBeVisible();
    await expect(page.locator("table.sr-only").first()).toBeAttached();

    expect(await fitsViewport(page), "La vista Resumen desborda horizontalmente").toBe(true);

    await page.getByRole("tab", { name: "Últimos 12 meses" }).click();
    await expect(
      page.getByRole("region", { name: "Gráfico desplazable de composición mensual de ingresos" }),
    ).toBeVisible();

    expect(await fitsViewport(page), "La pestaña anual de Resumen desborda horizontalmente").toBe(
      true,
    );
  });

  test("Gastos cabe en el ancho de la pantalla", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/gastos");
    await expect(page.getByRole("heading", { name: "Análisis de gastos" })).toBeVisible();
    await expect(page.locator("table.sr-only").first()).toBeAttached();

    expect(await fitsViewport(page), "La vista Gastos desborda horizontalmente").toBe(true);
  });
});
