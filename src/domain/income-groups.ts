import type { DashboardIncomeGroup } from "./dashboard";
import type { Transaction } from "./transaction";

const incomeGroupAliases = {
  OFRENDAS: new Set(["ofrenda", "ofrendas"]),
  DIEZMOS: new Set(["diezmo", "diezmos"]),
} as const;

export const normalizeCategory = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " y ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-PE");

export const getIncomeGroup = (
  transaction: Pick<Transaction, "type" | "category" | "subcategory">,
): DashboardIncomeGroup | null => {
  if (transaction.type !== "INGRESO") return null;

  const normalizedValues = [transaction.category, transaction.subcategory]
    .filter((value): value is string => value !== null)
    .map(normalizeCategory);

  if (normalizedValues.some((value) => incomeGroupAliases.OFRENDAS.has(value))) {
    return "OFRENDAS";
  }

  return normalizedValues.some((value) => incomeGroupAliases.DIEZMOS.has(value))
    ? "DIEZMOS"
    : "OTROS";
};
