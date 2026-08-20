import type { DashboardIncomeScope } from "../../domain/dashboard";

function ContributionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path
        d="M10 2.75v14.5M13 5.5c-.72-.58-1.72-.9-3-.9-2.13 0-3.5 1.04-3.5 2.55 0 1.65 1.37 2.3 3.56 2.8 2.19.5 3.44 1.18 3.44 2.8 0 1.53-1.32 2.65-3.5 2.65-1.42 0-2.62-.39-3.5-1.16"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IncomeScopeToggle({
  scope,
  onChange,
  label,
}: {
  scope: DashboardIncomeScope;
  onChange: (scope: DashboardIncomeScope) => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={scope === "CONTRIBUTIONS"}
      className="scope-toggle"
      onClick={() => onChange(scope === "CONTRIBUTIONS" ? "ALL" : "CONTRIBUTIONS")}
      title="Mostrar solo diezmos y ofrendas"
      type="button"
    >
      <ContributionsIcon />
      <span>Solo aportes</span>
    </button>
  );
}
