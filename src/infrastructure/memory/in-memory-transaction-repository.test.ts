import { describe, expect, it } from "vitest";
import { TransactionConflictError, type ExpenseTransactionDraft } from "../../domain/transaction";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository";

const actor = { email: "tesoreria@icba.pe", displayName: "Tesorería" };
const pick = (id: string, name: string) => ({ id, name });
const expenseDraft: ExpenseTransactionDraft = {
  type: "EGRESO",
  amount: 257,
  date: new Date("2026-08-14T12:00:00"),
  account: pick("cash", "Caja chica"),
  category: pick("materials", "Materiales"),
  subcategory: pick("paper", "Papelería"),
  paymentMethod: pick("card", "Tarjeta"),
  thirdParty: pick("bookstore", "Librería Central"),
  referenceOrReceipt: "F001-482",
  description: "Compra de materiales",
  notes: null,
  responsible: "Tesorería",
};

describe("InMemoryTransactionRepository CRUD", () => {
  it("crea, versiona y anula una transacción sin borrarla", async () => {
    const repository = new InMemoryTransactionRepository();
    const created = await repository.create(expenseDraft, actor);

    expect(created).toMatchObject({ type: "EGRESO", version: 1, status: "CONFIRMED" });
    const updated = await repository.update(
      created.transactionId,
      created.version,
      { ...expenseDraft, amount: 300 },
      actor,
    );
    expect(updated).toMatchObject({ amount: 300, version: 2 });

    const voided = await repository.voidTransaction(
      updated.transactionId,
      updated.version,
      "Comprobante duplicado",
      actor,
    );
    expect(voided).toMatchObject({ status: "VOIDED", version: 3 });
    expect(voided.audit.voidReason).toBe("Comprobante duplicado");
    await expect(repository.findAll()).resolves.toHaveLength(1);
  });

  it("detecta una versión obsoleta antes de editar", async () => {
    const repository = new InMemoryTransactionRepository();
    const created = await repository.create(expenseDraft, actor);
    await repository.update(created.transactionId, created.version, expenseDraft, actor);

    await expect(
      repository.update(created.transactionId, created.version, expenseDraft, actor),
    ).rejects.toBeInstanceOf(TransactionConflictError);
  });

  it("convierte un cambio de tipo en una corrección enlazada", async () => {
    const repository = new InMemoryTransactionRepository();
    const created = await repository.create(expenseDraft, actor);
    const correction = await repository.update(
      created.transactionId,
      created.version,
      {
        ...expenseDraft,
        type: "INGRESO",
        referenceOrReceipt: null,
      },
      actor,
    );

    expect(correction.type).toBe("INGRESO");
    expect(correction.audit.correctsTransactionId).toBe(created.transactionId);
    const original = await repository.findById(created.transactionId);
    expect(original?.status).toBe("VOIDED");
    expect(original?.audit.correctedBy).toBe(correction.transactionId);
  });
});
