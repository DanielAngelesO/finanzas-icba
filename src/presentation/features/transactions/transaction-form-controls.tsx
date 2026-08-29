import { useId } from "react";
import type { TransactionType } from "../../../domain/transaction";

export function TransactionTypeControl({
  value,
  onChange,
  error,
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
  error?: string | undefined;
}) {
  const id = useId();
  const options: Array<{ type: TransactionType; label: string }> = [
    { type: "INGRESO", label: "Ingreso" },
    { type: "EGRESO", label: "Egreso" },
    { type: "TRANSFERENCIA", label: "Transferencia" },
  ];
  return (
    <fieldset
      className="transaction-type-control"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend>Tipo de transacción</legend>
      <div>
        {options.map((option) => (
          <label key={option.type}>
            <input
              type="radio"
              name={`transaction-type-${id}`}
              value={option.type}
              checked={value === option.type}
              onChange={() => onChange(option.type)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="transaction-field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function LockedField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="transaction-locked-field">
      <span className="transaction-field-label-text">{label}</span>
      <span className="transaction-locked-value">
        <span>{value}</span>
        <span className="transaction-locked-tag">Fijo</span>
      </span>
      {hint ? <span className="transaction-locked-hint">{hint}</span> : null}
    </div>
  );
}

export function CurrencyInput({
  value,
  onChange,
  error,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  return (
    <label className="field-label" htmlFor={`${id}-amount`}>
      <span className="transaction-field-label-text">
        Monto <span aria-hidden="true">*</span>
      </span>
      <span className="transaction-currency-field">
        <span aria-hidden="true">S/</span>
        <input
          className="field"
          id={`${id}-amount`}
          ref={inputRef}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </span>
      {error ? (
        <span className="transaction-field-error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
