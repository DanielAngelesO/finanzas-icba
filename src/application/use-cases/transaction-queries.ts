import type { TransactionRepository } from "../ports/transaction-repository";
import type {
  LogicalTransaction,
  TransactionActor,
  TransactionCatalogs,
  TransactionDraft,
  TransactionFilters,
} from "../../domain/transaction";

export class TransactionQueries {
  public constructor(private readonly repository: TransactionRepository) {}

  public findAll(filters?: TransactionFilters): Promise<LogicalTransaction[]> {
    return this.repository.findAll(filters);
  }

  public findFirst(limit: number): Promise<LogicalTransaction[]> {
    return this.repository.findAll().then((transactions) => transactions.slice(0, limit));
  }

  public findRecent(limit: number): Promise<LogicalTransaction[]> {
    return this.repository.findRecent(limit);
  }

  public findLast(limit: number, filters?: TransactionFilters): Promise<LogicalTransaction[]> {
    return this.repository.findAll(filters).then((transactions) => transactions.slice(-limit));
  }

  public findById(id: string): Promise<LogicalTransaction | null> {
    return this.repository.findById(id);
  }

  public findByPeriod(period: string): Promise<LogicalTransaction[]> {
    return this.repository.findByPeriod(period);
  }

  public getAvailablePeriods(): Promise<string[]> {
    return this.repository.getAvailablePeriods();
  }

  public getCatalogs(): Promise<TransactionCatalogs> {
    return this.repository.getCatalogs();
  }

  public create(draft: TransactionDraft, actor: TransactionActor): Promise<LogicalTransaction> {
    return this.repository.create(draft, actor);
  }

  public update(
    transactionId: string,
    expectedVersion: number,
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    return this.repository.update(transactionId, expectedVersion, draft, actor);
  }

  public voidTransaction(
    transactionId: string,
    expectedVersion: number,
    reason: string,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    return this.repository.voidTransaction(transactionId, expectedVersion, reason, actor);
  }
}
