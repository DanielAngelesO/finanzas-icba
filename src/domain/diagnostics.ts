import type { Transaction } from "./transaction";

export type ConnectionStatus = "UNCONFIGURED" | "CONNECTING" | "CONNECTED" | "WARNING" | "ERROR";

export interface DataSourceConnectionResult {
  status: ConnectionStatus;
  message: string;
  latencyMs: number | null;
  checkedAt: Date;
}

export interface TransactionDataSourceMetadata {
  provider: "google-sheets" | "memory";
  spreadsheetIdMasked: string;
  spreadsheetTitle: string | null;
  sheetName: string;
  availableSheets: string[];
  headerRow: number;
  firstDataRow: number;
  timezone: string;
  locale: string;
  activeYear: number | null;
  readOnly: true;
}

export type ValidationSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "MISSING_REQUIRED_COLUMN"
  | "MISSING_OPTIONAL_COLUMN"
  | "INVALID_ID"
  | "DUPLICATE_ID"
  | "INVALID_DATE"
  | "INVALID_TYPE"
  | "INVALID_AMOUNT"
  | "INVALID_PERIOD"
  | "DERIVED_PERIOD"
  | "SIGN_CONVENTION"
  | "MISSING_TRANSFER_ID"
  | "INVALID_TRANSFER_PAIR"
  | "INVALID_REQUIRED_VALUE";

export interface TransactionValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  rowNumber: number | null;
  field: string | null;
}

export interface TransactionInspectionResult {
  transactions: Transaction[];
  issues: TransactionValidationIssue[];
  missingColumns: string[];
  duplicateIds: string[];
  totalDataRowCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
  latencyMs: number;
  inspectedAt: Date;
}
