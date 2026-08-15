import { describe, expect, it } from "vitest";
import {
  createPhysicalTransactionRows,
  groupLogicalTransactions,
  validateTransactionDraft,
} from "./logical-transaction";
import { isTransactionIncludedInCalculations, type TransferTransactionDraft } from "./transaction";

const actor = { email: "tesoreria@icba.pe", displayName: "Tesorería" };
const account = (id: string, name: string) => ({ id, name });

const transferDraft: TransferTransactionDraft = {
  type: "TRANSFERENCIA",
  amount: 470,
  date: new Date("2026-08-14T12:00:00"),
  originAccount: account("bank", "Cuenta corriente"),
  destinationAccount: account("cash", "Caja chica"),
  description: "Reposición de caja",
  notes: null,
  responsible: "Tesorería",
};

describe("transacciones lógicas", () => {
  it("crea y agrupa una transferencia como una operación con dos filas coherentes", () => {
    const rows = createPhysicalTransactionRows(transferDraft, {
      actor,
      transactionId: "logical-transfer",
      rowIds: ["row-out", "row-in"],
      now: new Date("2026-08-14T18:00:00.000Z"),
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.transactionId)).toEqual(["logical-transfer", "logical-transfer"]);
    expect(rows.map((row) => row.accountFlow)).toEqual(["OUTFLOW", "INFLOW"]);
    expect(rows.map((row) => row.version)).toEqual([1, 1]);

    expect(groupLogicalTransactions(rows)).toMatchObject([
      {
        kind: "transfer",
        transactionId: "logical-transfer",
        rowIds: ["row-out", "row-in"],
        originAccount: "Cuenta corriente",
        destinationAccount: "Caja chica",
        amount: 470,
      },
    ]);
  });

  it("rechaza cuentas iguales, montos con más de dos decimales y fechas futuras", () => {
    const result = validateTransactionDraft({
      ...transferDraft,
      amount: 10.123,
      date: new Date("2999-01-01T12:00:00"),
      destinationAccount: transferDraft.originAccount,
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors).toMatchObject({
      amount: "Usa como máximo dos decimales.",
      date: "La fecha no puede estar en el futuro.",
      destinationAccount: "La cuenta de destino debe ser distinta de la cuenta de origen.",
    });
  });

  it("mantiene las anuladas en dominio pero las excluye de cálculos", () => {
    const [row] = createPhysicalTransactionRows(
      {
        type: "INGRESO",
        amount: 100,
        date: new Date("2026-08-14T12:00:00"),
        account: account("cash", "Caja"),
        category: account("offerings", "Ofrendas"),
        subcategory: null,
        paymentMethod: account("cash-method", "Efectivo"),
        thirdParty: null,
        referenceOrReceipt: null,
        description: null,
        notes: null,
        responsible: "Tesorería",
      },
      { actor },
    );
    if (!row) throw new Error("No se creó la fila de prueba.");
    row.status = "VOIDED";

    expect(groupLogicalTransactions([row])).toHaveLength(1);
    expect(isTransactionIncludedInCalculations(row)).toBe(false);
  });
});
