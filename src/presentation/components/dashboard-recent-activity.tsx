import { Link } from "react-router-dom";
import type { Transaction } from "../../domain/transaction";
import { formatCompactDate, formatMoney } from "../formatters";

export function RecentTransactionList({
  transactions,
  movementsHref,
}: {
  transactions: Transaction[];
  movementsHref: string;
}) {
  return (
    <section className="card min-w-0" aria-labelledby="recent-transactions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="section-title" id="recent-transactions-title">
            Movimientos recientes
          </h4>
          <p className="mt-1 text-sm text-slate-400">
            Operaciones registradas en el período seleccionado.
          </p>
        </div>
        <Link className="button-secondary text-xs" to={movementsHref}>
          Ver todos
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="empty-state mt-4">No hay movimientos para este período.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {transactions.map((transaction) => (
            <li className="flex items-center gap-3 py-3" key={transaction.id}>
              <span
                className={transaction.type === "INGRESO" ? "type-ingreso" : "type-egreso"}
                aria-label={transaction.type === "INGRESO" ? "Ingreso" : "Egreso"}
              >
                {transaction.type === "INGRESO" ? "↑" : "↓"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">
                  {transaction.description ?? transaction.category}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {formatCompactDate(transaction.date)} · {transaction.category} ·{" "}
                  {transaction.status}
                </p>
              </div>
              <span
                className={
                  "shrink-0 text-sm font-semibold tabular-nums " +
                  (transaction.type === "INGRESO" ? "amount-positive" : "amount-negative")
                }
              >
                {transaction.type === "INGRESO" ? "+" : "−"}
                {formatMoney(transaction.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
