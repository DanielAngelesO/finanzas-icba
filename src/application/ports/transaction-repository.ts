import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import type {
  LogicalTransaction,
  TransactionActor,
  TransactionCatalogs,
  TransactionDraft,
  TransactionFilters,
} from "../../domain/transaction";

export interface TransactionRepository {
  checkConnection(): Promise<DataSourceConnectionResult>;
  getMetadata(): Promise<TransactionDataSourceMetadata>;
  findAll(filters?: TransactionFilters): Promise<LogicalTransaction[]>;
  findById(id: string): Promise<LogicalTransaction | null>;
  count(filters?: TransactionFilters): Promise<number>;
  findRecent(limit: number): Promise<LogicalTransaction[]>;
  findByPeriod(period: string): Promise<LogicalTransaction[]>;
  getAvailablePeriods(): Promise<string[]>;
  getCatalogs(): Promise<TransactionCatalogs>;
  create(draft: TransactionDraft, actor: TransactionActor): Promise<LogicalTransaction>;
  update(
    transactionId: string,
    expectedVersion: number,
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction>;
  voidTransaction(
    transactionId: string,
    expectedVersion: number,
    reason: string,
    actor: TransactionActor,
  ): Promise<LogicalTransaction>;
  inspect(): Promise<TransactionInspectionResult>;
  clearCache(): Promise<void>;
}
