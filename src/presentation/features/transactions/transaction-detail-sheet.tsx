import { useEffect, useRef, useState } from "react";
import { getTransactionStatusLabel, type LogicalTransaction } from "../../../domain/transaction";
import { formatDate, formatMoney, formatPeriod } from "../../formatters";
import {
  getAmountClass,
  getAmountPrefix,
  getTransactionConcept,
  getTransactionTypeClass,
  getTransactionTypeIcon,
  getTransactionTypeLabel,
} from "./transaction-ui";
import { getTransactionMutationError } from "./transaction-errors";

const optional = (value: string | null): string => value ?? "Sin información";

const getTransactionPaymentMethod = (transaction: LogicalTransaction): string =>
  transaction.kind === "transfer" ? "Transferencia" : transaction.paymentMethod;

interface TransactionDetailRow {
  label: string;
  value: string;
  status?: boolean;
}

const getStatusIcon = (status: LogicalTransaction["status"]): string => {
  if (status === "CONFIRMED") return "✅";
  if (status === "PENDING") return "⏳";
  return "⛔";
};

const getTransactionDetailRows = (transaction: LogicalTransaction): TransactionDetailRow[] => {
  const rows: TransactionDetailRow[] = [];

  if (transaction.kind === "single") {
    rows.push(
      { label: "Cuenta", value: transaction.account },
      {
        label: "Categoría",
        value: [transaction.category, transaction.subcategory].filter(Boolean).join(" › "),
      },
      {
        label: transaction.type === "INGRESO" ? "Donante" : "Proveedor",
        value: optional(transaction.donorOrProvider),
      },
    );
  } else {
    rows.push(
      { label: "Desde", value: transaction.originAccount },
      { label: "Hacia", value: transaction.destinationAccount },
    );
  }

  rows.push(
    { label: "Descripción", value: optional(transaction.description) },
    { label: "Estado", value: getTransactionStatusLabel(transaction.status), status: true },
    { label: "Fecha", value: formatDate(transaction.date) },
    { label: "Responsable", value: transaction.responsible },
  );

  if (transaction.kind === "single") {
    rows.push({ label: "Comprobante", value: optional(transaction.referenceOrReceipt) });
  }

  return rows;
};

function VoidTransactionDialog({
  transaction,
  open,
  onClose,
  onConfirm,
}: {
  transaction: LogicalTransaction;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    if (saving) return;
    setReason("");
    setError(null);
    onClose();
  };
  const confirm = async () => {
    if (!reason.trim()) {
      setError("Escribe el motivo de la anulación.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (mutationError: unknown) {
      setError(
        getTransactionMutationError(
          mutationError,
          "No se pudo anular. Inténtalo nuevamente sin cerrar este diálogo.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      className="transaction-alert-dialog"
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="void-transaction-title"
      aria-describedby="void-transaction-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="transaction-alert-content">
        <p className="text-sm font-semibold text-rose-300">Acción auditada</p>
        <h2 className="section-title mt-1" id="void-transaction-title">
          Anular transacción
        </h2>
        <p className="mt-3 text-sm text-slate-400" id="void-transaction-description">
          Permanecerá en el historial y dejará de considerarse en los cálculos.
          {transaction.kind === "transfer" ? " Se anularán la salida y la entrada vinculadas." : ""}
        </p>
        <label className="field-label mt-5">
          Motivo <span aria-hidden="true">*</span>
          <textarea
            className="field min-h-28 resize-y"
            ref={inputRef}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "void-reason-error" : undefined}
            placeholder="Explica por qué se anula esta transacción"
          />
        </label>
        {error ? (
          <p className="transaction-field-error" id="void-reason-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="button-secondary" type="button" onClick={close} disabled={saving}>
            Cancelar
          </button>
          <button
            className="button-danger"
            type="button"
            onClick={() => void confirm()}
            disabled={saving}
          >
            {saving ? "Anulando…" : "Anular transacción"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function TransactionDetailSheet({
  open,
  transaction,
  onClose,
  onEdit,
  onDuplicate,
  onVoid,
  writable,
  writeReason,
}: {
  open: boolean;
  transaction: LogicalTransaction | null;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onVoid: (reason: string) => Promise<void>;
  writable: boolean;
  writeReason: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && transaction && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => closeRef.current?.focus(), 0);
    } else if ((!open || !transaction) && dialog.open) dialog.close();
  }, [open, transaction]);

  if (!transaction) return null;
  const concept = getTransactionConcept(transaction);

  return (
    <>
      <dialog
        className="transaction-detail-dialog"
        ref={dialogRef}
        aria-labelledby="transaction-detail-title"
        aria-describedby="transaction-detail-context"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          onClose();
        }}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="transaction-detail-content transaction-movements-detail-content">
          <header className="transaction-sheet-header">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-100" id="transaction-detail-title">
                Detalle de transacción
              </h2>
              <p className="sr-only" id="transaction-detail-context">
                {concept}
              </p>
            </div>
            <button
              className="transaction-icon-button"
              type="button"
              onClick={onClose}
              ref={closeRef}
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Cerrar detalle</span>
            </button>
          </header>

          <div className="transaction-detail-body">
            <section className="transaction-detail-hero" aria-label="Resumen de la transacción">
              <span
                className={`transaction-detail-type-badge ${getTransactionTypeClass(transaction.type)}`}
              >
                <span aria-hidden="true">{getTransactionTypeIcon(transaction.type)}</span>
                {getTransactionTypeLabel(transaction.type)}
              </span>
              <p className={`transaction-detail-amount ${getAmountClass(transaction)}`}>
                {getAmountPrefix(transaction)}
                {formatMoney(transaction.amount)}
              </p>
              <p className="transaction-detail-summary">
                <span>{formatDate(transaction.date)}</span>
                <span aria-hidden="true"> · </span>
                <span>{getTransactionPaymentMethod(transaction)}</span>
              </p>
            </section>

            <section aria-label="Datos de la transacción">
              <dl className="transaction-detail-list">
                {getTransactionDetailRows(transaction).map((row) => (
                  <div className="transaction-detail-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.status ? (
                        <span
                          className={`transaction-detail-status transaction-status-${transaction.status.toLocaleLowerCase()}`}
                        >
                          <span aria-hidden="true">{getStatusIcon(transaction.status)}</span>
                          {row.value}
                        </span>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {transaction.notes ? (
              <details className="transaction-more-details">
                <summary>Notas</summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                  {transaction.notes}
                </p>
              </details>
            ) : null}

            <details className="transaction-more-details">
              <summary>Información del sistema</summary>
              <dl className="transaction-system-grid">
                <div>
                  <dt>Id Transacción</dt>
                  <dd>{transaction.transactionId}</dd>
                </div>
                <div>
                  <dt>IDs físicos</dt>
                  <dd>{transaction.rowIds.join(", ")}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>{formatPeriod(transaction.period)}</dd>
                </div>
                <div>
                  <dt>Versión</dt>
                  <dd>{transaction.version}</dd>
                </div>
                <div>
                  <dt>Creado por</dt>
                  <dd>{optional(transaction.audit.createdBy)}</dd>
                </div>
                <div>
                  <dt>Actualizado por</dt>
                  <dd>{optional(transaction.audit.updatedBy)}</dd>
                </div>
                {transaction.audit.voidReason ? (
                  <div>
                    <dt>Motivo de anulación</dt>
                    <dd>{transaction.audit.voidReason}</dd>
                  </div>
                ) : null}
                {transaction.audit.correctsTransactionId ? (
                  <div>
                    <dt>Corrige a</dt>
                    <dd>{transaction.audit.correctsTransactionId}</dd>
                  </div>
                ) : null}
              </dl>
            </details>

            <div className="transaction-detail-actions" aria-label="Acciones de la transacción">
              {transaction.status !== "VOIDED" ? (
                <button
                  className="button-primary"
                  type="button"
                  onClick={onEdit}
                  disabled={!writable}
                  title={writeReason ?? undefined}
                >
                  Editar
                </button>
              ) : null}
              <button
                className="button-secondary"
                type="button"
                onClick={onDuplicate}
                disabled={!writable}
                title={writeReason ?? undefined}
              >
                Duplicar
              </button>
              {transaction.status !== "VOIDED" ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setVoidOpen(true)}
                  disabled={!writable}
                  title={writeReason ?? undefined}
                >
                  Anular
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </dialog>
      <VoidTransactionDialog
        transaction={transaction}
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={onVoid}
      />
    </>
  );
}
