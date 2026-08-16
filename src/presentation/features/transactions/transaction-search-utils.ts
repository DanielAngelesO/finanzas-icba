import type { TransactionType } from "../../../domain/transaction";

export const transactionSearchTypeOptions: Array<{
  value: TransactionType | null;
  label: string;
}> = [
  { value: null, label: "Todos" },
  { value: "INGRESO", label: "Ingresos" },
  { value: "EGRESO", label: "Egresos" },
  { value: "TRANSFERENCIA", label: "Transf." },
];

export const formatSearchResultCount = (count: number): string =>
  count === 1 ? "1 resultado" : `${count.toLocaleString("es-PE")} resultados`;
