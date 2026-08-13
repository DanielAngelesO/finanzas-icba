import type { GoogleSheetsDataSourceConfig } from "../config/google-sheets";
import type { Transaction } from "../domain/transaction";
import { transactionColumnMapping } from "../config/google-sheets";

export const sheetConfig: GoogleSheetsDataSourceConfig = {
  spreadsheetId: "spreadsheet-test-id",
  sheetName: "Transacciones",
  headerRow: 1,
  firstDataRow: 2,
  range: "A:Z",
  timezone: "America/Lima",
  locale: "es-PE",
  dateFormat: "DD/MM/YYYY",
  decimalSeparator: ".",
  activeYear: 2026,
  allowedEmails: ["tesorero@iglesia.org"],
  columnMapping: transactionColumnMapping,
};

export const header = Object.values(transactionColumnMapping);

export const transactionRow = (
  overrides: Record<string, string | number | null> = {},
): Array<string | number | null> => {
  const base: Record<string, string | number | null> = {
    ID: "TX-001",
    Fecha: "03/08/2026",
    "Tipo Transacción": "Ingreso",
    "Id Transaccion": "",
    Cuenta: "Caja",
    Categoría: "Ofrendas",
    Subcategoría: "General",
    Descripción: "Ofrenda dominical",
    Responsable: "Tesorería",
    "Donante / Proveedor": "Anónimo",
    "Método de Pago": "Efectivo",
    "Referencia / Comprobante": "REC-01",
    Monto: "S/ 1,250.50",
    Estado: "Confirmado",
    Período: "202608",
    Notas: "",
    ...overrides,
  };
  return header.map((column) => base[column] ?? null);
};

export const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => {
  const type = overrides.type ?? "INGRESO";
  const accountFlow = overrides.accountFlow ?? (type === "EGRESO" ? "OUTFLOW" : "INFLOW");

  return {
    id: "TX-001",
    date: new Date("2026-08-03T05:00:00.000Z"),
    type,
    accountFlow,
    account: "Caja",
    transferId: null,
    category: "Ofrendas",
    subcategory: null,
    description: "Ofrenda",
    responsible: "Tesorería",
    donorOrProvider: null,
    paymentMethod: "Efectivo",
    referenceOrReceipt: null,
    amount: 100,
    status: "Confirmado",
    period: "202608",
    notes: null,
    ...overrides,
  };
};
