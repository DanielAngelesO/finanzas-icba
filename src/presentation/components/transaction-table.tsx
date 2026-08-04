import type { Transaction } from "../../domain/transaction";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0)
    return <p className="empty-state">No hay transacciones que mostrar.</p>;
  return (
    <div className="data-table-wrapper animate-fade-in">
      <table className="data-table">
        <thead>
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
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="whitespace-nowrap font-mono text-xs text-slate-400">
                {transaction.id}
              </td>
              <td className="whitespace-nowrap">
                {transaction.date.toLocaleDateString("es-PE")}
              </td>
              <td>
                <span className={transaction.type === "INGRESO" ? "type-ingreso" : "type-egreso"}>
                  {transaction.type === "INGRESO" ? "↑" : "↓"} {transaction.type}
                </span>
              </td>
              <td>{transaction.account}</td>
              <td>{transaction.category}</td>
              <td className="min-w-48">{transaction.description ?? "—"}</td>
              <td
                className={`whitespace-nowrap tabular-nums font-medium ${transaction.type === "INGRESO" ? "amount-positive" : "amount-negative"}`}
              >
                {formatMoney(transaction.amount)}
              </td>
              <td>{transaction.status}</td>
              <td className="text-slate-400">{transaction.period}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
