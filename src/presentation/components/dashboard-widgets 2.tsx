import { Link } from "react-router-dom";
import type { DashboardExpenseCategory, DashboardPeriodSummary } from "../../domain/dashboard";
import type { Transaction } from "../../domain/transaction";
import { formatCompactDate, formatMoney, formatPeriod } from "../formatters";

const getBarHeight = (amount: number, maximum: number): string => {
  if (amount === 0) return "0%";
  return String(Math.max((amount / maximum) * 100, 3)) + "%";
};

export function FinancialTrendChart({ trend }: { trend: DashboardPeriodSummary[] }) {
  if (trend.length === 0) {
    return (
      <section className="card min-w-0">
        <h3 className="section-title">Evolución financiera</h3>
        <p className="empty-state mt-4">No hay períodos suficientes para mostrar una evolución.</p>
      </section>
    );
  }

  const maximum = Math.max(...trend.flatMap((summary) => [summary.income, summary.expense]), 1);

  return (
    <figure className="card min-w-0" aria-labelledby="financial-trend-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title" id="financial-trend-title">
            Evolución financiera
          </h3>
          <p className="mt-1 text-sm text-slate-400">Ingresos y egresos de los últimos períodos.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400" aria-label="Leyenda">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" aria-hidden="true" />
            Ingresos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" aria-hidden="true" />
            Egresos
          </span>
        </div>
      </div>
      <div
        className="mt-6 flex h-52 items-end gap-2 border-b border-slate-700/70 pb-1 sm:h-60 sm:gap-4"
        aria-hidden="true"
      >
        {trend.map((summary) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={summary.period}>
            <div className="flex h-44 w-full max-w-14 items-end justify-center gap-1 sm:h-52 sm:gap-1.5">
              <span
                className="w-2 rounded-t bg-emerald-400 sm:w-3"
                style={{ height: getBarHeight(summary.income, maximum) }}
              />
              <span
                className="w-2 rounded-t bg-rose-400 sm:w-3"
                style={{ height: getBarHeight(summary.expense, maximum) }}
              />
            </div>
            <span className="max-w-full truncate text-[11px] text-slate-500">
              {formatPeriod(summary.period).split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        Comparación de ingresos y egresos para {trend.length} períodos.
      </figcaption>
      <table className="sr-only">
        <caption>Valores de evolución financiera</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Ingresos</th>
            <th scope="col">Egresos</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((summary) => (
            <tr key={summary.period}>
              <th scope="row">{formatPeriod(summary.period)}</th>
              <td>{formatMoney(summary.income)}</td>
              <td>{formatMoney(summary.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function ExpenseCategoryList({ categories }: { categories: DashboardExpenseCategory[] }) {
  const maximum = Math.max(...categories.map((category) => category.amount), 1);

  return (
    <section className="card min-w-0" aria-labelledby="expense-categories-title">
      <div>
        <h3 className="section-title" id="expense-categories-title">
          Egresos por categoría
        </h3>
        <p className="mt-1 text-sm text-slate-400">Principales destinos del gasto del período.</p>
      </div>
      {categories.length === 0 ? (
        <p className="empty-state mt-4">No se registraron egresos en este período.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {categories.map((category) => (
            <li key={category.category}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-sm font-medium text-slate-200">
                  {category.category}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-slate-300">
                  {formatMoney(category.amount)}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: String((category.amount / maximum) * 100) + "%" }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

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
          <h3 className="section-title" id="recent-transactions-title">
            Movimientos recientes
          </h3>
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
