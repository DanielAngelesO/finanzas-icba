import type {
  GoogleSheetsDataSourceConfig,
  TransactionColumnMapping,
} from "../../config/google-sheets";
import type { Transaction } from "../../domain/transaction";
import type { GoogleCell, GoogleCellData, GoogleSheetsBatchRequest } from "./google-sheets-client";

type MappingKey = keyof TransactionColumnMapping;

export interface TransactionSheetStructure {
  sheetId: number;
  header: GoogleCell[];
  columnIndexes: ReadonlyMap<MappingKey, number>;
}

const normalizeHeader = (value: GoogleCell | undefined): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");

export const inspectTransactionSheetStructure = (
  values: GoogleCell[][],
  config: GoogleSheetsDataSourceConfig,
  sheetId: number,
): { structure: TransactionSheetStructure | null; missingColumns: string[] } => {
  const header = values[config.headerRow - 1] ?? [];
  const headerIndexes = new Map<string, number>();
  header.forEach((cell, index) => headerIndexes.set(normalizeHeader(cell), index));
  const columnIndexes = new Map<MappingKey, number>();
  const missingColumns: string[] = [];
  const keys = Object.keys(config.columnMapping) as MappingKey[];
  keys.forEach((key) => {
    const expected = config.columnMapping[key];
    const index = headerIndexes.get(normalizeHeader(expected));
    if (index === undefined) missingColumns.push(expected);
    else columnIndexes.set(key, index);
  });
  return {
    structure: missingColumns.length === 0 ? { sheetId, header, columnIndexes } : null,
    missingColumns,
  };
};

const formatSheetDate = (date: Date): string =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const formatAuditDate = (date: Date | null): string => date?.toISOString() ?? "";

const getSheetStatus = (transaction: Transaction): string => {
  if (transaction.status === "CONFIRMED") return "Confirmado";
  if (transaction.status === "PENDING") return "Pendiente";
  return "Anulado";
};

const getSheetType = (transaction: Transaction): string => {
  if (transaction.type === "INGRESO") return "Ingreso";
  if (transaction.type === "EGRESO") return "Egreso";
  return "Transferencia";
};

const toColumnValues = (transaction: Transaction): Record<MappingKey, GoogleCell> => ({
  id: transaction.id,
  date: formatSheetDate(transaction.date),
  type: getSheetType(transaction),
  transactionId: transaction.transactionId,
  account: transaction.account,
  category: transaction.category,
  subcategory: transaction.subcategory,
  description: transaction.description,
  responsible: transaction.responsible,
  donorOrProvider: transaction.donorOrProvider,
  paymentMethod: transaction.paymentMethod,
  referenceOrReceipt: transaction.referenceOrReceipt,
  amount: transaction.accountFlow === "OUTFLOW" ? -transaction.amount : transaction.amount,
  status: getSheetStatus(transaction),
  period: transaction.period,
  notes: transaction.notes,
  createdAt: formatAuditDate(transaction.createdAt),
  createdBy: transaction.createdBy,
  updatedAt: formatAuditDate(transaction.updatedAt),
  updatedBy: transaction.updatedBy,
  version: transaction.version,
  voidedAt: formatAuditDate(transaction.voidedAt),
  voidedBy: transaction.voidedBy,
  voidReason: transaction.voidReason,
  correctsTransactionId: transaction.correctsTransactionId,
  correctedBy: transaction.correctedBy,
});

const toCellData = (value: GoogleCell | undefined): GoogleCellData => {
  if (typeof value === "number") return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: value === null || value === undefined ? "" : value } };
};

export const buildCatalogAppendRequest = (
  sheetId: number,
  header: GoogleCell[],
  valuesByHeader: Readonly<Record<string, GoogleCell>>,
): GoogleSheetsBatchRequest => ({
  appendCells: {
    sheetId,
    rows: [
      {
        values: header.map((column) => toCellData(valuesByHeader[String(column).trim()] ?? "")),
      },
    ],
    fields: "userEnteredValue",
  },
});

export const buildCatalogCellUpdateRequest = (
  sheetId: number,
  rowNumber: number,
  columnIndex: number,
  value: GoogleCell,
): GoogleSheetsBatchRequest => ({
  updateCells: {
    range: {
      sheetId,
      startRowIndex: rowNumber - 1,
      endRowIndex: rowNumber,
      startColumnIndex: columnIndex,
      endColumnIndex: columnIndex + 1,
    },
    rows: [{ values: [toCellData(value)] }],
    fields: "userEnteredValue",
  },
});

export const buildAppendRequest = (
  rows: Transaction[],
  structure: TransactionSheetStructure,
): GoogleSheetsBatchRequest => ({
  appendCells: {
    sheetId: structure.sheetId,
    rows: rows.map((transaction) => {
      const values = Array.from({ length: structure.header.length }, () => toCellData(""));
      const columnValues = toColumnValues(transaction);
      structure.columnIndexes.forEach((columnIndex, key) => {
        values[columnIndex] = toCellData(columnValues[key]);
      });
      return { values };
    }),
    fields: "userEnteredValue",
  },
});

export const buildUpdateRequests = (
  rows: Transaction[],
  structure: TransactionSheetStructure,
): GoogleSheetsBatchRequest[] =>
  rows.flatMap((transaction) => {
    if (transaction.rowNumber === null) {
      throw new Error("No se puede actualizar una fila sin ubicación en Google Sheets.");
    }
    const rowNumber = transaction.rowNumber;
    const columnValues = toColumnValues(transaction);
    return [...structure.columnIndexes.entries()].map(([key, columnIndex]) => ({
      updateCells: {
        range: {
          sheetId: structure.sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
        rows: [{ values: [toCellData(columnValues[key])] }],
        fields: "userEnteredValue",
      },
    }));
  });
