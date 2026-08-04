import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const { state, signIn } = useAuth();
  if (state.status === "authenticated") return <Navigate to="/diagnostico" replace />;
  const busy = state.status === "authorizing";
  return (
    <main
      className="grid min-h-screen place-items-center px-4 text-slate-100"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(52, 211, 153, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(129, 140, 248, 0.06) 0%, transparent 50%), #0a0e1a",
      }}
    >
      <section className="animate-fade-in-up w-full max-w-md">
        {/* Card */}
        <div className="card space-y-6" style={{ borderColor: "rgba(52, 211, 153, 0.1)" }}>
          {/* Header */}
          <div className="text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.1))",
                boxShadow: "0 4px 20px rgba(52, 211, 153, 0.15)",
              }}
            >
              💰
            </div>
            <p className="text-sm font-semibold text-emerald-400">Finanzas ICBA</p>
            <h1 className="page-title mt-2">Acceso al sistema</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Usa tu cuenta Google autorizada para consultar la hoja de cálculo en modo de solo
              lectura.
            </p>
          </div>

          {/* Error / Warning messages */}
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

          {/* Sign in button */}
          <button
            className="button-google"
            disabled={busy}
            type="button"
            onClick={() => void signIn()}
          >
            {busy ? (
              <>
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Autorizando…
              </>
            ) : (
              <>
                <GoogleIcon />
                Ingresar con Google
              </>
            )}
          </button>

          {/* Footnote */}
          <p className="text-center text-xs leading-5 text-slate-500">
            La lista de correos mejora la experiencia, pero el acceso real al archivo depende de los
            permisos de Google Sheets.
          </p>
        </div>
      </section>
    </main>
  );
}
