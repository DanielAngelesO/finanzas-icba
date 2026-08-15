import {
  TransactionConflictError,
  TransactionWriteUnavailableError,
} from "../../../domain/transaction";
import { GoogleSheetsError } from "../../../infrastructure/google-sheets/google-sheets-client";

export const getTransactionMutationError = (error: unknown, fallback: string): string => {
  if (error instanceof TransactionConflictError) {
    return "Esta transacción cambió desde que la abriste. Recarga para revisar la versión más reciente.";
  }
  if (error instanceof TransactionWriteUnavailableError) return error.message;
  if (error instanceof GoogleSheetsError && error.status === 401) {
    return "Tu sesión de Google venció. Vuelve a autorizar para guardar.";
  }
  if (error instanceof GoogleSheetsError && error.status === 403) {
    return "Tu cuenta puede consultar esta hoja, pero no editarla. Solicita acceso de Editor.";
  }
  return fallback;
};
