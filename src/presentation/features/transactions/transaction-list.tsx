import { getTransactionStatusLabel, type LogicalTransaction } from "../../../domain/transaction";
import { formatCompactDate, formatMoney } from "../../formatters";
import {
  getAmountClass,
  getAmountPrefix,
  getTransactionAccountsLabel,
  getTransactionConcept,
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
}: {
  transactions: LogicalTransaction[];
  onOpen: (transaction: LogicalTransaction, trigger: HTMLButtonElement) => void;
}) {
  const groups = groupByDay(transactions);
  return (
    <>
      <div className="transaction-mobile-list lg:hidden">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`transactions-day-${group.key}`}>
            <h3 className="transaction-day-heading" id={`transactions-day-${group.key}`}>
              {formatDayHeading(group.date)}
            </h3>
            <ul
              aria-label={`Movimientos del ${formatDayHeading(group.date).toLocaleLowerCase("es-PE")}`}
            >
              {group.transactions.map((transaction) => {
                const concept = getTransactionConcept(transaction);
                return (
                  <li key={transaction.transactionId}>
                    <button
                      className="transaction-mobile-row"
                      type="button"
                      onClick={(event) => onOpen(transaction, event.currentTarget)}
                      aria-label={`${getTransactionTypeLabel(transaction.type)}: ${concept}, ${formatMoney(transaction.amount)}, ${getTransactionStatusLabel(transaction.status)}`}
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
                        <span className="transaction-row-meta">
                          <span>{getTransactionAccountsLabel(transaction)}</span>
                          {transaction.kind === "single" ? (
                            <span> · {transaction.category}</span>
                          ) : null}
                        </span>
                        <span
                          className={`transaction-status-label transaction-status-${transaction.status.toLocaleLowerCase()}`}
                        >
                          {getTransactionStatusLabel(transaction.status)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

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
                  className={transaction.status === "VOIDED" ? "transaction-row-voided" : undefined}
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
                    {transaction.kind === "single" ? (
                      <p className="mt-1 truncate text-xs text-slate-500">{transaction.category}</p>
                    ) : null}
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
    </>
  );
}
