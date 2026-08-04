import type { Transaction } from "./transaction";

export interface DashboardPeriodSummary {
  period: string;
  income: number;
  expense: number;
  netResult: number;
  transactionCount: number;
}

export interface DashboardExpenseCategory {
  category: string;
  amount: number;
}

export interface DashboardDataQuality {
  totalDataRowCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
}

export interface DashboardOverview {
  availablePeriods: string[];
  selectedPeriod: string | null;
  summary: DashboardPeriodSummary | null;
  trend: DashboardPeriodSummary[];
  expenseCategories: DashboardExpenseCategory[];
  recentTransactions: Transaction[];
  dataQuality: DashboardDataQuality;
  dataCutoff: Date | null;
  inspectedAt: Date;
}
