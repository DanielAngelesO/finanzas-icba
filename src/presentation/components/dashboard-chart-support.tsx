import type { DashboardCategorySummary } from "../../domain/dashboard";
import { formatMoney, formatPercent } from "../formatters";
import { getChartColor } from "./dashboard-chart-utils";

export function ChartEmptyState({ children }: { children: string }) {
  return <p className="empty-state mt-5">{children}</p>;
}

export function CategoryList({
  categories,
  className = "mt-5",
}: {
  categories: DashboardCategorySummary[];
  className?: string;
}) {
  return (
    <ol className={className + " space-y-3"}>
      {categories.map((category, index) => (
        <li className="flex items-start gap-3" key={category.category}>
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: getChartColor(index) }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-sm text-slate-200">{category.category}</span>
          <span className="shrink-0 text-right text-sm tabular-nums text-slate-300">
            {formatMoney(category.amount)}
            <span className="ml-2 text-xs text-slate-500">{formatPercent(category.share)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
