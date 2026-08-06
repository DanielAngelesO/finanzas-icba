import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authSessionExpirySkewMs,
  authSessionStorageKey,
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type StoredAuthSession,
} from "./auth-session";

const currentTime = 1_780_000_000_000;
const validSession: StoredAuthSession = {
  accessToken: "token-de-prueba",
  expiresAt: currentTime + authSessionExpirySkewMs + 60_000,
  clientId: "client-test-id",
};

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("sesión OAuth en sessionStorage", () => {
  it("guarda y recupera una sesión vigente del mismo cliente", () => {
    saveAuthSession(validSession);

    expect(readAuthSession("client-test-id", currentTime)).toEqual(validSession);
  });

  it("elimina una sesión expirada o demasiado próxima a expirar", () => {
    saveAuthSession({ ...validSession, expiresAt: currentTime + authSessionExpirySkewMs });

    expect(readAuthSession("client-test-id", currentTime)).toBeNull();
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
  });

  it("elimina contenido corrupto o creado para otro cliente OAuth", () => {
    window.sessionStorage.setItem(authSessionStorageKey, "no-es-json");

    expect(readAuthSession("client-test-id", currentTime)).toBeNull();
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();

    saveAuthSession(validSession);

    expect(readAuthSession("otro-client-id", currentTime)).toBeNull();
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
  });

  it("no bloquea la autenticación si sessionStorage no está disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Almacenamiento no disponible.");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Almacenamiento no disponible.");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Almacenamiento no disponible.");
    });

    expect(readAuthSession("client-test-id", currentTime)).toBeNull();
    expect(() => saveAuthSession(validSession)).not.toThrow();
    expect(() => clearAuthSession()).not.toThrow();
  });
});
