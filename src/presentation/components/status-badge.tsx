import type { ConnectionStatus } from "../../domain/diagnostics";

const labels: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "Sin configurar",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  WARNING: "Con advertencias",
  ERROR: "Error",
};

const styles: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "bg-slate-700 text-slate-200",
  CONNECTING: "bg-sky-950 text-sky-200",
  CONNECTED: "bg-emerald-950 text-emerald-200",
  WARNING: "bg-amber-950 text-amber-200",
  ERROR: "bg-rose-950 text-rose-200",
};

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
