import { getTransactionStatusLabel, type LogicalTransaction } from "../../../domain/transaction";
import { formatCompactDate, formatMoney } from "../../formatters";
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

function TypeBadge({ transaction }: { transaction: LogicalTransaction }) {
  return (
    <span className={getTransactionTypeClass(transaction.type)}>
      <span aria-hidden="true">{getTransactionTypeIcon(transaction.type)}</span>
      {getTransactionTypeLabel(transaction.type)}
    </span>
  );
}

function TransactionPreview({ transaction }: { transaction: LogicalTransaction }) {
  const { category, donor, offeringDate } = getTransactionPreviewParts(transaction);
  if (!category && !donor && !offeringDate) return null;
  const preview = [category, donor].filter(Boolean).join(" · ");
  return (
    <div className="transaction-preview">
      {preview ? (
        <p className="transaction-preview-line" title={preview}>
          {category ? <span className="transaction-preview-category">{category}</span> : null}
          {category && donor ? (
            <span className="transaction-preview-separator">{" · "}</span>
          ) : null}
          {donor ? <span className="transaction-preview-donor">{donor}</span> : null}
        </p>
      ) : null}
      {offeringDate ? (
        <p className="transaction-preview-date" title={offeringDate}>
          {offeringDate}
        </p>
      ) : null}
    </div>
  );
}

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
                <th scope="col">Fecha</th>
                <th scope="col">Movimiento</th>
                <th scope="col">Tipo</th>
                <th scope="col">Cuenta</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-right">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const concept = getTransactionConcept(transaction);
                return (
                  <tr
                    className={
                      transaction.status === "VOIDED" ? "transaction-row-voided" : undefined
                    }
                    key={transaction.transactionId}
                  >
                    <td className="whitespace-nowrap text-slate-300">
                      {formatCompactDate(transaction.date)}
                    </td>
                    <td className="transaction-table-concept">
                      <button
                        className="transaction-table-row-action"
                        type="button"
                        onClick={(event) => onOpen(transaction, event.currentTarget)}
                      >
                        <span className="truncate font-medium text-slate-100">{concept}</span>
                        <span className="sr-only">. Abrir detalle</span>
                      </button>
                      <TransactionPreview transaction={transaction} />
                    </td>
                    <td>
                      <TypeBadge transaction={transaction} />
                    </td>
                    <td
                      className="max-w-52 truncate text-slate-300"
                      title={getTransactionAccountsLabel(transaction)}
                    >
                      {getTransactionAccountsLabel(transaction)}
                    </td>
                    <td>
                      <span
                        className={`transaction-status-label transaction-status-${transaction.status.toLocaleLowerCase()}`}
                      >
                        {getTransactionStatusLabel(transaction.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Amount transaction={transaction} />
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
