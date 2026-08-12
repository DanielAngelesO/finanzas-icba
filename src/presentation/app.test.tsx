import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSourceQueries } from "../application/use-cases/data-source-queries";
import { GetBasicFinancialSummaryUseCase } from "../application/use-cases/get-basic-financial-summary";
import { GetDashboardOverviewUseCase } from "../application/use-cases/get-dashboard-overview";
import { GetExpenseAnalysisUseCase } from "../application/use-cases/get-expense-analysis";
import { TransactionQueries } from "../application/use-cases/transaction-queries";
import { AccessTokenStore, type AppServices } from "../composition/services";
import type { DashboardOverview } from "../domain/dashboard";
import type { TransactionValidationIssue } from "../domain/diagnostics";
import { InMemoryTransactionRepository } from "../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../test/fixtures";
import { AuthContext, type AuthContextValue } from "./auth/auth-context";
import { AppRoutes } from "./app";
import { formatMoney } from "./formatters";
import { ThemeProvider } from "./theme/theme-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const invalidIssue: TransactionValidationIssue = {
  code: "INVALID_DATE",
  severity: "error",
  message: "Fecha inválida.",
  rowNumber: 10,
  field: "Fecha",
};

const createServices = (
  transactions = [
    makeTransaction({
      id: "AUG-1",
      period: "202608",
      date: new Date("2026-08-20T12:00:00.000Z"),
      type: "INGRESO",
      amount: 1_000,
      category: "Ofrendas",
    }),
    makeTransaction({
      id: "JUL-1",
      period: "202607",
      date: new Date("2026-07-18T12:00:00.000Z"),
      type: "INGRESO",
      amount: 700,
      category: "Diezmos",
    }),
  ],
  issues: TransactionValidationIssue[] = [],
): AppServices => {
  const repository = new InMemoryTransactionRepository(transactions, issues);
  return {
    tokenStore: new AccessTokenStore(),
    transactions: new TransactionQueries(repository),
    dataSource: new DataSourceQueries(repository),
    financialSummary: new GetBasicFinancialSummaryUseCase(repository),
    dashboard: new GetDashboardOverviewUseCase(repository),
    expenses: new GetExpenseAnalysisUseCase(repository),
  };
};

const authenticatedUser: AuthContextValue = {
  state: {
    status: "authenticated",
    email: "liderazgo@icba.pe",
    name: "Liderazgo ICBA",
  },
  signIn: () => {},
  retryPreparation: () => {},
  signOut: () => {},
};

class FailingDashboardOverviewUseCase extends GetDashboardOverviewUseCase {
  public override async execute(): Promise<DashboardOverview> {
    throw new Error("No se pudo consultar el resumen.");
  }
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const renderApp = (initialEntry: string, services = createServices()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authenticatedUser}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <AppRoutes services={services} />
            <LocationProbe />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("navegación principal", () => {
  it("redirige las rutas de diagnóstico anteriores a sus nuevas ubicaciones", async () => {
    renderApp("/diagnostico");

    expect(await screen.findByRole("heading", { name: "Fuente de datos" })).toBeInTheDocument();
  });

  it("redirige la consulta técnica de transacciones a Movimientos", async () => {
    renderApp("/diagnostico/transacciones");

    expect(await screen.findByRole("heading", { name: "Movimientos" })).toBeInTheDocument();
  });

  it("lleva una sesión autenticada al Resumen desde la ruta de acceso", async () => {
    renderApp("/ingresar");

    expect(await screen.findByRole("heading", { name: "Resumen financiero" })).toBeInTheDocument();
    expect(screen.getByText(/^Versión v\d+\.\d+\.\d+ · /)).toBeInTheDocument();
  });

  it("mantiene un único alcance global en la URL y no vuelve a consultar al alternarlo", async () => {
    const user = userEvent.setup();
    const services = createServices(
      [
        makeTransaction({
          id: "AUG-TITHE",
          period: "202608",
          date: new Date("2026-08-03T12:00:00.000Z"),
          type: "INGRESO",
          amount: 120,
          category: "Diezmos",
        }),
        makeTransaction({
          id: "AUG-OFFERING",
          period: "202608",
          date: new Date("2026-08-06T12:00:00.000Z"),
          type: "INGRESO",
          amount: 80,
          category: "Ofrendas",
        }),
        makeTransaction({
          id: "AUG-OTHER",
          period: "202608",
          date: new Date("2026-08-08T12:00:00.000Z"),
          type: "INGRESO",
          amount: 40,
          category: "Donación especial",
        }),
        makeTransaction({
          id: "AUG-EXPENSE",
          period: "202608",
          date: new Date("2026-08-08T12:00:00.000Z"),
          type: "EGRESO",
          amount: 50,
          category: "Servicios",
        }),
        makeTransaction({
          id: "JUL-TITHE",
          period: "202607",
          date: new Date("2026-07-03T12:00:00.000Z"),
          type: "INGRESO",
          amount: 100,
          category: "Diezmos",
        }),
      ],
      [invalidIssue],
    );
    const execute = vi.spyOn(services.dashboard, "execute");
    renderApp("/?income=invalid&period=202608", services);

    const scopeControl = await screen.findByRole("group", {
      name: "Alcance global de ingresos",
    });
    expect(within(scopeControl).getAllByRole("radio")).toHaveLength(2);
    expect(
      within(scopeControl).getByRole("radio", { name: "Solo diezmos + ofrendas" }),
    ).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Hay 1 fila inválida que no se incluyen en los totales.",
    );

    const incomeCards = screen.getByRole("region", { name: "Indicadores de ingresos" });
    expect(within(incomeCards).getByText("Aportes")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Otros ingresos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ingresos totales")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Diezmos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ofrendas")).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);

    await user.click(within(scopeControl).getByRole("radio", { name: "Total con otros ingresos" }));

    await waitFor(() => {
      expect(
        within(scopeControl).getByRole("radio", { name: "Total con otros ingresos" }),
      ).toBeChecked();
      expect(screen.getByTestId("location")).toHaveTextContent("income=all");
      expect(screen.getByTestId("location")).toHaveTextContent("period=202608");
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Alcance de ingresos: Total con otros ingresos\./)).toBeInTheDocument();
    expect(screen.getByText("Composición de total con otros ingresos.")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Aportes")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Otros ingresos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ingresos totales")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Período" }), "202607");

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Período" })).toHaveValue("202607");
      expect(screen.getByTestId("location")).toHaveTextContent("income=all");
      expect(screen.getByTestId("location")).toHaveTextContent("period=202607");
      expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
        "href",
        "/movimientos?period=202607",
      );
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("muestra los indicadores y comparaciones de ambos escenarios financieros", async () => {
    renderApp("/");

    const financialCards = await screen.findByLabelText("Indicadores financieros del período");
    const expenses = within(financialCards).getByText("Egresos").closest("article");
    const contributions = within(financialCards)
      .getByText("Resultado de aportes")
      .closest("article");
    const total = within(financialCards).getByText("Resultado total").closest("article");
    if (!expenses || !contributions || !total) {
      throw new Error("No se encontraron los indicadores financieros esperados.");
    }

    expect(expenses).toHaveTextContent("Anterior");
    expect(expenses).toHaveTextContent("Diferencia");
    expect(contributions).toHaveTextContent("Escenario analítico");
    expect(contributions).toHaveTextContent("Tasa de ahorro");
    expect(contributions).toHaveTextContent("Saldo acumulado");
    expect(contributions).toHaveAttribute("data-selected");
    expect(total).toHaveTextContent("Saldo contable");
    expect(total).not.toHaveAttribute("data-selected");
  });

  it("organiza el análisis en tabs accesibles y conserva el tab activo al cambiar de período", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const tablist = await screen.findByRole("tablist", { name: "Horizonte del análisis" });
    const currentTab = within(tablist).getByRole("tab", { name: "Período actual" });
    const annualTab = within(tablist).getByRole("tab", { name: "Últimos 12 meses" });
    expect(currentTab).toHaveAttribute("aria-selected", "true");
    expect(annualTab).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("region", { name: "Gráfico desplazable de ingresos y egresos diarios" }),
    ).toHaveAttribute("tabindex", "0");

    const accumulatedDetail = screen.getByText("Ver ritmo acumulado por grupo").closest("details");
    if (!accumulatedDetail) throw new Error("No se encontró el detalle de ritmo acumulado.");
    expect(accumulatedDetail).not.toHaveAttribute("open");
    await user.click(within(accumulatedDetail).getByText("Ver ritmo acumulado por grupo"));
    expect(accumulatedDetail).toHaveAttribute("open");
    expect(
      screen.getByRole("table", { name: "Ritmo acumulado de ingresos por día" }),
    ).toBeInTheDocument();

    await user.click(annualTab);
    expect(annualTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Composición mensual de ingresos" }),
    ).toBeInTheDocument();
    const compositionTable = screen.getByRole("table", {
      name: "Composición mensual de ingresos",
    });
    expect(
      within(compositionTable).getByRole("columnheader", { name: "Diezmos" }),
    ).toBeInTheDocument();
    expect(
      within(compositionTable).getByRole("columnheader", { name: "Ofrendas" }),
    ).toBeInTheDocument();
    expect(
      within(compositionTable).getByRole("columnheader", { name: "Otros ingresos" }),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(currentTab).toHaveFocus();
    expect(currentTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(annualTab).toHaveFocus();
    expect(annualTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(currentTab).toHaveFocus();
    expect(currentTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(annualTab).toHaveAttribute("aria-selected", "true");

    await user.selectOptions(screen.getByRole("combobox", { name: "Período" }), "202607");
    await waitFor(() => {
      expect(annualTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("mantiene los tres ingresos visibles cuando no hay aportes ni otros ingresos", async () => {
    const user = userEvent.setup();
    renderApp(
      "/",
      createServices([
        makeTransaction({
          id: "AUG-EXPENSE",
          period: "202608",
          date: new Date("2026-08-08T12:00:00.000Z"),
          type: "EGRESO",
          amount: 250,
          category: "Servicios",
        }),
      ]),
    );

    const incomeCards = await screen.findByRole("region", { name: "Indicadores de ingresos" });
    expect(within(incomeCards).getByText("Aportes")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Otros ingresos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ingresos totales")).toBeInTheDocument();
    expect(screen.getAllByText("No aplica")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: "Total con otros ingresos" }));
    expect(within(incomeCards).getByText("Aportes")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Otros ingresos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ingresos totales")).toBeInTheDocument();
  });

  it("mantiene legibles las cifras grandes en las tarjetas de ingresos", async () => {
    const contributions = 1_234_567_890.12;
    const otherIncome = 98_765_432.1;
    renderApp(
      "/",
      createServices([
        makeTransaction({
          id: "AUG-LARGE-TITHE",
          period: "202608",
          date: new Date("2026-08-08T12:00:00.000Z"),
          type: "INGRESO",
          amount: contributions,
          category: "Diezmos",
        }),
        makeTransaction({
          id: "AUG-LARGE-OTHER",
          period: "202608",
          date: new Date("2026-08-09T12:00:00.000Z"),
          type: "INGRESO",
          amount: otherIncome,
          category: "Campaña",
        }),
      ]),
    );

    const incomeCards = await screen.findByRole("region", { name: "Indicadores de ingresos" });
    expect(incomeCards).toHaveTextContent(formatMoney(contributions).replace(/\u00a0/g, " "));
    expect(incomeCards).toHaveTextContent(
      formatMoney(contributions + otherIncome).replace(/\u00a0/g, " "),
    );
  });

  it("marca el destino activo y cierra el menú móvil al navegar", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos");

    const menuButton = screen.getByRole("button", { name: "Abrir menú" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await user.click(menuButton);

    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const movementsLink = screen.getByRole("link", { name: "Movimientos" });
    expect(movementsLink).toHaveClass("active");

    await user.click(screen.getByRole("link", { name: "Calidad de datos" }));

    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(await screen.findByRole("heading", { name: "Calidad de datos" })).toBeInTheDocument();
  });

  it("expone el módulo de gastos desde la navegación principal", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const expensesLink = await screen.findByRole("link", { name: "Gastos" });
    expect(expensesLink).toHaveAttribute("href", "/gastos");

    await user.click(expensesLink);

    expect(await screen.findByRole("heading", { name: "Análisis de gastos" })).toBeInTheDocument();
  });

  it("ofrece recuperación cuando no se puede cargar el resumen", async () => {
    const services = createServices();
    services.dashboard = new FailingDashboardOverviewUseCase(new InMemoryTransactionRepository());
    renderApp("/", services);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar el resumen financiero.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
});

describe("explorador de movimientos", () => {
  const explorerTransactions = [
    makeTransaction({
      id: "ING-AGOSTO",
      date: new Date("2026-08-18T05:00:00.000Z"),
      type: "INGRESO",
      description: "Ofrenda de misión",
      donorOrProvider: "María Álvarez",
      category: "Ofrendas",
      account: "Caja",
      amount: 320,
      status: "Confirmado",
      period: "202608",
    }),
    makeTransaction({
      id: "EGR-AGOSTO",
      date: new Date("2026-08-10T05:00:00.000Z"),
      type: "EGRESO",
      description: "Compra de víveres",
      category: "Ayuda social",
      account: "Banco",
      amount: 150,
      status: "Pendiente",
      period: "202608",
    }),
    makeTransaction({
      id: "ING-JULIO",
      date: new Date("2026-07-31T05:00:00.000Z"),
      description: "Aporte de julio",
      donorOrProvider: "Ana Quispe",
      category: "DIEZMOS",
      account: "Caja",
      amount: 200,
      status: "Confirmado",
      period: "202607",
    }),
    makeTransaction({
      id: "ING-JULIO-SIN-DONANTE",
      date: new Date("2026-07-30T05:00:00.000Z"),
      description: "Aporte anónimo",
      category: "Diezmo",
      account: "Caja",
      amount: 100,
      status: "Confirmado",
      period: "202607",
    }),
    makeTransaction({
      id: "ING-JULIO-SIN-DESCRIPCION",
      date: new Date("2026-07-29T05:00:00.000Z"),
      description: null,
      donorOrProvider: "Carlos Ríos",
      category: "Diezmo",
      account: "Caja",
      amount: 75,
      status: "Confirmado",
      period: "202607",
    }),
    makeTransaction({
      id: "OFR-JULIO-SIN-DESCRIPCION",
      date: new Date("2026-07-26T05:00:00.000Z"),
      description: null,
      category: "ofrendas",
      account: "Caja",
      amount: 50,
      status: "Confirmado",
      period: "202607",
    }),
  ];

  it("mantiene el período del enlace y encuentra coincidencias globales normalizadas", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    const period = await screen.findByRole("combobox", { name: "Período" });
    expect(period).toHaveValue("202608");
    expect(screen.getByRole("status")).toHaveTextContent("2 movimientos encontrados");

    await user.clear(screen.getByRole("textbox", { name: "Buscar movimientos" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar movimientos" }), "maria alvarez");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 movimiento encontrado");
    });
  });

  it("valida un rango de fechas invertido antes de aplicar los filtros avanzados", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos", createServices(explorerTransactions));

    const advancedFilters = await screen.findByText("Más filtros");
    await user.click(advancedFilters);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-08-20" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-08-01" } });
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La fecha inicial debe ser anterior o igual a la fecha final.",
    );
  });

  it("muestra el nombre directamente solo en los previews de diezmos con donante", async () => {
    renderApp("/movimientos", createServices(explorerTransactions));

    const mobileResults = await screen.findByRole("list", { name: "Movimientos encontrados" });
    expect(within(mobileResults).getByText("DIEZMOS")).toBeInTheDocument();
    expect(within(mobileResults).getByText("Ana Quispe")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Quispe")).toHaveLength(2);
    const donorOnlyPreview = within(mobileResults).getByText("Carlos Ríos").closest("p");
    if (!donorOnlyPreview) throw new Error("No se encontró el preview del donante.");
    expect(donorOnlyPreview).toHaveAttribute("title", "Carlos Ríos");
    expect(screen.queryByText("María Álvarez")).not.toBeInTheDocument();
    expect(screen.queryByText(/Donante:/)).not.toBeInTheDocument();
  });

  it("muestra la fecha de las ofrendas en una línea posterior a la categoría", async () => {
    renderApp("/movimientos", createServices(explorerTransactions));

    const mobileResults = await screen.findByRole("list", { name: "Movimientos encontrados" });
    const offeringCard = within(mobileResults).getByText("Ofrenda de misión").closest("article");
    if (!offeringCard) throw new Error("No se encontró la ofrenda.");
    const categoryLine = within(offeringCard).getByText("Ofrendas").closest("p");
    const dateLine = within(offeringCard).getByText("Martes 18/08").closest("p");
    if (!categoryLine || !dateLine) throw new Error("No se encontró el preview de la ofrenda.");
    expect(categoryLine.nextElementSibling).toBe(dateLine);

    const offeringDateOnly = within(mobileResults)
      .getByText("Domingo 26/07")
      .closest(".transaction-preview");
    if (!offeringDateOnly)
      throw new Error("No se encontró la fecha de la ofrenda sin descripción.");
    expect(offeringDateOnly).toHaveTextContent("Domingo 26/07");
    expect(offeringDateOnly).not.toHaveTextContent("ofrendas");
  });

  it("abre el detalle completo y devuelve el foco al activador al cerrar con Escape", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos", createServices(explorerTransactions));

    await screen.findByRole("status");
    const detailButtons = screen.getAllByRole("button", {
      name: "Ver detalle de Ofrenda de misión",
    });
    const detailButton = detailButtons[0];
    if (!detailButton) throw new Error("No se encontró el activador del detalle.");
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Trazabilidad")).toBeInTheDocument();
    expect(within(dialog).getByText("Donante / Proveedor")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(dialog).not.toHaveAttribute("open");
      expect(detailButton).toHaveFocus();
    });
  });

  it("pagina resultados y conserva el rango visible", async () => {
    const user = userEvent.setup();
    const manyTransactions = Array.from({ length: 21 }, (_, index) =>
      makeTransaction({
        id: `TX-${String(index + 1).padStart(2, "0")}`,
        date: new Date(Date.UTC(2026, 7, index + 1, 5)),
        description: `Movimiento ${index + 1}`,
        amount: index + 1,
      }),
    );
    renderApp("/movimientos", createServices(manyTransactions));

    expect(await screen.findByText("21 movimientos encontrados")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–20 de 21")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(screen.getByText("Mostrando 21–21 de 21")).toBeInTheDocument();
    });
  });
});
