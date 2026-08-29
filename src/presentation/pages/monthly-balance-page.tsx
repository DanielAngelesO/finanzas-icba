import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AppServices } from "../../composition/services";
import type { DashboardIncomeScope } from "../../domain/dashboard";
import { IncomeScopeToggle } from "../components/dashboard-income-scope-toggle";
import { PeriodNavigator } from "../features/transactions/period-navigator";
import { getCurrentLimaPeriod } from "../features/transactions/transaction-ui";
import { MonthlyBalanceList } from "../features/balance/monthly-balance-list";
import { formatAmount, formatMoney, formatPeriod } from "../formatters";

const periodPattern = /^\d{6}$/;

const readIncomeScope = (value: string | null): DashboardIncomeScope =>
  value === "contributions" ? "CONTRIBUTIONS" : "ALL";

const toIncomeScopeParam = (scope: DashboardIncomeScope): string =>
  scope === "CONTRIBUTIONS" ? "contributions" : "all";

/** Convención contable: los importes que restan van entre paréntesis. */
const inBrackets = (text: string): string => `(${text})`;

function StatementRow({
  label,
  amount,
  rank = "item",
  negative = false,
  excluded = false,
  note,
}: {
  label: string;
  amount: string;
  rank?: "item" | "subtotal" | "total";
  negative?: boolean;
  excluded?: boolean;
  note?: ReactNode;
}) {
  return (
    <tr data-excluded={excluded ? "" : undefined} data-rank={rank}>
      <th scope="row">
        <span className="ledger-line">
          <span>{label}</span>
          {note}
          <span aria-hidden="true" className="ledger-leader" />
        </span>
      </th>
      <td className={negative ? "ledger-negative" : undefined}>{amount}</td>
    </tr>
  );
}

function BalanceLoadingState() {
  return (
    <div className="balance-page animate-fade-in-up" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el balance del período.</span>
      <div className="shimmer h-12 w-full" aria-hidden="true" />
      <div className="shimmer h-64 w-full max-w-xl" aria-hidden="true" />
      <div className="ledger-columns" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div className="shimmer h-48" key={index} />
        ))}
      </div>
    </div>
  );
}

export function MonthlyBalancePage({ services }: { services: AppServices }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodParam = searchParams.get("period");
  const period =
    periodParam && periodPattern.test(periodParam) ? periodParam : getCurrentLimaPeriod();
  const scope = readIncomeScope(searchParams.get("income"));
  const onlyContributions = scope === "CONTRIBUTIONS";

  const balance = useQuery({
    queryKey: ["monthly-balance", period],
    queryFn: () => services.monthlyBalance.execute(period),
    placeholderData: keepPreviousData,
  });

  const updatePeriod = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("period", next);
    setSearchParams(nextParams);
  };

  const updateScope = (next: DashboardIncomeScope) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("income", toIncomeScopeParam(next));
    setSearchParams(nextParams);
  };

  if (balance.isPending) return <BalanceLoadingState />;

  if (balance.isError || !balance.data) {
    return (
      <section className="space-y-4 animate-fade-in-up" role="alert">
        <h1 className="page-title">Balance mensual</h1>
        <p className="alert-error">No se pudo cargar el balance del período.</p>
        <button className="button-secondary" type="button" onClick={() => void balance.refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const { data } = balance;
  const income = onlyContributions ? data.income.contributions : data.income.total;
  const net = onlyContributions ? data.netResult.contributions : data.netResult.all;
  const netPositive = net >= 0;

  return (
    <div className="balance-page animate-fade-in-up">
      <header className="balance-masthead">
        <h1 className="page-title">Balance mensual</h1>
        <div className="balance-toolbar">
          <PeriodNavigator period={period} onChange={updatePeriod} />
          <IncomeScopeToggle
            label="Calcular el balance solo con aportes: diezmos y ofrendas"
            onChange={updateScope}
            scope={scope}
          />
        </div>
      </header>

      {data.dataQuality.invalidTransactionCount > 0 ? (
        <p className="alert-warning" role="status">
          {data.dataQuality.invalidTransactionCount}{" "}
          {data.dataQuality.invalidTransactionCount === 1 ? "fila inválida" : "filas inválidas"}{" "}
          fuera del balance.{" "}
          <Link className="font-semibold underline underline-offset-2" to="/control/calidad">
            Revisar
          </Link>
        </p>
      ) : null}

      <section className="ledger-statement" aria-labelledby="balance-summary-title">
        <div className="ledger-statement-head">
          <h2 className="ledger-statement-title" id="balance-summary-title">
            Balance de {formatPeriod(period)}
          </h2>
          <span className="ledger-caption">S/</span>
        </div>

        <table className="ledger-statement-table">
          <tbody>
            <StatementRow amount={formatAmount(data.tithes.total)} label="Diezmos" />
            <StatementRow amount={formatAmount(data.offerings.total)} label="Ofrendas" />
            <StatementRow
              amount={formatAmount(data.income.contributions)}
              label="Aportes"
              rank="subtotal"
            />
            <StatementRow
              amount={formatAmount(data.otherIncome.total)}
              excluded={onlyContributions}
              label="Otros ingresos"
              note={onlyContributions ? <span className="ledger-note">excluido</span> : undefined}
            />
            <StatementRow amount={formatAmount(income)} label="Ingresos" rank="total" />
            <StatementRow
              amount={inBrackets(formatAmount(data.expense))}
              label="Egresos"
              negative
            />
          </tbody>
          <tfoot>
            <tr className="ledger-result" data-positive={netPositive ? "" : undefined}>
              <th scope="row">Saldo del período</th>
              <td>{netPositive ? formatMoney(net) : inBrackets(formatMoney(Math.abs(net)))}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section aria-labelledby="balance-detail-title">
        <h2 className="ledger-caption ledger-section-title" id="balance-detail-title">
          Detalle
        </h2>
        <div className="ledger-columns">
          <MonthlyBalanceList field="origin" group={data.tithes} title="Diezmos" tone="income" />
          <div className="ledger-column">
            <MonthlyBalanceList
              dateFormat="weekday"
              field="none"
              group={data.offerings}
              title="Ofrendas"
              tone="income"
            />
            <MonthlyBalanceList
              field="detail"
              group={data.otherIncome}
              title="Otros ingresos"
              tone="income"
            />
          </div>
          <MonthlyBalanceList field="detail" group={data.expenses} title="Egresos" tone="expense" />
        </div>
      </section>
    </div>
  );
}
