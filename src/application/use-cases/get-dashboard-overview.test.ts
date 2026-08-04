import { describe, expect, it } from "vitest";
import type { TransactionValidationIssue } from "../../domain/diagnostics";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { GetDashboardOverviewUseCase } from "./get-dashboard-overview";

const transactionForPeriod = (
  id: string,
  period: string,
  type: "INGRESO" | "EGRESO",
  amount: number,
  category: string,
  day = 1,
) =>
  makeTransaction({
    id,
    period,
    type,
    amount,
    category,
    date: new Date(
      period.slice(0, 4) +
        "-" +
        period.slice(4) +
        "-" +
        String(day).padStart(2, "0") +
        "T12:00:00.000Z",
    ),
  });

const invalidIssue: TransactionValidationIssue = {
  code: "INVALID_AMOUNT",
  severity: "error",
  message: "Monto inválido.",
  rowNumber: 12,
  field: "Monto",
};

describe("GetDashboardOverviewUseCase", () => {
  it("resume el período elegido, sus movimientos recientes y la calidad de datos", async () => {
    const repository = new InMemoryTransactionRepository(
      [
        transactionForPeriod("ING-01", "202608", "INGRESO", 1_200, "Ofrendas", 2),
        transactionForPeriod("EGR-01", "202608", "EGRESO", 350, "Ayuda social", 20),
        transactionForPeriod("EGR-02", "202608", "EGRESO", 200, "Servicios", 25),
        transactionForPeriod("ING-02", "202607", "INGRESO", 900, "Diezmos", 3),
      ],
      [invalidIssue],
    );

    const overview = await new GetDashboardOverviewUseCase(repository).execute("202608");

    expect(overview.selectedPeriod).toBe("202608");
    expect(overview.summary).toEqual({
      period: "202608",
      income: 1_200,
      expense: 550,
      netResult: 650,
      transactionCount: 3,
    });
    expect(overview.recentTransactions.map((transaction) => transaction.id)).toEqual([
      "EGR-02",
      "EGR-01",
      "ING-01",
    ]);
    expect(overview.dataQuality).toEqual({
      totalDataRowCount: 5,
      validTransactionCount: 4,
      invalidTransactionCount: 1,
    });
  });

  it("muestra hasta seis períodos consecutivos que terminan en el seleccionado", async () => {
    const periods = ["202608", "202607", "202606", "202605", "202604", "202603", "202602"];
    const repository = new InMemoryTransactionRepository(
      periods.map((period) =>
        transactionForPeriod("ING-" + period, period, "INGRESO", 100, "Ofrendas"),
      ),
    );

    const overview = await new GetDashboardOverviewUseCase(repository).execute("202606");

    expect(overview.trend.map((summary) => summary.period)).toEqual([
      "202602",
      "202603",
      "202604",
      "202605",
      "202606",
    ]);
    expect(overview.availablePeriods).toEqual(periods);
  });

  it("agrupa las categorías de egreso restantes en Otros y usa el período más reciente por defecto", async () => {
    const categories = [
      ["A", 600],
      ["B", 500],
      ["C", 400],
      ["D", 300],
      ["E", 200],
      ["F", 100],
    ] as const;
    const repository = new InMemoryTransactionRepository([
      transactionForPeriod("ING-08", "202608", "INGRESO", 1_000, "Ofrendas"),
      ...categories.map(([category, amount]) =>
        transactionForPeriod("E-" + category, "202608", "EGRESO", amount, category),
      ),
      transactionForPeriod("ING-07", "202607", "INGRESO", 900, "Ofrendas"),
    ]);

    const overview = await new GetDashboardOverviewUseCase(repository).execute("sin-periodo");

    expect(overview.selectedPeriod).toBe("202608");
    expect(overview.expenseCategories).toEqual([
      { category: "A", amount: 600 },
      { category: "B", amount: 500 },
      { category: "C", amount: 400 },
      { category: "D", amount: 300 },
      { category: "E", amount: 200 },
      { category: "Otros", amount: 100 },
    ]);
  });

  it("devuelve un estado vacío cuando no existen transacciones válidas", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([], [invalidIssue]),
    ).execute();

    expect(overview.selectedPeriod).toBeNull();
    expect(overview.summary).toBeNull();
    expect(overview.trend).toEqual([]);
    expect(overview.dataCutoff).toBeNull();
    expect(overview.dataQuality.invalidTransactionCount).toBe(1);
  });
});
