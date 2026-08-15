import { describe, expect, it } from "vitest";
import { createPhysicalTransactionRows } from "../../domain/logical-transaction";
import { header, sheetConfig } from "../../test/fixtures";
import {
  buildAppendRequest,
  buildUpdateRequests,
  inspectTransactionSheetStructure,
} from "./google-sheets-transaction-writer";

const actor = { email: "tesoreria@icba.pe", displayName: "Tesorería" };
const pick = (id: string, name: string) => ({ id, name });

describe("payloads de escritura de Google Sheets", () => {
  it("genera un append atómico con las dos filas firmadas de una transferencia", () => {
    const result = inspectTransactionSheetStructure([header], sheetConfig, 42);
    if (!result.structure) throw new Error("No se preparó la estructura de prueba.");
    const rows = createPhysicalTransactionRows(
      {
        type: "TRANSFERENCIA",
        amount: 470,
        date: new Date("2026-08-14T12:00:00"),
        originAccount: pick("bank", "Cuenta corriente"),
        destinationAccount: pick("cash", "Caja chica"),
        description: "Reposición",
        notes: null,
        responsible: "Tesorería",
      },
      { actor, transactionId: "transfer-id", rowIds: ["out-id", "in-id"] },
    );

    const request = buildAppendRequest(rows, result.structure);
    if (!("appendCells" in request)) throw new Error("Se esperaba appendCells.");
    expect(request.appendCells.sheetId).toBe(42);
    expect(request.appendCells.rows).toHaveLength(2);
    const amountIndex = result.structure.columnIndexes.get("amount");
    const logicalIdIndex = result.structure.columnIndexes.get("transactionId");
    if (amountIndex === undefined || logicalIdIndex === undefined) {
      throw new Error("Faltan índices requeridos.");
    }
    expect(
      request.appendCells.rows.map((row) => row.values[amountIndex]?.userEnteredValue),
    ).toEqual([{ numberValue: -470 }, { numberValue: 470 }]);
    expect(
      request.appendCells.rows.map((row) => row.values[logicalIdIndex]?.userEnteredValue),
    ).toEqual([{ stringValue: "transfer-id" }, { stringValue: "transfer-id" }]);
  });

  it("actualiza ambas filas y todas las columnas dentro de un único batch", () => {
    const result = inspectTransactionSheetStructure([header], sheetConfig, 42);
    if (!result.structure) throw new Error("No se preparó la estructura de prueba.");
    const rows = createPhysicalTransactionRows(
      {
        type: "TRANSFERENCIA",
        amount: 100,
        date: new Date("2026-08-14T12:00:00"),
        originAccount: pick("bank", "Banco"),
        destinationAccount: pick("cash", "Caja"),
        description: null,
        notes: null,
        responsible: "Tesorería",
      },
      { actor, transactionId: "transfer-id", rowIds: ["out-id", "in-id"], version: 2 },
    ).map((row, index) => ({ ...row, rowNumber: index + 10 }));

    const requests = buildUpdateRequests(rows, result.structure);
    expect(requests).toHaveLength(header.length * 2);
    expect(requests.every((request) => "updateCells" in request)).toBe(true);
  });
});
