# En su lugar

Organizador de recepción en React y TypeScript, basado en el diagrama proporcionado.

## Uso

- Datos actualizados con `mesas 1.pdf` y `Lista de invitados - Confirmacion.pdf`: 84 puestos ocupados según el plano, con los espacios vacíos conservados. Las confirmaciones sin coincidencia segura quedan sin mesa; no se incluyen las dos personas que indicaron que no asisten.
- Menú por persona: pollo, carne, vegetariano o por confirmar. Cada fila de la lista y cada asiento de una mesa abierta llevan un distintivo de color con la proteína; al tocarlo se cambia ahí mismo, sin abrir la ficha. En el aviso de asiento seleccionado la proteína aparece como un tag pequeño, de un solo color, junto al nombre. También se edita desde el lápiz de cada asiento o al abrir una persona sin mesa, y se elige al agregar una persona. El cambio entra en el deshacer y en las exportaciones. La distribución y los menús que trae el proyecto por defecto no cambian: el distintivo solo edita lo que ya está. Se guarda, se puede deshacer y aparece en las exportaciones. Jaime Ponce y Ana Marcela Cubides (pareja) quedan como registros separados sin mesa y con pollo.
- La conciliación y los nombres pendientes están documentados en `docs/actualizacion-pdfs.md`.
- 10 mesas de 10 lugares, más la mesa de la pareja de 2. Es una interpretación del plano, no un plano a escala.
- Arrastra con el ratón desde la lista o un asiento para mover; suelta sobre una persona para intercambiar.
- Toca un nombre para abrir su mesa y usa el lápiz para editarlo; si no tiene mesa, abre directamente su ficha. En móvil, usa «Ver invitados».
- Al seleccionar a alguien en el plano, el aviso muestra un tag de proteína junto al nombre y un lápiz para editar nombre, menú y mesa. La ficha se abre como ventana en escritorio y como hoja inferior en el teléfono. Para dejar a alguien sin mesa, arrástralo a «Dejar sin mesa» o elige «Sin mesa» en su ficha.
- Abre una mesa para ver sus lugares: agrega personas nuevas en puestos libres,
  quítalas de la mesa sin borrarlas del evento o elimínalas con confirmación.
- Búsqueda, filtro de personas sin mesa, vista por mesa, zoom y deshacer (40 cambios por sesión).
- Con la sesión abierta, arriba a la derecha aparece la foto de perfil de Google y el nombre de quien está usando el plano; al tocarla se ve el correo de la cuenta y se cierra la sesión.
- Para abrir el organizador hay que entrar con Google: es la única forma de iniciar sesión, no hay contraseña y por lo tanto no hay nada que recuperar. Solo las cuentas listadas en `app/allowed-accounts.ts` llegan al plano; el resto ve un aviso de plano privado. Quien ya entró desde ese dispositivo vuelve con su nombre y un solo toque. Los detalles están en `docs/guardar-con-google.md`.
- Con la sesión abierta, el plano se guarda en la cuenta de Google y se recupera en otros dispositivos al entrar con la misma cuenta. El borrador de cada dispositivo se conserva en localStorage como respaldo mientras una escritura está en curso.
- La plantilla original del proyecto se carga por defecto. Los cambios nuevos se guardan bajo una versión independiente del almacenamiento para que borradores antiguos no reemplacen la plantilla actual.
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

El repositorio incluye un workflow que genera la versión estática y la publica automáticamente en GitHub Pages cada vez que se actualiza `main`. Para que se pueda entrar, las cuatro variables `VITE_FIREBASE_*` deben estar configuradas en el repositorio; sin ellas la aplicación publica solo muestra la pantalla de entrada avisando que falta conectar Google.
