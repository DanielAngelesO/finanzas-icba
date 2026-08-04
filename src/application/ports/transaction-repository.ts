import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import type { Transaction, TransactionFilters } from "../../domain/transaction";

export interface TransactionRepository {
  checkConnection(): Promise<DataSourceConnectionResult>;
  getMetadata(): Promise<TransactionDataSourceMetadata>;
  findAll(filters?: TransactionFilters): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  count(filters?: TransactionFilters): Promise<number>;
  findRecent(limit: number): Promise<Transaction[]>;
  findByPeriod(period: string): Promise<Transaction[]>;
  getAvailablePeriods(): Promise<string[]>;
  inspect(): Promise<TransactionInspectionResult>;
  clearCache(): Promise<void>;
}
