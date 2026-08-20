# Mejora visual móvil de Movimientos

## Resumen

Transformar `/movimientos` y sus superficies operativas en una experiencia edge-to-edge y más densa por debajo de 768 px. El detalle conservará su bottom sheet, el editor ocupará la pantalla completa y tablet/escritorio conservarán sus contenedores actuales; la lógica financiera, rutas, filtros y servicios no cambiarán.

## Cambios de implementación

- En `transactions-page.tsx`, reorganizar el toolbar móvil en una fila con navegador de período, búsqueda y filtros. El campo de búsqueda permanecerá montado pero oculto hasta pulsar el botón.
- Gestionar `searchOpen` con estas reglas: abrir y enfocar el input al pulsar; `Escape` o el botón de cierre lo ocultan y devuelven el foco; cerrar conserva `q` y su chip; una URL con `q` abre el campo inicialmente.
- Añadir `aria-expanded`, `aria-controls` y nombres accesibles al botón. Desde 768 px, ocultar el botón y mostrar siempre el buscador.
- En `styles.css`, romper únicamente el padding horizontal del shell en móvil: compensar 16 px hasta 639 px y 24 px entre 640–767 px. Toolbar y resultados ocuparán todo el viewport, sin borde exterior, radio ni sombra.
- Usar gutters internos de `0.75rem`, gaps de `0.5rem`, encabezados compactos y controles principales de al menos 44 px. Los filtros rápidos seguirán en una sola fila con scroll horizontal interno, sin desbordar la página.
- Desde 768 px, restaurar los contenedores, espaciado y buscador visible actuales; desde 1024 px, conservar la tabla de escritorio sin cambios.
- En `transaction-list.tsx`, mantener la agrupación continua por día, con encabezado de fondo sutil y separadores horizontales. Reducir cada fila móvil a concepto/monto y una segunda línea de contexto.
- Por debajo de 768 px, ocultar visualmente el estado `Confirmada`; mostrar `Pendiente` y `Anulada` como badges compactos en la línea secundaria. El estado completo seguirá incluido en el nombre accesible. Desde 768 px se conservará la presentación actual de estados.
- Mantener el FAB de creación y los estados de carga, error, vacío y “Mostrar más”, adaptándolos al ancho plano.
- En `transaction-detail-sheet.tsx`, mantener el bottom sheet móvil, aplanar el resumen, los campos y los desplegables con separadores, y dejar Editar, Duplicar y Anular después de toda la información del movimiento. La transacción anulada sólo mostrará Duplicar.
- En `transaction-editor-sheet.tsx`, aplicar el mismo ritmo compacto a crear, editar, duplicar y registrar similar. La cabecera y el guardado permanecerán fijos, los campos conservarán sus superficies interactivas y los marcadores obligatorios permanecerán en línea con sus etiquetas.
- Desde 768 px, restaurar tarjetas, grids, espaciado y geometría actuales del detalle y editor. Los estilos nuevos se mantendrán scoped para no modificar filtros, catálogos ni confirmaciones.
- No habrá cambios en APIs públicas, dominio, servicios, parámetros URL ni tipos compartidos. Sólo se ampliará la interfaz interna del control de búsqueda para expansión, cierre y foco.

## Pruebas

- Actualizar integración para cubrir apertura, autofoco, cierre con `Escape`, retorno de foco, persistencia de `q`, limpieza mediante chip y carga directa con búsqueda activa.
- Verificar que `Confirmada` no aparece visualmente en filas móviles, mientras `Pendiente` y `Anulada` sí; comprobar que lectores de pantalla siguen recibiendo el estado.
- Actualizar el flujo E2E móvil para abrir el buscador antes de escribir.
- Verificar que las acciones del detalle estén al final real del DOM, con orden de foco correcto, y que editar, duplicar y anular conserven sus flujos.
- Validar detalle y editor a 320, 390, 767, 768, 1024 y 1440 px; mantener las pruebas de reflow al 200 %, contenido largo y ausencia de overflow horizontal.
- Añadir snapshots regionales deterministas del toolbar/listado, detalle y editor a 390 y 768 px, con fecha y movimiento reducidos.
- Extender Axe y las pruebas de teclado al detalle, sus desplegables y el footer sticky del editor.
- Ejecutar `format:check`, `lint`, `typecheck`, pruebas de integración, E2E de movimientos, escaneo Axe y `build`.

## Supuestos

- Se preservarán los cambios locales existentes en página, estilos y pruebas.
- No se modificará globalmente `AppShell`; el breakout será exclusivo de `/movimientos`.
- El detalle móvil seguirá siendo bottom sheet; sólo se compactará y aplanará su contenido. La reubicación de acciones aplicará a todos los tamaños.
- El editor comparte el tratamiento visual entre alta, edición, duplicación y registro similar.
- Se reutilizarán los tokens y dependencias actuales, sin incorporar una biblioteca visual nueva.
