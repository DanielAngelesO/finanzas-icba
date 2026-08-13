import { z } from "zod";

export interface TransactionColumnMapping {
  id: string;
  date: string;
  type: string;
  transferId: string;
  account: string;
  category: string;
  subcategory: string;
  description: string;
  responsible: string;
  donorOrProvider: string;
  paymentMethod: string;
  referenceOrReceipt: string;
  amount: string;
  status: string;
  period: string;
  notes: string;
}

export interface GoogleSheetsDataSourceConfig {
  spreadsheetId: string;
  sheetName: string;
  headerRow: number;
  firstDataRow: number;
  range: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  decimalSeparator: "." | ",";
  activeYear: number | null;
  allowedEmails: string[];
  columnMapping: TransactionColumnMapping;
}

export const transactionColumnMapping: TransactionColumnMapping = {
  id: "ID",
  date: "Fecha",
  type: "Tipo Transacción",
  transferId: "Id Transaccion",
  account: "Cuenta",
  category: "Categoría",
  subcategory: "Subcategoría",
  description: "Descripción",
  responsible: "Responsable",
  donorOrProvider: "Donante / Proveedor",
  paymentMethod: "Método de Pago",
  referenceOrReceipt: "Referencia / Comprobante",
  amount: "Monto",
  status: "Estado",
  period: "Período",
  notes: "Notas",
};

const optionalString = z.string().trim().optional();
const runtimeEnvironmentSchema = z
  .object({ MODE: optionalString, DEV: z.boolean().optional() })
  .passthrough();
const environmentSchema = z.object({
  MODE: optionalString,
  DEV: z.boolean().optional(),
  VITE_GOOGLE_CLIENT_ID: optionalString,
  VITE_GOOGLE_SPREADSHEET_ID: optionalString,
  VITE_GOOGLE_SHEET_NAME: optionalString,
  VITE_GOOGLE_SHEETS_RANGE: optionalString,
  VITE_GOOGLE_HEADER_ROW: optionalString,
  VITE_GOOGLE_FIRST_DATA_ROW: optionalString,
  VITE_GOOGLE_TIMEZONE: optionalString,
  VITE_GOOGLE_LOCALE: optionalString,
  VITE_GOOGLE_DECIMAL_SEPARATOR: z.enum([".", ","]).optional(),
  VITE_ALLOWED_EMAILS: optionalString,
  VITE_ACTIVE_YEAR: optionalString,
});

export type AppConfig =
  | { kind: "review" }
  | { kind: "configured"; googleClientId: string; dataSource: GoogleSheetsDataSourceConfig }
  | { kind: "unconfigured"; errors: string[] };

const parsePositiveInteger = (value: string | undefined, fallback: number, label: string) => {
  if (!value) return { value: fallback, error: null };
  const number = Number(value);
  return Number.isInteger(number) && number > 0
    ? { value: number, error: null }
    : { value: fallback, error: `${label} debe ser un entero positivo.` };
};

export const loadAppConfig = (environment: unknown = import.meta.env): AppConfig => {
  const runtimeEnvironment = runtimeEnvironmentSchema.safeParse(environment);
  if (runtimeEnvironment.success) {
    const { MODE, DEV } = runtimeEnvironment.data;
    if (MODE === "review" && DEV === true) return { kind: "review" };
  }

  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) return { kind: "unconfigured", errors: ["Variables de entorno inválidas."] };

  const env = parsed.data;
  const errors: string[] = [];
  const clientId = env.VITE_GOOGLE_CLIENT_ID;
  const spreadsheetId = env.VITE_GOOGLE_SPREADSHEET_ID;
  const sheetName = env.VITE_GOOGLE_SHEET_NAME;
  const decimalSeparator = env.VITE_GOOGLE_DECIMAL_SEPARATOR;
  const allowedEmails = (env.VITE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const headerRow = parsePositiveInteger(env.VITE_GOOGLE_HEADER_ROW, 1, "VITE_GOOGLE_HEADER_ROW");
  const firstDataRow = parsePositiveInteger(
    env.VITE_GOOGLE_FIRST_DATA_ROW,
    2,
    "VITE_GOOGLE_FIRST_DATA_ROW",
  );
  if (!clientId) errors.push("Falta VITE_GOOGLE_CLIENT_ID.");
  if (!spreadsheetId) errors.push("Falta VITE_GOOGLE_SPREADSHEET_ID.");
  if (!sheetName) errors.push("Falta VITE_GOOGLE_SHEET_NAME.");
  if (!decimalSeparator) {
    errors.push("VITE_GOOGLE_DECIMAL_SEPARATOR debe ser '.' o ','.");
  }
  if (allowedEmails.length === 0) errors.push("Falta VITE_ALLOWED_EMAILS.");
  if (headerRow.error) errors.push(headerRow.error);
  if (firstDataRow.error) errors.push(firstDataRow.error);
  if (firstDataRow.value <= headerRow.value) {
    errors.push("La primera fila de datos debe ser posterior al encabezado.");
  }
  const activeYear = env.VITE_ACTIVE_YEAR ? Number(env.VITE_ACTIVE_YEAR) : null;
  if (activeYear !== null && (!Number.isInteger(activeYear) || activeYear < 2000)) {
    errors.push("VITE_ACTIVE_YEAR debe ser un año válido.");
  }
  if (errors.length > 0 || !clientId || !spreadsheetId || !sheetName || !decimalSeparator) {
    return { kind: "unconfigured", errors };
  }

  return {
    kind: "configured",
    googleClientId: clientId,
    dataSource: {
      spreadsheetId,
      sheetName,
      headerRow: headerRow.value,
      firstDataRow: firstDataRow.value,
      range: env.VITE_GOOGLE_SHEETS_RANGE || "A:Z",
      timezone: env.VITE_GOOGLE_TIMEZONE || "America/Lima",
      locale: env.VITE_GOOGLE_LOCALE || "es-PE",
      dateFormat: "DD/MM/YYYY",
      decimalSeparator,
      activeYear,
      allowedEmails,
      columnMapping: transactionColumnMapping,
    },
  };
};
