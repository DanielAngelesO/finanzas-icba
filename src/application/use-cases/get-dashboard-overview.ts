import type {
  DashboardExpenseCategory,
  DashboardOverview,
  DashboardPeriodSummary,
} from "../../domain/dashboard";
import type { Transaction } from "../../domain/transaction";
import type { TransactionRepository } from "../ports/transaction-repository";

const dashboardPeriodPattern = /^\d{6}$/;
const maximumTrendPeriods = 6;
const maximumExpenseCategories = 5;
const maximumRecentTransactions = 5;

const sortTransactionsByNewestFirst = (left: Transaction, right: Transaction): number =>
  right.date.getTime() - left.date.getTime() || right.id.localeCompare(left.id);

const createPeriodSummary = (
  period: string,
  transactions: Transaction[],
): DashboardPeriodSummary => {
  const income = transactions
    .filter((transaction) => transaction.type === "INGRESO")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.type === "EGRESO")
    .reduce((total, transaction) => total + transaction.amount, 0);

  return {
    period,
    income,
    expense,
    netResult: income - expense,
    transactionCount: transactions.length,
  };
};

const getExpenseCategories = (transactions: Transaction[]): DashboardExpenseCategory[] => {
  const amountsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "EGRESO") continue;
    amountsByCategory.set(
      transaction.category,
      (amountsByCategory.get(transaction.category) ?? 0) + transaction.amount,
    );
  }

  const categories = [...amountsByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort(
      (left, right) => right.amount - left.amount || left.category.localeCompare(right.category),
    );
  const mainCategories = categories.slice(0, maximumExpenseCategories);
  const otherAmount = categories
    .slice(maximumExpenseCategories)
    .reduce((total, category) => total + category.amount, 0);

  if (otherAmount === 0) return mainCategories;

  const existingOtherIndex = mainCategories.findIndex((category) => category.category === "Otros");
  if (existingOtherIndex >= 0) {
    const existingOther = mainCategories[existingOtherIndex];
    if (!existingOther) return mainCategories;
    return mainCategories.map((category, index) =>
      index === existingOtherIndex
        ? { ...category, amount: category.amount + otherAmount }
        : category,
    );
  }

  return [...mainCategories, { category: "Otros", amount: otherAmount }];
};

const getDataCutoff = (transactions: Transaction[]): Date | null =>
  transactions.reduce<Date | null>(
    (latest, transaction) =>
      latest === null || transaction.date.getTime() > latest.getTime() ? transaction.date : latest,
    null,
  );

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
    const selectedPeriodIndex = selectedPeriod ? availablePeriods.indexOf(selectedPeriod) : -1;
    const trendPeriods =
      selectedPeriodIndex >= 0
        ? availablePeriods
            .slice(selectedPeriodIndex, selectedPeriodIndex + maximumTrendPeriods)
            .reverse()
        : [];
    const transactionsByPeriod = new Map<string, Transaction[]>();

    for (const transaction of inspection.transactions) {
      const current = transactionsByPeriod.get(transaction.period) ?? [];
      current.push(transaction);
      transactionsByPeriod.set(transaction.period, current);
    }

    return {
      availablePeriods,
      selectedPeriod,
      summary: selectedPeriod ? createPeriodSummary(selectedPeriod, selectedTransactions) : null,
      trend: trendPeriods.map((period) =>
        createPeriodSummary(period, transactionsByPeriod.get(period) ?? []),
      ),
      expenseCategories: getExpenseCategories(selectedTransactions),
      recentTransactions: [...selectedTransactions]
        .sort(sortTransactionsByNewestFirst)
        .slice(0, maximumRecentTransactions),
      dataQuality: {
        totalDataRowCount: inspection.totalDataRowCount,
        validTransactionCount: inspection.validTransactionCount,
        invalidTransactionCount: inspection.invalidTransactionCount,
      },
      dataCutoff: getDataCutoff(selectedTransactions),
      inspectedAt: inspection.inspectedAt,
    };
  }
}
