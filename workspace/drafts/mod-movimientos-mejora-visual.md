## Rediseñar la vista de movimientos para aprovechar mejor el espacio en móvil

El objetivo principal es **aprovechar mucho mejor el espacio vertical y horizontal disponible en dispositivos móviles**, evitando que el contenido se vea encerrado dentro de tarjetas con márgenes excesivos.

### Cambios de diseño solicitados

**1. Eliminar las cards contenedoras exteriores**

Actualmente existen contenedores tipo `card` alrededor de:

* El selector de período/mes.
* La lista completa de movimientos.

En móvil, quiero eliminar esos contenedores exteriores o hacerlos transparentes/planos.

La pantalla debe utilizar prácticamente todo el ancho disponible del viewport.

Evitar este patrón:

`viewport → margen → card redondeada → contenido`

Preferir:

`viewport → contenido full-width`

**2. Diseño edge-to-edge / full-width**

En mobile, los controles, encabezados y lista de movimientos deben aprovechar el ancho disponible.

Reducir al mínimo los márgenes laterales globales.

No quiero que cada sección parezca una tarjeta independiente flotando sobre el fondo.

Los bordes redondeados deben utilizarse solamente cuando tengan una función visual real, no como contenedor general de toda la pantalla.

**3. Lista de movimientos**

La lista debe ocupar prácticamente todo el ancho disponible.

No colocar todos los movimientos dentro de una card exterior.

Pero los movimientos deben formar una lista continua. Con una separacion sutil por dia.

**4. Reducir espacio vertical**

Optimizar el `padding` y `margin` vertical de:

* Encabezado del período.
* Filtros.
* Cada movimiento.
* Separadores.
* Información secundaria.

No quiero que la interfaz se vea comprimida, pero sí más densa y eficiente.

La prioridad en móvil es mostrar **más movimientos simultáneamente en pantalla**.

**5. Encabezado del período**

El período, por ejemplo:

`15 DE AGOSTO`

debe funcionar como un encabezado de sección de la lista, no como una card independiente.

Puede utilizar un fondo ligeramente diferente y un borde/separador horizontal para distinguirlo.

**6. Filtros**

Los filtros `Todos`, `Ingresos`, `Egresos`, `Transferencias`, etc. deben permanecer compactos y aprovechar el ancho disponible.

Si no caben horizontalmente, permitir desplazamiento horizontal (`horizontal scroll`) sin aumentar innecesariamente la altura.

El filtro de texto debe estar oculto en mobile, y mostrarse al presionar un boton de busqueda.


**7. Mantener la jerarquía visual**

Aunque eliminemos las cards exteriores, conservar claramente la separacion entre movimientos y secciones.

No sacrificar legibilidad para ahorrar espacio.

### Principio visual

Quiero acercarme al concepto:

* Más contenido visible.
* Menos espacio vacío.
* Menos contenedores.
* Menos márgenes laterales.
* Lista continua.
* Separadores en lugar de cards anidadas.
* Uso prácticamente completo del ancho del móvil.

**Importante:** este cambio debe aplicarse principalmente al breakpoint móvil. En tablet y desktop se puede mantener un diseño más contenido si resulta apropiado.

