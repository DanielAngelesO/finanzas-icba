import type {
  DashboardAccumulatedSummary,
  DashboardAccountPosition,
  DashboardCategorySummary,
  DashboardComparisonWindow,
  DashboardDailyTrendPoint,
  DashboardExpenseComposition,
  DashboardExpenseGroup,
  DashboardExpenseInsights,
  DashboardIncomeBehaviorPoint,
  DashboardIncomeBreakdown,
  DashboardIncomeCategories,
  DashboardIncomeGroup,
  DashboardIncomeGroupPeriodSummary,
  DashboardIncomeScopeNullableValues,
  DashboardIncomeScopeValues,
  DashboardMetricComparison,
  DashboardOverview,
  DashboardPeriodComparison,
  DashboardPeriodSummary,
  DashboardRateComparison,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import { getIncomeGroup, normalizeCategory } from "../../domain/income-groups";
import { getTransactionAccountDelta, type Transaction } from "../../domain/transaction";
import type { TransactionRepository } from "../ports/transaction-repository";

const dashboardPeriodPattern = /^\d{6}$/;
const maximumTrendPeriods = 12;
const maximumCategories = 5;
const maximumRecentTransactions = 5;
const salaryAndFeesCategory = "salarios y honorarios";

const roundMoney = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;

const sortTransactionsByNewestFirst = (left: Transaction, right: Transaction): number =>
  right.date.getTime() - left.date.getTime() || right.id.localeCompare(left.id);

const createIncomeScopeValues = (contributions = 0, all = 0): DashboardIncomeScopeValues => ({
  CONTRIBUTIONS: contributions,
  ALL: all,
});

const createIncomeScopeNullableValues = (
  contributions: number | null = null,
  all: number | null = null,
): DashboardIncomeScopeNullableValues => ({
  CONTRIBUTIONS: contributions,
  ALL: all,
});

const createIncomeGroupAmounts = (): Record<DashboardIncomeGroup, number> => ({
  DIEZMOS: 0,
  OFRENDAS: 0,
  OTROS: 0,
});

const createIncomeGroupCounts = (): Record<DashboardIncomeGroup, number> => ({
  DIEZMOS: 0,
  OFRENDAS: 0,
  OTROS: 0,
});

const getContributionIncome = (incomeByGroup: Record<DashboardIncomeGroup, number>): number =>
  incomeByGroup.DIEZMOS + incomeByGroup.OFRENDAS;

const getAllIncome = (incomeByGroup: Record<DashboardIncomeGroup, number>): number =>
  getContributionIncome(incomeByGroup) + incomeByGroup.OTROS;

interface IncomeGroupTotals {
  amounts: Record<DashboardIncomeGroup, number>;
  transactionCounts: Record<DashboardIncomeGroup, number>;
}

const getIncomeGroupTotals = (transactions: Transaction[]): IncomeGroupTotals => {
  const amounts = createIncomeGroupAmounts();
  const transactionCounts = createIncomeGroupCounts();

  for (const transaction of transactions) {
    const incomeGroup = getIncomeGroup(transaction);
    if (!incomeGroup) continue;
    amounts[incomeGroup] += transaction.amount;
    transactionCounts[incomeGroup] += 1;
  }

  return { amounts, transactionCounts };
};

const createSavingsRates = (
  income: DashboardIncomeScopeValues,
  netResult: DashboardIncomeScopeValues,
): DashboardIncomeScopeNullableValues =>
  createIncomeScopeNullableValues(
    income.CONTRIBUTIONS === 0 ? null : netResult.CONTRIBUTIONS / income.CONTRIBUTIONS,
    income.ALL === 0 ? null : netResult.ALL / income.ALL,
  );

interface FinancialValues {
  income: DashboardIncomeScopeValues;
  incomeByGroup: Record<DashboardIncomeGroup, number>;
  incomeTransactionCountByGroup: Record<DashboardIncomeGroup, number>;
  expense: number;
  netResult: DashboardIncomeScopeValues;
  savingsRate: DashboardIncomeScopeNullableValues;
}

const getFinancialValues = (transactions: Transaction[]): FinancialValues => {
  const incomeGroupTotals = getIncomeGroupTotals(transactions);
  let expense = 0;

  for (const transaction of transactions) {
    if (transaction.type === "EGRESO") expense += transaction.amount;
  }

  const income = createIncomeScopeValues(
    getContributionIncome(incomeGroupTotals.amounts),
    getAllIncome(incomeGroupTotals.amounts),
  );
  const netResult = createIncomeScopeValues(income.CONTRIBUTIONS - expense, income.ALL - expense);

  return {
    income,
    incomeByGroup: incomeGroupTotals.amounts,
    incomeTransactionCountByGroup: incomeGroupTotals.transactionCounts,
    expense,
    netResult,
    savingsRate: createSavingsRates(income, netResult),
  };
};

const isSalaryAndFeesExpense = (transaction: Transaction): boolean =>
  transaction.type === "EGRESO" &&
  normalizeCategory(transaction.category) === salaryAndFeesCategory;

const createPeriodSummary = (
  period: string,
  transactions: Transaction[],
): DashboardPeriodSummary => {
  const financialValues = getFinancialValues(transactions);

  return {
    period,
    income: financialValues.income,
    expense: financialValues.expense,
    netResult: financialValues.netResult,
    savingsRate: financialValues.savingsRate,
    transactionCount: transactions.length,
  };
};

const getIncomeBreakdown = (transactions: Transaction[]): DashboardIncomeBreakdown => {
  const { amounts, transactionCounts } = getIncomeGroupTotals(transactions);
  const total = getAllIncome(amounts);

  return {
    DIEZMOS: {
      amount: amounts.DIEZMOS,
      transactionCount: transactionCounts.DIEZMOS,
      share: total === 0 ? 0 : amounts.DIEZMOS / total,
    },
    OFRENDAS: {
      amount: amounts.OFRENDAS,
      transactionCount: transactionCounts.OFRENDAS,
      share: total === 0 ? 0 : amounts.OFRENDAS / total,
    },
    OTROS: {
      amount: amounts.OTROS,
      transactionCount: transactionCounts.OTROS,
      share: total === 0 ? 0 : amounts.OTROS / total,
    },
  };
};

const getCategorySummaries = (
  transactions: Transaction[],
  type: Transaction["type"],
): DashboardCategorySummary[] => {
  const valuesByCategory = new Map<string, { amount: number; transactionCount: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const current = valuesByCategory.get(transaction.category) ?? {
      amount: 0,
      transactionCount: 0,
    };
    valuesByCategory.set(transaction.category, {
      amount: current.amount + transaction.amount,
      transactionCount: current.transactionCount + 1,
    });
  }

  const total = [...valuesByCategory.values()].reduce((amount, value) => amount + value.amount, 0);
  return [...valuesByCategory.entries()]
    .map(([category, value]) => ({
      category,
      amount: value.amount,
      transactionCount: value.transactionCount,
      share: total === 0 ? 0 : value.amount / total,
    }))
    .sort(
      (left, right) => right.amount - left.amount || left.category.localeCompare(right.category),
    );
};

const groupMainCategories = (
  categories: DashboardCategorySummary[],
): DashboardCategorySummary[] => {
  const total = categories.reduce((amount, category) => amount + category.amount, 0);
  const mainCategories = categories.slice(0, maximumCategories);
  const remainingCategories = categories.slice(maximumCategories);
  const other = remainingCategories.reduce(
    (summary, category) => ({
      amount: summary.amount + category.amount,
      transactionCount: summary.transactionCount + category.transactionCount,
    }),
    { amount: 0, transactionCount: 0 },
  );

  if (other.amount === 0) return mainCategories;

  const existingOtherIndex = mainCategories.findIndex((category) => category.category === "Otros");
  if (existingOtherIndex >= 0) {
    const existingOther = mainCategories[existingOtherIndex];
    if (!existingOther) return mainCategories;
    return mainCategories.map((category, index) =>
      index === existingOtherIndex
        ? {
            ...category,
            amount: category.amount + other.amount,
            transactionCount: category.transactionCount + other.transactionCount,
            share: category.share + (total === 0 ? 0 : other.amount / total),
          }
        : category,
    );
  }

  return [
    ...mainCategories,
    {
      category: "Otros",
      amount: other.amount,
      transactionCount: other.transactionCount,
      share: total === 0 ? 0 : other.amount / total,
    },
  ];
};

const getIncomeCategories = (transactions: Transaction[]): DashboardIncomeCategories => ({
  CONTRIBUTIONS: groupMainCategories(
    getCategorySummaries(
      transactions.filter(
        (transaction) => transaction.type === "INGRESO" && getIncomeGroup(transaction) !== "OTROS",
      ),
      "INGRESO",
    ),
  ),
  ALL: groupMainCategories(getCategorySummaries(transactions, "INGRESO")),
});

const createExpenseGroup = (
  transactions: Transaction[],
  totalExpense: number,
): DashboardExpenseGroup => {
  const amount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    amount,
    transactionCount: transactions.length,
    share: totalExpense === 0 ? 0 : amount / totalExpense,
  };
};

const getExpenseComposition = (transactions: Transaction[]): DashboardExpenseComposition => {
  const expenses = transactions.filter((transaction) => transaction.type === "EGRESO");
  const salariesAndFees = expenses.filter(isSalaryAndFeesExpense);
  const otherExpenses = expenses.filter((transaction) => !isSalaryAndFeesExpense(transaction));
  const totalExpense = expenses.reduce((amount, transaction) => amount + transaction.amount, 0);

  return {
    salariesAndFees: createExpenseGroup(salariesAndFees, totalExpense),
    otherExpenses: createExpenseGroup(otherExpenses, totalExpense),
  };
};

const getExpenseInsights = (categories: DashboardCategorySummary[]): DashboardExpenseInsights => {
  const leadingCategory = categories[0] ?? null;
  const topThreeAmount = categories
    .slice(0, 3)
    .reduce((amount, category) => amount + category.amount, 0);
  const total = categories.reduce((amount, category) => amount + category.amount, 0);

  return {
    leadingCategory,
    topThreeShare: total === 0 ? null : topThreeAmount / total,
  };
};

const getTrendPeriods = (selectedPeriod: string): string[] => {
  const year = Number(selectedPeriod.slice(0, 4));
  const month = Number(selectedPeriod.slice(4, 6));

  return Array.from({ length: maximumTrendPeriods }, (_, index) => {
    const date = new Date(Date.UTC(year, month - maximumTrendPeriods + index, 1));
    return String(date.getUTCFullYear()) + String(date.getUTCMonth() + 1).padStart(2, "0");
  });
};

const getDataCutoff = (transactions: Transaction[]): Date | null =>
  transactions.reduce<Date | null>(
    (latest, transaction) =>
      latest === null || transaction.date.getTime() > latest.getTime() ? transaction.date : latest,
    null,
  );

const formatDateKey = (date: Date): string =>
  String(date.getUTCFullYear()) +
  "-" +
  String(date.getUTCMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getUTCDate()).padStart(2, "0");

const getPeriodStart = (period: string): Date =>
  new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));

interface DailyTotals {
  incomeByGroup: Record<DashboardIncomeGroup, number>;
  expense: number;
}

const createDailyTotals = (): DailyTotals => ({
  incomeByGroup: createIncomeGroupAmounts(),
  expense: 0,
});

const getPeriodDailyTrend = (
  selectedPeriod: string,
  transactions: Transaction[],
  dataCutoff: Date | null,
): DashboardDailyTrendPoint[] => {
  if (dataCutoff === null) return [];

  const totalsByDate = new Map<string, DailyTotals>();
  for (const transaction of transactions) {
    const key = formatDateKey(transaction.date);
    const current = totalsByDate.get(key) ?? createDailyTotals();
    const incomeGroup = getIncomeGroup(transaction);

    if (incomeGroup) {
      current.incomeByGroup[incomeGroup] += transaction.amount;
    } else if (transaction.type === "EGRESO") {
      current.expense += transaction.amount;
    }
    totalsByDate.set(key, current);
  }

  const start = getPeriodStart(selectedPeriod);
  const cutoff = new Date(
    Date.UTC(dataCutoff.getUTCFullYear(), dataCutoff.getUTCMonth(), dataCutoff.getUTCDate()),
  );
  const points: DashboardDailyTrendPoint[] = [];
  const cumulativeNetResult = createIncomeScopeValues();

  for (
    let day = start;
    day.getTime() <= cutoff.getTime();
    day = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1))
  ) {
    const date = formatDateKey(day);
    const totals = totalsByDate.get(date) ?? createDailyTotals();
    const income = createIncomeScopeValues(
      getContributionIncome(totals.incomeByGroup),
      getAllIncome(totals.incomeByGroup),
    );
    const netResult = createIncomeScopeValues(
      income.CONTRIBUTIONS - totals.expense,
      income.ALL - totals.expense,
    );
    cumulativeNetResult.CONTRIBUTIONS += netResult.CONTRIBUTIONS;
    cumulativeNetResult.ALL += netResult.ALL;

    points.push({
      date,
      income,
      incomeByGroup: { ...totals.incomeByGroup },
      expense: totals.expense,
      netResult,
      cumulativeNetResult: { ...cumulativeNetResult },
    });
  }

  return points;
};

const getPeriodIncomeBehavior = (
  dailyTrend: DashboardDailyTrendPoint[],
  breakdown: DashboardIncomeBreakdown,
): DashboardIncomeBehaviorPoint[] => {
  const cumulativeAmounts = createIncomeGroupAmounts();

  return dailyTrend.map((point) => {
    cumulativeAmounts.DIEZMOS += point.incomeByGroup.DIEZMOS;
    cumulativeAmounts.OFRENDAS += point.incomeByGroup.OFRENDAS;
    cumulativeAmounts.OTROS += point.incomeByGroup.OTROS;

    return {
      date: point.date,
      cumulativeShare: {
        DIEZMOS:
          breakdown.DIEZMOS.amount === 0
            ? null
            : cumulativeAmounts.DIEZMOS / breakdown.DIEZMOS.amount,
        OFRENDAS:
          breakdown.OFRENDAS.amount === 0
            ? null
            : cumulativeAmounts.OFRENDAS / breakdown.OFRENDAS.amount,
        OTROS:
          breakdown.OTROS.amount === 0 ? null : cumulativeAmounts.OTROS / breakdown.OTROS.amount,
      },
    };
  });
};

const getPreviousPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return String(previous.getUTCFullYear()) + String(previous.getUTCMonth() + 1).padStart(2, "0");
};

const getLastDayOfPeriod = (period: string): number =>
  new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)), 0)).getUTCDate();

const getComparisonWindow = (
  selectedPeriod: string,
  latestAvailablePeriod: string | null,
  dataCutoff: Date | null,
): DashboardComparisonWindow => {
  const previousPeriod = getPreviousPeriod(selectedPeriod);
  if (selectedPeriod === latestAvailablePeriod && dataCutoff !== null) {
    return {
      kind: "THROUGH_DAY",
      previousPeriod,
      throughDay: Math.min(dataCutoff.getUTCDate(), getLastDayOfPeriod(previousPeriod)),
    };
  }
  return { kind: "FULL_MONTH", previousPeriod };
};

const getTransactionsForComparisonWindow = (
  transactionsByPeriod: Map<string, Transaction[]>,
  window: DashboardComparisonWindow,
): Transaction[] => {
  const transactions = transactionsByPeriod.get(window.previousPeriod) ?? [];
  if (window.kind === "FULL_MONTH") return transactions;
  return transactions.filter((transaction) => transaction.date.getUTCDate() <= window.throughDay);
};

const getAccumulatedSummary = (transactions: Transaction[]): DashboardAccumulatedSummary => {
  const financialValues = getFinancialValues(transactions);
  return {
    income: financialValues.income,
    expense: financialValues.expense,
    balance: createIncomeScopeValues(
      roundMoney(financialValues.netResult.CONTRIBUTIONS),
      roundMoney(financialValues.netResult.ALL),
    ),
  };
};

const getAccountPosition = (transactions: Transaction[]): DashboardAccountPosition => {
  const balanceByAccountInCents = new Map<string, number>();

  transactions.forEach((transaction) => {
    const current = balanceByAccountInCents.get(transaction.account) ?? 0;
    const deltaInCents = Math.round(getTransactionAccountDelta(transaction) * 100);
    balanceByAccountInCents.set(transaction.account, current + deltaInCents);
  });

  const accounts = [...balanceByAccountInCents.entries()]
    .map(([account, balanceInCents]) => ({ account, balance: balanceInCents / 100 }))
    .sort(
      (left, right) =>
        right.balance - left.balance || left.account.localeCompare(right.account, "es-PE"),
    );

  return {
    accounts,
    total:
      [...balanceByAccountInCents.values()].reduce((total, balance) => total + balance, 0) / 100,
  };
};

const getAccumulatedSummaryForComparisonWindow = (
  transactions: Transaction[],
  window: DashboardComparisonWindow,
): DashboardAccumulatedSummary =>
  getAccumulatedSummary(
    transactions.filter((transaction) => {
      if (transaction.period < window.previousPeriod) return true;
      if (transaction.period !== window.previousPeriod) return false;
      return window.kind === "FULL_MONTH" || transaction.date.getUTCDate() <= window.throughDay;
    }),
  );

const getMetricComparison = (
  currentValue: number,
  previousValue: number,
): DashboardMetricComparison => {
  const delta = currentValue - previousValue;
  return {
    previousValue,
    delta,
    rate: previousValue === 0 ? null : delta / Math.abs(previousValue),
    direction: delta === 0 ? "UNCHANGED" : delta > 0 ? "INCREASED" : "DECREASED",
  };
};

const getScopeComparisons = (
  currentValues: DashboardIncomeScopeValues,
  previousValues: DashboardIncomeScopeValues,
): Record<"CONTRIBUTIONS" | "ALL", DashboardMetricComparison> => ({
  CONTRIBUTIONS: getMetricComparison(currentValues.CONTRIBUTIONS, previousValues.CONTRIBUTIONS),
  ALL: getMetricComparison(currentValues.ALL, previousValues.ALL),
});

const getRateComparison = (
  currentValue: number | null,
  previousValue: number | null,
): DashboardRateComparison => {
  if (currentValue === null || previousValue === null) {
    return {
      currentValue,
      previousValue,
      delta: null,
      direction: null,
    };
  }

  const delta = currentValue - previousValue;
  return {
    currentValue,
    previousValue,
    delta,
    direction: delta === 0 ? "UNCHANGED" : delta > 0 ? "INCREASED" : "DECREASED",
  };
};

const getIncomeGroupComparisons = (
  currentBreakdown: DashboardIncomeBreakdown,
  previousBreakdown: DashboardIncomeBreakdown,
): Record<DashboardIncomeGroup, DashboardMetricComparison> => ({
  DIEZMOS: getMetricComparison(currentBreakdown.DIEZMOS.amount, previousBreakdown.DIEZMOS.amount),
  OFRENDAS: getMetricComparison(
    currentBreakdown.OFRENDAS.amount,
    previousBreakdown.OFRENDAS.amount,
  ),
  OTROS: getMetricComparison(currentBreakdown.OTROS.amount, previousBreakdown.OTROS.amount),
});

const getPeriodComparison = (
  selectedPeriod: string,
  latestAvailablePeriod: string | null,
  allTransactions: Transaction[],
  transactionsByPeriod: Map<string, Transaction[]>,
  dataCutoff: Date | null,
  summary: DashboardPeriodSummary,
  accumulated: DashboardAccumulatedSummary,
  incomeBreakdown: DashboardIncomeBreakdown,
): DashboardPeriodComparison => {
  const window = getComparisonWindow(selectedPeriod, latestAvailablePeriod, dataCutoff);
  const previousTransactions = getTransactionsForComparisonWindow(transactionsByPeriod, window);
  const previousSummary = createPeriodSummary(window.previousPeriod, previousTransactions);
  const previousAccumulated = getAccumulatedSummaryForComparisonWindow(allTransactions, window);
  const previousBreakdown = getIncomeBreakdown(previousTransactions);

  return {
    window,
    income: getScopeComparisons(summary.income, previousSummary.income),
    incomeByGroup: getIncomeGroupComparisons(incomeBreakdown, previousBreakdown),
    expense: getMetricComparison(summary.expense, previousSummary.expense),
    netResult: getScopeComparisons(summary.netResult, previousSummary.netResult),
    accumulatedBalance: getScopeComparisons(accumulated.balance, previousAccumulated.balance),
    savingsRate: {
      CONTRIBUTIONS: getRateComparison(
        summary.savingsRate.CONTRIBUTIONS,
        previousSummary.savingsRate.CONTRIBUTIONS,
      ),
      ALL: getRateComparison(summary.savingsRate.ALL, previousSummary.savingsRate.ALL),
    },
  };
};

const getIncomeGroupPeriodSummaries = (
  financialValues: FinancialValues,
): Record<DashboardIncomeGroup, DashboardIncomeGroupPeriodSummary> => ({
  DIEZMOS: {
    amount: financialValues.incomeByGroup.DIEZMOS,
    transactionCount: financialValues.incomeTransactionCountByGroup.DIEZMOS,
  },
  OFRENDAS: {
    amount: financialValues.incomeByGroup.OFRENDAS,
    transactionCount: financialValues.incomeTransactionCountByGroup.OFRENDAS,
  },
  OTROS: {
    amount: financialValues.incomeByGroup.OTROS,
    transactionCount: financialValues.incomeTransactionCountByGroup.OTROS,
  },
});

const getAnnualTrend = (
  periods: string[],
  transactionsByPeriod: Map<string, Transaction[]>,
  allTransactions: Transaction[],
): DashboardTrendPoint[] => {
  const firstPeriod = periods[0];
  if (!firstPeriod) throw new Error("No se pudo construir la evolución financiera.");

  const openingBalance = getFinancialValues(
    allTransactions.filter((transaction) => transaction.period < firstPeriod),
  ).netResult;
  let cumulativeBalance = { ...openingBalance };

  return periods.map((period) => {
    const financialValues = getFinancialValues(transactionsByPeriod.get(period) ?? []);
    cumulativeBalance = createIncomeScopeValues(
      cumulativeBalance.CONTRIBUTIONS + financialValues.netResult.CONTRIBUTIONS,
      cumulativeBalance.ALL + financialValues.netResult.ALL,
    );
    return {
      period,
      income: financialValues.income,
      incomeByGroup: getIncomeGroupPeriodSummaries(financialValues),
      expense: financialValues.expense,
      netResult: financialValues.netResult,
      cumulativeBalance,
    };
  });
};

export class GetDashboardOverviewUseCase {
  public constructor(private readonly repository: TransactionRepository) {}

  public async execute(requestedPeriod?: string): Promise<DashboardOverview> {
    const [availablePeriodsResult, inspection] = await Promise.all([
      this.repository.getAvailablePeriods(),
      this.repository.inspect(),
    ]);
    const availablePeriods = [...new Set(availablePeriodsResult)].sort().reverse();
    const validRequestedPeriod =
      requestedPeriod && dashboardPeriodPattern.test(requestedPeriod) ? requestedPeriod : null;
    const selectedPeriod =
      validRequestedPeriod && availablePeriods.includes(validRequestedPeriod)
        ? validRequestedPeriod
        : (availablePeriods[0] ?? null);
    const selectedTransactions = selectedPeriod
      ? await this.repository.findAll({ period: selectedPeriod })
      : [];
    const transactionsByPeriod = new Map<string, Transaction[]>();

    for (const transaction of inspection.transactions) {
      const current = transactionsByPeriod.get(transaction.period) ?? [];
      current.push(transaction);
      transactionsByPeriod.set(transaction.period, current);
    }

    if (!selectedPeriod) {
      return {
        availablePeriods,
        selectedPeriod: null,
        summary: null,
        accumulated: null,
        accountPosition: null,
        comparison: null,
        incomeBreakdown: null,
        periodDailyTrend: [],
        periodIncomeBehavior: [],
        trend: [],
        incomeCategories: { CONTRIBUTIONS: [], ALL: [] },
        expenseComposition: null,
        expenseCategories: [],
        expenseInsights: null,
        recentTransactions: [],
        dataQuality: {
          totalDataRowCount: inspection.totalDataRowCount,
          validTransactionCount: inspection.validTransactionCount,
          invalidTransactionCount: inspection.invalidTransactionCount,
        },
        dataCutoff: null,
        inspectedAt: inspection.inspectedAt,
      };
    }

    const summary = createPeriodSummary(selectedPeriod, selectedTransactions);
    const accumulatedTransactions = inspection.transactions.filter(
      (transaction) => transaction.period <= selectedPeriod,
    );
    const accumulated = getAccumulatedSummary(accumulatedTransactions);
    const accountPosition = getAccountPosition(accumulatedTransactions);
    const dataCutoff = getDataCutoff(selectedTransactions);
    const incomeBreakdown = getIncomeBreakdown(selectedTransactions);
    const periodDailyTrend = getPeriodDailyTrend(selectedPeriod, selectedTransactions, dataCutoff);
    const periodIncomeBehavior = getPeriodIncomeBehavior(periodDailyTrend, incomeBreakdown);
    const trendPeriods = getTrendPeriods(selectedPeriod);
    const allNonSalaryExpenseCategories = getCategorySummaries(
      selectedTransactions.filter((transaction) => !isSalaryAndFeesExpense(transaction)),
      "EGRESO",
    );

    return {
      availablePeriods,
      selectedPeriod,
      summary,
      accumulated,
      accountPosition,
      comparison: getPeriodComparison(
        selectedPeriod,
        availablePeriods[0] ?? null,
        inspection.transactions,
        transactionsByPeriod,
        dataCutoff,
        summary,
        accumulated,
        incomeBreakdown,
      ),
      incomeBreakdown,
      periodDailyTrend,
      periodIncomeBehavior,
      trend: getAnnualTrend(trendPeriods, transactionsByPeriod, inspection.transactions),
      incomeCategories: getIncomeCategories(selectedTransactions),
      expenseComposition: getExpenseComposition(selectedTransactions),
      expenseCategories: groupMainCategories(allNonSalaryExpenseCategories),
      expenseInsights: getExpenseInsights(allNonSalaryExpenseCategories),
      recentTransactions: [...selectedTransactions]
        .sort(sortTransactionsByNewestFirst)
        .slice(0, maximumRecentTransactions),
      dataQuality: {
        totalDataRowCount: inspection.totalDataRowCount,
        validTransactionCount: inspection.validTransactionCount,
        invalidTransactionCount: inspection.invalidTransactionCount,
      },
      dataCutoff,
      inspectedAt: inspection.inspectedAt,
    };
  }
}
