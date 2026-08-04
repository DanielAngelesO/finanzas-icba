import type {
  DashboardAccumulatedSummary,
  DashboardCategorySummary,
  DashboardContributionSummary,
  DashboardExpenseComposition,
  DashboardExpenseInsights,
  DashboardExpenseGroup,
  DashboardOverview,
  DashboardPeriodSummary,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import type { Transaction } from "../../domain/transaction";
import type { TransactionRepository } from "../ports/transaction-repository";

const dashboardPeriodPattern = /^\d{6}$/;
const maximumTrendPeriods = 6;
const maximumCategories = 5;
const maximumRecentTransactions = 5;
const salaryAndFeesCategory = "salarios y honorarios";

const contributionAliases = {
  OFRENDAS: new Set(["ofrenda", "ofrendas"]),
  DIEZMOS: new Set(["diezmo", "diezmos"]),
} as const;

const sortTransactionsByNewestFirst = (left: Transaction, right: Transaction): number =>
  right.date.getTime() - left.date.getTime() || right.id.localeCompare(left.id);

const normalizeCategory = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " y ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-PE");

const getContributionKind = (
  transaction: Transaction,
): DashboardContributionSummary["kind"] | null => {
  if (transaction.type !== "INGRESO") return null;
  const values = [transaction.category, transaction.subcategory].filter(
    (value): value is string => value !== null,
  );
  const normalizedValues = values.map(normalizeCategory);
  if (normalizedValues.some((value) => contributionAliases.OFRENDAS.has(value))) {
    return "OFRENDAS";
  }
  return normalizedValues.some((value) => contributionAliases.DIEZMOS.has(value))
    ? "DIEZMOS"
    : null;
};

const isSalaryAndFeesExpense = (transaction: Transaction): boolean =>
  transaction.type === "EGRESO" &&
  normalizeCategory(transaction.category) === salaryAndFeesCategory;

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
    savingsRate: income === 0 ? null : (income - expense) / income,
    transactionCount: transactions.length,
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
  const mainCategories = categories.slice(0, maximumCategories);
  const remainingCategories = categories.slice(maximumCategories);
  const other = remainingCategories.reduce(
    (total, category) => ({
      amount: total.amount + category.amount,
      transactionCount: total.transactionCount + category.transactionCount,
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

  const total = categories.reduce((amount, category) => amount + category.amount, 0);
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

const getContributionSummaries = (transactions: Transaction[]): DashboardContributionSummary[] =>
  (["OFRENDAS", "DIEZMOS"] as const).map((kind) => {
    const matchingTransactions = transactions.filter(
      (transaction) => getContributionKind(transaction) === kind,
    );
    return {
      kind,
      amount: matchingTransactions.reduce((amount, transaction) => amount + transaction.amount, 0),
      transactionCount: matchingTransactions.length,
    };
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
        trend: [],
        incomeCategories: [],
        contributions: [],
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
    const trendPeriods = getTrendPeriods(selectedPeriod);
    const firstTrendPeriod = trendPeriods[0];
    if (!firstTrendPeriod) {
      throw new Error("No se pudo construir la evolución financiera.");
    }
    const openingBalance = inspection.transactions
      .filter((transaction) => transaction.period < firstTrendPeriod)
      .reduce(
        (balance, transaction) =>
          transaction.type === "INGRESO"
            ? balance + transaction.amount
            : balance - transaction.amount,
        0,
      );
    let cumulativeBalance = openingBalance;
    const trend: DashboardTrendPoint[] = trendPeriods.map((period) => {
      const periodSummary = createPeriodSummary(period, transactionsByPeriod.get(period) ?? []);
      cumulativeBalance += periodSummary.netResult;
      return { ...periodSummary, cumulativeBalance };
    });
    const accumulatedIncome = inspection.transactions
      .filter(
        (transaction) => transaction.period <= selectedPeriod && transaction.type === "INGRESO",
      )
      .reduce((total, transaction) => total + transaction.amount, 0);
    const accumulatedExpense = inspection.transactions
      .filter(
        (transaction) => transaction.period <= selectedPeriod && transaction.type === "EGRESO",
      )
      .reduce((total, transaction) => total + transaction.amount, 0);
    const accumulated: DashboardAccumulatedSummary = {
      income: accumulatedIncome,
      expense: accumulatedExpense,
      balance: accumulatedIncome - accumulatedExpense,
    };
    const allNonSalaryExpenseCategories = getCategorySummaries(
      selectedTransactions.filter((transaction) => !isSalaryAndFeesExpense(transaction)),
      "EGRESO",
    );

    return {
      availablePeriods,
      selectedPeriod,
      summary,
      accumulated,
      trend,
      incomeCategories: groupMainCategories(getCategorySummaries(selectedTransactions, "INGRESO")),
      contributions: getContributionSummaries(selectedTransactions),
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
      dataCutoff: getDataCutoff(selectedTransactions),
      inspectedAt: inspection.inspectedAt,
    };
  }
}
