import type { TransactionRepository } from "../ports/transaction-repository";
import {
  isTransactionIncludedInCalculations,
  type BasicFinancialSummary,
} from "../../domain/transaction";

export class GetBasicFinancialSummaryUseCase {
  public constructor(private readonly repository: TransactionRepository) {}

  public async execute(): Promise<BasicFinancialSummary> {
    const inspection = await this.repository.inspect();
    const financialTransactions = inspection.transactions.filter(
      isTransactionIncludedInCalculations,
    );
    const income = financialTransactions
      .filter((transaction) => transaction.type === "INGRESO")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = financialTransactions
      .filter((transaction) => transaction.type === "EGRESO")
      .reduce((total, transaction) => total + transaction.amount, 0);

    return {
      income,
      expense,
      balance: income - expense,
      transactionCount: inspection.totalDataRowCount,
      validTransactionCount: inspection.validTransactionCount,
      invalidTransactionCount: inspection.invalidTransactionCount,
    };
  }
}
