import { getTransactionStatusLabel, type LogicalTransaction } from "../../../domain/transaction";
import { formatCompactDate, formatMoney, formatTableDate } from "../../formatters";
import {
  getAmountClass,
  getAmountPrefix,
  getTransactionAccountsLabel,
  getTransactionConcept,
  getTransactionPreviewParts,
  getTransactionTypeClass,
  getTransactionTypeIcon,
  getTransactionTypeLabel,
} from "./transaction-ui";

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const formatDayHeading = (date: Date): string =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long" })
    .format(date)
    .toLocaleUpperCase("es-PE");

const groupByDay = (
  transactions: LogicalTransaction[],
): Array<{ key: string; date: Date; transactions: LogicalTransaction[] }> => {
  const groups = new Map<string, { date: Date; transactions: LogicalTransaction[] }>();
  transactions.forEach((transaction) => {
    const key = dayKey(transaction.date);
    const group = groups.get(key) ?? { date: transaction.date, transactions: [] };
    group.transactions.push(transaction);
    groups.set(key, group);
  });
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
};

/** Solo el glifo del tipo: el nombre queda en `title` y para lectores de pantalla. */
function TypeGlyph({ transaction }: { transaction: LogicalTransaction }) {
  const label = getTransactionTypeLabel(transaction.type);
  return (
    <span
      className={`transaction-type-glyph ${getTransactionTypeClass(transaction.type)}`}
      title={label}
    >
      <span aria-hidden="true">{getTransactionTypeIcon(transaction.type)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Celda densa de una o dos líneas: el dato principal arriba y el complementario
 * debajo, ambos truncados con el valor completo en `title`.
 */
function Cell({
  value,
  detail,
  className,
  emphasis,
}: {
  value: string | null;
  detail?: string | null;
  className?: string;
  emphasis?: boolean;
}) {
  const classes = ["transaction-table-cell", className].filter(Boolean).join(" ");
  return (
    <td className={classes}>
      {value ? (
        <span
          className={`transaction-cell-value${emphasis ? " transaction-table-cell-strong" : ""}`}
          title={value}
        >
          {value}
        </span>
      ) : (
        <span className="transaction-cell-value transaction-table-empty" aria-hidden="true">
          —
        </span>
      )}
      {detail ? (
        <span className="transaction-cell-detail" title={detail}>
          {detail}
        </span>
      ) : null}
    </td>
  );
}

interface TransactionRowFields {
  category: string | null;
  subcategory: string | null;
  party: string | null;
  paymentMethod: string | null;
  receipt: string | null;
}

const getRowFields = (transaction: LogicalTransaction): TransactionRowFields =>
  transaction.kind === "single"
    ? {
        category: transaction.category,
        subcategory: transaction.subcategory,
        party: transaction.donorOrProvider,
        paymentMethod: transaction.paymentMethod,
        receipt: transaction.referenceOrReceipt,
      }
    : {
        category: null,
        subcategory: null,
        party: null,
        paymentMethod: null,
        receipt: null,
      };

function Amount({ transaction }: { transaction: LogicalTransaction }) {
  return (
    <span className={`transaction-row-amount ${getAmountClass(transaction)}`}>
      <span className="sr-only">
        {getTransactionTypeLabel(transaction.type)} por {formatMoney(transaction.amount)}.
      </span>
      <span aria-hidden="true">
        {getAmountPrefix(transaction)}
        {formatMoney(transaction.amount)}
      </span>
    </span>
  );
}

export function TransactionList({
  transactions,
  onOpen,
  variant = "default",
}: {
  transactions: LogicalTransaction[];
  onOpen: (transaction: LogicalTransaction, trigger: HTMLButtonElement) => void;
  variant?: "default" | "search";
}) {
  const groups = groupByDay(transactions);
  const renderMobileRow = (transaction: LogicalTransaction, includeDate: boolean) => {
    const concept = getTransactionConcept(transaction);
    const { category, donor, offeringDate } = getTransactionPreviewParts(transaction);
    const dateLabel = includeDate ? formatCompactDate(transaction.date) : null;
    return (
      <button
        className="transaction-mobile-row"
        type="button"
        onClick={(event) => onOpen(transaction, event.currentTarget)}
        aria-label={`${getTransactionTypeLabel(transaction.type)}: ${concept}, ${formatMoney(transaction.amount)}${dateLabel ? `, ${dateLabel}` : ""}${category ? `, ${category}` : ""}${donor ? `, ${donor}` : ""}${offeringDate ? `, ${offeringDate}` : ""}, ${getTransactionAccountsLabel(transaction)}, ${getTransactionStatusLabel(transaction.status)}`}
      >
        <span
          className={`transaction-row-icon ${getTransactionTypeClass(transaction.type)}`}
          aria-hidden="true"
        >
          {getTransactionTypeIcon(transaction.type)}
        </span>
        <span className="transaction-row-main">
          <span className="transaction-row-topline">
            <span className="transaction-row-concept">{concept}</span>
            <Amount transaction={transaction} />
          </span>
          <span className="transaction-row-details">
            <span className="transaction-row-meta">
              {dateLabel ? (
                <>
                  <span>{dateLabel}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              {category ? (
                <>
                  <span>{category}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              {donor ? (
                <>
                  <span className="transaction-preview-donor">{donor}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              {offeringDate ? (
                <>
                  <span>{offeringDate}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              <span>{getTransactionAccountsLabel(transaction)}</span>
            </span>
            <span
              className={`transaction-status-label transaction-status-${transaction.status.toLocaleLowerCase()}${transaction.status === "CONFIRMED" ? " transaction-mobile-confirmed-status" : ""}`}
            >
              {getTransactionStatusLabel(transaction.status)}
            </span>
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      <div
        className={
          variant === "search"
            ? "transaction-search-result-list lg:hidden"
            : "transaction-mobile-list lg:hidden"
        }
      >
        {variant === "search" ? (
          <ul aria-label="Resultados de búsqueda">
            {transactions.map((transaction) => (
              <li key={transaction.transactionId}>{renderMobileRow(transaction, true)}</li>
            ))}
          </ul>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-labelledby={`transactions-day-${group.key}`}>
              <h3 className="transaction-day-heading" id={`transactions-day-${group.key}`}>
                {formatDayHeading(group.date)}
              </h3>
              <ul
                aria-label={`Movimientos del ${formatDayHeading(group.date).toLocaleLowerCase("es-PE")}`}
              >
                {group.transactions.map((transaction) => (
                  <li key={transaction.transactionId}>{renderMobileRow(transaction, false)}</li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {variant === "default" ? (
        <div className="transaction-table-wrapper hidden lg:block">
          <table className="data-table transaction-table" aria-label="Movimientos encontrados">
            <thead>
              <tr>
                <th className="transaction-col-date" scope="col">
                  Fecha
                </th>
                <th className="transaction-col-type" scope="col">
                  <span className="sr-only">Tipo</span>
                </th>
                <th scope="col">Categoría / Subcategoría</th>
                <th scope="col">Donante / Proveedor</th>
                <th scope="col">Cuenta / Pago</th>
                <th className="transaction-col-amount text-right" scope="col">
                  Monto
                </th>
                <th className="transaction-col-concept" scope="col">
                  Descripción / Comprobante
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const fields = getRowFields(transaction);
                const accounts = getTransactionAccountsLabel(transaction);
                return (
                  <tr
                    className={
                      transaction.status === "VOIDED" ? "transaction-row-voided" : undefined
                    }
                    key={transaction.transactionId}
                  >
                    <td className="transaction-table-cell transaction-col-date">
                      {formatTableDate(transaction.date)}
                    </td>
                    <td className="transaction-col-type">
                      <TypeGlyph transaction={transaction} />
                    </td>
                    <Cell value={fields.category} detail={fields.subcategory} emphasis />
                    <Cell value={fields.party} />
                    <Cell value={accounts} detail={fields.paymentMethod} emphasis />
                    <td className="transaction-col-amount text-right">
                      <Amount transaction={transaction} />
                      {transaction.status === "CONFIRMED" ? null : (
                        <span
                          className={`transaction-status-label transaction-status-${transaction.status.toLocaleLowerCase()}`}
                        >
                          {getTransactionStatusLabel(transaction.status)}
                        </span>
                      )}
                    </td>
                    <td className="transaction-table-cell transaction-col-concept">
                      <span className="transaction-concept-cell">
                        <button
                          className="transaction-table-row-action"
                          type="button"
                          title={transaction.description ?? undefined}
                          onClick={(event) => onOpen(transaction, event.currentTarget)}
                        >
                          <span className="truncate">
                            {transaction.description ?? "Sin descripción"}
                          </span>
                          <span className="sr-only">. Abrir detalle</span>
                        </button>
                        {transaction.notes ? (
                          <span className="transaction-note-flag" title={transaction.notes}>
                            <span aria-hidden="true">✎</span>
                            <span className="sr-only">Tiene notas: {transaction.notes}</span>
                          </span>
                        ) : null}
                      </span>
                      {fields.receipt ? (
                        <span className="transaction-cell-detail" title={fields.receipt}>
                          {fields.receipt}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
