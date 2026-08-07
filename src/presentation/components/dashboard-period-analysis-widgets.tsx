import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardCategorySummary,
  DashboardExpenseComposition,
  DashboardExpenseInsights,
} from "../../domain/dashboard";
import { formatCompactMoney, formatMoney, formatPercent } from "../formatters";
import { CategoryList, ChartEmptyState } from "./dashboard-chart-support";
import { formatCategoryAxis, getChartColor, tooltipStyle } from "./dashboard-chart-utils";

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
