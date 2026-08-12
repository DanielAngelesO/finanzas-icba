import { useId } from "react";
import type { DashboardIncomeScope } from "../../domain/dashboard";
import { incomeScopeDetails } from "../dashboard-income-presentation";

export function IncomeScopeSelector({
  scope,
  onChange,
  label,
}: {
  scope: DashboardIncomeScope;
  onChange: (scope: DashboardIncomeScope) => void;
  label: string;
}) {
  const name = "income-scope-" + useId();

  return (
    <fieldset className="income-scope-control">
      <legend className="sr-only">{label}</legend>
      <label className="income-scope-option">
        <input
          checked={scope === "CONTRIBUTIONS"}
          name={name}
          onChange={() => onChange("CONTRIBUTIONS")}
          type="radio"
          value="CONTRIBUTIONS"
        />
        <span>{incomeScopeDetails.CONTRIBUTIONS.label}</span>
      </label>
      <label className="income-scope-option">
        <input
          checked={scope === "ALL"}
          name={name}
          onChange={() => onChange("ALL")}
          type="radio"
          value="ALL"
        />
        <span>{incomeScopeDetails.ALL.label}</span>
      </label>
    </fieldset>
  );
}
