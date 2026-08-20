import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServices } from "../../composition/services";
import { sheetConfig } from "../../test/fixtures";
import { authSessionStorageKey, saveAuthSession } from "./auth-session";
import { useAuth } from "./auth-context";
import { AuthProvider } from "./auth-provider";

let tokenCallback: ((response: GoogleTokenResponse) => void) | null = null;
let popupErrorCallback: ((error: GoogleTokenClientError) => void) | undefined;
const requestAccessToken = vi.fn();

const setGoogleIdentity = () => {
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (options) => {
          tokenCallback = options.callback;
          popupErrorCallback = options.error_callback;
          return { requestAccessToken };
        },
      },
    },
  };
};

const createServicesForAuth = () =>
  createServices({
    kind: "configured",
    googleClientId: "client-test-id",
    dataSource: sheetConfig,
  });

function AuthProbe() {
  const { state, signIn, retryPreparation, signOut } = useAuth();
  return (
    <>
      <output data-testid="status">{state.status}</output>
      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
      <button type="button" onClick={signIn}>
        Ingresar
      </button>
      <button type="button" onClick={retryPreparation}>
        Reintentar
      </button>
      <button type="button" onClick={signOut}>
        Cerrar sesión
      </button>
    </>
  );
}

const renderAuthProvider = () => {
  const services = createServicesForAuth();
  render(
    <AuthProvider clientId="client-test-id" dataSource={sheetConfig} services={services}>
      <AuthProbe />
    </AuthProvider>,
  );
  return services;
};

const expectPrepared = async () => {
  await waitFor(() => expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "none" }));
  if (!tokenCallback) throw new Error("No se inicializó el cliente de token de Google.");
  tokenCallback({ error: "login_required" });
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
  return tokenCallback;
};

afterEach(() => {
  cleanup();
  requestAccessToken.mockReset();
  tokenCallback = null;
  popupErrorCallback = undefined;
  window.sessionStorage.clear();
  Reflect.deleteProperty(window, "google");
  document
    .querySelectorAll(`script[src="https://accounts.google.com/gsi/client"]`)
    .forEach((script) => {
      script.remove();
    });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("intenta una autorización silenciosa al montar sin pedir consentimiento", async () => {
    setGoogleIdentity();
    renderAuthProvider();

    await waitFor(() => expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "none" }));
    expect(screen.getByTestId("status")).toHaveTextContent("preparing");
  });

  it("entra sin interacción cuando la autorización silenciosa tiene éxito", async () => {
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "tesorero@iglesia.org", name: "Tesorería" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const services = renderAuthProvider();

    await waitFor(() => expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "none" }));
    tokenCallback?.({ access_token: "token-silencioso", expires_in: 3_600 });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(services.tokenStore.get()).toBe("token-silencioso");
  });

  it("deja el ingreso manual disponible cuando la autorización silenciosa no puede continuar", async () => {
    setGoogleIdentity();
    renderAuthProvider();

    await expectPrepared();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });

  it("no repite la autorización silenciosa tras reintentar la preparación", async () => {
    setGoogleIdentity();
    renderAuthProvider();

    await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it("deja el ingreso manual disponible si la ventana silenciosa no puede abrirse", async () => {
    setGoogleIdentity();
    renderAuthProvider();

    await waitFor(() => expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "none" }));
    popupErrorCallback?.({ type: "popup_failed_to_open" });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("solicita el token inmediatamente al pulsar Ingresar", async () => {
    setGoogleIdentity();
    renderAuthProvider();

    await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(requestAccessToken).toHaveBeenCalledTimes(2);
    expect(requestAccessToken).toHaveBeenLastCalledWith({ prompt: "consent" });
    expect(screen.getByTestId("status")).toHaveTextContent("authorizing");
  });

  it("autentica y conserva el token solo para un correo permitido", async () => {
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "tesorero@iglesia.org", name: "Tesorería" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const services = renderAuthProvider();

    const callback = await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    callback({ access_token: "token-permitido", expires_in: 3_600 });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(services.tokenStore.get()).toBe("token-permitido");
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toContain("token-permitido");
  });

  it("restaura una sesión vigente sin abrir otro popup", async () => {
    saveAuthSession({
      accessToken: "token-restaurado",
      expiresAt: Date.now() + 3_600_000,
      clientId: "client-test-id",
    });
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "tesorero@iglesia.org", name: "Tesorería" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const services = renderAuthProvider();

    expect(screen.getByTestId("status")).toHaveTextContent("restoring");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    expect(requestAccessToken).not.toHaveBeenCalled();
    expect(services.tokenStore.get()).toBe("token-restaurado");
  });

  it("elimina la sesión restaurada si el correo dejó de estar autorizado", async () => {
    saveAuthSession({
      accessToken: "token-revocado",
      expiresAt: Date.now() + 3_600_000,
      clientId: "client-test-id",
    });
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "no-autorizado@iglesia.org" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthorized"));

    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
    expect(requestAccessToken).not.toHaveBeenCalled();
  });

  it("expira y elimina una sesión restaurada que Google ya no acepta", async () => {
    saveAuthSession({
      accessToken: "token-expirado",
      expiresAt: Date.now() + 3_600_000,
      clientId: "client-test-id",
    });
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("expired"));

    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
  });

  it("elimina la sesión persistida al cerrar sesión", async () => {
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "tesorero@iglesia.org", name: "Tesorería" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderAuthProvider();

    const callback = await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    callback({ access_token: "token-para-salir", expires_in: 3_600 });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
  });

  it("expira la sesión en memoria sin esperar una respuesta de Sheets", async () => {
    vi.useFakeTimers();
    try {
      setGoogleIdentity();
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ email: "tesorero@iglesia.org", name: "Tesorería" }), {
          status: 200,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      renderAuthProvider();

      await act(async () => {
        await vi.runAllTicks();
      });
      const callback = tokenCallback;
      if (!callback) throw new Error("No se inicializó el cliente de token de Google.");
      await act(async () => {
        callback({ error: "login_required" });
        await vi.runAllTicks();
      });
      fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
      await act(async () => {
        callback({ access_token: "token-corto", expires_in: 61 });
        await vi.runAllTicks();
      });
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });

      expect(screen.getByTestId("status")).toHaveTextContent("expired");
      expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rechaza un correo que no está autorizado", async () => {
    setGoogleIdentity();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "no-autorizado@iglesia.org" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const services = renderAuthProvider();

    const callback = await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    callback({ access_token: "token-no-autorizado" });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthorized"));
    expect(services.tokenStore.get()).toBeNull();
  });

  it("muestra una respuesta OAuth fallida sin conservar el token", async () => {
    setGoogleIdentity();
    const services = renderAuthProvider();

    const callback = await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    callback({ error: "access_denied", error_description: "El acceso fue denegado." });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("El acceso fue denegado."),
    );
    expect(services.tokenStore.get()).toBeNull();
  });

  it.each([
    [
      "popup_failed_to_open",
      "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.",
    ],
    [
      "popup_closed",
      "Se cerró la ventana de Google antes de completar la autorización. Vuelve a intentarlo.",
    ],
    ["unknown", "No se pudo abrir la ventana de Google. Vuelve a intentarlo."],
  ])("recupera el estado cuando GIS informa %s", async (type, message) => {
    setGoogleIdentity();
    renderAuthProvider();

    await expectPrepared();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    if (!popupErrorCallback) throw new Error("No se configuró el manejador de errores del popup.");
    popupErrorCallback({ type });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
  });

  it("permite reintentar la carga de GIS después de un fallo", async () => {
    renderAuthProvider();

    const failedScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (!failedScript) throw new Error("No se insertó el script de Google.");
    fireEvent.error(failedScript);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(failedScript).not.toBeInTheDocument();
    setGoogleIdentity();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await expectPrepared();
  });
});
