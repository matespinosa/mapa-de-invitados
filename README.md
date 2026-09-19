# En su lugar

Organizador de recepción en React y TypeScript, basado en el diagrama proporcionado.

## Uso

- Datos actualizados con `mesas 1.pdf` y `Lista de invitados - Confirmacion.pdf`: 84 puestos ocupados según el plano, con los espacios vacíos conservados. Las confirmaciones sin coincidencia segura quedan sin mesa; no se incluyen las dos personas que indicaron que no asisten.
- Menú por persona: pollo, carne, vegetariano o por confirmar. Se puede editar desde el lápiz de cada asiento o al abrir una persona sin mesa, y elegir al agregar una persona. Se guarda, se puede deshacer y aparece en las exportaciones. Jaime Ponce y Ana Marcela Cubides (pareja) quedan como registros separados sin mesa y con pollo.
- La conciliación y los nombres pendientes están documentados en `docs/actualizacion-pdfs.md`.
- 10 mesas de 10 lugares, más la mesa de la pareja de 2. Es una interpretación del plano, no un plano a escala.
- Arrastra con el ratón desde la lista o un asiento para mover; suelta sobre una persona para intercambiar.
- Toca un nombre para abrir su mesa y usa el lápiz para editarlo; si no tiene mesa, abre directamente su ficha. En móvil, usa «Ver invitados».
- Abre una mesa para ver sus lugares: agrega personas nuevas en puestos libres,
  quítalas de la mesa sin borrarlas del evento o elimínalas con confirmación.
- Búsqueda, filtro de personas sin mesa, vista por mesa, zoom y deshacer (40 cambios por sesión).
- El borrador se guarda en localStorage únicamente en ese navegador. No hay sincronización entre dispositivos.
- La plantilla original del proyecto se carga por defecto; «Restablecer originales» permite recuperar esa distribución después de editarla. Los cambios nuevos se guardan bajo una versión independiente del almacenamiento para que borradores antiguos no reemplacen la plantilla actual.
- «Exportar» permite descargar una imagen PNG del plano completo y del listado por mesa, o abrir la impresión para elegir «Guardar como PDF» en páginas A4. Usa la distribución actual, con nombres editados, lugares numerados, puestos disponibles y personas sin mesa, independientemente del zoom o los filtros. Los archivos se generan en el navegador, sin servidor ni servicios externos, también en GitHub Pages.

## Abrir la aplicación en este Mac

```sh
npm install
npm run build
npm run preview
```

Abre `http://localhost:5173/`. Deja la terminal abierta mientras usas la app.
La vista previa sirve la versión compilada solo a este equipo y evita mezclar
archivos temporales de desarrollo en la caché del navegador. Para revisar el
código con recarga automática, usa:

```sh
npm run dev -- --host localhost --port 5174
```

Para abrir la aplicación desde otro dispositivo conectado a la misma red Wi‑Fi,
usa dos guiones normales y deja que el servidor anuncie la dirección de red:

```sh
npm run dev -- --host
```

También puedes indicar la dirección explícitamente con `--host 0.0.0.0`.

```sh
npx tsc --noEmit
node --test tests/*.test.mjs
```

La foto inicial se conserva en `public/plano-original.jpg`.

La revisión visual e interactiva se documenta en `design-qa.md`.

## Publicación en GitHub Pages

El repositorio incluye un workflow que genera la versión estática y la publica automáticamente en GitHub Pages cada vez que se actualiza `main`. El organizador mantiene los cambios en el navegador mediante `localStorage`; no sincroniza nombres ni movimientos entre dispositivos.
