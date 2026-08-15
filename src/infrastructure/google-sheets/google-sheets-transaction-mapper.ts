import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import type {
  TransactionInspectionResult,
  TransactionValidationIssue,
} from "../../domain/diagnostics";
import {
  transactionSchema,
  type AccountFlow,
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
  account: string | null;
  accountFlow: AccountFlow | null;
  amount: number | null;
  issues: TransactionValidationIssue[];
  period: string | null;
  rowNumber: number;
  transaction: Transaction | null;
  transferId: string | null;
  type: TransactionType | null;
}

interface ParsedAmount {
  amount: number;
  rawAmount: number;
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
  if (normalized === "TRANSFERENCIA") return "TRANSFERENCIA";
  return null;
};

const parseStatus = (value: GoogleCell | undefined): Transaction["status"] | null => {
  const normalized = normalizeText(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "CONFIRMADO" || normalized === "CONFIRMADA") {
    return "CONFIRMED";
  }
  if (normalized === "PENDING" || normalized === "PENDIENTE") return "PENDING";
  if (
    normalized === "VOIDED" ||
    normalized === "ANULADO" ||
    normalized === "ANULADA" ||
    normalized === "CANCELADO" ||
    normalized === "CANCELADA"
  ) {
    return "VOIDED";
  }
  return null;
};

const parseAuditDate = (value: GoogleCell | undefined): Date | null => {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseVersion = (value: GoogleCell | undefined): number => {
  const numeric = typeof value === "number" ? value : Number(normalizeText(value));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
};

const parseAmount = (
  value: GoogleCell | undefined,
  decimalSeparator: "." | ",",
): ParsedAmount | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0
      ? { amount: Math.abs(value), rawAmount: value }
      : null;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const cleaned = text.replace(/^S\/\s*/i, "").replace(/\s/g, "");
  const normalized =
    decimalSeparator === "."
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const rawAmount = Number(normalized);
  return Number.isFinite(rawAmount) && rawAmount !== 0
    ? { amount: Math.abs(rawAmount), rawAmount }
    : null;
};

const derivePeriod = (date: Date): string =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const getAccountFlow = (type: TransactionType, rawAmount: number): AccountFlow => {
  if (type === "EGRESO") return "OUTFLOW";
  if (type === "INGRESO") return "INFLOW";
  return rawAmount < 0 ? "OUTFLOW" : "INFLOW";
};

const hasErrors = (issues: TransactionValidationIssue[]): boolean =>
  issues.some((entry) => entry.severity === "error");

const getAmountInCents = (amount: number): number => Math.round(amount * 100);

const addTransferPairIssue = (
  candidates: Candidate[],
  transferId: string,
  reason: string,
): void => {
  candidates.forEach((candidate) => {
    candidate.issues.push(
      issue(
        "INVALID_TRANSFER_PAIR",
        "error",
        `La transferencia ${transferId} no forma un par válido: ${reason}.`,
        candidate.rowNumber,
        "Id Transaccion",
      ),
    );
  });
};

const validateTransferPairs = (candidates: Candidate[]): void => {
  const byTransferId = new Map<string, Candidate[]>();

  candidates.forEach((candidate) => {
    if (candidate.type !== "TRANSFERENCIA") return;
    if (!candidate.transferId) {
      candidate.issues.push(
        issue(
          "MISSING_TRANSFER_ID",
          "error",
          "Las transferencias deben registrar Id Transaccion para vincular origen y destino.",
          candidate.rowNumber,
          "Id Transaccion",
        ),
      );
      return;
    }
    const group = byTransferId.get(candidate.transferId) ?? [];
    group.push(candidate);
    byTransferId.set(candidate.transferId, group);
  });

  byTransferId.forEach((group, transferId) => {
    if (group.length !== 2) {
      addTransferPairIssue(group, transferId, "debe contener exactamente dos filas");
      return;
    }

    const originOrDestination = group[0];
    const counterpart = group[1];
    if (!originOrDestination || !counterpart) return;

    if (hasErrors(originOrDestination.issues) || hasErrors(counterpart.issues)) {
      addTransferPairIssue(group, transferId, "una de sus filas contiene datos inválidos");
      return;
    }
    if (
      originOrDestination.accountFlow === null ||
      counterpart.accountFlow === null ||
      originOrDestination.accountFlow === counterpart.accountFlow
    ) {
      addTransferPairIssue(group, transferId, "requiere una salida y una entrada");
      return;
    }
    if (
      originOrDestination.amount === null ||
      counterpart.amount === null ||
      getAmountInCents(originOrDestination.amount) !== getAmountInCents(counterpart.amount)
    ) {
      addTransferPairIssue(group, transferId, "los montos deben coincidir al centavo");
      return;
    }
    if (
      !originOrDestination.account ||
      !counterpart.account ||
      originOrDestination.account === counterpart.account
    ) {
      addTransferPairIssue(group, transferId, "origen y destino deben ser cuentas distintas");
      return;
    }
    if (
      !originOrDestination.period ||
      !counterpart.period ||
      originOrDestination.period !== counterpart.period
    ) {
      addTransferPairIssue(group, transferId, "ambas filas deben pertenecer al mismo período");
    }
    if (
      originOrDestination.transaction?.status !== counterpart.transaction?.status ||
      originOrDestination.transaction?.version !== counterpart.transaction?.version
    ) {
      addTransferPairIssue(group, transferId, "ambas filas deben compartir estado y versión");
    }
  });
};

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
      const parsedAmount = parseAmount(amountCell, this.config.decimalSeparator);
      const periodValue = normalizeText(read("period"));
      const period =
        periodValue && /^\d{6}$/.test(periodValue) ? periodValue : date ? derivePeriod(date) : null;
      const account = normalizeText(read("account"));
      const category = normalizeText(read("category"));
      const responsible = normalizeText(read("responsible"));
      const paymentMethod = normalizeText(read("paymentMethod"));
      const status = parseStatus(read("status"));
      const logicalId = normalizeText(read("transactionId"));
      const transferId = type === "TRANSFERENCIA" ? logicalId : null;
      const accountFlow =
        type && parsedAmount ? getAccountFlow(type, parsedAmount.rawAmount) : null;

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
            "El tipo debe ser ingreso, egreso, gasto o transferencia.",
            rowNumber,
            "Tipo Transacción",
          ),
        );
      if (!parsedAmount)
        rowIssues.push(
          issue(
            "INVALID_AMOUNT",
            "error",
            "El monto debe ser un número distinto de cero.",
            rowNumber,
            "Monto",
          ),
        );
      if (!status) {
        rowIssues.push(
          issue(
            "INVALID_REQUIRED_VALUE",
            "error",
            "Estado debe ser confirmado, pendiente o anulado.",
            rowNumber,
            "Estado",
          ),
        );
      }
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
      if (typeof amountCell === "number" && type && type !== "TRANSFERENCIA") {
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

      const candidate: Candidate = {
        account,
        accountFlow,
        amount: parsedAmount?.amount ?? null,
        issues: rowIssues,
        period,
        rowNumber,
        transaction: null,
        transferId,
        type,
      };

      if (
        !hasErrors(rowIssues) &&
        id &&
        date &&
        type &&
        parsedAmount &&
        accountFlow &&
        account &&
        category &&
        responsible &&
        paymentMethod &&
        status &&
        period
      ) {
        const parsed = transactionSchema.safeParse({
          id,
          transactionId: logicalId ?? id,
          rowNumber,
          date,
          type,
          accountFlow,
          account,
          transferId,
          category,
          subcategory: normalizeText(read("subcategory")),
          description: normalizeText(read("description")),
          responsible,
          donorOrProvider: normalizeText(read("donorOrProvider")),
          paymentMethod,
          referenceOrReceipt: normalizeText(read("referenceOrReceipt")),
          amount: parsedAmount.amount,
          status,
          period,
          notes: normalizeText(read("notes")),
          version: parseVersion(read("version")),
          createdAt: parseAuditDate(read("createdAt")),
          createdBy: normalizeText(read("createdBy")),
          updatedAt: parseAuditDate(read("updatedAt")),
          updatedBy: normalizeText(read("updatedBy")),
          voidedAt: parseAuditDate(read("voidedAt")),
          voidedBy: normalizeText(read("voidedBy")),
          voidReason: normalizeText(read("voidReason")),
          correctsTransactionId: normalizeText(read("correctsTransactionId")),
          correctedBy: normalizeText(read("correctedBy")),
        });
        if (parsed.success) {
          candidate.transaction = parsed.data;
        } else {
          candidate.issues.push(
            issue(
              "INVALID_REQUIRED_VALUE",
              "error",
              "La fila no cumple el modelo de transacción.",
              rowNumber,
              null,
            ),
          );
        }
      }

      candidates.push(candidate);
    });

    validateTransferPairs(candidates);

    const transactions: Transaction[] = [];
    candidates.forEach((candidate) => {
      issues.push(...candidate.issues);
      if (candidate.transaction && !hasErrors(candidate.issues)) {
        transactions.push(candidate.transaction);
      }
    });
    const invalidTransactionCount = candidates.filter(
      (candidate) => !candidate.transaction || hasErrors(candidate.issues),
    ).length;

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
