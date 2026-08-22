import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardCategorySummary } from "../../domain/dashboard";
import { formatMoney, formatPercent } from "../formatters";
import { getChartColor } from "./dashboard-chart-utils";

export function ChartEmptyState({ children }: { children: string }) {
  return <p className="empty-state mt-5">{children}</p>;
}

export interface ChartScrollAreaProps {
  ariaLabel: string;
  children: ReactNode;
  hintNoun: string;
  minWidth: number;
}

export function ChartScrollArea({ ariaLabel, children, hintNoun, minWidth }: ChartScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setScrollable(el.scrollWidth > Math.ceil(el.clientWidth) + 1);
    };

    update();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="chart-scroll mt-5"
        role="region"
        aria-label={ariaLabel}
        tabIndex={scrollable ? 0 : undefined}
      >
        <div className="h-72 w-full sm:h-80" style={{ minWidth }}>
          {children}
        </div>
      </div>
      {scrollable ? (
        <p className="mt-3 text-xs text-slate-500 sm:hidden" aria-hidden="true">
          Desliza el gráfico horizontalmente para recorrer {hintNoun}.
        </p>
      ) : null}
    </>
  );
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
