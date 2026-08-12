import type { DashboardIncomeGroup, DashboardIncomeScope } from "../domain/dashboard";

export const incomeScopeDetails = {
  CONTRIBUTIONS: {
    label: "Solo diezmos + ofrendas",
    compactLabel: "Diezmos + ofrendas",
    cardLabel: "Aportes",
    description: "Excluye otros ingresos y conserva todos los egresos.",
  },
  ALL: {
    label: "Total con otros ingresos",
    compactLabel: "Ingresos totales",
    cardLabel: "Ingresos totales",
    description: "Incluye diezmos, ofrendas y otros ingresos.",
  },
} satisfies Record<
  DashboardIncomeScope,
  { label: string; compactLabel: string; cardLabel: string; description: string }
>;

export const incomeGroupDetails = {
  DIEZMOS: {
    label: "Diezmos",
    color: "var(--ui-chart-2)",
  },
  OFRENDAS: {
    label: "Ofrendas",
    color: "var(--ui-chart-3)",
  },
  OTROS: {
    label: "Otros ingresos",
    color: "var(--ui-chart-4)",
  },
} satisfies Record<DashboardIncomeGroup, { label: string; color: string }>;

export const getIncomeScopeLabel = (scope: DashboardIncomeScope): string =>
  incomeScopeDetails[scope].label;
