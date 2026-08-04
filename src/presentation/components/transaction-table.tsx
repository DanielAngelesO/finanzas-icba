import type { Transaction } from "../../domain/transaction";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0)
    return <p className="empty-state">No hay transacciones que mostrar.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {[
              "ID",
              "Fecha",
              "Tipo",
              "Cuenta",
              "Categoría",
              "Descripción",
              "Monto",
              "Estado",
              "Período",
            ].map((heading) => (
              <th className="whitespace-nowrap px-3 py-3 font-medium" scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {transactions.map((transaction) => (
            <tr className="bg-slate-950/40" key={transaction.id}>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{transaction.id}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {transaction.date.toLocaleDateString("es-PE")}
              </td>
              <td className="px-3 py-3">{transaction.type}</td>
              <td className="px-3 py-3">{transaction.account}</td>
              <td className="px-3 py-3">{transaction.category}</td>
              <td className="min-w-48 px-3 py-3">{transaction.description ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                {formatMoney(transaction.amount)}
              </td>
              <td className="px-3 py-3">{transaction.status}</td>
              <td className="px-3 py-3">{transaction.period}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
