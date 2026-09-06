# En su lugar

Organizador de recepción en React y TypeScript, basado en el diagrama proporcionado.

## Uso

- 90 registros de invitados: 89 nombres transcritos de la foto y «Invitado 90» pendiente de identificar. La transcripción es aproximada y editable.
- 10 mesas de 10 lugares, más la mesa de la pareja de 2. Es una interpretación del plano, no un plano a escala.
- Arrastra con el ratón desde la lista o un asiento para mover; suelta sobre una persona para intercambiar.
- Toca un nombre para editarlo y elegir una mesa. En móvil, usa «Ver invitados».
- Abre una mesa para ver sus lugares: agrega personas nuevas en puestos libres,
  quítalas de la mesa sin borrarlas del evento o elimínalas con confirmación.
- Búsqueda, filtro de personas sin mesa, vista por mesa, zoom y deshacer (40 cambios por sesión).
- El borrador se guarda en localStorage únicamente en ese navegador. No hay sincronización entre dispositivos.

## Desarrollo

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

```sh
npx tsc --noEmit
npm run build
```

El servidor de esta sesión se ejecuta desde `/private/tmp/recepcion-en-su-lugar`, debido a un problema de acceso del sistema a Documentos. El código se copia también al directorio del proyecto original. La foto se conserva en `public/plano-original.jpg`.

La revisión visual e interactiva se documenta en `design-qa.md`.

## Publicación en GitHub Pages

El repositorio incluye un workflow que genera la versión estática y la publica automáticamente en GitHub Pages cada vez que se actualiza `main`. El organizador mantiene los cambios en el navegador mediante `localStorage`; no sincroniza nombres ni movimientos entre dispositivos.
