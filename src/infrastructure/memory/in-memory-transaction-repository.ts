import type { TransactionRepository } from "../../application/ports/transaction-repository";
import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import type { Transaction, TransactionFilters } from "../../domain/transaction";

export class InMemoryTransactionRepository implements TransactionRepository {
  public constructor(
    private readonly transactions: Transaction[] = [],
    private readonly issues: TransactionInspectionResult["issues"] = [],
  ) {}

  public async checkConnection(): Promise<DataSourceConnectionResult> {
    return {
      status: "CONNECTED",
      message: "Repositorio en memoria disponible.",
      latencyMs: 0,
      checkedAt: new Date(),
    };
  }

  public async getMetadata(): Promise<TransactionDataSourceMetadata> {
    return {
      provider: "memory",
      spreadsheetIdMasked: "••••",
      spreadsheetTitle: null,
      sheetName: "Memoria",
      availableSheets: ["Memoria"],
      headerRow: 1,
      firstDataRow: 2,
      timezone: "America/Lima",
      locale: "es-PE",
      activeYear: null,
      readOnly: true,
    };
  }

  public async findAll(filters?: TransactionFilters): Promise<Transaction[]> {
    return this.transactions.filter(
      (transaction) =>
        (!filters?.period || transaction.period === filters.period) &&
        (!filters?.type || transaction.type === filters.type),
    );
  }

  public async findById(id: string): Promise<Transaction | null> {
    return this.transactions.find((transaction) => transaction.id === id) ?? null;
  }

  public async count(filters?: TransactionFilters): Promise<number> {
    return (await this.findAll(filters)).length;
  }

  public async findRecent(limit: number): Promise<Transaction[]> {
    return [...this.transactions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  public findByPeriod(period: string): Promise<Transaction[]> {
    return this.findAll({ period });
  }

  public async getAvailablePeriods(): Promise<string[]> {
    return [...new Set(this.transactions.map((transaction) => transaction.period))]
      .sort()
      .reverse();
  }

  public async inspect(): Promise<TransactionInspectionResult> {
    return {
      transactions: this.transactions,
      issues: this.issues,
      missingColumns: [],
      duplicateIds: [],
      totalDataRowCount:
        this.transactions.length + this.issues.filter((entry) => entry.severity === "error").length,
      validTransactionCount: this.transactions.length,
      invalidTransactionCount: this.issues.filter((entry) => entry.severity === "error").length,
      latencyMs: 0,
      inspectedAt: new Date(),
    };
  }

  public async clearCache(): Promise<void> {}
}
