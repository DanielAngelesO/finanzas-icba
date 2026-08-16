import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CatalogSelection, TransactionCatalogItem } from "../../../domain/transaction";

interface CatalogPickerProps {
  label: string;
  value: CatalogSelection | null;
  options: Array<Pick<TransactionCatalogItem, "id" | "name" | "active">>;
  onChange: (value: CatalogSelection | null) => void;
  required?: boolean;
  allowClear?: boolean;
  allowCreate?: boolean;
  error?: string | undefined;
}

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .trim();

export function CatalogPicker({
  label,
  value,
  options,
  onChange,
  required = false,
  allowClear = false,
  allowCreate = false,
  error,
}: CatalogPickerProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const query = normalize(search);
    return options.filter(
      (option) =>
        (option.active || option.id === value?.id) && normalize(option.name).includes(query),
    );
  }, [options, search, value?.id]);

  const currentOption = options.find((option) => option.id === value?.id);
  const currentInactive = currentOption ? !currentOption.active : false;
  const exactMatch = options.some((option) => normalize(option.name) === normalize(search));
  const close = () => {
    setOpen(false);
    setSearch("");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const choose = (selection: CatalogSelection | null) => {
    onChange(selection);
    close();
  };

  return (
    <div className="transaction-catalog-field">
      <label className="field-label" id={`${id}-label`}>
        <span className="transaction-field-label-text">
          {label}
          {required ? <span aria-hidden="true">*</span> : null}
        </span>
      </label>
      <button
        className="field transaction-catalog-trigger"
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <span id={`${id}-value`} className={value ? "" : "transaction-placeholder"}>
          {value?.name ?? "Seleccionar…"}
          {currentInactive ? " · Inactivo" : ""}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {error ? (
        <p className="transaction-field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      <dialog
        className="transaction-catalog-dialog"
        ref={dialogRef}
        aria-labelledby={`${id}-dialog-title`}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="transaction-catalog-content">
          <header className="transaction-sheet-header">
            <div>
              <h3 className="section-title" id={`${id}-dialog-title`}>
                {label}
              </h3>
              <p className="mt-1 text-sm text-slate-400">Busca y elige una opción.</p>
            </div>
            <button className="transaction-icon-button" type="button" onClick={close}>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Cerrar selector de {label.toLocaleLowerCase("es-PE")}</span>
            </button>
          </header>
          <div className="transaction-catalog-body">
            <label className="field-label">
              Buscar {label.toLocaleLowerCase("es-PE")}
              <input
                className="field"
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Escribe para filtrar"
              />
            </label>
            <ul className="transaction-catalog-options" aria-label={`Opciones de ${label}`}>
              {allowClear ? (
                <li>
                  <button type="button" onClick={() => choose(null)}>
                    Sin especificar
                  </button>
                </li>
              ) : null}
              {filteredOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => choose({ id: option.id, name: option.name })}
                    aria-current={option.id === value?.id ? "true" : undefined}
                  >
                    <span>{option.name}</span>
                    {!option.active ? (
                      <span className="transaction-inactive-label">Inactivo</span>
                    ) : null}
                    {option.id === value?.id ? <span aria-hidden="true">✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            {filteredOptions.length === 0 ? (
              <p className="empty-state py-5">No hay coincidencias.</p>
            ) : null}
            {allowCreate && search.trim() && !exactMatch ? (
              <button
                className="button-secondary mt-4 w-full"
                type="button"
                onClick={() =>
                  choose({
                    id: `new-${normalize(search).replace(/\s+/g, "-")}`,
                    name: search.trim(),
                  })
                }
              >
                Crear “{search.trim()}”
              </button>
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
