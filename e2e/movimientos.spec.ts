import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const uniqueDescription = () => `Compra E2E ${Date.now()}`;

test.describe("Movimientos CRUD en modo review", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("crea, edita y anula un egreso conservando el contexto del listado", async ({ page }) => {
    const description = uniqueDescription();
    const editedDescription = `${description} editada`;

    await page.goto("/movimientos?period=202608&type=EGRESO");
    await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar nuevo movimiento" })).toBeEnabled();

    await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
    const editor = page.getByRole("dialog", { name: /Nuevo egreso/i });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: /Guardar egreso/i }).click();
    await expect(editor.getByText(/Ingresa un monto mayor que cero/i)).toBeVisible();
    await expect(editor.getByLabel("Monto")).toBeFocused();

    await editor.getByLabel("Monto").fill("125.40");
    await editor.getByLabel("Descripción").fill(description);
    await editor.getByRole("button", { name: /Guardar egreso/i }).click();
    await expect(page.getByText("Egreso registrado")).toBeVisible();
    await expect(page).toHaveURL(/\/movimientos\?period=202608&type=EGRESO/);

    await page.getByRole("button", { name: new RegExp(`Egreso: ${description}`) }).click();
    const detail = page.getByRole("dialog", { name: description });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Editar" }).click();

    const editDialog = page.getByRole("dialog", { name: /Editar egreso/i });
    await editDialog.getByLabel("Descripción").fill(editedDescription);
    await editDialog.getByRole("button", { name: /Guardar egreso/i }).click();
    await expect(page.getByText("Egreso actualizado")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`Egreso: ${editedDescription}`) }).click();
    const updatedDetail = page.getByRole("dialog", { name: editedDescription });
    await updatedDetail.getByRole("button", { name: "Anular" }).click();

    const voidDialog = page.getByRole("alertdialog", { name: "Anular transacción" });
    await voidDialog.getByLabel(/Motivo/i).fill("Registro duplicado durante prueba E2E");
    await voidDialog.getByRole("button", { name: "Anular transacción" }).click();
    await expect(page.getByText("Transacción anulada")).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(`Egreso: ${editedDescription}.*Anulada`) }),
    ).toBeVisible();
  });

  test("mantiene la URL al filtrar y respeta navegación Atrás", async ({ page }) => {
    await page.goto("/movimientos?period=202608");
    await expect(page.getByRole("button", { name: /Abrir filtros/i })).toBeEnabled();
    await page.getByRole("button", { name: /Abrir filtros/i }).click();
    const filters = page.getByRole("dialog", { name: "Filtros" });
    await filters.getByLabel("Estado").selectOption("CONFIRMED");
    await filters.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(/status=CONFIRMED/);

    await page.getByRole("button", { name: "Buscar movimientos" }).click();
    await page.getByRole("textbox", { name: "Buscar movimientos" }).fill("aporte");
    await expect(page).toHaveURL(/q=aporte/);
    await page.getByRole("button", { name: /Ingreso: Aporte mensual/i }).click();
    await expect(page).toHaveURL(/\/movimientos\/[^/?]+\?/);
    await page.goBack();
    await expect(page).toHaveURL(/status=CONFIRMED/);
    await expect(page).toHaveURL(/q=aporte/);
  });
});

test("usa una composición móvil plana y conserva la búsqueda al cerrarla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/movimientos?period=202608");

  const toolbar = page.locator(".transaction-toolbar");
  const results = page.locator(".transaction-results");
  const mobileGeometry = await toolbar.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return {
      left: Math.round(bounds.left),
      right: Math.round(bounds.right),
      radius: styles.borderTopLeftRadius,
      shadow: styles.boxShadow,
    };
  });
  expect(mobileGeometry.left).toBeLessThanOrEqual(1);
  expect(mobileGeometry.right).toBeGreaterThanOrEqual(389);
  expect(mobileGeometry.radius).toBe("0px");
  expect(mobileGeometry.shadow).toBe("none");

  await expect(page.locator("#transaction-search-input")).toBeHidden();
  await expect(page.getByRole("button", { name: "Buscar movimientos" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator(".transaction-mobile-confirmed-status").first()).toBeHidden();
  await expect(toolbar).toHaveScreenshot("movimientos-toolbar-mobile.png", {
    animations: "disabled",
  });
  await expect(results).toHaveScreenshot("movimientos-results-mobile.png", {
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Buscar movimientos" }).click();
  const search = page.getByRole("textbox", { name: "Buscar movimientos" });
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  await search.fill("aporte");
  await expect(page).toHaveURL(/q=aporte/);

  await search.press("Escape");
  await expect(page.locator("#transaction-search-input")).toBeHidden();
  await expect(page.getByRole("button", { name: "Buscar movimientos" })).toBeFocused();
  await expect(page.getByRole("button", { name: /Búsqueda: aporte/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Buscar movimientos" })).toBeVisible();
});

test("restaura los contenedores y la búsqueda visible desde 768 px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/movimientos?period=202608");

  const toolbar = page.locator(".transaction-toolbar");
  const results = page.locator(".transaction-results");
  const tabletGeometry = await toolbar.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return {
      left: Math.round(bounds.left),
      right: Math.round(bounds.right),
      radius: styles.borderTopLeftRadius,
    };
  });
  expect(tabletGeometry.left).toBeGreaterThan(0);
  expect(tabletGeometry.right).toBeLessThan(768);
  expect(tabletGeometry.radius).not.toBe("0px");

  await expect(page.locator("#transaction-search-input")).toBeVisible();
  await expect(page.locator(".transaction-search-toggle")).toBeHidden();
  await expect(page.locator(".transaction-mobile-confirmed-status").first()).toBeVisible();
  await expect(toolbar).toHaveScreenshot("movimientos-toolbar-tablet.png", {
    animations: "disabled",
  });
  await expect(results).toHaveScreenshot("movimientos-results-tablet.png", {
    animations: "disabled",
  });
});

test("cumple el escaneo WCAG AA en el listado y el editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/movimientos?period=202608");
  await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();

  const listScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(listScan.violations).toEqual([]);

  await page.getByRole("button", { name: "Buscar movimientos" }).click();
  const expandedListScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(expandedListScan.violations).toEqual([]);
  await page.getByRole("textbox", { name: "Buscar movimientos" }).press("Escape");

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.getByRole("button", { name: "Cerrar menú", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightListScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(lightListScan.violations).toEqual([]);

  await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
  const editor = page.getByRole("dialog", { name: "Nuevo egreso" });
  await expect(editor).toBeVisible();
  await editor.locator(".transaction-dynamic-field-enter").evaluateAll(async (elements) => {
    await Promise.all(
      elements.flatMap((element) => element.getAnimations().map((item) => item.finished)),
    );
  });
  const editorScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(editorScan.violations).toEqual([]);
});

test("mantiene reflow con tema claro y texto al 200 %", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/movimientos?period=202608");
  await page.getByRole("button", { name: "Usar tema claro" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
});

for (const width of [320, 390, 767, 768, 1024, 1440]) {
  test(`no desborda horizontalmente a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/movimientos?period=202608");
    await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      offenders: [...document.body.querySelectorAll<HTMLElement>("*")]
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            className: element.className,
            tagName: element.tagName,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width),
          };
        })
        .filter(
          (element) =>
            element.right > window.innerWidth + 1 && element.left < window.innerWidth + 1,
        )
        .slice(0, 12),
    }));
    expect(
      layout.documentWidth,
      `Elementos fuera del viewport: ${JSON.stringify(layout.offenders)}`,
    ).toBeLessThanOrEqual(layout.viewportWidth + 1);

    if (width === 320) {
      const quickFiltersScroll = await page
        .locator(".transaction-quick-filters")
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(quickFiltersScroll).toBe(true);
    }

    await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
    const editor = page.getByRole("dialog", { name: /Nuevo egreso/i });
    await expect(editor).toBeVisible();
    await expect
      .poll(() => editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
      .toBe(true);
  });
}
