import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import type { TransactionRepository } from "../../application/ports/transaction-repository";
import type {
  DataSourceConnectionResult,
  TransactionDataSourceMetadata,
  TransactionInspectionResult,
} from "../../domain/diagnostics";
import {
  TransactionConflictError,
  TransactionWriteUnavailableError,
  type LogicalTransaction,
  type Transaction,
  type TransactionActor,
  type TransactionCatalogItem,
  type TransactionCatalogs,
  type TransactionCategory,
  type TransactionDraft,
  type TransactionFilters,
  type TransactionSubcategory,
  type TransactionThirdParty,
} from "../../domain/transaction";
import {
  createPhysicalTransactionRows,
  createTransactionUuid,
  groupLogicalTransactions,
} from "../../domain/logical-transaction";
import {
  GoogleSheetsClient,
  GoogleSheetsError,
  type GoogleCell,
  type GoogleSheetsBatchRequest,
  type SpreadsheetMetadataResponse,
} from "./google-sheets-client";
import { GoogleSheetsTransactionMapper } from "./google-sheets-transaction-mapper";
import {
  buildAppendRequest,
  buildCatalogAppendRequest,
  buildCatalogCellUpdateRequest,
  buildUpdateRequests,
  inspectTransactionSheetStructure,
  type TransactionSheetStructure,
} from "./google-sheets-transaction-writer";

const catalogSheetNames = [
  "Cuentas",
  "Categorias",
  "Subcategorias",
  "Terceros",
  "Metodos Pago",
] as const;

const maskSpreadsheetId = (id: string): string =>
  id.length <= 8 ? "••••" : `${id.slice(0, 4)}••••${id.slice(-4)}`;

const normalizeText = (value: GoogleCell | undefined): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const normalizeHeader = (value: GoogleCell | undefined): string =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");

const getColumn = (header: GoogleCell[], name: string): number | null => {
  const normalizedName = normalizeHeader(name);
  const index = header.findIndex((value) => normalizeHeader(value) === normalizedName);
  return index >= 0 ? index : null;
};

const readBoolean = (value: GoogleCell | undefined): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeHeader(value);
  return normalized === "true" || normalized === "si" || normalized === "sí" || normalized === "1";
};

const readOrder = (value: GoogleCell | undefined, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRows = (values: GoogleCell[][]): { header: GoogleCell[]; rows: GoogleCell[][] } => ({
  header: values[0] ?? [],
  rows: values.slice(1).filter((row) => row.some((cell) => normalizeText(cell) !== null)),
});

const requireColumns = (
  header: GoogleCell[],
  names: string[],
): ReadonlyMap<string, number> | null => {
  const columns = new Map<string, number>();
  for (const name of names) {
    const index = getColumn(header, name);
    if (index === null) return null;
    columns.set(name, index);
  }
  return columns;
};

const columnValue = (
  row: GoogleCell[],
  columns: ReadonlyMap<string, number>,
  name: string,
): GoogleCell | undefined => {
  const index = columns.get(name);
  return index === undefined ? undefined : row[index];
};

const parseCatalogItemSheet = (
  values: GoogleCell[][],
  activeColumn: "Activa" | "Activo",
): TransactionCatalogItem[] | null => {
  const { header, rows } = getRows(values);
  const columns = requireColumns(header, ["ID", "Nombre", activeColumn, "Orden"]);
  if (!columns) return null;
  return rows.flatMap((row, index) => {
    const id = normalizeText(columnValue(row, columns, "ID"));
    const name = normalizeText(columnValue(row, columns, "Nombre"));
    return id && name
      ? [
          {
            id,
            name,
            active: readBoolean(columnValue(row, columns, activeColumn)),
            order: readOrder(columnValue(row, columns, "Orden"), index + 1),
          },
        ]
      : [];
  });
};

const parseCategories = (values: GoogleCell[][]): TransactionCategory[] | null => {
  const { header, rows } = getRows(values);
  const columns = requireColumns(header, ["ID", "Nombre", "Tipo", "Activa", "Orden"]);
  if (!columns) return null;
  return rows.flatMap((row, index) => {
    const id = normalizeText(columnValue(row, columns, "ID"));
    const name = normalizeText(columnValue(row, columns, "Nombre"));
    const rawType = normalizeHeader(columnValue(row, columns, "Tipo")).toUpperCase();
    const type = rawType === "INGRESO" || rawType === "EGRESO" ? rawType : "AMBOS";
    return id && name
      ? [
          {
            id,
            name,
            type,
            active: readBoolean(columnValue(row, columns, "Activa")),
            order: readOrder(columnValue(row, columns, "Orden"), index + 1),
          },
        ]
      : [];
  });
};

const parseSubcategories = (values: GoogleCell[][]): TransactionSubcategory[] | null => {
  const { header, rows } = getRows(values);
  const columns = requireColumns(header, ["ID", "Categoria ID", "Nombre", "Activa", "Orden"]);
  if (!columns) return null;
  return rows.flatMap((row, index) => {
    const id = normalizeText(columnValue(row, columns, "ID"));
    const categoryId = normalizeText(columnValue(row, columns, "Categoria ID"));
    const name = normalizeText(columnValue(row, columns, "Nombre"));
    return id && categoryId && name
      ? [
          {
            id,
            categoryId,
            name,
            active: readBoolean(columnValue(row, columns, "Activa")),
            order: readOrder(columnValue(row, columns, "Orden"), index + 1),
          },
        ]
      : [];
  });
};

const parseThirdParties = (values: GoogleCell[][]): TransactionThirdParty[] | null => {
  const { header, rows } = getRows(values);
  const columns = requireColumns(header, ["ID", "Nombre", "Rol", "Activo"]);
  if (!columns) return null;
  return rows.flatMap((row) => {
    const id = normalizeText(columnValue(row, columns, "ID"));
    const name = normalizeText(columnValue(row, columns, "Nombre"));
    const rawRole = normalizeHeader(columnValue(row, columns, "Rol")).toUpperCase();
    const role = rawRole === "DONANTE" || rawRole === "PROVEEDOR" ? rawRole : "AMBOS";
    return id && name
      ? [
          {
            id,
            name,
            role,
            active: readBoolean(columnValue(row, columns, "Activo")),
          },
        ]
      : [];
  });
};

const sortCatalogs = <T extends { name: string; order?: number }>(items: T[]): T[] =>
  [...items].sort(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name, "es-PE"),
  );

const fallbackCatalogId = (prefix: string, name: string): string =>
  `${prefix}-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "-")}`;

const deriveReadOnlyCatalogs = (
  transactions: Transaction[],
  reason: string,
): TransactionCatalogs => {
  const names = (values: Iterable<string>): string[] =>
    [...new Set(values)].sort((left, right) => left.localeCompare(right, "es-PE"));
  const accounts = names(transactions.map((transaction) => transaction.account)).map(
    (name, index) => ({
      id: fallbackCatalogId("account", name),
      name,
      active: true,
      order: index + 1,
    }),
  );
  const categoryNames = names(
    transactions
      .filter((transaction) => transaction.type !== "TRANSFERENCIA")
      .map((transaction) => transaction.category),
  );
  const categories: TransactionCategory[] = categoryNames.map((name, index) => ({
    id: fallbackCatalogId("category", name),
    name,
    active: true,
    order: index + 1,
    type: "AMBOS",
  }));
  const categoryIds = new Map(categories.map((category) => [category.name, category.id]));
  const subcategories = transactions.flatMap((transaction, index) => {
    const categoryId = categoryIds.get(transaction.category);
    return transaction.subcategory && categoryId
      ? [
          {
            id: fallbackCatalogId(
              "subcategory",
              `${transaction.category}-${transaction.subcategory}`,
            ),
            categoryId,
            name: transaction.subcategory,
            active: true,
            order: index + 1,
          },
        ]
      : [];
  });
  const thirdParties: TransactionThirdParty[] = names(
    transactions.flatMap((transaction) =>
      transaction.donorOrProvider ? [transaction.donorOrProvider] : [],
    ),
  ).map((name) => ({
    id: fallbackCatalogId("party", name),
    name,
    active: true,
    role: "AMBOS",
  }));
  const paymentMethods = names(transactions.map((transaction) => transaction.paymentMethod)).map(
    (name, index) => ({
      id: fallbackCatalogId("payment", name),
      name,
      active: true,
      order: index + 1,
    }),
  );
  return {
    accounts,
    categories,
    subcategories,
    thirdParties,
    paymentMethods,
    writeCapability: { status: "disabled", reason },
  };
};

interface WriteContext {
  inspection: TransactionInspectionResult;
  metadata: SpreadsheetMetadataResponse;
  structure: TransactionSheetStructure;
}

const actorLabel = (actor: TransactionActor): string =>
  actor.displayName?.trim() || actor.email.trim();

export class GoogleSheetsTransactionRepository implements TransactionRepository {
  private snapshot: TransactionInspectionResult | null = null;
  private catalogSnapshot: TransactionCatalogs | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

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
      readOnly: !this.config.writesEnabled,
    };
  }

  public async findAll(filters?: TransactionFilters): Promise<LogicalTransaction[]> {
    const inspection = await this.loadSnapshot();
    return groupLogicalTransactions(inspection.transactions).filter(
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
    if (this.catalogSnapshot) return this.catalogSnapshot;
    const inspection = await this.loadSnapshot();
    if (!this.config.writesEnabled) {
      this.catalogSnapshot = deriveReadOnlyCatalogs(
        inspection.transactions,
        "La escritura está desactivada hasta completar la migración del módulo.",
      );
      return this.catalogSnapshot;
    }

    try {
      const metadata = await this.client.getMetadata();
      const missingSheets = catalogSheetNames.filter(
        (sheetName) => !metadata.sheetNames.includes(sheetName),
      );
      if (missingSheets.length > 0) {
        this.catalogSnapshot = deriveReadOnlyCatalogs(
          inspection.transactions,
          `Faltan las pestañas de catálogo: ${missingSheets.join(", ")}.`,
        );
        return this.catalogSnapshot;
      }
      const [accountsData, categoriesData, subcategoriesData, partiesData, methodsData] =
        await Promise.all(
          catalogSheetNames.map((sheetName) => this.client.getValues(sheetName, "A:Z")),
        );
      const accounts = accountsData ? parseCatalogItemSheet(accountsData, "Activa") : null;
      const categories = categoriesData ? parseCategories(categoriesData) : null;
      const subcategories = subcategoriesData ? parseSubcategories(subcategoriesData) : null;
      const thirdParties = partiesData ? parseThirdParties(partiesData) : null;
      const paymentMethods = methodsData ? parseCatalogItemSheet(methodsData, "Activo") : null;
      if (!accounts || !categories || !subcategories || !thirdParties || !paymentMethods) {
        this.catalogSnapshot = deriveReadOnlyCatalogs(
          inspection.transactions,
          "Uno o más catálogos no tienen los encabezados requeridos.",
        );
        return this.catalogSnapshot;
      }
      const transactionSheet = metadata.sheets.find(
        (sheet) => sheet.title === this.config.sheetName,
      );
      const values = await this.client.getValues();
      if (!transactionSheet) {
        this.catalogSnapshot = deriveReadOnlyCatalogs(
          inspection.transactions,
          "No se encontró la pestaña de transacciones.",
        );
        return this.catalogSnapshot;
      }
      const structureResult = inspectTransactionSheetStructure(
        values,
        this.config,
        transactionSheet.id,
      );
      if (!structureResult.structure) {
        this.catalogSnapshot = deriveReadOnlyCatalogs(
          inspection.transactions,
          `Faltan columnas para escritura: ${structureResult.missingColumns.join(", ")}.`,
        );
        return this.catalogSnapshot;
      }
      this.catalogSnapshot = {
        accounts: sortCatalogs(accounts),
        categories: sortCatalogs(categories),
        subcategories: sortCatalogs(subcategories),
        thirdParties: sortCatalogs(thirdParties),
        paymentMethods: sortCatalogs(paymentMethods),
        writeCapability: { status: "enabled", reason: null },
      };
      return this.catalogSnapshot;
    } catch (error: unknown) {
      this.catalogSnapshot = deriveReadOnlyCatalogs(
        inspection.transactions,
        error instanceof GoogleSheetsError && error.status === 403
          ? "Tu cuenta puede consultar esta hoja, pero no editarla. Solicita acceso de Editor."
          : "No se pudieron cargar los catálogos requeridos para escribir.",
      );
      return this.catalogSnapshot;
    }
  }

  public create(draft: TransactionDraft, actor: TransactionActor): Promise<LogicalTransaction> {
    return this.enqueueWrite(async () => {
      const context = await this.getWriteContext();
      const transactionId = createTransactionUuid();
      const rows = createPhysicalTransactionRows(draft, { actor, transactionId });
      const catalogRequests = await this.buildThirdPartyCatalogRequests(draft, context);
      const localResult = groupLogicalTransactions(rows)[0];
      if (!localResult) throw new Error("No se pudo construir la transacción creada.");
      const verified = await this.executeWithVerification(
        [...catalogRequests, buildAppendRequest(rows, context.structure)],
        () => this.findFreshById(transactionId),
      );
      await this.clearCache();
      return verified ?? localResult;
    });
  }

  public update(
    transactionId: string,
    expectedVersion: number,
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    return this.enqueueWrite(async () => {
      const context = await this.getWriteContext();
      const current = this.requireCurrent(context.inspection, transactionId, expectedVersion);
      if (current.status === "VOIDED")
        throw new Error("Una transacción anulada no puede editarse.");
      const currentRows = this.rowsFor(context.inspection.transactions, current);
      const now = new Date();

      if (current.type !== draft.type) {
        const correctionId = createTransactionUuid();
        const voidedRows = this.toVoidedRows(
          currentRows,
          actor,
          "Corrección por cambio de tipo",
          now,
          correctionId,
        );
        const correctionRows = createPhysicalTransactionRows(draft, {
          actor,
          correctsTransactionId: current.transactionId,
          now,
          transactionId: correctionId,
        });
        const localCorrection = groupLogicalTransactions(correctionRows)[0];
        const catalogRequests = await this.buildThirdPartyCatalogRequests(draft, context);
        if (!localCorrection) throw new Error("No se pudo construir la transacción corregida.");
        const verified = await this.executeWithVerification(
          [
            ...catalogRequests,
            ...buildUpdateRequests(voidedRows, context.structure),
            buildAppendRequest(correctionRows, context.structure),
          ],
          () => this.findFreshById(correctionId),
        );
        await this.clearCache();
        return verified ?? localCorrection;
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
      const localResult = groupLogicalTransactions(replacementRows)[0];
      const catalogRequests = await this.buildThirdPartyCatalogRequests(draft, context);
      if (!localResult) throw new Error("No se pudo construir la transacción actualizada.");
      const verified = await this.executeWithVerification(
        [...catalogRequests, ...buildUpdateRequests(replacementRows, context.structure)],
        async () => {
          const latest = await this.findFreshById(current.transactionId);
          return latest?.version === current.version + 1 ? latest : null;
        },
      );
      await this.clearCache();
      return verified ?? localResult;
    });
  }

  public voidTransaction(
    transactionId: string,
    expectedVersion: number,
    reason: string,
    actor: TransactionActor,
  ): Promise<LogicalTransaction> {
    return this.enqueueWrite(async () => {
      const normalizedReason = reason.trim();
      if (!normalizedReason) throw new Error("El motivo de anulación es obligatorio.");
      const context = await this.getWriteContext();
      const current = this.requireCurrent(context.inspection, transactionId, expectedVersion);
      if (current.status === "VOIDED") return current;
      const rows = this.toVoidedRows(
        this.rowsFor(context.inspection.transactions, current),
        actor,
        normalizedReason,
        new Date(),
      );
      const localResult = groupLogicalTransactions(rows)[0];
      if (!localResult) throw new Error("No se pudo construir la transacción anulada.");
      const verified = await this.executeWithVerification(
        buildUpdateRequests(rows, context.structure),
        async () => {
          const latest = await this.findFreshById(current.transactionId);
          return latest?.status === "VOIDED" ? latest : null;
        },
      );
      await this.clearCache();
      return verified ?? localResult;
    });
  }

  public inspect(): Promise<TransactionInspectionResult> {
    return this.loadSnapshot();
  }

  public async clearCache(): Promise<void> {
    this.snapshot = null;
    this.catalogSnapshot = null;
  }

  private async loadSnapshot(): Promise<TransactionInspectionResult> {
    if (this.snapshot) return this.snapshot;
    const startedAt = performance.now();
    const values = await this.client.getValues();
    this.snapshot = this.mapper.map(values, Math.round(performance.now() - startedAt));
    return this.snapshot;
  }

  private async getWriteContext(): Promise<WriteContext> {
    const catalogs = await this.getCatalogs();
    if (catalogs.writeCapability.status === "disabled") {
      throw new TransactionWriteUnavailableError(catalogs.writeCapability.reason);
    }
    const [metadata, values] = await Promise.all([
      this.client.getMetadata(),
      this.client.getValues(),
    ]);
    const transactionSheet = metadata.sheets.find((sheet) => sheet.title === this.config.sheetName);
    if (!transactionSheet) {
      throw new TransactionWriteUnavailableError("No se encontró la pestaña de transacciones.");
    }
    const structureResult = inspectTransactionSheetStructure(
      values,
      this.config,
      transactionSheet.id,
    );
    if (!structureResult.structure) {
      throw new TransactionWriteUnavailableError(
        `Faltan columnas para escritura: ${structureResult.missingColumns.join(", ")}.`,
      );
    }
    return {
      inspection: this.mapper.map(values),
      metadata,
      structure: structureResult.structure,
    };
  }

  private async buildThirdPartyCatalogRequests(
    draft: TransactionDraft,
    context: WriteContext,
  ): Promise<GoogleSheetsBatchRequest[]> {
    if (
      draft.type === "TRANSFERENCIA" ||
      !draft.thirdParty ||
      !draft.thirdParty.id.startsWith("new-")
    ) {
      return [];
    }
    const sheet = context.metadata.sheets.find((entry) => entry.title === "Terceros");
    if (!sheet) {
      throw new TransactionWriteUnavailableError("No se encontró la pestaña Terceros.");
    }
    const values = await this.client.getValues("Terceros", "A:Z");
    const header = values[0] ?? [];
    const idColumn = getColumn(header, "ID");
    const nameColumn = getColumn(header, "Nombre");
    const roleColumn = getColumn(header, "Rol");
    const activeColumn = getColumn(header, "Activo");
    if (idColumn === null || nameColumn === null || roleColumn === null || activeColumn === null) {
      throw new TransactionWriteUnavailableError(
        "La pestaña Terceros no tiene los encabezados requeridos.",
      );
    }
    const normalizedName = normalizeHeader(draft.thirdParty.name);
    const existingRowIndex = values
      .slice(1)
      .findIndex((row) => normalizeHeader(row[nameColumn]) === normalizedName);
    const desiredRole = draft.type === "INGRESO" ? "DONANTE" : "PROVEEDOR";
    if (existingRowIndex >= 0) {
      const row = values[existingRowIndex + 1] ?? [];
      const existingRole = normalizeHeader(row[roleColumn]).toUpperCase();
      return existingRole === desiredRole || existingRole === "AMBOS"
        ? []
        : [buildCatalogCellUpdateRequest(sheet.id, existingRowIndex + 2, roleColumn, "AMBOS")];
    }
    return [
      buildCatalogAppendRequest(sheet.id, header, {
        ID: createTransactionUuid(),
        Nombre: draft.thirdParty.name,
        Rol: desiredRole,
        Activo: true,
      }),
    ];
  }

  private requireCurrent(
    inspection: TransactionInspectionResult,
    transactionId: string,
    expectedVersion: number,
  ): LogicalTransaction {
    const current = groupLogicalTransactions(inspection.transactions).find(
      (transaction) => transaction.transactionId === transactionId,
    );
    if (!current) throw new Error("No se encontró la transacción.");
    if (current.version !== expectedVersion) throw new TransactionConflictError();
    return current;
  }

  private rowsFor(rows: Transaction[], logical: LogicalTransaction): Transaction[] {
    const ids = new Set(logical.rowIds);
    return rows.filter((row) => ids.has(row.id));
  }

  private toVoidedRows(
    rows: Transaction[],
    actor: TransactionActor,
    reason: string,
    now: Date,
    correctedBy: string | null = null,
  ): Transaction[] {
    return rows.map((row) => ({
      ...row,
      status: "VOIDED",
      version: row.version + 1,
      updatedAt: now,
      updatedBy: actorLabel(actor),
      voidedAt: now,
      voidedBy: actorLabel(actor),
      voidReason: reason,
      correctedBy,
    }));
  }

  private async findFreshById(transactionId: string): Promise<LogicalTransaction | null> {
    const values = await this.client.getValues();
    const inspection = this.mapper.map(values);
    return (
      groupLogicalTransactions(inspection.transactions).find(
        (transaction) => transaction.transactionId === transactionId,
      ) ?? null
    );
  }

  private async executeWithVerification(
    requests: Parameters<GoogleSheetsClient["batchUpdate"]>[0],
    verify: () => Promise<LogicalTransaction | null>,
  ): Promise<LogicalTransaction | null> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.client.batchUpdate(requests);
        return null;
      } catch (error: unknown) {
        if (error instanceof GoogleSheetsError && error.status === 403) {
          throw new TransactionWriteUnavailableError(
            "Tu cuenta puede consultar esta hoja, pero no editarla. Solicita acceso de Editor.",
          );
        }
        if (!(error instanceof GoogleSheetsError) || !error.retryable) throw error;
        const existing = await verify();
        if (existing) return existing;
        if (attempt === 3) throw error;
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, Math.min(1_600, 250 * 2 ** (attempt - 1))),
        );
      }
    }
    return null;
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
