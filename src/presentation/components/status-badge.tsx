import type { ConnectionStatus } from "../../domain/diagnostics";

const labels: Record<ConnectionStatus, string> = {
  UNCONFIGURED: "Sin configurar",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  WARNING: "Con advertencias",
  ERROR: "Error",
};

const animatingStatuses: Set<ConnectionStatus> = new Set(["CONNECTING", "CONNECTED"]);

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`badge status-badge status-badge-${status.toLowerCase()}`}>
      <span
        className={`badge-dot status-badge-dot ${animatingStatuses.has(status) ? "badge-dot-pulse" : ""}`}
      />
      {labels[status]}
    </span>
  );
}
