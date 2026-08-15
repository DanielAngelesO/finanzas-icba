import { z } from "zod";

export const transactionTypeSchema = z.enum(["INGRESO", "EGRESO", "TRANSFERENCIA"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const singleAccountTransactionTypeSchema = z.enum(["INGRESO", "EGRESO"]);
export type SingleAccountTransactionType = z.infer<typeof singleAccountTransactionTypeSchema>;

export const accountFlowSchema = z.enum(["INFLOW", "OUTFLOW"]);
export type AccountFlow = z.infer<typeof accountFlowSchema>;

export const transactionStatusSchema = z.enum(["CONFIRMED", "PENDING", "VOIDED"]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

const nullableTrimmedText = z.string().trim().min(1).nullable();

/** A validated physical row from the Transacciones sheet. */
export const transactionSchema = z.object({
  id: z.string().trim().min(1),
  transactionId: z.string().trim().min(1),
  rowNumber: z.number().int().positive().nullable(),
  date: z.date(),
  type: transactionTypeSchema,
  accountFlow: accountFlowSchema,
  account: z.string().trim().min(1),
  transferId: nullableTrimmedText,
  category: z.string().trim().min(1),
  subcategory: nullableTrimmedText,
  description: nullableTrimmedText,
  responsible: z.string().trim().min(1),
  donorOrProvider: nullableTrimmedText,
  paymentMethod: z.string().trim().min(1),
  referenceOrReceipt: nullableTrimmedText,
  amount: z.number().finite().positive(),
  status: transactionStatusSchema,
  period: z.string().regex(/^\d{6}$/),
  notes: nullableTrimmedText,
  version: z.number().int().positive(),
  createdAt: z.date().nullable(),
  createdBy: nullableTrimmedText,
  updatedAt: z.date().nullable(),
  updatedBy: nullableTrimmedText,
  voidedAt: z.date().nullable(),
  voidedBy: nullableTrimmedText,
  voidReason: nullableTrimmedText,
  correctsTransactionId: nullableTrimmedText,
  correctedBy: nullableTrimmedText,
});

export type Transaction = z.infer<typeof transactionSchema>;

export interface TransactionActor {
  email: string;
  displayName: string | null;
}

export interface CatalogSelection {
  id: string;
  name: string;
}

interface BaseTransactionDraft {
  amount: number;
  date: Date;
  description: string | null;
  notes: string | null;
  responsible: string;
}

interface SingleAccountTransactionDraft extends BaseTransactionDraft {
  account: CatalogSelection;
  category: CatalogSelection;
  subcategory: CatalogSelection | null;
  paymentMethod: CatalogSelection;
  thirdParty: CatalogSelection | null;
  referenceOrReceipt: string | null;
}

export interface IncomeTransactionDraft extends SingleAccountTransactionDraft {
  type: "INGRESO";
}

export interface ExpenseTransactionDraft extends SingleAccountTransactionDraft {
  type: "EGRESO";
}

export interface TransferTransactionDraft extends BaseTransactionDraft {
  type: "TRANSFERENCIA";
  originAccount: CatalogSelection;
  destinationAccount: CatalogSelection;
}

export type TransactionDraft =
  IncomeTransactionDraft | ExpenseTransactionDraft | TransferTransactionDraft;

export interface TransactionAudit {
  createdAt: Date | null;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
  correctsTransactionId: string | null;
  correctedBy: string | null;
}

interface LogicalTransactionBase {
  transactionId: string;
  rowIds: readonly string[];
  date: Date;
  amount: number;
  status: TransactionStatus;
  period: string;
  version: number;
  description: string | null;
  responsible: string;
  notes: string | null;
  audit: TransactionAudit;
}

export interface SingleAccountTransaction extends LogicalTransactionBase {
  kind: "single";
  type: SingleAccountTransactionType;
  account: string;
  category: string;
  subcategory: string | null;
  donorOrProvider: string | null;
  paymentMethod: string;
  referenceOrReceipt: string | null;
}

export interface TransferTransaction extends LogicalTransactionBase {
  kind: "transfer";
  type: "TRANSFERENCIA";
  originAccount: string;
  destinationAccount: string;
}

export type LogicalTransaction = SingleAccountTransaction | TransferTransaction;

export interface TransactionCatalogItem {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

export interface TransactionCategory extends TransactionCatalogItem {
  type: SingleAccountTransactionType | "AMBOS";
}

export interface TransactionSubcategory extends TransactionCatalogItem {
  categoryId: string;
}

export interface TransactionThirdParty extends Omit<TransactionCatalogItem, "order"> {
  role: "DONANTE" | "PROVEEDOR" | "AMBOS";
}

export type TransactionWriteCapability =
  { status: "enabled"; reason: null } | { status: "disabled"; reason: string };

export interface TransactionCatalogs {
  accounts: TransactionCatalogItem[];
  categories: TransactionCategory[];
  subcategories: TransactionSubcategory[];
  thirdParties: TransactionThirdParty[];
  paymentMethods: TransactionCatalogItem[];
  writeCapability: TransactionWriteCapability;
}

export class TransactionConflictError extends Error {
  public constructor() {
    super("Esta transacción cambió desde que la abriste.");
    this.name = "TransactionConflictError";
  }
}

export class TransactionWriteUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TransactionWriteUnavailableError";
  }
}

export const getAccountFlowSign = (accountFlow: AccountFlow): 1 | -1 =>
  accountFlow === "INFLOW" ? 1 : -1;

export const getTransactionAccountDelta = (transaction: Transaction): number =>
  getAccountFlowSign(transaction.accountFlow) * transaction.amount;

export const isTransactionIncludedInCalculations = (transaction: Transaction): boolean =>
  transaction.status !== "VOIDED";

export const getTransactionStatusLabel = (status: TransactionStatus): string => {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "PENDING") return "Pendiente";
  return "Anulada";
};

export const transactionFiltersSchema = z.object({
  period: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export interface BasicFinancialSummary {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
}
