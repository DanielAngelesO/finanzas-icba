import { describe, expect, it } from "vitest";
import { makeTransaction } from "../../test/fixtures";
import { groupLogicalTransactions } from "../../domain/logical-transaction";
import {
  defaultTransactionExplorerCriteria,
  exploreTransactions,
  type TransactionExplorerCriteria,
} from "./explore-transactions";

const createCriteria = (
  overrides: Partial<TransactionExplorerCriteria> = {},
): TransactionExplorerCriteria => ({ ...defaultTransactionExplorerCriteria, ...overrides });

const transactions = groupLogicalTransactions([
  makeTransaction({
    id: "ING-01",
    date: new Date("2026-08-18T05:00:00.000Z"),
    type: "INGRESO",
    account: "Caja",
    category: "Ofrendas",
    description: "Ofrenda de misión",
    donorOrProvider: "María Álvarez",
    referenceOrReceipt: "REC-18",
    amount: 300,
    status: "CONFIRMED",
    period: "202608",
  }),
  makeTransaction({
    id: "EGR-01",
    date: new Date("2026-08-10T05:00:00.000Z"),
    type: "EGRESO",
    account: "Banco",
    category: "Ayuda social",
    description: "Compra de víveres",
    responsible: "Diaconía",
    amount: 500,
    status: "PENDING",
    period: "202608",
  }),
  makeTransaction({
    id: "ING-02",
    date: new Date("2026-07-31T05:00:00.000Z"),
    type: "INGRESO",
    account: "Caja",
    category: "Diezmos",
    description: "Aporte mensual",
    amount: 300,
    status: "CONFIRMED",
    period: "202607",
  }),
]);

describe("exploreTransactions", () => {
  it("encuentra texto parcial sin distinguir tildes, mayúsculas ni espacios", () => {
    const result = exploreTransactions(
      transactions,
      createCriteria({ search: "  maria alvarez " }),
    );

    expect(result.transactions.map((transaction) => transaction.transactionId)).toEqual(["ING-01"]);
  });

  it("combina filtros, incluidos los límites de fecha de forma inclusiva", () => {
    const result = exploreTransactions(
      transactions,
      createCriteria({
        type: "INGRESO",
        account: "Caja",
        dateFrom: "2026-07-31",
        dateTo: "2026-08-18",
      }),
    );

    expect(result.transactions.map((transaction) => transaction.transactionId)).toEqual([
      "ING-01",
      "ING-02",
    ]);
  });

  it("ordena de forma estable por monto y usa fecha e ID para desempatar", () => {
    const result = exploreTransactions(transactions, createCriteria({ sort: "amount-desc" }));

    expect(result.transactions.map((transaction) => transaction.transactionId)).toEqual([
      "EGR-01",
      "ING-01",
      "ING-02",
    ]);
  });

  it("devuelve facetas completas y ajusta una página fuera de rango", () => {
    const result = exploreTransactions(
      transactions,
      createCriteria({ period: "202608", page: 9, pageSize: 20 }),
    );

    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.facets).toEqual({
      periods: ["202608", "202607"],
      accounts: ["Banco", "Caja"],
      categories: ["Ayuda social", "Diezmos", "Ofrendas"],
      statuses: ["CONFIRMED", "PENDING"],
    });
  });
});
