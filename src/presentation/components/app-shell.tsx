import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="m9.69 2.08-6.5 5.5A1.75 1.75 0 0 0 2.57 8.9v7.35c0 .967.784 1.75 1.75 1.75h3.43v-5.4h4.5V18h3.43A1.75 1.75 0 0 0 17.43 16.25V8.9c0-.514-.224-1.003-.62-1.32l-6.5-5.5Z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M1 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6Zm4 1.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1Zm0 3a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1Zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.25 17.5A.75.75 0 0 1 2.5 16.75v-13a.75.75 0 0 1 1.5 0v13c0 .414-.336.75-.75.75Z" />
      <path d="M5.5 16.75a.75.75 0 0 1-.75-.75V9.5a.75.75 0 0 1 1.5 0V16c0 .414-.336.75-.75.75Zm4.5 0a.75.75 0 0 1-.75-.75V6.25a.75.75 0 0 1 1.5 0V16c0 .414-.336.75-.75.75Zm4.5 0a.75.75 0 0 1-.75-.75v-4.25a.75.75 0 0 1 1.5 0V16c0 .414-.336.75-.75.75Zm3.25.75H2.5a.75.75 0 0 1 0-1.5h15.25a.75.75 0 0 1 0 1.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Zm3.28 5.97a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L6.72 10.78a.75.75 0 1 1 1.06-1.06L9 10.94l3.22-3.22a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1.5c-4.142 0-7.5 1.343-7.5 3v11c0 1.657 3.358 3 7.5 3s7.5-1.343 7.5-3v-11c0-1.657-3.358-3-7.5-3Zm0 1.5c3.59 0 6 .984 6 1.5S13.59 6 10 6 4 5.016 4 4.5 6.41 3 10 3Zm0 13.5c-3.59 0-6-.984-6-1.5v-2.193c1.373.783 3.662 1.193 6 1.193s4.627-.41 6-1.193V15c0 .516-2.41 1.5-6 1.5Zm0-4.5c-3.59 0-6-.984-6-1.5V8.307C5.373 9.09 7.662 9.5 10 9.5s4.627-.41 6-1.193V10.5c0 .516-2.41 1.5-6 1.5Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
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

const getInitialDesktopState = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(min-width: 1024px)").matches;

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
  const [isDesktop, setIsDesktop] = useState(getInitialDesktopState);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);
    updateDesktopState();
    mediaQuery.addEventListener("change", updateDesktopState);
    return () => mediaQuery.removeEventListener("change", updateDesktopState);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  const email = state.status === "authenticated" ? state.email : "";
  const name = state.status === "authenticated" ? state.name : null;
  const isSidebarVisible = isDesktop || sidebarOpen;
  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" aria-hidden="true">
          ICBA
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">Finanzas ICBA</p>
          <p className="text-[11px] text-slate-500">Administración financiera</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        <p className="sidebar-section-label">Principal</p>
        <NavLink className="sidebar-link" to="/" end onClick={closeSidebar}>
          <HomeIcon />
          Resumen
        </NavLink>
        <NavLink className="sidebar-link" to="/movimientos" onClick={closeSidebar}>
          <ReceiptIcon />
          Movimientos
        </NavLink>

        <p className="sidebar-section-label">Análisis</p>
        <NavLink className="sidebar-link" to="/gastos" onClick={closeSidebar}>
          <ChartIcon />
          Gastos
        </NavLink>

        <p className="sidebar-section-label">Control de datos</p>
        <NavLink className="sidebar-link" to="/control/calidad" onClick={closeSidebar}>
          <CheckIcon />
          Calidad de datos
        </NavLink>
        <NavLink className="sidebar-link" to="/control/fuente" onClick={closeSidebar}>
          <DatabaseIcon />
          Fuente de datos
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{getInitials(email, name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{name ?? email}</p>
            {name ? <p className="truncate text-[11px] text-slate-500">{email}</p> : null}
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
      <div className="mobile-header">
        <div className="flex items-center gap-2">
          <span className="mobile-brand-mark" aria-hidden="true">
            ICBA
          </span>
          <span className="text-sm font-bold text-slate-100">Finanzas ICBA</span>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-controls="app-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {!isDesktop && sidebarOpen ? (
        <button
          className="mobile-overlay"
          type="button"
          onClick={closeSidebar}
          aria-label="Cerrar menú al tocar fuera"
        />
      ) : null}

      <aside
        className={
          "sidebar transition-transform duration-300 lg:translate-x-0 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
        id="app-sidebar"
        aria-label="Barra lateral"
        aria-hidden={!isSidebarVisible}
        inert={!isSidebarVisible}
      >
        {sidebarContent}
      </aside>

      <main className="min-h-screen pt-14 lg:ml-64 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
