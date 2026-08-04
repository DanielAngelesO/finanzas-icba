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
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Prueba de transacciones</h2>
        <p className="mt-1 text-slate-400">
          Lectura normalizada y temporal para validar la integración.
        </p>
      </section>
      {summary.data ? (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumen financiero global"
        >
          {[
            ["Ingresos", currency.format(summary.data.income)],
            ["Egresos", currency.format(summary.data.expense)],
            ["Balance", currency.format(summary.data.balance)],
            [
              "Filas válidas / inválidas",
              `${summary.data.validTransactionCount} / ${summary.data.invalidTransactionCount}`,
            ],
          ].map(([label, value]) => (
            <article className="card" key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
            </article>
          ))}
        </section>
      ) : null}
      <section className="card">
        <h3 className="section-title">Consulta</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
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
            <div className="mt-2 flex gap-2">
              <button
                className={view === "first" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setView("first")}
              >
                Primeras 10
              </button>
              <button
                className={view === "recent" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setView("recent")}
              >
                Últimas 10
              </button>
            </div>
          </fieldset>
        </div>
      </section>
      <section>
        <h3 className="section-title mb-3">Transacciones normalizadas</h3>
        {transactions.isPending ? (
          <p className="empty-state" role="status">
            Cargando transacciones…
          </p>
        ) : null}
        {transactions.isError ? (
          <p className="alert-error">No se pudieron cargar las transacciones.</p>
        ) : null}
        {transactions.data ? <TransactionTable transactions={transactions.data} /> : null}
      </section>
      {inspection.data ? (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Ver respuesta normalizada segura
          </summary>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">
            {JSON.stringify(inspection.data, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
