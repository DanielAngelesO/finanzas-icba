import { z } from "zod";
import type { GoogleSheetsDataSourceConfig } from "../../config/google-sheets";
import { logger } from "../logger";

const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const valueRangeSchema = z.object({
  range: z.string(),
  values: z.array(z.array(cellSchema)).optional(),
});

const spreadsheetSchema = z.object({
  spreadsheetId: z.string(),
  properties: z.object({ title: z.string() }).optional(),
  sheets: z
    .array(
      z.object({
        properties: z.object({ sheetId: z.number().int(), title: z.string() }),
      }),
    )
    .optional(),
});

export type GoogleCell = z.infer<typeof cellSchema>;

export class GoogleSheetsError extends Error {
  public constructor(
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GoogleSheetsError";
  }
}

export interface SpreadsheetMetadataResponse {
  id: string;
  title: string | null;
  sheetNames: string[];
  sheets: Array<{ id: number; title: string }>;
}

export type GoogleUserEnteredValue =
  { stringValue: string } | { numberValue: number } | { boolValue: boolean };

export interface GoogleCellData {
  userEnteredValue: GoogleUserEnteredValue;
}

export type GoogleSheetsBatchRequest =
  | {
      appendCells: {
        sheetId: number;
        rows: Array<{ values: GoogleCellData[] }>;
        fields: "userEnteredValue";
      };
    }
  | {
      updateCells: {
        range: {
          sheetId: number;
          startRowIndex: number;
          endRowIndex: number;
          startColumnIndex: number;
          endColumnIndex: number;
        };
        rows: Array<{ values: [GoogleCellData] }>;
        fields: "userEnteredValue";
      };
    };

export class GoogleSheetsClient {
  private readonly fetcher: typeof fetch;

  public constructor(
    private readonly config: GoogleSheetsDataSourceConfig,
    private readonly accessToken: () => string | null,
    fetcher?: typeof fetch,
  ) {
    this.fetcher = fetcher ?? ((input, init) => window.fetch(input, init));
  }

  public async getMetadata(): Promise<SpreadsheetMetadataResponse> {
    const path = `/${encodeURIComponent(this.config.spreadsheetId)}?fields=spreadsheetId,properties(title),sheets.properties(sheetId,title)`;
    const payload = await this.request(path);
    const parsed = spreadsheetSchema.safeParse(payload);
    if (!parsed.success) throw new GoogleSheetsError("Metadatos de Google inválidos.", null, false);
    return {
      id: parsed.data.spreadsheetId,
      title: parsed.data.properties?.title ?? null,
      sheetNames: parsed.data.sheets?.map((sheet) => sheet.properties.title) ?? [],
      sheets:
        parsed.data.sheets?.map((sheet) => ({
          id: sheet.properties.sheetId,
          title: sheet.properties.title,
        })) ?? [],
    };
  }

  public async getValues(
    sheetName = this.config.sheetName,
    requestedRange = this.config.range,
  ): Promise<GoogleCell[][]> {
    const range = `'${sheetName.replaceAll("'", "''")}'!${requestedRange}`;
    const path = `/${encodeURIComponent(this.config.spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;
    const payload = await this.request(path);
    const parsed = valueRangeSchema.safeParse(payload);
    if (!parsed.success) throw new GoogleSheetsError("Valores de Google inválidos.", null, false);
    return parsed.data.values ?? [];
  }

  public async batchUpdate(requests: GoogleSheetsBatchRequest[]): Promise<void> {
    await this.request(
      `/${encodeURIComponent(this.config.spreadsheetId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      },
      1,
    );
  }

  private async request(path: string, init: RequestInit = {}, attempts = 3): Promise<unknown> {
    const token = this.accessToken();
    if (!token) throw new GoogleSheetsError("La sesión de Google expiró.", 401, false);
    const url = `https://sheets.googleapis.com/v4/spreadsheets${path}`;
    let lastError: GoogleSheetsError | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = performance.now();
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await this.fetcher(url, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const elapsedMs = Math.round(performance.now() - startedAt);
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          const error = new GoogleSheetsError(
            this.messageForStatus(response.status),
            response.status,
            retryable,
          );
          logger.warn(
            { status: response.status, elapsedMs, attempt },
            "Google Sheets request failed",
          );
          if (!retryable || attempt === attempts) throw error;
          lastError = error;
        } else {
          logger.debug({ elapsedMs, attempt }, "Google Sheets request succeeded");
          return (await response.json()) as unknown;
        }
      } catch (error: unknown) {
        const networkDetail = error instanceof Error ? error.message : null;
        const normalized =
          error instanceof GoogleSheetsError
            ? error
            : new GoogleSheetsError(
                error instanceof DOMException && error.name === "AbortError"
                  ? "La consulta a Google Sheets excedió el tiempo de espera."
                  : `No fue posible conectar con Google Sheets${networkDetail ? `: ${networkDetail}` : "."}`,
                null,
                true,
              );
        if (!normalized.retryable || attempt === attempts) throw normalized;
        lastError = normalized;
      } finally {
        window.clearTimeout(timeout);
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 200 * 2 ** (attempt - 1)));
    }
    throw (
      lastError ?? new GoogleSheetsError("No fue posible conectar con Google Sheets.", null, true)
    );
  }

  private messageForStatus(status: number): string {
    if (status === 401) return "La sesión de Google expiró.";
    if (status === 403) return "Tu cuenta no tiene permiso para consultar o editar este archivo.";
    if (status === 404) return "No se encontró el archivo o la pestaña configurada.";
    if (status === 429) return "Google Sheets limitó temporalmente las solicitudes.";
    return "Google Sheets devolvió un error al procesar los datos.";
  }
}
