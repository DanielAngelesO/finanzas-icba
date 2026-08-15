import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CatalogSelection,
  type LogicalTransaction,
  type TransactionActor,
  type TransactionCatalogItem,
  type TransactionCatalogs,
  type TransactionDraft,
  type TransactionType,
} from "../../../domain/transaction";
import { CatalogPicker } from "./catalog-picker";
import { getTransactionMutationError } from "./transaction-errors";
import { CurrencyInput, TransactionTypeControl } from "./transaction-form-controls";
import {
  getDraftFinancialSummary,
  getLimaToday,
  getTransactionTypeLabel,
  toDateInputValue,
} from "./transaction-ui";

type EditorMode = "create" | "edit" | "duplicate" | "similar";

interface FormState {
  type: TransactionType;
  amount: string;
  date: string;
  account: CatalogSelection | null;
  originAccount: CatalogSelection | null;
  destinationAccount: CatalogSelection | null;
  category: CatalogSelection | null;
  subcategory: CatalogSelection | null;
  paymentMethod: CatalogSelection | null;
  thirdParty: CatalogSelection | null;
  description: string;
  referenceOrReceipt: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof FormState | "form", string>>;

const rememberedSelections = new Map<
  string,
  Pick<
    FormState,
    | "account"
    | "originAccount"
    | "destinationAccount"
    | "category"
    | "subcategory"
    | "paymentMethod"
  >
>();

const rememberedKey = (actor: TransactionActor, type: TransactionType) =>
  `${actor.email.trim().toLocaleLowerCase("es-PE")}:${type}`;

const activeFirst = <T extends TransactionCatalogItem>(items: T[]): T | undefined =>
  items.find((item) => item.active);

const selection = (
  options: Array<{ id: string; name: string }>,
  name: string | null | undefined,
): CatalogSelection | null => {
  if (!name) return null;
  const match = options.find((option) => option.name === name);
  return match ? { id: match.id, name: match.name } : { id: `historical-${name}`, name };
};

const getAllowedCategories = (catalogs: TransactionCatalogs, type: TransactionType) =>
  type === "TRANSFERENCIA"
    ? []
    : catalogs.categories.filter((category) => category.type === "AMBOS" || category.type === type);

const getDefaultState = (
  catalogs: TransactionCatalogs,
  initialType: TransactionType,
  transaction: LogicalTransaction | null,
  mode: EditorMode,
  actor: TransactionActor,
): FormState => {
  const date =
    transaction && mode !== "duplicate" ? toDateInputValue(transaction.date) : getLimaToday();
  if (transaction) {
    const clearsVariableData = mode === "similar";
    if (transaction.kind === "transfer") {
      return {
        type: transaction.type,
        amount: clearsVariableData ? "" : transaction.amount.toFixed(2),
        date,
        account: null,
        originAccount: selection(catalogs.accounts, transaction.originAccount),
        destinationAccount: selection(catalogs.accounts, transaction.destinationAccount),
        category: null,
        subcategory: null,
        paymentMethod: null,
        thirdParty: null,
        description: clearsVariableData ? "" : (transaction.description ?? ""),
        referenceOrReceipt: "",
        notes: clearsVariableData ? "" : (transaction.notes ?? ""),
      };
    }
    return {
      type: transaction.type,
      amount: clearsVariableData ? "" : transaction.amount.toFixed(2),
      date,
      account: selection(catalogs.accounts, transaction.account),
      originAccount: null,
      destinationAccount: null,
      category: selection(catalogs.categories, transaction.category),
      subcategory: selection(catalogs.subcategories, transaction.subcategory),
      paymentMethod: selection(catalogs.paymentMethods, transaction.paymentMethod),
      thirdParty: clearsVariableData
        ? null
        : selection(catalogs.thirdParties, transaction.donorOrProvider),
      description: clearsVariableData ? "" : (transaction.description ?? ""),
      referenceOrReceipt: clearsVariableData ? "" : (transaction.referenceOrReceipt ?? ""),
      notes: clearsVariableData ? "" : (transaction.notes ?? ""),
    };
  }

  const remembered = rememberedSelections.get(rememberedKey(actor, initialType));
  const categories = getAllowedCategories(catalogs, initialType);
  const defaultAccount = activeFirst(catalogs.accounts);
  const defaultCategory = activeFirst(categories);
  const defaultPayment = activeFirst(catalogs.paymentMethods);
  return {
    type: initialType,
    amount: "",
    date,
    account:
      remembered?.account ??
      (defaultAccount ? { id: defaultAccount.id, name: defaultAccount.name } : null),
    originAccount:
      remembered?.originAccount ??
      (defaultAccount ? { id: defaultAccount.id, name: defaultAccount.name } : null),
    destinationAccount: remembered?.destinationAccount ?? null,
    category:
      remembered?.category ??
      (defaultCategory ? { id: defaultCategory.id, name: defaultCategory.name } : null),
    subcategory: remembered?.subcategory ?? null,
    paymentMethod:
      remembered?.paymentMethod ??
      (defaultPayment ? { id: defaultPayment.id, name: defaultPayment.name } : null),
    thirdParty: null,
    description: "",
    referenceOrReceipt: "",
    notes: "",
  };
};

const parseAmount = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const trimOrNull = (value: string): string | null => value.trim() || null;

export function TransactionEditorSheet({
  open,
  mode,
  initialType,
  transaction,
  catalogs,
  actor,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: EditorMode;
  initialType: TransactionType;
  transaction: LogicalTransaction | null;
  catalogs: TransactionCatalogs;
  actor: TransactionActor;
  onClose: () => void;
  onSave: (draft: TransactionDraft) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const initialState = useMemo(
    () => getDefaultState(catalogs, initialType, transaction, mode, actor),
    [actor, catalogs, initialType, mode, transaction],
  );
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<TransactionDraft | null>(null);
  const financialChanges = useMemo(
    () => (transaction && pendingDraft ? getDraftFinancialSummary(transaction, pendingDraft) : []),
    [pendingDraft, transaction],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initialState);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => amountRef.current?.focus(), 0);
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = confirmationRef.current;
    if (!dialog) return;
    if (pendingDraft && financialChanges.length > 0 && !dialog.open) dialog.showModal();
    if (!pendingDraft && dialog.open) dialog.close();
  }, [financialChanges.length, pendingDraft]);

  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Quieres cerrar el editor?")) return;
    onClose();
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      delete next.form;
      return next;
    });
    setSaveError(null);
  };

  const changeType = (type: TransactionType) => {
    if (type === form.type) return;
    const crossesTransfer = type === "TRANSFERENCIA" || form.type === "TRANSFERENCIA";
    const categories = getAllowedCategories(catalogs, type);
    const categoryAllowed = categories.some((category) => category.id === form.category?.id);
    const partyAllowed = catalogs.thirdParties.some(
      (party) =>
        party.id === form.thirdParty?.id &&
        (party.role === "AMBOS" ||
          (type === "INGRESO" && party.role === "DONANTE") ||
          (type === "EGRESO" && party.role === "PROVEEDOR")),
    );
    const hasIncompatibleData = crossesTransfer
      ? Boolean(
          form.account ||
          form.originAccount ||
          form.destinationAccount ||
          form.category ||
          form.subcategory ||
          form.paymentMethod ||
          form.thirdParty ||
          form.referenceOrReceipt,
        )
      : Boolean(
          (form.category && !categoryAllowed) ||
          (form.thirdParty && !partyAllowed) ||
          (type === "INGRESO" && form.referenceOrReceipt),
        );
    if (
      hasIncompatibleData &&
      !window.confirm(
        "Al cambiar el tipo se limpiarán los datos que no son compatibles. ¿Continuar?",
      )
    ) {
      return;
    }
    const firstCategory = activeFirst(categories);
    setForm((current) => ({
      ...current,
      type,
      account:
        type === "TRANSFERENCIA"
          ? null
          : (current.account ??
            current.originAccount ??
            rememberedSelections.get(rememberedKey(actor, type))?.account ??
            null),
      originAccount: type === "TRANSFERENCIA" ? (current.originAccount ?? current.account) : null,
      destinationAccount: type === "TRANSFERENCIA" ? current.destinationAccount : null,
      category:
        type === "TRANSFERENCIA"
          ? null
          : categoryAllowed
            ? current.category
            : firstCategory
              ? { id: firstCategory.id, name: firstCategory.name }
              : null,
      subcategory: type === "TRANSFERENCIA" || !categoryAllowed ? null : current.subcategory,
      paymentMethod: type === "TRANSFERENCIA" ? null : current.paymentMethod,
      thirdParty: type === "TRANSFERENCIA" || !partyAllowed ? null : current.thirdParty,
      referenceOrReceipt: type === "EGRESO" ? current.referenceOrReceipt : "",
    }));
    setErrors({});
  };

  const validate = (): { errors: FormErrors; draft: TransactionDraft | null } => {
    const nextErrors: FormErrors = {};
    const amount = parseAmount(form.amount);
    if (amount === null)
      nextErrors.amount = "Ingresa un monto mayor que cero, con máximo dos decimales.";
    if (!form.date) nextErrors.date = "Selecciona una fecha.";
    else if (form.date > getLimaToday()) nextErrors.date = "La fecha no puede estar en el futuro.";
    const date = form.date ? new Date(`${form.date}T12:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) nextErrors.date = "Selecciona una fecha válida.";
    if (form.type === "TRANSFERENCIA") {
      if (!form.originAccount) nextErrors.originAccount = "Selecciona la cuenta de origen.";
      if (!form.destinationAccount)
        nextErrors.destinationAccount = "Selecciona la cuenta de destino.";
      if (form.originAccount?.id === form.destinationAccount?.id) {
        nextErrors.destinationAccount =
          "La cuenta de destino debe ser distinta de la cuenta de origen.";
      }
    } else {
      if (!form.account) nextErrors.account = "Selecciona una cuenta.";
      if (!form.category) nextErrors.category = "Selecciona una categoría.";
      if (!form.paymentMethod) nextErrors.paymentMethod = "Selecciona un método de pago.";
    }
    if (Object.keys(nextErrors).length > 0 || amount === null || !date) {
      return { errors: nextErrors, draft: null };
    }
    const common = {
      amount,
      date,
      description: trimOrNull(form.description),
      notes: trimOrNull(form.notes),
      responsible: actor.displayName?.trim() || actor.email,
    };
    if (form.type === "TRANSFERENCIA") {
      if (!form.originAccount || !form.destinationAccount)
        return { errors: nextErrors, draft: null };
      return {
        errors: nextErrors,
        draft: {
          ...common,
          type: "TRANSFERENCIA",
          originAccount: form.originAccount,
          destinationAccount: form.destinationAccount,
        },
      };
    }
    if (!form.account || !form.category || !form.paymentMethod) {
      return { errors: nextErrors, draft: null };
    }
    return {
      errors: nextErrors,
      draft: {
        ...common,
        type: form.type,
        account: form.account,
        category: form.category,
        subcategory: form.subcategory,
        paymentMethod: form.paymentMethod,
        thirdParty: form.thirdParty,
        referenceOrReceipt: form.type === "EGRESO" ? trimOrNull(form.referenceOrReceipt) : null,
      },
    };
  };

  const focusFirstError = () => {
    window.setTimeout(() => {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    }, 0);
  };

  const remember = () => {
    rememberedSelections.set(rememberedKey(actor, form.type), {
      account: form.account,
      originAccount: form.originAccount,
      destinationAccount: form.destinationAccount,
      category: form.category,
      subcategory: form.subcategory,
      paymentMethod: form.paymentMethod,
    });
  };

  const saveDraft = async (draft: TransactionDraft) => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      remember();
    } catch (error: unknown) {
      setSaveError(
        getTransactionMutationError(error, "No se pudo guardar. Tus datos siguen aquí."),
      );
    } finally {
      setSaving(false);
      setPendingDraft(null);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validate();
    setErrors(result.errors);
    if (!result.draft) {
      focusFirstError();
      return;
    }
    const changes = transaction ? getDraftFinancialSummary(transaction, result.draft) : [];
    if (mode === "edit" && changes.length > 0) {
      setPendingDraft(result.draft);
      return;
    }
    void saveDraft(result.draft);
  };

  const allowedCategories = getAllowedCategories(catalogs, form.type);
  const subcategories = catalogs.subcategories.filter(
    (subcategory) => subcategory.categoryId === form.category?.id,
  );
  const thirdParties = catalogs.thirdParties.filter(
    (party) =>
      party.role === "AMBOS" ||
      (form.type === "INGRESO" && party.role === "DONANTE") ||
      (form.type === "EGRESO" && party.role === "PROVEEDOR"),
  );
  const title =
    mode === "edit"
      ? `Editar ${getTransactionTypeLabel(form.type).toLocaleLowerCase("es-PE")}`
      : mode === "duplicate"
        ? `Duplicar ${getTransactionTypeLabel(form.type).toLocaleLowerCase("es-PE")}`
        : form.type === "TRANSFERENCIA"
          ? "Nueva transferencia"
          : `Nuevo ${getTransactionTypeLabel(form.type).toLocaleLowerCase("es-PE")}`;

  return (
    <>
      <dialog
        className="transaction-editor-dialog"
        ref={dialogRef}
        aria-labelledby="transaction-editor-title"
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
      >
        <form className="transaction-editor-content" ref={formRef} onSubmit={submit} noValidate>
          <header className="transaction-sheet-header">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Transacción
              </p>
              <h2
                className="mt-1 text-lg font-semibold text-slate-100"
                id="transaction-editor-title"
              >
                {title}
              </h2>
            </div>
            <button
              className="transaction-icon-button"
              type="button"
              onClick={requestClose}
              disabled={saving}
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Cerrar editor</span>
            </button>
          </header>

          <div className="transaction-editor-body">
            {Object.keys(errors).length > 0 ? (
              <div className="transaction-validation-summary" role="alert" tabIndex={-1}>
                <p>Revisa los campos indicados antes de guardar.</p>
              </div>
            ) : null}
            {saveError ? (
              <div className="alert-error" role="alert">
                {saveError}
              </div>
            ) : null}

            <TransactionTypeControl value={form.type} onChange={changeType} />

            <div className="transaction-form-grid transaction-form-grid-primary">
              <CurrencyInput
                value={form.amount}
                onChange={(value) => setField("amount", value)}
                onBlur={() => {
                  if (parseAmount(form.amount) === null) {
                    setErrors((current) => ({
                      ...current,
                      amount: "Ingresa un monto mayor que cero, con máximo dos decimales.",
                    }));
                  }
                }}
                error={errors.amount}
                inputRef={amountRef}
              />
              <label className="field-label">
                Fecha <span aria-hidden="true">*</span>
                <input
                  className="field"
                  type="date"
                  value={form.date}
                  max={getLimaToday()}
                  onChange={(event) => setField("date", event.target.value)}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={errors.date ? "transaction-date-error" : undefined}
                />
                {errors.date ? (
                  <span className="transaction-field-error" id="transaction-date-error">
                    {errors.date}
                  </span>
                ) : null}
              </label>
            </div>

            {form.type === "TRANSFERENCIA" ? (
              <div className="transaction-dynamic-fields">
                <CatalogPicker
                  label="Desde"
                  value={form.originAccount}
                  options={catalogs.accounts}
                  onChange={(value) => setField("originAccount", value)}
                  required
                  error={errors.originAccount}
                />
                <button
                  className="button-secondary transaction-swap-button"
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      originAccount: current.destinationAccount,
                      destinationAccount: current.originAccount,
                    }))
                  }
                >
                  <span aria-hidden="true">⇅</span> Intercambiar cuentas
                </button>
                <CatalogPicker
                  label="Hacia"
                  value={form.destinationAccount}
                  options={catalogs.accounts}
                  onChange={(value) => setField("destinationAccount", value)}
                  required
                  error={errors.destinationAccount}
                />
              </div>
            ) : (
              <div className="transaction-dynamic-fields">
                <CatalogPicker
                  label="Cuenta"
                  value={form.account}
                  options={catalogs.accounts}
                  onChange={(value) => setField("account", value)}
                  required
                  error={errors.account}
                />
                <CatalogPicker
                  label="Categoría"
                  value={form.category}
                  options={allowedCategories}
                  onChange={(value) => {
                    setField("category", value);
                    setField("subcategory", null);
                  }}
                  required
                  error={errors.category}
                />
                {subcategories.length > 0 || form.subcategory ? (
                  <div className="transaction-dynamic-field-enter">
                    <CatalogPicker
                      label="Subcategoría"
                      value={form.subcategory}
                      options={subcategories}
                      onChange={(value) => setField("subcategory", value)}
                      allowClear
                    />
                  </div>
                ) : null}
                <CatalogPicker
                  label="Método de pago"
                  value={form.paymentMethod}
                  options={catalogs.paymentMethods}
                  onChange={(value) => setField("paymentMethod", value)}
                  required
                  error={errors.paymentMethod}
                />
                <CatalogPicker
                  label={form.type === "INGRESO" ? "Donante" : "Proveedor"}
                  value={form.thirdParty}
                  options={thirdParties}
                  onChange={(value) => setField("thirdParty", value)}
                  allowClear
                  allowCreate
                />
              </div>
            )}

            <div className="transaction-form-grid">
              <label className="field-label">
                Descripción
                <input
                  className="field"
                  value={form.description}
                  onChange={(event) => setField("description", event.target.value)}
                  placeholder={
                    form.type === "TRANSFERENCIA"
                      ? "Ej. Reposición de caja chica"
                      : form.type === "INGRESO"
                        ? "Ej. Ofrenda dominical"
                        : "Ej. Compra de materiales"
                  }
                />
              </label>
              {form.type === "EGRESO" ? (
                <label className="field-label transaction-dynamic-field-enter">
                  Comprobante
                  <input
                    className="field"
                    value={form.referenceOrReceipt}
                    onChange={(event) => setField("referenceOrReceipt", event.target.value)}
                    placeholder="Ej. F001-482"
                  />
                </label>
              ) : null}
            </div>

            <details className="transaction-more-details">
              <summary>Más detalles</summary>
              <label className="field-label mt-4">
                Notas
                <textarea
                  className="field min-h-24 resize-y"
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  placeholder="Información adicional opcional"
                />
              </label>
            </details>
          </div>

          <footer className="transaction-editor-footer">
            <p className="sr-only" role="status" aria-live="polite">
              {saving ? "Guardando transacción" : ""}
            </p>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving
                ? "Guardando…"
                : mode === "edit"
                  ? `Guardar ${getTransactionTypeLabel(form.type).toLocaleLowerCase("es-PE")}`
                  : `Guardar ${form.type === "TRANSFERENCIA" ? "transferencia" : getTransactionTypeLabel(form.type).toLocaleLowerCase("es-PE")}`}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        className="transaction-alert-dialog"
        ref={confirmationRef}
        role="alertdialog"
        aria-labelledby="financial-change-title"
        aria-describedby="financial-change-description"
        onCancel={(event) => {
          event.preventDefault();
          setPendingDraft(null);
        }}
      >
        <div className="transaction-alert-content">
          <h2 className="section-title" id="financial-change-title">
            Confirma los cambios financieros
          </h2>
          <p className="mt-2 text-sm text-slate-400" id="financial-change-description">
            Revisa los valores antes de actualizar la transacción.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {financialChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
          {transaction && pendingDraft && transaction.type !== pendingDraft.type ? (
            <p className="alert-warning mt-4">
              El cambio de tipo anulará la operación original y creará una corrección enlazada.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              className="button-secondary"
              type="button"
              onClick={() => setPendingDraft(null)}
            >
              Volver a revisar
            </button>
            <button
              className="button-primary"
              type="button"
              onClick={() => {
                if (pendingDraft) void saveDraft(pendingDraft);
              }}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Confirmar y guardar"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
