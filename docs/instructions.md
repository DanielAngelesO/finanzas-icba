Quiero desarrollar una aplicación web ligera para gestionar las finanzas de una pequeña iglesia local.

La aplicación será utilizada por un máximo aproximado de 10 usuarios autorizados. En esta primera etapa, Google Sheets funcionará como almacenamiento de datos, pero la arquitectura debe estar desacoplada para permitir una futura migración a Supabase o PostgreSQL sin modificar la lógica del negocio, los indicadores ni los componentes visuales.

## 1. Objetivo de esta primera etapa

Implementar únicamente la base técnica de la aplicación:

1. Configuración del proyecto.
2. Configuración segura del acceso a Google Sheets.
3. Parametrización de archivos, hojas, rangos y columnas.
4. Capa de acceso a datos desacoplada.
5. Lectura y normalización de transacciones.
6. Consultas básicas para comprobar conexión, consistencia y estabilidad.
7. Pantalla técnica de diagnóstico.
8. Pruebas automatizadas básicas.
9. Documentación de instalación y configuración.

No desarrollar todavía un dashboard financiero completo ni gráficos avanzados. Primero se debe garantizar que la conexión con Google Sheets sea estable, segura, validada y reemplazable.

---

# 2. Stack tecnológico

Utilizar:

## Frontend

- React.
- Vite.
- TypeScript.
- React Router.
- Tailwind CSS.
- TanStack Query para consultas, caché, estados de carga y reintentos.
- Zod para validar respuestas de la API.
- Vitest para pruebas unitarias.

## Backend

React
│
▼
Google Identity (Login)
│
▼
Google Sheets API
│
▼
Google Sheets

Utilizar:

- Google Sheets API v4.
- Cliente oficial `googleapis`.
- Zod para validar variables de entorno y datos.
- Vitest para pruebas.
- Logger estructurado, preferentemente Pino.

No exponer credenciales de Google, claves privadas ni tokens en el frontend.

---

# 4. Arquitectura por capas

Implementar estas capas:

```text
Presentación
    React, páginas y componentes.

Aplicación
    Casos de uso y servicios de consulta.

Dominio
    Entidades, reglas y validaciones.

Infraestructura
    Google Sheets API, repositorios y adaptadores.
```

El flujo debe ser:

```text
React
    ↓
API REST
    ↓
Caso de uso
    ↓
TransactionRepository
    ↓
GoogleSheetsTransactionRepository
    ↓
Google Sheets API
```

La lógica de negocio nunca debe depender directamente de Google Sheets.

---

# 5. Patrón Repository

Crear esta interfaz principal:

```ts
export interface TransactionRepository {
  checkConnection(): Promise<DataSourceConnectionResult>;

  getMetadata(): Promise<TransactionDataSourceMetadata>;

  findAll(filters?: TransactionFilters): Promise<Transaction[]>;

  findById(id: string): Promise<Transaction | null>;

  count(filters?: TransactionFilters): Promise<number>;

  findRecent(limit: number): Promise<Transaction[]>;

  findByPeriod(period: string): Promise<Transaction[]>;

  getAvailablePeriods(): Promise<string[]>;
}
```

Los casos de uso deben depender exclusivamente de `TransactionRepository`, nunca de la implementación concreta.

---

# 6. Modelo de transacción

Los datos de Google Sheets tienen estas columnas:

1. ID
2. Fecha
3. Tipo Transacción
4. Cuenta
5. Categoría
6. Subcategoría
7. Descripción
8. Responsable
9. Donante / Proveedor
10. Método de Pago
11. Referencia / Comprobante
12. Monto
13. Estado
14. Período
15. Notas

Crear el modelo de dominio:

```ts
export type TransactionType = "INGRESO" | "EGRESO";

export interface Transaction {
  id: string;
  date: Date;
  type: TransactionType;
  account: string;
  category: string;
  subcategory: string | null;
  description: string;
  responsible: string;
  donorOrProvider: string | null;
  paymentMethod: string;
  referenceOrReceipt: string | null;
  amount: number;
  status: string;
  period: string;
  notes: string | null;
}
```

Agregar esquemas Zod para validar:

- La fila original de Google Sheets.
- La transacción normalizada.
- Los filtros de consulta.
- Las respuestas de la API.
- Las variables de entorno.

---

# 7. Parametrización de Google Sheets

No colocar nombres de hojas, posiciones de columnas ni rangos directamente dentro del repositorio.

Crear una configuración similar a:

```ts
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
  columnMapping: TransactionColumnMapping;
}
```

Crear el mapeo:

```ts
export interface TransactionColumnMapping {
  id: string;
  date: string;
  type: string;
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
```

La configuración por defecto debe mapear:

```ts
{
  id: "ID",
  date: "Fecha",
  type: "Tipo Transacción",
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
  notes: "Notas"
}
```

La aplicación debe detectar las columnas por el texto del encabezado y no solamente por posiciones como A, B, C o D.

Esto permitirá cambiar el orden de las columnas sin romper la lectura.

Debe validarse que todas las columnas obligatorias existan.

Columnas obligatorias:

- ID
- Fecha
- Tipo Transacción
- Cuenta
- Categoría
- Descripción
- Responsable
- Método de Pago
- Monto
- Estado
- Período

Columnas opcionales:

- Subcategoría
- Donante / Proveedor
- Referencia / Comprobante
- Notas

---

# 11. Adaptador de Google Sheets

Crear:

```text
GoogleSheetsClient
GoogleSheetsTransactionMapper
GoogleSheetsTransactionRepository
```

## GoogleSheetsClient

Responsable de:

- Crear el cliente autenticado.
- Consultar metadatos del archivo.
- Consultar las hojas disponibles.
- Leer rangos.
- Manejar errores de Google.
- Aplicar timeout.
- Aplicar reintentos controlados.
- Registrar duración de solicitudes.

## GoogleSheetsTransactionMapper

Responsable de:

- Relacionar encabezados con columnas.
- Convertir filas en objetos.
- Normalizar textos.
- Convertir fechas.
- Convertir montos.
- Normalizar tipos de transacción.
- Transformar celdas vacías a `null`.
- Detectar filas inválidas.
- Generar errores de validación comprensibles.

## GoogleSheetsTransactionRepository

Responsable de:

- Ejecutar consultas de transacciones.
- Usar el cliente y mapper.
- Aplicar filtros básicos.
- Excluir filas completamente vacías.
- Devolver objetos de dominio.
- No contener lógica visual.
- No contener lógica propia de React.

---

# 12. Normalización de datos

Implementar estas reglas iniciales.

## ID

- Convertir a texto.
- Eliminar espacios externos.
- No aceptar vacío.
- Detectar IDs duplicados.

## Fecha

Aceptar inicialmente:

- Fecha nativa devuelta por Google Sheets.
- `DD/MM/YYYY`.
- `YYYY-MM-DD`.

Normalizar internamente a `Date`.

No interpretar fechas ambiguas utilizando configuración regional inglesa.

Usar `America/Lima` como zona horaria predeterminada.

## Tipo de transacción

Normalizar estas variantes:

```text
Ingreso
INGRESO
ingreso
```

como:

```text
INGRESO
```

Y:

```text
Egreso
EGRESO
egreso
Gasto
GASTO
```

como:

```text
EGRESO
```

Cualquier otro valor debe marcarse como inválido.

## Monto

Aceptar ejemplos como:

```text
1250.50
1,250.50
1250,50
S/ 1,250.50
S/ 1250,50
```

La interpretación debe depender de la configuración regional y del separador decimal configurado.

El dominio siempre debe almacenar el monto como número positivo.

El signo financiero se determina por `type`, no por guardar egresos negativos.

## Período

Normalizar preferentemente al formato:

```text
YYYYMM
```

Ejemplo:

```text
202608
```

Si el período está vacío, en esta primera etapa puede derivarse de la fecha, pero debe registrarse una advertencia de validación.

## Textos

- Eliminar espacios al inicio y al final.
- Convertir cadenas vacías a `null` en campos opcionales.
- Mantener tildes y caracteres especiales.
- No convertir automáticamente descripciones a mayúsculas.

---

## Resumen financiero básico

Implementar solamente:

```ts
export interface BasicFinancialSummary {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
}
```

Fórmulas:

```text
income = suma de movimientos INGRESO
expense = suma de movimientos EGRESO
balance = income + expense

El "EGRESO" siempre se registra en negativo en la hoja de calculo
```

No duplicar estos cálculos en controladores, componentes o repositorios.

Toda la aplicación debe utilizar `GetBasicFinancialSummaryUseCase`.

---

## Estado general

- API disponible.
- Fuente configurada.
- Conexión con Google.
- Archivo accesible.
- Hoja accesible.
- Encabezados válidos.
- Última comprobación.
- Latencia.

## Configuración no sensible

- Proveedor: Google Sheets.
- ID parcialmente oculto.
- Nombre de hoja.
- Año activo.
- Estrategia anual.
- Fila de encabezado.
- Primera fila de datos.
- Zona horaria.
- Configuración regional.
- Modo de solo lectura.

## Validación

- Cantidad de filas.
- Filas válidas.
- Filas inválidas.
- IDs duplicados.
- Columnas faltantes.
- Advertencias.

## Acciones

- Probar conexión.
- Actualizar metadatos.
- Validar hoja.
- Cargar primeras 10 transacciones.
- Limpiar caché de lectura.

No permitir editar secretos desde el navegador en esta primera versión.

Mostrar estados claros:

```text
Sin configurar
Conectando
Conectado
Con advertencias
Error
```

---

# 19. Página de pruebas de datos

Crear:

```text
/diagnostico/transacciones
```

Debe permitir:

- Consultar las primeras 10 transacciones.
- Consultar las últimas 10 transacciones.
- Filtrar por período.
- Filtrar por ingreso o egreso.
- Buscar por ID.
- Mostrar el resumen básico.
- Ver la respuesta normalizada.
- Ver los errores de validación sin exponer secretos.
- Medir el tiempo de respuesta.

Incluir una tabla con:

```text
ID
Fecha
Tipo
Cuenta
Categoría
Descripción
Monto
Estado
Período
```

Esta pantalla será técnica y temporal, diseñada para verificar la integración antes de construir el dashboard definitivo.

---

# 20. Autorización de usuarios

Cada usuario inicia sesión con su cuenta de Google.
Después:
React obtiene un token OAuth.
Google verifica la identidad.
React lee el Sheet usando ese token.
No existe ninguna clave privada en tu aplicación.
¿Cómo controlar quién entra?

Opción A (muy simple)
Crear una lista de correos permitidos.
tesorero@iglesia.org
pastor@iglesia.org
contador@iglesia.org

Cuando alguien inicia sesión:
if (!allowedEmails.includes(user.email)) {
mostrar "No autorizado"
}

Si el login completo retrasa esta primera fase, dejar una interfaz preparada y documentar claramente que el entorno inicial es solo de desarrollo.

---

# 22. Pruebas automatizadas

Crear pruebas unitarias para:

## Mapper

- Mapea correctamente los 15 encabezados.
- Tolera cambios de orden en columnas.
- Detecta columnas obligatorias faltantes.
- Convierte fechas `DD/MM/YYYY`.
- Convierte fechas `YYYY-MM-DD`.
- Rechaza fechas inválidas.
- Convierte montos con coma decimal.
- Convierte montos con punto decimal.
- Elimina `S/`.
- Normaliza ingreso.
- Normaliza egreso y gasto.
- Detecta tipo inválido.
- Convierte cadenas vacías en `null`.
- Detecta IDs duplicados.

## Casos de uso

- Calcula ingresos.
- Calcula egresos.
- Calcula balance.
- Aplica filtros por período.
- Devuelve una transacción por ID.
- Maneja repositorio vacío.
- Propaga errores controlados.

## Repositorio

Preguntame e indicame como darte los datos del google sheet.

---

# 25. Calidad de código

Aplicar:

- TypeScript estricto.
- ESLint.
- Prettier.
- Nombres descriptivos.
- Funciones pequeñas.
- Sin `any`, salvo justificación puntual.
- Sin lógica financiera dentro de componentes React.
- Sin llamadas directas a Google Sheets desde React.
- Sin duplicación de fórmulas.
- Sin secretos en código.
- Sin valores de configuración dispersos.
- Sin dependencia del orden fijo de columnas.
- Sin mezclar objetos de Google Sheets con objetos del dominio.

---

# 26. Documentación

Crear un README que incluya:

1. Requisitos.
2. Instalación.
3. Variables de entorno.
4. Configuración de Google Cloud.
5. Configuración de la cuenta de servicio.
6. Forma correcta de compartir el Google Sheet.
7. Ejecución del frontend.
8. Ejecución de pruebas.
9. Prueba de conexión.
10. Diagnóstico de errores frecuentes.
11. Configurar Google Sheets.

Documentar errores frecuentes:

```text
Archivo no compartido con la cuenta de servicio.
ID de archivo incorrecto.
Nombre de hoja incorrecto.
Google Sheets API no habilitada.
Clave privada mal formateada.
Columnas obligatorias faltantes.
Fecha con formato inválido.
Monto con formato no reconocido.
```

---

# 27. Entregables de esta fase

Al finalizar, entregar:

1. Estructura completa del proyecto.
2. Frontend ejecutable.
3. Configuración validada.
4. Repositorio desacoplado.
5. Adaptador para Google Sheets.
6. Repositorio en memoria.
7. Endpoints de diagnóstico.
8. Pantalla de configuración.
9. Pantalla de pruebas.
10. Pruebas unitarias.
11. Pruebas de integración opcionales.
12. `.env.example`.
13. README.
14. Lista de decisiones arquitectónicas.
15. Lista de funcionalidades pendientes para la siguiente fase.

---

No consideres terminada la tarea si el proyecto no compila, el chequeo de tipos falla o las pruebas principales no pasan.

Alguna inconsistencia en la solictud, o contradicciones, o falta de definiciones, preguntame.


