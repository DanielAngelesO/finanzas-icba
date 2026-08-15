import { formatPeriod } from "../../formatters";
import { getCurrentLimaPeriod } from "./transaction-ui";

const shiftPeriod = (period: string, offset: number): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toMonthInput = (period: string): string => `${period.slice(0, 4)}-${period.slice(4, 6)}`;

export function PeriodNavigator({
  period,
  onChange,
}: {
  period: string | null;
  onChange: (period: string) => void;
}) {
  const visiblePeriod = period ?? getCurrentLimaPeriod();
  return (
    <div className="transaction-period-navigator" aria-label="Período visible">
      <button
        className="transaction-icon-button"
        type="button"
        onClick={() => onChange(shiftPeriod(visiblePeriod, -1))}
        aria-label={`Mostrar ${formatPeriod(shiftPeriod(visiblePeriod, -1))}`}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <label className="transaction-period-picker">
        <span>{period ? formatPeriod(period) : "Todos los períodos"}</span>
        <input
          type="month"
          value={toMonthInput(visiblePeriod)}
          onChange={(event) => {
            const value = event.target.value.replace("-", "");
            if (/^\d{6}$/.test(value)) onChange(value);
          }}
          aria-label="Seleccionar mes y año"
        />
      </label>
      <button
        className="transaction-icon-button"
        type="button"
        onClick={() => onChange(shiftPeriod(visiblePeriod, 1))}
        aria-label={`Mostrar ${formatPeriod(shiftPeriod(visiblePeriod, 1))}`}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
