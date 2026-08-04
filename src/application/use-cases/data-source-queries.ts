import type { TransactionRepository } from "../ports/transaction-repository";

export class DataSourceQueries {
  public constructor(private readonly repository: TransactionRepository) {}

  public checkConnection() {
    return this.repository.checkConnection();
  }

  public getMetadata() {
    return this.repository.getMetadata();
  }

  public inspect() {
    return this.repository.inspect();
  }

  public clearCache() {
    return this.repository.clearCache();
  }
}
