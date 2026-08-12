import type { ReactNode } from "react";
import type {
  DashboardAccumulatedSummary,
  DashboardIncomeBreakdown,
  DashboardIncomeGroup,
  DashboardIncomeScope,
  DashboardMetricComparison,
  DashboardPeriodComparison,
  DashboardPeriodSummary,
  DashboardRateComparison,
} from "../../domain/dashboard";
import { incomeGroupDetails, incomeScopeDetails } from "../dashboard-income-presentation";
import { formatMoney, formatPercent, formatShortPeriod } from "../formatters";

type DashboardMetricAccent =
  "stat-card-emerald" | "stat-card-indigo" | "stat-card-rose" | "stat-card-sky" | "stat-card-amber";

type MetricTone = "income" | "expense" | "result" | "balance";

const comparisonDirectionDetails = {
  INCREASED: { arrow: "↑", text: "Aumentó", noun: "un aumento" },
  DECREASED: { arrow: "↓", text: "Disminuyó", noun: "una disminución" },
  UNCHANGED: { arrow: "—", text: "Sin variación", noun: "ninguna variación" },
} as const;

const getComparisonTone = (
  tone: MetricTone,
  direction: DashboardMetricComparison["direction"],
): string => {
  if (direction === "UNCHANGED") return "metric-comparison-neutral";
  const isFavorable = tone === "expense" ? direction === "DECREASED" : direction === "INCREASED";
  return isFavorable ? "metric-comparison-positive" : "metric-comparison-negative";
};

const formatSignedMoney = (amount: number): string => (amount > 0 ? "+" : "") + formatMoney(amount);

const formatPercentagePoints = (amount: number): string =>
  new Intl.NumberFormat("es-PE", {
    signDisplay: "exceptZero",
    maximumFractionDigits: 1,
  }).format(amount) + " p.p.";

const formatAbsolutePercentagePoints = (amount: number): string =>
  new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: 1,
  }).format(Math.abs(amount)) + " p.p.";

export function DashboardMetricCard({
  label,
  value,
  accent,
  animationDelay,
  selected = false,
  children,
}: {
  label: string;
  value?: string;
  accent: DashboardMetricAccent;
  animationDelay: string;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className={"stat-card " + accent}
      data-selected={selected ? "" : undefined}
      style={{ animationDelay }}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      {value ? (
        <p className="metric-value mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
      ) : null}
      {children}
    </article>
  );
}

export function MetricComparisonIndicator({
  comparison,
  previousPeriod,
  tone,
  compact = false,
}: {
  comparison: DashboardMetricComparison;
  previousPeriod: string;
  tone: MetricTone;
  compact?: boolean;
}) {
  const directionDetails = comparisonDirectionDetails[comparison.direction];
  const periodLabel = formatShortPeriod(previousPeriod);
  const variationText =
    comparison.direction === "UNCHANGED"
      ? "Sin variación"
      : comparison.rate === null
        ? directionDetails.arrow +
          " " +
          directionDetails.text +
          " " +
          formatMoney(Math.abs(comparison.delta))
        : directionDetails.arrow +
          " " +
          directionDetails.text +
          " " +
          formatPercent(Math.abs(comparison.rate));
  return (
    <div
      className={
        "metric-comparison mt-3 " +
        getComparisonTone(tone, comparison.direction) +
        (compact ? " metric-comparison-compact" : "")
      }
    >
      <p>
        <span>{variationText}</span>
        <span> · vs {periodLabel}</span>
      </p>
      <dl className="metric-comparison-details">
        <div>
          <dt>Anterior</dt>
          <dd>{formatMoney(comparison.previousValue)}</dd>
        </div>
        <div>
          <dt>Diferencia</dt>
          <dd>{formatSignedMoney(comparison.delta)}</dd>
        </div>
      </dl>
      {comparison.rate === null && comparison.direction !== "UNCHANGED" ? (
        <p className="metric-comparison-note">Sin base porcentual</p>
      ) : null}
    </div>
  );
}

function RateComparisonIndicator({
  comparison,
  previousPeriod,
}: {
  comparison: DashboardRateComparison;
  previousPeriod: string;
}) {
  const comparable = comparison.delta !== null && comparison.direction !== null;
  const directionDetails =
    comparison.direction === null ? null : comparisonDirectionDetails[comparison.direction];
  return (
    <div className="rate-comparison mt-2">
      <p className="metric-comparison-neutral">
        {comparable && directionDetails
          ? directionDetails.arrow +
            " " +
            directionDetails.text +
            " " +
            formatAbsolutePercentagePoints(comparison.delta ?? 0) +
            " · vs " +
            formatShortPeriod(previousPeriod)
          : "No comparable · vs " + formatShortPeriod(previousPeriod)}
      </p>
      <dl className="metric-comparison-details">
        <div>
          <dt>Anterior</dt>
          <dd>
            {comparison.previousValue === null
              ? "No comparable"
              : formatPercent(comparison.previousValue)}
          </dd>
        </div>
        <div>
          <dt>Variación</dt>
          <dd>
            {comparison.delta === null ? "No comparable" : formatPercentagePoints(comparison.delta)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function IncomeGroupLine({
  group,
  summary,
  comparison,
  previousPeriod,
}: {
  group: Exclude<DashboardIncomeGroup, "OTROS">;
  summary: DashboardIncomeBreakdown[DashboardIncomeGroup];
  comparison: DashboardMetricComparison;
  previousPeriod: string;
}) {
  const details = incomeGroupDetails[group];

  return (
    <div className="income-group-line">
      <dt>
        <span
          className="income-group-dot"
          style={{ backgroundColor: details.color }}
          aria-hidden="true"
        />
        {details.label}
      </dt>
      <dd>
        <p className="font-semibold tabular-nums text-slate-100">{formatMoney(summary.amount)}</p>
        <p className="mt-1 text-xs text-slate-400">
          {summary.transactionCount.toLocaleString("es-PE")}{" "}
          {summary.transactionCount === 1 ? "movimiento" : "movimientos"}
        </p>
        <MetricComparisonIndicator
          comparison={comparison}
          compact
          previousPeriod={previousPeriod}
          tone="income"
        />
      </dd>
    </div>
  );
}

function IncomeAmountCard({
  label,
  description,
  amount,
  transactionCount,
  comparison,
  previousPeriod,
  accent,
  selected,
  animationDelay,
  children,
}: {
  label: string;
  description: string;
  amount: number;
  transactionCount: number;
  comparison: DashboardMetricComparison;
  previousPeriod: string;
  accent: DashboardMetricAccent;
  selected: boolean;
  animationDelay: string;
  children?: ReactNode;
}) {
  return (
    <DashboardMetricCard
      accent={accent}
      animationDelay={animationDelay}
      label={label}
      selected={selected}
      value={formatMoney(amount)}
    >
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      {selected ? <p className="scope-selection-label">Alcance de análisis activo</p> : null}
      <p className="mt-3 text-xs text-slate-400">
        {transactionCount.toLocaleString("es-PE")}{" "}
        {transactionCount === 1 ? "movimiento" : "movimientos"}
      </p>
      <MetricComparisonIndicator
        comparison={comparison}
        previousPeriod={previousPeriod}
        tone="income"
      />
      {children}
    </DashboardMetricCard>
  );
}

export function IncomeSummaryCards({
  summary,
  breakdown,
  comparison,
  previousPeriod,
  scope,
}: {
  summary: DashboardPeriodSummary;
  breakdown: DashboardIncomeBreakdown;
  comparison: DashboardPeriodComparison;
  previousPeriod: string;
  scope: DashboardIncomeScope;
}) {
  const contributionTransactionCount =
    breakdown.DIEZMOS.transactionCount + breakdown.OFRENDAS.transactionCount;
  const totalTransactionCount = contributionTransactionCount + breakdown.OTROS.transactionCount;

  return (
    <div
      aria-label="Indicadores de ingresos"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      role="region"
    >
      <IncomeAmountCard
        accent="stat-card-indigo"
        amount={summary.income.CONTRIBUTIONS}
        animationDelay="0ms"
        comparison={comparison.income.CONTRIBUTIONS}
        description="Solo diezmos + ofrendas."
        label={incomeScopeDetails.CONTRIBUTIONS.cardLabel}
        previousPeriod={previousPeriod}
        selected={scope === "CONTRIBUTIONS"}
        transactionCount={contributionTransactionCount}
      >
        <dl className="income-group-breakdown">
          <IncomeGroupLine
            comparison={comparison.incomeByGroup.DIEZMOS}
            group="DIEZMOS"
            previousPeriod={previousPeriod}
            summary={breakdown.DIEZMOS}
          />
          <IncomeGroupLine
            comparison={comparison.incomeByGroup.OFRENDAS}
            group="OFRENDAS"
            previousPeriod={previousPeriod}
            summary={breakdown.OFRENDAS}
          />
        </dl>
      </IncomeAmountCard>

      <IncomeAmountCard
        accent="stat-card-amber"
        amount={breakdown.OTROS.amount}
        animationDelay="80ms"
        comparison={comparison.incomeByGroup.OTROS}
        description={formatPercent(breakdown.OTROS.share) + " de los ingresos totales."}
        label={incomeGroupDetails.OTROS.label}
        previousPeriod={previousPeriod}
        selected={false}
        transactionCount={breakdown.OTROS.transactionCount}
      />

      <IncomeAmountCard
        accent="stat-card-emerald"
        amount={summary.income.ALL}
        animationDelay="160ms"
        comparison={comparison.income.ALL}
        description="Incluye otros ingresos."
        label={incomeScopeDetails.ALL.cardLabel}
        previousPeriod={previousPeriod}
        selected={scope === "ALL"}
        transactionCount={totalTransactionCount}
      />
    </div>
  );
}

export function ExpenseSummaryCard({
  expense,
  comparison,
  previousPeriod,
}: {
  expense: number;
  comparison: DashboardMetricComparison;
  previousPeriod: string;
}) {
  return (
    <DashboardMetricCard
      accent="stat-card-rose"
      animationDelay="240ms"
      label="Egresos"
      value={formatMoney(expense)}
    >
      <p className="mt-1 text-xs leading-5 text-slate-400">Todos los egresos del período.</p>
      <MetricComparisonIndicator
        comparison={comparison}
        previousPeriod={previousPeriod}
        tone="expense"
      />
    </DashboardMetricCard>
  );
}

export function FinancialScenarioCard({
  scope,
  summary,
  accumulated,
  comparison,
  previousPeriod,
  selected,
}: {
  scope: DashboardIncomeScope;
  summary: DashboardPeriodSummary;
  accumulated: DashboardAccumulatedSummary;
  comparison: DashboardPeriodComparison;
  previousPeriod: string;
  selected: boolean;
}) {
  const isOfficial = scope === "ALL";
  const details = incomeScopeDetails[scope];

  return (
    <DashboardMetricCard
      accent={isOfficial ? "stat-card-emerald" : "stat-card-indigo"}
      animationDelay={isOfficial ? "400ms" : "320ms"}
      label={isOfficial ? "Resultado total" : "Resultado de aportes"}
      selected={selected}
      value={formatMoney(summary.netResult[scope])}
    >
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {isOfficial ? "Saldo contable. " : "Escenario analítico. "}
        {details.description}
      </p>
      {selected ? <p className="scope-selection-label">Alcance de análisis activo</p> : null}
      <MetricComparisonIndicator
        comparison={comparison.netResult[scope]}
        previousPeriod={previousPeriod}
        tone="result"
      />
      <dl className="financial-scenario-details">
        <div>
          <dt>Tasa de ahorro</dt>
          <dd>
            {summary.savingsRate[scope] === null
              ? "No aplica"
              : formatPercent(summary.savingsRate[scope])}
          </dd>
          <RateComparisonIndicator
            comparison={comparison.savingsRate[scope]}
            previousPeriod={previousPeriod}
          />
        </div>
        <div>
          <dt>Saldo acumulado</dt>
          <dd>{formatMoney(accumulated.balance[scope])}</dd>
          <MetricComparisonIndicator
            comparison={comparison.accumulatedBalance[scope]}
            compact
            previousPeriod={previousPeriod}
            tone="balance"
          />
        </div>
      </dl>
    </DashboardMetricCard>
  );
}
