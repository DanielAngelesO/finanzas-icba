import { formatShortPeriod } from "../formatters";

const chartPalette = [
  "var(--ui-chart-1)",
  "var(--ui-chart-2)",
  "var(--ui-chart-3)",
  "var(--ui-chart-4)",
  "var(--ui-chart-5)",
  "var(--ui-chart-6)",
];

export const getChartColor = (index: number): string =>
  chartPalette[index % chartPalette.length] ?? "var(--ui-chart-1)";

export const tooltipStyle = {
  border: "1px solid var(--ui-border)",
  borderRadius: "0.75rem",
  background: "var(--ui-surface)",
  color: "var(--ui-text)",
};

export const formatChartPeriod = (value: string): string =>
  formatShortPeriod(value).replace(".", "");

export const formatChartDay = (value: string): string => value.slice(8);

const dailyDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatChartDate = (value: string): string =>
  dailyDateFormatter.format(new Date(value + "T12:00:00.000Z"));

export const formatCategoryAxis = (value: string): string =>
  value.length > 17 ? value.slice(0, 16) + "…" : value;
