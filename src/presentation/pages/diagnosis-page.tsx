import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppServices } from "../../composition/services";
import { StatusBadge } from "../components/status-badge";

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.31H11.77a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.535a.75.75 0 0 0-1.5 0v2.034l-.312-.312A7 7 0 0 0 2.638 8.395a.75.75 0 0 0 1.449.39Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 6a.75.75 0 0 1-1.498-.126l.5-6a.75.75 0 0 1 .798-.674Zm2.84 0a.75.75 0 0 1 .8.674l.5 6a.75.75 0 1 1-1.498.126l-.5-6a.75.75 0 0 1 .698-.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const configEntries = (metadata: Awaited<ReturnType<AppServices["dataSource"]["getMetadata"]>>) =>
  [
    ["Proveedor", "Google Sheets"],
    ["Archivo", metadata.spreadsheetIdMasked],
    ["Pestaña", metadata.sheetName],
    ["Año activo", metadata.activeYear?.toString() ?? "Todos"],
    ["Estrategia", "Una pestaña con todos los años"],
    ["Encabezado", `Fila ${metadata.headerRow}`],
    ["Datos", `Desde fila ${metadata.firstDataRow}`],
    ["Zona horaria", metadata.timezone],
    ["Configuración regional", metadata.locale],
    ["Modo", "Solo lectura"],
  ] as const;

export function DiagnosisPage({ services }: { services: AppServices }) {
  const queryClient = useQueryClient();
  const connection = useQuery({
    queryKey: ["connection"],
    queryFn: () => services.dataSource.checkConnection(),
  });
  const metadata = useQuery({
    queryKey: ["metadata"],
    queryFn: () => services.dataSource.getMetadata(),
    enabled: connection.data?.status === "CONNECTED",
  });
  const inspection = useQuery({
    queryKey: ["inspection"],
    queryFn: () => services.dataSource.inspect(),
    enabled: connection.data?.status === "CONNECTED",
  });
  const status = connection.isPending
    ? "CONNECTING"
    : (connection.data?.status ?? (connection.isError ? "ERROR" : "UNCONFIGURED"));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["connection"] });
    await queryClient.invalidateQueries({ queryKey: ["metadata"] });
    await queryClient.invalidateQueries({ queryKey: ["inspection"] });
  };
  const clearCache = async () => {
    await services.dataSource.clearCache();
    await queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Page header */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Fuente de datos</h2>
          <p className="page-subtitle">
            Comprueba conexión, configuración y calidad de lectura.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button
            className="button-secondary button-icon"
            type="button"
            onClick={() => void refresh()}
          >
            <RefreshIcon />
            Probar conexión
          </button>
          <button
            className="button-secondary button-icon"
            type="button"
            onClick={() => void clearCache()}
          >
            <TrashIcon />
            Limpiar caché
          </button>
        </div>
      </section>

      {/* Connection status */}
      {connection.data ? (
        <p
          className={connection.data.status === "ERROR" ? "alert-error" : "alert-success"}
          role="status"
        >
          {connection.data.message}
          {connection.data.latencyMs !== null ? ` · ${connection.data.latencyMs} ms` : ""}
        </p>
      ) : null}
      {connection.isError ? <p className="alert-error">No se pudo comprobar la conexión.</p> : null}

      {/* Config card */}
      {metadata.data ? (
        <section className="card">
          <h3 className="section-title">Configuración no sensible</h3>
          <dl className="config-grid">
            {configEntries(metadata.data).map(([label, value]) => (
              <div className="config-item" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Inspection stats */}
      {inspection.data ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Filas totales", inspection.data.totalDataRowCount, "stat-card-sky"],
              ["Válidas", inspection.data.validTransactionCount, "stat-card-emerald"],
              ["Inválidas", inspection.data.invalidTransactionCount, "stat-card-rose"],
              ["Latencia", `${inspection.data.latencyMs} ms`, "stat-card-indigo"],
            ] as const
          ).map(([label, value, accent], index) => (
            <article
              className={`stat-card ${accent}`}
              key={label}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-100">{value}</p>
            </article>
          ))}
        </section>
      ) : null}

      {/* Issues */}
      {inspection.data && inspection.data.issues.length > 0 ? (
        <section className="card">
          <h3 className="section-title">Advertencias y errores</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {inspection.data.issues.slice(0, 20).map((entry, index) => (
              <li
                className={`flex items-start gap-2 ${entry.severity === "error" ? "text-rose-300" : "text-amber-300"}`}
                key={`${entry.code}-${entry.rowNumber}-${index}`}
              >
                <span className="mt-0.5 text-xs" aria-hidden="true">
                  {entry.severity === "error" ? "✕" : "⚠"}
                </span>
                <span>
                  {entry.rowNumber ? `Fila ${entry.rowNumber}: ` : ""}
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
