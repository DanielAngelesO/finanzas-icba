import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { DashboardIncomeScope } from "../../domain/dashboard";
import {
  ExecutiveDataExceptions,
  ExecutiveAccountPosition,
  ExecutiveMetrics,
  ExecutiveResultCard,
  ExecutiveTrendChart,
} from "../components/home-executive-widgets";
import { IncomeScopeToggle } from "../components/dashboard-income-scope-toggle";
import { formatCompactDate, formatPeriod } from "../formatters";

const getSelectedPeriod = (
  requestedPeriod: string | undefined,
  availablePeriods: string[] | undefined,
  fallbackPeriod: string | null | undefined,
): string =>
  requestedPeriod && availablePeriods?.includes(requestedPeriod)
    ? requestedPeriod
    : (fallbackPeriod ?? "");

const readIncomeScope = (value: string | null): DashboardIncomeScope =>
  value === "contributions" ? "CONTRIBUTIONS" : "ALL";

const toIncomeScopeParam = (scope: DashboardIncomeScope): string =>
  scope === "CONTRIBUTIONS" ? "contributions" : "all";

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.22-3.22a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function HomePage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriod = searchParams.get("period") ?? undefined;
  const incomeScope = readIncomeScope(searchParams.get("income"));
  const overview = useQuery({
    queryKey: ["dashboard-overview", requestedPeriod],
    queryFn: () => services.dashboard.execute(requestedPeriod),
    placeholderData: keepPreviousData,
  });
  const selectedPeriod = getSelectedPeriod(
    requestedPeriod,
    overview.data?.availablePeriods,
    overview.data?.selectedPeriod,
  );

  const updatePeriod = (period: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("period", period);
    if (incomeScope === "CONTRIBUTIONS") {
      nextParams.set("income", toIncomeScopeParam(incomeScope));
    } else {
      nextParams.delete("income");
    }
    setSearchParams(nextParams);
  };

  const updateIncomeScope = (scope: DashboardIncomeScope) => {
    const nextParams = new URLSearchParams(searchParams);
    if (scope === "CONTRIBUTIONS") {
      nextParams.set("income", toIncomeScopeParam(scope));
    } else {
      nextParams.delete("income");
    }
    setSearchParams(nextParams);
  };

  if (overview.isPending) {
    return (
      <div className="home-page animate-fade-in-up" aria-busy="true" aria-live="polite">
        <h1 className="sr-only">Inicio</h1>
        <p className="sr-only">Preparando la vista ejecutiva.</p>
        <div className="home-toolbar-skeleton shimmer" aria-hidden="true" />
        <div className="shimmer h-56" aria-hidden="true" />
        <div className="shimmer h-28" aria-hidden="true" />
        <div className="shimmer h-72" aria-hidden="true" />
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <section className="home-state animate-fade-in-up" role="alert">
        <h1 className="sr-only">Inicio</h1>
        <p className="alert-error">No se pudo cargar la vista ejecutiva.</p>
        <button className="button-secondary" type="button" onClick={() => void overview.refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const { data } = overview;

  if (!data.summary || !data.accumulated || !data.accountPosition || !data.comparison) {
    return (
      <section className="home-state animate-fade-in-up">
        <h1 className="sr-only">Inicio</h1>
        <div className="empty-state">
          <p className="font-semibold text-slate-200">Aún no hay información financiera.</p>
          <p className="mt-2">Revisa la fuente y la calidad de los datos para comenzar.</p>
          <Link className="button-secondary mt-5 inline-flex" to="/control/calidad">
            Revisar calidad de datos
          </Link>
        </div>
      </section>
    );
  }

  const { summary, accumulated, comparison } = data;
  const detailHref =
    "/resumen?period=" + selectedPeriod + "&income=" + toIncomeScopeParam(incomeScope);

  return (
    <div className="home-page animate-fade-in-up">
      <h1 className="sr-only">Inicio</h1>
      <header className="home-toolbar">
        <div className="home-toolbar-copy">
          <p className="home-section-eyebrow">Vista ejecutiva</p>
          <p className="home-toolbar-cutoff">
            Al corte: {data.dataCutoff ? formatCompactDate(data.dataCutoff) : "Sin movimientos"}
          </p>
        </div>
        <div className="home-toolbar-controls">
          <label className="period-control">
            <span>Período</span>
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
          <IncomeScopeToggle
            label="Filtrar por solo aportes: diezmos y ofrendas"
            onChange={updateIncomeScope}
            scope={incomeScope}
          />
        </div>
      </header>

      {overview.isPlaceholderData ? (
        <p className="home-updating" role="status" aria-live="polite">
          Actualizando el período…
        </p>
      ) : null}

      <div className="home-overview-grid">
        <section aria-label="Resultado financiero">
          <ExecutiveResultCard
            comparison={comparison}
            dataCutoff={data.dataCutoff}
            selectedPeriod={selectedPeriod}
            scope={incomeScope}
            summary={summary}
          />
        </section>

        <ExecutiveMetrics
          accumulated={accumulated}
          comparison={comparison}
          scope={incomeScope}
          summary={summary}
        />
      </div>

      <div className="home-financial-details-grid">
        <ExecutiveAccountPosition dataCutoff={data.dataCutoff} position={data.accountPosition} />
        <ExecutiveTrendChart scope={incomeScope} trend={data.trend} />
      </div>

      <ExecutiveDataExceptions invalidTransactionCount={data.dataQuality.invalidTransactionCount} />

      <div className="home-summary-action">
        <Link className="home-detail-link" to={detailHref}>
          Ver resumen detallado
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}
