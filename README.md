# Finanzas ICBA — base técnica

SPA de solo lectura para comprobar la conexión y normalización de un Google Sheet de transacciones. No contiene un backend ni almacena claves privadas: cada usuario autoriza su propia sesión de Google.

## Requisitos e instalación

- Node.js 22+ y npm.
- Un proyecto de Google Cloud y un Google Sheet compartido en modo **Viewer** con los usuarios autorizados.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ejecutar comprobaciones:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run test:integration` queda reservado para una prueba real local y no se ejecuta por defecto.

## Google Cloud y Google Sheets

1. Cree o seleccione un proyecto en Google Cloud y habilite **Google Sheets API**.
2. Configure la pantalla de consentimiento OAuth. Si la app es externa y sigue en pruebas, añada los correos de los usuarios como test users.
3. Cree un OAuth 2.0 Client ID de tipo **Web application**.
4. Añada `http://localhost:5173` como origen JavaScript autorizado; agregue el origen final al desplegar.
5. Copie únicamente el Client ID a `VITE_GOOGLE_CLIENT_ID`. No se usa ni se debe crear un client secret para esta SPA.
6. Comparta el Sheet con cada usuario autorizado como Viewer. Ese permiso es la barrera de acceso real; la allowlist de la aplicación solo evita intentos innecesarios.

## Variables de entorno

Todos los valores `VITE_*` son visibles desde el navegador y no son secretos. Nunca agregue contraseñas, cookies, access tokens, service-account JSON ni client secrets.

| Variable                                                | Uso                                          |
| ------------------------------------------------------- | -------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID`                                 | OAuth Client ID web de Google                |
| `VITE_GOOGLE_SPREADSHEET_ID`                            | ID del archivo, extraído de su URL           |
| `VITE_GOOGLE_SHEET_NAME`                                | Nombre exacto de la pestaña de transacciones |
| `VITE_GOOGLE_SHEETS_RANGE`                              | Rango de columnas, por defecto `A:Z`         |
| `VITE_GOOGLE_HEADER_ROW` / `VITE_GOOGLE_FIRST_DATA_ROW` | Filas del encabezado y de datos              |
| `VITE_GOOGLE_TIMEZONE` / `VITE_GOOGLE_LOCALE`           | Por defecto `America/Lima` / `es-PE`         |
| `VITE_GOOGLE_DECIMAL_SEPARATOR`                         | Obligatorio: `.` o `,`                       |
| `VITE_ALLOWED_EMAILS`                                   | Correos separados por coma para la interfaz  |
| `VITE_ACTIVE_YEAR`                                      | Año visible en diagnóstico; opcional         |

La hoja debe contener los encabezados definidos en `src/config/google-sheets.ts`. El orden puede variar. Son obligatorios ID, Fecha, Tipo Transacción, Cuenta, Categoría, Responsable, Método de Pago, Monto, Estado y Período. `Descripción` es opcional.

## Pantallas

- `/`: resumen financiero del período más reciente, con selector `?period=YYYYMM`, seis indicadores, acumulados desplegables, tendencias de doce meses, composición de ingresos y evolución mensual de montos y cantidades de ofrendas/diezmos. Los egresos separan `Salarios y Honorarios` de las demás categorías; el ranking detallado excluye esa categoría.
- `/movimientos`: consulta de operaciones por período, tipo o ID.
- `/control/calidad`: conteos de validación y problemas por fila.
- `/control/fuente`: conexión y metadatos no sensibles de la fuente.

Las rutas anteriores `/diagnostico` y `/diagnostico/transacciones` se redirigen automáticamente a las nuevas vistas de control y movimientos.

Si aparece **Sin configurar**, revise `.env.local`. Para **403**, comparta el archivo con la cuenta Google activa. Un **404** indica ID o pestaña incorrectos. Las fechas inválidas, montos no reconocidos, encabezados faltantes e IDs duplicados se muestran sin exponer tokens.

## Datos de prueba seguros

Para preparar una validación, entregue un CSV/TSV anonimizado con los 15 encabezados y 10–20 filas representativas, junto con el nombre de pestaña, filas, locale y separador decimal. No comparta datos reales de donantes/proveedores ni credenciales.

## Límites de esta etapa

No hay escritura en Sheets, presupuestos, conciliación bancaria, saldos contables, backend, Supabase/PostgreSQL ni administración de usuarios. La interfaz seguirá funcionando como diagnóstico aunque Google no esté configurado; la conexión real requiere las variables locales y permisos de cada usuario.
