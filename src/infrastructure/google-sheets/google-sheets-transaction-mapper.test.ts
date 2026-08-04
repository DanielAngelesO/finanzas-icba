import { describe, expect, it } from "vitest";
import { GoogleSheetsTransactionMapper } from "./google-sheets-transaction-mapper";
import { header, sheetConfig, transactionRow } from "../../test/fixtures";

describe("GoogleSheetsTransactionMapper", () => {
  it("mapea las 15 columnas y convierte valores opcionales vacíos a null", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      transactionRow({ Descripción: "" }),
    ]);
    expect(result.validTransactionCount).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      id: "TX-001",
      type: "INGRESO",
      amount: 1250.5,
      description: null,
      notes: null,
      period: "202608",
    });
  });

  it("tolera el reordenamiento de encabezados", () => {
    const reversedHeader = [...header].reverse();
    const row = transactionRow();
    const valuesByHeader = new Map(header.map((column, index) => [column, row[index]]));
    const reversedRow = reversedHeader.map((column) => valuesByHeader.get(column) ?? null);
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      reversedHeader,
      reversedRow,
    ]);
    expect(result.transactions[0]?.description).toBe("Ofrenda dominical");
  });

  it("detecta columnas obligatorias faltantes", () => {
    const withoutAmount = header.filter((column) => column !== "Monto");
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      withoutAmount,
      transactionRow().slice(0, -1),
    ]);
    expect(result.missingColumns).toContain("Monto");
    expect(result.validTransactionCount).toBe(0);
  });

  it("acepta fechas DD/MM/YYYY, YYYY-MM-DD y rechaza fechas inválidas", () => {
    const mapper = new GoogleSheetsTransactionMapper(sheetConfig);
    const valid = mapper.map([header, transactionRow({ Fecha: "2026-08-04" })]);
    const invalid = mapper.map([header, transactionRow({ Fecha: "31/02/2026" })]);
    expect(valid.transactions[0]?.date.toISOString()).toContain("2026-08-04");
    expect(invalid.issues.some((entry) => entry.code === "INVALID_DATE")).toBe(true);
  });

  it("normaliza monto con coma decimal, egresos y gasto", () => {
    const mapper = new GoogleSheetsTransactionMapper({ ...sheetConfig, decimalSeparator: "," });
    const result = mapper.map([
      header,
      transactionRow({ Monto: "S/ 1250,50", "Tipo Transacción": "Gasto" }),
    ]);
    expect(result.transactions[0]).toMatchObject({ type: "EGRESO", amount: 1250.5 });
  });

  it("deriva período vacío y excluye todos los IDs duplicados", () => {
    const mapper = new GoogleSheetsTransactionMapper(sheetConfig);
    const result = mapper.map([
      header,
      transactionRow({ Período: "" }),
      transactionRow({ Descripción: "Registro repetido" }),
    ]);
    expect(result.transactions).toHaveLength(0);
    expect(result.duplicateIds).toEqual(["TX-001"]);
    expect(result.issues.some((entry) => entry.code === "DERIVED_PERIOD")).toBe(true);
  });

  it("rechaza un tipo no reconocido", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      transactionRow({ "Tipo Transacción": "Transferencia" }),
    ]);
    expect(result.issues.some((entry) => entry.code === "INVALID_TYPE")).toBe(true);
  });
});
