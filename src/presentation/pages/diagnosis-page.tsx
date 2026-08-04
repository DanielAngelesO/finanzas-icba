import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppServices } from "../../composition/services";
import { StatusBadge } from "../components/status-badge";

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
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Fuente de datos</h2>
          <p className="mt-1 text-slate-400">
            Comprueba conexión, configuración y calidad de lectura.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button className="button-secondary" type="button" onClick={() => void refresh()}>
            Probar conexión
          </button>
          <button className="button-secondary" type="button" onClick={() => void clearCache()}>
            Limpiar caché
          </button>
        </div>
      </section>
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
      {metadata.data ? (
        <section className="card">
          <h3 className="section-title">Configuración no sensible</h3>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {configEntries(metadata.data).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {inspection.data ? (
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Filas", inspection.data.totalDataRowCount],
            ["Válidas", inspection.data.validTransactionCount],
            ["Inválidas", inspection.data.invalidTransactionCount],
            ["Latencia", `${inspection.data.latencyMs} ms`],
          ].map(([label, value]) => (
            <article className="card" key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            </article>
          ))}
        </section>
      ) : null}
      {inspection.data && inspection.data.issues.length > 0 ? (
        <section className="card">
          <h3 className="section-title">Advertencias y errores</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {inspection.data.issues.slice(0, 20).map((entry, index) => (
              <li
                className={entry.severity === "error" ? "text-rose-200" : "text-amber-200"}
                key={`${entry.code}-${entry.rowNumber}-${index}`}
              >
                {entry.rowNumber ? `Fila ${entry.rowNumber}: ` : ""}
                {entry.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
