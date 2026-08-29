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
  TransactionSearchInline,
  TransactionSearchSheet,
} from "../features/transactions/transaction-search-sheet";
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

const getInitialMobileSearchState = (): boolean =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(max-width: 47.999rem)").matches;

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
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const searchEntryPeriodRef = useRef<string | null | undefined>(undefined);
  const restoreSearchOnReturnRef = useRef(false);
  const reopenSearchAfterFiltersRef = useRef(false);
  const [isMobileSearchViewport, setIsMobileSearchViewport] = useState(getInitialMobileSearchState);
  const urlCriteria = useMemo(() => getUrlCriteria(searchParams), [searchParams]);
  const search = searchParams.get("q") ?? "";
  const [searchManuallyOpen, setSearchManuallyOpen] = useState(false);
  const searchOpen = searchManuallyOpen || Boolean(search.trim());
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
  const mobileSearchOpen =
    isMobileSearchViewport &&
    searchOpen &&
    !filtersOpen &&
    !isDetailRoute &&
    !isNewRoute &&
    !isEditRoute;
  const newType = searchParams.get("newType");
  const initialEditorType: TransactionType = isTransactionType(newType)
    ? newType
    : (duplicatedTransaction?.type ?? similarTransaction?.type ?? "INGRESO");
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
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 47.999rem)");
    const updateMobileState = () => setIsMobileSearchViewport(mediaQuery.matches);
    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);
    return () => mediaQuery.removeEventListener("change", updateMobileState);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen && searchEntryPeriodRef.current === undefined) {
      searchEntryPeriodRef.current = urlCriteria.period;
    }
  }, [mobileSearchOpen, urlCriteria.period]);

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

  useEffect(() => {
    const isListRoute = !isDetailRoute && !isNewRoute && !isEditRoute;
    if (!isListRoute || !restoreSearchOnReturnRef.current) return;
    restoreSearchOnReturnRef.current = false;
    setSearchManuallyOpen(true);
  }, [isDetailRoute, isEditRoute, isNewRoute, location.key]);

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
    (value: string) => updateCriteria({}, value.trim() ? value : null),
    [updateCriteria],
  );

  const clearSearchCriteria = useCallback(
    (period: string | null) =>
      updateCriteria(
        {
          period,
          type: null,
          dateFrom: null,
          dateTo: null,
          account: null,
          category: null,
          status: null,
          sort: "date-desc",
        },
        null,
      ),
    [updateCriteria],
  );

  const cancelSearch = useCallback(() => {
    const period =
      searchEntryPeriodRef.current !== undefined
        ? searchEntryPeriodRef.current
        : urlCriteria.period;
    clearSearchCriteria(period);
    setSearchManuallyOpen(false);
    searchEntryPeriodRef.current = undefined;
    reopenSearchAfterFiltersRef.current = false;
    window.setTimeout(() => searchToggleRef.current?.focus(), 0);
  }, [clearSearchCriteria, setSearchManuallyOpen, urlCriteria.period]);

  const openSearch = useCallback(() => {
    searchEntryPeriodRef.current = urlCriteria.period;
    setSearchManuallyOpen(true);
  }, [setSearchManuallyOpen, urlCriteria.period]);

  const toggleSearch = () => {
    if (mobileSearchOpen) cancelSearch();
    else openSearch();
  };

  const restoreSearchAfterFilters = () => {
    setFiltersOpen(false);
    if (!reopenSearchAfterFiltersRef.current) return;
    reopenSearchAfterFiltersRef.current = false;
    setSearchManuallyOpen(true);
  };

  const openAdvancedFilters = () => {
    if (mobileSearchOpen) {
      reopenSearchAfterFiltersRef.current = true;
      setSearchManuallyOpen(false);
    }
    setFiltersOpen(true);
  };

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
    restoreSearchAfterFilters();
  };

  const clearFilters = () => {
    clearSearchCriteria(urlCriteria.period);
  };

  const openRoute = (path: string, replace = false) => {
    navigate(`${path}${location.search}`, { replace, state: { fromMovements: true } });
  };

  const openTransactionDetail = (
    transaction: LogicalTransaction,
    trigger: HTMLButtonElement,
    fromSearch: boolean,
  ) => {
    if (fromSearch) {
      restoreSearchOnReturnRef.current = true;
      setDetailTrigger(null);
      setSearchManuallyOpen(false);
    } else {
      setDetailTrigger(trigger);
    }
    navigate(`/movimientos/${transaction.transactionId}${location.search}`, {
      state: { fromMovements: true, fromSearch },
    });
  };

  const closeSheet = () => {
    const state = location.state;
    const fromSearch =
      restoreSearchOnReturnRef.current ||
      (typeof state === "object" &&
        state !== null &&
        "fromSearch" in state &&
        state.fromSearch === true);
    const focusTarget = fromSearch ? null : (detailTrigger ?? newButtonRef.current);
    if (
      typeof state === "object" &&
      state !== null &&
      "fromMovements" in state &&
      state.fromMovements === true
    ) {
      navigate(-1);
    } else navigate(listHref, { replace: true });
    if (fromSearch) {
      restoreSearchOnReturnRef.current = true;
      setSearchManuallyOpen(true);
    } else {
      window.setTimeout(() => focusTarget?.focus(), 0);
    }
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
      <h1 className="sr-only">Movimientos</h1>
      <button
        className="button-primary transaction-new-button"
        type="button"
        ref={newButtonRef}
        onClick={() => {
          setDetailTrigger(null);
          openRoute("/movimientos/nueva");
        }}
        disabled={!writable}
        aria-label="Registrar nuevo movimiento"
        title={writeReason ?? "Registrar nuevo movimiento"}
      >
        <span aria-hidden="true">+</span>
      </button>

      {writeReason ? <p className="transaction-write-notice">{writeReason}</p> : null}

      <section className="transaction-toolbar" aria-label="Explorar movimientos">
        <PeriodNavigator
          period={criteria.period}
          onChange={(period) => updateCriteria({ period })}
        />
        {isMobileSearchViewport ? (
          <button
            className="button-secondary transaction-search-toggle"
            type="button"
            ref={searchToggleRef}
            onClick={toggleSearch}
            aria-controls="transaction-search-dialog"
            aria-expanded={mobileSearchOpen}
            aria-label="Buscar movimientos"
          >
            <span aria-hidden="true">⌕</span>
          </button>
        ) : (
          <TransactionSearchInline
            value={search}
            type={criteria.type}
            total={explorer?.total ?? 0}
            advancedFilterCount={activeFilterCount}
            onChange={commitSearch}
            onTypeChange={(type) => updateCriteria({ type })}
            onOpenAdvanced={openAdvancedFilters}
          />
        )}
      </section>

      {isMobileSearchViewport && explorer ? (
        <TransactionSearchSheet
          open={mobileSearchOpen}
          value={search}
          type={criteria.type}
          total={explorer.total}
          transactions={explorer.transactions}
          advancedFilterCount={activeFilterCount}
          hasMore={explorer.transactions.length < explorer.total}
          onChange={commitSearch}
          onTypeChange={(type) => updateCriteria({ type })}
          onOpenAdvanced={openAdvancedFilters}
          onCancel={cancelSearch}
          onOpenResult={(transaction, trigger) => openTransactionDetail(transaction, trigger, true)}
          onLoadMore={() =>
            setPagination((current) => ({
              key: paginationKey,
              count: (current.key === paginationKey ? current.count : 30) + 30,
            }))
          }
        />
      ) : null}

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
                onOpen={(transaction: LogicalTransaction, trigger: HTMLButtonElement) =>
                  openTransactionDetail(transaction, trigger, false)
                }
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
          onClose={restoreSearchAfterFilters}
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
