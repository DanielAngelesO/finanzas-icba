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

const transferForPeriod = (
  id: string,
  period: string,
  account: string,
  accountFlow: "INFLOW" | "OUTFLOW",
  amount: number,
  transferId: string,
  day = 1,
) =>
  makeTransaction({
    id,
    period,
    type: "TRANSFERENCIA",
    account,
    accountFlow,
    transferId,
    amount,
    category: "Transferencia interna",
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
  it("calcula el saldo histórico por cuenta e ignora transferencias en el resultado financiero", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("JUL-INCOME", "202607", "INGRESO", 100, "Ofrendas", 2),
        makeTransaction({
          id: "JUL-ZERO-INCOME",
          period: "202607",
          date: new Date("2026-07-03T12:00:00.000Z"),
          type: "INGRESO",
          account: "Cuenta sin saldo",
          amount: 20,
          category: "Ofrendas",
        }),
        makeTransaction({
          id: "JUL-ZERO-EXPENSE",
          period: "202607",
          date: new Date("2026-07-04T12:00:00.000Z"),
          type: "EGRESO",
          account: "Cuenta sin saldo",
          amount: 20,
          category: "Servicios",
        }),
        transferForPeriod("AUG-TRANSFER-OUT", "202608", "Caja", "OUTFLOW", 40, "TRANSFER-001", 3),
        transferForPeriod("AUG-TRANSFER-IN", "202608", "Banco", "INFLOW", 40, "TRANSFER-001", 3),
        makeTransaction({
          id: "AUG-EXPENSE-BANK",
          period: "202608",
          type: "EGRESO",
          account: "Banco",
          amount: 10,
          category: "Servicios",
          date: new Date("2026-08-04T12:00:00.000Z"),
        }),
        makeTransaction({
          id: "AUG-EXPENSE-CASH",
          period: "202608",
          type: "EGRESO",
          account: "Caja chica",
          amount: 5,
          category: "Materiales",
          date: new Date("2026-08-05T12:00:00.000Z"),
        }),
        transactionForPeriod("SEP-INCOME", "202609", "INGRESO", 999, "Ofrendas", 2),
      ]),
    ).execute("202608");

    expect(overview.summary).toMatchObject({
      income: { CONTRIBUTIONS: 0, ALL: 0 },
      expense: 15,
      netResult: { CONTRIBUTIONS: -15, ALL: -15 },
    });
    expect(overview.accumulated?.balance).toEqual({ CONTRIBUTIONS: 85, ALL: 85 });
    expect(overview.accountPosition).toEqual({
      accounts: [
        { account: "Caja", balance: 60 },
        { account: "Banco", balance: 30 },
        { account: "Cuenta sin saldo", balance: 0 },
        { account: "Caja chica", balance: -5 },
      ],
      total: 85,
    });
    expect(overview.accountPosition?.total).toBe(overview.accumulated?.balance.ALL);
  });

  it("resume aportes, otros y total con métricas comparables por alcance", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("AUG-TITHE", "202608", "INGRESO", 100, "Diezmos", 2),
        transactionForPeriod("AUG-OFFERING", "202608", "INGRESO", 50, "Ofrendas", 3),
        transactionForPeriod("AUG-OTHER", "202608", "INGRESO", 80, "Donación especial", 5),
        transactionForPeriod("AUG-EXPENSE", "202608", "EGRESO", 40, "Servicios", 5),
        transactionForPeriod("JUL-TITHE", "202607", "INGRESO", 70, "Diezmos", 2),
        transactionForPeriod("JUL-OFFERING", "202607", "INGRESO", 30, "Ofrendas", 3),
        transactionForPeriod("JUL-OTHER", "202607", "INGRESO", 20, "Donación especial", 5),
        transactionForPeriod("JUL-EXPENSE", "202607", "EGRESO", 10, "Servicios", 5),
      ]),
    ).execute("202608");

    expect(overview.summary).toEqual({
      period: "202608",
      income: { CONTRIBUTIONS: 150, ALL: 230 },
      expense: 40,
      netResult: { CONTRIBUTIONS: 110, ALL: 190 },
      savingsRate: { CONTRIBUTIONS: 110 / 150, ALL: 190 / 230 },
      transactionCount: 4,
    });
    expect(overview.accumulated).toEqual({
      income: { CONTRIBUTIONS: 250, ALL: 350 },
      expense: 50,
      balance: { CONTRIBUTIONS: 200, ALL: 300 },
    });
    expect(overview.incomeBreakdown).toEqual({
      DIEZMOS: { amount: 100, transactionCount: 1, share: 100 / 230 },
      OFRENDAS: { amount: 50, transactionCount: 1, share: 50 / 230 },
      OTROS: { amount: 80, transactionCount: 1, share: 80 / 230 },
    });
    expect(overview.incomeCategories.CONTRIBUTIONS.map((category) => category.category)).toEqual([
      "Diezmos",
      "Ofrendas",
    ]);
    expect(overview.incomeCategories.ALL.map((category) => category.category)).toEqual([
      "Diezmos",
      "Donación especial",
      "Ofrendas",
    ]);
    expect(overview.comparison).toMatchObject({
      window: { kind: "THROUGH_DAY", previousPeriod: "202607", throughDay: 5 },
      income: {
        CONTRIBUTIONS: { previousValue: 100, delta: 50, rate: 0.5, direction: "INCREASED" },
        ALL: { previousValue: 120, delta: 110, rate: 110 / 120, direction: "INCREASED" },
      },
      incomeByGroup: {
        DIEZMOS: { previousValue: 70, delta: 30, rate: 30 / 70, direction: "INCREASED" },
        OFRENDAS: { previousValue: 30, delta: 20, rate: 20 / 30, direction: "INCREASED" },
        OTROS: { previousValue: 20, delta: 60, rate: 3, direction: "INCREASED" },
      },
      expense: { previousValue: 10, delta: 30, rate: 3, direction: "INCREASED" },
      netResult: {
        CONTRIBUTIONS: { previousValue: 90, delta: 20, rate: 20 / 90, direction: "INCREASED" },
        ALL: { previousValue: 110, delta: 80, rate: 80 / 110, direction: "INCREASED" },
      },
      accumulatedBalance: {
        CONTRIBUTIONS: { previousValue: 90, delta: 110, rate: 110 / 90, direction: "INCREASED" },
        ALL: { previousValue: 110, delta: 190, rate: 190 / 110, direction: "INCREASED" },
      },
    });
    expect(overview.comparison?.savingsRate.CONTRIBUTIONS).toEqual({
      currentValue: 110 / 150,
      previousValue: 0.9,
      delta: 110 / 150 - 0.9,
      direction: "DECREASED",
    });
    expect(overview.comparison?.savingsRate.ALL).toEqual({
      currentValue: 190 / 230,
      previousValue: 110 / 120,
      delta: 190 / 230 - 110 / 120,
      direction: "DECREASED",
    });
  });

  it("entrega las cantidades y montos de cada grupo dentro de la tendencia anual", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("AUG-TITHE", "202608", "INGRESO", 300, "Diezmos"),
        transactionForPeriod("AUG-OFFERING", "202608", "INGRESO", 200, "Ofrendas"),
        transactionForPeriod("AUG-OTHER-1", "202608", "INGRESO", 40, "Campaña"),
        transactionForPeriod("AUG-OTHER-2", "202608", "INGRESO", 60, "Campaña"),
        transactionForPeriod("JUL-TITHE", "202607", "INGRESO", 100, "Diezmos"),
      ]),
    ).execute("202608");

    const augustTrend = overview.trend.find((point) => point.period === "202608");
    const julyTrend = overview.trend.find((point) => point.period === "202607");

    expect(augustTrend).toMatchObject({
      income: { CONTRIBUTIONS: 500, ALL: 600 },
      incomeByGroup: {
        DIEZMOS: { amount: 300, transactionCount: 1 },
        OFRENDAS: { amount: 200, transactionCount: 1 },
        OTROS: { amount: 100, transactionCount: 2 },
      },
    });
    expect(julyTrend?.incomeByGroup.DIEZMOS).toEqual({ amount: 100, transactionCount: 1 });
  });

  it("genera una tendencia diaria continua y conserva el alcance de cada ingreso", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("ING-01", "202608", "INGRESO", 100, "Ofrendas", 2),
        transactionForPeriod("ING-02", "202608", "INGRESO", 50, "Diezmos", 2),
        transactionForPeriod("ING-03", "202608", "INGRESO", 30, "Actividad", 3),
        transactionForPeriod("EGR-01", "202608", "EGRESO", 60, "Servicios", 4),
      ]),
    ).execute("202608");

    expect(overview.periodDailyTrend).toHaveLength(4);
    expect(overview.periodDailyTrend[1]).toEqual({
      date: "2026-08-02",
      income: { CONTRIBUTIONS: 150, ALL: 150 },
      incomeByGroup: { DIEZMOS: 50, OFRENDAS: 100, OTROS: 0 },
      expense: 0,
      netResult: { CONTRIBUTIONS: 150, ALL: 150 },
      cumulativeNetResult: { CONTRIBUTIONS: 150, ALL: 150 },
    });
    expect(overview.periodDailyTrend[2]).toMatchObject({
      income: { CONTRIBUTIONS: 0, ALL: 30 },
      incomeByGroup: { DIEZMOS: 0, OFRENDAS: 0, OTROS: 30 },
      cumulativeNetResult: { CONTRIBUTIONS: 150, ALL: 180 },
    });
    expect(overview.periodIncomeBehavior[2]).toEqual({
      date: "2026-08-03",
      cumulativeShare: { DIEZMOS: 1, OFRENDAS: 1, OTROS: 1 },
    });
  });

  it("compara el período más reciente hasta el último día real del mes anterior", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("FEB-TITHE", "202602", "INGRESO", 100, "Diezmos", 28),
        transactionForPeriod("FEB-LATE", "202602", "INGRESO", 50, "Ofrendas", 27),
        transactionForPeriod("MAR-TITHE", "202603", "INGRESO", 150, "Diezmos", 31),
        transactionForPeriod("MAR-EXPENSE", "202603", "EGRESO", 40, "Servicios", 31),
      ]),
    ).execute("202603");

    expect(overview.comparison?.window).toEqual({
      kind: "THROUGH_DAY",
      previousPeriod: "202602",
      throughDay: 28,
    });
    expect(overview.comparison?.income.CONTRIBUTIONS).toEqual({
      previousValue: 150,
      delta: 0,
      rate: 0,
      direction: "UNCHANGED",
    });
  });

  it("compara meses históricos completos, atraviesa el cambio de año y conserva saldos negativos", async () => {
    const overview = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("DEC-EXPENSE", "202512", "EGRESO", 100, "Servicios", 28),
        transactionForPeriod("JAN-EXPENSE", "202601", "EGRESO", 50, "Servicios", 2),
        transactionForPeriod("FEB-INCOME", "202602", "INGRESO", 20, "Ofrendas", 1),
      ]),
    ).execute("202601");

    expect(overview.comparison?.window).toEqual({ kind: "FULL_MONTH", previousPeriod: "202512" });
    expect(overview.comparison?.netResult.CONTRIBUTIONS).toEqual({
      previousValue: -100,
      delta: 50,
      rate: 0.5,
      direction: "INCREASED",
    });
    expect(overview.accumulated?.balance).toEqual({ CONTRIBUTIONS: -150, ALL: -150 });
    expect(overview.comparison?.accumulatedBalance.CONTRIBUTIONS).toEqual({
      previousValue: -100,
      delta: -50,
      rate: -0.5,
      direction: "DECREASED",
    });
    expect(overview.comparison?.savingsRate.CONTRIBUTIONS).toEqual({
      currentValue: null,
      previousValue: null,
      delta: null,
      direction: null,
    });
  });

  it("no compara tasas sin ingresos y conserva estados vacíos", async () => {
    const onlyExpenses = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([
        transactionForPeriod("EGR-01", "202608", "EGRESO", 200, "Servicios"),
      ]),
    ).execute("202608");
    const empty = await new GetDashboardOverviewUseCase(
      new InMemoryTransactionRepository([], [invalidIssue]),
    ).execute();

    expect(onlyExpenses.summary).toMatchObject({
      income: { CONTRIBUTIONS: 0, ALL: 0 },
      expense: 200,
      netResult: { CONTRIBUTIONS: -200, ALL: -200 },
      savingsRate: { CONTRIBUTIONS: null, ALL: null },
    });
    expect(onlyExpenses.comparison?.income.CONTRIBUTIONS).toEqual({
      previousValue: 0,
      delta: 0,
      rate: null,
      direction: "UNCHANGED",
    });
    expect(onlyExpenses.comparison?.savingsRate.ALL).toEqual({
      currentValue: null,
      previousValue: null,
      delta: null,
      direction: null,
    });
    expect(empty).toMatchObject({
      selectedPeriod: null,
      summary: null,
      accumulated: null,
      comparison: null,
      incomeBreakdown: null,
      periodDailyTrend: [],
      periodIncomeBehavior: [],
      trend: [],
      incomeCategories: { CONTRIBUTIONS: [], ALL: [] },
      expenseComposition: null,
      dataCutoff: null,
    });
    expect(empty.dataQuality.invalidTransactionCount).toBe(1);
  });
});
