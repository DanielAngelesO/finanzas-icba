import type { Transaction } from "./transaction";

export interface DashboardPeriodSummary {
  period: string;
  income: DashboardIncomeScopeValues;
  expense: number;
  netResult: DashboardIncomeScopeValues;
  savingsRate: DashboardIncomeScopeNullableValues;
  transactionCount: number;
}

export type DashboardIncomeGroup = "DIEZMOS" | "OFRENDAS" | "OTROS";

export type DashboardIncomeScope = "CONTRIBUTIONS" | "ALL";

export type DashboardIncomeScopeValues = Record<DashboardIncomeScope, number>;

export type DashboardIncomeScopeNullableValues = Record<DashboardIncomeScope, number | null>;

export interface DashboardIncomeGroupSummary {
  amount: number;
  transactionCount: number;
  share: number;
}

export type DashboardIncomeBreakdown = Record<DashboardIncomeGroup, DashboardIncomeGroupSummary>;

export interface DashboardIncomeGroupPeriodSummary {
  amount: number;
  transactionCount: number;
}

export interface DashboardTrendPoint {
  period: string;
  income: DashboardIncomeScopeValues;
  incomeByGroup: Record<DashboardIncomeGroup, DashboardIncomeGroupPeriodSummary>;
  expense: number;
  netResult: DashboardIncomeScopeValues;
  cumulativeBalance: DashboardIncomeScopeValues;
}

export interface DashboardDailyTrendPoint {
  date: string;
  income: DashboardIncomeScopeValues;
  incomeByGroup: Record<DashboardIncomeGroup, number>;
  expense: number;
  netResult: DashboardIncomeScopeValues;
  cumulativeNetResult: DashboardIncomeScopeValues;
}

export interface DashboardIncomeBehaviorPoint {
  date: string;
  cumulativeShare: Record<DashboardIncomeGroup, number | null>;
}

export interface DashboardAccumulatedSummary {
  income: DashboardIncomeScopeValues;
  expense: number;
  balance: DashboardIncomeScopeValues;
}

export interface DashboardCategorySummary {
  category: string;
  amount: number;
  transactionCount: number;
  share: number;
}

export type DashboardComparisonDirection = "INCREASED" | "DECREASED" | "UNCHANGED";

export interface DashboardMetricComparison {
  previousValue: number;
  delta: number;
  rate: number | null;
  direction: DashboardComparisonDirection;
}

export interface DashboardRateComparison {
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  direction: DashboardComparisonDirection | null;
}

export type DashboardComparisonWindow =
  | { kind: "FULL_MONTH"; previousPeriod: string }
  | { kind: "THROUGH_DAY"; previousPeriod: string; throughDay: number };

export interface DashboardPeriodComparison {
  window: DashboardComparisonWindow;
  income: Record<DashboardIncomeScope, DashboardMetricComparison>;
  incomeByGroup: Record<DashboardIncomeGroup, DashboardMetricComparison>;
  expense: DashboardMetricComparison;
  netResult: Record<DashboardIncomeScope, DashboardMetricComparison>;
  accumulatedBalance: Record<DashboardIncomeScope, DashboardMetricComparison>;
  savingsRate: Record<DashboardIncomeScope, DashboardRateComparison>;
}

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

export type DashboardIncomeCategories = Record<DashboardIncomeScope, DashboardCategorySummary[]>;

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
  comparison: DashboardPeriodComparison | null;
  incomeBreakdown: DashboardIncomeBreakdown | null;
  periodDailyTrend: DashboardDailyTrendPoint[];
  periodIncomeBehavior: DashboardIncomeBehaviorPoint[];
  trend: DashboardTrendPoint[];
  incomeCategories: DashboardIncomeCategories;
  expenseComposition: DashboardExpenseComposition | null;
  expenseCategories: DashboardCategorySummary[];
  expenseInsights: DashboardExpenseInsights | null;
  recentTransactions: Transaction[];
  dataQuality: DashboardDataQuality;
  dataCutoff: Date | null;
  inspectedAt: Date;
}
