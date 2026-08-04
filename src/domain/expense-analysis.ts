import type { Transaction } from "./transaction";

export const expenseSorts = ["date-desc", "date-asc", "amount-desc", "amount-asc"] as const;

export type ExpenseSort = (typeof expenseSorts)[number];

export const expensePageSizes = [20, 50, 100] as const;

export type ExpensePageSize = (typeof expensePageSizes)[number];

export const expenseReviewSignals = [
  "missing-reference",
  "cash-payment",
  "duplicate-reference",
] as const;

export type ExpenseReviewSignal = (typeof expenseReviewSignals)[number];

export interface ExpenseAnalysisFilters {
  fromPeriod: string | null;
  toPeriod: string | null;
  account: string | null;
  category: string | null;
  subcategory: string | null;
  provider: string | null;
  responsible: string | null;
  paymentMethod: string | null;
  status: string | null;
  excludeSalariesAndFees: boolean;
}

export interface ExpenseDetailCriteria {
  search: string;
  signal: ExpenseReviewSignal | null;
  sort: ExpenseSort;
  page: number;
  pageSize: ExpensePageSize;
}

export interface ExpenseAnalysisCriteria {
  analysis: ExpenseAnalysisFilters;
  detail: ExpenseDetailCriteria;
}

export const defaultExpenseAnalysisCriteria: ExpenseAnalysisCriteria = {
  analysis: {
    fromPeriod: null,
    toPeriod: null,
    account: null,
    category: null,
    subcategory: null,
    provider: null,
    responsible: null,
    paymentMethod: null,
    status: null,
    excludeSalariesAndFees: false,
  },
  detail: {
    search: "",
    signal: null,
    sort: "date-desc",
    page: 1,
    pageSize: 20,
  },
};

export interface ExpenseCapabilities {
  hasSubcategory: boolean;
  hasProvider: boolean;
  hasReferenceOrReceipt: boolean;
}

export interface ExpenseRange {
  fromPeriod: string;
  toPeriod: string;
  periods: string[];
  comparisonFromPeriod: string;
  comparisonToPeriod: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  transactionCount: number;
  averageMonthlyAmount: number;
  previousAmount: number;
  changeRate: number | null;
  salariesAndFeesAmount: number;
  salariesAndFeesShare: number;
  documentedAmount: number | null;
  documentedShare: number | null;
  leadingProvider: string | null;
  leadingProviderShare: number | null;
}

export interface ExpenseTrendPoint {
  period: string;
  comparisonPeriod: string;
  amount: number;
  comparisonAmount: number;
  salariesAndFeesAmount: number;
  otherExpensesAmount: number;
  transactionCount: number;
}

export type ExpenseBreakdownKind = "value" | "missing" | "other";

export interface ExpenseBreakdownItem {
  kind: ExpenseBreakdownKind;
  label: string;
  value: string | null;
  amount: number;
  transactionCount: number;
  share: number;
}

export interface ExpenseReviewSignalSummary {
  signal: ExpenseReviewSignal;
  available: boolean;
  amount: number;
  transactionCount: number;
  groupCount: number;
}

export interface ExpenseFacets {
  accounts: string[];
  categories: string[];
  subcategories: string[];
  providers: string[];
  responsibles: string[];
  paymentMethods: string[];
  statuses: string[];
}

export interface ExpensePagination {
  total: number;
  page: number;
  pageSize: ExpensePageSize;
  totalPages: number;
  firstResult: number;
  lastResult: number;
}

export interface ExpenseDataQuality {
  totalDataRowCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
}

export interface ExpenseAnalysisReport {
  availablePeriods: string[];
  range: ExpenseRange | null;
  summary: ExpenseSummary;
  trend: ExpenseTrendPoint[];
  categories: ExpenseBreakdownItem[];
  subcategories: ExpenseBreakdownItem[];
  providers: ExpenseBreakdownItem[];
  paymentMethods: ExpenseBreakdownItem[];
  signals: Record<ExpenseReviewSignal, ExpenseReviewSignalSummary>;
  facets: ExpenseFacets;
  capabilities: ExpenseCapabilities;
  transactions: Transaction[];
  pagination: ExpensePagination;
  dataQuality: ExpenseDataQuality;
  dataCutoff: Date | null;
  inspectedAt: Date;
}
