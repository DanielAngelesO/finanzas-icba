import { useEffect, useRef, useState } from "react";
import type {
  TransactionExplorerCriteria,
  TransactionFacets,
  TransactionSort,
} from "../../../application/use-cases/explore-transactions";
import { getTransactionStatusLabel, type TransactionStatus } from "../../../domain/transaction";

interface FilterDraft {
  dateFrom: string;
  dateTo: string;
  account: string;
  category: string;
  status: TransactionStatus | "";
  sort: TransactionSort;
  allPeriods: boolean;
}

const toDraft = (criteria: TransactionExplorerCriteria): FilterDraft => ({
  dateFrom: criteria.dateFrom ?? "",
  dateTo: criteria.dateTo ?? "",
  account: criteria.account ?? "",
  category: criteria.category ?? "",
  status: criteria.status ?? "",
  sort: criteria.sort,
  allPeriods: criteria.period === null,
});

export function TransactionFilterSheet({
  open,
  criteria,
  facets,
  onClose,
  onApply,
}: {
  open: boolean;
  criteria: TransactionExplorerCriteria;
  facets: TransactionFacets;
  onClose: () => void;
  onApply: (draft: FilterDraft) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(() => toDraft(criteria));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => closeRef.current?.focus(), 0);
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const apply = () => {
    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
      setError("La fecha inicial debe ser anterior o igual a la fecha final.");
      return;
    }
    setError(null);
    onApply(draft);
  };

  return (
    <dialog
      className="transaction-filter-dialog"
      ref={dialogRef}
      aria-labelledby="transaction-filter-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="transaction-filter-content">
        <header className="transaction-sheet-header">
          <div>
            <h2 className="section-title" id="transaction-filter-title">
              Filtros
            </h2>
            <p className="mt-1 text-sm text-slate-400">Acota el período visible.</p>
          </div>
          <button
            className="transaction-icon-button"
            type="button"
            onClick={onClose}
            ref={closeRef}
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Cerrar filtros</span>
          </button>
        </header>
        <div className="transaction-filter-body">
          <label className="transaction-checkbox-field">
            <input
              type="checkbox"
              checked={draft.allPeriods}
              onChange={(event) =>
                setDraft((current) => ({ ...current, allPeriods: event.target.checked }))
              }
            />
            <span>Buscar en todos los períodos</span>
          </label>
          <div className="transaction-form-grid">
            <label className="field-label">
              Desde
              <input
                className="field"
                type="date"
                value={draft.dateFrom}
                onChange={(event) => {
                  setError(null);
                  setDraft((current) => ({ ...current, dateFrom: event.target.value }));
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "transaction-filter-date-error" : undefined}
              />
            </label>
            <label className="field-label">
              Hasta
              <input
                className="field"
                type="date"
                value={draft.dateTo}
                onChange={(event) => {
                  setError(null);
                  setDraft((current) => ({ ...current, dateTo: event.target.value }));
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "transaction-filter-date-error" : undefined}
              />
            </label>
          </div>
          {error ? (
            <p className="transaction-filter-error" id="transaction-filter-date-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="field-label">
            Cuenta
            <select
              className="field"
              value={draft.account}
              onChange={(event) =>
                setDraft((current) => ({ ...current, account: event.target.value }))
              }
            >
              <option value="">Todas las cuentas</option>
              {facets.accounts.map((account) => (
                <option key={account}>{account}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Categoría
            <select
              className="field"
              value={draft.category}
              onChange={(event) =>
                setDraft((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">Todas las categorías</option>
              {facets.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Estado
            <select
              className="field"
              value={draft.status}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({
                  ...current,
                  status:
                    value === "CONFIRMED" || value === "PENDING" || value === "VOIDED" ? value : "",
                }));
              }}
            >
              <option value="">Todos los estados</option>
              {facets.statuses.map((status) => (
                <option key={status} value={status}>
                  {getTransactionStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Ordenar por
            <select
              className="field"
              value={draft.sort}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "date-desc" ||
                  value === "date-asc" ||
                  value === "amount-desc" ||
                  value === "amount-asc"
                ) {
                  setDraft((current) => ({ ...current, sort: value }));
                }
              }}
            >
              <option value="date-desc">Más recientes</option>
              <option value="date-asc">Fecha ascendente</option>
              <option value="amount-asc">Monto ascendente</option>
              <option value="amount-desc">Monto descendente</option>
            </select>
          </label>
        </div>
        <footer className="transaction-editor-footer">
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              setDraft({
                dateFrom: "",
                dateTo: "",
                account: "",
                category: "",
                status: "",
                sort: "date-desc",
                allPeriods: false,
              })
            }
          >
            Restablecer
          </button>
          <button className="button-primary" type="button" onClick={apply}>
            Aplicar filtros
          </button>
        </footer>
      </div>
    </dialog>
  );
}

export type { FilterDraft as TransactionFilterDraft };
