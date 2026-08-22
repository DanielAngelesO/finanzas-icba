import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardIncomeGroup,
  DashboardIncomeScope,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import { incomeGroupDetails, getIncomeScopeLabel } from "../dashboard-income-presentation";
import { formatCompactMoney, formatMoney, formatPeriod } from "../formatters";
import { ChartEmptyState, ChartScrollArea } from "./dashboard-chart-support";
import { formatChartPeriod, tooltipStyle } from "./dashboard-chart-utils";

const incomeGroups = [
  "DIEZMOS",
  "OFRENDAS",
  "OTROS",
] as const satisfies readonly DashboardIncomeGroup[];

export function IncomeGroupCompositionTrendChart({ trend }: { trend: DashboardTrendPoint[] }) {
  const hasIncome = trend.some((point) =>
    incomeGroups.some((group) => point.incomeByGroup[group].amount > 0),
  );

  return (
    <figure className="card min-w-0" aria-labelledby="income-composition-trend-title">
      <div>
        <h4 className="section-title" id="income-composition-trend-title">
          Composición mensual de ingresos
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Diezmos, ofrendas y otros ingresos de los últimos doce meses.
        </p>
      </div>
      {!hasIncome ? (
        <ChartEmptyState>No se registraron ingresos en los últimos doce meses.</ChartEmptyState>
      ) : (
        <>
          <ChartScrollArea
            ariaLabel="Gráfico desplazable de composición mensual de ingresos"
            hintNoun="todos los meses"
            minWidth={trend.length * 20}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
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
                  dataKey="period"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatChartPeriod}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--ui-chart-cursor)" }}
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => formatPeriod(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                {incomeGroups.map((group) => (
                  <Bar
                    dataKey={"incomeByGroup." + group + ".amount"}
                    fill={incomeGroupDetails[group].color}
                    isAnimationActive={false}
                    key={group}
                    name={incomeGroupDetails[group].label}
                    stackId="income"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartScrollArea>
          <figcaption className="sr-only">
            Composición mensual de diezmos, ofrendas y otros ingresos.
          </figcaption>
          <table className="sr-only">
            <caption>Composición mensual de ingresos</caption>
            <thead>
              <tr>
                <th scope="col">Período</th>
                {incomeGroups.map((group) => (
                  <th key={group} scope="col">
                    {incomeGroupDetails[group].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{formatPeriod(point.period)}</th>
                  {incomeGroups.map((group) => {
                    const summary = point.incomeByGroup[group];
                    return (
                      <td key={group}>
                        {formatMoney(summary.amount)} ·{" "}
                        {summary.transactionCount.toLocaleString("es-PE")}{" "}
                        {summary.transactionCount === 1 ? "movimiento" : "movimientos"}
                      </td>
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

export function FinancialTrendChart({
  trend,
  scope,
}: {
  trend: DashboardTrendPoint[];
  scope: DashboardIncomeScope;
}) {
  const hasFinancialMovement = trend.some(
    (point) => point.income[scope] !== 0 || point.expense !== 0,
  );
  const incomeLabel = getIncomeScopeLabel(scope);

  return (
    <figure className="card min-w-0" aria-labelledby="financial-trend-title">
      <div>
        <h4 className="section-title" id="financial-trend-title">
          Ingresos frente a egresos
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Evolución de los últimos doce meses. Ingresos: {incomeLabel}; egresos: todos.
        </p>
      </div>
      {!hasFinancialMovement ? (
        <ChartEmptyState>No hay movimientos financieros en los últimos doce meses.</ChartEmptyState>
      ) : (
        <>
          <ChartScrollArea
            ariaLabel="Gráfico desplazable de ingresos y egresos mensuales"
            hintNoun="todos los meses"
            minWidth={trend.length * 20}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
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
                  dataKey="period"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatChartPeriod}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--ui-chart-cursor)" }}
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => formatPeriod(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                <Bar
                  dataKey={"income." + scope}
                  name="Ingresos"
                  fill="var(--ui-chart-1)"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expense"
                  name="Egresos"
                  fill="var(--ui-danger)"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartScrollArea>
          <figcaption className="sr-only">
            Comparación de {incomeLabel.toLocaleLowerCase("es-PE")} y egresos para los últimos doce
            meses.
          </figcaption>
          <table className="sr-only">
            <caption>Valores de ingresos y egresos por período</caption>
            <thead>
              <tr>
                <th scope="col">Período</th>
                <th scope="col">Ingresos</th>
                <th scope="col">Egresos</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((summary) => (
                <tr key={summary.period}>
                  <th scope="row">{formatPeriod(summary.period)}</th>
                  <td>{formatMoney(summary.income[scope])}</td>
                  <td>{formatMoney(summary.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
