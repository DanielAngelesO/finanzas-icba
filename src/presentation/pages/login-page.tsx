import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function LoginPage() {
  const { state, signIn } = useAuth();
  if (state.status === "authenticated") return <Navigate to="/diagnostico" replace />;
  const busy = state.status === "authorizing";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="card w-full max-w-lg space-y-5">
        <div>
          <p className="text-sm font-medium text-emerald-300">Finanzas ICBA</p>
          <h1 className="mt-1 text-2xl font-bold">Acceso al diagnóstico técnico</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Usa la cuenta Google autorizada para consultar la hoja en modo de solo lectura.
          </p>
        </div>
        {state.status === "unauthorized" ? (
          <p className="alert-error" role="alert">
            {state.email} no está en la lista de acceso de esta aplicación.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="alert-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === "expired" ? (
          <p className="alert-warning" role="status">
            Tu sesión expiró. Vuelve a autorizar la aplicación.
          </p>
        ) : null}
        <button
          className="button-primary w-full"
          disabled={busy}
          type="button"
          onClick={() => void signIn()}
        >
          {busy ? "Autorizando…" : "Ingresar con Google"}
        </button>
        <p className="text-xs leading-5 text-slate-400">
          La lista de correos mejora la experiencia, pero el acceso real al archivo depende de los
          permisos de Google Sheets.
        </p>
      </section>
    </main>
  );
}
