import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import type {
  TransactionInspectionResult,
  TransactionValidationIssue,
} from "../../domain/diagnostics";
import {
  transactionSchema,
  type Transaction,
  type TransactionType,
} from "../../domain/transaction";
import type { GoogleCell } from "./google-sheets-client";

const requiredKeys = [
  "id",
  "date",
  "type",
  "account",
  "category",
  "responsible",
  "paymentMethod",
  "amount",
  "status",
  "period",
] as const;

const optionalKeys = [
  "subcategory",
  "description",
  "donorOrProvider",
  "referenceOrReceipt",
  "notes",
] as const;
type MappingKey = keyof GoogleSheetsDataSourceConfig["columnMapping"];

interface Candidate {
  transaction: Transaction;
  issues: TransactionValidationIssue[];
}

const normalizeHeader = (value: GoogleCell | undefined): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

const normalizeText = (value: GoogleCell | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const isRealRow = (row: GoogleCell[]): boolean => row.some((cell) => normalizeText(cell) !== null);

const issue = (
  code: TransactionValidationIssue["code"],
  severity: TransactionValidationIssue["severity"],
  message: string,
  rowNumber: number | null,
  field: string | null,
): TransactionValidationIssue => ({ code, severity, message, rowNumber, field });

const toLimaDate = (year: number, month: number, day: number): Date | null => {
  const date = new Date(Date.UTC(year, month - 1, day, 5));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
};

const parseDate = (value: GoogleCell | undefined): Date | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.round((value - 25569) * 86_400_000);
    const serialDate = new Date(milliseconds);
    return toLimaDate(
      serialDate.getUTCFullYear(),
      serialDate.getUTCMonth() + 1,
      serialDate.getUTCDate(),
    );
  }
  const text = normalizeText(value);
  if (!text) return null;
  const peruvian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (peruvian) return toLimaDate(Number(peruvian[3]), Number(peruvian[2]), Number(peruvian[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return iso ? toLimaDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
};

const parseType = (value: GoogleCell | undefined): TransactionType | null => {
  const normalized = normalizeText(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (normalized === "INGRESO") return "INGRESO";
  if (normalized === "EGRESO" || normalized === "GASTO") return "EGRESO";
  return null;
};

const parseAmount = (value: GoogleCell | undefined, decimalSeparator: "." | ","): number | null => {
  if (typeof value === "number")
    return Number.isFinite(value) && value !== 0 ? Math.abs(value) : null;
  const text = normalizeText(value);
  if (!text) return null;
  const cleaned = text.replace(/^S\/\s*/i, "").replace(/\s/g, "");
  const normalized =
    decimalSeparator === "."
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount !== 0 ? Math.abs(amount) : null;
};

const derivePeriod = (date: Date): string =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export class GoogleSheetsTransactionMapper {
  public constructor(private readonly config: GoogleSheetsDataSourceConfig) {}

  public map(values: GoogleCell[][], latencyMs = 0): TransactionInspectionResult {
    const inspectedAt = new Date();
    const header = values[this.config.headerRow - 1] ?? [];
    const headerIndexes = new Map<string, number>();
    header.forEach((cell, index) => headerIndexes.set(normalizeHeader(cell), index));
    const columnIndexes = new Map<MappingKey, number>();
    const issues: TransactionValidationIssue[] = [];
    const missingColumns: string[] = [];

    (Object.keys(this.config.columnMapping) as MappingKey[]).forEach((key) => {
      const expected = this.config.columnMapping[key];
      const index = headerIndexes.get(normalizeHeader(expected));
      if (index !== undefined) columnIndexes.set(key, index);
    });
    requiredKeys.forEach((key) => {
      if (!columnIndexes.has(key)) {
        const name = this.config.columnMapping[key];
        missingColumns.push(name);
        issues.push(
          issue(
            "MISSING_REQUIRED_COLUMN",
            "error",
            `Falta la columna obligatoria: ${name}.`,
            null,
            name,
          ),
        );
      }
    });
    optionalKeys.forEach((key) => {
      if (!columnIndexes.has(key)) {
        const name = this.config.columnMapping[key];
        issues.push(
          issue(
            "MISSING_OPTIONAL_COLUMN",
            "warning",
            `No existe la columna opcional: ${name}.`,
            null,
            name,
          ),
        );
      }
    });

    const dataRows = values.slice(this.config.firstDataRow - 1).filter(isRealRow);
    if (missingColumns.length > 0) {
      return {
        transactions: [],
        issues,
        missingColumns,
        duplicateIds: [],
        totalDataRowCount: dataRows.length,
        validTransactionCount: 0,
        invalidTransactionCount: dataRows.length,
        latencyMs,
        inspectedAt,
      };
    }

    const rawIdCounts = new Map<string, number>();
    values.slice(this.config.firstDataRow - 1).forEach((row) => {
      if (!isRealRow(row)) return;
      const idColumn = columnIndexes.get("id");
      const id = idColumn === undefined ? null : normalizeText(row[idColumn]);
      if (id) rawIdCounts.set(id, (rawIdCounts.get(id) ?? 0) + 1);
    });
    const duplicateIds = [...rawIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    const candidates: Candidate[] = [];
    let invalidTransactionCount = 0;
    values.slice(this.config.firstDataRow - 1).forEach((row, index) => {
      if (!isRealRow(row)) return;
      const rowNumber = this.config.firstDataRow + index;
      const read = (key: MappingKey): GoogleCell | undefined => {
        const columnIndex = columnIndexes.get(key);
        return columnIndex === undefined ? undefined : row[columnIndex];
      };
      const rowIssues: TransactionValidationIssue[] = [];
      const id = normalizeText(read("id"));
      const date = parseDate(read("date"));
      const type = parseType(read("type"));
      const amountCell = read("amount");
      const amount = parseAmount(amountCell, this.config.decimalSeparator);
      const periodValue = normalizeText(read("period"));
      const period =
        periodValue && /^\d{6}$/.test(periodValue) ? periodValue : date ? derivePeriod(date) : null;

      if (!id)
        rowIssues.push(issue("INVALID_ID", "error", "El ID es obligatorio.", rowNumber, "ID"));
      if (id && duplicateIds.includes(id)) {
        rowIssues.push(
          issue(
            "DUPLICATE_ID",
            "error",
            "El ID aparece más de una vez y se excluyó.",
            rowNumber,
            "ID",
          ),
        );
      }
      if (!date)
        rowIssues.push(
          issue(
            "INVALID_DATE",
            "error",
            "La fecha debe usar DD/MM/YYYY, YYYY-MM-DD o una fecha nativa.",
            rowNumber,
            "Fecha",
          ),
        );
      if (!type)
        rowIssues.push(
          issue(
            "INVALID_TYPE",
            "error",
            "El tipo debe ser ingreso, egreso o gasto.",
            rowNumber,
            "Tipo Transacción",
          ),
        );
      if (!amount)
        rowIssues.push(
          issue(
            "INVALID_AMOUNT",
            "error",
            "El monto debe ser un número distinto de cero.",
            rowNumber,
            "Monto",
          ),
        );
      if (periodValue && !/^\d{6}$/.test(periodValue)) {
        rowIssues.push(
          issue(
            "INVALID_PERIOD",
            "error",
            "El período debe tener formato YYYYMM.",
            rowNumber,
            "Período",
          ),
        );
      }
      if (!periodValue && date) {
        rowIssues.push(
          issue(
            "DERIVED_PERIOD",
            "warning",
            "El período se derivó de la fecha.",
            rowNumber,
            "Período",
          ),
        );
      }
      if (typeof amountCell === "number" && type) {
        if ((type === "EGRESO" && amountCell > 0) || (type === "INGRESO" && amountCell < 0)) {
          rowIssues.push(
            issue(
              "SIGN_CONVENTION",
              "warning",
              "El signo no coincide con la convención de la hoja.",
              rowNumber,
              "Monto",
            ),
          );
        }
      }

      const requiredTexts: Array<[MappingKey, string]> = [
        ["account", "Cuenta"],
        ["category", "Categoría"],
        ["responsible", "Responsable"],
        ["paymentMethod", "Método de Pago"],
        ["status", "Estado"],
      ];
      requiredTexts.forEach(([key, label]) => {
        if (!normalizeText(read(key))) {
          rowIssues.push(
            issue("INVALID_REQUIRED_VALUE", "error", `${label} es obligatorio.`, rowNumber, label),
          );
        }
      });
      if (
        rowIssues.some((entry) => entry.severity === "error") ||
        !id ||
        !date ||
        !type ||
        !amount ||
        !period
      ) {
        issues.push(...rowIssues);
        invalidTransactionCount += 1;
        return;
      }
      const parsed = transactionSchema.safeParse({
        id,
        date,
        type,
        account: normalizeText(read("account")),
        category: normalizeText(read("category")),
        subcategory: normalizeText(read("subcategory")),
        description: normalizeText(read("description")),
        responsible: normalizeText(read("responsible")),
        donorOrProvider: normalizeText(read("donorOrProvider")),
        paymentMethod: normalizeText(read("paymentMethod")),
        referenceOrReceipt: normalizeText(read("referenceOrReceipt")),
        amount,
        status: normalizeText(read("status")),
        period,
        notes: normalizeText(read("notes")),
      });
      if (!parsed.success) {
        issues.push(
          issue(
            "INVALID_REQUIRED_VALUE",
            "error",
            "La fila no cumple el modelo de transacción.",
            rowNumber,
            null,
          ),
        );
        invalidTransactionCount += 1;
        return;
      }
      candidates.push({ transaction: parsed.data, issues: rowIssues });
    });

    const transactions: Transaction[] = [];
    candidates.forEach((candidate) => {
      issues.push(...candidate.issues);
      transactions.push(candidate.transaction);
    });

    return {
      transactions,
      issues,
      missingColumns,
      duplicateIds,
      totalDataRowCount: dataRows.length,
      validTransactionCount: transactions.length,
      invalidTransactionCount,
      latencyMs,
      inspectedAt,
    };
  }
}
