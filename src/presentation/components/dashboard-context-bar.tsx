import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardIncomeScope } from "../../domain/dashboard";
import { formatPeriod } from "../formatters";
import { IncomeScopeToggle } from "./dashboard-income-scope-toggle";

const MOBILE_HEADER_OFFSET_PX = 56;

function PeriodSelect({
  ariaLabel,
  availablePeriods,
  className,
  onPeriodChange,
  selectedPeriod,
}: {
  ariaLabel?: string;
  availablePeriods: string[];
  className: string;
  onPeriodChange: (period: string) => void;
  selectedPeriod: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={className}
      value={selectedPeriod}
      onChange={(event) => onPeriodChange(event.target.value)}
    >
      {availablePeriods.map((period) => (
        <option key={period} value={period}>
          {formatPeriod(period)}
        </option>
      ))}
    </select>
  );
}

export function DashboardContextBar({
  availablePeriods,
  onPeriodChange,
  onScopeChange,
  scope,
  selectedPeriod,
  updating,
}: {
  availablePeriods: string[];
  onPeriodChange: (period: string) => void;
  onScopeChange: (scope: DashboardIncomeScope) => void;
  scope: DashboardIncomeScope;
  selectedPeriod: string;
  updating: boolean;
}) {
  const barRef = useRef<HTMLElement | null>(null);
  const [isFloating, setIsFloating] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        setIsFloating(
          !entry.isIntersecting && entry.boundingClientRect.top < MOBILE_HEADER_OFFSET_PX,
        );
      },
      { rootMargin: `-${MOBILE_HEADER_OFFSET_PX}px 0px 0px 0px` },
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section
        aria-busy={updating}
        aria-label="Filtros del resumen"
        className="dashboard-toolbar"
        ref={barRef}
      >
        <div className="dashboard-toolbar-controls">
          <label className="period-control">
            <span>Período</span>
            <PeriodSelect
              availablePeriods={availablePeriods}
              className="field"
              onPeriodChange={onPeriodChange}
              selectedPeriod={selectedPeriod}
            />
          </label>
          <IncomeScopeToggle
            label="Filtrar por solo aportes: diezmos y ofrendas"
            onChange={onScopeChange}
            scope={scope}
          />
        </div>
      </section>
      {updating ? (
        <p className="home-updating" role="status" aria-live="polite">
          Actualizando…
        </p>
      ) : null}
      {isFloating
        ? createPortal(
            <section aria-label="Alcance del resumen" className="dashboard-floating-bar">
              <IncomeScopeToggle
                label="Filtrar por solo aportes: diezmos y ofrendas"
                onChange={onScopeChange}
                scope={scope}
                variant="compact"
              />
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
