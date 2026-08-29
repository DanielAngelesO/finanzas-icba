import { getIncomeGroup } from "../../../domain/income-groups";
import type {
  LogicalTransaction,
  TransactionDraft,
  TransactionType,
} from "../../../domain/transaction";
import { formatPreviewDate } from "../../formatters";

export const getTransactionTypeLabel = (type: TransactionType): string => {
  if (type === "INGRESO") return "Ingreso";
  if (type === "EGRESO") return "Egreso";
  return "Transferencia";
};

export const getTransactionConcept = (transaction: LogicalTransaction): string =>
  transaction.description ??
  (transaction.kind === "transfer" ? "Transferencia entre cuentas" : transaction.category);

export interface TransactionPreviewParts {
  category: string | null;
  donor: string | null;
  offeringDate: string | null;
}

export const getTransactionPreviewParts = (
  transaction: LogicalTransaction,
): TransactionPreviewParts => {
  if (transaction.kind !== "single") {
    return { category: null, donor: null, offeringDate: null };
  }
  const concept = getTransactionConcept(transaction);
  const category = concept === transaction.category ? null : transaction.category;
  const incomeGroup = getIncomeGroup(transaction);
  const donor =
    incomeGroup === "DIEZMOS" ? transaction.donorOrProvider?.trim() || null : null;
  const offeringDate =
    incomeGroup === "OFRENDAS" ? formatPreviewDate(transaction.date) : null;
  return { category, donor, offeringDate };
};

export const getTransactionAccountsLabel = (transaction: LogicalTransaction): string =>
  transaction.kind === "transfer"
    ? `${transaction.originAccount} → ${transaction.destinationAccount}`
    : transaction.account;

export const getTransactionTypeIcon = (type: TransactionType): string => {
  if (type === "INGRESO") return "↑";
  if (type === "EGRESO") return "↓";
  return "↔";
};

export const getTransactionTypeClass = (type: TransactionType): string => {
  if (type === "INGRESO") return "type-ingreso";
  if (type === "EGRESO") return "type-egreso";
  return "type-transferencia";
};

export const getAmountClass = (transaction: LogicalTransaction): string => {
  if (transaction.status === "VOIDED" || transaction.type === "TRANSFERENCIA") {
    return "amount-neutral";
  }
  return transaction.type === "INGRESO" ? "amount-positive" : "amount-negative";
};

export const getAmountPrefix = (transaction: LogicalTransaction): string => {
  if (transaction.status === "VOIDED" || transaction.type === "TRANSFERENCIA") return "";
  return transaction.type === "INGRESO" ? "+" : "−";
};

export const toDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const getLimaToday = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (part: "year" | "month" | "day"): string =>
    parts.find((entry) => entry.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export const getCurrentLimaPeriod = (): string => getLimaToday().replace("-", "").slice(0, 6);

export const getDraftFinancialSummary = (
  current: LogicalTransaction,
  draft: TransactionDraft,
): string[] => {
  const changes: string[] = [];
  if (current.type !== draft.type) {
    changes.push(
      `${getTransactionTypeLabel(current.type)} → ${getTransactionTypeLabel(draft.type)}`,
    );
  }
  if (current.amount !== draft.amount) {
    changes.push(`Monto: S/ ${current.amount.toFixed(2)} → S/ ${draft.amount.toFixed(2)}`);
  }
  const currentDate = toDateInputValue(current.date);
  const nextDate = toDateInputValue(draft.date);
  if (currentDate !== nextDate) changes.push(`Fecha: ${currentDate} → ${nextDate}`);
  if (current.kind === "transfer" && draft.type === "TRANSFERENCIA") {
    if (current.originAccount !== draft.originAccount.name) {
      changes.push(`Desde: ${current.originAccount} → ${draft.originAccount.name}`);
    }
    if (current.destinationAccount !== draft.destinationAccount.name) {
      changes.push(`Hacia: ${current.destinationAccount} → ${draft.destinationAccount.name}`);
    }
  } else if (current.kind === "single" && draft.type !== "TRANSFERENCIA") {
    if (current.account !== draft.account.name) {
      changes.push(`Cuenta: ${current.account} → ${draft.account.name}`);
    }
  } else if (current.kind === "single" && draft.type === "TRANSFERENCIA") {
    changes.push(
      `Cuenta: ${current.account} → ${draft.originAccount.name} → ${draft.destinationAccount.name}`,
    );
  } else if (current.kind === "transfer" && draft.type !== "TRANSFERENCIA") {
    changes.push(
      `Cuentas: ${current.originAccount} → ${current.destinationAccount} → ${draft.account.name}`,
    );
  }
  return changes;
};
