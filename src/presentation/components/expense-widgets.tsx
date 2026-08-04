import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ExpenseBreakdownItem,
  ExpenseReviewSignal,
  ExpenseReviewSignalSummary,
  ExpenseTrendPoint,
} from "../../domain/expense-analysis";
import { expenseReviewSignals } from "../../domain/expense-analysis";
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatPeriod,
  formatShortPeriod,
} from "../formatters";

const chartPalette = [
  "var(--ui-chart-1)",
  "var(--ui-chart-2)",
  "var(--ui-chart-3)",
  "var(--ui-chart-4)",
  "var(--ui-chart-5)",
  "var(--ui-chart-6)",
];

const tooltipStyle = {
  border: "1px solid var(--ui-border)",
  borderRadius: "0.75rem",
  background: "var(--ui-surface)",
  color: "var(--ui-text)",
};

const formatChartPeriod = (value: string): string => formatShortPeriod(value).replace(".", "");

const formatAxisLabel = (value: string): string =>
  value.length > 20 ? value.slice(0, 19) + "…" : value;

function ChartEmptyState({ children }: { children: string }) {
  return <p className="empty-state mt-5">{children}</p>;
}

export function ExpenseTrendChart({ trend }: { trend: ExpenseTrendPoint[] }) {
  const hasExpenses = trend.some((point) => point.amount > 0 || point.comparisonAmount > 0);

  return (
    <figure className="card min-w-0" aria-labelledby="expense-trend-title">
      <div>
        <h3 className="section-title" id="expense-trend-title">
          Evolución mensual del gasto
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Remuneraciones y otros gastos del rango, comparados con el período anterior equivalente.
        </p>
      </div>
      {!hasExpenses ? (
        <ChartEmptyState>No hay egresos para mostrar en el rango seleccionado.</ChartEmptyState>
      ) : (
        <>
          <div className="mt-5 h-72 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  width={72}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--ui-chart-cursor)" }}
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => formatPeriod(String(label))}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--ui-text-secondary)" }} />
                <Bar
                  dataKey="salariesAndFeesAmount"
                  name="Salarios y Honorarios"
                  stackId="expenses"
                  fill="var(--ui-chart-4)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="otherExpensesAmount"
                  name="Otros gastos"
                  stackId="expenses"
                  fill="var(--ui-chart-2)"
                  isAnimationActive={false}
                />
                <Line
                  dataKey="comparisonAmount"
                  name="Período anterior equivalente"
                  stroke="var(--ui-chart-1)"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Evolución mensual del gasto</caption>
            <thead>
              <tr>
                <th scope="col">Período</th>
                <th scope="col">Salarios y Honorarios</th>
                <th scope="col">Otros gastos</th>
                <th scope="col">Gasto total</th>
                <th scope="col">Período anterior equivalente</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{formatPeriod(point.period)}</th>
                  <td>{formatMoney(point.salariesAndFeesAmount)}</td>
                  <td>{formatMoney(point.otherExpensesAmount)}</td>
                  <td>{formatMoney(point.amount)}</td>
                  <td>
                    {formatPeriod(point.comparisonPeriod)}: {formatMoney(point.comparisonAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

export function ExpenseBreakdownChart({
  title,
  description,
  caption,
  items,
  unavailable,
  emptyMessage,
  onSelect,
}: {
  title: string;
  description: string;
  caption: string;
  items: ExpenseBreakdownItem[];
  unavailable: boolean;
  emptyMessage: string;
  onSelect: (value: string) => void;
}) {
  const titleId = "expense-" + caption.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const chartData = items.map((item) => ({ ...item, chartLabel: formatAxisLabel(item.label) }));

  return (
    <figure className="card min-w-0" aria-labelledby={titleId}>
      <div>
        <h3 className="section-title" id={titleId}>
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {unavailable ? (
        <ChartEmptyState>Campo no disponible en la fuente de datos.</ChartEmptyState>
      ) : items.length === 0 ? (
        <ChartEmptyState>{emptyMessage}</ChartEmptyState>
      ) : (
        <>
          <div className="mt-5 h-72 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--ui-chart-grid)"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--ui-chart-text)", fontSize: 12 }}
                  tickFormatter={formatCompactMoney}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="chartLabel"
                  tick={{ fill: "var(--ui-text-secondary)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={112}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Bar dataKey="amount" name="Monto" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  {chartData.map((item, index) => (
                    <Cell
                      fill={chartPalette[index % chartPalette.length] ?? "var(--ui-chart-1)"}
                      key={`${item.kind}-${item.label}`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol
            className="mt-5 space-y-2.5"
            aria-label={`Opciones de ${title.toLocaleLowerCase("es-PE")}`}
          >
            {items.map((item, index) => {
              const content = (
                <>
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        chartPalette[index % chartPalette.length] ?? "var(--ui-chart-1)",
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 text-left text-sm text-slate-200">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-slate-300">
                    {formatMoney(item.amount)}
                    <span className="ml-2 text-xs text-slate-500">{formatPercent(item.share)}</span>
                  </span>
                </>
              );
              return (
                <li key={`${item.kind}-${item.label}`}>
                  {item.kind === "value" && item.value ? (
                    <button
                      className="expense-breakdown-action"
                      type="button"
                      onClick={() => onSelect(item.value ?? "")}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-1.5 py-1">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <table className="sr-only">
            <caption>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Clasificación</th>
                <th scope="col">Monto</th>
                <th scope="col">Movimientos</th>
                <th scope="col">Participación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.label}`}>
                  <th scope="row">{item.label}</th>
                  <td>{formatMoney(item.amount)}</td>
                  <td>{item.transactionCount.toLocaleString("es-PE")}</td>
                  <td>{formatPercent(item.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

const signalDetails: Record<ExpenseReviewSignal, { title: string; description: string }> = {
  "missing-reference": {
    title: "Sin comprobante registrado",
    description: "Registros sin referencia o comprobante. Revisa el sustento documental.",
  },
  "cash-payment": {
    title: "Pagos en efectivo",
    description: "Operaciones marcadas como Efectivo o Cash para una revisión adicional.",
  },
  "duplicate-reference": {
    title: "Referencias repetidas",
    description: "Referencias que aparecen en más de un egreso del rango analizado.",
  },
};

export function ExpenseReviewSignals({
  signals,
  selectedSignal,
  onSelect,
}: {
  signals: Record<ExpenseReviewSignal, ExpenseReviewSignalSummary>;
  selectedSignal: ExpenseReviewSignal | null;
  onSelect: (signal: ExpenseReviewSignal | null) => void;
}) {
  return (
    <section className="card" aria-labelledby="expense-review-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title" id="expense-review-title">
            Señales para revisar
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Son criterios de revisión, no una conclusión de incumplimiento o fraude.
          </p>
        </div>
        {selectedSignal ? (
          <button className="button-secondary text-xs" type="button" onClick={() => onSelect(null)}>
            Ver todos los gastos
          </button>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {expenseReviewSignals.map((signal) => {
          const summary = signals[signal];
          const details = signalDetails[signal];
          const selected = selectedSignal === signal;
          return (
            <article className="expense-signal" data-selected={selected || undefined} key={signal}>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                {details.title}
              </p>
              {!summary.available ? (
                <p className="mt-3 text-sm font-medium text-slate-300">Campo no disponible</p>
              ) : (
                <>
                  <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">
                    {summary.transactionCount.toLocaleString("es-PE")}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-slate-400">
                    {formatMoney(summary.amount)}
                    {summary.groupCount > 0
                      ? ` · ${summary.groupCount.toLocaleString("es-PE")} grupos`
                      : ""}
                  </p>
                </>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">{details.description}</p>
              <button
                className="mt-4 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!summary.available}
                onClick={() => onSelect(selected ? null : signal)}
              >
                {selected ? "Quitar filtro" : "Revisar movimientos"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
