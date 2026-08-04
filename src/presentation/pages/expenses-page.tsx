import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  defaultExpenseAnalysisCriteria,
  expensePageSizes,
  expenseReviewSignals,
  expenseSorts,
  type ExpenseAnalysisCriteria,
  type ExpenseAnalysisFilters,
  type ExpenseDetailCriteria,
  type ExpensePageSize,
  type ExpenseReviewSignal,
  type ExpenseSort,
} from "../../domain/expense-analysis";
import type { Transaction } from "../../domain/transaction";
import type { AppServices } from "../../composition/services";
import {
  ExpenseBreakdownChart,
  ExpenseReviewSignals,
  ExpenseTrendChart,
} from "../components/expense-widgets";
import { TransactionDetailDialog, TransactionResults } from "../components/transaction-table";
import { formatDate, formatMoney, formatPercent, formatPeriod } from "../formatters";

interface CriteriaPatch {
  analysis?: Partial<ExpenseAnalysisFilters>;
  detail?: Partial<ExpenseDetailCriteria>;
}

const sortOptions = [
  { value: "date-desc", label: "Más recientes" },
  { value: "date-asc", label: "Más antiguos" },
  { value: "amount-desc", label: "Mayor monto" },
  { value: "amount-asc", label: "Menor monto" },
] satisfies ReadonlyArray<{ value: ExpenseSort; label: string }>;

const isValidPeriod = (value: string | null): value is string => {
  if (!value || !/^\d{6}$/.test(value)) return false;
  const month = Number(value.slice(4, 6));
  return month >= 1 && month <= 12;
};

const isExpenseReviewSignal = (value: string | null): value is ExpenseReviewSignal =>
  expenseReviewSignals.some((signal) => signal === value);

const readTextParameter = (searchParams: URLSearchParams, name: string): string | null => {
  const value = searchParams.get(name)?.trim();
  return value ? value : null;
};

const readSort = (value: string | null): ExpenseSort =>
  expenseSorts.find((sort) => sort === value) ?? defaultExpenseAnalysisCriteria.detail.sort;

const readPage = (value: string | null): number => {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

const readPageSize = (value: string | null): ExpensePageSize => {
  const size = Number(value);
  return (
    expensePageSizes.find((pageSize) => pageSize === size) ??
    defaultExpenseAnalysisCriteria.detail.pageSize
  );
};

const getCriteria = (searchParams: URLSearchParams): ExpenseAnalysisCriteria => {
  const signalParameter = searchParams.get("signal");
  return {
    analysis: {
      fromPeriod: isValidPeriod(searchParams.get("from")) ? searchParams.get("from") : null,
      toPeriod: isValidPeriod(searchParams.get("to")) ? searchParams.get("to") : null,
      account: readTextParameter(searchParams, "account"),
      category: readTextParameter(searchParams, "category"),
      subcategory: readTextParameter(searchParams, "subcategory"),
      provider: readTextParameter(searchParams, "provider"),
      responsible: readTextParameter(searchParams, "responsible"),
      paymentMethod: readTextParameter(searchParams, "method"),
      status: readTextParameter(searchParams, "status"),
      excludeSalariesAndFees: searchParams.get("salary") === "exclude",
    },
    detail: {
      search: searchParams.get("q")?.trim() ?? "",
      signal: isExpenseReviewSignal(signalParameter) ? signalParameter : null,
      sort: readSort(searchParams.get("sort")),
      page: readPage(searchParams.get("page")),
      pageSize: readPageSize(searchParams.get("pageSize")),
    },
  };
};

const setOptionalParameter = (
  searchParams: URLSearchParams,
  name: string,
  value: string | null,
) => {
  if (value) searchParams.set(name, value);
  else searchParams.delete(name);
};

const shiftPeriod = (period: string, months: number): string => {
  const year = Number(period.slice(0, 4));
  const monthIndex = Number(period.slice(4, 6)) - 1 + months;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return String(date.getUTCFullYear()) + String(date.getUTCMonth() + 1).padStart(2, "0");
};

function ExpenseMetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "stat-card-rose" | "stat-card-emerald" | "stat-card-indigo" | "stat-card-sky";
}) {
  return (
    <article className={`stat-card ${accent}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function ExpensesLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="shimmer h-28 w-full" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div className="shimmer h-32" key={index} />
        ))}
      </div>
      <div className="shimmer h-80 w-full" aria-hidden="true" />
      <span className="sr-only">Cargando análisis de gastos.</span>
    </div>
  );
}

export function ExpensesPage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailTrigger, setDetailTrigger] = useState<HTMLButtonElement | null>(null);
  const criteria = useMemo(() => getCriteria(searchParams), [searchParams]);
  const analysis = useQuery({
    queryKey: ["expense-analysis", criteria],
    queryFn: () => services.expenses.execute(criteria),
    placeholderData: keepPreviousData,
  });

  const updateCriteria = useCallback(
    (patch: CriteriaPatch, replace = true) => {
      const next: ExpenseAnalysisCriteria = {
        analysis: { ...criteria.analysis, ...patch.analysis },
        detail: { ...criteria.detail, ...patch.detail },
      };
      const nextParams = new URLSearchParams(searchParams);
      setOptionalParameter(nextParams, "from", next.analysis.fromPeriod);
      setOptionalParameter(nextParams, "to", next.analysis.toPeriod);
      setOptionalParameter(nextParams, "account", next.analysis.account);
      setOptionalParameter(nextParams, "category", next.analysis.category);
      setOptionalParameter(nextParams, "subcategory", next.analysis.subcategory);
      setOptionalParameter(nextParams, "provider", next.analysis.provider);
      setOptionalParameter(nextParams, "responsible", next.analysis.responsible);
      setOptionalParameter(nextParams, "method", next.analysis.paymentMethod);
      setOptionalParameter(nextParams, "status", next.analysis.status);
      if (next.analysis.excludeSalariesAndFees) nextParams.set("salary", "exclude");
      else nextParams.delete("salary");
      setOptionalParameter(nextParams, "signal", next.detail.signal);
      setOptionalParameter(nextParams, "q", next.detail.search || null);
      if (next.detail.sort === defaultExpenseAnalysisCriteria.detail.sort)
        nextParams.delete("sort");
      else nextParams.set("sort", next.detail.sort);
      if (next.detail.page === 1) nextParams.delete("page");
      else nextParams.set("page", String(next.detail.page));
      if (next.detail.pageSize === defaultExpenseAnalysisCriteria.detail.pageSize) {
        nextParams.delete("pageSize");
      } else {
        nextParams.set("pageSize", String(next.detail.pageSize));
      }
      setSearchParams(nextParams, { replace });
    },
    [criteria, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (analysis.data && analysis.data.pagination.page !== criteria.detail.page) {
      updateCriteria({ detail: { page: analysis.data.pagination.page } });
    }
  }, [analysis.data, criteria.detail.page, updateCriteria]);

  useEffect(() => {
    const range = analysis.data?.range;
    if (
      range &&
      criteria.analysis.fromPeriod &&
      criteria.analysis.toPeriod &&
      criteria.analysis.fromPeriod > criteria.analysis.toPeriod
    ) {
      updateCriteria({
        analysis: { fromPeriod: range.fromPeriod, toPeriod: range.toPeriod },
        detail: { page: 1 },
      });
    }
  }, [
    analysis.data?.range,
    criteria.analysis.fromPeriod,
    criteria.analysis.toPeriod,
    updateCriteria,
  ]);

  const openDetail = useCallback((transaction: Transaction, trigger: HTMLButtonElement) => {
    setDetailTrigger(trigger);
    setSelectedTransaction(transaction);
  }, []);
  const closeDetail = useCallback(() => setSelectedTransaction(null), []);

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasAnalyticFilters = Boolean(
    criteria.analysis.account ||
    criteria.analysis.category ||
    criteria.analysis.subcategory ||
    criteria.analysis.provider ||
    criteria.analysis.responsible ||
    criteria.analysis.paymentMethod ||
    criteria.analysis.status ||
    criteria.analysis.excludeSalariesAndFees,
  );

  if (analysis.isPending) return <ExpensesLoadingState />;

  if (analysis.isError || !analysis.data) {
    return (
      <section className="space-y-4 animate-fade-in-up" role="alert">
        <h2 className="page-title">Análisis de gastos</h2>
        <p className="alert-error">No se pudo cargar el análisis de gastos.</p>
        <button className="button-secondary" type="button" onClick={() => void analysis.refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const { data } = analysis;
  if (!data.range) {
    return (
      <div className="space-y-8 animate-fade-in-up">
        <section>
          <h2 className="page-title">Análisis de gastos</h2>
          <p className="page-subtitle">
            Consulta la composición, trazabilidad y evolución de los egresos.
          </p>
        </section>
        <section className="empty-state">
          <p className="font-medium text-slate-200">Aún no hay períodos financieros disponibles.</p>
          <p className="mt-2">
            Verifica la fuente y la calidad de los datos para comenzar el análisis.
          </p>
          <Link className="button-secondary mt-5" to="/control/calidad">
            Revisar calidad de datos
          </Link>
        </section>
      </div>
    );
  }

  const range = data.range;
  const hasInvertedRange =
    criteria.analysis.fromPeriod !== null &&
    criteria.analysis.toPeriod !== null &&
    criteria.analysis.fromPeriod > criteria.analysis.toPeriod;
  const selectedFrom = hasInvertedRange
    ? range.fromPeriod
    : (criteria.analysis.fromPeriod ?? range.fromPeriod);
  const selectedTo = hasInvertedRange
    ? range.toPeriod
    : (criteria.analysis.toPeriod ?? range.toPeriod);
  const periodOptions = [...new Set([selectedTo, selectedFrom, ...data.availablePeriods])].sort(
    (left, right) => right.localeCompare(left),
  );
  const totalLabel =
    data.summary.transactionCount === 1
      ? "1 movimiento"
      : `${data.summary.transactionCount.toLocaleString("es-PE")} movimientos`;
  const priorDetail =
    data.summary.changeRate === null
      ? "Sin base comparable en el período anterior."
      : `Antes: ${formatMoney(data.summary.previousAmount)}`;
  const salaryValue = criteria.analysis.excludeSalariesAndFees
    ? "Excluidas"
    : formatPercent(data.summary.salariesAndFeesShare);
  const salaryDetail = criteria.analysis.excludeSalariesAndFees
    ? "Activa la opción para reincorporarlas al análisis."
    : formatMoney(data.summary.salariesAndFeesAmount);
  const documentValue =
    data.summary.documentedShare === null
      ? "No disponible"
      : formatPercent(data.summary.documentedShare);
  const documentDetail =
    data.summary.documentedAmount === null
      ? "La fuente no incluye Referencia / Comprobante."
      : `${formatMoney(data.summary.documentedAmount)} con referencia registrada.`;
  const providerValue = data.summary.leadingProvider ?? "Sin información";
  const providerDetail =
    data.summary.leadingProviderShare === null
      ? "No hay proveedores registrados en el rango."
      : `${formatPercent(data.summary.leadingProviderShare)} del gasto total.`;

  const activeFilterChips = [
    criteria.analysis.account
      ? {
          label: `Cuenta: ${criteria.analysis.account}`,
          clear: () => updateCriteria({ analysis: { account: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.category
      ? {
          label: `Categoría: ${criteria.analysis.category}`,
          clear: () => updateCriteria({ analysis: { category: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.subcategory
      ? {
          label: `Subcategoría: ${criteria.analysis.subcategory}`,
          clear: () => updateCriteria({ analysis: { subcategory: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.provider
      ? {
          label: `Proveedor: ${criteria.analysis.provider}`,
          clear: () => updateCriteria({ analysis: { provider: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.responsible
      ? {
          label: `Responsable: ${criteria.analysis.responsible}`,
          clear: () => updateCriteria({ analysis: { responsible: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.paymentMethod
      ? {
          label: `Método: ${criteria.analysis.paymentMethod}`,
          clear: () => updateCriteria({ analysis: { paymentMethod: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.status
      ? {
          label: `Estado: ${criteria.analysis.status}`,
          clear: () => updateCriteria({ analysis: { status: null }, detail: { page: 1 } }),
        }
      : null,
    criteria.analysis.excludeSalariesAndFees
      ? {
          label: "Sin Salarios y Honorarios",
          clear: () =>
            updateCriteria({ analysis: { excludeSalariesAndFees: false }, detail: { page: 1 } }),
        }
      : null,
  ].filter((chip): chip is { label: string; clear: () => void } => chip !== null);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <header className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
              Uso de fondos
            </p>
            <h2 className="page-title mt-1">Análisis de gastos</h2>
            <p className="page-subtitle">
              Composición, evolución y trazabilidad de los egresos registrados.
            </p>
          </div>
          <dl className="min-w-40 text-sm text-slate-400 sm:text-right">
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Fecha de corte
            </dt>
            <dd className="mt-1 font-medium text-slate-200">
              {data.dataCutoff ? formatDate(data.dataCutoff) : "Sin egresos en el rango"}
            </dd>
          </dl>
        </div>

        <section className="card" aria-labelledby="expense-filters-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="section-title" id="expense-filters-title">
                Período y filtros
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {formatPeriod(range.fromPeriod)} a {formatPeriod(range.toPeriod)} · comparación:{" "}
                {formatPeriod(range.comparisonFromPeriod)} a{" "}
                {formatPeriod(range.comparisonToPeriod)}.
              </p>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-300">
              <input
                className="h-4 w-4 accent-emerald-400"
                type="checkbox"
                checked={criteria.analysis.excludeSalariesAndFees}
                onChange={(event) =>
                  updateCriteria({
                    analysis: { excludeSalariesAndFees: event.target.checked },
                    detail: { page: 1 },
                  })
                }
              />
              Excluir Salarios y Honorarios
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Rangos rápidos">
            {[3, 6, 12].map((months) => (
              <button
                className="button-secondary text-xs"
                type="button"
                key={months}
                onClick={() =>
                  updateCriteria({
                    analysis: {
                      fromPeriod: shiftPeriod(selectedTo, 1 - months),
                      toPeriod: selectedTo,
                    },
                    detail: { page: 1 },
                  })
                }
              >
                Últimos {months} meses
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="field-label">
              Desde
              <select
                className="field"
                value={selectedFrom}
                onChange={(event) =>
                  updateCriteria({
                    analysis: { fromPeriod: event.target.value || null },
                    detail: { page: 1 },
                  })
                }
              >
                {periodOptions.map((period) => (
                  <option key={period} value={period}>
                    {formatPeriod(period)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Hasta
              <select
                className="field"
                value={selectedTo}
                onChange={(event) =>
                  updateCriteria({
                    analysis: { toPeriod: event.target.value || null },
                    detail: { page: 1 },
                  })
                }
              >
                {periodOptions.map((period) => (
                  <option key={period} value={period}>
                    {formatPeriod(period)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Cuenta
              <select
                className="field"
                value={criteria.analysis.account ?? ""}
                onChange={(event) =>
                  updateCriteria({
                    analysis: { account: event.target.value || null },
                    detail: { page: 1 },
                  })
                }
              >
                <option value="">Todas las cuentas</option>
                {data.facets.accounts.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Categoría
              <select
                className="field"
                value={criteria.analysis.category ?? ""}
                onChange={(event) =>
                  updateCriteria({
                    analysis: { category: event.target.value || null },
                    detail: { page: 1 },
                  })
                }
              >
                <option value="">Todas las categorías</option>
                {data.facets.categories.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <details
            className="transaction-advanced-filters mt-5"
            open={hasAnalyticFilters || undefined}
          >
            <summary>Más filtros</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="field-label">
                Subcategoría
                <select
                  className="field"
                  disabled={!data.capabilities.hasSubcategory}
                  value={criteria.analysis.subcategory ?? ""}
                  onChange={(event) =>
                    updateCriteria({
                      analysis: { subcategory: event.target.value || null },
                      detail: { page: 1 },
                    })
                  }
                >
                  <option value="">
                    {data.capabilities.hasSubcategory
                      ? "Todas las subcategorías"
                      : "Campo no disponible"}
                  </option>
                  {data.facets.subcategories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Proveedor
                <select
                  className="field"
                  disabled={!data.capabilities.hasProvider}
                  value={criteria.analysis.provider ?? ""}
                  onChange={(event) =>
                    updateCriteria({
                      analysis: { provider: event.target.value || null },
                      detail: { page: 1 },
                    })
                  }
                >
                  <option value="">
                    {data.capabilities.hasProvider
                      ? "Todos los proveedores"
                      : "Campo no disponible"}
                  </option>
                  {data.facets.providers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Responsable
                <select
                  className="field"
                  value={criteria.analysis.responsible ?? ""}
                  onChange={(event) =>
                    updateCriteria({
                      analysis: { responsible: event.target.value || null },
                      detail: { page: 1 },
                    })
                  }
                >
                  <option value="">Todos los responsables</option>
                  {data.facets.responsibles.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Método de pago
                <select
                  className="field"
                  value={criteria.analysis.paymentMethod ?? ""}
                  onChange={(event) =>
                    updateCriteria({
                      analysis: { paymentMethod: event.target.value || null },
                      detail: { page: 1 },
                    })
                  }
                >
                  <option value="">Todos los métodos</option>
                  {data.facets.paymentMethods.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Estado
                <select
                  className="field"
                  value={criteria.analysis.status ?? ""}
                  onChange={(event) =>
                    updateCriteria({
                      analysis: { status: event.target.value || null },
                      detail: { page: 1 },
                    })
                  }
                >
                  <option value="">Todos los estados</option>
                  {data.facets.statuses.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          {activeFilterChips.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
              {activeFilterChips.map((chip) => (
                <button
                  className="transaction-filter-chip"
                  type="button"
                  key={chip.label}
                  onClick={chip.clear}
                >
                  {chip.label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                type="button"
                onClick={clearAllFilters}
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </section>
      </header>

      {data.dataQuality.invalidTransactionCount > 0 ? (
        <section className="alert-warning" role="status">
          Hay {data.dataQuality.invalidTransactionCount}{" "}
          {data.dataQuality.invalidTransactionCount === 1 ? "fila inválida" : "filas inválidas"} que
          no se incluyen en el análisis.{" "}
          <Link className="font-semibold underline underline-offset-2" to="/control/calidad">
            Revisar calidad de datos
          </Link>
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="expense-metrics-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
            Vista ejecutiva
          </p>
          <h3 className="section-title mt-1" id="expense-metrics-title">
            Indicadores de gasto
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ExpenseMetricCard
            label="Gasto total"
            value={formatMoney(data.summary.totalAmount)}
            detail={totalLabel}
            accent="stat-card-rose"
          />
          <ExpenseMetricCard
            label="Variación histórica"
            value={
              data.summary.changeRate === null ? "Sin base" : formatPercent(data.summary.changeRate)
            }
            detail={priorDetail}
            accent="stat-card-indigo"
          />
          <ExpenseMetricCard
            label="Promedio mensual"
            value={formatMoney(data.summary.averageMonthlyAmount)}
            detail={`Promedio de ${range.periods.length.toLocaleString("es-PE")} meses, incluso sin movimientos.`}
            accent="stat-card-sky"
          />
          <ExpenseMetricCard
            label="Salarios y Honorarios"
            value={salaryValue}
            detail={salaryDetail}
            accent="stat-card-rose"
          />
          <ExpenseMetricCard
            label="Cobertura documental"
            value={documentValue}
            detail={documentDetail}
            accent="stat-card-emerald"
          />
          <ExpenseMetricCard
            label="Proveedor principal"
            value={providerValue}
            detail={providerDetail}
            accent="stat-card-indigo"
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="expense-evolution-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
            Evolución
          </p>
          <h3 className="section-title mt-1" id="expense-evolution-title">
            Comportamiento del gasto
          </h3>
        </div>
        <ExpenseTrendChart trend={data.trend} />
      </section>

      <section className="space-y-4" aria-labelledby="expense-composition-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
            Clasificación registrada
          </p>
          <h3 className="section-title mt-1" id="expense-composition-title">
            Composición y concentración
          </h3>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <ExpenseBreakdownChart
            title="Gasto por categoría"
            description="Rubros de egreso ordenados por monto dentro del rango."
            caption="Gasto por categoría"
            items={data.categories}
            unavailable={false}
            emptyMessage="No hay categorías de gasto para mostrar."
            onSelect={(value) =>
              updateCriteria({ analysis: { category: value }, detail: { page: 1 } })
            }
          />
          <ExpenseBreakdownChart
            title="Gasto por subcategoría"
            description="Mayor detalle de los rubros tal como están registrados en la fuente."
            caption="Gasto por subcategoría"
            items={data.subcategories}
            unavailable={!data.capabilities.hasSubcategory}
            emptyMessage="No hay subcategorías de gasto para mostrar."
            onSelect={(value) =>
              updateCriteria({ analysis: { subcategory: value }, detail: { page: 1 } })
            }
          />
          <ExpenseBreakdownChart
            title="Concentración de proveedores"
            description="Proveedores con mayor participación del gasto total."
            caption="Concentración de proveedores"
            items={data.providers}
            unavailable={!data.capabilities.hasProvider}
            emptyMessage="No hay proveedores registrados para mostrar."
            onSelect={(value) =>
              updateCriteria({ analysis: { provider: value }, detail: { page: 1 } })
            }
          />
          <ExpenseBreakdownChart
            title="Métodos de pago"
            description="Monto y número de operaciones por medio de pago registrado."
            caption="Métodos de pago"
            items={data.paymentMethods}
            unavailable={false}
            emptyMessage="No hay métodos de pago para mostrar."
            onSelect={(value) =>
              updateCriteria({ analysis: { paymentMethod: value }, detail: { page: 1 } })
            }
          />
        </div>
      </section>

      <ExpenseReviewSignals
        signals={data.signals}
        selectedSignal={criteria.detail.signal}
        onSelect={(signal) => updateCriteria({ detail: { signal, page: 1 } })}
      />

      <section aria-labelledby="expense-detail-title">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
              Detalle operativo
            </p>
            <h3 className="section-title mt-1" id="expense-detail-title">
              Movimientos de gasto
            </h3>
            <p className="mt-1 text-sm text-slate-400" role="status" aria-live="polite">
              {data.pagination.total === 1
                ? "1 gasto encontrado"
                : `${data.pagination.total.toLocaleString("es-PE")} gastos encontrados`}
              {criteria.detail.signal ? " para la señal seleccionada." : "."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:flex xl:items-end">
            <label className="field-label sm:col-span-1 xl:w-64">
              Buscar gastos
              <input
                className="field"
                value={criteria.detail.search}
                onChange={(event) =>
                  updateCriteria({ detail: { search: event.target.value, page: 1 } })
                }
                placeholder="Descripción, proveedor o comprobante"
              />
            </label>
            <label className="field-label">
              Ordenar por
              <select
                className="field"
                value={criteria.detail.sort}
                onChange={(event) =>
                  updateCriteria({ detail: { sort: readSort(event.target.value), page: 1 } })
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Por página
              <select
                className="field"
                value={criteria.detail.pageSize}
                onChange={(event) =>
                  updateCriteria({
                    detail: { pageSize: readPageSize(event.target.value), page: 1 },
                  })
                }
              >
                {expensePageSizes.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {data.summary.transactionCount === 0 ? (
          <div className="empty-state">
            <p className="font-medium text-slate-200">No hay egresos con estos filtros.</p>
            <p className="mt-2">Amplía el rango o limpia los filtros para recuperar el contexto.</p>
            <button className="button-secondary mt-5" type="button" onClick={clearAllFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : data.pagination.total === 0 ? (
          <div className="empty-state">
            <p className="font-medium text-slate-200">
              No hay gastos en el detalle con esa búsqueda o señal.
            </p>
            <p className="mt-2">
              Los indicadores se conservan para que no pierdas el contexto analítico.
            </p>
            <button
              className="button-secondary mt-5"
              type="button"
              onClick={() => updateCriteria({ detail: { search: "", signal: null, page: 1 } })}
            >
              Limpiar búsqueda y señal
            </button>
          </div>
        ) : (
          <>
            <TransactionResults transactions={data.transactions} onViewDetails={openDetail} />
            <nav className="transaction-pagination" aria-label="Paginación de gastos">
              <p className="text-sm text-slate-400">
                Mostrando {data.pagination.firstResult.toLocaleString("es-PE")}–
                {data.pagination.lastResult.toLocaleString("es-PE")} de{" "}
                {data.pagination.total.toLocaleString("es-PE")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="button-secondary transaction-pagination-button"
                  type="button"
                  disabled={data.pagination.page === 1}
                  onClick={() =>
                    updateCriteria({ detail: { page: data.pagination.page - 1 } }, false)
                  }
                >
                  Anterior
                </button>
                <span className="px-1 text-sm text-slate-300" aria-current="page">
                  Página {data.pagination.page} de {data.pagination.totalPages}
                </span>
                <button
                  className="button-secondary transaction-pagination-button"
                  type="button"
                  disabled={data.pagination.page === data.pagination.totalPages}
                  onClick={() =>
                    updateCriteria({ detail: { page: data.pagination.page + 1 } }, false)
                  }
                >
                  Siguiente
                </button>
              </div>
            </nav>
          </>
        )}
      </section>

      <TransactionDetailDialog
        transaction={selectedTransaction}
        returnFocusTo={detailTrigger}
        onClose={closeDetail}
      />
    </div>
  );
}
