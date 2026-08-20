# Finanzas ICBA

SPA financiera con un módulo mobile-first para consultar, crear, editar, duplicar y anular movimientos auditados sobre Google Sheets. No contiene un backend ni almacena claves privadas: cada usuario autoriza su propia sesión de Google.

## Requisitos e instalación

- Node.js 22+ y npm.
- Un proyecto de Google Cloud y un Google Sheet compartido como **Editor** con quienes deban escribir. Los usuarios Viewer conservan la consulta, pero no pueden crear, editar ni anular.

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

Ejecutar comprobaciones:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Revisión local sin Google

Para revisar una implementación sin iniciar sesión con Google, use:

```bash
npm run dev:review
```

Este comando levanta la aplicación únicamente en `127.0.0.1:5173`, inicia una identidad local
autenticada y carga datos sintéticos versionados de septiembre de 2025 a agosto de 2026. El aviso
visible **Modo revisión local** confirma que Google Sheets no se consulta. La fuente de datos aparece
como **Memoria** y contiene suficientes ingresos, egresos, transferencias emparejadas, filtros, tendencias, paginación y señales
de revisión para recorrer las pantallas. El repositorio de memoria es escribible y determinista, por
lo que permite verificar el CRUD sin tocar una hoja real.

El modo revisión solo está habilitado durante `vite dev`; no se puede generar ni desplegar con
`vite build --mode review`. Para validar la integración real de OAuth y Google Sheets, continúe
usando el flujo normal con `npm run dev` y las variables de `.env.local`.

Rutina recomendada después de cada cambio: ejecute `npm run dev:review`, revise Resumen,
Movimientos, Gastos, Calidad de datos y Fuente de datos en escritorio y móvil, y cierre con las
comprobaciones automatizadas del proyecto.

## Versionado de publicación

Antes de publicar, incremente la versión semántica con `npm run version:patch`,
`npm run version:minor` o `npm run version:major`, y confirme los cambios de
`package.json` y `package-lock.json`. La aplicación muestra la versión junto al
commit del build en las pantallas de acceso y navegación.

`npm run test:integration` queda reservado para una prueba real local y no se ejecuta por defecto.

## Google Cloud y Google Sheets

1. Cree o seleccione un proyecto en Google Cloud y habilite **Google Sheets API**.
2. Configure la pantalla de consentimiento OAuth. Si la app es externa y sigue en pruebas, añada los correos de los usuarios como test users.
3. Cree un OAuth 2.0 Client ID de tipo **Web application**.
4. Para desarrollo en el equipo anfitrión, añada `http://localhost:5173` como origen JavaScript autorizado. Google no acepta direcciones IP privadas como origen OAuth; para iniciar sesión desde otros dispositivos se necesita un dominio público que controle, servido por HTTPS, y registrar ese origen en Google Cloud. La URL LAN que muestre Vite sirve para probar la interfaz sin OAuth.
5. Copie únicamente el Client ID a `VITE_GOOGLE_CLIENT_ID`. No se usa ni se debe crear un client secret para esta SPA.
6. La aplicación solicita el scope `https://www.googleapis.com/auth/spreadsheets`. Los usuarios deberán volver a consentir después de migrar desde el scope de solo lectura.
7. Comparta el Sheet con cada usuario autorizado como Editor para habilitar el CRUD. Ese permiso es la barrera de acceso real; la allowlist de la aplicación solo evita intentos innecesarios.

Al cargar la app se intenta una autorización silenciosa: si el usuario ya autorizó la aplicación, mantiene una sesión activa de Google en el navegador y concedió el scope de Sheets, entra directamente sin pulsar el botón. Si Google no puede completarla sin interacción (primera vez, sesión cerrada o permisos revocados), se muestra el ingreso manual con consentimiento.

## Variables de entorno

Todos los valores `VITE_*` son visibles desde el navegador y no son secretos. Nunca agregue contraseñas, cookies, access tokens, service-account JSON ni client secrets.

| Variable                                                | Uso                                             |
| ------------------------------------------------------- | ----------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID`                                 | OAuth Client ID web de Google                   |
| `VITE_GOOGLE_SPREADSHEET_ID`                            | ID del archivo, extraído de su URL              |
| `VITE_GOOGLE_SHEET_NAME`                                | Nombre exacto de la pestaña de transacciones    |
| `VITE_GOOGLE_SHEETS_RANGE`                              | Rango de columnas, por defecto `A:Z`            |
| `VITE_GOOGLE_HEADER_ROW` / `VITE_GOOGLE_FIRST_DATA_ROW` | Filas del encabezado y de datos                 |
| `VITE_GOOGLE_TIMEZONE` / `VITE_GOOGLE_LOCALE`           | Por defecto `America/Lima` / `es-PE`            |
| `VITE_GOOGLE_DECIMAL_SEPARATOR`                         | Obligatorio: `.` o `,`                          |
| `VITE_ALLOWED_EMAILS`                                   | Correos separados por coma para la interfaz     |
| `VITE_ACTIVE_YEAR`                                      | Año visible en diagnóstico; opcional            |
| `VITE_TRANSACTION_WRITES_ENABLED`                       | `true` solo después de migrar y pilotar la hoja |

La hoja debe contener los encabezados definidos en `src/config/google-sheets.ts`; el orden puede variar. Son obligatorios `ID`, `Fecha`, `Tipo Transacción`, `Cuenta`, `Categoría`, `Responsable`, `Método de Pago`, `Monto`, `Estado` y `Período`. `Descripción`, `Subcategoría`, `Donante / Proveedor`, `Referencia / Comprobante` y `Notas` son opcionales para la lectura histórica. Para escribir también deben existir `Creado En`, `Creado Por`, `Actualizado En`, `Actualizado Por`, `Versión`, `Anulado En`, `Anulado Por`, `Motivo Anulación`, `Corrige A` y `Corregida Por`.

Los estados se normalizan internamente a `CONFIRMED`, `PENDING` y `VOIDED`. Las operaciones anuladas siguen visibles y auditables, pero quedan fuera de los cálculos financieros y análisis.

### Transferencias entre cuentas

Use `Transferencia` como valor de `Tipo Transacción` y añada la columna condicional `Id Transaccion`. Cada traslado requiere exactamente dos filas con IDs de fila distintos: el mismo `Id Transaccion`, el mismo período, cuentas distintas y montos iguales al centavo. Registre el origen con monto negativo y el destino con monto positivo. Las fechas pueden diferir dentro del período.

Las transferencias válidas aparecen en Movimientos y modifican el saldo por cuenta, pero no se cuentan como ingreso, egreso, resultado, tasa de ahorro ni tendencia financiera. Si falta la columna en una hoja sin transferencias, la carga continúa normalmente. Si una transferencia no tiene ID, pareja o coherencia, se excluye completo el grupo y sus filas aparecen en Calidad de datos.

## Pantallas

- `/`: vista ejecutiva del período más reciente, con fecha de corte, selector compacto `?period=YYYYMM` y filtro de aportes. Presenta resultado, ingresos, egresos, saldo acumulado y el saldo por cuenta histórico a la fecha de corte. Este último incluye ingresos, egresos y transferencias, parte de cero y no cambia al filtrar solo aportes. A continuación muestra el pulso financiero de doce meses y el acceso al resumen detallado.
- `/gastos`: análisis de egresos por rango móvil, cuenta, categoría, subcategoría, proveedor, responsable, método y estado. Incluye comparación con el período anterior equivalente, trazabilidad de comprobantes, concentración, señales conservadoras para revisión y detalle paginado. No sustituye un presupuesto, una conciliación ni una auditoría.
- `/movimientos`: listado mobile-first con período, búsqueda, chips por tipo, filtros avanzados y paginación incremental.
- `/movimientos/nueva`: alta de ingreso, egreso o transferencia en una sheet responsive.
- `/movimientos/:transactionId`: detalle de una operación lógica; una transferencia se presenta como una sola operación aunque ocupe dos filas físicas.
- `/movimientos/:transactionId/editar`: edición con versión esperada, resumen de cambios financieros y corrección auditada cuando cambia el tipo.
- `/control/calidad`: conteos de validación y problemas por fila.
- `/control/fuente`: conexión y metadatos no sensibles de la fuente.

Las rutas anteriores `/diagnostico` y `/diagnostico/transacciones` se redirigen automáticamente a las nuevas vistas de control y movimientos.

### Método de análisis de gastos

`/gastos` parte de los últimos doce meses disponibles, salvo que la URL indique `from=YYYYMM` y `to=YYYYMM`. La comparación histórica cubre el intervalo inmediatamente anterior de la misma duración y conserva los mismos filtros analíticos. El promedio mensual incluye meses sin egresos; la cobertura documental es el monto con `Referencia / Comprobante` registrado entre el gasto total; y la concentración del proveedor principal se calcula sobre todo el gasto del rango.

Las señales de revisión se limitan a referencias ausentes, pagos registrados como `Efectivo` o `Cash`, y referencias repetidas después de normalizar mayúsculas, espacios y diacríticos. Son ayudas de revisión operativa, no evidencias de fraude ni validaciones tributarias.

Si aparece **Sin configurar**, revise `.env.local`. Para **403**, comparta el archivo con la cuenta Google activa. Un **404** indica ID o pestaña incorrectos. Las fechas inválidas, montos no reconocidos, encabezados faltantes e IDs duplicados se muestran sin exponer tokens.

## Migración segura para habilitar escrituras

La lectura se mantiene disponible si falta cualquier requisito de escritura. Complete esta secuencia antes de activar la bandera:

1. Cree una copia de seguridad del archivo.
2. Añada las columnas técnicas indicadas arriba a `Transacciones`.
3. Cree y siembre, deduplicando valores históricos, estas pestañas:
   - `Cuentas`: `ID`, `Nombre`, `Activa`, `Orden`.
   - `Categorias`: `ID`, `Nombre`, `Tipo`, `Activa`, `Orden`.
   - `Subcategorias`: `ID`, `Categoria ID`, `Nombre`, `Activa`, `Orden`.
   - `Terceros`: `ID`, `Nombre`, `Rol`, `Activo`.
   - `Metodos Pago`: `ID`, `Nombre`, `Activo`, `Orden`.
4. Actualice el consentimiento OAuth y conceda permiso Editor solo a quienes corresponda.
5. Pruebe primero con `VITE_TRANSACTION_WRITES_ENABLED=false`; la pantalla Fuente de datos explicará cualquier requisito faltante.
6. Active `VITE_TRANSACTION_WRITES_ENABLED=true` y pilote con tesorería antes de extenderlo a toda la allowlist.

Las mutaciones se serializan en el cliente, usan un único `spreadsheets.batchUpdate` y comprueban la versión más reciente. Las dos filas físicas de una transferencia se crean, actualizan o anulan en el mismo lote. Un ID generado antes del envío permite verificar un resultado incierto tras un timeout sin duplicarlo.

## Datos de prueba seguros

Para preparar una validación, entregue un CSV/TSV anonimizado con los encabezados configurados y 10–20 filas representativas, junto con el nombre de pestaña, filas, locale y separador decimal. Incluya `Id Transaccion` si existen transferencias. No comparta datos reales de donantes/proveedores ni credenciales.

## Límites de esta etapa

No hay cola offline, presupuestos, conciliación bancaria, saldos contables certificados, backend, Supabase/PostgreSQL ni administración de usuarios. Google Sheets no ofrece compare-and-swap real por fila: la versión reduce conflictos, pero no elimina por completo la carrera entre lectura y escritura. Además, un Editor puede alterar manualmente la auditoría; esta trazabilidad no es inmutable ni sustituye un backend contable. El saldo por cuenta es un cálculo derivado del historial válido, no una conciliación bancaria. La cobertura documental de `/gastos` verifica que existe una referencia registrada, no la validez del comprobante.
