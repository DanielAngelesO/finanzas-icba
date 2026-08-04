import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

function DatabaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 0 0-.629.74v.01c0 2.458.848 4.142 2.27 5.205C7.657 8.332 9.132 8.75 10 8.75c.868 0 2.343-.418 3.73-1.36 1.422-1.063 2.27-2.747 2.27-5.205v-.01a.75.75 0 0 0-.629-.74A28.848 28.848 0 0 0 10 1ZM5.75 8.875v2.375c0 2.458.848 4.142 2.27 5.205C9.407 17.397 10.868 17.8 10 17.8c-.868 0-2.343-.418-3.73-1.36-1.422-1.063-2.27-2.747-2.27-5.205V8.875c.479.244.98.452 1.5.619ZM10 9.75c.868 0 2.343-.418 3.73-1.36.52-.389.981-.84 1.37-1.355v4.215c0 2.458-.848 4.142-2.27 5.205-1.387 1.037-2.862 1.445-3.73 1.445-.868 0-2.343-.418-3.73-1.36-.096-.072-.19-.147-.283-.225.588.144 1.2.222 1.833.235h.08c1.828 0 3.623-.149 5.371-.435a.75.75 0 0 0 .629-.74v-4.65c-.479.244-.98.452-1.5.619a8.32 8.32 0 0 1-1.5.356Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M1 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6Zm4 1.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5Zm0 3a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5Zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function getInitials(email: string, name: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

export function AppShell() {
  const { state, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const email = state.status === "authenticated" ? state.email : "";
  const name = state.status === "authenticated" ? state.name : null;

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" aria-hidden="true">
          💰
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">Finanzas ICBA</p>
          <p className="text-[11px] text-slate-500">Diagnóstico técnico</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Navegación principal">
        <p className="sidebar-section-label">Diagnóstico</p>
        <NavLink
          className="sidebar-link"
          to="/diagnostico"
          end
          onClick={() => setSidebarOpen(false)}
        >
          <DatabaseIcon />
          Fuente de datos
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/diagnostico/transacciones"
          onClick={() => setSidebarOpen(false)}
        >
          <ReceiptIcon />
          Transacciones
        </NavLink>
      </nav>

      {/* Footer with user info */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{getInitials(email, name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{name ?? email}</p>
            {name ? (
              <p className="truncate text-[11px] text-slate-500">{email}</p>
            ) : null}
          </div>
        </div>
        <button
          className="button-secondary button-icon mt-3 w-full justify-center text-xs"
          type="button"
          onClick={signOut}
        >
          <LogoutIcon />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      {/* Mobile header */}
      <div className="mobile-header">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">💰</span>
          <span className="text-sm font-bold text-slate-100">Finanzas ICBA</span>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen ? (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`sidebar transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Barra lateral"
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="min-h-screen pt-14 lg:ml-64 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
