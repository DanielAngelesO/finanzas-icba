import { z } from "zod";

export const transactionTypeSchema = z.enum(["INGRESO", "EGRESO", "TRANSFERENCIA"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const accountFlowSchema = z.enum(["INFLOW", "OUTFLOW"]);
export type AccountFlow = z.infer<typeof accountFlowSchema>;

export const transactionSchema = z.object({
  id: z.string().trim().min(1),
  date: z.date(),
  type: transactionTypeSchema,
  accountFlow: accountFlowSchema,
  account: z.string().trim().min(1),
  transferId: z.string().trim().min(1).nullable(),
  category: z.string().trim().min(1),
  subcategory: z.string().nullable(),
  description: z.string().trim().min(1).nullable(),
  responsible: z.string().trim().min(1),
  donorOrProvider: z.string().nullable(),
  paymentMethod: z.string().trim().min(1),
  referenceOrReceipt: z.string().nullable(),
  amount: z.number().finite().positive(),
  status: z.string().trim().min(1),
  period: z.string().regex(/^\d{6}$/),
  notes: z.string().nullable(),
});

export type Transaction = z.infer<typeof transactionSchema>;

export const getAccountFlowSign = (accountFlow: AccountFlow): 1 | -1 =>
  accountFlow === "INFLOW" ? 1 : -1;

export const getTransactionAccountDelta = (transaction: Transaction): number =>
  getAccountFlowSign(transaction.accountFlow) * transaction.amount;

export const transactionFiltersSchema = z.object({
  period: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  type: transactionTypeSchema.optional(),
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
