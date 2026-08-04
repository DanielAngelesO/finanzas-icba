import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import type {
  DashboardCategorySummary,
  DashboardContributionKind,
  DashboardContributionTrendPoint,
  DashboardExpenseComposition,
  DashboardExpenseInsights,
  DashboardTrendPoint,
} from "../../domain/dashboard";
import type { Transaction } from "../../domain/transaction";
import {
  formatCompactDate,
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

const getChartColor = (index: number): string =>
  chartPalette[index % chartPalette.length] ?? "var(--ui-chart-1)";

const tooltipStyle = {
  border: "1px solid var(--ui-border)",
  borderRadius: "0.75rem",
  background: "var(--ui-surface)",
  color: "var(--ui-text)",
};

const formatChartPeriod = (value: string): string => formatShortPeriod(value).replace(".", "");

const formatCategoryAxis = (value: string): string =>
  value.length > 17 ? value.slice(0, 16) + "…" : value;

function ChartEmptyState({ children }: { children: string }) {
  return <p className="empty-state mt-5">{children}</p>;
}

function CategoryList({
  categories,
  className = "mt-5",
}: {
  categories: DashboardCategorySummary[];
  className?: string;
}) {
  return (
    <ol className={className + " space-y-3"}>
      {categories.map((category, index) => (
        <li className="flex items-start gap-3" key={category.category}>
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: getChartColor(index) }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-sm text-slate-200">{category.category}</span>
          <span className="shrink-0 text-right text-sm tabular-nums text-slate-300">
            {formatMoney(category.amount)}
            <span className="ml-2 text-xs text-slate-500">{formatPercent(category.share)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

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
          Saldo acumulado y resultado mensual
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
              name="Saldo acumulado"
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
        Evolución del saldo neto mensual y del saldo acumulado.
      </figcaption>
      <table className="sr-only">
        <caption>Valores de saldo acumulado y resultado mensual</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Saldo neto mensual</th>
            <th scope="col">Saldo acumulado</th>
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

export function IncomeCategoryChart({ categories }: { categories: DashboardCategorySummary[] }) {
  return (
    <section className="card min-w-0" aria-labelledby="income-categories-title">
      <div>
        <h4 className="section-title" id="income-categories-title">
          Ingresos por categoría
        </h4>
        <p className="mt-1 text-sm text-slate-400">Participación del ingreso del período.</p>
      </div>
      {categories.length === 0 ? (
        <ChartEmptyState>No se registraron ingresos en este período.</ChartEmptyState>
      ) : (
        <>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(18rem,1.15fr)] lg:items-center">
            <div className="h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={categories}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {categories.map((category, index) => (
                      <Cell fill={getChartColor(index)} key={category.category} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 lg:border-l lg:border-slate-700/70 lg:pl-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Distribución del período
              </p>
              <CategoryList categories={categories} className="mt-4" />
            </div>
          </div>
          <table className="sr-only">
            <caption>Ingresos por categoría</caption>
            <thead>
              <tr>
                <th scope="col">Categoría</th>
                <th scope="col">Monto</th>
                <th scope="col">Participación</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.category}>
                  <th scope="row">{category.category}</th>
                  <td>{formatMoney(category.amount)}</td>
                  <td>{formatPercent(category.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
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

export function SalaryExpenseComparison({
  composition,
}: {
  composition: DashboardExpenseComposition;
}) {
  const total = composition.salariesAndFees.amount + composition.otherExpenses.amount;
  const chartData = [
    {
      label: "Egresos",
      salariesAndFees: composition.salariesAndFees.amount,
      otherExpenses: composition.otherExpenses.amount,
    },
  ];

  return (
    <section className="card min-w-0" aria-labelledby="expense-composition-title">
      <div>
        <h4 className="section-title" id="expense-composition-title">
          Salarios frente a otros gastos
        </h4>
        <p className="mt-1 text-sm text-slate-400">Distribución de los egresos del período.</p>
      </div>
      {total === 0 ? (
        <ChartEmptyState>No se registraron egresos en este período.</ChartEmptyState>
      ) : (
        <>
          <div className="mt-6 h-20 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 0 }}
              >
                <XAxis type="number" domain={[0, total]} hide />
                <YAxis type="category" dataKey="label" hide />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Bar
                  dataKey="salariesAndFees"
                  name="Salarios y Honorarios"
                  stackId="expenses"
                  fill="var(--ui-chart-4)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="otherExpenses"
                  name="Demás categorías"
                  stackId="expenses"
                  fill="var(--ui-chart-2)"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <ExpenseGroupSummary
              label="Salarios y Honorarios"
              amount={composition.salariesAndFees.amount}
              transactionCount={composition.salariesAndFees.transactionCount}
              share={composition.salariesAndFees.share}
              colorClass="text-amber-300"
            />
            <ExpenseGroupSummary
              label="Demás categorías"
              amount={composition.otherExpenses.amount}
              transactionCount={composition.otherExpenses.transactionCount}
              share={composition.otherExpenses.share}
              colorClass="text-indigo-300"
            />
          </dl>
          <table className="sr-only">
            <caption>Comparación de salarios y otros gastos</caption>
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Monto</th>
                <th scope="col">Transacciones</th>
                <th scope="col">Participación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Salarios y Honorarios</th>
                <td>{formatMoney(composition.salariesAndFees.amount)}</td>
                <td>{composition.salariesAndFees.transactionCount}</td>
                <td>{formatPercent(composition.salariesAndFees.share)}</td>
              </tr>
              <tr>
                <th scope="row">Demás categorías</th>
                <td>{formatMoney(composition.otherExpenses.amount)}</td>
                <td>{composition.otherExpenses.transactionCount}</td>
                <td>{formatPercent(composition.otherExpenses.share)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function ExpenseGroupSummary({
  label,
  amount,
  transactionCount,
  share,
  colorClass,
}: {
  label: string;
  amount: number;
  transactionCount: number;
  share: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/20 p-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={"mt-2 text-sm font-semibold tabular-nums " + colorClass}>
        {formatMoney(amount)}
      </dd>
      <dd className="mt-1 text-xs text-slate-400">
        {formatPercent(share)} · {transactionCount.toLocaleString("es-PE")} movimientos
      </dd>
    </div>
  );
}

export function ExpenseCategoryChart({
  categories,
  insights,
}: {
  categories: DashboardCategorySummary[];
  insights: DashboardExpenseInsights;
}) {
  return (
    <section className="card min-w-0" aria-labelledby="expense-categories-title">
      <div>
        <h4 className="section-title" id="expense-categories-title">
          Gastos no salariales por categoría
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Salarios y Honorarios se excluye de este análisis ejecutivo.
        </p>
      </div>
      {categories.length === 0 ? (
        <ChartEmptyState>No se registraron gastos fuera de Salarios y Honorarios.</ChartEmptyState>
      ) : (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/20 p-3">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Rubro principal
              </dt>
              <dd className="mt-2 text-sm font-semibold text-slate-100">
                {insights.leadingCategory?.category ?? "Sin datos"}
              </dd>
              <dd className="mt-1 text-xs tabular-nums text-slate-400">
                {insights.leadingCategory ? formatMoney(insights.leadingCategory.amount) : ""}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/20 p-3">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Concentración top 3
              </dt>
              <dd className="mt-2 text-sm font-semibold tabular-nums text-slate-100">
                {insights.topThreeShare === null
                  ? "Sin datos"
                  : formatPercent(insights.topThreeShare)}
              </dd>
              <dd className="mt-1 text-xs text-slate-400">De los gastos no salariales.</dd>
            </div>
          </dl>
          <div className="mt-5 h-72 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={categories}
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
                  dataKey="category"
                  tick={{ fill: "var(--ui-text-secondary)", fontSize: 12 }}
                  tickFormatter={formatCategoryAxis}
                  tickLine={false}
                  axisLine={false}
                  width={108}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Bar
                  dataKey="amount"
                  name="Egresos"
                  fill="var(--ui-chart-2)"
                  radius={[0, 5, 5, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <CategoryList categories={categories} />
          <table className="sr-only">
            <caption>Gastos no salariales por categoría</caption>
            <thead>
              <tr>
                <th scope="col">Categoría</th>
                <th scope="col">Monto</th>
                <th scope="col">Transacciones</th>
                <th scope="col">Participación</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.category}>
                  <th scope="row">{category.category}</th>
                  <td>{formatMoney(category.amount)}</td>
                  <td>{category.transactionCount}</td>
                  <td>{formatPercent(category.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export function RecentTransactionList({
  transactions,
  movementsHref,
}: {
  transactions: Transaction[];
  movementsHref: string;
}) {
  return (
    <section className="card min-w-0" aria-labelledby="recent-transactions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="section-title" id="recent-transactions-title">
            Movimientos recientes
          </h4>
          <p className="mt-1 text-sm text-slate-400">
            Operaciones registradas en el período seleccionado.
          </p>
        </div>
        <Link className="button-secondary text-xs" to={movementsHref}>
          Ver todos
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="empty-state mt-4">No hay movimientos para este período.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {transactions.map((transaction) => (
            <li className="flex items-center gap-3 py-3" key={transaction.id}>
              <span
                className={transaction.type === "INGRESO" ? "type-ingreso" : "type-egreso"}
                aria-label={transaction.type === "INGRESO" ? "Ingreso" : "Egreso"}
              >
                {transaction.type === "INGRESO" ? "↑" : "↓"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">
                  {transaction.description ?? transaction.category}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {formatCompactDate(transaction.date)} · {transaction.category} ·{" "}
                  {transaction.status}
                </p>
              </div>
              <span
                className={
                  "shrink-0 text-sm font-semibold tabular-nums " +
                  (transaction.type === "INGRESO" ? "amount-positive" : "amount-negative")
                }
              >
                {transaction.type === "INGRESO" ? "+" : "−"}
                {formatMoney(transaction.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
