import { describe, expect, it } from "vitest";
import {
  defaultExpenseAnalysisCriteria,
  type ExpenseAnalysisCriteria,
  type ExpenseAnalysisFilters,
  type ExpenseDetailCriteria,
} from "../../domain/expense-analysis";
import type { TransactionValidationIssue } from "../../domain/diagnostics";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { GetExpenseAnalysisUseCase } from "./get-expense-analysis";

const expense = (
  id: string,
  period: string,
  amount: number,
  overrides: Partial<ReturnType<typeof makeTransaction>> = {},
) =>
  makeTransaction({
    id,
    period,
    date: new Date(`${period.slice(0, 4)}-${period.slice(4, 6)}-15T12:00:00.000Z`),
    type: "EGRESO",
    amount,
    category: "Servicios",
    subcategory: "Operación",
    donorOrProvider: "Proveedor A",
    paymentMethod: "Transferencia",
    referenceOrReceipt: `REF-${id}`,
    ...overrides,
  });

interface CriteriaPatch {
  analysis?: Partial<ExpenseAnalysisFilters>;
  detail?: Partial<ExpenseDetailCriteria>;
}

const criteria = (patch: CriteriaPatch = {}): ExpenseAnalysisCriteria => ({
  analysis: { ...defaultExpenseAnalysisCriteria.analysis, ...patch.analysis },
  detail: { ...defaultExpenseAnalysisCriteria.detail, ...patch.detail },
});

describe("GetExpenseAnalysisUseCase", () => {
  it("calcula indicadores, tendencia y señales del rango elegido", async () => {
    const report = await new GetExpenseAnalysisUseCase(
      new InMemoryTransactionRepository([
        expense("SAL", "202608", 300, {
          category: "  SALÁRIOS & HONORARIOS  ",
          donorOrProvider: "Equipo pastoral",
        }),
        expense("EFECTIVO", "202608", 200, {
          category: "Materiales",
          paymentMethod: "Efectivo",
        }),
        expense("SIN-REF", "202608", 100, {
          category: "Ayuda social",
          subcategory: null,
          donorOrProvider: null,
          referenceOrReceipt: null,
        }),
        expense("DUP-A", "202607", 400, { referenceOrReceipt: "FV 001" }),
        expense("DUP-B", "202606", 100, { referenceOrReceipt: "fv   001" }),
        expense("PREVIO", "202603", 500),
      ]),
    ).execute(criteria({ analysis: { fromPeriod: "202606", toPeriod: "202608" } }));

    expect(report.range).toMatchObject({
      fromPeriod: "202606",
      toPeriod: "202608",
      comparisonFromPeriod: "202603",
      comparisonToPeriod: "202605",
    });
    expect(report.summary).toMatchObject({
      totalAmount: 1_100,
      transactionCount: 5,
      averageMonthlyAmount: 1_100 / 3,
      previousAmount: 500,
      changeRate: 1.2,
      salariesAndFeesAmount: 300,
      salariesAndFeesShare: 300 / 1_100,
      documentedAmount: 1_000,
      documentedShare: 1_000 / 1_100,
      leadingProvider: "Proveedor A",
      leadingProviderShare: 700 / 1_100,
    });
    expect(report.trend).toEqual([
      expect.objectContaining({ period: "202606", amount: 100, comparisonAmount: 500 }),
      expect.objectContaining({ period: "202607", amount: 400, comparisonAmount: 0 }),
      expect.objectContaining({
        period: "202608",
        amount: 600,
        salariesAndFeesAmount: 300,
        otherExpensesAmount: 300,
      }),
    ]);
    expect(report.categories.map((item) => item.label)).toEqual([
      "Servicios",
      "  SALÁRIOS & HONORARIOS  ",
      "Materiales",
      "Ayuda social",
    ]);
    expect(report.subcategories.at(-1)).toMatchObject({
      kind: "missing",
      label: "Sin subcategoría",
    });
    expect(report.signals["missing-reference"]).toMatchObject({
      available: true,
      transactionCount: 1,
      amount: 100,
    });
    expect(report.signals["cash-payment"]).toMatchObject({ transactionCount: 1, amount: 200 });
    expect(report.signals["duplicate-reference"]).toMatchObject({
      transactionCount: 2,
      amount: 500,
      groupCount: 1,
    });
  });

  it("usa doce meses móviles, conserva meses vacíos y recupera un rango inválido", async () => {
    const report = await new GetExpenseAnalysisUseCase(
      new InMemoryTransactionRepository([
        expense("MAY", "202605", 120),
        expense("AGO", "202608", 240),
      ]),
    ).execute(criteria({ analysis: { fromPeriod: "202612", toPeriod: "202601" } }));

    expect(report.range?.fromPeriod).toBe("202509");
    expect(report.range?.toPeriod).toBe("202608");
    expect(report.trend).toHaveLength(12);
    expect(report.trend.find((point) => point.period === "202601")).toMatchObject({ amount: 0 });
    expect(report.summary.totalAmount).toBe(360);
  });

  it("excluye salarios de todo el análisis y usa las señales solo en el detalle", async () => {
    const report = await new GetExpenseAnalysisUseCase(
      new InMemoryTransactionRepository([
        expense("SAL", "202608", 300, { category: "Salarios y Honorarios" }),
        expense("CAJA", "202608", 200, { paymentMethod: "Cash" }),
        expense("OTRO", "202608", 100),
      ]),
    ).execute(
      criteria({
        analysis: { fromPeriod: "202608", toPeriod: "202608", excludeSalariesAndFees: true },
        detail: { signal: "cash-payment" },
      }),
    );

    expect(report.summary).toMatchObject({ totalAmount: 300, salariesAndFeesAmount: 0 });
    expect(report.signals["cash-payment"].transactionCount).toBe(1);
    expect(report.transactions.map((transaction) => transaction.id)).toEqual(["CAJA"]);
    expect(report.pagination.total).toBe(1);
  });

  it("desactiva los indicadores documentales cuando la fuente no tiene la columna opcional", async () => {
    const missingReferenceColumn: TransactionValidationIssue = {
      code: "MISSING_OPTIONAL_COLUMN",
      severity: "warning",
      message: "No existe la columna opcional: Referencia / Comprobante.",
      rowNumber: null,
      field: "Referencia / Comprobante",
    };
    const report = await new GetExpenseAnalysisUseCase(
      new InMemoryTransactionRepository([expense("A", "202608", 100)], [missingReferenceColumn]),
    ).execute(criteria({ analysis: { fromPeriod: "202608", toPeriod: "202608" } }));

    expect(report.capabilities.hasReferenceOrReceipt).toBe(false);
    expect(report.summary.documentedAmount).toBeNull();
    expect(report.signals["missing-reference"]).toMatchObject({
      available: false,
      transactionCount: 0,
    });
    expect(report.signals["duplicate-reference"]).toMatchObject({
      available: false,
      transactionCount: 0,
    });
  });

  it("pagina el detalle ordenado por monto sin modificar el resumen", async () => {
    const transactions = Array.from({ length: 21 }, (_, index) =>
      expense(`P-${String(index + 1).padStart(2, "0")}`, "202608", index + 1),
    );
    const report = await new GetExpenseAnalysisUseCase(
      new InMemoryTransactionRepository(transactions),
    ).execute(
      criteria({
        analysis: { fromPeriod: "202608", toPeriod: "202608" },
        detail: { sort: "amount-desc", page: 2, pageSize: 20 },
      }),
    );

    expect(report.summary.totalAmount).toBe(231);
    expect(report.pagination).toMatchObject({
      total: 21,
      page: 2,
      totalPages: 2,
      firstResult: 21,
      lastResult: 21,
    });
    expect(report.transactions.map((transaction) => transaction.id)).toEqual(["P-01"]);
  });
});
