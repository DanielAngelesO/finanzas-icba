import type { TransactionRepository } from "../ports/transaction-repository";
import type {
  MonthlyBalance,
  MonthlyBalanceEntry,
  MonthlyBalanceGroup,
} from "../../domain/monthly-balance";
import { getIncomeGroup } from "../../domain/income-groups";
import { isTransactionIncludedInCalculations, type Transaction } from "../../domain/transaction";

const periodPattern = /^\d{6}$/;

const toEntry = (transaction: Transaction): MonthlyBalanceEntry => ({
  id: transaction.id,
  date: transaction.date,
  description: transaction.description,
  category: transaction.category,
  subcategory: transaction.subcategory,
  counterparty: transaction.donorOrProvider,
  account: transaction.account,
  amount: transaction.amount,
});

const byChronology = (left: Transaction, right: Transaction): number => {
  const dateDelta = left.date.getTime() - right.date.getTime();
  if (dateDelta !== 0) return dateDelta;
  return (left.rowNumber ?? 0) - (right.rowNumber ?? 0);
};

const buildGroup = (transactions: Transaction[]): MonthlyBalanceGroup => {
  const entries = [...transactions].sort(byChronology).map(toEntry);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return { entries, total, count: entries.length };
};

export class GetMonthlyBalanceUseCase {
  public constructor(private readonly repository: TransactionRepository) {}

  public async execute(requestedPeriod: string): Promise<MonthlyBalance> {
    const inspection = await this.repository.inspect();
    const financialTransactions = inspection.transactions.filter(
      isTransactionIncludedInCalculations,
    );

    const availablePeriods = [
      ...new Set(financialTransactions.map((transaction) => transaction.period)),
    ]
      .sort()
      .reverse();
    const period = periodPattern.test(requestedPeriod)
      ? requestedPeriod
      : (availablePeriods[0] ?? requestedPeriod);

    const monthTransactions = financialTransactions.filter(
      (transaction) => transaction.period === period,
    );

    const tithesTransactions: Transaction[] = [];
    const offeringsTransactions: Transaction[] = [];
    const otherIncomeTransactions: Transaction[] = [];
    const expenseTransactions: Transaction[] = [];

    for (const transaction of monthTransactions) {
      if (transaction.type === "EGRESO") {
        expenseTransactions.push(transaction);
        continue;
      }
      if (transaction.type !== "INGRESO") continue;
      const group = getIncomeGroup(transaction);
      if (group === "DIEZMOS") tithesTransactions.push(transaction);
      else if (group === "OFRENDAS") offeringsTransactions.push(transaction);
      else otherIncomeTransactions.push(transaction);
    }

    const tithes = buildGroup(tithesTransactions);
    const offerings = buildGroup(offeringsTransactions);
    const otherIncome = buildGroup(otherIncomeTransactions);
    const expenses = buildGroup(expenseTransactions);

    const contributions = tithes.total + offerings.total;
    const totalIncome = contributions + otherIncome.total;
    const expense = expenses.total;

    return {
      period,
      hasData: monthTransactions.length > 0,
      income: {
        contributions,
        other: otherIncome.total,
        total: totalIncome,
      },
      expense,
      netResult: {
        contributions: contributions - expense,
        all: totalIncome - expense,
      },
      tithes,
      offerings,
      otherIncome,
      expenses,
      dataQuality: { invalidTransactionCount: inspection.invalidTransactionCount },
      inspectedAt: inspection.inspectedAt,
    };
  }
}
