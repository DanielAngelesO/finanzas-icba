import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { TransactionType } from "../../domain/transaction";
import { TransactionTable } from "../components/transaction-table";

type ViewMode = "first" | "recent";

const getTransactionType = (value: string): TransactionType | "" =>
  value === "INGRESO" || value === "EGRESO" ? value : "";

const isValidPeriod = (value: string | null): value is string =>
  value !== null && /^\d{6}$/.test(value);

export function TransactionsPage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [type, setType] = useState<TransactionType | "">("");
  const [id, setId] = useState("");
  const [view, setView] = useState<ViewMode>("recent");
  const periodParameter = searchParams.get("period");
  const period = isValidPeriod(periodParameter) ? periodParameter : "";
  const filters = useMemo(
    () => ({ ...(period ? { period } : {}), ...(type ? { type } : {}) }),
    [period, type],
  );
  const periods = useQuery({
    queryKey: ["periods"],
    queryFn: () => services.transactions.getAvailablePeriods(),
  });
  const transactions = useQuery({
    queryKey: ["transactions", filters, view, id],
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

  const updatePeriod = (nextPeriod: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPeriod) nextParams.set("period", nextPeriod);
    else nextParams.delete("period");
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section>
        <h2 className="page-title">Movimientos</h2>
        <p className="page-subtitle">
          Consulta las operaciones registradas por período, tipo o identificador.
        </p>
      </section>

      <section className="card">
        <h3 className="section-title">Filtros de consulta</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-4">
          <label className="field-label">
            Período
            <select
              className="field"
              value={period}
              onChange={(event) => updatePeriod(event.target.value)}
            >
              <option value="">Todos</option>
              {periods.data?.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Tipo
            <select
              className="field"
              value={type}
              onChange={(event) => setType(getTransactionType(event.target.value))}
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
            <legend>Vista</legend>
            <div className="segmented-control mt-1">
              <button
                className={"segmented-btn " + (view === "first" ? "segmented-btn-active" : "")}
                type="button"
                onClick={() => setView("first")}
                aria-pressed={view === "first"}
              >
                Primeros 10
              </button>
              <button
                className={"segmented-btn " + (view === "recent" ? "segmented-btn-active" : "")}
                type="button"
                onClick={() => setView("recent")}
                aria-pressed={view === "recent"}
              >
                Últimos 10
              </button>
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="transactions-title">
        <h3 className="section-title mb-4" id="transactions-title">
          Operaciones registradas
        </h3>
        {transactions.isPending ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <div className="shimmer h-12 w-full" aria-hidden="true" />
            <div className="shimmer h-10 w-full" aria-hidden="true" />
            <div className="shimmer h-10 w-full" aria-hidden="true" />
            <div className="shimmer h-10 w-full" aria-hidden="true" />
            <span className="sr-only">Cargando movimientos.</span>
          </div>
        ) : null}
        {transactions.isError ? (
          <p className="alert-error" role="alert">
            No se pudieron cargar los movimientos.
          </p>
        ) : null}
        {transactions.data ? <TransactionTable transactions={transactions.data} /> : null}
      </section>
    </div>
  );
}
