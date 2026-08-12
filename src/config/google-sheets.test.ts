import { describe, expect, it } from "vitest";
import { loadAppConfig } from "./google-sheets";

const configuredEnvironment = {
  MODE: "development",
  DEV: true,
  VITE_GOOGLE_CLIENT_ID: "client-test-id",
  VITE_GOOGLE_SPREADSHEET_ID: "spreadsheet-test-id",
  VITE_GOOGLE_SHEET_NAME: "Transacciones",
  VITE_GOOGLE_DECIMAL_SEPARATOR: ".",
  VITE_ALLOWED_EMAILS: "tesorero@iglesia.org",
};

describe("loadAppConfig", () => {
  it("activa revisión únicamente en modo review durante desarrollo", () => {
    expect(
      loadAppConfig({
        MODE: "review",
        DEV: true,
        VITE_GOOGLE_CLIENT_ID: "",
        VITE_GOOGLE_SPREADSHEET_ID: "",
        VITE_GOOGLE_SHEET_NAME: "",
        VITE_GOOGLE_DECIMAL_SEPARATOR: "inválido",
      }),
    ).toEqual({ kind: "review" });

    expect(
      loadAppConfig({
        ...configuredEnvironment,
        MODE: "review",
        DEV: false,
      }),
    ).toMatchObject({ kind: "configured" });
  });

  it("conserva la configuración Google y la pantalla sin configurar fuera de revisión", () => {
    expect(loadAppConfig(configuredEnvironment)).toMatchObject({ kind: "configured" });
    expect(loadAppConfig({ MODE: "development", DEV: true })).toMatchObject({
      kind: "unconfigured",
    });
  });
});
