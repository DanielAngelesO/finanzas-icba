import { useEffect, useMemo, useRef } from "react";
import { getIncomeGroup } from "../../domain/income-groups";
import type { Transaction } from "../../domain/transaction";
import {
  formatCompactDate,
  formatDate,
  formatMoney,
  formatPeriod,
  formatPreviewDate,
} from "../formatters";

const getTransactionConcept = (transaction: Transaction): string =>
  transaction.description ?? transaction.category;

const getTransactionTypeLabel = (transaction: Transaction): string =>
  transaction.type === "INGRESO" ? "Ingreso" : "Egreso";

const getSignedAmount = (transaction: Transaction): string =>
  `${transaction.type === "INGRESO" ? "+" : "−"}${formatMoney(transaction.amount)}`;

const optionalValue = (value: string | null): string => value ?? "Sin información";

function TransactionTypeBadge({ transaction }: { transaction: Transaction }) {
  const label = getTransactionTypeLabel(transaction);
  return (
    <span className={transaction.type === "INGRESO" ? "type-ingreso" : "type-egreso"}>
      <span aria-hidden="true">{transaction.type === "INGRESO" ? "↑" : "↓"}</span>
      {label}
    </span>
  );
}

function TransactionAmount({ transaction }: { transaction: Transaction }) {
  return (
    <span
      className={
        "tabular-nums font-semibold " +
        (transaction.type === "INGRESO" ? "amount-positive" : "amount-negative")
      }
      aria-label={`${getTransactionTypeLabel(transaction)} de ${formatMoney(transaction.amount)}`}
    >
      {getSignedAmount(transaction)}
    </span>
  );
}

function TransactionPreview({ transaction }: { transaction: Transaction }) {
  const concept = getTransactionConcept(transaction);
  const category = concept === transaction.category ? null : transaction.category;
  const incomeGroup = getIncomeGroup(transaction);
  const donor = incomeGroup === "DIEZMOS" ? transaction.donorOrProvider?.trim() || null : null;
  const offeringDate = incomeGroup === "OFRENDAS" ? formatPreviewDate(transaction.date) : null;

  if (!category && !donor && !offeringDate) return null;

  const preview = [category, donor].filter(Boolean).join(" · ");

  return (
    <div className="transaction-preview">
      {preview ? (
        <p className="transaction-preview-line" title={preview}>
          {category ? <span className="transaction-preview-category">{category}</span> : null}
          {category && donor ? (
            <span className="transaction-preview-separator">{" · "}</span>
          ) : null}
          {donor ? <span className="transaction-preview-donor">{donor}</span> : null}
        </p>
      ) : null}
      {offeringDate ? (
        <p className="transaction-preview-date" title={offeringDate}>
          {offeringDate}
        </p>
      ) : null}
    </div>
  );
}

export function TransactionResults({
  transactions,
  onViewDetails,
}: {
  transactions: Transaction[];
  onViewDetails: (transaction: Transaction, trigger: HTMLButtonElement) => void;
}) {
  return (
    <>
      <ul className="transaction-card-list xl:hidden" aria-label="Movimientos encontrados">
        {transactions.map((transaction) => {
          const concept = getTransactionConcept(transaction);
          return (
            <li key={transaction.id}>
              <article className="transaction-card">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-400">
                    {formatCompactDate(transaction.date)}
                  </p>
                  <TransactionTypeBadge transaction={transaction} />
                </div>
                <div className="mt-3 min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100" title={concept}>
                    {concept}
                  </p>
                  <TransactionPreview transaction={transaction} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <TransactionAmount transaction={transaction} />
                  <button
                    className="button-secondary transaction-detail-trigger"
                    type="button"
                    onClick={(event) => onViewDetails(transaction, event.currentTarget)}
                    aria-label={`Ver detalle de ${concept}`}
                  >
                    Ver detalle
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="transaction-table-wrapper hidden xl:block">
        <table className="data-table transaction-table" aria-label="Movimientos encontrados">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Movimiento</th>
              <th scope="col">Tipo</th>
              <th scope="col">Cuenta</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">
                Monto
              </th>
              <th scope="col" className="text-right">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const concept = getTransactionConcept(transaction);
              return (
                <tr key={transaction.id}>
                  <td className="whitespace-nowrap text-slate-300">
                    {formatCompactDate(transaction.date)}
                  </td>
                  <td className="transaction-table-concept">
                    <p className="truncate font-medium text-slate-100" title={concept}>
                      {concept}
                    </p>
                    <TransactionPreview transaction={transaction} />
                  </td>
                  <td>
                    <TransactionTypeBadge transaction={transaction} />
                  </td>
                  <td className="truncate text-slate-300" title={transaction.account}>
                    {transaction.account}
                  </td>
                  <td className="truncate text-slate-300" title={transaction.status}>
                    {transaction.status}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <TransactionAmount transaction={transaction} />
                  </td>
                  <td className="text-right">
                    <button
                      className="button-secondary transaction-detail-trigger"
                      type="button"
                      onClick={(event) => onViewDetails(transaction, event.currentTarget)}
                      aria-label={`Ver detalle de ${concept}`}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface DetailField {
  label: string;
  value: string;
}

interface DetailGroup {
  title: string;
  fields: DetailField[];
}

const getDetailGroups = (transaction: Transaction): DetailGroup[] => [
  {
    title: "Datos principales",
    fields: [
      { label: "ID", value: transaction.id },
      { label: "Fecha", value: formatDate(transaction.date) },
      {
        label: "Tipo",
        value: `${transaction.type === "INGRESO" ? "↑" : "↓"} ${getTransactionTypeLabel(transaction)}`,
      },
      { label: "Monto", value: getSignedAmount(transaction) },
      { label: "Estado", value: transaction.status },
      { label: "Período", value: formatPeriod(transaction.period) },
    ],
  },
  {
    title: "Clasificación",
    fields: [
      { label: "Cuenta", value: transaction.account },
      { label: "Categoría", value: transaction.category },
      { label: "Subcategoría", value: optionalValue(transaction.subcategory) },
    ],
  },
  {
    title: "Trazabilidad",
    fields: [
      { label: "Responsable", value: transaction.responsible },
      { label: "Donante / Proveedor", value: optionalValue(transaction.donorOrProvider) },
      { label: "Método de pago", value: transaction.paymentMethod },
      { label: "Referencia / Comprobante", value: optionalValue(transaction.referenceOrReceipt) },
    ],
  },
  {
    title: "Observaciones",
    fields: [
      { label: "Descripción", value: optionalValue(transaction.description) },
      { label: "Notas", value: optionalValue(transaction.notes) },
    ],
  },
];

export function TransactionDetailDialog({
  transaction,
  returnFocusTo,
  onClose,
}: {
  transaction: Transaction | null;
  returnFocusTo: HTMLButtonElement | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const detailGroups = useMemo(
    () => (transaction ? getDetailGroups(transaction) : []),
    [transaction],
  );
  const titleId = "transaction-detail-title";

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (transaction && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
    if (!transaction && dialog.open) dialog.close();
  }, [transaction]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      onClose();
      returnFocusTo?.focus();
    };
    const handleCancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [onClose, returnFocusTo]);

  return (
    <dialog
      className="transaction-detail-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeDialog();
      }}
    >
      {transaction ? (
        <div className="transaction-detail-content">
          <header className="transaction-detail-header">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Movimiento
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-slate-100" id={titleId}>
                {getTransactionConcept(transaction)}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{transaction.id}</p>
            </div>
            <button
              className="button-secondary transaction-close-button"
              type="button"
              onClick={closeDialog}
              ref={closeButtonRef}
            >
              Cerrar
            </button>
          </header>
          <div className="transaction-detail-body">
            {detailGroups.map((group) => (
              <section key={group.title} aria-labelledby={`detail-${group.title}`}>
                <h4 className="transaction-detail-section-title" id={`detail-${group.title}`}>
                  {group.title}
                </h4>
                <dl className="transaction-detail-grid">
                  {group.fields.map((field) => (
                    <div className="transaction-detail-field" key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
