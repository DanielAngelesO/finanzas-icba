import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppServices } from "../../composition/services";
import { StatusBadge } from "../components/status-badge";

const configEntries = (metadata: Awaited<ReturnType<AppServices["dataSource"]["getMetadata"]>>) =>
  [
    ["Proveedor", metadata.provider === "google-sheets" ? "Google Sheets" : "Memoria"],
    ["Archivo", metadata.spreadsheetIdMasked],
    ["Pestaña", metadata.sheetName],
    ["Año activo", metadata.activeYear?.toString() ?? "Todos"],
    ["Estrategia", "Una pestaña con todos los años"],
    ["Encabezado", "Fila " + metadata.headerRow],
    ["Datos", "Desde fila " + metadata.firstDataRow],
    ["Zona horaria", metadata.timezone],
    ["Configuración regional", metadata.locale],
    ["Modo", "Solo lectura"],
  ] as const;

export function DataSourcePage({ services }: { services: AppServices }) {
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
  const status = connection.isPending
    ? "CONNECTING"
    : (connection.data?.status ?? (connection.isError ? "ERROR" : "UNCONFIGURED"));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["connection"] });
    await queryClient.invalidateQueries({ queryKey: ["metadata"] });
    await queryClient.invalidateQueries({ queryKey: ["inspection"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
  };

  const clearCache = async () => {
    await services.dataSource.clearCache();
    await queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Fuente de datos</h2>
          <p className="page-subtitle">
            Comprueba la conexión y la configuración de lectura de la información financiera.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {connection.data.latencyMs !== null ? " · " + connection.data.latencyMs + " ms" : ""}
        </p>
      ) : null}
      {connection.isError ? <p className="alert-error">No se pudo comprobar la conexión.</p> : null}

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
    </div>
  );
}
