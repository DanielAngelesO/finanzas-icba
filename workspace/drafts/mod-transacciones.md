**Prompt mejorado (listo para copiar y pegar):**

---

Actúa como un diseñador de producto senior especializado en aplicaciones financieras (fintech / accounting apps) con más de 10 años de experiencia en interfaces mobile-first de alto nivel (nivel Nubank, Revolut, QuickBooks, Xero o bancos digitales líderes).

**Objetivo:**  
Diseña un prototipo de interfaz completo, responsivo y con enfoque prioritario en móvil para un **módulo de Transacciones** que permita registrar, visualizar, editar y eliminar:

- Ingresos
- Egresos
- Transferencias entre cuentas

El diseño debe ser extremadamente fácil, intuitivo y rápido de usar, especialmente en el registro y edición según el tipo de transacción. La navegación por períodos y la búsqueda de transacciones deben ser fluidas y casi instantáneas.

### Campos del sistema

| Campo                      | Comportamiento |
|---------------------------|----------------|
| ID                        | Automático (sistema) |
| Fecha                     | Por defecto hoy (editable) |
| Tipo Transacción          | Selección (Ingreso / Egreso / Transferencia) |
| Cuenta                    | Selección |
| Categoría                 | Selección |
| Subcategoría              | Selección (dependiente de Categoría, opcional) |
| Descripción               | Texto opcional |
| Responsable               | Automático (usuario logueado) |
| Donante / Proveedor       | Selección (cambia de nombre según tipo) |
| Método de Pago            | Selección |
| Referencia / Comprobante  | Texto o número (opcional y solo para egresos) |
| Monto                     | Numérico (con formato de moneda) |
| Estado                    | Automático (ej. Confirmada, Pendiente, Anulada…) |
| Período                   | Automático o calculado según fecha |
| Notas                     | Texto opcional |
| Id Transacción            | Automático (sistema) |

* Tambien analiza el orden de los campos para que ayude a la experiencia de usuario, tambien que campos no son necesario mostrar.

### Requisitos de experiencia de usuario (UX)

1. **Registro ultra-rápido e inteligente**  
   - El formulario debe adaptarse dinámicamente según el Tipo de Transacción (campos que aparecen/desaparecen o cambian de etiqueta).  
   - Flujo de registro en el menor número de pasos posible (idealmente una sola pantalla o con pasos muy cortos).  
   - Valores por defecto inteligentes y reutilización de datos frecuentes.

2. **Listado y navegación por períodos**  
   - Fácil cambio entre periodos (mes)
   - Filtros rápidos por tipo, categoría.
   - Búsqueda potente (por descripción, referencia, monto, donante/proveedor, etc.).

3. **Edición y eliminación**  
   - Edición inline o en modal/sheet fluido.  
   - Confirmación clara al eliminar (con opción de anular en lugar de borrar físico si es necesario).

4. **Estándares de diseño**  
   - Mobile-first (prioridad absoluta a teléfono).  
   - Diseño limpio, profesional, confiable y de alto estándar financiero.  
   - Tipografía legible, jerarquía clara, contraste adecuado, micro-interacciones sutiles.  
   - Uso inteligente de color (verde = ingreso, rojo = egreso, azul = transferencia, etc.).  
   - Accesibilidad (WCAG 2.1 AA mínimo).  

### Entregables que necesito

1. **Descripción detallada de la arquitectura de información** y flujos principales (registro, listado + filtros + períodos, edición, búsqueda).
2. **Wireframes / mockups en texto** de las pantallas clave (versión móvil prioritaria + notas de adaptación a tablet/desktop).
3. **Comportamiento dinámico del formulario** según tipo de transacción (qué campos se muestran, cómo cambian las etiquetas, validaciones).
4. **Recomendaciones de componentes UI** (botones, inputs, selects, bottom sheets, date pickers, etc.) y patrones de interacción.
5. **Propuesta de navegación por períodos** y sistema de búsqueda/filtros.
6. **Cualquier detalle de microcopy, empty states, estados de carga y errores** que haga la experiencia excepcional.


Haz el diseño lo más concreto y accionable posible, como si fuera la especificación que un equipo de desarrollo y diseño va a implementar. Prioriza usabilidad extrema y sensaciones de “esto se siente como una app financiera de primer nivel”.

---

borrador:6. **Prototipo en HTML, tailwindcss, y js** del diseno ui.
