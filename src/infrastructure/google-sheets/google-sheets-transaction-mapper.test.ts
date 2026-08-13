import { describe, expect, it } from "vitest";
import { GoogleSheetsTransactionMapper } from "./google-sheets-transaction-mapper";
import { header, sheetConfig, transactionRow } from "../../test/fixtures";

const transferRows = (
  overrides: {
    destinationAccount?: string;
    destinationAmount?: string | number;
    destinationDate?: string;
    destinationId?: string;
    destinationPeriod?: string;
    originAccount?: string;
    originAmount?: string | number;
    originDate?: string;
    originId?: string;
    originPeriod?: string;
    transferId?: string;
  } = {},
) => [
  transactionRow({
    ID: overrides.originId ?? "TRANSFER-OUT",
    "Tipo Transacción": "Transferencia",
    "Id Transaccion": overrides.transferId ?? "TRANSFER-001",
    Fecha: overrides.originDate ?? "03/08/2026",
    Cuenta: overrides.originAccount ?? "Cuenta corriente",
    Categoría: "Transferencia interna",
    Descripción: "Traslado a caja chica",
    Monto: overrides.originAmount ?? -250.5,
    Período: overrides.originPeriod ?? "202608",
  }),
  transactionRow({
    ID: overrides.destinationId ?? "TRANSFER-IN",
    "Tipo Transacción": "Transferencia",
    "Id Transaccion": overrides.transferId ?? "TRANSFER-001",
    Fecha: overrides.destinationDate ?? "03/08/2026",
    Cuenta: overrides.destinationAccount ?? "Caja chica",
    Categoría: "Transferencia interna",
    Descripción: "Traslado desde cuenta corriente",
    Monto: overrides.destinationAmount ?? 250.5,
    Período: overrides.destinationPeriod ?? "202608",
  }),
];

const projectRowToHeader = (
  row: (string | number | null)[],
  targetHeader: string[],
): Array<string | number | null> => {
  const valuesByHeader = new Map(header.map((column, index) => [column, row[index] ?? null]));
  return targetHeader.map((column): string | number | null => valuesByHeader.get(column) ?? null);
};

describe("GoogleSheetsTransactionMapper", () => {
  it("mapea columnas y convierte valores opcionales vacíos a null", () => {
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
      transferId: null,
      accountFlow: "INFLOW",
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
    expect(result.transactions[0]).toMatchObject({
      type: "EGRESO",
      amount: 1250.5,
      accountFlow: "OUTFLOW",
    });
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

  it("acepta pares de transferencia numéricos y conserva su flujo por cuenta", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([header, ...transferRows()]);

    expect(result.validTransactionCount).toBe(2);
    expect(result.invalidTransactionCount).toBe(0);
    expect(result.transactions).toMatchObject([
      { id: "TRANSFER-OUT", type: "TRANSFERENCIA", accountFlow: "OUTFLOW", amount: 250.5 },
      { id: "TRANSFER-IN", type: "TRANSFERENCIA", accountFlow: "INFLOW", amount: 250.5 },
    ]);
  });

  it("acepta montos de transferencia en texto y normaliza el monto al centavo", () => {
    const result = new GoogleSheetsTransactionMapper({ ...sheetConfig, decimalSeparator: "," }).map(
      [header, ...transferRows({ originAmount: "S/ -250,50", destinationAmount: "S/ 250,50" })],
    );

    expect(result.transactions.map((transaction) => transaction.amount)).toEqual([250.5, 250.5]);
    expect(result.validTransactionCount).toBe(2);
  });

  it("permite fechas distintas cuando las dos filas pertenecen al mismo período", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      ...transferRows({ originDate: "03/08/2026", destinationDate: "24/08/2026" }),
    ]);

    expect(result.validTransactionCount).toBe(2);
    expect(result.issues.some((entry) => entry.code === "INVALID_TRANSFER_PAIR")).toBe(false);
  });

  it("mantiene hojas sin la columna Id Transaccion mientras no tengan transferencias", () => {
    const headerWithoutTransferId = header.filter((column) => column !== "Id Transaccion");
    const normalRow = projectRowToHeader(transactionRow(), headerWithoutTransferId);
    const transferRow = projectRowToHeader(transferRows()[0] ?? [], headerWithoutTransferId);
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      headerWithoutTransferId,
      normalRow,
      transferRow,
    ]);

    expect(result.validTransactionCount).toBe(1);
    expect(result.invalidTransactionCount).toBe(1);
    expect(result.issues.some((entry) => entry.code === "MISSING_TRANSFER_ID")).toBe(true);
    expect(result.issues.some((entry) => entry.code === "MISSING_OPTIONAL_COLUMN")).toBe(false);
  });

  it("excluye una transferencia sin su identificador compartido", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      ...transferRows({ transferId: "" }),
    ]);

    expect(result.transactions).toEqual([]);
    expect(result.invalidTransactionCount).toBe(2);
    expect(result.issues.filter((entry) => entry.code === "MISSING_TRANSFER_ID")).toHaveLength(2);
  });

  it("excluye una transferencia sin su contraparte", () => {
    const [origin] = transferRows();
    if (!origin) throw new Error("No se pudo preparar la transferencia de prueba.");
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([header, origin]);

    expect(result.transactions).toEqual([]);
    expect(result.invalidTransactionCount).toBe(1);
    expect(result.issues.some((entry) => entry.code === "INVALID_TRANSFER_PAIR")).toBe(true);
  });

  it.each([
    ["mantiene ambos flujos como entrada", { originAmount: 250.5 }],
    ["usa montos distintos", { destinationAmount: 250.51 }],
    ["usa la misma cuenta", { destinationAccount: "Cuenta corriente" }],
    ["mezcla períodos", { destinationPeriod: "202607" }],
  ])("excluye un par que %s", (_description, overrides) => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      ...transferRows(overrides),
    ]);

    expect(result.transactions).toEqual([]);
    expect(result.invalidTransactionCount).toBe(2);
    expect(result.issues.filter((entry) => entry.code === "INVALID_TRANSFER_PAIR")).toHaveLength(2);
  });

  it("excluye grupos de transferencia con más de dos filas", () => {
    const extraRow = transactionRow({
      ID: "TRANSFER-EXTRA",
      "Tipo Transacción": "Transferencia",
      "Id Transaccion": "TRANSFER-001",
      Cuenta: "Caja de misiones",
      Categoría: "Transferencia interna",
      Monto: 250.5,
    });
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      ...transferRows(),
      extraRow,
    ]);

    expect(result.transactions).toEqual([]);
    expect(result.invalidTransactionCount).toBe(3);
    expect(result.issues.filter((entry) => entry.code === "INVALID_TRANSFER_PAIR")).toHaveLength(3);
  });

  it("excluye el par si uno de sus IDs únicos se repite", () => {
    const [origin, destination] = transferRows({ destinationId: "TRANSFER-OUT" });
    if (!origin || !destination) throw new Error("No se pudo preparar el par de transferencia.");
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      origin,
      destination,
    ]);

    expect(result.transactions).toEqual([]);
    expect(result.duplicateIds).toEqual(["TRANSFER-OUT"]);
    expect(result.invalidTransactionCount).toBe(2);
  });

  it("rechaza un tipo no reconocido", () => {
    const result = new GoogleSheetsTransactionMapper(sheetConfig).map([
      header,
      transactionRow({ "Tipo Transacción": "Ajuste" }),
    ]);
    expect(result.issues.some((entry) => entry.code === "INVALID_TYPE")).toBe(true);
  });
});
