import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { DashboardIncomeScope } from "../../domain/dashboard";
import {
  DashboardAnalysisTabs,
  type DashboardAnalysisTab,
} from "../components/dashboard-analysis-tabs";
import {
  FinancialTrendChart,
  IncomeGroupCompositionTrendChart,
} from "../components/dashboard-annual-widgets";
import { DashboardContextBar } from "../components/dashboard-context-bar";
import {
  ExpenseSummaryCard,
  FinancialScenarioCard,
  IncomeSummaryCards,
} from "../components/dashboard-kpi-widgets";
import {
  ExpenseCategoryChart,
  IncomeCategoryChart,
  SalaryExpenseComparison,
} from "../components/dashboard-period-analysis-widgets";
import {
  PeriodFinancialTrendChart,
  PeriodIncomeBehaviorChart,
} from "../components/dashboard-period-trend-widgets";
import { RecentTransactionList } from "../components/dashboard-recent-activity";
import { getIncomeScopeLabel } from "../dashboard-income-presentation";

const readIncomeScope = (value: string | null): DashboardIncomeScope =>
  value === "all" ? "ALL" : "CONTRIBUTIONS";

const toIncomeScopeParam = (scope: DashboardIncomeScope): string =>
  scope === "ALL" ? "all" : "contributions";

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

export function DashboardPage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<DashboardAnalysisTab>("CURRENT");
  const requestedPeriod = searchParams.get("period") ?? undefined;
  const incomeScope = readIncomeScope(searchParams.get("income"));
  const overview = useQuery({
    queryKey: ["dashboard-overview", requestedPeriod],
    queryFn: () => services.dashboard.execute(requestedPeriod),
    placeholderData: keepPreviousData,
  });
  const selectedPeriod =
    requestedPeriod && overview.data?.availablePeriods.includes(requestedPeriod)
      ? requestedPeriod
      : (overview.data?.selectedPeriod ?? "");

  const updatePeriod = (period: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("period", period);
    setSearchParams(nextParams);
  };

  const updateIncomeScope = (scope: DashboardIncomeScope) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("income", toIncomeScopeParam(scope));
    setSearchParams(nextParams);
  };

  if (overview.isPending) {
    return (
      <div className="space-y-8 animate-fade-in-up" aria-busy="true" aria-live="polite">
        <h2 className="sr-only">Resumen financiero</h2>
        <p className="sr-only">Cargando la información del período.</p>
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
        <h2 className="sr-only">Resumen financiero</h2>
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

  if (
    !data.summary ||
    !data.accumulated ||
    !data.comparison ||
    !data.incomeBreakdown ||
    !data.expenseComposition ||
    !data.expenseInsights
  ) {
    return (
      <div className="space-y-8 animate-fade-in-up">
        <h2 className="sr-only">Resumen financiero</h2>
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

  const periodAnalysis = (
    <div className="space-y-6">
      <PeriodFinancialTrendChart scope={incomeScope} trend={data.periodDailyTrend} />
      <details className="dashboard-analysis-details">
        <summary>Ver ritmo acumulado por grupo</summary>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Observa cuándo se registran diezmos, ofrendas y otros ingresos a lo largo del período.
        </p>
        <div className="mt-5">
          <PeriodIncomeBehaviorChart scope={incomeScope} trend={data.periodIncomeBehavior} />
        </div>
      </details>
    </div>
  );
  const annualAnalysis = (
    <div className="space-y-6">
      <IncomeGroupCompositionTrendChart trend={data.trend} />
      <FinancialTrendChart scope={incomeScope} trend={data.trend} />
    </div>
  );

  return (
    <div className="space-y-9 animate-fade-in-up lg:space-y-10">
      <h2 className="sr-only">Resumen financiero</h2>

      <DashboardContextBar
        availablePeriods={data.availablePeriods}
        onPeriodChange={updatePeriod}
        onScopeChange={updateIncomeScope}
        scope={incomeScope}
        selectedPeriod={selectedPeriod}
        updating={overview.isPlaceholderData}
      />

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

      <section className="space-y-4" aria-labelledby="income-overview-title">
        <DashboardSectionHeader
          eyebrow="Vista ejecutiva"
          title="Ingresos del período"
          description="Los tres montos se mantienen visibles; el alcance seleccionado solo cambia el análisis."
          titleId="income-overview-title"
        />
        <IncomeSummaryCards
          breakdown={data.incomeBreakdown}
          comparison={data.comparison}
          previousPeriod={data.comparison.window.previousPeriod}
          scope={incomeScope}
          summary={data.summary}
        />
      </section>

      <section className="space-y-4" aria-labelledby="financial-result-title">
        <DashboardSectionHeader
          eyebrow="Resultado financiero"
          title="Egresos, resultado y posición acumulada"
          description="Cada escenario conserva todos los egresos; el total con otros ingresos es el saldo contable."
          titleId="financial-result-title"
        />
        <div className="grid gap-4 xl:grid-cols-3" aria-label="Indicadores financieros del período">
          <ExpenseSummaryCard
            comparison={data.comparison.expense}
            expense={data.summary.expense}
            previousPeriod={data.comparison.window.previousPeriod}
          />
          <FinancialScenarioCard
            accumulated={data.accumulated}
            comparison={data.comparison}
            previousPeriod={data.comparison.window.previousPeriod}
            scope="CONTRIBUTIONS"
            selected={incomeScope === "CONTRIBUTIONS"}
            summary={data.summary}
          />
          <FinancialScenarioCard
            accumulated={data.accumulated}
            comparison={data.comparison}
            previousPeriod={data.comparison.window.previousPeriod}
            scope="ALL"
            selected={incomeScope === "ALL"}
            summary={data.summary}
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="analysis-title">
        <DashboardSectionHeader
          eyebrow="Análisis"
          title="Evolución financiera"
          description={
            "Alcance activo: " +
            getIncomeScopeLabel(incomeScope) +
            ". Los tres montos de ingresos no cambian."
          }
          titleId="analysis-title"
        />
        <DashboardAnalysisTabs
          activeTab={activeAnalysisTab}
          annualPanel={annualAnalysis}
          currentPanel={periodAnalysis}
          onChange={setActiveAnalysisTab}
        />
      </section>

      <section className="space-y-4" aria-labelledby="income-summary-title">
        <DashboardSectionHeader
          eyebrow="Origen de fondos"
          title="Categorías de ingreso"
          description={
            "Composición de " + getIncomeScopeLabel(incomeScope).toLocaleLowerCase("es-PE") + "."
          }
          titleId="income-summary-title"
        />
        <IncomeCategoryChart categories={data.incomeCategories[incomeScope]} />
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
