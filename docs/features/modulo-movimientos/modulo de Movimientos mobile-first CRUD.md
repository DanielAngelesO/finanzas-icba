# Módulo de Movimientos mobile-first con CRUD auditado

## 1. Resultado esperado

Transformar `/movimientos` de un explorador de solo lectura en un módulo operativo para crear, consultar, editar y anular transacciones.

Decisiones cerradas:

- Mantener “Movimientos” como nombre de navegación y “transacción” para acciones y mensajes.
- Guardar nuevas operaciones directamente como confirmadas.
- Reemplazar la eliminación física por anulación obligatoriamente auditada.
- Permitir edición completa; los cambios financieros requieren confirmación adicional.
- Mostrar cada transferencia como una sola operación, aunque se persista en dos filas.
- Escribir directamente en Google Sheets.
- Incorporar pestañas de catálogos y columnas técnicas de auditoría.
- Mantener PEN, `es-PE` y `America/Lima`.

Criterios de éxito:

- Ingreso o egreso frecuente registrable desde una sola sheet, sin abrir “Más detalles”.
- Transferencia registrable indicando monto, fecha, cuenta origen y destino.
- Búsqueda local perceptiblemente inmediata —objetivo menor a 150 ms una vez cargados los datos—.
- Uso correcto desde 320 px, teclado, 200 % de zoom y temas claro/oscuro.
- Ninguna transferencia puede quedar con una sola fila válida.
- Un reintento por error de red nunca debe duplicar una operación.

## 2. Arquitectura de información y wireframes

### Navegación y rutas

- `/movimientos`: listado, períodos, búsqueda y filtros.
- `/movimientos/nueva`: editor de creación presentado como sheet.
- `/movimientos/:transactionId`: detalle.
- `/movimientos/:transactionId/editar`: editor.
- El botón Atrás del navegador cierra sheets y devuelve exactamente al período, búsqueda, filtros y posición del listado anterior.
- Mantener en URL: `period`, `q`, `type`, `category`, `account`, `status` y `sort`.

### Listado móvil

La cabecera actual de filtros se reemplaza por una barra compacta. El listado utilizará filas densas con divisores, no tarjetas grandes independientes.

```text
┌──────────────────────────────────────┐
│ Movimientos                 + Nueva  │
│  ‹       Agosto 2026 ▾          ›    │
│ [ Buscar monto, persona… ] [⚙ 2]     │
│ [Todos] [Ingresos] [Egresos] [Transf.]│
├──────────────────────────────────────┤
│ HOY · 14 AGOSTO                      │
│ ↓  Compra de materiales   −S/ 257.00 │
│    Caja chica · Materiales Confirmada│
│                                      │
│ ↔  Cuenta corriente → Caja S/ 470.00 │
│    Reposición de caja       Confirmada│
├──────────────────────────────────────┤
│ 12 AGOSTO                            │
│ ↑  Ofrenda dominical      +S/ 1,175  │
│    Cuenta corriente · Ofrendas       │
└──────────────────────────────────────┘
```

Comportamiento:

- El período inicia en el mes calendario actual.
- Las flechas cambian exactamente un mes; pulsar el nombre abre un selector mes/año.
- La búsqueda y los filtros trabajan siempre sobre el período visible, salvo que se retire el filtro de período.
- Los chips de tipo son de selección única. “Categoría” y filtros adicionales se abren en una bottom sheet.
- Las transferencias se agrupan por `Id Transacción` y muestran `origen → destino`, un único monto neutro azul y un solo estado.
- Una fila abre el detalle completo. No se exige pulsar un pequeño botón “Ver”.
- Las anuladas permanecen visibles para preservar trazabilidad, con monto neutro, menor énfasis y etiqueta “Anulada”.
- En móvil se cargan 30 operaciones y aparece “Mostrar más”; no se utiliza scroll infinito obligatorio.

### Creación y edición

```text
┌──────────────────────────────────────┐
│ Nuevo egreso                     ✕   │
│ [Ingreso] [Egreso] [Transferencia]   │
├──────────────────────────────────────┤
│ Monto                                │
│ S/ [ 0.00                         ]  │
│ Fecha                  [ Hoy, 14 ago ]│
│                                      │
│ Cuenta                 [ Caja chica ▾]│
│ Categoría              [ Materiales ▾]│
│ Subcategoría           [ Papelería  ▾]│
│ Método de pago         [ Tarjeta    ▾]│
│                                      │
│ Proveedor              [ Buscar…      ]│
│ Descripción            [ Compra…      ]│
│ Comprobante            [ F001-482     ]│
│                                      │
│ › Más detalles                       │
├──────────────────────────────────────┤
│                  [ Guardar egreso ]  │
└──────────────────────────────────────┘
```

Transferencia:

```text
┌──────────────────────────────────────┐
│ Nueva transferencia              ✕   │
│ [Ingreso] [Egreso] [Transferencia]   │
├──────────────────────────────────────┤
│ Monto              S/ [ 470.00 ]     │
│ Fecha                 [ Hoy, 14 ago ]│
│                                      │
│ Desde                  [ Cta. cte. ▾]│
│                         [ Intercambiar]│
│ Hacia                  [ Caja chica ▾]│
│                                      │
│ Descripción            [ Reposición… ]│
│ › Más detalles                       │
├──────────────────────────────────────┤
│             [ Guardar transferencia ]│
└──────────────────────────────────────┘
```

- Mobile: sheet casi completa, cabecera y acciones sticky, altura máxima `100dvh`.
- Tablet: formulario centrado de máximo 640 px.
- Desktop: drawer derecho de 520–560 px; el listado permanece visible detrás.
- No habrá edición inline en la tabla: un editor aislado reduce errores y acomoda correctamente los campos dinámicos.

### Detalle, edición y anulación

```text
┌──────────────────────────────────────┐
│ Egreso · Confirmada              ✕   │
│ −S/ 257.00                          │
│ Compra de materiales                 │
│ 14 ago 2026 · Caja chica             │
│                                      │
│ [ Editar ]  [ Duplicar ]  [ ⋯ ]     │
├──────────────────────────────────────┤
│ Clasificación                        │
│ Materiales · Papelería               │
│                                      │
│ Trazabilidad                         │
│ Librería Central · Tarjeta           │
│ Comprobante F001-482                 │
│                                      │
│ › Notas                              │
│ › Información del sistema            │
└──────────────────────────────────────┘
```

- “Información del sistema” contiene IDs, responsable, período, versión y auditoría; permanece colapsada.
- “Anular” abre un `alertdialog`, exige un motivo y explica el impacto.
- Copy: “Permanecerá en el historial y dejará de considerarse en los cálculos”.
- Una transferencia advierte: “Se anularán la salida y la entrada vinculadas”.
- Una anulada no puede editarse; sí puede verse y duplicarse.

## 3. Formulario dinámico y reglas de negocio

### Orden de campos

1. Tipo.
2. Monto y fecha.
3. Cuenta o cuentas.
4. Categoría, subcategoría y método de pago.
5. Donante/proveedor.
6. Descripción y comprobante.
7. “Más detalles”: notas.
8. Campos automáticos ocultos.

Esto coloca arriba los datos obligatorios y de mayor frecuencia, y evita que IDs o trazabilidad técnica ralenticen el registro.

| Campo | Ingreso | Egreso | Transferencia | Regla |
|---|---|---|---|---|
| Tipo | Ingreso | Egreso | Transferencia | Radio segmentado, obligatorio |
| Monto | Visible | Visible | Visible | Positivo, máximo 2 decimales; el adaptador aplica el signo |
| Fecha | Visible | Visible | Visible | Hoy por defecto; no se permiten fechas futuras |
| Cuenta | “Cuenta” | “Cuenta” | “Desde” y “Hacia” | Origen y destino deben ser distintos |
| Categoría | Visible | Visible | Oculta | Transferencia interna automática |
| Subcategoría | Dependiente | Dependiente | Oculta | Solo aparece si la categoría tiene opciones |
| Método de pago | Visible | Visible | Oculto | “Transferencia” automático en traslados |
| Donante/proveedor | “Donante” | “Proveedor” | Oculto | Opcional, buscable y con creación rápida |
| Descripción | Opcional | Opcional | Opcional | Placeholder adaptado al tipo |
| Comprobante | Oculto | Opcional | Oculto | Solo egresos |
| Notas | En “Más detalles” | En “Más detalles” | En “Más detalles” | Opcional |
| ID, responsable, estado, período | Ocultos | Ocultos | Ocultos | Calculados por el sistema |
| Id Transacción | Automático | Automático | Automático compartido | Identifica la operación lógica |

Valores inteligentes:

- Recordar por usuario y tipo la última cuenta, categoría, subcategoría y método usados correctamente.
- No reutilizar automáticamente monto, donante/proveedor, descripción, comprobante ni notas.
- “Registrar otro similar” conserva tipo, fecha, clasificación y método; limpia todos los datos sensibles o variables.
- “Duplicar” conserva el contenido intencionalmente, asigna fecha de hoy y genera IDs nuevos.
- El borrador se conserva en memoria ante errores o sesión vencida, pero no se almacena en `localStorage` ni se envía offline.

Cambios de tipo:

- Ingreso ↔ egreso conserva monto, fecha y cuenta; conserva categoría solo si está permitida para el nuevo tipo.
- Los datos incompatibles se limpian únicamente después de una confirmación explícita.
- Cambiar hacia o desde transferencia durante una edición anula la operación original y crea una corrección enlazada dentro del mismo lote atómico.
- Cambios de monto, fecha, cuenta o tipo muestran un resumen `valor anterior → valor nuevo` antes de guardar.

Validación y guardado:

- Validar al salir del campo y nuevamente al enviar.
- Al fallar, mostrar resumen superior y mover el foco al primer campo inválido.
- Mantener el botón estable con estados “Guardar…”, “Guardando…” y deshabilitado durante la escritura.
- No cerrar el editor hasta recibir confirmación de Sheets.
- Después del éxito: “Egreso registrado” o equivalente, con acción “Registrar otro similar”.

## 4. Sistema UI, búsqueda, estados y accesibilidad

### Componentes

- `PeriodNavigator`: botones anterior/siguiente y selector mes/año.
- `TransactionSearch`: búsqueda tokenizada, sin acentos y con montos normalizados.
- `QuickTypeFilters` y `TransactionFilterSheet`.
- `TransactionList`, `TransactionRow` y `TransactionTable`.
- `TransactionDetailSheet`, `TransactionEditorSheet` y `VoidTransactionDialog`.
- `CatalogPicker`: botón que abre selector buscable; evita construir un combobox pequeño difícil de usar en teléfono.
- `CurrencyInput`: texto con `inputmode="decimal"`, prefijo visual y valor accesible.
- `TransactionTypeControl`: `fieldset` con radios, no tabs simulados.
- Native `<dialog>`, `<button>`, `<input>`, `<textarea>` y `<input type="date">`; no introducir Radix o shadcn únicamente para este módulo.

### Búsqueda y filtros

- Buscar por ID físico, Id Transacción, descripción, categoría, subcategoría, cuenta, responsable, donante/proveedor, comprobante, notas y monto.
- Normalizar mayúsculas, diacríticos, espacios, moneda y separadores decimales.
- Combinar tokens con lógica AND: `servicios 552` debe encontrar una operación que contenga ambos datos.
- Actualizar `q` en la URL con `replace` después de 150 ms.
- Filtros adicionales: cuenta, categoría, estado y rango de fechas.
- Mostrar filtros aplicados como chips removibles y una única acción “Limpiar filtros”.
- Mantener orden predeterminado “Más recientes”; las opciones restantes serán fecha ascendente y monto ascendente/descendente.

### Diseño visual y movimiento

- Reutilizar tokens semánticos existentes para temas claro y oscuro.
- Ingreso: verde + flecha ascendente + texto “Ingreso”.
- Egreso: rojo + flecha descendente + texto “Egreso”.
- Transferencia: azul + flechas horizontales + texto “Transferencia”.
- Nunca depender exclusivamente del color.
- Objetivos táctiles mínimos de 44 × 44 px y separación mínima de 8 px.
- Animaciones CSS de 120–220 ms para presión, entrada de sheets, cambio de período y aparición de campos.
- No animar el contenido inicial ni utilizar movimiento continuo.
- `prefers-reduced-motion` convierte las transiciones en cambios instantáneos.

### Microcopy y estados

- Vacío del mes: “Aún no hay transacciones en agosto” + “Registrar primera transacción”.
- Sin coincidencias: “No encontramos movimientos con esos criterios” + “Limpiar filtros”.
- Error de carga: “No pudimos cargar los movimientos” + “Reintentar”.
- Error de escritura: “No se pudo guardar. Tus datos siguen aquí”.
- Sin permiso: “Tu cuenta puede consultar esta hoja, pero no editarla. Solicita acceso de Editor”.
- Sesión vencida: “Tu sesión de Google venció. Vuelve a autorizar para guardar”.
- Conflicto: “Esta transacción cambió desde que la abriste. Recarga para revisar la versión más reciente”.
- Catálogo inactivo: permitir conservarlo al editar, marcarlo “Inactivo” y exigir una opción activa solo si el usuario cambia ese campo.
- Skeletons con la misma geometría final; no spinners que desplacen contenido.

Accesibilidad:

- Jerarquía `h1 → h2`, regiones etiquetadas y listado semántico en móvil.
- Foco inicial en monto al abrir un tipo conocido; foco en el selector de tipo durante el primer uso.
- Escape cierra, devuelve el foco al activador y pregunta antes si existen cambios.
- Los errores se conectan mediante `aria-describedby`; guardado y resultados usan anuncios `polite` sin anunciar cada pulsación.
- `alertdialog` para anulación y cambios financieros.
- Validar contraste WCAG 2.1 AA, reflow a 320 px, 200 % de zoom, teclado completo y lectores de pantalla.

## 5. Implementación técnica, Sheets y verificación

### Tipos e interfaces públicas

```ts
type TransactionDraft =
  | IncomeTransactionDraft
  | ExpenseTransactionDraft
  | TransferTransactionDraft;

type LogicalTransaction =
  | SingleAccountTransaction
  | TransferTransaction;

interface TransactionActor {
  email: string;
  displayName: string | null;
}

interface TransactionRepository {
  findAll(filters?: TransactionFilters): Promise<LogicalTransaction[]>;
  getCatalogs(): Promise<TransactionCatalogs>;
  create(draft: TransactionDraft, actor: TransactionActor): Promise<LogicalTransaction>;
  update(
    transactionId: string,
    expectedVersion: number,
    draft: TransactionDraft,
    actor: TransactionActor,
  ): Promise<LogicalTransaction>;
  voidTransaction(
    transactionId: string,
    expectedVersion: number,
    reason: string,
    actor: TransactionActor,
  ): Promise<LogicalTransaction>;
}
```

- `ID`: identificador UUID de cada fila física.
- `Id Transacción`: UUID de la operación lógica; una transferencia comparte el mismo valor en sus dos filas.
- Para registros históricos sin `Id Transacción`, usar `ID` como fallback lógico.
- Normalizar estado en dominio a `CONFIRMED | PENDING | VOIDED`, aceptando las variantes textuales existentes.
- Las operaciones anuladas se excluyen de cálculos y análisis; no se cambia la semántica histórica de los registros pendientes.
- Agrupar transferencias antes de búsqueda, conteo, paginación y presentación.

### Estructura de Google Sheets

Mantener la pestaña `Transacciones` y añadir:

- `Creado En`, `Creado Por`.
- `Actualizado En`, `Actualizado Por`.
- `Versión`.
- `Anulado En`, `Anulado Por`, `Motivo Anulación`.
- `Corrige A`, `Corregida Por`.

Añadir pestañas:

- `Cuentas`: `ID`, `Nombre`, `Activa`, `Orden`.
- `Categorias`: `ID`, `Nombre`, `Tipo`, `Activa`, `Orden`.
- `Subcategorias`: `ID`, `Categoria ID`, `Nombre`, `Activa`, `Orden`.
- `Terceros`: `ID`, `Nombre`, `Rol`, `Activo`.
- `Metodos Pago`: `ID`, `Nombre`, `Activo`, `Orden`.

Los registros de Transacciones seguirán guardando nombres visibles para conservar compatibilidad con reportes y datos existentes; los IDs de catálogo estabilizan la selección en la interfaz. Inicializar los catálogos con los valores históricos normalizados y deduplicados.

### Escritura y concurrencia

- Cambiar OAuth de `spreadsheets.readonly` a `spreadsheets`; exige nuevo consentimiento y que los usuarios tengan permiso Editor. Este scope es sensible y cubre el archivo completo, no solo una pestaña. [Documentación oficial de scopes](https://developers.google.com/workspace/sheets/api/scopes)
- Implementar creación, edición y anulación con `spreadsheets.batchUpdate`, usando `appendCells` y `updateCells`.
- Crear las dos filas de una transferencia y actualizar/anular su par dentro de una única solicitud. Google garantiza que las suboperaciones válidas de un batch se aplican juntas de forma atómica. [Batch update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), [AppendCellsRequest](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#appendcellsrequest)
- Antes de editar, recargar las filas por ID y comparar `expectedVersion`. Si cambió, no sobrescribir y devolver un conflicto.
- Incrementar la misma versión en ambas filas de una transferencia.
- Generar el ID antes de enviar. Ante timeout, buscar ese ID antes de reintentar para convertir la operación en idempotente.
- Serializar escrituras en cada cliente y aplicar backoff truncado para `429` y errores temporales. [Límites y reintentos de Sheets](https://developers.google.com/workspace/sheets/api/limits)
- Después de una mutación exitosa: limpiar el snapshot del repositorio e invalidar consultas de movimientos, inicio, resumen, gastos y calidad de datos.
- No implementar cola offline.
- Si faltan pestañas, columnas o permisos, conservar toda la lectura y desactivar únicamente crear/editar/anular.

### Migración y límites

1. Crear copia de seguridad del archivo.
2. Añadir columnas técnicas y pestañas de catálogo.
3. Sembrar catálogos desde valores históricos.
4. Actualizar OAuth y permisos Editor.
5. Activar escritura mediante una bandera de configuración.
6. Pilotar con el equipo de tesorería antes de habilitarla para toda la allowlist.

Google Sheets permite edición concurrente, pero no ofrece un compare-and-swap real por fila; la versión reduce conflictos sin eliminar completamente una carrera entre lectura y escritura. Además, cualquier Editor puede modificar manualmente las columnas de auditoría, por lo que esta trazabilidad no es inmutable ni sustituye un backend contable.

### Pruebas y aceptación

- Unitarias: validación por tipo, período, signos, agrupación de transferencias, búsqueda, IDs, auditoría, versiones y exclusión de anuladas.
- Adaptador Sheets: payload de una fila; transferencia de dos filas; actualización y anulación atómicas; corrección de tipo; `401`, `403`, `429`, timeout, conflicto y reintento idempotente.
- Componentes: defaults, aparición/desaparición de campos, subcategorías dependientes, creación rápida de terceros, resumen de cambios y motivo obligatorio.
- Integración: crear, editar, duplicar y anular cada tipo; invalidación de reportes; URL, navegación Atrás, búsqueda y filtros.
- Accesibilidad: operación completa por teclado, foco de dialogs, anuncios, errores asociados y escaneo automatizado.
- Visual: 320, 390, 768, 1024 y 1440 px; temas claro/oscuro; 200 % de zoom; textos largos, montos grandes, teclado móvil, loading, vacío, error y reduced motion.
- Añadir Playwright sobre un modo review escribible y determinista; nunca usar la hoja real en E2E.
- Cierre obligatorio con `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y la nueva suite E2E.

Supuestos finales: un solo archivo de Sheets, moneda PEN, pocos editores concurrentes, sin adjuntos, aprobaciones, transacciones programadas, borrado físico, administración completa de catálogos ni auditoría legal inmutable.
