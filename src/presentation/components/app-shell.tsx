import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function AppShell() {
  const { state, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-emerald-300">Finanzas ICBA</p>
            <h1 className="text-lg font-semibold">Diagnóstico técnico</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            {state.status === "authenticated" ? <span>{state.email}</span> : null}
            <button className="button-secondary" type="button" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6" aria-label="Diagnóstico">
          <NavLink className="nav-link" to="/diagnostico" end>
            Fuente de datos
          </NavLink>
          <NavLink className="nav-link" to="/diagnostico/transacciones">
            Transacciones
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
