import type { Transaction, TransactionType } from "../../domain/transaction";

export const transactionSorts = ["date-desc", "date-asc", "amount-desc", "amount-asc"] as const;

export type TransactionSort = (typeof transactionSorts)[number];

export const transactionPageSizes = [20, 50, 100] as const;

export type TransactionPageSize = (typeof transactionPageSizes)[number];

export interface TransactionExplorerCriteria {
  search: string;
  period: string | null;
  type: TransactionType | null;
  dateFrom: string | null;
  dateTo: string | null;
  account: string | null;
  category: string | null;
  status: string | null;
  sort: TransactionSort;
  page: number;
  pageSize: TransactionPageSize;
}

export interface TransactionFacets {
  periods: string[];
  accounts: string[];
  categories: string[];
  statuses: string[];
}

export interface TransactionExplorerResult {
  transactions: Transaction[];
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
  pageSize: 20,
};

const collator = new Intl.Collator("es-PE", { sensitivity: "base", numeric: true });

const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/\s+/g, " ")
    .trim();

const dateKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;

const sortTextValues = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort(collator.compare);

const getFacets = (transactions: Transaction[]): TransactionFacets => ({
  periods: [...new Set(transactions.map((transaction) => transaction.period))].sort((left, right) =>
    right.localeCompare(left),
  ),
  accounts: sortTextValues(transactions.map((transaction) => transaction.account)),
  categories: sortTextValues(transactions.map((transaction) => transaction.category)),
  statuses: sortTextValues(transactions.map((transaction) => transaction.status)),
});

const matchesSearch = (transaction: Transaction, search: string): boolean => {
  if (!search) return true;
  return [
    transaction.id,
    transaction.description,
    transaction.category,
    transaction.account,
    transaction.responsible,
    transaction.donorOrProvider,
    transaction.referenceOrReceipt,
  ].some((value) => value !== null && normalizeSearchText(value).includes(search));
};

const compareByDateDescendingThenId = (left: Transaction, right: Transaction): number =>
  right.date.getTime() - left.date.getTime() || collator.compare(left.id, right.id);

const compareTransactions =
  (sort: TransactionSort) =>
  (left: Transaction, right: Transaction): number => {
    switch (sort) {
      case "date-desc":
        return compareByDateDescendingThenId(left, right);
      case "date-asc":
        return left.date.getTime() - right.date.getTime() || collator.compare(left.id, right.id);
      case "amount-desc":
        return right.amount - left.amount || compareByDateDescendingThenId(left, right);
      case "amount-asc":
        return left.amount - right.amount || compareByDateDescendingThenId(left, right);
    }
  };

const matchesCriteria = (
  transaction: Transaction,
  criteria: TransactionExplorerCriteria,
): boolean => {
  const transactionDate = dateKey(transaction.date);
  return (
    matchesSearch(transaction, normalizeSearchText(criteria.search)) &&
    (!criteria.period || transaction.period === criteria.period) &&
    (!criteria.type || transaction.type === criteria.type) &&
    (!criteria.dateFrom || transactionDate >= criteria.dateFrom) &&
    (!criteria.dateTo || transactionDate <= criteria.dateTo) &&
    (!criteria.account || transaction.account === criteria.account) &&
    (!criteria.category || transaction.category === criteria.category) &&
    (!criteria.status || transaction.status === criteria.status)
  );
};

export const exploreTransactions = (
  transactions: Transaction[],
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
