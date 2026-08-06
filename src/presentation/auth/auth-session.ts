import { z } from "zod";

export const authSessionStorageKey = "finanzas-icba.google-oauth-session.v1";
export const authSessionExpirySkewMs = 60_000;

const authSessionSchema = z
  .object({
    accessToken: z.string().min(1),
    expiresAt: z.number().finite().int().positive(),
    clientId: z.string().min(1),
  })
  .strict();

export type StoredAuthSession = z.infer<typeof authSessionSchema>;

const removeStoredAuthSession = () => {
  try {
    window.sessionStorage.removeItem(authSessionStorageKey);
  } catch {
    // El almacenamiento puede no estar disponible en contextos de privacidad estricta.
  }
};

export const clearAuthSession = () => {
  removeStoredAuthSession();
};

export const readAuthSession = (clientId: string, now = Date.now()): StoredAuthSession | null => {
  try {
    const rawSession = window.sessionStorage.getItem(authSessionStorageKey);
    if (!rawSession) return null;
    const parsedSession: unknown = JSON.parse(rawSession);
    const parsed = authSessionSchema.safeParse(parsedSession);
    if (
      !parsed.success ||
      parsed.data.clientId !== clientId ||
      parsed.data.expiresAt <= now + authSessionExpirySkewMs
    ) {
      removeStoredAuthSession();
      return null;
    }
    return parsed.data;
  } catch {
    removeStoredAuthSession();
    return null;
  }
};

export const saveAuthSession = (session: StoredAuthSession) => {
  try {
    window.sessionStorage.setItem(authSessionStorageKey, JSON.stringify(session));
  } catch {
    // La autenticación permanece disponible en memoria cuando sessionStorage falla.
  }
};
