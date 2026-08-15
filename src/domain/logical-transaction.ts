import { z } from "zod";
import type {
  CatalogSelection,
  LogicalTransaction,
  Transaction,
  TransactionActor,
  TransactionAudit,
  TransactionDraft,
} from "./transaction";

const selectionSchema = z.object({
  id: z.string().trim().min(1, "Selecciona una opción."),
  name: z.string().trim().min(1, "Selecciona una opción."),
});

const nullableTextSchema = z.string().trim().min(1).nullable();
const baseDraftShape = {
  amount: z
    .number()
    .finite()
    .positive("Ingresa un monto mayor que cero.")
    .refine((amount) => Number.isInteger(amount * 100), "Usa como máximo dos decimales."),
  date: z.date(),
  description: nullableTextSchema,
  notes: nullableTextSchema,
  responsible: z.string().trim().min(1, "Identifica al responsable."),
};

const singleDraftShape = {
  ...baseDraftShape,
  account: selectionSchema,
  category: selectionSchema,
  subcategory: selectionSchema.nullable(),
  paymentMethod: selectionSchema,
  thirdParty: selectionSchema.nullable(),
  referenceOrReceipt: nullableTextSchema,
};

export const transactionDraftSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("INGRESO"), ...singleDraftShape }),
    z.object({ type: z.literal("EGRESO"), ...singleDraftShape }),
    z.object({
      type: z.literal("TRANSFERENCIA"),
      ...baseDraftShape,
      originAccount: selectionSchema,
      destinationAccount: selectionSchema,
    }),
  ])
  .superRefine((draft, context) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (draft.date.getTime() > today.getTime()) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "La fecha no puede estar en el futuro.",
      });
    }
    if (draft.type === "TRANSFERENCIA" && draft.originAccount.id === draft.destinationAccount.id) {
      context.addIssue({
        code: "custom",
        path: ["destinationAccount"],
        message: "La cuenta de destino debe ser distinta de la cuenta de origen.",
      });
    }
  });

export interface TransactionDraftValidationResult {
  valid: boolean;
  fieldErrors: Readonly<Record<string, string>>;
}

export const validateTransactionDraft = (
  draft: TransactionDraft,
): TransactionDraftValidationResult => {
  const result = transactionDraftSchema.safeParse(draft);
  if (result.success) return { valid: true, fieldErrors: {} };
  const fieldErrors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const field = String(issue.path[0] ?? "form");
    if (!(field in fieldErrors)) fieldErrors[field] = issue.message;
  });
  return { valid: false, fieldErrors };
};

let fallbackIdSequence = 0;

export const createTransactionUuid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackIdSequence += 1;
  return `tx-${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}`;
};

export const deriveTransactionPeriod = (date: Date): string =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

const toAudit = (transaction: Transaction): TransactionAudit => ({
  createdAt: transaction.createdAt,
  createdBy: transaction.createdBy,
  updatedAt: transaction.updatedAt,
  updatedBy: transaction.updatedBy,
  voidedAt: transaction.voidedAt,
  voidedBy: transaction.voidedBy,
  voidReason: transaction.voidReason,
  correctsTransactionId: transaction.correctsTransactionId,
  correctedBy: transaction.correctedBy,
});

const toSingleLogicalTransaction = (transaction: Transaction): LogicalTransaction | null => {
  if (transaction.type === "TRANSFERENCIA") return null;
  return {
    kind: "single",
    transactionId: transaction.transactionId,
    rowIds: [transaction.id],
    date: transaction.date,
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    period: transaction.period,
    version: transaction.version,
    description: transaction.description,
    responsible: transaction.responsible,
    notes: transaction.notes,
    audit: toAudit(transaction),
    account: transaction.account,
    category: transaction.category,
    subcategory: transaction.subcategory,
    donorOrProvider: transaction.donorOrProvider,
    paymentMethod: transaction.paymentMethod,
    referenceOrReceipt: transaction.referenceOrReceipt,
  };
};

const toTransferLogicalTransaction = (transactions: Transaction[]): LogicalTransaction | null => {
  if (transactions.length !== 2) return null;
  const origin = transactions.find((transaction) => transaction.accountFlow === "OUTFLOW");
  const destination = transactions.find((transaction) => transaction.accountFlow === "INFLOW");
  if (!origin || !destination || origin.transactionId !== destination.transactionId) return null;
  return {
    kind: "transfer",
    transactionId: origin.transactionId,
    rowIds: [origin.id, destination.id],
    date: origin.date,
    type: "TRANSFERENCIA",
    amount: origin.amount,
    status: origin.status,
    period: origin.period,
    version: Math.max(origin.version, destination.version),
    description: origin.description ?? destination.description,
    responsible: origin.responsible,
    notes: origin.notes ?? destination.notes,
    audit: toAudit(origin),
    originAccount: origin.account,
    destinationAccount: destination.account,
  };
};

export const groupLogicalTransactions = (transactions: Transaction[]): LogicalTransaction[] => {
  const singles: LogicalTransaction[] = [];
  const transfers = new Map<string, Transaction[]>();

  transactions.forEach((transaction) => {
    if (transaction.type !== "TRANSFERENCIA") {
      const logical = toSingleLogicalTransaction(transaction);
      if (logical) singles.push(logical);
      return;
    }
    const group = transfers.get(transaction.transactionId) ?? [];
    group.push(transaction);
    transfers.set(transaction.transactionId, group);
  });

  transfers.forEach((rows) => {
    const logical = toTransferLogicalTransaction(rows);
    if (logical) singles.push(logical);
  });

  return singles;
};

interface CreateRowsOptions {
  actor: TransactionActor;
  correctsTransactionId?: string | null;
  now?: Date;
  rowIds?: readonly string[];
  transactionId?: string;
  version?: number;
}

const getActorLabel = (actor: TransactionActor): string =>
  actor.displayName?.trim() || actor.email.trim();

const buildBaseRow = (
  draft: TransactionDraft,
  options: Required<Omit<CreateRowsOptions, "rowIds" | "correctsTransactionId">> & {
    correctsTransactionId: string | null;
  },
): Omit<
  Transaction,
  | "id"
  | "rowNumber"
  | "type"
  | "accountFlow"
  | "account"
  | "transferId"
  | "category"
  | "subcategory"
  | "donorOrProvider"
  | "paymentMethod"
  | "referenceOrReceipt"
> => ({
  transactionId: options.transactionId,
  date: draft.date,
  description: draft.description,
  responsible: draft.responsible,
  amount: draft.amount,
  status: "CONFIRMED",
  period: deriveTransactionPeriod(draft.date),
  notes: draft.notes,
  version: options.version,
  createdAt: options.now,
  createdBy: getActorLabel(options.actor),
  updatedAt: null,
  updatedBy: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  correctsTransactionId: options.correctsTransactionId,
  correctedBy: null,
});

export const createPhysicalTransactionRows = (
  draft: TransactionDraft,
  options: CreateRowsOptions,
): Transaction[] => {
  const validation = validateTransactionDraft(draft);
  if (!validation.valid) throw new Error("El borrador de transacción contiene datos inválidos.");
  const now = options.now ?? new Date();
  const transactionId = options.transactionId ?? createTransactionUuid();
  const version = options.version ?? 1;
  const common = buildBaseRow(draft, {
    actor: options.actor,
    correctsTransactionId: options.correctsTransactionId ?? null,
    now,
    transactionId,
    version,
  });

  if (draft.type !== "TRANSFERENCIA") {
    const rowId = options.rowIds?.[0] ?? createTransactionUuid();
    return [
      {
        ...common,
        id: rowId,
        rowNumber: null,
        type: draft.type,
        accountFlow: draft.type === "INGRESO" ? "INFLOW" : "OUTFLOW",
        account: draft.account.name,
        transferId: null,
        category: draft.category.name,
        subcategory: draft.subcategory?.name ?? null,
        donorOrProvider: draft.thirdParty?.name ?? null,
        paymentMethod: draft.paymentMethod.name,
        referenceOrReceipt: draft.referenceOrReceipt,
      },
    ];
  }

  const originId = options.rowIds?.[0] ?? createTransactionUuid();
  const destinationId = options.rowIds?.[1] ?? createTransactionUuid();
  const transferFields = {
    ...common,
    type: "TRANSFERENCIA" as const,
    transferId: transactionId,
    category: "Transferencia interna",
    subcategory: null,
    donorOrProvider: null,
    paymentMethod: "Transferencia",
    referenceOrReceipt: null,
  };
  return [
    {
      ...transferFields,
      id: originId,
      rowNumber: null,
      accountFlow: "OUTFLOW",
      account: draft.originAccount.name,
    },
    {
      ...transferFields,
      id: destinationId,
      rowNumber: null,
      accountFlow: "INFLOW",
      account: draft.destinationAccount.name,
    },
  ];
};

export const toCatalogSelection = (
  item: { id: string; name: string } | undefined,
): CatalogSelection | null => (item ? { id: item.id, name: item.name } : null);
