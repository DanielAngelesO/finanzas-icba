# Resumen financiero

El Resumen presenta en paralelo la lectura de aportes y la cifra contable total, para que el liderazgo pueda distinguirlos sin cambiar de pantalla:

1. Una barra de contexto fija reúne el período, el único alcance global, la fecha de corte y la regla de comparación.
2. Las tres tarjetas de ingreso siempre permanecen visibles: **Aportes** (diezmos + ofrendas), **Otros ingresos** e **Ingresos totales**. Aportes conserva el detalle permanente de diezmos y ofrendas; otros ingresos muestra su participación del total.
3. Egresos, resultado de aportes y resultado total se muestran de forma simultánea. Los dos resultados incluyen tasa de ahorro y saldo acumulado. El resultado total es el saldo contable; el resultado de aportes es un escenario analítico que mantiene todos los egresos.
4. El análisis se organiza en las pestañas `Período actual` y `Últimos 12 meses`. La primera inicia con ingresos frente a egresos y deja el ritmo acumulado por grupo en un detalle secundario. La segunda contiene la composición apilada de diezmos, ofrendas y otros, y los ingresos frente a egresos del alcance activo.
5. Después se mantienen categorías de ingreso, análisis de egresos y actividad reciente. Solo las categorías de ingreso reaccionan al alcance; egresos y actividad muestran todos los movimientos.

## Alcance global y URL

El alcance se deriva de `?income=contributions|all` y se conserva cuando cambia el período. Un valor ausente o inválido equivale a `contributions`:

- `CONTRIBUTIONS` / `income=contributions`: solo diezmos y ofrendas.
- `ALL` / `income=all`: total con otros ingresos.

El selector no solicita nuevos datos: modifica las visualizaciones y las categorías ya disponibles en el resumen. La tarjeta de ingresos totales nunca desaparece, incluso si el alcance activo es aportes.

`DIEZMOS` y `OFRENDAS` se detectan por categoría o subcategoría, normalizando mayúsculas, tildes, espacios y formas singular/plural. Cualquier otro ingreso pertenece a `OTROS`.

## Comparaciones y cálculos

Cada indicador principal informa el valor actual, el valor anterior, la diferencia monetaria y la variación porcentual. La diferencia es `actual − anterior`; la variación es `diferencia / |anterior|`. Si el valor anterior es cero, se muestra la diferencia monetaria y se indica que no existe base porcentual.

La tasa de ahorro se calcula por alcance como `(ingreso del alcance − todos los egresos) / ingreso del alcance`. Si uno de los períodos no registra ingresos, su comparación se comunica como `No comparable`; la diferencia de tasa usa puntos porcentuales.

Para el período más reciente, el período anterior se limita al mismo día de corte, usando el último día real de ese mes si es más corto. Para los períodos históricos se comparan ambos meses completos. El saldo acumulado se compara contra el saldo alcanzado al cierre o al mismo corte equivalente del período anterior.

## Accesibilidad y responsive

Las pestañas implementan flechas, Inicio/Fin, foco visible, `aria-selected` y paneles asociados. Los gráficos densos se desplazan dentro de su tarjeta y reciben foco; todos conservan una tabla equivalente para tecnologías de asistencia. Las tarjetas se distribuyen en una columna en teléfono, dos cuando hay espacio y tres en escritorio amplio.

La interfaz cubre estados sin aportes, sin otros ingresos, solo egresos, períodos previos sin movimientos, datos pendientes y cifras grandes sin depender solo del color para comunicar cambios.
