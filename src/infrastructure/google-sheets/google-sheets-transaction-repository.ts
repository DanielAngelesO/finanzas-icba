import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import type { TransactionRepository } from "../../application/ports/transaction-repository";
import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import type { Transaction, TransactionFilters } from "../../domain/transaction";
import { GoogleSheetsClient } from "./google-sheets-client";
import { GoogleSheetsTransactionMapper } from "./google-sheets-transaction-mapper";

const maskSpreadsheetId = (id: string): string =>
  id.length <= 8 ? "••••" : `${id.slice(0, 4)}••••${id.slice(-4)}`;

export class GoogleSheetsTransactionRepository implements TransactionRepository {
  private snapshot: TransactionInspectionResult | null = null;

  public constructor(
    private readonly config: GoogleSheetsDataSourceConfig,
    private readonly client: GoogleSheetsClient,
    private readonly mapper = new GoogleSheetsTransactionMapper(config),
  ) {}

  public async checkConnection(): Promise<DataSourceConnectionResult> {
    const startedAt = performance.now();
    try {
      const metadata = await this.client.getMetadata();
      const hasSheet = metadata.sheetNames.includes(this.config.sheetName);
      return {
        status: hasSheet ? "CONNECTED" : "ERROR",
        message: hasSheet
          ? "Conexión con Google Sheets confirmada."
          : "No existe la pestaña configurada.",
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
      };
    } catch (error: unknown) {
      return {
        status: "ERROR",
        message: error instanceof Error ? error.message : "No fue posible comprobar la conexión.",
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
      };
    }
  }

  public async getMetadata(): Promise<TransactionDataSourceMetadata> {
    const metadata = await this.client.getMetadata();
    return {
      provider: "google-sheets",
      spreadsheetIdMasked: maskSpreadsheetId(metadata.id),
      spreadsheetTitle: metadata.title,
      sheetName: this.config.sheetName,
      availableSheets: metadata.sheetNames,
      headerRow: this.config.headerRow,
      firstDataRow: this.config.firstDataRow,
      timezone: this.config.timezone,
      locale: this.config.locale,
      activeYear: this.config.activeYear,
      readOnly: true,
    };
  }

  public async findAll(filters?: TransactionFilters): Promise<Transaction[]> {
    const inspection = await this.loadSnapshot();
    return inspection.transactions.filter((transaction) => this.matches(transaction, filters));
  }

  public async findById(id: string): Promise<Transaction | null> {
    const transactions = await this.findAll();
    return transactions.find((transaction) => transaction.id === id.trim()) ?? null;
  }

  public async count(filters?: TransactionFilters): Promise<number> {
    return (await this.findAll(filters)).length;
  }

  public async findRecent(limit: number): Promise<Transaction[]> {
    return (await this.findAll())
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, Math.max(0, limit));
  }

  public findByPeriod(period: string): Promise<Transaction[]> {
    return this.findAll({ period });
  }

  public async getAvailablePeriods(): Promise<string[]> {
    return [...new Set((await this.findAll()).map((transaction) => transaction.period))]
      .sort()
      .reverse();
  }

  public inspect(): Promise<TransactionInspectionResult> {
    return this.loadSnapshot();
  }

  public async clearCache(): Promise<void> {
    this.snapshot = null;
  }

  private async loadSnapshot(): Promise<TransactionInspectionResult> {
    if (this.snapshot) return this.snapshot;
    const startedAt = performance.now();
    const values = await this.client.getValues();
    this.snapshot = this.mapper.map(values, Math.round(performance.now() - startedAt));
    return this.snapshot;
  }

  private matches(transaction: Transaction, filters: TransactionFilters | undefined): boolean {
    return (
      (!filters?.period || transaction.period === filters.period) &&
      (!filters?.type || transaction.type === filters.type)
    );
  }
}
