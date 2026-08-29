import type { AppConfig } from "../config/google-sheets";
import { DataSourceQueries } from "../application/use-cases/data-source-queries";
import { GetDashboardOverviewUseCase } from "../application/use-cases/get-dashboard-overview";
import { GetExpenseAnalysisUseCase } from "../application/use-cases/get-expense-analysis";
import { GetMonthlyBalanceUseCase } from "../application/use-cases/get-monthly-balance";
import { GetBasicFinancialSummaryUseCase } from "../application/use-cases/get-basic-financial-summary";
import { TransactionQueries } from "../application/use-cases/transaction-queries";
import { GoogleSheetsClient } from "../infrastructure/google-sheets/google-sheets-client";
import { GoogleSheetsTransactionRepository } from "../infrastructure/google-sheets/google-sheets-transaction-repository";
import { InMemoryTransactionRepository } from "../infrastructure/memory/in-memory-transaction-repository";
import {
  createReviewTransactions,
  reviewDataQualityIssues,
} from "../infrastructure/review/review-data";

export class AccessTokenStore {
  private token: string | null = null;

  public get = (): string | null => this.token;

  public set(token: string | null): void {
    this.token = token;
  }
}

export interface AppServices {
  tokenStore: AccessTokenStore;
  transactions: TransactionQueries;
  dataSource: DataSourceQueries;
  financialSummary: GetBasicFinancialSummaryUseCase;
  dashboard: GetDashboardOverviewUseCase;
  expenses: GetExpenseAnalysisUseCase;
  monthlyBalance: GetMonthlyBalanceUseCase;
}

const createServicesFromRepository = (repository: InMemoryTransactionRepository): AppServices => ({
  tokenStore: new AccessTokenStore(),
  transactions: new TransactionQueries(repository),
  dataSource: new DataSourceQueries(repository),
  financialSummary: new GetBasicFinancialSummaryUseCase(repository),
  dashboard: new GetDashboardOverviewUseCase(repository),
  expenses: new GetExpenseAnalysisUseCase(repository),
  monthlyBalance: new GetMonthlyBalanceUseCase(repository),
});

export const createServices = (config: Extract<AppConfig, { kind: "configured" }>): AppServices => {
  const tokenStore = new AccessTokenStore();
  const client = new GoogleSheetsClient(config.dataSource, tokenStore.get);
  const repository = new GoogleSheetsTransactionRepository(config.dataSource, client);
  return {
    tokenStore,
    transactions: new TransactionQueries(repository),
    dataSource: new DataSourceQueries(repository),
    financialSummary: new GetBasicFinancialSummaryUseCase(repository),
    dashboard: new GetDashboardOverviewUseCase(repository),
    expenses: new GetExpenseAnalysisUseCase(repository),
    monthlyBalance: new GetMonthlyBalanceUseCase(repository),
  };
};

export const createReviewServices = (): AppServices =>
  createServicesFromRepository(
    new InMemoryTransactionRepository(createReviewTransactions(), reviewDataQualityIssues),
  );
