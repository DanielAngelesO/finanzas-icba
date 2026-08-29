import { describe, expect, it } from "vitest";
import { groupLogicalTransactions } from "../../../domain/logical-transaction";
import type { LogicalTransaction, Transaction } from "../../../domain/transaction";
import { makeTransaction } from "../../../test/fixtures";
import { formatPreviewDate } from "../../formatters";
import { getTransactionPreviewParts } from "./transaction-ui";

const single = (overrides: Partial<Transaction>): LogicalTransaction => {
  const [logical] = groupLogicalTransactions([makeTransaction(overrides)]);
  if (!logical) throw new Error("No se creó la transacción lógica de prueba.");
  return logical;
};

const transfer = (): LogicalTransaction => {
  const [logical] = groupLogicalTransactions([
    makeTransaction({
      id: "TX-OUT",
      transactionId: "TR-1",
      type: "TRANSFERENCIA",
      accountFlow: "OUTFLOW",
      account: "Banco",
      description: null,
    }),
    makeTransaction({
      id: "TX-IN",
      transactionId: "TR-1",
      type: "TRANSFERENCIA",
      accountFlow: "INFLOW",
      account: "Caja",
      description: null,
    }),
  ]);
  if (!logical) throw new Error("No se creó la transferencia de prueba.");
  return logical;
};

describe("getTransactionPreviewParts", () => {
  it("oculta la categoría cuando el concepto ya es la categoría", () => {
    const parts = getTransactionPreviewParts(
      single({ type: "INGRESO", category: "Ofrendas", description: null }),
    );
    expect(parts.category).toBeNull();
  });

  it("muestra la categoría cuando hay una descripción distinta", () => {
    const parts = getTransactionPreviewParts(
      single({ type: "INGRESO", category: "Ofrendas", description: "Ofrenda especial" }),
    );
    expect(parts.category).toBe("Ofrendas");
  });

  it("expone el donante para el grupo DIEZMOS", () => {
    const parts = getTransactionPreviewParts(
      single({
        type: "INGRESO",
        category: "Diezmos",
        description: "Diezmo mensual",
        donorOrProvider: "  Juan Pérez  ",
      }),
    );
    expect(parts.donor).toBe("Juan Pérez");
    expect(parts.offeringDate).toBeNull();
  });

  it("expone la fecha de preview para el grupo OFRENDAS", () => {
    const transaction = single({
      type: "INGRESO",
      category: "Ofrendas",
      description: "Ofrenda dominical",
    });
    const parts = getTransactionPreviewParts(transaction);
    expect(parts.offeringDate).toBe(formatPreviewDate(transaction.date));
    expect(parts.donor).toBeNull();
  });

  it("no devuelve partes para transferencias", () => {
    expect(getTransactionPreviewParts(transfer())).toEqual({
      category: null,
      donor: null,
      offeringDate: null,
    });
  });
});
