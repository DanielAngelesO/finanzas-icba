import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { ConnectionStatus } from "../../domain/diagnostics";
import {
  ExpenseCategoryList,
  FinancialTrendChart,
  RecentTransactionList,
} from "../components/dashboard-widgets";
import { StatusBadge } from "../components/status-badge";
import { formatDate, formatMoney, formatPeriod } from "../formatters";

const getConnectionStatus = (
  isPending: boolean,
  isError: boolean,
  status: ConnectionStatus | undefined,
): ConnectionStatus => {
  if (isPending) return "CONNECTING";
  if (status) return status;
  return isError ? "ERROR" : "UNCONFIGURED";
};

export function DashboardPage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriod = searchParams.get("period") ?? undefined;
  const overview = useQuery({
    queryKey: ["dashboard-overview", requestedPeriod],
    queryFn: () => services.dashboard.execute(requestedPeriod),
    placeholderData: keepPreviousData,
  });
  const connection = useQuery({
    queryKey: ["connection"],
    queryFn: () => services.dataSource.checkConnection(),
  });
  const connectionStatus = getConnectionStatus(
    connection.isPending,
    connection.isError,
    connection.data?.status,
  );
  const selectedPeriod =
    requestedPeriod && overview.data?.availablePeriods.includes(requestedPeriod)
      ? requestedPeriod
      : (overview.data?.selectedPeriod ?? "");

  const updatePeriod = (period: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("period", period);
    setSearchParams(nextParams);
  };

  if (overview.isPending) {
    return (
      <div className="space-y-8 animate-fade-in-up" aria-busy="true" aria-live="polite">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="page-title">Resumen financiero</h2>
            <p className="page-subtitle">Cargando la información del período.</p>
          </div>
          <StatusBadge status={connectionStatus} />
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div className="shimmer h-32" key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <section className="space-y-4 animate-fade-in-up" role="alert">
        <h2 className="page-title">Resumen financiero</h2>
        <p className="alert-error">No se pudo cargar el resumen financiero.</p>
        <button className="button-secondary" type="button" onClick={() => void overview.refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const { data } = overview;
  const movementsHref = data.selectedPeriod
    ? "/movimientos?period=" + data.selectedPeriod
    : "/movimientos";

  if (!data.summary) {
    return (
      <div className="space-y-8 animate-fade-in-up">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="page-title">Resumen financiero</h2>
            <p className="page-subtitle">No hay períodos financieros disponibles todavía.</p>
          </div>
          <StatusBadge status={connectionStatus} />
        </section>
        <section className="empty-state">
          <p className="font-medium text-slate-200">
            Aún no hay transacciones válidas para resumir.
          </p>
          <p className="mt-2">Verifica la fuente y la calidad de los datos para comenzar.</p>
          <div className="mt-5">
            <Link className="button-secondary" to="/control/calidad">
              Revisar calidad de datos
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const metrics = [
    ["Ingresos", formatMoney(data.summary.income), "stat-card-emerald"],
    ["Egresos", formatMoney(data.summary.expense), "stat-card-rose"],
    ["Resultado del período", formatMoney(data.summary.netResult), "stat-card-indigo"],
    ["Movimientos", data.summary.transactionCount.toLocaleString("es-PE"), "stat-card-sky"],
  ] as const;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Resumen financiero</h2>
          <p className="page-subtitle">
            Visión general de ingresos, egresos y movimientos registrados.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-busy={overview.isPlaceholderData}>
          <div className="text-sm text-slate-400">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Fecha de corte
            </p>
            <p className="mt-1 text-slate-300">
              {data.dataCutoff ? formatDate(data.dataCutoff) : "Sin movimientos"}
            </p>
          </div>
          <label className="field-label min-w-44">
            Período
            <select
              className="field"
              value={selectedPeriod}
              onChange={(event) => updatePeriod(event.target.value)}
            >
              {data.availablePeriods.map((period) => (
                <option key={period} value={period}>
                  {formatPeriod(period)}
                </option>
              ))}
            </select>
          </label>
          <StatusBadge status={connectionStatus} />
          {overview.isPlaceholderData ? (
            <span className="text-xs text-slate-400" aria-live="polite">
              Actualizando…
            </span>
          ) : null}
        </div>
      </section>

      {data.dataQuality.invalidTransactionCount > 0 ? (
        <section className="alert-warning" role="status">
          Hay {data.dataQuality.invalidTransactionCount}{" "}
          {data.dataQuality.invalidTransactionCount === 1 ? "fila inválida" : "filas inválidas"} que
          no se incluyen en los totales.{" "}
          <Link className="font-semibold underline underline-offset-2" to="/control/calidad">
            Revisar calidad de datos
          </Link>
        </section>
      ) : null}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores del período"
      >
        {metrics.map(([label, value, accent], index) => (
          <article
            className={"stat-card " + accent}
            key={label}
            style={{ animationDelay: String(index * 80) + "ms" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <FinancialTrendChart trend={data.trend} />
        <ExpenseCategoryList categories={data.expenseCategories} />
      </section>

      <RecentTransactionList transactions={data.recentTransactions} movementsHref={movementsHref} />
    </div>
  );
}
