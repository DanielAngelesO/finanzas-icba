/** One income or expense movement shown inside a monthly balance list. */
export interface MonthlyBalanceEntry {
  id: string;
  date: Date;
  description: string | null;
  category: string;
  subcategory: string | null;
  counterparty: string | null;
  account: string | null;
  amount: number;
}

export interface MonthlyBalanceGroup {
  entries: MonthlyBalanceEntry[];
  total: number;
  count: number;
}

export interface MonthlyBalanceIncome {
  /** Diezmos + ofrendas. */
  contributions: number;
  /** Otros ingresos. */
  other: number;
  /** contributions + other. */
  total: number;
}

export interface MonthlyBalanceNetResult {
  /** contributions - expense. */
  contributions: number;
  /** total income - expense. */
  all: number;
}

export interface MonthlyBalance {
  period: string;
  hasData: boolean;
  income: MonthlyBalanceIncome;
  expense: number;
  netResult: MonthlyBalanceNetResult;
  tithes: MonthlyBalanceGroup;
  offerings: MonthlyBalanceGroup;
  otherIncome: MonthlyBalanceGroup;
  expenses: MonthlyBalanceGroup;
  dataQuality: { invalidTransactionCount: number };
  inspectedAt: Date;
}
