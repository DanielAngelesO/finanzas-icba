import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardContributionKind,
  DashboardContributionTrendPoint,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import { formatCompactMoney, formatMoney, formatPeriod } from "../formatters";
import { ChartEmptyState } from "./dashboard-chart-support";
import { formatChartPeriod, tooltipStyle } from "./dashboard-chart-utils";

export function FinancialTrendChart({ trend }: { trend: DashboardTrendPoint[] }) {
  return (
    <figure className="card min-w-0" aria-labelledby="financial-trend-title">
      <div>
        <h4 className="section-title" id="financial-trend-title">
          Ingresos frente a egresos
        </h4>
        <p className="mt-1 text-sm text-slate-400">Evolución de los últimos doce meses.</p>
      </div>
      <div className="mt-5 h-72 min-w-0 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={trend}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--ui-chart-grid)" strokeDasharray="3 3" vertical={false} />
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
              dataKey="income"
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
      </div>
      <figcaption className="sr-only">
        Comparación de ingresos y egresos para los últimos doce meses.
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
              <td>{formatMoney(summary.income)}</td>
              <td>{formatMoney(summary.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BalanceTrendChart({ trend }: { trend: DashboardTrendPoint[] }) {
  return (
    <figure className="card min-w-0" aria-labelledby="balance-trend-title">
      <div>
        <h4 className="section-title" id="balance-trend-title">
          Saldo acumulado histórico y resultado mensual
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          El saldo acumulado considera todo el historial hasta el corte.
        </p>
      </div>
      <div className="mt-5 h-72 min-w-0 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            accessibilityLayer
            data={trend}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--ui-chart-grid)" strokeDasharray="3 3" vertical={false} />
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
            <ReferenceLine y={0} stroke="var(--ui-text-faint)" strokeDasharray="4 4" />
            <Bar
              dataKey="netResult"
              name="Saldo neto mensual"
              fill="var(--ui-chart-2)"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeBalance"
              name="Saldo acumulado histórico"
              stroke="var(--ui-chart-1)"
              strokeWidth={3}
              dot={{ fill: "var(--ui-chart-1)", r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Evolución del saldo neto mensual y del saldo acumulado histórico.
      </figcaption>
      <table className="sr-only">
        <caption>Valores de saldo acumulado histórico y resultado mensual</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Saldo neto mensual</th>
            <th scope="col">Saldo acumulado histórico</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((summary) => (
            <tr key={summary.period}>
              <th scope="row">{formatPeriod(summary.period)}</th>
              <td>{formatMoney(summary.netResult)}</td>
              <td>{formatMoney(summary.cumulativeBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const contributionChartDetails = {
  OFRENDAS: {
    title: "Comportamiento de ofrendas",
    description: "Monto recibido y cantidad de ofrendas registradas por mes.",
    amountColor: "var(--ui-chart-3)",
    countColor: "var(--ui-chart-1)",
    emptyMessage: "No se registraron ofrendas en los últimos doce meses.",
  },
  DIEZMOS: {
    title: "Comportamiento de diezmos",
    description: "Monto recibido y cantidad de diezmos registrados por mes.",
    amountColor: "var(--ui-chart-2)",
    countColor: "var(--ui-chart-4)",
    emptyMessage: "No se registraron diezmos en los últimos doce meses.",
  },
} satisfies Record<
  DashboardContributionKind,
  {
    title: string;
    description: string;
    amountColor: string;
    countColor: string;
    emptyMessage: string;
  }
>;

export function ContributionTrendChart({
  kind,
  trend,
}: {
  kind: DashboardContributionKind;
  trend: DashboardContributionTrendPoint[];
}) {
  const details = contributionChartDetails[kind];
  const hasContributions = trend.some((point) => point.transactionCount > 0);
  const titleId = "contribution-trend-" + kind.toLocaleLowerCase("es-PE") + "-title";

  return (
    <figure className="card min-w-0" aria-labelledby={titleId}>
      <div>
        <h4 className="section-title" id={titleId}>
          {details.title}
        </h4>
        <p className="mt-1 text-sm text-slate-400">{details.description}</p>
      </div>
      {!hasContributions ? (
        <ChartEmptyState>{details.emptyMessage}</ChartEmptyState>
      ) : (
        <>
          <div className="mt-5 h-72 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
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
                  yAxisId="amount"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--ui-chart-cursor)" }}
                  formatter={(value, name) =>
                    String(name) === "Monto recibido"
                      ? [formatMoney(Number(value)), name]
                      : [Number(value).toLocaleString("es-PE") + " aportes", name]
                  }
                  labelFormatter={(label) => formatPeriod(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                <Bar
                  yAxisId="amount"
                  dataKey="amount"
                  name="Monto recibido"
                  fill={details.amountColor}
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="transactionCount"
                  name="Número de aportes"
                  stroke={details.countColor}
                  strokeWidth={3}
                  dot={{ fill: details.countColor, r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="sr-only">
            {details.description} Evolución de los últimos doce meses.
          </figcaption>
          <table className="sr-only">
            <caption>{details.title}</caption>
            <thead>
              <tr>
                <th scope="col">Período</th>
                <th scope="col">Monto recibido</th>
                <th scope="col">Número de aportes</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{formatPeriod(point.period)}</th>
                  <td>{formatMoney(point.amount)}</td>
                  <td>{point.transactionCount.toLocaleString("es-PE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
