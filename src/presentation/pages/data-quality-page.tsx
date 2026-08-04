import { useQuery } from "@tanstack/react-query";
import type { AppServices } from "../../composition/services";
import { formatDate } from "../formatters";

export function DataQualityPage({ services }: { services: AppServices }) {
  const inspection = useQuery({
    queryKey: ["inspection"],
    queryFn: () => services.dataSource.inspect(),
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section>
        <h2 className="page-title">Calidad de datos</h2>
        <p className="page-subtitle">
          Revisa qué registros se incluyen en los reportes y cuáles requieren corrección.
        </p>
      </section>

      {inspection.isPending ? (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy="true"
          aria-live="polite"
        >
          {[0, 1, 2, 3].map((index) => (
            <div className="shimmer h-32" key={index} aria-hidden="true" />
          ))}
          <span className="sr-only">Revisando la calidad de los datos.</span>
        </section>
      ) : null}
      {inspection.isError ? (
        <p className="alert-error" role="alert">
          No se pudo revisar la calidad de los datos.
        </p>
      ) : null}

      {inspection.data ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Resumen de calidad de datos"
          >
            {[
              ["Filas leídas", inspection.data.totalDataRowCount, "stat-card-sky"],
              ["Registros válidos", inspection.data.validTransactionCount, "stat-card-emerald"],
              ["Filas inválidas", inspection.data.invalidTransactionCount, "stat-card-rose"],
              ["Última revisión", formatDate(inspection.data.inspectedAt), "stat-card-indigo"],
            ].map(([label, value, accent], index) => (
              <article
                className={"stat-card " + accent}
                key={label}
                style={{ animationDelay: String(index * 80) + "ms" }}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-3 text-xl font-bold tabular-nums text-slate-100">{value}</p>
              </article>
            ))}
          </section>

          {inspection.data.invalidTransactionCount === 0 ? (
            <p className="alert-success" role="status">
              No se detectaron filas inválidas. Los registros válidos pueden incluir advertencias
              que conviene revisar.
            </p>
          ) : null}

          {inspection.data.issues.length > 0 ? (
            <section className="card">
              <h3 className="section-title">Advertencias y errores</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {inspection.data.issues.map((entry, index) => (
                  <li
                    className={
                      "flex items-start gap-2 " +
                      (entry.severity === "error" ? "text-rose-300" : "text-amber-300")
                    }
                    key={entry.code + "-" + entry.rowNumber + "-" + index}
                  >
                    <span className="mt-0.5 text-xs" aria-hidden="true">
                      {entry.severity === "error" ? "✕" : "⚠"}
                    </span>
                    <span>
                      {entry.rowNumber ? "Fila " + entry.rowNumber + ": " : ""}
                      {entry.message}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
