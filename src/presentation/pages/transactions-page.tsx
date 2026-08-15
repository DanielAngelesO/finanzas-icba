import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  defaultTransactionExplorerCriteria,
  exploreTransactions,
  type TransactionExplorerCriteria,
  type TransactionSort,
} from "../../application/use-cases/explore-transactions";
import type { AppServices } from "../../composition/services";
import {
  getTransactionStatusLabel,
  type LogicalTransaction,
  type TransactionActor,
  type TransactionStatus,
  type TransactionType,
} from "../../domain/transaction";
import { useAuth } from "../auth/auth-context";
import { TransactionDetailSheet } from "../features/transactions/transaction-detail-sheet";
import { TransactionEditorSheet } from "../features/transactions/transaction-editor-sheet";
import {
  TransactionFilterSheet,
  type TransactionFilterDraft,
} from "../features/transactions/transaction-filter-sheet";
import { TransactionList } from "../features/transactions/transaction-list";
import { PeriodNavigator } from "../features/transactions/period-navigator";
import {
  getCurrentLimaPeriod,
  getTransactionTypeLabel,
} from "../features/transactions/transaction-ui";
import { formatPeriod } from "../formatters";

type UrlCriteria = Omit<TransactionExplorerCriteria, "search" | "page" | "pageSize">;

interface ToastState {
  message: string;
  similarTransactionId: string | null;
}

const quickTypeOptions: Array<{ value: TransactionType | null; label: string }> = [
  { value: null, label: "Todos" },
  { value: "INGRESO", label: "Ingresos" },
  { value: "EGRESO", label: "Egresos" },
  { value: "TRANSFERENCIA", label: "Transferencias" },
];

const isTransactionType = (value: string | null): value is TransactionType =>
  value === "INGRESO" || value === "EGRESO" || value === "TRANSFERENCIA";

const isTransactionStatus = (value: string | null): value is TransactionStatus =>
  value === "CONFIRMED" || value === "PENDING" || value === "VOIDED";

const isValidPeriod = (value: string | null): value is string => {
  if (!value || !/^\d{6}$/.test(value)) return false;
  const month = Number(value.slice(4, 6));
  return month >= 1 && month <= 12;
};

const isValidDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime());
};

const readText = (params: URLSearchParams, name: string): string | null => {
  const value = params.get(name)?.trim();
  return value ? value : null;
};

const readSort = (value: string | null): TransactionSort =>
  value === "date-asc" || value === "amount-desc" || value === "amount-asc" ? value : "date-desc";

const getUrlCriteria = (params: URLSearchParams): UrlCriteria => {
  const period = params.get("period");
  const type = params.get("type");
  const status = params.get("status");
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  return {
    period: period === "all" ? null : isValidPeriod(period) ? period : getCurrentLimaPeriod(),
    type: isTransactionType(type) ? type : null,
    dateFrom: isValidDate(dateFrom) ? dateFrom : null,
    dateTo: isValidDate(dateTo) ? dateTo : null,
    account: readText(params, "account"),
    category: readText(params, "category"),
    status: isTransactionStatus(status) ? status : null,
    sort: readSort(params.get("sort")),
  };
};

const setOptional = (params: URLSearchParams, name: string, value: string | null): void => {
  if (value) params.set(name, value);
  else params.delete(name);
};

const countAdvancedFilters = (criteria: TransactionExplorerCriteria): number =>
  [criteria.dateFrom, criteria.dateTo, criteria.account, criteria.category, criteria.status].filter(
    Boolean,
  ).length + (criteria.period === null ? 1 : 0);

function TransactionLoadingState() {
  return (
    <section className="transaction-loading-list" aria-busy="true" aria-live="polite">
      <div className="shimmer h-20 w-full" aria-hidden="true" />
      <div className="shimmer h-20 w-full" aria-hidden="true" />
      <div className="shimmer h-20 w-full" aria-hidden="true" />
      <span className="sr-only">Cargando movimientos.</span>
    </section>
  );
}

function TransactionSearchControl({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (draft.trim() === value) return;
    const timeout = window.setTimeout(() => onCommit(draft.trim()), 150);
    return () => window.clearTimeout(timeout);
  }, [draft, onCommit, value]);

  return (
    <label className="transaction-search-field">
      <span className="sr-only">Buscar movimientos</span>
      <span aria-hidden="true">⌕</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Buscar monto, persona, cuenta…"
      />
    </label>
  );
}

export function TransactionsPage({ services }: { services: AppServices }) {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state: authState } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [detailTrigger, setDetailTrigger] = useState<HTMLButtonElement | null>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const urlCriteria = useMemo(() => getUrlCriteria(searchParams), [searchParams]);
  const search = readText(searchParams, "q") ?? "";
  const paginationKey = useMemo(
    () => JSON.stringify({ search, ...urlCriteria }),
    [search, urlCriteria],
  );
  const [pagination, setPagination] = useState(() => ({ key: paginationKey, count: 30 }));
  const visibleCount = pagination.key === paginationKey ? pagination.count : 30;
  const criteria = useMemo<TransactionExplorerCriteria>(
    () => ({ ...urlCriteria, search, page: 1, pageSize: visibleCount }),
    [search, urlCriteria, visibleCount],
  );
  const actor = useMemo<TransactionActor>(
    () => ({
      email: authState.status === "authenticated" ? authState.email : "",
      displayName: authState.status === "authenticated" ? authState.name : null,
    }),
    [authState],
  );

  const transactionsQuery = useQuery({
    queryKey: ["transactions", "logical"],
    queryFn: () => services.transactions.findAll(),
  });
  const catalogsQuery = useQuery({
    queryKey: ["transactions", "catalogs"],
    queryFn: () => services.transactions.getCatalogs(),
  });
  const writable = catalogsQuery.data?.writeCapability.status === "enabled";
  const writeReason =
    catalogsQuery.data?.writeCapability.status === "disabled"
      ? catalogsQuery.data.writeCapability.reason
      : null;
  const explorer = useMemo(
    () => (transactionsQuery.data ? exploreTransactions(transactionsQuery.data, criteria) : null),
    [criteria, transactionsQuery.data],
  );
  const selectedTransaction = useMemo(
    () =>
      transactionId
        ? (transactionsQuery.data?.find(
            (transaction) =>
              transaction.transactionId === transactionId ||
              transaction.rowIds.includes(transactionId),
          ) ?? null)
        : null,
    [transactionId, transactionsQuery.data],
  );
  const duplicateId = searchParams.get("duplicate");
  const duplicatedTransaction = useMemo(
    () =>
      duplicateId
        ? (transactionsQuery.data?.find(
            (transaction) => transaction.transactionId === duplicateId,
          ) ?? null)
        : null,
    [duplicateId, transactionsQuery.data],
  );
  const similarId = searchParams.get("similar");
  const similarTransaction = useMemo(
    () =>
      similarId
        ? (transactionsQuery.data?.find((transaction) => transaction.transactionId === similarId) ??
          null)
        : null,
    [similarId, transactionsQuery.data],
  );
  const isNewRoute = location.pathname === "/movimientos/nueva";
  const isEditRoute = location.pathname.endsWith("/editar");
  const isDetailRoute = Boolean(transactionId) && !isEditRoute;
  const newType = searchParams.get("newType");
  const initialEditorType: TransactionType = isTransactionType(newType)
    ? newType
    : (duplicatedTransaction?.type ?? similarTransaction?.type ?? "EGRESO");
  const listParams = new URLSearchParams(searchParams);
  listParams.delete("duplicate");
  listParams.delete("newType");
  listParams.delete("similar");
  const listSearch = listParams.toString();
  const listHref = `/movimientos${listSearch ? `?${listSearch}` : ""}`;

  useEffect(() => {
    if (!searchParams.has("period")) {
      const next = new URLSearchParams(searchParams);
      next.set("period", getCurrentLimaPeriod());
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isEditRoute && selectedTransaction?.status === "VOIDED") {
      navigate(`/movimientos/${selectedTransaction.transactionId}${location.search}`, {
        replace: true,
      });
    }
  }, [isEditRoute, location.search, navigate, selectedTransaction]);

  useEffect(() => {
    if (catalogsQuery.data && !writable && (isNewRoute || isEditRoute)) {
      navigate(listHref, { replace: true });
    }
  }, [catalogsQuery.data, isEditRoute, isNewRoute, listHref, navigate, writable]);

  const updateCriteria = useCallback(
    (patch: Partial<UrlCriteria>, searchPatch?: string | null) => {
      const nextCriteria: UrlCriteria = { ...urlCriteria, ...patch };
      const next = new URLSearchParams(searchParams);
      next.set("period", nextCriteria.period ?? "all");
      setOptional(next, "type", nextCriteria.type);
      setOptional(next, "from", nextCriteria.dateFrom);
      setOptional(next, "to", nextCriteria.dateTo);
      setOptional(next, "account", nextCriteria.account);
      setOptional(next, "category", nextCriteria.category);
      setOptional(next, "status", nextCriteria.status);
      if (nextCriteria.sort === defaultTransactionExplorerCriteria.sort) next.delete("sort");
      else next.set("sort", nextCriteria.sort);
      if (searchPatch !== undefined) setOptional(next, "q", searchPatch);
      next.delete("duplicate");
      next.delete("newType");
      next.delete("similar");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, urlCriteria],
  );

  const commitSearch = useCallback(
    (value: string) => updateCriteria({}, value || null),
    [updateCriteria],
  );

  const applyFilterDraft = (draft: TransactionFilterDraft) => {
    updateCriteria({
      period: draft.allPeriods ? null : (urlCriteria.period ?? getCurrentLimaPeriod()),
      dateFrom: draft.dateFrom || null,
      dateTo: draft.dateTo || null,
      account: draft.account || null,
      category: draft.category || null,
      status: draft.status || null,
      sort: draft.sort,
    });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    updateCriteria(
      {
        type: null,
        dateFrom: null,
        dateTo: null,
        account: null,
        category: null,
        status: null,
        sort: "date-desc",
      },
      null,
    );
  };

  const openRoute = (path: string, replace = false) => {
    navigate(`${path}${location.search}`, { replace, state: { fromMovements: true } });
  };
  const closeSheet = () => {
    const focusTarget = detailTrigger ?? newButtonRef.current;
    const state = location.state;
    if (
      typeof state === "object" &&
      state !== null &&
      "fromMovements" in state &&
      state.fromMovements === true
    ) {
      navigate(-1);
    } else navigate(listHref, { replace: true });
    window.setTimeout(() => focusTarget?.focus(), 0);
  };

  const saveDraft = async (draft: Parameters<AppServices["transactions"]["create"]>[0]) => {
    const saved =
      isEditRoute && selectedTransaction
        ? await services.transactions.update(
            selectedTransaction.transactionId,
            selectedTransaction.version,
            draft,
            actor,
          )
        : await services.transactions.create(draft, actor);
    await queryClient.invalidateQueries();
    const feminine = saved.type === "TRANSFERENCIA";
    setToast({
      message: `${getTransactionTypeLabel(saved.type)} ${isEditRoute ? (feminine ? "actualizada" : "actualizado") : feminine ? "registrada" : "registrado"}`,
      similarTransactionId: saved.transactionId,
    });
    navigate(listHref, {
      replace: true,
      state: { fromMovements: true },
    });
  };

  const voidTransaction = async (reason: string) => {
    if (!selectedTransaction) return;
    await services.transactions.voidTransaction(
      selectedTransaction.transactionId,
      selectedTransaction.version,
      reason,
      actor,
    );
    await queryClient.invalidateQueries();
    setToast({ message: "Transacción anulada", similarTransactionId: null });
    navigate(listHref, { replace: true });
  };

  const activeFilterCount = countAdvancedFilters(criteria);

  return (
    <div className="transaction-page">
      <header className="transaction-page-header">
        <div>
          <h1 className="page-title">Movimientos</h1>
          <p className="page-subtitle">Registra y consulta las transacciones del período.</p>
        </div>
        <button
          className="button-primary transaction-new-button"
          type="button"
          ref={newButtonRef}
          onClick={() => {
            setDetailTrigger(null);
            openRoute("/movimientos/nueva");
          }}
          disabled={!writable}
          title={writeReason ?? undefined}
        >
          <span aria-hidden="true">＋</span> Nueva
        </button>
      </header>

      {writeReason ? <p className="transaction-write-notice">{writeReason}</p> : null}

      <section className="transaction-toolbar" aria-label="Explorar movimientos">
        <PeriodNavigator
          period={criteria.period}
          onChange={(period) => updateCriteria({ period })}
        />
        <div className="transaction-search-row">
          <TransactionSearchControl key={search} value={search} onCommit={commitSearch} />
          <button
            className="button-secondary transaction-filter-button"
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={`Abrir filtros${activeFilterCount ? `, ${activeFilterCount} aplicados` : ""}`}
          >
            <span aria-hidden="true">⚙</span>
            {activeFilterCount > 0 ? (
              <span className="transaction-filter-count">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
        <fieldset className="transaction-quick-filters">
          <legend className="sr-only">Filtrar por tipo</legend>
          {quickTypeOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={criteria.type === option.value}
              onClick={() => updateCriteria({ type: option.value })}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        {criteria.search || criteria.type || activeFilterCount > 0 ? (
          <div className="transaction-active-filters" aria-label="Filtros aplicados">
            {criteria.search ? (
              <button type="button" onClick={() => commitSearch("")}>
                Búsqueda: {criteria.search} <span aria-hidden="true">×</span>
              </button>
            ) : null}
            {criteria.account ? (
              <button type="button" onClick={() => updateCriteria({ account: null })}>
                Cuenta: {criteria.account} <span aria-hidden="true">×</span>
              </button>
            ) : null}
            {criteria.category ? (
              <button type="button" onClick={() => updateCriteria({ category: null })}>
                Categoría: {criteria.category} <span aria-hidden="true">×</span>
              </button>
            ) : null}
            {criteria.status ? (
              <button type="button" onClick={() => updateCriteria({ status: null })}>
                Estado: {getTransactionStatusLabel(criteria.status)}{" "}
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
            {criteria.period === null ? (
              <button
                type="button"
                onClick={() => updateCriteria({ period: getCurrentLimaPeriod() })}
              >
                Todos los períodos <span aria-hidden="true">×</span>
              </button>
            ) : null}
            <button className="transaction-clear-filters" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : null}
      </section>

      {toast ? (
        <div className="transaction-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.similarTransactionId ? (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("duplicate");
                next.delete("newType");
                next.set("similar", toast.similarTransactionId ?? "");
                setToast(null);
                setDetailTrigger(null);
                navigate(`/movimientos/nueva?${next.toString()}`, {
                  state: { fromMovements: true },
                });
              }}
            >
              Registrar otro similar
            </button>
          ) : null}
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}

      {transactionsQuery.isPending ? <TransactionLoadingState /> : null}
      {transactionsQuery.isError ? (
        <section
          className="card transaction-error-state"
          role="alert"
          aria-labelledby="transactions-error-title"
        >
          <h2 className="section-title" id="transactions-error-title">
            No pudimos cargar los movimientos
          </h2>
          <button
            className="button-primary mt-4"
            type="button"
            onClick={() => void transactionsQuery.refetch()}
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {explorer ? (
        <section className="transaction-results" aria-labelledby="transaction-results-title">
          <div className="transaction-results-heading">
            <h2 className="sr-only" id="transaction-results-title">
              Resultados
            </h2>
            <p role="status" aria-live="polite">
              {explorer.total === 1
                ? "1 movimiento"
                : `${explorer.total.toLocaleString("es-PE")} movimientos`}
              {criteria.period ? ` en ${formatPeriod(criteria.period)}` : ""}
            </p>
          </div>
          {transactionsQuery.data?.length === 0 ? (
            <div className="empty-state transaction-empty-state">
              <p className="font-medium text-slate-200">
                {criteria.period
                  ? `Aún no hay transacciones en ${formatPeriod(criteria.period).toLocaleLowerCase("es-PE")}`
                  : "Aún no hay transacciones"}
              </p>
              {writable ? (
                <button
                  className="button-primary mt-5"
                  type="button"
                  onClick={() => openRoute("/movimientos/nueva")}
                >
                  Registrar primera transacción
                </button>
              ) : null}
            </div>
          ) : explorer.total === 0 ? (
            <div className="empty-state transaction-empty-state">
              <p className="font-medium text-slate-200">
                No encontramos movimientos con esos criterios
              </p>
              <button className="button-secondary mt-5" type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <TransactionList
                transactions={explorer.transactions}
                onOpen={(transaction: LogicalTransaction, trigger: HTMLButtonElement) => {
                  setDetailTrigger(trigger);
                  openRoute(`/movimientos/${transaction.transactionId}`);
                }}
              />
              {explorer.transactions.length < explorer.total ? (
                <div className="transaction-load-more">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() =>
                      setPagination((current) => ({
                        key: paginationKey,
                        count: (current.key === paginationKey ? current.count : 30) + 30,
                      }))
                    }
                  >
                    Mostrar más
                  </button>
                  <p>
                    Mostrando {explorer.transactions.length} de {explorer.total}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {explorer && filtersOpen ? (
        <TransactionFilterSheet
          open={filtersOpen}
          criteria={criteria}
          facets={explorer.facets}
          onClose={() => setFiltersOpen(false)}
          onApply={applyFilterDraft}
        />
      ) : null}

      <TransactionDetailSheet
        open={isDetailRoute}
        transaction={selectedTransaction}
        onClose={closeSheet}
        onEdit={() =>
          selectedTransaction &&
          openRoute(`/movimientos/${selectedTransaction.transactionId}/editar`, true)
        }
        onDuplicate={() => {
          if (!selectedTransaction) return;
          const next = new URLSearchParams(searchParams);
          next.set("duplicate", selectedTransaction.transactionId);
          navigate(`/movimientos/nueva?${next.toString()}`, {
            replace: true,
            state: { fromMovements: true },
          });
        }}
        onVoid={voidTransaction}
        writable={writable}
        writeReason={writeReason}
      />

      {catalogsQuery.data && writable && (isNewRoute || isEditRoute) ? (
        <TransactionEditorSheet
          key={`${isEditRoute ? "edit" : duplicatedTransaction ? "duplicate" : similarTransaction ? "similar" : "create"}-${selectedTransaction?.transactionId ?? duplicatedTransaction?.transactionId ?? similarTransaction?.transactionId ?? initialEditorType}`}
          open={isNewRoute || isEditRoute}
          mode={
            isEditRoute
              ? "edit"
              : duplicatedTransaction
                ? "duplicate"
                : similarTransaction
                  ? "similar"
                  : "create"
          }
          initialType={initialEditorType}
          transaction={
            isEditRoute ? selectedTransaction : (duplicatedTransaction ?? similarTransaction)
          }
          catalogs={catalogsQuery.data}
          actor={actor}
          onClose={closeSheet}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  );
}
