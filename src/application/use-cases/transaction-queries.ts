import type { TransactionRepository } from "../ports/transaction-repository";
import type { Transaction, TransactionFilters } from "../../domain/transaction";

export class TransactionQueries {
  public constructor(private readonly repository: TransactionRepository) {}

  public findAll(filters?: TransactionFilters): Promise<Transaction[]> {
    return this.repository.findAll(filters);
  }

  public findFirst(limit: number): Promise<Transaction[]> {
    return this.repository.findAll().then((transactions) => transactions.slice(0, limit));
  }

  public findRecent(limit: number): Promise<Transaction[]> {
    return this.repository.findRecent(limit);
  }

  public findLast(limit: number, filters?: TransactionFilters): Promise<Transaction[]> {
    return this.repository.findAll(filters).then((transactions) => transactions.slice(-limit));
  }

  public findById(id: string): Promise<Transaction | null> {
    return this.repository.findById(id);
  }

  public findByPeriod(period: string): Promise<Transaction[]> {
    return this.repository.findByPeriod(period);
  }

  public getAvailablePeriods(): Promise<string[]> {
    return this.repository.getAvailablePeriods();
  }
}
