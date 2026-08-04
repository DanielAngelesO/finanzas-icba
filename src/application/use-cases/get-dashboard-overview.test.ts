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
      savingsRate: 650 / 1_200,
      transactionCount: 3,
    });
    expect(overview.accumulated).toEqual({ income: 2_100, expense: 550, balance: 1_550 });
    expect(overview.incomeCategories).toEqual([
      { category: "Ofrendas", amount: 1_200, transactionCount: 1, share: 1 },
    ]);
    expect(overview.contributionTrends.OFRENDAS).toHaveLength(12);
    expect(overview.contributionTrends.OFRENDAS.find((point) => point.period === "202608")).toEqual(
      {
        period: "202608",
        amount: 1_200,
        transactionCount: 1,
      },
    );
    expect(overview.contributionTrends.DIEZMOS.find((point) => point.period === "202607")).toEqual({
      period: "202607",
      amount: 900,
      transactionCount: 1,
    });
    expect(overview.contributionTrends.DIEZMOS.find((point) => point.period === "202608")).toEqual({
      period: "202608",
      amount: 0,
      transactionCount: 0,
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

  it("genera doce meses calendario y calcula cada saldo acumulado con el historial anterior", async () => {
    const periods = [
      "202608",
      "202607",
      "202606",
      "202605",
      "202604",
      "202603",
      "202602",
      "202506",
    ];
    const repository = new InMemoryTransactionRepository(
      periods.map((period) =>
        transactionForPeriod("ING-" + period, period, "INGRESO", 100, "Ofrendas"),
      ),
    );

    const overview = await new GetDashboardOverviewUseCase(repository).execute("202606");

    expect(overview.trend.map((summary) => summary.period)).toEqual([
      "202507",
      "202508",
      "202509",
      "202510",
      "202511",
      "202512",
      "202601",
      "202602",
      "202603",
      "202604",
      "202605",
      "202606",
    ]);
    expect(overview.trend.map((summary) => summary.cumulativeBalance)).toEqual([
      100, 100, 100, 100, 100, 100, 100, 200, 300, 400, 500, 600,
    ]);
    expect(overview.availablePeriods).toEqual(periods);
  });

  it("agrupa gastos no salariales en Otros y usa el período más reciente por defecto", async () => {
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
      { category: "A", amount: 600, transactionCount: 1, share: 600 / 2_100 },
      { category: "B", amount: 500, transactionCount: 1, share: 500 / 2_100 },
      { category: "C", amount: 400, transactionCount: 1, share: 400 / 2_100 },
      { category: "D", amount: 300, transactionCount: 1, share: 300 / 2_100 },
      { category: "E", amount: 200, transactionCount: 1, share: 200 / 2_100 },
      { category: "Otros", amount: 100, transactionCount: 1, share: 100 / 2_100 },
    ]);
    expect(overview.expenseInsights).toEqual({
      leadingCategory: { category: "A", amount: 600, transactionCount: 1, share: 600 / 2_100 },
      topThreeShare: 1_500 / 2_100,
    });
  });

  it("separa Salarios y Honorarios de los demás gastos sin alterar los totales", async () => {
    const salary = transactionForPeriod(
      "SAL-01",
      "202608",
      "EGRESO",
      400,
      "  SALÁRIOS & HONORARIOS  ",
    );
    const contributionBySubcategory = makeTransaction({
      id: "OFR-01",
      period: "202608",
      date: new Date("2026-08-10T12:00:00.000Z"),
      type: "INGRESO",
      amount: 600,
      category: "Donaciones",
      subcategory: "Ofrenda",
    });
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("ING-01", "202608", "INGRESO", 1_000, "Diezmos"),
        contributionBySubcategory,
        salary,
        transactionForPeriod("EGR-01", "202608", "EGRESO", 200, "Servicios"),
        transactionForPeriod("EGR-02", "202608", "EGRESO", 100, "Alquiler"),
        transactionForPeriod("EGR-03", "202608", "EGRESO", 50, "Salarios y Honorarios Extra"),
        transactionForPeriod("JUL-01", "202607", "INGRESO", 300, "Ofrendas"),
      ]),
    ).execute("202608");

    expect(overview.summary?.expense).toBe(750);
    expect(overview.accumulated).toEqual({ income: 1_900, expense: 750, balance: 1_150 });
    expect(overview.expenseComposition).toEqual({
      salariesAndFees: { amount: 400, transactionCount: 1, share: 400 / 750 },
      otherExpenses: { amount: 350, transactionCount: 3, share: 350 / 750 },
    });
    expect(overview.expenseCategories.map((category) => category.category)).toEqual([
      "Servicios",
      "Alquiler",
      "Salarios y Honorarios Extra",
    ]);
    expect(overview.expenseInsights?.topThreeShare).toBe(1);
    expect(overview.contributionTrends.OFRENDAS.find((point) => point.period === "202607")).toEqual(
      {
        period: "202607",
        amount: 300,
        transactionCount: 1,
      },
    );
    expect(overview.contributionTrends.OFRENDAS.find((point) => point.period === "202608")).toEqual(
      {
        period: "202608",
        amount: 600,
        transactionCount: 1,
      },
    );
    expect(overview.contributionTrends.DIEZMOS.find((point) => point.period === "202608")).toEqual({
      period: "202608",
      amount: 1_000,
      transactionCount: 1,
    });
  });

  it("marca la tasa de ahorro como no aplicable cuando el período no tiene ingresos", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("EGR-01", "202608", "EGRESO", 200, "Servicios"),
      ]),
    ).execute("202608");

    expect(overview.summary).toMatchObject({
      income: 0,
      expense: 200,
      netResult: -200,
      savingsRate: null,
    });
  });

  it("devuelve un estado vacío cuando no existen transacciones válidas", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([], [invalidIssue]),
    ).execute();

    expect(overview.selectedPeriod).toBeNull();
    expect(overview.summary).toBeNull();
    expect(overview.accumulated).toBeNull();
    expect(overview.trend).toEqual([]);
    expect(overview.contributionTrends).toEqual({ OFRENDAS: [], DIEZMOS: [] });
    expect(overview.expenseComposition).toBeNull();
    expect(overview.dataCutoff).toBeNull();
    expect(overview.dataQuality.invalidTransactionCount).toBe(1);
  });
});
