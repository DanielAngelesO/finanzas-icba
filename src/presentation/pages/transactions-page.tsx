import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  defaultTransactionExplorerCriteria,
  exploreTransactions,
  transactionPageSizes,
  transactionSorts,
  type TransactionExplorerCriteria,
  type TransactionPageSize,
  type TransactionSort,
} from "../../application/use-cases/explore-transactions";
import type { AppServices } from "../../composition/services";
import type { Transaction, TransactionType } from "../../domain/transaction";
import { TransactionDetailDialog, TransactionResults } from "../components/transaction-table";
import { formatPeriod } from "../formatters";

type UrlCriteria = Omit<TransactionExplorerCriteria, "search">;

interface AdvancedFilterDraft {
  dateFrom: string;
  dateTo: string;
  account: string;
  category: string;
  status: string;
}

const sortOptions = [
  { value: "date-desc", label: "Más recientes" },
  { value: "date-asc", label: "Más antiguos" },
  { value: "amount-desc", label: "Mayor monto" },
  { value: "amount-asc", label: "Menor monto" },
] satisfies ReadonlyArray<{ value: TransactionSort; label: string }>;

const isTransactionType = (value: string | null): value is TransactionType =>
  value === "INGRESO" || value === "EGRESO" || value === "TRANSFERENCIA";

const getTransactionTypeLabel = (type: TransactionType): string => {
  if (type === "INGRESO") return "Ingreso";
  if (type === "EGRESO") return "Egreso";
  return "Transferencia";
};

const isValidPeriod = (value: string | null): value is string => {
  if (!value || !/^\d{6}$/.test(value)) return false;
  const month = Number(value.slice(4, 6));
  return month >= 1 && month <= 12;
};

const isValidDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  if (!yearText || !monthText || !dayText) return false;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const readTextParameter = (searchParams: URLSearchParams, name: string): string | null => {
  const value = searchParams.get(name)?.trim();
  return value ? value : null;
};

const readPage = (value: string | null): number => {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

const readPageSize = (value: string | null): TransactionPageSize => {
  const pageSize = Number(value);
  return transactionPageSizes.find((size) => size === pageSize) ?? 20;
};

const readSort = (value: string | null): TransactionSort =>
  transactionSorts.find((sort) => sort === value) ?? "date-desc";

const getUrlCriteria = (searchParams: URLSearchParams): UrlCriteria => {
  const periodParameter = searchParams.get("period");
  const typeParameter = searchParams.get("type");
  const fromParameter = searchParams.get("from");
  const toParameter = searchParams.get("to");
  return {
    period: isValidPeriod(periodParameter) ? periodParameter : null,
    type: isTransactionType(typeParameter) ? typeParameter : null,
    dateFrom: isValidDate(fromParameter) ? fromParameter : null,
    dateTo: isValidDate(toParameter) ? toParameter : null,
    account: readTextParameter(searchParams, "account"),
    category: readTextParameter(searchParams, "category"),
    status: readTextParameter(searchParams, "status"),
    sort: readSort(searchParams.get("sort")),
    page: readPage(searchParams.get("page")),
    pageSize: readPageSize(searchParams.get("pageSize")),
  };
};

const getAdvancedDraft = (criteria: UrlCriteria): AdvancedFilterDraft => ({
  dateFrom: criteria.dateFrom ?? "",
  dateTo: criteria.dateTo ?? "",
  account: criteria.account ?? "",
  category: criteria.category ?? "",
  status: criteria.status ?? "",
});

const setOptionalParameter = (
  searchParams: URLSearchParams,
  name: string,
  value: string | null,
) => {
  if (value) searchParams.set(name, value);
  else searchParams.delete(name);
};

const hasFilters = (criteria: TransactionExplorerCriteria): boolean =>
  Boolean(
    criteria.search ||
    criteria.period ||
    criteria.type ||
    criteria.dateFrom ||
    criteria.dateTo ||
    criteria.account ||
    criteria.category ||
    criteria.status,
  );

function TransactionLoadingState() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="shimmer h-36 w-full" aria-hidden="true" />
      <div className="shimmer h-12 w-full" aria-hidden="true" />
      <div className="shimmer h-28 w-full" aria-hidden="true" />
      <div className="shimmer h-28 w-full" aria-hidden="true" />
      <span className="sr-only">Cargando movimientos.</span>
    </section>
  );
}

export function TransactionsPage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedFilterDraft>(() =>
    getAdvancedDraft(getUrlCriteria(searchParams)),
  );
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    const initialCriteria = getUrlCriteria(searchParams);
    return Boolean(
      initialCriteria.dateFrom ||
      initialCriteria.dateTo ||
      initialCriteria.account ||
      initialCriteria.category ||
      initialCriteria.status,
    );
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailTrigger, setDetailTrigger] = useState<HTMLButtonElement | null>(null);

  const urlCriteria = useMemo(() => getUrlCriteria(searchParams), [searchParams]);
  const criteria = useMemo<TransactionExplorerCriteria>(
    () => ({ ...urlCriteria, search: search.trim() }),
    [search, urlCriteria],
  );
  const transactionsQuery = useQuery({
    queryKey: ["transactions", "explorer"],
    queryFn: () => services.transactions.findAll(),
  });
  const explorerResult = useMemo(
    () => (transactionsQuery.data ? exploreTransactions(transactionsQuery.data, criteria) : null),
    [criteria, transactionsQuery.data],
  );

  const updateUrlCriteria = useCallback(
    (patch: Partial<UrlCriteria>, replace = true) => {
      const nextCriteria: UrlCriteria = { ...urlCriteria, ...patch };
      const nextParams = new URLSearchParams(searchParams);
      setOptionalParameter(nextParams, "period", nextCriteria.period);
      setOptionalParameter(nextParams, "type", nextCriteria.type);
      setOptionalParameter(nextParams, "from", nextCriteria.dateFrom);
      setOptionalParameter(nextParams, "to", nextCriteria.dateTo);
      setOptionalParameter(nextParams, "account", nextCriteria.account);
      setOptionalParameter(nextParams, "category", nextCriteria.category);
      setOptionalParameter(nextParams, "status", nextCriteria.status);
      if (nextCriteria.sort === defaultTransactionExplorerCriteria.sort) nextParams.delete("sort");
      else nextParams.set("sort", nextCriteria.sort);
      if (nextCriteria.page === 1) nextParams.delete("page");
      else nextParams.set("page", String(nextCriteria.page));
      if (nextCriteria.pageSize === defaultTransactionExplorerCriteria.pageSize) {
        nextParams.delete("pageSize");
      } else {
        nextParams.set("pageSize", String(nextCriteria.pageSize));
      }
      setSearchParams(nextParams, { replace });
    },
    [searchParams, setSearchParams, urlCriteria],
  );

  useEffect(() => {
    if (explorerResult && explorerResult.page !== criteria.page) {
      updateUrlCriteria({ page: explorerResult.page });
    }
  }, [criteria.page, explorerResult, updateUrlCriteria]);

  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch);
    if (urlCriteria.page !== 1) updateUrlCriteria({ page: 1 });
  };

  const applyAdvancedFilters = () => {
    if (
      advancedDraft.dateFrom &&
      advancedDraft.dateTo &&
      advancedDraft.dateFrom > advancedDraft.dateTo
    ) {
      setAdvancedError("La fecha inicial debe ser anterior o igual a la fecha final.");
      return;
    }
    setAdvancedError(null);
    updateUrlCriteria({
      dateFrom: advancedDraft.dateFrom || null,
      dateTo: advancedDraft.dateTo || null,
      account: advancedDraft.account || null,
      category: advancedDraft.category || null,
      status: advancedDraft.status || null,
      page: 1,
    });
  };

  const clearAdvancedFilters = () => {
    setAdvancedError(null);
    setAdvancedDraft({ dateFrom: "", dateTo: "", account: "", category: "", status: "" });
    updateUrlCriteria({
      dateFrom: null,
      dateTo: null,
      account: null,
      category: null,
      status: null,
      page: 1,
    });
  };

  const clearAllFilters = () => {
    setSearch("");
    setAdvancedError(null);
    setAdvancedDraft({ dateFrom: "", dateTo: "", account: "", category: "", status: "" });
    updateUrlCriteria({
      period: null,
      type: null,
      dateFrom: null,
      dateTo: null,
      account: null,
      category: null,
      status: null,
      page: 1,
    });
  };

  const openDetail = useCallback((transaction: Transaction, trigger: HTMLButtonElement) => {
    setDetailTrigger(trigger);
    setSelectedTransaction(transaction);
  }, []);
  const closeDetail = useCallback(() => setSelectedTransaction(null), []);

  const advancedFilterCount = [
    criteria.dateFrom,
    criteria.dateTo,
    criteria.account,
    criteria.category,
    criteria.status,
  ].filter(Boolean).length;
  const periods = useMemo(() => {
    if (!explorerResult) return [];
    return criteria.period && !explorerResult.facets.periods.includes(criteria.period)
      ? [criteria.period, ...explorerResult.facets.periods]
      : explorerResult.facets.periods;
  }, [criteria.period, explorerResult]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section>
        <h2 className="page-title">Movimientos</h2>
        <p className="page-subtitle">
          Busca, filtra y revisa las operaciones registradas sin perder el contexto.
        </p>
      </section>

      {transactionsQuery.isPending ? <TransactionLoadingState /> : null}

      {transactionsQuery.isError ? (
        <section className="card space-y-4" aria-labelledby="transactions-error-title" role="alert">
          <div>
            <h3 className="section-title" id="transactions-error-title">
              No se pudieron cargar los movimientos
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Comprueba la conexión con la fuente de datos e inténtalo nuevamente.
            </p>
          </div>
          <button
            className="button-primary"
            type="button"
            onClick={() => void transactionsQuery.refetch()}
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {explorerResult ? (
        <>
          <section
            className="card transaction-filter-panel"
            aria-labelledby="transaction-filters-title"
          >
            <div>
              <h3 className="section-title" id="transaction-filters-title">
                Encuentra un movimiento
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Combina la búsqueda con filtros para acotar los resultados.
              </p>
            </div>

            <form
              className="mt-5 space-y-5"
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem_10rem]">
                <label className="field-label">
                  Buscar movimientos
                  <input
                    className="field"
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="ID, descripción, cuenta, responsable o comprobante"
                  />
                </label>
                <label className="field-label">
                  Período
                  <select
                    className="field"
                    value={criteria.period ?? ""}
                    onChange={(event) =>
                      updateUrlCriteria({ period: event.target.value || null, page: 1 })
                    }
                  >
                    <option value="">Todos los períodos</option>
                    {periods.map((period) => (
                      <option key={period} value={period}>
                        {formatPeriod(period)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Tipo
                  <select
                    className="field"
                    value={criteria.type ?? ""}
                    onChange={(event) =>
                      updateUrlCriteria({
                        type: isTransactionType(event.target.value) ? event.target.value : null,
                        page: 1,
                      })
                    }
                  >
                    <option value="">Todos los tipos</option>
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </label>
              </div>

              <details
                className="transaction-advanced-filters"
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary>
                  Más filtros{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
                </summary>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <label className="field-label">
                    Desde
                    <input
                      className="field"
                      type="date"
                      value={advancedDraft.dateFrom}
                      onChange={(event) => {
                        setAdvancedError(null);
                        setAdvancedDraft((draft) => ({ ...draft, dateFrom: event.target.value }));
                      }}
                      aria-invalid={advancedError ? true : undefined}
                      aria-describedby={advancedError ? "transaction-date-error" : undefined}
                    />
                  </label>
                  <label className="field-label">
                    Hasta
                    <input
                      className="field"
                      type="date"
                      value={advancedDraft.dateTo}
                      onChange={(event) => {
                        setAdvancedError(null);
                        setAdvancedDraft((draft) => ({ ...draft, dateTo: event.target.value }));
                      }}
                      aria-invalid={advancedError ? true : undefined}
                      aria-describedby={advancedError ? "transaction-date-error" : undefined}
                    />
                  </label>
                  <label className="field-label">
                    Cuenta
                    <select
                      className="field"
                      value={advancedDraft.account}
                      onChange={(event) =>
                        setAdvancedDraft((draft) => ({ ...draft, account: event.target.value }))
                      }
                    >
                      <option value="">Todas</option>
                      {explorerResult.facets.accounts.map((account) => (
                        <option key={account} value={account}>
                          {account}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Categoría
                    <select
                      className="field"
                      value={advancedDraft.category}
                      onChange={(event) =>
                        setAdvancedDraft((draft) => ({ ...draft, category: event.target.value }))
                      }
                    >
                      <option value="">Todas</option>
                      {explorerResult.facets.categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Estado
                    <select
                      className="field"
                      value={advancedDraft.status}
                      onChange={(event) =>
                        setAdvancedDraft((draft) => ({ ...draft, status: event.target.value }))
                      }
                    >
                      <option value="">Todos</option>
                      {explorerResult.facets.statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {advancedError ? (
                  <p className="transaction-filter-error" id="transaction-date-error" role="alert">
                    {advancedError}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="button-primary" type="button" onClick={applyAdvancedFilters}>
                    Aplicar filtros
                  </button>
                  <button className="button-secondary" type="button" onClick={clearAdvancedFilters}>
                    Limpiar avanzados
                  </button>
                </div>
              </details>
            </form>

            {hasFilters(criteria) ? (
              <div
                className="mt-5 flex flex-wrap items-center gap-2"
                aria-label="Filtros aplicados"
              >
                <span className="text-xs font-medium text-slate-500">Filtros activos:</span>
                {criteria.period ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => updateUrlCriteria({ period: null, page: 1 })}
                  >
                    Período: {formatPeriod(criteria.period)} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.type ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => updateUrlCriteria({ type: null, page: 1 })}
                  >
                    Tipo: {getTransactionTypeLabel(criteria.type)} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.dateFrom ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => {
                      setAdvancedDraft((draft) => ({ ...draft, dateFrom: "" }));
                      updateUrlCriteria({ dateFrom: null, page: 1 });
                    }}
                  >
                    Desde: {criteria.dateFrom} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.dateTo ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => {
                      setAdvancedDraft((draft) => ({ ...draft, dateTo: "" }));
                      updateUrlCriteria({ dateTo: null, page: 1 });
                    }}
                  >
                    Hasta: {criteria.dateTo} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.account ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => {
                      setAdvancedDraft((draft) => ({ ...draft, account: "" }));
                      updateUrlCriteria({ account: null, page: 1 });
                    }}
                  >
                    Cuenta: {criteria.account} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.category ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => {
                      setAdvancedDraft((draft) => ({ ...draft, category: "" }));
                      updateUrlCriteria({ category: null, page: 1 });
                    }}
                  >
                    Categoría: {criteria.category} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.status ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => {
                      setAdvancedDraft((draft) => ({ ...draft, status: "" }));
                      updateUrlCriteria({ status: null, page: 1 });
                    }}
                  >
                    Estado: {criteria.status} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                {criteria.search ? (
                  <button
                    className="transaction-filter-chip"
                    type="button"
                    onClick={() => updateSearch("")}
                  >
                    Búsqueda: {criteria.search} <span aria-hidden="true">×</span>
                  </button>
                ) : null}
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

          <section aria-labelledby="transactions-title">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="section-title" id="transactions-title">
                  Resultados
                </h3>
                <p className="mt-1 text-sm text-slate-400" role="status" aria-live="polite">
                  {explorerResult.total === 1
                    ? "1 movimiento encontrado"
                    : `${explorerResult.total.toLocaleString("es-PE")} movimientos encontrados`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
                <label className="field-label">
                  Ordenar por
                  <select
                    className="field"
                    value={criteria.sort}
                    onChange={(event) =>
                      updateUrlCriteria({ sort: readSort(event.target.value), page: 1 })
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
                    value={criteria.pageSize}
                    onChange={(event) =>
                      updateUrlCriteria({ pageSize: readPageSize(event.target.value), page: 1 })
                    }
                  >
                    {transactionPageSizes.map((pageSize) => (
                      <option key={pageSize} value={pageSize}>
                        {pageSize}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {transactionsQuery.data?.length === 0 ? (
              <div className="empty-state">
                <p className="font-medium text-slate-200">Aún no hay movimientos registrados.</p>
                <p className="mt-2">Cuando la fuente tenga datos válidos, aparecerán aquí.</p>
              </div>
            ) : explorerResult.total === 0 ? (
              <div className="empty-state">
                <p className="font-medium text-slate-200">
                  No encontramos movimientos con esos filtros.
                </p>
                <p className="mt-2">
                  Prueba con una búsqueda distinta o limpia los filtros aplicados.
                </p>
                <button className="button-secondary mt-5" type="button" onClick={clearAllFilters}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <>
                <TransactionResults
                  transactions={explorerResult.transactions}
                  onViewDetails={openDetail}
                />
                <nav className="transaction-pagination" aria-label="Paginación de movimientos">
                  <p className="text-sm text-slate-400">
                    Mostrando {(explorerResult.page - 1) * explorerResult.pageSize + 1}–
                    {Math.min(explorerResult.page * explorerResult.pageSize, explorerResult.total)}{" "}
                    de {explorerResult.total.toLocaleString("es-PE")}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="button-secondary transaction-pagination-button"
                      type="button"
                      disabled={explorerResult.page === 1}
                      onClick={() => updateUrlCriteria({ page: explorerResult.page - 1 }, false)}
                    >
                      Anterior
                    </button>
                    <span className="px-1 text-sm text-slate-300" aria-current="page">
                      Página {explorerResult.page} de {explorerResult.totalPages}
                    </span>
                    <button
                      className="button-secondary transaction-pagination-button"
                      type="button"
                      disabled={explorerResult.page === explorerResult.totalPages}
                      onClick={() => updateUrlCriteria({ page: explorerResult.page + 1 }, false)}
                    >
                      Siguiente
                    </button>
                  </div>
                </nav>
              </>
            )}
          </section>
        </>
      ) : null}

      <TransactionDetailDialog
        transaction={selectedTransaction}
        returnFocusTo={detailTrigger}
        onClose={closeDetail}
      />
    </div>
  );
}
