import { createContext, useContext } from "react";

export type AuthState =
  | { status: "restoring" }
  | { status: "preparing" }
  | { status: "ready" }
  | { status: "authorizing" }
  | { status: "authenticated"; email: string; name: string | null }
  | { status: "unauthorized"; email: string }
  | { status: "expired" }
  | { status: "error"; source: "preparation" | "authorization"; message: string };

export interface AuthContextValue {
  state: AuthState;
  signIn(): void;
  retryPreparation(): void;
  signOut(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
};
