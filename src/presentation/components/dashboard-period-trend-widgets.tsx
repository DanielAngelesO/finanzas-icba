import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import type { DashboardDailyTrendPoint } from "../../domain/dashboard";
import { formatCompactMoney, formatMoney } from "../formatters";
import { ChartEmptyState } from "./dashboard-chart-support";
import { formatChartDate, formatChartDay, tooltipStyle } from "./dashboard-chart-utils";

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

export function PeriodBalanceTrendChart({ trend }: { trend: DashboardDailyTrendPoint[] }) {
  return (
    <figure className="card min-w-0" aria-labelledby="period-balance-trend-title">
      <div>
        <h4 className="section-title" id="period-balance-trend-title">
          Saldo diario y acumulado del período
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Barras: saldo neto diario. Línea: acumulado desde el inicio del período.
        </p>
      </div>
      {trend.length === 0 ? (
        <ChartEmptyState>
          No hay movimientos hasta la fecha de corte de este período.
        </ChartEmptyState>
      ) : (
        <>
          <DailyChartViewport ariaLabel="Gráfico desplazable de saldo diario y acumulado del período">
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
                  dataKey="date"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatChartDay}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
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
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                <ReferenceLine y={0} stroke="var(--ui-text-faint)" strokeDasharray="4 4" />
                <Bar
                  dataKey="netResult"
                  name="Saldo neto diario"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive={false}
                >
                  {trend.map((point) => (
                    <Cell
                      fill={point.netResult >= 0 ? "var(--ui-success)" : "var(--ui-danger)"}
                      key={point.date}
                    />
                  ))}
                </Bar>
                <Line
                  type="linear"
                  dataKey="cumulativeNetResult"
                  name="Acumulado del período"
                  stroke="var(--ui-chart-2)"
                  strokeWidth={3}
                  dot={{ fill: "var(--ui-chart-2)", r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </DailyChartViewport>
          <figcaption className="sr-only">
            Evolución diaria del saldo neto y su acumulado desde el inicio del período.
          </figcaption>
          <table className="sr-only">
            <caption>Valores diarios de saldo neto y acumulado del período</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Saldo neto diario</th>
                <th scope="col">Acumulado del período</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatChartDate(point.date)}</th>
                  <td>{formatMoney(point.netResult)}</td>
                  <td>{formatMoney(point.cumulativeNetResult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

export function PeriodFinancialTrendChart({ trend }: { trend: DashboardDailyTrendPoint[] }) {
  return (
    <figure className="card min-w-0" aria-labelledby="period-financial-trend-title">
      <div>
        <h4 className="section-title" id="period-financial-trend-title">
          Ingresos frente a egresos por día
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Líneas diarias de ingresos y egresos registrados hasta la fecha de corte.
        </p>
      </div>
      {trend.length === 0 ? (
        <ChartEmptyState>
          No hay movimientos hasta la fecha de corte de este período.
        </ChartEmptyState>
      ) : (
        <>
          <DailyChartViewport ariaLabel="Gráfico desplazable de ingresos y egresos diarios">
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
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "var(--ui-chart-cursor)", strokeWidth: 16 }}
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => formatChartDate(String(label))}
                />
                <Legend wrapperStyle={{ color: "var(--ui-text-secondary)", fontSize: "0.75rem" }} />
                <Line
                  type="linear"
                  dataKey="income"
                  name="Ingresos"
                  stroke="var(--ui-success)"
                  strokeWidth={3}
                  dot={{ fill: "var(--ui-success)", r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="expense"
                  name="Egresos"
                  stroke="var(--ui-danger)"
                  strokeWidth={3}
                  strokeDasharray="7 4"
                  dot={{ fill: "var(--ui-danger)", r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </DailyChartViewport>
          <figcaption className="sr-only">
            Comparación diaria de ingresos y egresos del período seleccionado.
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
                  <td>{formatMoney(point.income)}</td>
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
