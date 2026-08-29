import type {
  CatalogSelection,
  SingleAccountTransactionType,
  TransactionCatalogItem,
  TransactionType,
} from "../../../domain/transaction";

/**
 * Reglas de valores por defecto del editor de transacciones.
 *
 * Los catálogos llegan del Google Sheet en runtime, así que estos nombres pueden
 * no coincidir exactamente. La búsqueda normaliza acentos y mayúsculas y usa
 * coincidencia parcial; si no hay match, se cae al primer elemento activo.
 */

const normalizeHint = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .trim();

/** Cuenta sembrada por defecto según el tipo de transacción. */
export const DEFAULT_ACCOUNT_HINT: Record<SingleAccountTransactionType, string> = {
  INGRESO: "caja chica",
  EGRESO: "cuenta interbank",
};

export const CASH_ACCOUNT_HINT = "caja chica";
export const CASH_PAYMENT_HINT = "efectivo";
export const TRANSFER_PAYMENT_HINT = "transferencia";
export const OFFERING_CATEGORY_HINT = "ofrenda";
export const MEMBERSHIP_DONOR_HINT = "membresia";
export const MEMBERSHIP_DONOR_NAME = "Membresía";

type NamedItem = Pick<TransactionCatalogItem, "id" | "name" | "active">;

const findByHint = <T extends NamedItem>(items: T[], hint: string): T | undefined => {
  const target = normalizeHint(hint);
  return items.find((item) => item.active && normalizeHint(item.name).includes(target));
};

const firstActive = <T extends NamedItem>(items: T[]): T | undefined =>
  items.find((item) => item.active);

const toSelection = (item: NamedItem | undefined): CatalogSelection | null =>
  item ? { id: item.id, name: item.name } : null;

/** ¿El nombre contiene la pista indicada? (normalizado) */
export const matchesHint = (name: string | null | undefined, hint: string): boolean =>
  name ? normalizeHint(name).includes(normalizeHint(hint)) : false;

export const isCashAccount = (name: string | null | undefined): boolean =>
  matchesHint(name, CASH_ACCOUNT_HINT);

export const isOfferingCategory = (name: string | null | undefined): boolean =>
  matchesHint(name, OFFERING_CATEGORY_HINT);

/** Cuenta por defecto para el tipo, con fallback al primer activo. */
export const resolveDefaultAccount = (
  accounts: NamedItem[],
  type: TransactionType,
): CatalogSelection | null => {
  if (type === "TRANSFERENCIA") return toSelection(firstActive(accounts));
  return toSelection(findByHint(accounts, DEFAULT_ACCOUNT_HINT[type]) ?? firstActive(accounts));
};

/**
 * Tipo de pago por defecto para una cuenta: "Efectivo" para Caja Chica,
 * "Transferencia" para cualquier otra. Fallback al primer activo.
 */
export const resolveDefaultPaymentMethod = (
  paymentMethods: NamedItem[],
  accountName: string | null | undefined,
): CatalogSelection | null => {
  const hint = isCashAccount(accountName) ? CASH_PAYMENT_HINT : TRANSFER_PAYMENT_HINT;
  return toSelection(findByHint(paymentMethods, hint) ?? firstActive(paymentMethods));
};

/** Donante "Membresía" para las ofrendas; se crea localmente si no está en el catálogo. */
export const resolveMembershipDonor = (thirdParties: NamedItem[]): CatalogSelection => {
  const match = findByHint(thirdParties, MEMBERSHIP_DONOR_HINT);
  return match
    ? { id: match.id, name: match.name }
    : { id: `new-${MEMBERSHIP_DONOR_HINT}`, name: MEMBERSHIP_DONOR_NAME };
};
