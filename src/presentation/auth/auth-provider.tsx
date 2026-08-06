import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppServices } from "../../composition/services";
import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type StoredAuthSession,
} from "./auth-session";
import { AuthContext, type AuthContextValue, type AuthState } from "./auth-context";

const googleScriptUrl = "https://accounts.google.com/gsi/client";
const googleScope = "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly";

const loadGoogleIdentity = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${googleScriptUrl}"]`);
    const script = existing ?? document.createElement("script");
    const isNewScript = existing === null;
    const cleanUp = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanUp();
      resolve();
    };
    const onError = () => {
      cleanUp();
      script.remove();
      reject(new Error("No se pudo cargar Google Identity Services."));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (isNewScript) {
      script.src = googleScriptUrl;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
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

const getExpiresAt = (expiresIn: number | undefined): number | null => {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }
  return Date.now() + Math.floor(expiresIn * 1_000);
};

interface AuthProviderProps {
  children: ReactNode;
  clientId: string;
  dataSource: GoogleSheetsDataSourceConfig;
  services: AppServices;
}

export function AuthProvider({ children, clientId, dataSource, services }: AuthProviderProps) {
  const [initialSession] = useState<StoredAuthSession | null>(() => readAuthSession(clientId));
  const [state, setState] = useState<AuthState>(() =>
    initialSession ? { status: "restoring" } : { status: "preparing" },
  );
  const [preparationVersion, setPreparationVersion] = useState(0);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const preparationAttemptRef = useRef(0);
  const restoredSessionRef = useRef<StoredAuthSession | null>(initialSession);
  const isAuthenticatedRef = useRef(false);
  const expirationTimerRef = useRef<number | null>(null);

  const clearExpirationTimer = useCallback(() => {
    if (expirationTimerRef.current === null) return;
    window.clearTimeout(expirationTimerRef.current);
    expirationTimerRef.current = null;
  }, []);

  const clearActiveSession = useCallback(() => {
    clearExpirationTimer();
    clearAuthSession();
    services.tokenStore.set(null);
    restoredSessionRef.current = null;
    isAuthenticatedRef.current = false;
  }, [clearExpirationTimer, services.tokenStore]);

  const expireSession = useCallback(() => {
    clearActiveSession();
    setState({ status: "expired" });
  }, [clearActiveSession]);

  const completeAuthentication = useCallback(
    (
      accessToken: string,
      profile: { email: string; name: string | null },
      expiresAt: number | null,
    ) => {
      clearExpirationTimer();
      restoredSessionRef.current = null;
      isAuthenticatedRef.current = true;
      services.tokenStore.set(accessToken);
      if (expiresAt === null) {
        clearAuthSession();
      } else {
        saveAuthSession({ accessToken, expiresAt, clientId });
        expirationTimerRef.current = window.setTimeout(
          () => expireSession(),
          expiresAt - Date.now(),
        );
      }
      setState({ status: "authenticated", email: profile.email, name: profile.name });
    },
    [clearExpirationTimer, clientId, expireSession, services.tokenStore],
  );

  const handleAuthorizationError = useCallback(
    (message: string) => {
      clearActiveSession();
      setState({ status: "error", source: "authorization", message });
    },
    [clearActiveSession],
  );

  const handleTokenResponse = useCallback(
    (response: GoogleTokenResponse) => {
      const accessToken = response.access_token;
      if (!accessToken) {
        handleAuthorizationError(
          response.error_description ?? response.error ?? "Google no autorizó la sesión.",
        );
        return;
      }
      const expiresAt = getExpiresAt(response.expires_in);
      void (async () => {
        try {
          const profile = await getGoogleProfile(accessToken);
          if (!dataSource.allowedEmails.includes(profile.email)) {
            clearActiveSession();
            setState({ status: "unauthorized", email: profile.email });
            return;
          }
          completeAuthentication(accessToken, profile, expiresAt);
        } catch (error: unknown) {
          handleAuthorizationError(
            error instanceof Error ? error.message : "No se pudo iniciar sesión.",
          );
        }
      })();
    },
    [
      clearActiveSession,
      completeAuthentication,
      dataSource.allowedEmails,
      handleAuthorizationError,
    ],
  );

  const handlePopupError = useCallback(
    (error: GoogleTokenClientError) => {
      if (error.type === "popup_failed_to_open") {
        handleAuthorizationError(
          "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.",
        );
        return;
      }
      if (error.type === "popup_closed") {
        handleAuthorizationError(
          "Se cerró la ventana de Google antes de completar la autorización. Vuelve a intentarlo.",
        );
        return;
      }
      handleAuthorizationError("No se pudo abrir la ventana de Google. Vuelve a intentarlo.");
    },
    [handleAuthorizationError],
  );

  useEffect(() => {
    const session = restoredSessionRef.current;
    if (!session) return;
    let active = true;
    void (async () => {
      try {
        const profile = await getGoogleProfile(session.accessToken);
        if (!active) return;
        if (!dataSource.allowedEmails.includes(profile.email)) {
          clearActiveSession();
          setState({ status: "unauthorized", email: profile.email });
          return;
        }
        completeAuthentication(session.accessToken, profile, session.expiresAt);
      } catch {
        if (!active) return;
        expireSession();
      }
    })();
    return () => {
      active = false;
    };
  }, [clearActiveSession, completeAuthentication, dataSource.allowedEmails, expireSession]);

  useEffect(() => {
    const attempt = preparationAttemptRef.current + 1;
    preparationAttemptRef.current = attempt;
    tokenClientRef.current = null;
    void (async () => {
      try {
        await loadGoogleIdentity();
        const oauth = window.google?.accounts.oauth2;
        if (!oauth) throw new Error("Google Identity Services no está disponible.");
        const tokenClient = oauth.initTokenClient({
          client_id: clientId,
          scope: googleScope,
          callback: handleTokenResponse,
          error_callback: handlePopupError,
        });
        if (preparationAttemptRef.current !== attempt) return;
        tokenClientRef.current = tokenClient;
        if (!restoredSessionRef.current && !isAuthenticatedRef.current) {
          setState((current) => (current.status === "preparing" ? { status: "ready" } : current));
        }
      } catch (error: unknown) {
        if (preparationAttemptRef.current !== attempt || isAuthenticatedRef.current) return;
        setState({
          status: "error",
          source: "preparation",
          message:
            error instanceof Error ? error.message : "No se pudo preparar el acceso a Google.",
        });
      }
    })();
    return () => {
      preparationAttemptRef.current += 1;
      tokenClientRef.current = null;
    };
  }, [clientId, handlePopupError, handleTokenResponse, preparationVersion]);

  useEffect(() => clearExpirationTimer, [clearExpirationTimer]);

  const retryPreparation = useCallback(() => {
    tokenClientRef.current = null;
    setState({ status: "preparing" });
    setPreparationVersion((version) => version + 1);
  }, []);

  const signIn = useCallback(() => {
    const tokenClient = tokenClientRef.current;
    if (!tokenClient) {
      setState({
        status: "error",
        source: "preparation",
        message: "Google todavía no está listo. Vuelve a preparar el acceso e inténtalo de nuevo.",
      });
      return;
    }
    setState({ status: "authorizing" });
    try {
      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (error: unknown) {
      handleAuthorizationError(
        error instanceof Error ? error.message : "No se pudo abrir la ventana de Google.",
      );
    }
  }, [handleAuthorizationError]);

  const signOut = useCallback(() => {
    clearActiveSession();
    if (tokenClientRef.current) {
      setState({ status: "ready" });
      return;
    }
    setState({
      status: "error",
      source: "preparation",
      message: "Google no está listo. Vuelve a preparar el acceso para iniciar sesión.",
    });
  }, [clearActiveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, retryPreparation, signOut }),
    [retryPreparation, signIn, signOut, state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
