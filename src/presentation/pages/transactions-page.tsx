import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AppServices } from "../../composition/services";
import type { TransactionType } from "../../domain/transaction";
import { TransactionTable } from "../components/transaction-table";

type ViewMode = "first" | "recent";

const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function TransactionsPage({ services }: { services: AppServices }) {
  const [period, setPeriod] = useState("");
  const [type, setType] = useState<TransactionType | "">("");
  const [id, setId] = useState("");
  const [view, setView] = useState<ViewMode>("first");
  const filters = useMemo(
    () => ({ ...(period ? { period } : {}), ...(type ? { type } : {}) }),
    [period, type],
  );
  const periods = useQuery({
    queryKey: ["periods"],
    queryFn: () => services.transactions.getAvailablePeriods(),
  });
  const transactions = useQuery({
    queryKey: ["transactions", filters, view],
    queryFn: async () => {
      if (id.trim()) {
        const found = await services.transactions.findById(id.trim());
        return found ? [found] : [];
      }
      return view === "first"
        ? (await services.transactions.findAll(filters)).slice(0, 10)
        : services.transactions.findLast(10, filters);
    },
  });
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: () => services.financialSummary.execute(),
  });
  const inspection = useQuery({
    queryKey: ["inspection"],
    queryFn: () => services.dataSource.inspect(),
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Page header */}
      <section>
        <h2 className="page-title">Prueba de transacciones</h2>
        <p className="page-subtitle">
          Lectura normalizada y temporal para validar la integración.
        </p>
      </section>

      {/* Summary cards */}
      {summary.data ? (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumen financiero global"
        >
          {(
            [
              ["Ingresos", currency.format(summary.data.income), "stat-card-emerald"],
              ["Egresos", currency.format(summary.data.expense), "stat-card-rose"],
              ["Balance", currency.format(summary.data.balance), "stat-card-indigo"],
              [
                "Filas válidas / inválidas",
                `${summary.data.validTransactionCount} / ${summary.data.invalidTransactionCount}`,
                "stat-card-sky",
              ],
            ] as const
          ).map(([label, value, accent], index) => (
            <article
              className={`stat-card ${accent}`}
              key={label}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
            </article>
          ))}
        </section>
      ) : null}

      {/* Filters */}
      <section className="card">
        <h3 className="section-title">Consulta</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-4">
          <label className="field-label">
            Período
            <select
              className="field"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="">Todos</option>
              {periods.data?.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Tipo
            <select
              className="field"
              value={type}
              onChange={(event) => setType(event.target.value as TransactionType | "")}
            >
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </select>
          </label>
          <label className="field-label">
            Buscar por ID
            <input
              className="field"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="Ej. TX-001"
            />
          </label>
          <fieldset className="field-label">
            Vista
            <div className="segmented-control mt-1">
              <button
                className={`segmented-btn ${view === "first" ? "segmented-btn-active" : ""}`}
                type="button"
                onClick={() => setView("first")}
              >
                Primeras 10
              </button>
              <button
                className={`segmented-btn ${view === "recent" ? "segmented-btn-active" : ""}`}
                type="button"
                onClick={() => setView("recent")}
              >
                Últimas 10
              </button>
            </div>
          </fieldset>
        </div>
      </section>

      {/* Transactions table */}
      <section>
        <h3 className="section-title mb-4">Transacciones normalizadas</h3>
        {transactions.isPending ? (
          <div className="space-y-3">
            <div className="shimmer h-12 w-full" />
            <div className="shimmer h-10 w-full" />
            <div className="shimmer h-10 w-full" />
            <div className="shimmer h-10 w-full" />
          </div>
        ) : null}
        {transactions.isError ? (
          <p className="alert-error">No se pudieron cargar las transacciones.</p>
        ) : null}
        {transactions.data ? <TransactionTable transactions={transactions.data} /> : null}
      </section>

      {/* Raw inspection */}
      {inspection.data ? (
        <details className="card group">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300 transition-colors hover:text-slate-100">
            <span className="ml-1">Ver respuesta normalizada segura</span>
          </summary>
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl p-4 text-xs text-slate-400" style={{ background: "rgba(10, 14, 26, 0.6)" }}>
            {JSON.stringify(inspection.data, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
