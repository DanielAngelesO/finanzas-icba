import type { MonthlyBalanceEntry, MonthlyBalanceGroup } from "../../../domain/monthly-balance";
import { formatAmount, formatLedgerDate, formatMoney, formatPreviewDate } from "../../formatters";

type BalanceListTone = "income" | "expense";

/** Qué se muestra entre la fecha y el importe. */
type BalanceListField = "origin" | "detail" | "none";

const fieldLabels: Record<Exclude<BalanceListField, "none">, string> = {
  origin: "Origen",
  detail: "Detalle",
};

const readField = (entry: MonthlyBalanceEntry, field: BalanceListField): string => {
  if (field === "origin") return entry.counterparty ?? entry.account ?? "—";
  return entry.description ?? entry.subcategory ?? entry.category;
};

export function MonthlyBalanceList({
  title,
  group,
  tone,
  field,
  dateFormat = "short",
}: {
  title: string;
  group: MonthlyBalanceGroup;
  tone: BalanceListTone;
  field: BalanceListField;
  dateFormat?: "short" | "weekday";
}) {
  const headingId = `balance-list-${title.toLocaleLowerCase("es-PE").replace(/\s+/g, "-")}`;

  return (
    <details className="ledger-block" data-tone={tone} open>
      <summary className="ledger-block-head">
        <span className="ledger-block-title" id={headingId}>
          {title}
        </span>
        <span className="ledger-block-total">{formatMoney(group.total)}</span>
      </summary>

      <div className="ledger-block-body">
        {group.entries.length === 0 ? (
          <p className="ledger-empty">Sin movimientos</p>
        ) : (
          <table className="ledger-table" aria-labelledby={headingId}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                {field === "none" ? null : <th scope="col">{fieldLabels[field]}</th>}
                <th className="ledger-amount" scope="col">
                  S/
                </th>
              </tr>
            </thead>
            <tbody>
              {group.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="ledger-date">
                    {dateFormat === "weekday"
                      ? formatPreviewDate(entry.date)
                      : formatLedgerDate(entry.date)}
                  </td>
                  {field === "none" ? null : (
                    <td className="ledger-text" title={readField(entry, field)}>
                      {readField(entry, field)}
                    </td>
                  )}
                  <td className="ledger-amount">{formatAmount(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
