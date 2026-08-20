import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import type {
  DashboardAccumulatedSummary,
  DashboardAccountPosition,
  DashboardIncomeScope,
  DashboardMetricComparison,
  DashboardPeriodComparison,
  DashboardPeriodSummary,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import { formatChartPeriod, tooltipStyle } from "./dashboard-chart-utils";
import {
  formatCompactDate,
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatPeriod,
  formatShortPeriod,
} from "../formatters";

type MetricTone = "income" | "expense" | "balance";
type ResultTone = "positive" | "negative" | "neutral";

const getResultTone = (result: number): ResultTone =>
  result > 0 ? "positive" : result < 0 ? "negative" : "neutral";

const getResultLabel = (tone: ResultTone): string => {
  if (tone === "positive") return "Superávit";
  if (tone === "negative") return "Déficit";
  return "Equilibrio";
};

const getScopeLabel = (scope: DashboardIncomeScope): string =>
  scope === "CONTRIBUTIONS" ? "Aportes" : "Ingresos totales";

const getScopeLabelLowercase = (scope: DashboardIncomeScope): string =>
  scope === "CONTRIBUTIONS" ? "aportes" : "ingresos totales";

const getComparisonText = (
  comparison: DashboardMetricComparison,
  previousPeriod: string,
): string => {
  if (comparison.direction === "UNCHANGED") {
    return "Sin variación vs " + formatShortPeriod(previousPeriod);
  }

  const arrow = comparison.direction === "INCREASED" ? "↑" : "↓";
  const variation =
    comparison.rate === null
      ? formatMoney(Math.abs(comparison.delta))
      : formatPercent(Math.abs(comparison.rate));
  return arrow + " " + variation + " vs " + formatShortPeriod(previousPeriod);
};

const getComparisonTone = (
  comparison: DashboardMetricComparison,
  metricTone: MetricTone | "result",
): ResultTone => {
  if (comparison.direction === "UNCHANGED") return "neutral";

  const isPositiveChange = comparison.direction === "INCREASED";
  if (metricTone === "expense") return isPositiveChange ? "negative" : "positive";
  return isPositiveChange ? "positive" : "negative";
};

function ExecutiveMetric({
  label,
  value,
  comparison,
  previousPeriod,
  tone,
}: {
  label: string;
  value: string;
  comparison: DashboardMetricComparison;
  previousPeriod: string;
  tone: MetricTone;
}) {
  return (
    <div className="home-metric" data-tone={tone}>
      <dt>
        <span className="home-metric-marker" aria-hidden="true" />
        {label}
      </dt>
      <dd>{value}</dd>
      <p className="home-metric-comparison" data-tone={getComparisonTone(comparison, tone)}>
        {getComparisonText(comparison, previousPeriod)}
      </p>
    </div>
  );
}

export function ExecutiveResultCard({
  selectedPeriod,
  summary,
  comparison,
  dataCutoff,
  scope,
}: {
  selectedPeriod: string;
  summary: DashboardPeriodSummary;
  comparison: DashboardPeriodComparison;
  dataCutoff: Date | null;
  scope: DashboardIncomeScope;
}) {
  const result = summary.netResult[scope];
  const resultTone = getResultTone(result);
  const resultComparison = comparison.netResult[scope];
  const previousPeriod = comparison.window.previousPeriod;

  return (
    <article className="home-result-card" data-tone={resultTone}>
      <p className="home-result-eyebrow">Resultado · {formatPeriod(selectedPeriod)}</p>
      <h2 className="home-result-status">{getResultLabel(resultTone)}</h2>
      <p className="home-result-value">{formatMoney(result)}</p>
      <p
        className="home-result-comparison"
        data-tone={getComparisonTone(resultComparison, "result")}
      >
        {getComparisonText(resultComparison, previousPeriod)}
      </p>
      <dl className="home-result-details">
        <div>
          <dt>Tasa de ahorro</dt>
          <dd>
            {summary.savingsRate[scope] === null
              ? "No aplica"
              : formatPercent(summary.savingsRate[scope])}
          </dd>
        </div>
        <div>
          <dt>Fecha de corte</dt>
          <dd>{dataCutoff ? formatCompactDate(dataCutoff) : "Sin movimientos"}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ExecutiveMetrics({
  summary,
  accumulated,
  comparison,
  scope,
}: {
  summary: DashboardPeriodSummary;
  accumulated: DashboardAccumulatedSummary;
  comparison: DashboardPeriodComparison;
  scope: DashboardIncomeScope;
}) {
  const previousPeriod = comparison.window.previousPeriod;

  return (
    <section className="home-metrics-panel" aria-label="Indicadores complementarios">
      <dl className="home-metrics-list">
        <ExecutiveMetric
          comparison={comparison.income[scope]}
          label={getScopeLabel(scope)}
          previousPeriod={previousPeriod}
          tone="income"
          value={formatMoney(summary.income[scope])}
        />
        <ExecutiveMetric
          comparison={comparison.expense}
          label="Egresos"
          previousPeriod={previousPeriod}
          tone="expense"
          value={formatMoney(summary.expense)}
        />
        <ExecutiveMetric
          comparison={comparison.accumulatedBalance[scope]}
          label={scope === "CONTRIBUTIONS" ? "Saldo de aportes" : "Saldo acumulado"}
          previousPeriod={previousPeriod}
          tone="balance"
          value={formatMoney(accumulated.balance[scope])}
        />
      </dl>
    </section>
  );
}

export function ExecutiveAccountPosition({
  position,
  dataCutoff,
}: {
  position: DashboardAccountPosition;
  dataCutoff: Date | null;
}) {
  const cutoffLabel = dataCutoff ? formatCompactDate(dataCutoff) : "Sin movimientos";
  const accountsWithBalance = position.accounts.filter((account) => account.balance !== 0);

  return (
    <section className="home-panel home-account-position" aria-labelledby="account-position-title">
      <div className="home-account-position-header">
        <div>
          <h2 className="home-pulse-title" id="account-position-title">
            Saldo por cuenta
          </h2>
          <p className="home-account-position-cutoff">Acumulado al {cutoffLabel}</p>
        </div>
      </div>
      <p className="home-account-position-description">
        Todos los ingresos, egresos y transferencias.
      </p>
      {position.accounts.length === 0 ? (
        <p className="home-account-position-empty">Aún no hay cuentas con movimientos.</p>
      ) : accountsWithBalance.length === 0 ? (
        <p className="home-account-position-empty">No hay cuentas con saldo.</p>
      ) : (
        <dl className="home-account-list">
          {accountsWithBalance.map((account) => (
            <div key={account.account}>
              <dt title={account.account}>{account.account}</dt>
              <dd data-tone={account.balance < 0 ? "negative" : "positive"}>
                {formatMoney(account.balance)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="home-account-total">
        <span>Total disponible</span>
        <strong data-tone={position.total < 0 ? "negative" : "positive"}>
          {formatMoney(position.total)}
        </strong>
      </div>
    </section>
  );
}

export function ExecutiveTrendChart({
  trend,
  scope,
}: {
  trend: DashboardTrendPoint[];
  scope: DashboardIncomeScope;
}) {
  const scopeLabel = getScopeLabel(scope);
  const scopeLabelLowercase = getScopeLabelLowercase(scope);
  const hasMovement = trend.some((point) => point.income[scope] !== 0 || point.expense !== 0);
  const trendDescription = scopeLabel + " y egresos de los últimos doce meses";

  return (
    <figure className="home-panel home-pulse-panel min-w-0" aria-labelledby="executive-trend-title">
      <div className="home-pulse-header">
        <h2 className="home-pulse-title" id="executive-trend-title">
          Pulso financiero · 12 meses
        </h2>
        <div className="home-chart-legend" aria-label={"Leyenda: " + trendDescription}>
          <span>
            <i data-tone="income" />
            {scopeLabel}
          </span>
          <span>
            <i data-tone="expense" />
            Egresos
          </span>
        </div>
      </div>

      {hasMovement ? (
        <>
          <div
            className="home-chart"
            role="region"
            aria-label={"Gráfico de " + trendDescription}
            tabIndex={0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                accessibilityLayer
                data={trend}
                margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--ui-chart-grid)"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="period"
                  minTickGap={18}
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 11 }}
                  tickFormatter={formatChartPeriod}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 11 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
                  labelFormatter={(label) => formatPeriod(String(label))}
                />
                <Line
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  dataKey={"income." + scope}
                  dot={false}
                  isAnimationActive={false}
                  name={scopeLabel}
                  stroke="var(--ui-chart-1)"
                  strokeLinecap="round"
                  strokeWidth={3}
                  type="monotone"
                />
                <Line
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  dataKey="expense"
                  dot={false}
                  isAnimationActive={false}
                  name="Egresos"
                  stroke="var(--ui-danger)"
                  strokeLinecap="round"
                  strokeWidth={3}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="sr-only">
            Comparación de {scopeLabelLowercase} y egresos de los últimos doce meses.
          </figcaption>
          <div className="sr-only">
            <table>
              <caption>{scopeLabel} y egresos de los últimos doce meses</caption>
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">{scopeLabel}</th>
                  <th scope="col">Egresos</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((point) => (
                  <tr key={point.period}>
                    <th scope="row">{formatPeriod(point.period)}</th>
                    <td>{formatMoney(point.income[scope])}</td>
                    <td>{formatMoney(point.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="empty-state home-trend-empty">
          Aún no hay movimientos para mostrar el pulso financiero.
        </p>
      )}
    </figure>
  );
}

export function ExecutiveDataExceptions({
  invalidTransactionCount,
}: {
  invalidTransactionCount: number;
}) {
  if (invalidTransactionCount === 0) return null;

  const rowLabel = invalidTransactionCount === 1 ? "fila excluida" : "filas excluidas";

  return (
    <section
      className="home-exception"
      aria-label="Calidad de datos requiere atención"
      role="status"
    >
      <span className="home-exception-mark" aria-hidden="true">
        !
      </span>
      <p>
        <strong>Calidad de datos.</strong> {invalidTransactionCount} {rowLabel} de los totales.{" "}
        <Link to="/control/calidad">Revisar calidad</Link>
      </p>
    </section>
  );
}
