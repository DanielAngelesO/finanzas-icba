import { describe, expect, it } from "vitest";
import { InMemoryTransactionRepository } from "../../infrastructure/memory/in-memory-transaction-repository";
import { makeTransaction } from "../../test/fixtures";
import { GetBasicFinancialSummaryUseCase } from "./get-basic-financial-summary";
import { TransactionQueries } from "./transaction-queries";

describe("casos de uso de transacciones", () => {
  it("calcula ingresos, egresos y balance una sola vez en el caso de uso", async () => {
    const repository = new InMemoryTransactionRepository([
      makeTransaction({ id: "I-1", type: "INGRESO", amount: 500 }),
      makeTransaction({ id: "E-1", type: "EGRESO", amount: 150 }),
    ]);
    await expect(new GetBasicFinancialSummaryUseCase(repository).execute()).resolves.toEqual({
      income: 500,
      expense: 150,
      balance: 350,
      transactionCount: 2,
      validTransactionCount: 2,
      invalidTransactionCount: 0,
    });
  });

  it("filtra por período, encuentra por ID y maneja repositorio vacío", async () => {
    const repository = new InMemoryTransactionRepository([
      makeTransaction({ id: "A", period: "202607" }),
      makeTransaction({ id: "B", period: "202608" }),
    ]);
    const queries = new TransactionQueries(repository);
    await expect(queries.findByPeriod("202608")).resolves.toHaveLength(1);
    await expect(queries.findById("A")).resolves.toMatchObject({ period: "202607" });
    await expect(
      new TransactionQueries(new InMemoryTransactionRepository()).findAll(),
    ).resolves.toEqual([]);
  });
});
