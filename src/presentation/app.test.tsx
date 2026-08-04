import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { DataSourceQueries } from "../application/use-cases/data-source-queries";
import { GetBasicFinancialSummaryUseCase } from "../application/use-cases/get-basic-financial-summary";
import { GetDashboardOverviewUseCase } from "../application/use-cases/get-dashboard-overview";
import { TransactionQueries } from "../application/use-cases/transaction-queries";
import { AccessTokenStore, type AppServices } from "../composition/services";
import type { DashboardOverview } from "../domain/dashboard";
import type { TransactionValidationIssue } from "../domain/diagnostics";
import { InMemoryTransactionRepository } from "../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../test/fixtures";
import { AuthContext, type AuthContextValue } from "./auth/auth-context";
import { AppRoutes } from "./app";

afterEach(cleanup);

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
  };
};

const authenticatedUser: AuthContextValue = {
  state: {
    status: "authenticated",
    email: "liderazgo@icba.pe",
    name: "Liderazgo ICBA",
  },
  signIn: async () => {},
  signOut: () => {},
};

class FailingDashboardOverviewUseCase extends GetDashboardOverviewUseCase {
  public override async execute(): Promise<DashboardOverview> {
    throw new Error("No se pudo consultar el resumen.");
  }
}

const renderApp = (initialEntry: string, services = createServices()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authenticatedUser}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppRoutes services={services} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
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
  });

  it("actualiza el período del resumen y conserva el enlace a movimientos", async () => {
    const user = userEvent.setup();
    renderApp("/", createServices(undefined, [invalidIssue]));

    const periodSelect = await screen.findByRole("combobox", { name: "Período" });
    const indicators = screen.getByLabelText("Indicadores del período");
    const initialIncomeCard = within(indicators)
      .getByText("Ingresos", { selector: "p" })
      .closest("article");
    if (!initialIncomeCard) throw new Error("No se encontró el indicador de ingresos.");
    expect(initialIncomeCard).toHaveTextContent("1,000.00");
    expect(periodSelect).toHaveValue("202608");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Hay 1 fila inválida que no se incluyen en los totales.",
    );

    await user.selectOptions(periodSelect, "202607");

    await waitFor(() => {
      expect(periodSelect).toHaveValue("202607");
      const selectedIncomeCard = within(indicators)
        .getByText("Ingresos", { selector: "p" })
        .closest("article");
      if (!selectedIncomeCard) throw new Error("No se encontró el indicador de ingresos.");
      expect(selectedIncomeCard).toHaveTextContent("700.00");
    });
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/movimientos?period=202607",
    );
  });

  it("muestra los seis indicadores y permite revelar el detalle acumulado", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const indicators = await screen.findByLabelText("Indicadores del período");
    expect(within(indicators).getByText("Tasa de ahorro")).toBeInTheDocument();
    expect(within(indicators).getByText("Saldo acumulado")).toBeInTheDocument();
    const accumulatedDetail = within(indicators).getByText("Ver acumulados").closest("details");
    if (!accumulatedDetail) throw new Error("No se encontró el detalle acumulado.");
    expect(accumulatedDetail).not.toHaveAttribute("open");

    await user.click(within(indicators).getByText("Ver acumulados"));

    expect(accumulatedDetail).toHaveAttribute("open");
    expect(within(accumulatedDetail).getByText("Egresos")).toBeInTheDocument();
  });

  it("muestra las tendencias anuales accesibles de ofrendas y diezmos", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: "Comportamiento de ofrendas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comportamiento de diezmos" })).toBeInTheDocument();

    const offeringsTable = screen.getByRole("table", { name: "Comportamiento de ofrendas" });
    const tithesTable = screen.getByRole("table", { name: "Comportamiento de diezmos" });
    expect(
      within(offeringsTable).getByRole("columnheader", { name: "Monto recibido" }),
    ).toBeInTheDocument();
    expect(
      within(offeringsTable).getByRole("columnheader", { name: "Número de aportes" }),
    ).toBeInTheDocument();
    expect(within(offeringsTable).getAllByRole("row")).toHaveLength(13);
    expect(within(tithesTable).getAllByRole("row")).toHaveLength(13);
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
