import type { TransactionRepository } from "../../application/ports/transaction-repository";
import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import {
  TransactionConflictError,
  type LogicalTransaction,
  type Transaction,
  type TransactionActor,
  type TransactionCatalogItem,
  type TransactionCatalogs,
  type TransactionDraft,
  type TransactionFilters,
  type TransactionThirdParty,
} from "../../domain/transaction";
import {
  createPhysicalTransactionRows,
  createTransactionUuid,
  groupLogicalTransactions,
} from "../../domain/logical-transaction";

const collator = new Intl.Collator("es-PE", { sensitivity: "base", numeric: true });

const catalogId = (prefix: string, name: string): string =>
  `${prefix}-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

const uniqueNames = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort(collator.compare);

const toItems = (prefix: string, values: Iterable<string>): TransactionCatalogItem[] =>
  uniqueNames(values).map((name, index) => ({
    id: catalogId(prefix, name),
    name,
    active: true,
    order: index + 1,
  }));

const actorLabel = (actor: TransactionActor): string =>
  actor.displayName?.trim() || actor.email.trim();

export class InMemoryTransactionRepository implements TransactionRepository {
  private transactions: Transaction[];

  public constructor(
    transactions: Transaction[] = [],
    private readonly issues: TransactionInspectionResult["issues"] = [],
  ) {
    this.transactions = [...transactions];
  }

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
      readOnly: false,
    };
  }

  public async findAll(filters?: TransactionFilters): Promise<LogicalTransaction[]> {
    return groupLogicalTransactions(this.transactions).filter(
      (transaction) =>
        (!filters?.period || transaction.period === filters.period) &&
        (!filters?.type || transaction.type === filters.type) &&
        (!filters?.status || transaction.status === filters.status),
    );
  }

  public async findById(id: string): Promise<LogicalTransaction | null> {
    const normalized = id.trim();
    return (
      (await this.findAll()).find(
        (transaction) =>
          transaction.transactionId === normalized || transaction.rowIds.includes(normalized),
      ) ?? null
    );
  }

  public async count(filters?: TransactionFilters): Promise<number> {
    return (await this.findAll(filters)).length;
  }

  public async findRecent(limit: number): Promise<LogicalTransaction[]> {
    return (await this.findAll())
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, Math.max(0, limit));
  }

  public findByPeriod(period: string): Promise<LogicalTransaction[]> {
    return this.findAll({ period });
  }

  public async getAvailablePeriods(): Promise<string[]> {
    return [...new Set((await this.findAll()).map((transaction) => transaction.period))]
      .sort()
      .reverse();
  }

  public async getCatalogs(): Promise<TransactionCatalogs> {
    const accountItems = toItems(
      "account",
      this.transactions.map((transaction) => transaction.account),
    );
    const categoryNames = uniqueNames(
      this.transactions
        .filter((transaction) => transaction.type !== "TRANSFERENCIA")
        .map((transaction) => transaction.category),
    );
    const categories = categoryNames.map((name, index) => {
      const types = new Set(
        this.transactions.flatMap((transaction) =>
          transaction.type !== "TRANSFERENCIA" && transaction.category === name
            ? [transaction.type]
            : [],
        ),
      );
      return {
        id: catalogId("category", name),
        name,
        active: true,
        order: index + 1,
        type: types.size > 1 ? ("AMBOS" as const) : (types.values().next().value ?? "AMBOS"),
      };
    });
    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
    const subcategories = uniqueNames(
      this.transactions.flatMap((transaction) =>
        transaction.subcategory ? [`${transaction.category}\u0000${transaction.subcategory}`] : [],
      ),
    ).flatMap((value, index) => {
      const [categoryName, name] = value.split("\u0000");
      const categoryId = categoryName ? categoryIdByName.get(categoryName) : undefined;
      return categoryId && name
        ? [
            {
              id: catalogId("subcategory", `${categoryName}-${name}`),
              categoryId,
              name,
              active: true,
              order: index + 1,
            },
          ]
        : [];
    });
    const partyNames = uniqueNames(
      this.transactions.flatMap((transaction) =>
        transaction.donorOrProvider ? [transaction.donorOrProvider] : [],
      ),
    );
    const thirdParties: TransactionThirdParty[] = partyNames.map((name) => {
      const roles = new Set(
        this.transactions
          .filter((transaction) => transaction.donorOrProvider === name)
          .flatMap((transaction) =>
            transaction.type === "INGRESO"
              ? (["DONANTE"] as const)
              : transaction.type === "EGRESO"
                ? (["PROVEEDOR"] as const)
                : [],
          ),
      );
      return {
        id: catalogId("party", name),
        name,
        active: true,
        role: roles.size > 1 ? "AMBOS" : roles.has("DONANTE") ? "DONANTE" : "PROVEEDOR",
      };
    });

    return {
      accounts: accountItems,
      categories,
      subcategories,
      thirdParties,
      paymentMethods: toItems(
        "payment",
        this.transactions.map((transaction) => transaction.paymentMethod),
      ),
      writeCapability: { status: "enabled", reason: null },
    };
  }

  public async create(
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    const rows = createPhysicalTransactionRows(draft, { actor });
    this.transactions.push(...rows);
    const created = groupLogicalTransactions(rows)[0];
    if (!created) throw new Error("No se pudo construir la transacción creada.");
    return created;
  }

  public async update(
    transactionId: string,
    expectedVersion: number,
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    const current = await this.requireCurrent(transactionId, expectedVersion);
    if (current.status === "VOIDED") throw new Error("Una transacción anulada no puede editarse.");
    const currentRows = this.rowsFor(current);
    const now = new Date();

    if (current.type !== draft.type) {
      const correctionId = createTransactionUuid();
      this.voidRows(currentRows, actor, "Corrección por cambio de tipo", now, correctionId);
      const correctionRows = createPhysicalTransactionRows(draft, {
        actor,
        correctsTransactionId: current.transactionId,
        now,
        transactionId: correctionId,
      });
      this.transactions.push(...correctionRows);
      const correction = groupLogicalTransactions(correctionRows)[0];
      if (!correction) throw new Error("No se pudo construir la transacción corregida.");
      return correction;
    }

    const replacementRows = createPhysicalTransactionRows(draft, {
      actor,
      now,
      rowIds: current.rowIds,
      transactionId: current.transactionId,
      version: current.version + 1,
    }).map((row, index) => {
      const previous = currentRows[index];
      return {
        ...row,
        rowNumber: previous?.rowNumber ?? null,
        createdAt: previous?.createdAt ?? row.createdAt,
        createdBy: previous?.createdBy ?? row.createdBy,
        updatedAt: now,
        updatedBy: actorLabel(actor),
        correctsTransactionId: previous?.correctsTransactionId ?? null,
        correctedBy: previous?.correctedBy ?? null,
      };
    });
    const replacedIds = new Set(current.rowIds);
    this.transactions = this.transactions.filter((row) => !replacedIds.has(row.id));
    this.transactions.push(...replacementRows);
    const updated = groupLogicalTransactions(replacementRows)[0];
    if (!updated) throw new Error("No se pudo construir la transacción actualizada.");
    return updated;
  }

  public async voidTransaction(
    transactionId: string,
    expectedVersion: number,
    reason: string,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new Error("El motivo de anulación es obligatorio.");
    const current = await this.requireCurrent(transactionId, expectedVersion);
    if (current.status === "VOIDED") return current;
    const rows = this.rowsFor(current);
    this.voidRows(rows, actor, normalizedReason, new Date());
    const voided = groupLogicalTransactions(rows)[0];
    if (!voided) throw new Error("No se pudo construir la transacción anulada.");
    return voided;
  }

  public async inspect(): Promise<TransactionInspectionResult> {
    return {
      transactions: [...this.transactions],
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

  private rowsFor(transaction: LogicalTransaction): Transaction[] {
    const ids = new Set(transaction.rowIds);
    return this.transactions.filter((row) => ids.has(row.id));
  }

  private async requireCurrent(
    transactionId: string,
    expectedVersion: number,
  ): Promise<LogicalTransaction> {
    const current = await this.findById(transactionId);
    if (!current) throw new Error("No se encontró la transacción.");
    if (current.version !== expectedVersion) throw new TransactionConflictError();
    return current;
  }

  private voidRows(
    rows: Transaction[],
    actor: TransactionActor,
    reason: string,
    now: Date,
    correctedBy: string | null = null,
  ): void {
    rows.forEach((row) => {
      row.status = "VOIDED";
      row.version += 1;
      row.updatedAt = now;
      row.updatedBy = actorLabel(actor);
      row.voidedAt = now;
      row.voidedBy = actorLabel(actor);
      row.voidReason = reason;
      row.correctedBy = correctedBy;
    });
  }
}
