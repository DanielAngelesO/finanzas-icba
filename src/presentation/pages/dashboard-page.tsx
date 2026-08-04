import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { ConnectionStatus } from "../../domain/diagnostics";
import {
  BalanceTrendChart,
  ContributionTrendChart,
  ExpenseCategoryChart,
  FinancialTrendChart,
  IncomeCategoryChart,
  RecentTransactionList,
  SalaryExpenseComparison,
} from "../components/dashboard-widgets";
import { StatusBadge } from "../components/status-badge";
import { formatDate, formatMoney, formatPercent, formatPeriod } from "../formatters";

const getConnectionStatus = (
  isPending: boolean,
  isError: boolean,
  status: ConnectionStatus | undefined,
): ConnectionStatus => {
  if (isPending) return "CONNECTING";
  if (status) return status;
  return isError ? "ERROR" : "UNCONFIGURED";
};

function DashboardSectionHeader({
  eyebrow,
  title,
  description,
  titleId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  titleId: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-100" id={titleId}>
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function DashboardMetricCard({
  label,
  value,
  accent,
  animationDelay,
  children,
}: {
  label: string;
  value: string;
  accent: string;
  animationDelay: string;
  children?: ReactNode;
}) {
  return (
    <article className={"stat-card " + accent} style={{ animationDelay }}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
      {children}
    </article>
  );
}

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
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
  const expensesHref = data.selectedPeriod
    ? "/gastos?from=" + data.selectedPeriod + "&to=" + data.selectedPeriod
    : "/gastos";

  if (!data.summary || !data.accumulated || !data.expenseComposition || !data.expenseInsights) {
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

  return (
    <div className="space-y-9 animate-fade-in-up lg:space-y-10">
      <header className="space-y-5 border-b border-slate-800/80 pb-7 lg:flex lg:items-end lg:justify-between lg:gap-8 lg:space-y-0">
        <div className="max-w-xl">
          <h2 className="page-title">Resumen financiero</h2>
          <p className="page-subtitle">
            Lectura ejecutiva del período, su evolución anual y los movimientos registrados.
          </p>
        </div>
        <div
          className="grid w-full gap-4 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4 sm:grid-cols-2 lg:w-auto lg:min-w-[34rem] lg:grid-cols-[minmax(12rem,1fr)_minmax(9rem,auto)_auto] lg:items-end"
          aria-busy={overview.isPlaceholderData}
          aria-label="Contexto del análisis"
        >
          <label className="field-label">
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
          <div className="text-sm text-slate-400">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Fecha de corte
            </p>
            <p className="mt-2 font-medium text-slate-200">
              {data.dataCutoff ? formatDate(data.dataCutoff) : "Sin movimientos"}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
            <StatusBadge status={connectionStatus} />
            {overview.isPlaceholderData ? (
              <span className="text-xs text-slate-400" aria-live="polite">
                Actualizando…
              </span>
            ) : null}
          </div>
        </div>
      </header>

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

      <section className="space-y-4" aria-labelledby="key-metrics-title">
        <DashboardSectionHeader
          eyebrow="Vista ejecutiva"
          title="Indicadores clave"
          description="Primero, los resultados del período y la posición acumulada hasta la fecha de corte."
          titleId="key-metrics-title"
        />
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Indicadores del período"
        >
          <DashboardMetricCard
            label="Ingresos"
            value={formatMoney(data.summary.income)}
            accent="stat-card-emerald"
            animationDelay="0ms"
          />
          <DashboardMetricCard
            label="Egresos"
            value={formatMoney(data.summary.expense)}
            accent="stat-card-rose"
            animationDelay="80ms"
          />
          <DashboardMetricCard
            label="Saldo del período"
            value={formatMoney(data.summary.netResult)}
            accent="stat-card-indigo"
            animationDelay="160ms"
          />
          <DashboardMetricCard
            label="Saldo acumulado"
            value={formatMoney(data.accumulated.balance)}
            accent="stat-card-emerald"
            animationDelay="240ms"
          >
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-medium text-emerald-300 hover:text-emerald-200">
                Ver acumulados
              </summary>
              <dl className="mt-2 space-y-1 border-t border-slate-700/70 pt-2 tabular-nums">
                <div className="flex justify-between gap-3">
                  <dt>Ingresos</dt>
                  <dd className="text-slate-200">{formatMoney(data.accumulated.income)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Egresos</dt>
                  <dd className="text-slate-200">{formatMoney(data.accumulated.expense)}</dd>
                </div>
              </dl>
            </details>
          </DashboardMetricCard>
          <DashboardMetricCard
            label="Tasa de ahorro"
            value={
              data.summary.savingsRate === null
                ? "No aplica"
                : formatPercent(data.summary.savingsRate)
            }
            accent="stat-card-sky"
            animationDelay="320ms"
          />
          <DashboardMetricCard
            label="Movimientos"
            value={data.summary.transactionCount.toLocaleString("es-PE")}
            accent="stat-card-sky"
            animationDelay="400ms"
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="financial-overview-title">
        <DashboardSectionHeader
          eyebrow="Evolución anual"
          title="Panorama financiero"
          description="Después de los indicadores, compara el flujo mensual y cómo se ha construido el saldo acumulado."
          titleId="financial-overview-title"
        />
        <div className="space-y-6">
          <FinancialTrendChart trend={data.trend} />
          <BalanceTrendChart trend={data.trend} />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="income-summary-title">
        <DashboardSectionHeader
          eyebrow="Origen de fondos"
          title="Análisis de ingresos"
          description="Revisa primero la composición del período y luego el comportamiento anual de ofrendas y diezmos."
          titleId="income-summary-title"
        />
        <div className="space-y-6">
          <IncomeCategoryChart categories={data.incomeCategories} />
          <ContributionTrendChart kind="OFRENDAS" trend={data.contributionTrends.OFRENDAS} />
          <ContributionTrendChart kind="DIEZMOS" trend={data.contributionTrends.DIEZMOS} />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="expense-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <DashboardSectionHeader
            eyebrow="Uso de fondos"
            title="Análisis ejecutivo de egresos"
            description="Distingue el peso de salarios y honorarios antes de profundizar en los demás rubros."
            titleId="expense-summary-title"
          />
          <Link className="button-secondary text-xs" to={expensesHref}>
            Profundizar en gastos
          </Link>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.5fr)]">
          <SalaryExpenseComparison composition={data.expenseComposition} />
          <ExpenseCategoryChart
            categories={data.expenseCategories}
            insights={data.expenseInsights}
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="recent-activity-title">
        <DashboardSectionHeader
          eyebrow="Detalle operativo"
          title="Actividad reciente"
          description="Cierra el resumen con las operaciones más recientes del período seleccionado."
          titleId="recent-activity-title"
        />
        <RecentTransactionList
          transactions={data.recentTransactions}
          movementsHref={movementsHref}
        />
      </section>
    </div>
  );
}
