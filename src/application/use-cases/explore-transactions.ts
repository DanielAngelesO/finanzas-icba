import type {
  LogicalTransaction,
  TransactionStatus,
  TransactionType,
} from "../../domain/transaction";
import { getTransactionStatusLabel } from "../../domain/transaction";

export const transactionSorts = ["date-desc", "date-asc", "amount-desc", "amount-asc"] as const;
export type TransactionSort = (typeof transactionSorts)[number];

export const transactionPageSizes = [30, 60, 90] as const;
export type TransactionPageSize = number;

export interface TransactionExplorerCriteria {
  search: string;
  period: string | null;
  type: TransactionType | null;
  dateFrom: string | null;
  dateTo: string | null;
  account: string | null;
  category: string | null;
  status: TransactionStatus | null;
  sort: TransactionSort;
  page: number;
  pageSize: TransactionPageSize;
}

export interface TransactionFacets {
  periods: string[];
  accounts: string[];
  categories: string[];
  statuses: TransactionStatus[];
}

export interface TransactionExplorerResult {
  transactions: LogicalTransaction[];
  total: number;
  page: number;
  pageSize: TransactionPageSize;
  totalPages: number;
  facets: TransactionFacets;
}

export const defaultTransactionExplorerCriteria: TransactionExplorerCriteria = {
  search: "",
  period: null,
  type: null,
  dateFrom: null,
  dateTo: null,
  account: null,
  category: null,
  status: null,
  sort: "date-desc",
  page: 1,
  pageSize: 30,
};

const collator = new Intl.Collator("es-PE", { sensitivity: "base", numeric: true });

const normalizeSearchText = (value: string): string =>
  value
    .replace(/s\s*\//gi, " ")
    .replace(/(\d)[.,](?=\d{3}(?:\D|$))/g, "$1")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const sortTextValues = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort(collator.compare);

const getAccounts = (transaction: LogicalTransaction): string[] =>
  transaction.kind === "transfer"
    ? [transaction.originAccount, transaction.destinationAccount]
    : [transaction.account];

const getSearchValues = (transaction: LogicalTransaction): string[] => {
  const common = [
    transaction.transactionId,
    ...transaction.rowIds,
    transaction.description,
    transaction.responsible,
    transaction.notes,
    transaction.amount.toFixed(2),
    transaction.amount.toLocaleString("es-PE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }),
    getTransactionStatusLabel(transaction.status),
  ].filter((value): value is string => value !== null);
  if (transaction.kind === "transfer") {
    return [...common, transaction.originAccount, transaction.destinationAccount];
  }
  return [
    ...common,
    transaction.account,
    transaction.category,
    transaction.subcategory,
    transaction.donorOrProvider,
    transaction.paymentMethod,
    transaction.referenceOrReceipt,
  ].filter((value): value is string => value !== null);
};

const getFacets = (transactions: LogicalTransaction[]): TransactionFacets => ({
  periods: [...new Set(transactions.map((transaction) => transaction.period))].sort((left, right) =>
    right.localeCompare(left),
  ),
  accounts: sortTextValues(transactions.flatMap(getAccounts)),
  categories: sortTextValues(
    transactions.flatMap((transaction) =>
      transaction.kind === "single" ? [transaction.category] : [],
    ),
  ),
  statuses: [...new Set(transactions.map((transaction) => transaction.status))].sort(
    collator.compare,
  ),
});

const matchesSearch = (transaction: LogicalTransaction, search: string): boolean => {
  const tokens = normalizeSearchText(search).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(getSearchValues(transaction).join(" "));
  return tokens.every((token) => haystack.includes(token));
};

const compareByDateDescendingThenId = (
  left: LogicalTransaction,
  right: LogicalTransaction,
): number =>
  right.date.getTime() - left.date.getTime() ||
  collator.compare(left.transactionId, right.transactionId);

const compareTransactions =
  (sort: TransactionSort) =>
  (left: LogicalTransaction, right: LogicalTransaction): number => {
    switch (sort) {
      case "date-desc":
        return compareByDateDescendingThenId(left, right);
      case "date-asc":
        return (
          left.date.getTime() - right.date.getTime() ||
          collator.compare(left.transactionId, right.transactionId)
        );
      case "amount-desc":
        return right.amount - left.amount || compareByDateDescendingThenId(left, right);
      case "amount-asc":
        return left.amount - right.amount || compareByDateDescendingThenId(left, right);
    }
  };

const matchesCriteria = (
  transaction: LogicalTransaction,
  criteria: TransactionExplorerCriteria,
): boolean => {
  const transactionDate = dateKey(transaction.date);
  const accounts = getAccounts(transaction);
  return (
    matchesSearch(transaction, criteria.search) &&
    (!criteria.period || transaction.period === criteria.period) &&
    (!criteria.type || transaction.type === criteria.type) &&
    (!criteria.dateFrom || transactionDate >= criteria.dateFrom) &&
    (!criteria.dateTo || transactionDate <= criteria.dateTo) &&
    (!criteria.account || accounts.includes(criteria.account)) &&
    (!criteria.category ||
      (transaction.kind === "single" && transaction.category === criteria.category)) &&
    (!criteria.status || transaction.status === criteria.status)
  );
};

export const exploreTransactions = (
  transactions: LogicalTransaction[],
  criteria: TransactionExplorerCriteria,
): TransactionExplorerResult => {
  const matched = transactions.filter((transaction) => matchesCriteria(transaction, criteria));
  const sorted = [...matched].sort(compareTransactions(criteria.sort));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / criteria.pageSize));
  const page = Math.min(Math.max(1, Math.trunc(criteria.page)), totalPages);
  const start = (page - 1) * criteria.pageSize;

  return {
    transactions: sorted.slice(start, start + criteria.pageSize),
    total,
    page,
    pageSize: criteria.pageSize,
    totalPages,
    facets: getFacets(transactions),
  };
};
