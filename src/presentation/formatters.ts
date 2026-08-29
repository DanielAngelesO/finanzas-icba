const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

const periodFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
});

const compactDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const previewWeekdayFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  timeZone: "America/Lima",
});

const previewDayFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  timeZone: "America/Lima",
});

const previewMonthFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "numeric",
  timeZone: "America/Lima",
});

const ledgerDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Lima",
});

const plainAmountFormatter = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("es-PE", {
  style: "percent",
  maximumFractionDigits: 1,
});

const compactCurrencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatMoney = (amount: number): string => currencyFormatter.format(amount);

export const formatCompactMoney = (amount: number): string =>
  compactCurrencyFormatter.format(amount);

export const formatPercent = (rate: number): string => percentFormatter.format(rate);

export const formatPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return periodFormatter.format(new Date(year, month - 1, 1, 12));
};

export const formatShortPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return new Intl.DateTimeFormat("es-PE", { month: "short" }).format(
    new Date(year, month - 1, 1, 12),
  );
};

export const formatCompactDate = (date: Date): string => compactDateFormatter.format(date);

/** Fecha corta de libro contable: "23/08". */
export const formatLedgerDate = (date: Date): string => ledgerDateFormatter.format(date);

/** Importe sin símbolo, para columnas encabezadas con "S/". */
export const formatAmount = (amount: number): string => plainAmountFormatter.format(amount);

export const formatDate = (date: Date): string => dateFormatter.format(date);

export const formatPreviewDate = (date: Date): string => {
  const weekday = previewWeekdayFormatter.format(date);
  const capitalizedWeekday = weekday.charAt(0).toLocaleUpperCase("es-PE") + weekday.slice(1);
  const day = previewDayFormatter.format(date).padStart(2, "0");
  const month = previewMonthFormatter.format(date).padStart(2, "0");
  return `${capitalizedWeekday} ${day}/${month}`;
};
