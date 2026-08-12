import { useId, useRef, type ReactNode } from "react";

export type DashboardAnalysisTab = "CURRENT" | "ANNUAL";

const tabs = [
  { id: "CURRENT", label: "Período actual" },
  { id: "ANNUAL", label: "Últimos 12 meses" },
] as const satisfies readonly { id: DashboardAnalysisTab; label: string }[];

const getAdjacentTab = (
  activeTab: DashboardAnalysisTab,
  direction: "NEXT" | "PREVIOUS",
): DashboardAnalysisTab => {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const offset = direction === "NEXT" ? 1 : -1;
  const nextIndex = (activeIndex + offset + tabs.length) % tabs.length;
  return tabs[nextIndex]?.id ?? activeTab;
};

export function DashboardAnalysisTabs({
  activeTab,
  onChange,
  currentPanel,
  annualPanel,
}: {
  activeTab: DashboardAnalysisTab;
  onChange: (tab: DashboardAnalysisTab) => void;
  currentPanel: ReactNode;
  annualPanel: ReactNode;
}) {
  const baseId = useId();
  const tabRefs = useRef<Record<DashboardAnalysisTab, HTMLButtonElement | null>>({
    CURRENT: null,
    ANNUAL: null,
  });
  const selectTab = (tab: DashboardAnalysisTab, focus = false) => {
    onChange(tab);
    if (focus) tabRefs.current[tab]?.focus();
  };
  const currentTabId = baseId + "-current-tab";
  const annualTabId = baseId + "-annual-tab";
  const currentPanelId = baseId + "-current-panel";
  const annualPanelId = baseId + "-annual-panel";

  return (
    <div>
      <div
        className="dashboard-analysis-tablist"
        role="tablist"
        aria-label="Horizonte del análisis"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const tabId = tab.id === "CURRENT" ? currentTabId : annualTabId;
          const panelId = tab.id === "CURRENT" ? currentPanelId : annualPanelId;

          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className="dashboard-analysis-tab"
              id={tabId}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  selectTab(getAdjacentTab(tab.id, "NEXT"), true);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  selectTab(getAdjacentTab(tab.id, "PREVIOUS"), true);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  selectTab("CURRENT", true);
                } else if (event.key === "End") {
                  event.preventDefault();
                  selectTab("ANNUAL", true);
                }
              }}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={currentTabId}
        className="mt-5"
        hidden={activeTab !== "CURRENT"}
        id={currentPanelId}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "CURRENT" ? currentPanel : null}
      </div>
      <div
        aria-labelledby={annualTabId}
        className="mt-5"
        hidden={activeTab !== "ANNUAL"}
        id={annualPanelId}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "ANNUAL" ? annualPanel : null}
      </div>
    </div>
  );
}
