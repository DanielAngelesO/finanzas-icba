import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DataSourceQueries } from "../../application/use-cases/data-source-queries";
import { GetBasicFinancialSummaryUseCase } from "../../application/use-cases/get-basic-financial-summary";
import { GetDashboardOverviewUseCase } from "../../application/use-cases/get-dashboard-overview";
import { GetExpenseAnalysisUseCase } from "../../application/use-cases/get-expense-analysis";
import { GetMonthlyBalanceUseCase } from "../../application/use-cases/get-monthly-balance";
import { TransactionQueries } from "../../application/use-cases/transaction-queries";
import { AccessTokenStore, type AppServices } from "../../composition/services";
import type { Transaction } from "../../domain/transaction";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { MonthlyBalancePage } from "./monthly-balance-page";

afterEach(cleanup);

const money = (value: string) => value.replace(/\s/g, " ");

const tx = (id: string, overrides: Partial<Transaction> = {}): Transaction =>
  makeTransaction({
    id,
    period: "202608",
    date: new Date("2026-08-10T12:00:00.000Z"),
    amount: 100,
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

const renderPage = (initialEntry: string, transactions: Transaction[]) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <MonthlyBalancePage services={createServices(transactions)} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const statementRow = (label: string) =>
  money(
    screen.getByRole("rowheader", { name: new RegExp(`^${label}`) }).closest("tr")?.textContent ??
      "",
  );

const blockHeader = (id: string) =>
  money(document.getElementById(id)?.closest("summary")?.textContent ?? "");

const transactions = [
  tx("D1", { type: "INGRESO", category: "Diezmos", amount: 500, description: "Diezmo familia" }),
  tx("O1", { type: "INGRESO", category: "Ofrendas", amount: 150 }),
  tx("X1", { type: "INGRESO", category: "Alquileres", amount: 300, description: "Alquiler salón" }),
  tx("E1", { type: "EGRESO", category: "Servicios", amount: 200 }),
  tx("JUL", { type: "INGRESO", category: "Ofrendas", amount: 999, period: "202607" }),
];

describe("MonthlyBalancePage", () => {
  it("muestra el resumen del período y las cuatro listas con sus totales", async () => {
    renderPage("/balance?period=202608", transactions);

    expect(
      await screen.findByRole("heading", { name: "Balance de agosto de 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Balance mensual" })).toBeInTheDocument();

    expect(statementRow("Aportes")).toContain("650.00");
    expect(statementRow("Otros ingresos")).toContain("300.00");
    expect(statementRow("Ingresos")).toContain("950.00");
    expect(statementRow("Egresos")).toContain("(200.00)");
    expect(statementRow("Saldo del período")).toContain("S/ 750.00");

    // Cada lista muestra su total en la cabecera del bloque.
    expect(blockHeader("balance-list-diezmos")).toContain("S/ 500.00");
    expect(blockHeader("balance-list-egresos")).toContain("S/ 200.00");
    const otherIncome = screen.getByRole("table", { name: "Otros ingresos" });
    expect(within(otherIncome).getByText("Alquiler salón")).toBeInTheDocument();
  });

  it("recalcula el resumen con 'Solo aportes' sin tocar las listas de detalle", async () => {
    const user = userEvent.setup();
    renderPage("/balance?period=202608", transactions);

    await screen.findByRole("heading", { name: /^Balance de / });
    await user.click(screen.getByRole("button", { name: /solo con aportes/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("income=contributions");
    expect(statementRow("Saldo del período")).toContain("S/ 450.00");
    expect(statementRow("Otros ingresos")).toContain("excluido");
    // Las listas siguen completas
    expect(
      within(screen.getByRole("table", { name: "Otros ingresos" })).getByText("Alquiler salón"),
    ).toBeInTheDocument();
  });

  it("muestra ceros y estado vacío cuando el mes no tiene movimientos", async () => {
    renderPage("/balance?period=202601", transactions);

    await screen.findByRole("heading", { name: "Balance de enero de 2026" });
    expect(statementRow("Saldo del período")).toContain("S/ 0.00");
    expect(screen.getAllByText("Sin movimientos")).toHaveLength(4);
  });
});
