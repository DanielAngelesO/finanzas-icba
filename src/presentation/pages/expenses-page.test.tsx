import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DataSourceQueries } from "../../application/use-cases/data-source-queries";
import { GetDashboardOverviewUseCase } from "../../application/use-cases/get-dashboard-overview";
import { GetExpenseAnalysisUseCase } from "../../application/use-cases/get-expense-analysis";
import { GetMonthlyBalanceUseCase } from "../../application/use-cases/get-monthly-balance";
import { GetBasicFinancialSummaryUseCase } from "../../application/use-cases/get-basic-financial-summary";
import { TransactionQueries } from "../../application/use-cases/transaction-queries";
import { AccessTokenStore, type AppServices } from "../../composition/services";
import type { Transaction } from "../../domain/transaction";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { ExpensesPage } from "./expenses-page";

afterEach(cleanup);

const expense = (id: string, overrides: Partial<Transaction> = {}): Transaction =>
  makeTransaction({
    id,
    type: "EGRESO",
    period: "202608",
    date: new Date("2026-08-15T05:00:00.000Z"),
    amount: 100,
    category: "Servicios",
    subcategory: "Operación",
    donorOrProvider: "Proveedor A",
    paymentMethod: "Transferencia",
    referenceOrReceipt: `REF-${id}`,
    ...overrides,
  });

const createServices = (transactions: Transaction[]): AppServices => {
  const repository = new InMemoryTransactionRepository(transactions);
  return {
    tokenStore: new AccessTokenStore(),
    transactions: new TransactionQueries(repository),
    dataSource: new DataSourceQueries(repository),
    financialSummary: new GetBasicFinancialSummaryUseCase(repository),
    dashboard: new GetDashboardOverviewUseCase(repository),
    expenses: new GetExpenseAnalysisUseCase(repository),
    monthlyBalance: new GetMonthlyBalanceUseCase(repository),
  };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const renderExpenses = (initialEntry: string, transactions: Transaction[]) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ExpensesPage services={createServices(transactions)} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("ExpensesPage", () => {
  const transactions = [
    expense("SAL", {
      amount: 300,
      category: "Salarios y Honorarios",
      donorOrProvider: "Equipo pastoral",
    }),
    expense("CASH", {
      amount: 200,
      category: "Materiales",
      paymentMethod: "Efectivo",
      referenceOrReceipt: null,
      description: "Pago en efectivo",
    }),
    expense("SOCIAL", {
      amount: 150,
      category: "Ayuda social",
      subcategory: null,
      donorOrProvider: null,
    }),
    expense("JUL", {
      period: "202607",
      date: new Date("2026-07-15T05:00:00.000Z"),
      amount: 250,
      category: "Servicios",
    }),
  ];

  it("muestra indicadores y tablas alternativas para los gráficos del rango de URL", async () => {
    renderExpenses("/gastos?from=202607&to=202608", transactions);

    expect(await screen.findByRole("heading", { name: "Análisis de gastos" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Desde" })).toHaveValue("202607");
    expect(screen.getByRole("combobox", { name: "Hasta" })).toHaveValue("202608");
    expect(screen.getByText("Gasto total", { selector: "p" }).closest("article")).toHaveTextContent(
      "900.00",
    );
    expect(screen.getByRole("table", { name: "Evolución mensual del gasto" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Gasto por categoría" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Gasto por subcategoría" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Concentración de proveedores" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Métodos de pago" })).toBeInTheDocument();
  });

  it("actualiza la URL y el resumen al profundizar por categoría", async () => {
    const user = userEvent.setup();
    renderExpenses("/gastos?from=202607&to=202608", transactions);

    const categoryChart = await screen.findByRole("heading", { name: "Gasto por categoría" });
    const chart = categoryChart.closest("figure");
    if (!chart) throw new Error("No se encontró el gráfico de categorías.");
    await user.click(within(chart).getByRole("button", { name: /Materiales/ }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("category=Materiales");
      expect(
        screen.getByText("Gasto total", { selector: "p" }).closest("article"),
      ).toHaveTextContent("200.00");
    });
  });

  it("filtra solo el detalle al seleccionar una señal y conserva los indicadores", async () => {
    const user = userEvent.setup();
    renderExpenses("/gastos?from=202607&to=202608", transactions);

    const initialTotal = await screen.findByText("Gasto total", { selector: "p" });
    const totalCard = initialTotal.closest("article");
    if (!totalCard) throw new Error("No se encontró el indicador de gasto total.");
    expect(totalCard).toHaveTextContent("900.00");

    const cashSignal = screen.getByText("Pagos en efectivo").closest("article");
    if (!cashSignal) throw new Error("No se encontró la señal de efectivo.");
    await user.click(within(cashSignal).getByRole("button", { name: "Revisar movimientos" }));

    await waitFor(() => {
      const detailSection = screen
        .getByRole("heading", { name: "Movimientos de gasto" })
        .closest("section");
      if (!detailSection) throw new Error("No se encontró el detalle de gastos.");
      expect(
        within(detailSection).getByText("1 gasto encontrado para la señal seleccionada."),
      ).toBeInTheDocument();
      expect(
        within(detailSection).getByText("1 gasto encontrado para la señal seleccionada."),
      ).toHaveTextContent("1 gasto encontrado para la señal seleccionada.");
      expect(totalCard).toHaveTextContent("900.00");
      expect(screen.getByTestId("location")).toHaveTextContent("signal=cash-payment");
    });
  });

  it("abre el detalle completo y devuelve el foco al activador al cerrar", async () => {
    const user = userEvent.setup();
    renderExpenses("/gastos?from=202608&to=202608&signal=cash-payment", transactions);

    const detailButtons = await screen.findAllByRole("button", {
      name: "Ver detalle de Pago en efectivo",
    });
    const detailButton = detailButtons[0];
    if (!detailButton) throw new Error("No se encontró el activador del detalle.");
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Trazabilidad")).toBeInTheDocument();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    await waitFor(() => {
      expect(dialog).not.toHaveAttribute("open");
      expect(detailButton).toHaveFocus();
    });
  });
});
