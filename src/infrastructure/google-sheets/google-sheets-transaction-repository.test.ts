import { describe, expect, it, vi } from "vitest";
import type { ExpenseTransactionDraft, TransferTransactionDraft } from "../../domain/transaction";
import { header, sheetConfig, transactionRow } from "../../test/fixtures";
import {
  GoogleSheetsClient,
  GoogleSheetsError,
  type GoogleCell,
  type GoogleCellData,
  type GoogleSheetsBatchRequest,
} from "./google-sheets-client";
import { GoogleSheetsTransactionRepository } from "./google-sheets-transaction-repository";

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
const transferDraft: TransferTransactionDraft = {
  type: "TRANSFERENCIA",
  amount: 470,
  date: new Date("2026-08-14T12:00:00"),
  originAccount: pick("bank", "Cuenta corriente"),
  destinationAccount: pick("cash", "Caja chica"),
  description: "Reposición de caja",
  notes: null,
  responsible: "Tesorería",
};

const catalogs: Record<string, GoogleCell[][]> = {
  Cuentas: [
    ["ID", "Nombre", "Activa", "Orden"],
    ["bank", "Cuenta corriente", true, 1],
    ["cash", "Caja chica", true, 2],
  ],
  Categorias: [
    ["ID", "Nombre", "Tipo", "Activa", "Orden"],
    ["materials", "Materiales", "EGRESO", true, 1],
  ],
  Subcategorias: [
    ["ID", "Categoria ID", "Nombre", "Activa", "Orden"],
    ["paper", "materials", "Papelería", true, 1],
  ],
  Terceros: [
    ["ID", "Nombre", "Rol", "Activo"],
    ["bookstore", "Librería Central", "PROVEEDOR", true],
  ],
  "Metodos Pago": [
    ["ID", "Nombre", "Activo", "Orden"],
    ["card", "Tarjeta", true, 1],
  ],
};

const enteredValue = (cell: GoogleCellData): GoogleCell => {
  const value = cell.userEnteredValue;
  if ("stringValue" in value) return value.stringValue;
  if ("numberValue" in value) return value.numberValue;
  return value.boolValue;
};

const createHarness = (initialRows: GoogleCell[][] = []) => {
  const transactionValues: GoogleCell[][] = [header, ...initialRows];
  const batchUpdate = vi.fn<(requests: GoogleSheetsBatchRequest[]) => Promise<void>>();
  const getValues = vi.fn(async (sheetName = sheetConfig.sheetName): Promise<GoogleCell[][]> =>
    sheetName === sheetConfig.sheetName ? transactionValues : (catalogs[sheetName] ?? []),
  );
  const client = {
    getMetadata: vi.fn(async () => ({
      id: sheetConfig.spreadsheetId,
      title: "Finanzas ICBA",
      sheetNames: [sheetConfig.sheetName, ...Object.keys(catalogs)],
      sheets: [
        { id: 7, title: sheetConfig.sheetName },
        ...Object.keys(catalogs).map((title, index) => ({ id: index + 20, title })),
      ],
    })),
    getValues,
    batchUpdate,
  } as unknown as GoogleSheetsClient;
  return {
    batchUpdate,
    repository: new GoogleSheetsTransactionRepository(sheetConfig, client),
    transactionValues,
  };
};

describe("GoogleSheetsTransactionRepository CRUD", () => {
  it("crea las dos filas firmadas de una transferencia en un único batch", async () => {
    const { batchUpdate, repository } = createHarness();
    batchUpdate.mockResolvedValue();

    const created = await repository.create(transferDraft, actor);

    expect(created).toMatchObject({ kind: "transfer", amount: 470, version: 1 });
    expect(batchUpdate).toHaveBeenCalledOnce();
    const requests = batchUpdate.mock.calls[0]?.[0] ?? [];
    const append = requests.find((request) => "appendCells" in request);
    if (!append || !("appendCells" in append)) throw new Error("No se generó appendCells.");
    expect(append.appendCells.rows).toHaveLength(2);
    const amountIndex = header.indexOf("Monto");
    expect(append.appendCells.rows.map((row) => enteredValue(row.values[amountIndex]!))).toEqual([
      -470, 470,
    ]);
  });

  it("crea un proveedor rápido en Terceros junto con la transacción", async () => {
    const { batchUpdate, repository } = createHarness();
    batchUpdate.mockResolvedValue();

    await repository.create(
      {
        ...expenseDraft,
        thirdParty: pick("new-imprenta-local", "Imprenta Local"),
      },
      actor,
    );

    const requests = batchUpdate.mock.calls[0]?.[0] ?? [];
    const catalogAppend = requests.find(
      (request) => "appendCells" in request && request.appendCells.sheetId !== 7,
    );
    if (!catalogAppend || !("appendCells" in catalogAppend)) {
      throw new Error("No se generó el alta rápida en Terceros.");
    }
    expect(catalogAppend.appendCells.rows).toHaveLength(1);
    expect(catalogAppend.appendCells.rows[0]!.values.map(enteredValue)).toEqual([
      expect.any(String),
      "Imprenta Local",
      "PROVEEDOR",
      true,
    ]);
    expect(batchUpdate).toHaveBeenCalledOnce();
  });

  it("rechaza una versión obsoleta antes de enviar el batch", async () => {
    const { batchUpdate, repository } = createHarness([
      transactionRow({ ID: "E-1", "Id Transaccion": "E-1", Versión: 2 }),
    ]);

    await expect(repository.update("E-1", 1, expenseDraft, actor)).rejects.toMatchObject({
      name: "TransactionConflictError",
    });
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it.each([
    new GoogleSheetsError("timeout", null, true),
    new GoogleSheetsError("rate limit", 429, true),
  ])("verifica el ID antes de reintentar una escritura incierta", async (uncertainError) => {
    const { batchUpdate, repository, transactionValues } = createHarness();
    batchUpdate.mockImplementationOnce(async (requests) => {
      const append = requests.find((request) => "appendCells" in request);
      if (!append || !("appendCells" in append)) throw new Error("No se generó appendCells.");
      append.appendCells.rows.forEach((row) => {
        transactionValues.push(row.values.map(enteredValue));
      });
      throw uncertainError;
    });

    const created = await repository.create(expenseDraft, actor);

    expect(created.description).toBe("Compra de materiales");
    expect(batchUpdate).toHaveBeenCalledOnce();
  });

  it("enlaza ambos lados de una corrección de tipo dentro del mismo batch", async () => {
    const { batchUpdate, repository } = createHarness([
      transactionRow({
        ID: "E-1",
        "Id Transaccion": "E-1",
        "Tipo Transacción": "Egreso",
        Cuenta: "Caja chica",
        Categoría: "Materiales",
        "Método de Pago": "Tarjeta",
        Monto: -257,
        Versión: 1,
      }),
    ]);
    batchUpdate.mockResolvedValue();

    const correction = await repository.update("E-1", 1, transferDraft, actor);

    expect(correction.audit.correctsTransactionId).toBe("E-1");
    expect(batchUpdate).toHaveBeenCalledOnce();
    const requests = batchUpdate.mock.calls[0]?.[0] ?? [];
    const append = requests.find((request) => "appendCells" in request);
    if (!append || !("appendCells" in append)) throw new Error("No se generó appendCells.");
    expect(append.appendCells.rows).toHaveLength(2);
    const logicalIdIndex = header.indexOf("Id Transaccion");
    const correctionId = enteredValue(append.appendCells.rows[0]!.values[logicalIdIndex]!);
    expect(correctionId).toBe(correction.transactionId);
    const correctedByIndex = header.indexOf("Corregida Por");
    const reverseLink = requests.find(
      (request) =>
        "updateCells" in request && request.updateCells.range.startColumnIndex === correctedByIndex,
    );
    if (!reverseLink || !("updateCells" in reverseLink)) {
      throw new Error("No se actualizó Corregida Por.");
    }
    expect(enteredValue(reverseLink.updateCells.rows[0]!.values[0]!)).toBe(correctionId);
  });

  it("convierte un 403 de escritura en una capacidad no disponible", async () => {
    const { batchUpdate, repository } = createHarness();
    batchUpdate.mockRejectedValue(new GoogleSheetsError("forbidden", 403, false));

    await expect(repository.create(expenseDraft, actor)).rejects.toMatchObject({
      name: "TransactionWriteUnavailableError",
      message: "Tu cuenta puede consultar esta hoja, pero no editarla. Solicita acceso de Editor.",
    });
  });
});
