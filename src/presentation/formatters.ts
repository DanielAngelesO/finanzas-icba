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

export const formatMoney = (amount: number): string => currencyFormatter.format(amount);

export const formatPeriod = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return periodFormatter.format(new Date(year, month - 1, 1, 12));
};

export const formatCompactDate = (date: Date): string => compactDateFormatter.format(date);

export const formatDate = (date: Date): string => dateFormatter.format(date);
