import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type {
  DashboardDailyTrendPoint,
  DashboardIncomeBehaviorPoint,
  DashboardIncomeGroup,
  DashboardIncomeScope,
} from "../../domain/dashboard";
import { getIncomeScopeLabel, incomeGroupDetails } from "../dashboard-income-presentation";
import { formatCompactMoney, formatMoney, formatPercent } from "../formatters";
import { ChartEmptyState } from "./dashboard-chart-support";
import { formatChartDate, formatChartDay, tooltipStyle } from "./dashboard-chart-utils";

const incomeGroupsByScope = {
  CONTRIBUTIONS: ["DIEZMOS", "OFRENDAS"],
  ALL: ["DIEZMOS", "OFRENDAS", "OTROS"],
} as const satisfies Record<DashboardIncomeScope, readonly DashboardIncomeGroup[]>;

function DailyChartViewport({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <>
      <div className="chart-scroll mt-5" role="region" aria-label={ariaLabel} tabIndex={0}>
        <div className="h-72 min-w-[44rem] sm:h-80">{children}</div>
      </div>
      <p className="mt-3 text-xs text-slate-500 sm:hidden" aria-hidden="true">
        Desliza el gráfico horizontalmente para recorrer todos los días.
      </p>
    </>
  );
}

export function PeriodIncomeBehaviorChart({
  trend,
  scope,
}: {
  trend: DashboardIncomeBehaviorPoint[];
  scope: DashboardIncomeScope;
}) {
  const groups = incomeGroupsByScope[scope];
  const visibleGroups = groups.filter((group) =>
    trend.some((point) => point.cumulativeShare[group] !== null),
  );

  return (
    <figure className="card min-w-0" aria-labelledby="period-income-behavior-title">
      <div>
        <h4 className="section-title" id="period-income-behavior-title">
          Ritmo acumulado de ingresos
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Avance diario de cada grupo sobre su propio total mensual. Alcance:{" "}
          {getIncomeScopeLabel(scope)}.
        </p>
      </div>
      {trend.length === 0 ? (
        <ChartEmptyState>No hay movimientos en este período.</ChartEmptyState>
      ) : visibleGroups.length === 0 ? (
        <ChartEmptyState>No hay ingresos para el alcance seleccionado.</ChartEmptyState>
      ) : (
        <>
          <DailyChartViewport ariaLabel="Gráfico desplazable del ritmo acumulado de ingresos">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                accessibilityLayer
                data={trend}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--ui-chart-grid)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatChartDay}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={(value) => formatPercent(Number(value))}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "var(--ui-chart-cursor)", strokeWidth: 16 }}
                  formatter={(value) => formatPercent(Number(value))}
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                {visibleGroups.map((group) => {
                  const details = incomeGroupDetails[group];
                  return (
                    <Line
                      dataKey={`cumulativeShare.${group}`}
                      dot={false}
                      key={group}
                      name={details.label}
                      stroke={details.color}
                      strokeWidth={3}
                      type="stepAfter"
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </DailyChartViewport>
          <figcaption className="sr-only">
            Ritmo acumulado de {getIncomeScopeLabel(scope).toLocaleLowerCase("es-PE")} por día del
            período.
          </figcaption>
          <table className="sr-only">
            <caption>Ritmo acumulado de ingresos por día</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                {visibleGroups.map((group) => (
                  <th key={group} scope="col">
                    {incomeGroupDetails[group].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatChartDate(point.date)}</th>
                  {visibleGroups.map((group) => {
                    const value = point.cumulativeShare[group];
                    return (
                      <td key={group}>{value === null ? "Sin ingresos" : formatPercent(value)}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

export function PeriodFinancialTrendChart({
  trend,
  scope,
}: {
  trend: DashboardDailyTrendPoint[];
  scope: DashboardIncomeScope;
}) {
  const hasFinancialMovement = trend.some(
    (point) => point.income[scope] !== 0 || point.expense !== 0,
  );
  const chartData = trend.map((point) => ({
    date: point.date,
    income: point.income[scope],
    expense: -point.expense,
  }));

  return (
    <figure className="card min-w-0" aria-labelledby="period-financial-trend-title">
      <div>
        <h4 className="section-title" id="period-financial-trend-title">
          Ingresos frente a egresos por día
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Barras sobre cero: ingresos. Barras bajo cero: egresos. Alcance de ingresos:{" "}
          {getIncomeScopeLabel(scope)}.
        </p>
      </div>
      {trend.length === 0 ? (
        <ChartEmptyState>No hay movimientos en este período.</ChartEmptyState>
      ) : !hasFinancialMovement ? (
        <ChartEmptyState>No hay ingresos para el alcance seleccionado ni egresos.</ChartEmptyState>
      ) : (
        <>
          <DailyChartViewport ariaLabel="Gráfico desplazable de ingresos y egresos diarios">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--ui-chart-grid)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatChartDay}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={(value) => formatCompactMoney(Math.abs(Number(value)))}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--ui-chart-cursor)" }}
                  formatter={(value) => formatMoney(Math.abs(Number(value)))}
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                <ReferenceLine y={0} stroke="var(--ui-text-faint)" />
                <Bar
                  dataKey="income"
                  fill="var(--ui-success)"
                  isAnimationActive={false}
                  name="Ingresos"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--ui-danger)"
                  isAnimationActive={false}
                  name="Egresos"
                  radius={[0, 0, 4, 4]}
                />
              </BarChart>
            </ResponsiveContainer>
          </DailyChartViewport>
          <figcaption className="sr-only">
            Comparación diaria de {getIncomeScopeLabel(scope).toLocaleLowerCase("es-PE")} y egresos
            del período seleccionado.
          </figcaption>
          <table className="sr-only">
            <caption>Valores diarios de ingresos y egresos</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Ingresos</th>
                <th scope="col">Egresos</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatChartDate(point.date)}</th>
                  <td>{formatMoney(point.income[scope])}</td>
                  <td>{formatMoney(point.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
