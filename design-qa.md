# Revisión del arrastre de puestos — 2026-09-19

final result: passed

Alcance: restaurar interacción en el plano existente, conservando su diseño; no recrear la captura ni rediseñar la aplicación.

Referencia: `/var/folders/7y/jrz7vkm90jz146xmd_5fttdh0000gn/T/codex-clipboard-6025488c-f3e0-4075-b250-63d9cbef2518.png` (1344 × 1026, recorte del plano).
Implementación: http://localhost:5173/, capturas del navegador incluidas en la conversación, escritorio 1280 × 900 y móvil 390 × 844. La referencia es un recorte ampliado: comparación de la región del plano por proporciones, no una comparación píxel a píxel de la página completa. No se guardó archivo de captura adicional.

## Hallazgos y corrección

- Corregido: puestos sin eventos y con `pointer-events: none` impedían comenzar un arrastre o apuntar a un puesto exacto. Ahora son botones con captura del puntero y destino individual.
- Corregido: `touch-action: manipulation` permitía al navegador cancelar el arrastre para desplazar la página. Los puestos ocupados reservan el gesto para mover; el fondo mantiene desplazamiento.
- Corregido: las mesas llenas se atenuaban aunque sus puestos permiten intercambios.

## Verificación

- Navegador de escritorio: Daniela de Mesa 01/lugar 1 a Mesa 04/lugar 1; intercambio con Juan David en Mesa 02/lugar 1; Deshacer después de cada operación. Resultados visibles correctos.
- Vista móvil: selección y colocación con dos pulsaciones; Deshacer al terminar. Distribución original conservada.
- Pruebas automatizadas: 24 aprobadas, incluyendo puntero táctil, intercambio, cancelación, múltiples dedos y desplazamiento en bordes. TypeScript y compilación aprobados.
- Consola del navegador: sin errores registrados.
- Límite de verificación: no se probó el gesto en un teléfono físico; cobertura táctil mediante pruebas del controlador.

## Revisión visual del cambio

Tipografía, paleta, radios, distribución de mesas, iniciales e iconos existentes conservados. El botón elimina padding nativo y hereda la fuente para mantener la geometría de cada puesto. No se añadieron imágenes. El estado enfocado ahora es visible y las mesas completas siguen legibles durante el movimiento. El mapa móvil conserva zoom y desplazamiento para alcanzar puestos pequeños.

No quedan hallazgos bloqueantes dentro del alcance de esta corrección.

## Revisión posterior: claridad móvil y selección

Referencia adicional: captura del usuario `Downloads/En su lugar · Organiza tu recepción.png`, 1206 × 2622, incluyendo controles de Safari. Verificación de la aplicación compilada en navegador a 402 × 780 CSS px (sin controles de Safari) y escritorio a 1280 × 900. Capturas disponibles en la conversación. Se comparó la región de la aplicación: la diferencia de encuadre impide una comparación píxel a píxel.

Se corrigieron el solapamiento de «Sin mesa» con Cancelar, el panel que tapaba el mapa en modo «Solo mapa» y la selección casi invisible. El puesto seleccionado ahora tiene fondo sólido, aro y animación breve, con alternativa sin animación según la preferencia del sistema. El aviso identifica a la persona y explica destinos vacíos y ocupados; se eliminó el toast redundante. En la vista móvil inicial las mesas quedan debajo del mapa, sin superposición fija.

Prueba visible: seleccionar Blanca Quintero, moverla a Mesa 04/lugar 1 y deshacer. Distribución conservada. Cancelación y salida del modo mapa verificadas. Tipografía, iniciales y paleta existentes conservadas; controles separados y zoom visible. TypeScript y compilación aprobados; sin errores de consola en la vista compilada. El servidor dev activo conserva estilos anteriores: requiere reinicio para servir todos los cambios. No se verificó Safari físico desde este entorno.
