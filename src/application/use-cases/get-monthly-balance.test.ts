import { describe, expect, it } from "vitest";
import type { TransactionValidationIssue } from "../../domain/diagnostics";
import type { Transaction } from "../../domain/transaction";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { GetMonthlyBalanceUseCase } from "./get-monthly-balance";

const tx = (id: string, overrides: Partial<Transaction> = {}): Transaction =>
  makeTransaction({
    id,
    period: "202608",
    date: new Date("2026-08-10T12:00:00.000Z"),
    amount: 100,
    ...overrides,
  });

const buildUseCase = (transactions: Transaction[], issues: TransactionValidationIssue[] = []) =>
  new GetMonthlyBalanceUseCase(new InMemoryTransactionRepository(transactions, issues));

describe("GetMonthlyBalanceUseCase", () => {
  it("separa diezmos, ofrendas, otros ingresos y egresos con sus totales", async () => {
    const useCase = buildUseCase([
      tx("D1", { type: "INGRESO", category: "Aportes", subcategory: "Diezmo", amount: 300 }),
      tx("D2", { type: "INGRESO", category: "Diezmos", amount: 200 }),
      tx("O1", { type: "INGRESO", category: "Ofrenda", amount: 150 }),
      tx("X1", { type: "INGRESO", category: "Alquileres", amount: 500 }),
      tx("E1", { type: "EGRESO", category: "Servicios", amount: 120 }),
      tx("E2", { type: "EGRESO", category: "Salarios y Honorarios", amount: 80 }),
    ]);

    const result = await useCase.execute("202608");

    expect(result.tithes.total).toBe(500);
    expect(result.tithes.count).toBe(2);
    expect(result.offerings.total).toBe(150);
    expect(result.otherIncome.total).toBe(500);
    expect(result.expenses.total).toBe(200);

    expect(result.income).toEqual({ contributions: 650, other: 500, total: 1150 });
    expect(result.expense).toBe(200);
    expect(result.netResult).toEqual({ contributions: 450, all: 950 });
    expect(result.hasData).toBe(true);
  });

  it("ignora transferencias y transacciones anuladas", async () => {
    const useCase = buildUseCase([
      tx("O1", { type: "INGRESO", category: "Ofrendas", amount: 100 }),
      tx("V1", { type: "INGRESO", category: "Ofrendas", amount: 999, status: "VOIDED" }),
      tx("T1", { type: "TRANSFERENCIA", category: "Transferencia interna", amount: 400 }),
    ]);

    const result = await useCase.execute("202608");

    expect(result.offerings.total).toBe(100);
    expect(result.offerings.count).toBe(1);
    expect(result.income.total).toBe(100);
  });

  it("filtra por período y ordena cada lista cronológicamente", async () => {
    const useCase = buildUseCase([
      tx("A", {
        type: "INGRESO",
        category: "Ofrendas",
        amount: 10,
        date: new Date("2026-08-20T12:00:00.000Z"),
        rowNumber: 5,
      }),
      tx("B", {
        type: "INGRESO",
        category: "Ofrendas",
        amount: 20,
        date: new Date("2026-08-05T12:00:00.000Z"),
        rowNumber: 4,
      }),
      tx("JUL", { type: "INGRESO", category: "Ofrendas", amount: 900, period: "202607" }),
    ]);

    const result = await useCase.execute("202608");

    expect(result.offerings.entries.map((entry) => entry.id)).toEqual(["B", "A"]);
    expect(result.offerings.total).toBe(30);
  });

  it("devuelve grupos vacíos y totales en cero para un mes sin datos", async () => {
    const useCase = buildUseCase([
      tx("O1", { type: "INGRESO", category: "Ofrendas", amount: 100, period: "202607" }),
    ]);

    const result = await useCase.execute("202608");

    expect(result.period).toBe("202608");
    expect(result.hasData).toBe(false);
    expect(result.income).toEqual({ contributions: 0, other: 0, total: 0 });
    expect(result.netResult).toEqual({ contributions: 0, all: 0 });
    expect(result.tithes.entries).toHaveLength(0);
    expect(result.expenses.entries).toHaveLength(0);
  });

  it("expone el conteo de filas inválidas desde la inspección", async () => {
    const issue: TransactionValidationIssue = {
      code: "INVALID_DATE",
      severity: "error",
      message: "Fecha inválida.",
      rowNumber: 12,
      field: "Fecha",
    };
    const useCase = buildUseCase(
      [tx("O1", { type: "INGRESO", category: "Ofrendas", amount: 100 })],
      [issue],
    );

    const result = await useCase.execute("202608");

    expect(result.dataQuality.invalidTransactionCount).toBe(1);
  });

  it("usa el período más reciente con datos cuando el solicitado no es válido", async () => {
    const useCase = buildUseCase([
      tx("O1", { type: "INGRESO", category: "Ofrendas", amount: 100, period: "202608" }),
      tx("O2", { type: "INGRESO", category: "Ofrendas", amount: 50, period: "202607" }),
    ]);

    const result = await useCase.execute("no-es-un-periodo");

    expect(result.period).toBe("202608");
    expect(result.offerings.total).toBe(100);
  });
});
