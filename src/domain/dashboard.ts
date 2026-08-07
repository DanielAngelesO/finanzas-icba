import type { Transaction } from "./transaction";

export interface DashboardPeriodSummary {
  period: string;
  income: number;
  expense: number;
  netResult: number;
  savingsRate: number | null;
  transactionCount: number;
}

export interface DashboardTrendPoint extends DashboardPeriodSummary {
  cumulativeBalance: number;
}

export interface DashboardDailyTrendPoint {
  date: string;
  income: number;
  expense: number;
  netResult: number;
  cumulativeNetResult: number;
}

export interface DashboardAccumulatedSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface DashboardCategorySummary {
  category: string;
  amount: number;
  transactionCount: number;
  share: number;
}

export type DashboardContributionKind = "OFRENDAS" | "DIEZMOS";

export interface DashboardContributionTrendPoint {
  period: string;
  amount: number;
  transactionCount: number;
}

export type DashboardContributionTrends = Record<
  DashboardContributionKind,
  DashboardContributionTrendPoint[]
>;

export interface DashboardExpenseGroup {
  amount: number;
  transactionCount: number;
  share: number;
}

export interface DashboardExpenseComposition {
  salariesAndFees: DashboardExpenseGroup;
  otherExpenses: DashboardExpenseGroup;
}

export interface DashboardExpenseInsights {
  leadingCategory: DashboardCategorySummary | null;
  topThreeShare: number | null;
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
  accumulated: DashboardAccumulatedSummary | null;
  periodDailyTrend: DashboardDailyTrendPoint[];
  trend: DashboardTrendPoint[];
  incomeCategories: DashboardCategorySummary[];
  contributionTrends: DashboardContributionTrends;
  expenseComposition: DashboardExpenseComposition | null;
  expenseCategories: DashboardCategorySummary[];
  expenseInsights: DashboardExpenseInsights | null;
  recentTransactions: Transaction[];
  dataQuality: DashboardDataQuality;
  dataCutoff: Date | null;
  inspectedAt: Date;
}
