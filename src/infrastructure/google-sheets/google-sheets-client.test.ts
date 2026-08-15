import { describe, expect, it, vi } from "vitest";
import { GoogleSheetsClient, GoogleSheetsError } from "./google-sheets-client";
import { sheetConfig } from "../../test/fixtures";

describe("GoogleSheetsClient", () => {
  it("invoca fetch desde el contexto de window cuando no recibe un adaptador", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ range: "Transacciones!A:Z", values: [["ID"]] }), {
        status: 200,
      }),
    );
    const client = new GoogleSheetsClient(sheetConfig, () => "token");
    await expect(client.getValues()).resolves.toEqual([["ID"]]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });

  it("reintenta errores 429 y no expone el token en el error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ range: "Transacciones!A:Z", values: [["ID"]] }), {
          status: 200,
        }),
      );
    const client = new GoogleSheetsClient(sheetConfig, () => "secret-token", fetcher);
    await expect(client.getValues()).resolves.toEqual([["ID"]]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("distingue sesiones expiradas y respuestas inválidas", async () => {
    const withoutToken = new GoogleSheetsClient(sheetConfig, () => null);
    await expect(withoutToken.getValues()).rejects.toMatchObject({ status: 401 });
    const invalid = new GoogleSheetsClient(
      sheetConfig,
      () => "token",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    await expect(invalid.getValues()).rejects.toBeInstanceOf(GoogleSheetsError);
  });

  it("envía batchUpdate por POST sin reintentar automáticamente una escritura incierta", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ replies: [] }), { status: 200 }));
    const client = new GoogleSheetsClient(sheetConfig, () => "token", fetcher);

    await client.batchUpdate([
      {
        appendCells: {
          sheetId: 7,
          rows: [{ values: [{ userEnteredValue: { stringValue: "TX-1" } }] }],
          fields: "userEnteredValue",
        },
      },
    ]);

    expect(fetcher).toHaveBeenCalledOnce();
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("No se registró la solicitud.");
    expect(String(call[0])).toContain(":batchUpdate");
    expect(call[1]).toMatchObject({ method: "POST" });
  });
});
