import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const uniqueDescription = () => `Compra E2E ${Date.now()}`;

const freezeReviewTime = async (page: Page) => {
  await page.clock.setFixedTime(new Date("2026-08-16T17:00:00-05:00"));
};

const openFirstTransaction = async (page: Page) => {
  const viewportWidth = page.viewportSize()?.width ?? 390;
  if (viewportWidth >= 1024) {
    await page.locator(".transaction-table-row-action").first().click();
  } else {
    await page.locator(".transaction-mobile-list .transaction-mobile-row").first().click();
  }
  const detail = page.locator(".transaction-detail-dialog");
  await expect(detail).toBeVisible();
  return detail;
};

test.describe("Movimientos CRUD en modo review", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("crea, edita y anula un egreso conservando el contexto del listado", async ({ page }) => {
    const description = uniqueDescription();
    const editedDescription = `${description} editada`;

    await page.goto("/movimientos?period=202608&type=EGRESO");
    await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar nuevo movimiento" })).toBeEnabled();

    await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
    // El editor abre en Ingreso; pasamos a Egreso para el resto del flujo.
    const newEditor = page.getByRole("dialog", { name: /Nuevo ingreso/i });
    await expect(newEditor).toBeVisible();
    await newEditor.getByLabel("Egreso", { exact: true }).check();

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
    const detail = page.getByRole("dialog", { name: "Detalle de transacción" });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Editar" }).click();

    const editDialog = page.getByRole("dialog", { name: /Editar egreso/i });
    await editDialog.getByLabel("Descripción").fill(editedDescription);
    await editDialog.getByRole("button", { name: /Guardar egreso/i }).click();
    await expect(page.getByText("Egreso actualizado")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`Egreso: ${editedDescription}`) }).click();
    const updatedDetail = page.getByRole("dialog", { name: "Detalle de transacción" });
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
    await page.getByRole("button", { name: "Buscar movimientos" }).click();
    const searchDialog = page.getByRole("dialog", { name: "Buscar movimientos" });
    await expect(searchDialog).toBeVisible();
    await searchDialog.getByRole("button", { name: "Búsqueda avanzada" }).click();
    const filters = page.getByRole("dialog", { name: "Filtros" });
    await filters.getByLabel("Estado").selectOption("CONFIRMED");
    await filters.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(/status=CONFIRMED/);

    await expect(searchDialog).toBeVisible();
    await searchDialog.getByRole("textbox", { name: "Buscar movimientos" }).fill("aporte");
    await expect(page).toHaveURL(/q=aporte/);
    await searchDialog.getByRole("button", { name: /Ingreso: Aporte mensual/i }).click();
    await expect(page).toHaveURL(/\/movimientos\/[^/?]+\?/);
    await page.goBack();
    await expect(page).toHaveURL(/status=CONFIRMED/);
    await expect(page).toHaveURL(/q=aporte/);
    await expect(searchDialog).toBeVisible();
  });
});

test("abre una búsqueda móvil completa, cancela sus criterios y restaura q desde la URL", async ({
  page,
}) => {
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
  await expect(page.locator(".transaction-toolbar .transaction-quick-filters")).toHaveCount(0);
  await expect(page.locator(".transaction-toolbar .transaction-filter-button")).toHaveCount(0);
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
  const searchDialog = page.getByRole("dialog", { name: "Buscar movimientos" });
  await expect(searchDialog).toBeVisible();
  const search = page.getByRole("textbox", { name: "Buscar movimientos" });
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  await search.fill("aporte");
  await expect(page).toHaveURL(/q=aporte/);
  await expect(searchDialog).toHaveScreenshot("movimientos-search-mobile.png", {
    animations: "disabled",
  });

  await search.press("Escape");
  await expect(page.locator("#transaction-search-input")).toBeHidden();
  await expect(page.getByRole("button", { name: "Buscar movimientos" })).toBeFocused();
  await expect(page).not.toHaveURL(/q=aporte/);

  await page.goto("/movimientos?period=202608&q=aporte");
  await expect(page.getByRole("dialog", { name: "Buscar movimientos" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Buscar movimientos" })).toHaveValue("aporte");
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

  await expect(page.locator("#transaction-search-input-inline")).toBeVisible();
  await expect(page.locator(".transaction-search-toggle")).toHaveCount(0);
  await expect(page.locator(".transaction-search-inline .transaction-quick-filters")).toBeVisible();
  await expect(
    page.locator(".transaction-search-inline").getByRole("button", {
      name: "Búsqueda avanzada",
    }),
  ).toBeVisible();
  await expect(page.locator(".transaction-mobile-confirmed-status").first()).toBeVisible();
  await expect(toolbar).toHaveScreenshot("movimientos-toolbar-tablet.png", {
    animations: "disabled",
  });
  await expect(results).toHaveScreenshot("movimientos-results-tablet.png", {
    animations: "disabled",
  });

  await freezeReviewTime(page);
  const detail = await openFirstTransaction(page);
  const detailGeometry = await detail.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      radius: styles.borderTopLeftRadius,
    };
  });
  expect(detailGeometry.width).toBeLessThan(768);
  expect(detailGeometry.radius).not.toBe("0px");
  await expect(detail).toHaveScreenshot("movimientos-detail-tablet.png", {
    animations: "disabled",
  });
  await detail.locator(".transaction-detail-actions").scrollIntoViewIfNeeded();
  await expect(detail).toHaveScreenshot("movimientos-detail-actions-tablet.png", {
    animations: "disabled",
  });
  await detail.getByRole("button", { name: "Cerrar detalle" }).click();

  await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
  const editor = page.getByRole("dialog", { name: /Nuevo ingreso/i });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveScreenshot("movimientos-editor-tablet.png", {
    animations: "disabled",
  });
});

test("muestra en escritorio la tabla completa y los filtros en una sola fila", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/movimientos?period=202608");

  const table = page.getByRole("table", { name: "Movimientos encontrados" });
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveText([
    "Fecha",
    "Tipo",
    "Categoría / Subcategoría",
    "Donante / Proveedor",
    "Cuenta / Pago",
    "Monto",
    "Descripción / Comprobante",
  ]);

  // Sin tarjeta: la tabla ocupa todo el ancho disponible y cabe sin scroll lateral.
  const geometry = await page.evaluate(() => {
    const bounds = document.querySelector(".transaction-table")?.getBoundingClientRect();
    return {
      left: Math.round(bounds?.left ?? -1),
      right: Math.round(bounds?.right ?? -1),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  // Arranca justo tras la barra lateral (16 rem) y llega al borde opuesto.
  expect(geometry.left).toBeLessThanOrEqual(292);
  expect(geometry.right).toBeGreaterThanOrEqual(1400);

  // Filas densas de una sola línea: más movimientos visibles sin desplazarse.
  const rowHeight = await table
    .locator("tbody tr")
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(rowHeight).toBeLessThan(50);

  // El tipo es solo un glifo: el nombre queda para lectores de pantalla.
  const typeCell = table.locator("tbody tr").first().locator(".transaction-type-glyph");
  await expect(typeCell).toHaveText(/^[↑↓↔](Ingreso|Egreso|Transferencia)$/);
  expect(
    await typeCell.evaluate((element) => Math.round(element.getBoundingClientRect().width)),
  ).toBeLessThanOrEqual(28);

  // "Búsqueda avanzada" es solo un icono, sin texto visible.
  const advanced = page
    .locator(".transaction-search-inline")
    .getByRole("button", { name: "Búsqueda avanzada" });
  await expect(advanced).toBeVisible();
  await expect(advanced.locator(".transaction-advanced-search-text")).toBeHidden();

  // Período, búsqueda, filtros rápidos y búsqueda avanzada comparten una fila.
  const tops = await page.evaluate(() =>
    [
      ".transaction-period-picker",
      ".transaction-search-field",
      ".transaction-quick-filters button",
      ".transaction-advanced-search-button",
    ].map((selector) => {
      const bounds = document.querySelector(selector)?.getBoundingClientRect();
      return bounds ? Math.round(bounds.top + bounds.height / 2) : -1;
    }),
  );
  expect(tops).not.toContain(-1);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
});

test("en escritorio el estado solo aparece bajo el monto cuando no está confirmado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Setiembre de 2025 incluye un egreso pendiente en los datos de revisión.
  await page.goto("/movimientos?period=202509");

  const table = page.getByRole("table", { name: "Movimientos encontrados" });
  await expect(table).toBeVisible();
  await expect(table.getByText("Confirmada")).toHaveCount(0);

  const pending = table.locator(".transaction-col-amount .transaction-status-label");
  await expect(pending).toHaveCount(1);
  await expect(pending).toHaveText("Pendiente");
});

test("en escritorio el encabezado de la tabla se fija al desplazar la página", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/movimientos?period=all");

  const header = page.locator(".transaction-table thead th").first();
  await expect(header).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(() => header.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
    .toBe(0);
});

test("aplica el detalle plano y el editor compacto en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await freezeReviewTime(page);
  await page.goto("/movimientos?period=202608");

  const detail = await openFirstTransaction(page);
  const detailGeometry = await detail.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return {
      left: Math.round(bounds.left),
      right: Math.round(bounds.right),
      radius: styles.borderTopLeftRadius,
    };
  });
  expect(detailGeometry.left).toBe(0);
  expect(detailGeometry.right).toBe(390);
  expect(detailGeometry.radius).not.toBe("0px");
  await expect(detail).toHaveScreenshot("movimientos-detail-mobile.png", {
    animations: "disabled",
  });

  await detail.locator(".transaction-detail-actions").scrollIntoViewIfNeeded();
  await expect(detail).toHaveScreenshot("movimientos-detail-actions-mobile.png", {
    animations: "disabled",
  });
  await detail.getByRole("button", { name: "Cerrar detalle" }).click();

  await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
  const editor = page.getByRole("dialog", { name: /Nuevo ingreso/i });
  await expect(editor).toBeVisible();
  const editorGeometry = await editor.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return {
      left: Math.round(bounds.left),
      right: Math.round(bounds.right),
      radius: styles.borderTopLeftRadius,
    };
  });
  expect(editorGeometry.left).toBe(0);
  expect(editorGeometry.right).toBe(390);
  expect(editorGeometry.radius).toBe("0px");
  await expect(editor).toHaveScreenshot("movimientos-editor-mobile.png", {
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
  const editor = page.getByRole("dialog", { name: "Nuevo ingreso" });
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

  await editor.getByRole("button", { name: "Cerrar editor" }).click();
  const detail = await openFirstTransaction(page);
  const detailScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(detailScan.violations).toEqual([]);
  await detail.getByRole("button", { name: "Cerrar detalle" }).click();
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

  const detail = await openFirstTransaction(page);
  await expect
    .poll(() => detail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
    .toBe(true);
  await detail.getByRole("button", { name: "Cerrar detalle" }).click();

  await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
  const editor = page.getByRole("dialog", { name: /Nuevo ingreso/i });
  await expect
    .poll(() => editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
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
      await page.getByRole("button", { name: "Buscar movimientos" }).click();
      const searchDialog = page.getByRole("dialog", { name: "Buscar movimientos" });
      await expect(searchDialog).toBeVisible();
      const quickFiltersScroll = await page
        .locator(".transaction-search-dialog .transaction-quick-filters")
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(quickFiltersScroll).toBe(true);
      await searchDialog.getByRole("button", { name: "Cancelar" }).click();
    }

    const detail = await openFirstTransaction(page);
    await expect
      .poll(() => detail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
      .toBe(true);
    await detail.getByRole("button", { name: "Cerrar detalle" }).click();

    await page.getByRole("button", { name: "Registrar nuevo movimiento" }).click();
    const editor = page.getByRole("dialog", { name: /Nuevo ingreso/i });
    await expect(editor).toBeVisible();
    await expect
      .poll(() => editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
      .toBe(true);
  });
}
