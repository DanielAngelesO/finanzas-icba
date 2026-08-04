import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppServices } from "../../composition/services";
import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import { AuthContext, type AuthContextValue, type AuthState } from "./auth-context";

const googleScriptUrl = "https://accounts.google.com/gsi/client";

const loadGoogleIdentity = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${googleScriptUrl}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Google Identity Services.")),
        {
          once: true,
        },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = googleScriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services."));
    document.head.append(script);
  });

const requestToken = (clientId: string, prompt: "" | "consent"): Promise<string> =>
  new Promise((resolve, reject) => {
    const oauth = window.google?.accounts.oauth2;
    if (!oauth) {
      reject(new Error("Google Identity Services no está disponible."));
      return;
    }
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else
          reject(
            new Error(
              response.error_description ?? response.error ?? "Google no autorizó la sesión.",
            ),
          );
      },
    });
    client.requestAccessToken({ prompt });
  });

const getGoogleProfile = async (
  accessToken: string,
): Promise<{ email: string; name: string | null }> => {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No se pudo verificar la identidad de Google.");
  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("email" in data) ||
    typeof data.email !== "string"
  ) {
    throw new Error("Google no devolvió un correo válido.");
  }
  const name = "name" in data && typeof data.name === "string" ? data.name : null;
  return { email: data.email.toLowerCase(), name };
};

interface AuthProviderProps {
  children: ReactNode;
  clientId: string;
  dataSource: GoogleSheetsDataSourceConfig;
  services: AppServices;
}

export function AuthProvider({ children, clientId, dataSource, services }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "idle" });
  const silentRestoreStarted = useRef(false);

  const authenticate = useCallback(
    async (prompt: "" | "consent", showFailure: boolean) => {
      setState({ status: "authorizing" });
      try {
        await loadGoogleIdentity();
        const token = await requestToken(clientId, prompt);
        const profile = await getGoogleProfile(token);
        if (!dataSource.allowedEmails.includes(profile.email)) {
          services.tokenStore.set(null);
          setState({ status: "unauthorized", email: profile.email });
          return;
        }
        services.tokenStore.set(token);
        setState({ status: "authenticated", email: profile.email, name: profile.name });
      } catch (error: unknown) {
        services.tokenStore.set(null);
        setState(
          showFailure
            ? {
                status: "error",
                message: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
              }
            : { status: "idle" },
        );
      }
    },
    [clientId, dataSource.allowedEmails, services.tokenStore],
  );

  useEffect(() => {
    if (silentRestoreStarted.current) return;
    silentRestoreStarted.current = true;
    void authenticate("", false);
  }, [authenticate]);

  const signIn = useCallback(async () => {
    await authenticate("consent", true);
  }, [authenticate]);
  const signOut = useCallback(() => {
    services.tokenStore.set(null);
    setState({ status: "idle" });
  }, [services.tokenStore]);
  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut }),
    [signIn, signOut, state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
