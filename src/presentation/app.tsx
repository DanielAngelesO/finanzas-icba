import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useMemo } from "react";
import type { AppConfig } from "../config/google-sheets";
import { createServices } from "../composition/services";
import { AuthProvider } from "./auth/auth-provider";
import { useAuth } from "./auth/auth-context";
import { AppShell } from "./components/app-shell";
import { DiagnosisPage } from "./pages/diagnosis-page";
import { LoginPage } from "./pages/login-page";
import { TransactionsPage } from "./pages/transactions-page";

function UnconfiguredPage({ errors }: { errors: string[] }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="card max-w-xl">
        <p className="text-sm font-medium text-amber-300">Sin configurar</p>
        <h1 className="mt-1 text-2xl font-bold">Falta configurar Google Sheets</h1>
        <p className="mt-3 text-sm text-slate-300">
          Copia <code>.env.example</code> a <code>.env.local</code> y completa los valores no
          sensibles.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-200">
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
          <Routes>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route
              path="/diagnostico"
              element={
                <ProtectedContent>
                  <AppShell />
                </ProtectedContent>
              }
            >
              <Route index element={<DiagnosisPage services={services} />} />
              <Route path="transacciones" element={<TransactionsPage services={services} />} />
            </Route>
            <Route path="*" element={<Navigate to="/diagnostico" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function App({ config }: { config: AppConfig }) {
  return config.kind === "configured" ? (
    <ConfiguredApp config={config} />
  ) : (
    <UnconfiguredPage errors={config.errors} />
  );
}
