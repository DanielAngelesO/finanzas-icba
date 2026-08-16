import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { LogicalTransaction, TransactionType } from "../../../domain/transaction";
import { TransactionList } from "./transaction-list";
import { formatSearchResultCount, transactionSearchTypeOptions } from "./transaction-search-utils";

interface TransactionSearchControlsProps {
  value: string;
  type: TransactionType | null;
  total: number;
  advancedFilterCount: number;
  inputId: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  showCount?: boolean;
  onChange: (value: string) => void;
  onTypeChange: (type: TransactionType | null) => void;
  onOpenAdvanced: () => void;
  onEscape?: () => void;
}

export function TransactionSearchControls({
  value,
  type,
  total,
  advancedFilterCount,
  inputId,
  inputRef,
  showCount = true,
  onChange,
  onTypeChange,
  onOpenAdvanced,
  onEscape,
}: TransactionSearchControlsProps) {
  return (
    <div className="transaction-search-controls">
      <label className="transaction-search-field">
        <span className="sr-only">Buscar movimientos</span>
        <span aria-hidden="true">⌕</span>
        <input
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !onEscape) return;
            event.preventDefault();
            onEscape();
          }}
          placeholder="Buscar monto, persona, cuenta…"
          autoComplete="off"
        />
      </label>

      <div className="transaction-search-actions">
        <button
          className="button-secondary transaction-advanced-search-button"
          type="button"
          onClick={onOpenAdvanced}
          aria-label={
            advancedFilterCount > 0
              ? `Búsqueda avanzada, ${advancedFilterCount} filtros aplicados`
              : "Búsqueda avanzada"
          }
        >
          <svg
            className="transaction-advanced-search-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16l-6.5 7.25v5.5L10.5 19v-6.75L4 5Z" />
          </svg>
          <span className="transaction-advanced-search-text">Búsqueda avanzada</span>
          {advancedFilterCount > 0 ? (
            <span className="transaction-filter-count">{advancedFilterCount}</span>
          ) : null}
        </button>
      </div>

      <fieldset className="transaction-quick-filters">
        <legend className="sr-only">Filtrar por tipo</legend>
        {transactionSearchTypeOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={type === option.value}
            onClick={() => onTypeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      {showCount ? (
        <p className="transaction-search-result-count" role="status" aria-live="polite">
          {formatSearchResultCount(total)}
        </p>
      ) : null}
    </div>
  );
}

interface TransactionSearchBaseProps {
  value: string;
  type: TransactionType | null;
  total: number;
  advancedFilterCount: number;
  onChange: (value: string) => void;
  onTypeChange: (type: TransactionType | null) => void;
  onOpenAdvanced: () => void;
}

export function TransactionSearchInline({
  value,
  type,
  total,
  advancedFilterCount,
  onChange,
  onTypeChange,
  onOpenAdvanced,
}: TransactionSearchBaseProps) {
  return (
    <section className="transaction-search-inline" aria-label="Buscar movimientos">
      <TransactionSearchControls
        value={value}
        type={type}
        total={total}
        advancedFilterCount={advancedFilterCount}
        inputId="transaction-search-input-inline"
        onChange={onChange}
        onTypeChange={onTypeChange}
        onOpenAdvanced={onOpenAdvanced}
      />
    </section>
  );
}

export function TransactionSearchSheet({
  open,
  value,
  type,
  total,
  transactions,
  advancedFilterCount,
  hasMore,
  onChange,
  onTypeChange,
  onOpenAdvanced,
  onCancel,
  onOpenResult,
  onLoadMore,
}: TransactionSearchBaseProps & {
  open: boolean;
  transactions: LogicalTransaction[];
  hasMore: boolean;
  onCancel: () => void;
  onOpenResult: (transaction: LogicalTransaction, trigger: HTMLButtonElement) => void;
  onLoadMore: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 300);
      return () => window.clearTimeout(focusTimer);
    }

    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  return (
    <dialog
      className="transaction-search-dialog"
      id="transaction-search-dialog"
      ref={dialogRef}
      aria-labelledby="transaction-search-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.target !== event.currentTarget) return;
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="transaction-search-content">
        <header className="transaction-search-header">
          <div>
            <p className="transaction-search-eyebrow">Movimientos</p>
            <h2 id="transaction-search-title">Buscar movimientos</h2>
          </div>
          <button className="transaction-search-cancel" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </header>

        <div className="transaction-search-body">
          <TransactionSearchControls
            value={value}
            type={type}
            total={total}
            advancedFilterCount={advancedFilterCount}
            inputId="transaction-search-input"
            inputRef={inputRef}
            onChange={onChange}
            onTypeChange={onTypeChange}
            onOpenAdvanced={onOpenAdvanced}
            onEscape={onCancel}
          />

          {open ? (
            total === 0 ? (
              <div className="empty-state transaction-search-empty-state">
                <p className="font-medium text-slate-200">
                  No encontramos movimientos con esos criterios
                </p>
              </div>
            ) : (
              <>
                <TransactionList
                  variant="search"
                  transactions={transactions}
                  onOpen={onOpenResult}
                />
                {hasMore ? (
                  <div className="transaction-load-more">
                    <button className="button-secondary" type="button" onClick={onLoadMore}>
                      Mostrar más
                    </button>
                    <p>
                      Mostrando {transactions.length} de {total}
                    </p>
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
