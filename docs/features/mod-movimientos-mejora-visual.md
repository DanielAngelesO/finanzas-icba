# Mejora visual móvil de Movimientos

## Resumen

Transformar `/movimientos` en una vista edge-to-edge y más densa por debajo de 768 px. Tablet y escritorio conservarán el diseño contenido actual; la lógica financiera, rutas, filtros y sheets no cambiarán.

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
- No habrá cambios en APIs públicas, dominio, servicios, parámetros URL ni tipos compartidos. Sólo se ampliará la interfaz interna del control de búsqueda para expansión, cierre y foco.

## Pruebas

- Actualizar integración para cubrir apertura, autofoco, cierre con `Escape`, retorno de foco, persistencia de `q`, limpieza mediante chip y carga directa con búsqueda activa.
- Verificar que `Confirmada` no aparece visualmente en filas móviles, mientras `Pendiente` y `Anulada` sí; comprobar que lectores de pantalla siguen recibiendo el estado.
- Actualizar el flujo E2E móvil para abrir el buscador antes de escribir.
- Validar geometría edge-to-edge a 320, 390 y 767 px, y restauración contenida a 768, 1024 y 1440 px; mantener las pruebas de reflow al 200 % y ausencia de overflow horizontal.
- Añadir snapshots regionales deterministas del toolbar/listado a 390 y 768 px, con movimiento reducido.
- Ejecutar `format:check`, `lint`, `typecheck`, pruebas de integración, E2E de movimientos, escaneo Axe y `build`.

## Supuestos

- Se preservarán los cambios locales existentes en página, estilos y pruebas.
- No se modificará globalmente `AppShell`; el breakout será exclusivo de `/movimientos`.
- Se reutilizarán los tokens y dependencias actuales, sin incorporar una biblioteca visual nueva.
