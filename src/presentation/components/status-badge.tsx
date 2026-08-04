import type { ConnectionStatus } from "../../domain/diagnostics";

const labels: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "Sin configurar",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  WARNING: "Con advertencias",
  ERROR: "Error",
};

const dotColors: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "bg-slate-400",
  CONNECTING: "bg-sky-400",
  CONNECTED: "bg-emerald-400",
  WARNING: "bg-amber-400",
  ERROR: "bg-rose-400",
};

const badgeStyles: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "bg-slate-900/60 text-slate-300 border-slate-700/50",
  CONNECTING: "bg-sky-950/60 text-sky-200 border-sky-800/40",
  CONNECTED: "bg-emerald-950/60 text-emerald-200 border-emerald-800/40",
  WARNING: "bg-amber-950/60 text-amber-200 border-amber-800/40",
  ERROR: "bg-rose-950/60 text-rose-200 border-rose-800/40",
};

const animatingStatuses: Set<ConnectionStatus> = new Set(["CONNECTING", "CONNECTED"]);

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`badge border ${badgeStyles[status]}`}>
      <span
        className={`badge-dot ${dotColors[status]} ${animatingStatuses.has(status) ? "badge-dot-pulse" : ""}`}
      />
      {labels[status]}
    </span>
  );
}
