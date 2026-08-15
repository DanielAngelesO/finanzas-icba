import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useMemo } from "react";
import type { AppConfig } from "../config/google-sheets";
import { createReviewServices, createServices, type AppServices } from "../composition/services";
import { AuthContext, type AuthContextValue, useAuth } from "./auth/auth-context";
import { AuthProvider } from "./auth/auth-provider";
import { AppShell } from "./components/app-shell";
import { ThemeSelector } from "./components/theme-selector";
import { DashboardPage } from "./pages/dashboard-page";
import { DataQualityPage } from "./pages/data-quality-page";
import { DataSourcePage } from "./pages/data-source-page";
import { ExpensesPage } from "./pages/expenses-page";
import { HomePage } from "./pages/home-page";
import { LoginPage } from "./pages/login-page";
import { TransactionsPage } from "./pages/transactions-page";

function UnconfiguredPage({ errors }: { errors: string[] }) {
  return (
    <main className="auth-page grid min-h-screen place-items-center px-4 text-slate-100">
      <div className="auth-theme-control">
        <ThemeSelector variant="compact" />
      </div>
      <section className="card configuration-card animate-fade-in-up max-w-xl">
        <p className="text-sm font-semibold text-amber-400">Sin configurar</p>
        <h1 className="page-title mt-2">Falta configurar Google Sheets</h1>
        <p className="mt-3 text-sm text-slate-400">
          Copia{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
            .env.example
          </code>{" "}
          a{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
            .env.local
          </code>{" "}
          y completa los valores no sensibles.
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-amber-300/80">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  return state.status === "authenticated" ? <>{children}</> : <Navigate to="/ingresar" replace />;
}

export function AppRoutes({ services }: { services: AppServices }) {
  return (
    <Routes>
      <Route path="/ingresar" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedContent>
            <AppShell />
          </ProtectedContent>
        }
      >
        <Route index element={<HomePage services={services} />} />
        <Route path="resumen" element={<DashboardPage services={services} />} />
        <Route path="movimientos" element={<TransactionsPage services={services} />} />
        <Route path="movimientos/nueva" element={<TransactionsPage services={services} />} />
        <Route
          path="movimientos/:transactionId"
          element={<TransactionsPage services={services} />}
        />
        <Route
          path="movimientos/:transactionId/editar"
          element={<TransactionsPage services={services} />}
        />
        <Route path="gastos" element={<ExpensesPage services={services} />} />
        <Route path="control/calidad" element={<DataQualityPage services={services} />} />
        <Route path="control/fuente" element={<DataSourcePage services={services} />} />
      </Route>
      <Route path="/diagnostico" element={<Navigate to="/control/fuente" replace />} />
      <Route path="/diagnostico/transacciones" element={<Navigate to="/movimientos" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ConfiguredApp({ config }: { config: Extract<AppConfig, { kind: "configured" }> }) {
  const services = useMemo(() => createServices(config), [config]);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 30_000 } } }),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        clientId={config.googleClientId}
        dataSource={config.dataSource}
        services={services}
      >
        <BrowserRouter>
          <AppRoutes services={services} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const reviewAuthValue: AuthContextValue = {
  state: {
    status: "authenticated",
    email: "revision.local@finanzas-icba.test",
    name: "Revisión local",
  },
  signIn: () => {},
  retryPreparation: () => {},
  signOut: () => {},
  isReviewMode: true,
};

function ReviewApp() {
  const services = useMemo(() => createReviewServices(), []);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 30_000 } } }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={reviewAuthValue}>
        <BrowserRouter>
          <AppRoutes services={services} />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function App({ config }: { config: AppConfig }) {
  if (config.kind === "review") return <ReviewApp />;
  if (config.kind === "configured") return <ConfiguredApp config={config} />;
  return <UnconfiguredPage errors={config.errors} />;
}
