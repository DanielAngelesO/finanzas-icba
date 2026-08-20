import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  vi.unstubAllGlobals();
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

  it("lleva una sesión autenticada a Inicio desde la ruta de acceso", async () => {
    renderApp("/ingresar");

    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText(/^Versión v\d+\.\d+\.\d+ · /)).toBeInTheDocument();
  });

  it("presenta una entrada ejecutiva y conserva Resumen como opción separada", async () => {
    const user = userEvent.setup();
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    const result = await screen.findByRole("region", { name: "Resultado financiero" });
    expect(within(result).getByRole("heading", { name: "Superávit" })).toBeInTheDocument();
    const indicators = screen.getByRole("region", { name: "Indicadores complementarios" });
    expect(within(indicators).getByText("Ingresos totales")).toBeInTheDocument();
    expect(within(indicators).getByText("Egresos")).toBeInTheDocument();
    expect(within(indicators).getByText("Saldo acumulado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("region", {
        name: "Gráfico de Ingresos totales y egresos de los últimos doce meses",
      }),
    ).toBeInTheDocument();
    const trendTable = screen.getByRole("table", {
      name: "Ingresos totales y egresos de los últimos doce meses",
    });
    expect(within(trendTable).getAllByRole("row")).toHaveLength(13);
    expect(screen.getByRole("link", { name: "Ver resumen detallado" })).toHaveAttribute(
      "href",
      "/resumen?period=202608&income=all",
    );

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    const summaryLink = screen.getByRole("link", { name: "Resumen" });
    expect(summaryLink).toHaveAttribute("href", "/resumen");
    await user.click(summaryLink);

    expect(await screen.findByRole("heading", { name: "Resumen financiero" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/resumen");
  });

  it("actualiza el alcance de Inicio sin recargar y conserva el período al navegar", async () => {
    const user = userEvent.setup();
    const services = createServices([
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
    ]);
    const execute = vi.spyOn(services.dashboard, "execute");
    renderApp("/?period=202608&income=invalid", services);

    const result = await screen.findByRole("region", { name: "Resultado financiero" });
    const scopeToggle = screen.getByRole("button", {
      name: "Filtrar por solo aportes: diezmos y ofrendas",
    });
    expect(scopeToggle).toHaveAttribute("aria-pressed", "false");
    expect(result).toHaveTextContent(formatMoney(190).replace(/\u00a0/g, " "));
    expect(execute).toHaveBeenCalledTimes(1);

    await user.click(scopeToggle);

    await waitFor(() => {
      expect(scopeToggle).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/?period=202608&income=contributions",
      );
      expect(result).toHaveTextContent(formatMoney(150).replace(/\u00a0/g, " "));
      expect(screen.getByRole("link", { name: "Ver resumen detallado" })).toHaveAttribute(
        "href",
        "/resumen?period=202608&income=contributions",
      );
      expect(
        screen.getByRole("table", { name: "Aportes y egresos de los últimos doce meses" }),
      ).toBeInTheDocument();
    });
    expect(execute).toHaveBeenCalledTimes(1);

    const period = await screen.findByRole("combobox", { name: "Período" });
    await user.selectOptions(period, "202607");

    await waitFor(() => {
      expect(period).toHaveValue("202607");
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/?period=202607&income=contributions",
      );
      expect(screen.getByRole("link", { name: "Ver resumen detallado" })).toHaveAttribute(
        "href",
        "/resumen?period=202607&income=contributions",
      );
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("comunica con claridad un déficit y el estado sin datos", async () => {
    renderApp(
      "/",
      createServices([
        makeTransaction({
          id: "AUG-EXPENSE-ONLY",
          period: "202608",
          date: new Date("2026-08-08T12:00:00.000Z"),
          type: "EGRESO",
          amount: 250,
          category: "Servicios",
        }),
      ]),
    );

    const deficit = await screen.findByRole("heading", { name: "Déficit" });
    expect(deficit.closest("article")).toHaveAttribute("data-tone", "negative");
    expect(deficit.closest("article")).toHaveTextContent(formatMoney(-250).replace(/\u00a0/g, " "));
    expect(screen.queryByText("Claves del período")).not.toBeInTheDocument();

    cleanup();
    renderApp("/", createServices([]));

    expect(await screen.findByText("Aún no hay información financiera.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar calidad de datos" })).toHaveAttribute(
      "href",
      "/control/calidad",
    );
  });

  it("muestra excepciones de calidad únicamente cuando hay filas excluidas", async () => {
    renderApp("/", createServices(undefined, [invalidIssue]));

    const exception = await screen.findByRole("status", {
      name: "Calidad de datos requiere atención",
    });
    expect(exception).toHaveTextContent("1 fila excluida de los totales.");
    expect(within(exception).getByRole("link", { name: "Revisar calidad" })).toHaveAttribute(
      "href",
      "/control/calidad",
    );

    cleanup();
    renderApp("/");

    await screen.findByRole("region", { name: "Resultado financiero" });
    expect(
      screen.queryByRole("status", { name: "Calidad de datos requiere atención" }),
    ).not.toBeInTheDocument();
  });

  it("muestra saldos reales por cuenta y no los altera al filtrar aportes", async () => {
    const user = userEvent.setup();
    const services = createServices([
      makeTransaction({
        id: "AUG-INCOME",
        period: "202608",
        date: new Date("2026-08-03T12:00:00.000Z"),
        type: "INGRESO",
        account: "Cuenta corriente",
        amount: 300,
        category: "Ofrendas",
      }),
      makeTransaction({
        id: "AUG-TRANSFER-OUT",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Cuenta corriente",
        accountFlow: "OUTFLOW",
        transferId: "TRANSFER-001",
        amount: 100,
        category: "Transferencia interna",
      }),
      makeTransaction({
        id: "AUG-TRANSFER-IN",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Caja chica",
        accountFlow: "INFLOW",
        transferId: "TRANSFER-001",
        amount: 100,
        category: "Transferencia interna",
      }),
      makeTransaction({
        id: "AUG-EXPENSE",
        period: "202608",
        date: new Date("2026-08-05T12:00:00.000Z"),
        type: "EGRESO",
        account: "Caja chica",
        amount: 50,
        category: "Materiales",
      }),
      makeTransaction({
        id: "AUG-ZERO-INCOME",
        period: "202608",
        date: new Date("2026-08-06T12:00:00.000Z"),
        type: "INGRESO",
        account: "Cuenta sin saldo",
        amount: 120,
        category: "Donación especial",
      }),
      makeTransaction({
        id: "AUG-ZERO-EXPENSE",
        period: "202608",
        date: new Date("2026-08-07T12:00:00.000Z"),
        type: "EGRESO",
        account: "Cuenta sin saldo",
        amount: 120,
        category: "Materiales",
      }),
    ]);
    renderApp("/", services);

    const accountPosition = await screen.findByRole("region", { name: "Saldo por cuenta" });
    expect(screen.getByRole("heading", { name: "Inicio", level: 1 })).toHaveClass("sr-only");
    expect(within(accountPosition).getByText("Cuenta corriente")).toBeInTheDocument();
    expect(within(accountPosition).getByText("Caja chica")).toBeInTheDocument();
    expect(within(accountPosition).queryByText("Cuenta sin saldo")).not.toBeInTheDocument();
    expect(within(accountPosition).getByText("Total disponible")).toBeInTheDocument();
    expect(within(accountPosition).getByText(/250\.00/)).toBeInTheDocument();
    expect(accountPosition).toHaveTextContent("Todos los ingresos, egresos y transferencias.");

    await user.click(
      screen.getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Saldo de aportes")).toBeInTheDocument();
      expect(within(accountPosition).getByText(/250\.00/)).toBeInTheDocument();
    });
  });

  it("permite filtrar y distinguir transferencias en Movimientos", async () => {
    const user = userEvent.setup();
    const services = createServices([
      makeTransaction({
        id: "TRANSFER-OUT",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Cuenta corriente",
        accountFlow: "OUTFLOW",
        transferId: "TRANSFER-002",
        amount: 75,
        category: "Transferencia interna",
        description: "Traslado a caja chica",
      }),
      makeTransaction({
        id: "TRANSFER-IN",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Caja chica",
        accountFlow: "INFLOW",
        transferId: "TRANSFER-002",
        amount: 75,
        category: "Transferencia interna",
        description: "Traslado desde cuenta corriente",
      }),
    ]);
    renderApp("/movimientos?type=TRANSFERENCIA", services);

    expect(await screen.findByRole("status")).toHaveTextContent("1 movimiento");
    await user.click(screen.getByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    expect(within(searchDialog).getByRole("button", { name: "Transf." })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(searchDialog).getAllByRole("button", {
        name: /Transferencia: Traslado a caja chica/,
      }),
    ).not.toHaveLength(0);
  });

  it("muestra transferencias neutrales con su flujo en la actividad reciente", async () => {
    const services = createServices([
      makeTransaction({
        id: "TRANSFER-OUT",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Cuenta corriente",
        accountFlow: "OUTFLOW",
        transferId: "TRANSFER-003",
        amount: 75,
        category: "Transferencia interna",
        description: "Traslado a caja chica",
      }),
      makeTransaction({
        id: "TRANSFER-IN",
        period: "202608",
        date: new Date("2026-08-04T12:00:00.000Z"),
        type: "TRANSFERENCIA",
        account: "Caja chica",
        accountFlow: "INFLOW",
        transferId: "TRANSFER-003",
        amount: 75,
        category: "Transferencia interna",
        description: "Traslado desde cuenta corriente",
      }),
    ]);
    renderApp("/resumen?period=202608", services);

    const recentTitle = await screen.findByRole("heading", { name: "Movimientos recientes" });
    const recentActivity = recentTitle.closest("section");
    if (!recentActivity) throw new Error("No se encontró el panel de actividad reciente.");

    expect(within(recentActivity).getAllByLabelText("Transferencia")).not.toHaveLength(0);
    expect(within(recentActivity).getAllByText("↔")).not.toHaveLength(0);
    expect(recentActivity).toHaveTextContent("−");
    expect(recentActivity).toHaveTextContent("+");
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
    renderApp("/resumen?income=invalid&period=202608", services);

    const scopeToggle = await screen.findByRole("button", {
      name: "Filtrar por solo aportes: diezmos y ofrendas",
    });
    expect(scopeToggle).toHaveAttribute("aria-pressed", "true");
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

    await user.click(scopeToggle);

    await waitFor(() => {
      expect(scopeToggle).toHaveAttribute("aria-pressed", "false");
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

  it("convierte los filtros en un dock flotante al desplazarse y sincroniza la URL", async () => {
    const user = userEvent.setup();
    type MockEntry = { boundingClientRect: { top: number }; isIntersecting: boolean };
    const observers: Array<{ callback: (entries: MockEntry[]) => void }> = [];

    class MockIntersectionObserver {
      constructor(callback: (entries: MockEntry[]) => void) {
        observers.push({ callback });
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    renderApp("/resumen?period=202608");

    expect(await screen.findByRole("region", { name: "Filtros del resumen" })).toBeInTheDocument();
    expect(screen.queryByText("Fecha de corte")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: "Filtros del resumen" })).toHaveLength(1);

    act(() => {
      observers[0]?.callback([{ boundingClientRect: { top: -120 }, isIntersecting: false }]);
    });

    const [staticBar, dock] = screen.getAllByRole("region", { name: "Filtros del resumen" });
    if (!staticBar || !dock) throw new Error("No se encontró el dock flotante del resumen.");
    expect(
      within(dock).getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(dock).getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("income=all");
    });
    expect(
      within(dock).getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(staticBar).getByRole("button", {
        name: "Filtrar por solo aportes: diezmos y ofrendas",
      }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.selectOptions(within(dock).getByRole("combobox", { name: "Período" }), "202607");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("period=202607");
      expect(screen.getByTestId("location")).toHaveTextContent("income=all");
    });
  });

  it("muestra los indicadores y comparaciones de ambos escenarios financieros", async () => {
    renderApp("/resumen");

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
    renderApp("/resumen");

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
      "/resumen",
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

    await user.click(
      screen.getByRole("button", { name: "Filtrar por solo aportes: diezmos y ofrendas" }),
    );
    expect(within(incomeCards).getByText("Aportes")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Otros ingresos")).toBeInTheDocument();
    expect(within(incomeCards).getByText("Ingresos totales")).toBeInTheDocument();
  });

  it("mantiene legibles las cifras grandes en las tarjetas de ingresos", async () => {
    const contributions = 1_234_567_890.12;
    const otherIncome = 98_765_432.1;
    renderApp(
      "/resumen",
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
    renderApp("/resumen", services);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar el resumen financiero.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("ofrece recuperación cuando no se puede cargar Inicio", async () => {
    const services = createServices();
    services.dashboard = new FailingDashboardOverviewUseCase(new InMemoryTransactionRepository());
    renderApp("/", services);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar la vista ejecutiva.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("mantiene una carga compacta de Inicio mientras llega la información", () => {
    const services = createServices();
    vi.spyOn(services.dashboard, "execute").mockImplementation(
      () => new Promise<DashboardOverview>(() => {}),
    );
    renderApp("/", services);

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("Preparando la vista ejecutiva.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resultado financiero" })).not.toBeInTheDocument();
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
      status: "CONFIRMED",
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
      status: "PENDING",
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
      status: "CONFIRMED",
      period: "202607",
    }),
    makeTransaction({
      id: "ING-JULIO-SIN-DONANTE",
      date: new Date("2026-07-30T05:00:00.000Z"),
      description: "Aporte anónimo",
      category: "Diezmo",
      account: "Caja",
      amount: 100,
      status: "CONFIRMED",
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
      status: "CONFIRMED",
      period: "202607",
    }),
    makeTransaction({
      id: "OFR-JULIO-SIN-DESCRIPCION",
      date: new Date("2026-07-26T05:00:00.000Z"),
      description: null,
      category: "ofrendas",
      account: "Caja",
      amount: 50,
      status: "CONFIRMED",
      period: "202607",
    }),
  ];

  it("mantiene el período del enlace y encuentra coincidencias globales normalizadas", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    const period = await screen.findByLabelText("Seleccionar mes y año");
    expect(period).toHaveValue("2026-08");
    expect(await screen.findByRole("status")).toHaveTextContent("2 movimientos en agosto de 2026");

    await user.click(screen.getByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const search = within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" });
    await user.type(search, "maria alvarez");

    await waitFor(() => {
      expect(within(searchDialog).getByRole("status")).toHaveTextContent("1 resultado");
      expect(screen.getByTestId("location")).toHaveTextContent("q=maria+alvarez");
    });
  });

  it("conserva el foco del buscador al confirmar el texto", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    await user.click(screen.getByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const search = within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" });
    await user.type(search, "maria");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("q=maria");
    });
    expect(search).toHaveFocus();
  });

  it("actualiza el contador por tecla y combina texto y tipo con AND", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=all", createServices(explorerTransactions));

    await user.click(screen.getByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const search = within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" });
    fireEvent.change(search, { target: { value: "aporte" } });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("q=aporte");
      expect(within(searchDialog).getByRole("status")).toHaveTextContent("2 resultados");
    });

    await user.click(within(searchDialog).getByRole("button", { name: "Egresos" }));
    await waitFor(() =>
      expect(within(searchDialog).getByRole("status")).toHaveTextContent("0 resultados"),
    );
    await user.click(within(searchDialog).getByRole("button", { name: "Ingresos" }));
    await waitFor(() =>
      expect(within(searchDialog).getByRole("status")).toHaveTextContent("2 resultados"),
    );
  });

  it("abre y cierra la búsqueda móvil devolviendo el foco al activador", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    const searchToggle = screen.getByRole("button", { name: "Buscar movimientos" });
    await user.click(searchToggle);

    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const search = within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" });
    expect(searchToggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(searchToggle).toHaveAttribute("aria-expanded", "false");
      expect(searchToggle).toHaveFocus();
    });
    expect(searchDialog).not.toHaveAttribute("open");
  });

  it("cancela y restablece texto, tipo, filtros avanzados y orden sin cambiar el período", async () => {
    const user = userEvent.setup();
    renderApp(
      "/movimientos?period=202608&q=maria&type=INGRESO&from=2026-08-01&to=2026-08-31&account=Caja&category=Ofrendas&status=CONFIRMED&sort=amount-asc",
      createServices(explorerTransactions),
    );

    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    expect(within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" })).toHaveValue(
      "maria",
    );
    await user.click(within(searchDialog).getByRole("button", { name: "Egresos" }));
    await user.click(within(searchDialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/movimientos?period=202608");
      expect(screen.getByRole("button", { name: "Buscar movimientos" })).toHaveFocus();
    });
    expect(screen.getByTestId("location")).not.toHaveTextContent("q=");
    expect(screen.getByTestId("location")).not.toHaveTextContent("type=");
    expect(screen.getByTestId("location")).not.toHaveTextContent("from=");
    expect(screen.getByTestId("location")).not.toHaveTextContent("sort=");
  });

  it("valida un rango de fechas invertido antes de aplicar los filtros avanzados", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos", createServices(explorerTransactions));

    await user.click(await screen.findByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    await user.click(within(searchDialog).getByRole("button", { name: "Búsqueda avanzada" }));
    const filterDialog = screen.getByRole("dialog", { name: "Filtros" });
    fireEvent.change(within(filterDialog).getByLabelText("Desde"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.change(within(filterDialog).getByLabelText("Hasta"), {
      target: { value: "2026-08-01" },
    });
    await user.click(within(filterDialog).getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La fecha inicial debe ser anterior o igual a la fecha final.",
    );
  });

  it("presenta filas densas sin exponer terceros en el listado", async () => {
    renderApp("/movimientos?period=202607", createServices(explorerTransactions));

    expect(
      await screen.findByRole("button", { name: /Ingreso: Aporte de julio/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("DIEZMOS")).not.toHaveLength(0);
    expect(screen.queryByText("Ana Quispe")).not.toBeInTheDocument();
    expect(screen.queryByText("Carlos Ríos")).not.toBeInTheDocument();
  });

  it("agrupa el listado móvil por día y mantiene categoría y cuenta como contexto", async () => {
    renderApp("/movimientos?period=202607", createServices(explorerTransactions));

    expect(await screen.findByRole("heading", { name: /31.*JULIO/ })).toBeInTheDocument();
    const offering = screen.getByRole("button", { name: /Ingreso: ofrendas/ });
    expect(offering).toHaveTextContent("Caja");
    expect(offering).toHaveTextContent("ofrendas");
  });

  it("muestra resultados de búsqueda sin encabezados de día y añade la fecha al contexto", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    await user.click(screen.getByRole("button", { name: "Buscar movimientos" }));
    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const search = within(searchDialog).getByRole("textbox", { name: "Buscar movimientos" });
    await user.type(search, "maria");

    const result = await within(searchDialog).findByRole("button", {
      name: /Ingreso: Ofrenda de misión/,
    });
    expect(result).toHaveTextContent(/18.*ago.*2026/i);
    expect(result).toHaveTextContent("Caja");
    expect(result).toHaveTextContent("Ofrendas");
    expect(searchDialog.querySelector(".transaction-day-heading")).toBeNull();
  });

  it("abre el detalle desde la búsqueda y restaura el overlay al volver", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608&q=maria", createServices(explorerTransactions));

    const searchDialog = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    const result = within(searchDialog).getByRole("button", {
      name: /Ingreso: Ofrenda de misión/,
    });
    await user.click(result);

    const detailDialog = await screen.findByRole("dialog", { name: "Detalle de transacción" });
    expect(detailDialog).toHaveAttribute("open", "");
    await user.keyboard("{Escape}");

    const restoredSearch = await screen.findByRole("dialog", { name: "Buscar movimientos" });
    await waitFor(() => {
      expect(restoredSearch).toHaveAttribute("open", "");
      expect(
        within(restoredSearch).getByRole("textbox", { name: "Buscar movimientos" }),
      ).toHaveValue("maria");
    });
  });

  it("conserva el estado accesible y marca las confirmadas para ocultarlas en móvil", async () => {
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    await screen.findByRole("button", { name: /Ingreso: Ofrenda de misión/ });
    const mobileList = document.querySelector<HTMLElement>(".transaction-mobile-list");
    if (!mobileList) throw new Error("No se encontró el listado móvil.");

    expect(
      within(mobileList).getByRole("button", { name: /Ingreso: Ofrenda de misión.*Confirmada/ }),
    ).toBeInTheDocument();
    expect(mobileList.querySelector(".transaction-mobile-confirmed-status")).toHaveTextContent(
      "Confirmada",
    );
    expect(within(mobileList).getByText("Pendiente")).toBeInTheDocument();
  });

  it("abre el detalle completo y devuelve el foco al activador al cerrar con Escape", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos", createServices(explorerTransactions));

    await screen.findByRole("status");
    const detailButtons = screen.getAllByRole("button", { name: /Ingreso: Ofrenda de misión/ });
    const detailButton = detailButtons[0];
    if (!detailButton) throw new Error("No se encontró el activador del detalle.");
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog", { name: "Detalle de transacción" });
    expect(within(dialog).getByText("Detalle de transacción")).toBeInTheDocument();
    expect(within(dialog).getByText("Donante")).toBeInTheDocument();
    expect(dialog.querySelector(".transaction-detail-summary")).toHaveTextContent("Efectivo");
    expect(within(dialog).queryByText("Método de pago")).not.toBeInTheDocument();
    expect(
      Array.from(dialog.querySelectorAll<HTMLElement>(".transaction-detail-row dt")).map(
        (label) => label.textContent,
      ),
    ).toEqual([
      "Cuenta",
      "Categoría",
      "Donante",
      "Descripción",
      "Estado",
      "Fecha",
      "Responsable",
      "Comprobante",
    ]);
    expect(within(dialog).getByRole("button", { name: "Cerrar detalle" })).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(detailButton).toHaveFocus();
    });
  });

  it("coloca las acciones del detalle después de toda la información", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos", createServices(explorerTransactions));

    const detailButton = (
      await screen.findAllByRole("button", {
        name: /Ingreso: Ofrenda de misión/,
      })
    )[0];
    if (!detailButton) throw new Error("No se encontró el activador del detalle.");
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog", { name: "Detalle de transacción" });
    const systemDetails = within(dialog).getByText("Información del sistema").closest("details");
    const actionGroup = dialog.querySelector<HTMLElement>(".transaction-detail-actions");
    if (!systemDetails || !actionGroup) throw new Error("No se encontró el orden del detalle.");

    expect(
      Boolean(
        systemDetails.compareDocumentPosition(actionGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      within(actionGroup)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Editar", "Duplicar", "Anular"]);

    await user.click(within(actionGroup).getByRole("button", { name: "Duplicar" }));
    expect(await screen.findByRole("dialog", { name: /Duplicar ingreso/i })).toBeInTheDocument();
  });

  it("mantiene sólo Duplicar para anuladas y deshabilita escrituras sin permiso", async () => {
    const user = userEvent.setup();
    const voided = makeTransaction({
      id: "VOIDED-AUGUST",
      date: new Date("2026-08-22T05:00:00.000Z"),
      type: "EGRESO",
      description: "Movimiento anulado",
      status: "VOIDED",
      period: "202608",
    });
    const services = createServices([voided]);
    const catalogs = await services.transactions.getCatalogs();
    vi.spyOn(services.transactions, "getCatalogs").mockResolvedValue({
      ...catalogs,
      writeCapability: {
        status: "disabled",
        reason: "Las escrituras están deshabilitadas durante la revisión.",
      },
    });
    renderApp("/movimientos?period=202608", services);

    const row = await screen.findByRole("button", {
      name: /Egreso: Movimiento anulado.*Anulada/,
    });
    await user.click(row);
    const dialog = screen.getByRole("dialog", { name: "Detalle de transacción" });

    expect(within(dialog).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Duplicar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Registrar nuevo movimiento" })).toBeDisabled();
  });

  it("carga treinta resultados y permite mostrar el siguiente bloque", async () => {
    const user = userEvent.setup();
    const manyTransactions = Array.from({ length: 35 }, (_, index) =>
      makeTransaction({
        id: `TX-${String(index + 1).padStart(2, "0")}`,
        date: new Date(Date.UTC(2026, 7, index + 1, 5)),
        description: `Movimiento ${index + 1}`,
        amount: index + 1,
      }),
    );
    renderApp("/movimientos", createServices(manyTransactions));

    expect(await screen.findByText("35 movimientos en agosto de 2026")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 30 de 35")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar más" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Mostrar más" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Movimiento/ }).length).toBeGreaterThan(34);
    });
  });

  it("crea un egreso desde la sheet y conserva el borrador al validar", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    const newButton = await screen.findByRole("button", {
      name: "Registrar nuevo movimiento",
    });
    await waitFor(() => expect(newButton).toBeEnabled());
    await user.click(newButton);

    const editor = await screen.findByRole("dialog", { name: "Nuevo egreso" });
    const amount = within(editor).getByLabelText(/Monto/);
    await user.click(within(editor).getByRole("button", { name: "Guardar egreso" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent(
      "Revisa los campos indicados antes de guardar.",
    );
    expect(amount).toHaveFocus();

    await user.type(amount, "85.50");
    await user.type(within(editor).getByLabelText("Descripción"), "Compra urgente");
    await user.click(within(editor).getByRole("button", { name: "Guardar egreso" }));

    expect(await screen.findByText("Egreso registrado")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Egreso: Compra urgente/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar otro similar" }));
    const similarEditor = await screen.findByRole("dialog", { name: "Nuevo egreso" });
    expect(within(similarEditor).getByLabelText(/Monto/)).toHaveValue("");
    expect(within(similarEditor).getByLabelText("Descripción")).toHaveValue("");
  });

  it("permite alternar el tipo de una nueva transacción sin pedir confirmación", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    await user.click(await screen.findByRole("button", { name: "Registrar nuevo movimiento" }));
    const editor = await screen.findByRole("dialog", { name: "Nuevo egreso" });

    await user.click(within(editor).getByLabelText("Transferencia"));
    expect(within(editor).getByLabelText("Desde")).toBeInTheDocument();

    await user.click(within(editor).getByLabelText("Ingreso"));
    expect(within(editor).getByLabelText("Cuenta")).toBeInTheDocument();

    await user.click(within(editor).getByLabelText("Egreso"));
    expect(within(editor).getByLabelText("Egreso")).toBeChecked();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("muestra la validación de una nueva transacción solo al guardarla", async () => {
    const user = userEvent.setup();
    renderApp("/movimientos?period=202608", createServices(explorerTransactions));

    await user.click(await screen.findByRole("button", { name: "Registrar nuevo movimiento" }));
    const editor = await screen.findByRole("dialog", { name: "Nuevo egreso" });
    const amount = within(editor).getByLabelText(/Monto/);

    fireEvent.blur(amount);
    await user.click(within(editor).getByLabelText("Ingreso"));
    expect(within(editor).queryByText("Revisa los campos indicados antes de guardar.")).toBeNull();

    await user.click(within(editor).getByRole("button", { name: "Guardar ingreso" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent(
      "Revisa los campos indicados antes de guardar.",
    );
  });
});
