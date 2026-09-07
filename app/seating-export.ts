import { tables, type Guest, type Table } from './seating';

const WIDTH = 1040;
const INK = '#48334f';
const MUTED = '#77667f';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
const text = (
  x: number,
  y: number,
  value: string,
  size = 16,
  color = INK,
  anchor = 'start',
) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${escape(value)}</text>`;
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = '#dacde1',
  radius = 8,
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const svg = (height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Arial, sans-serif"><rect width="100%" height="100%" fill="white"/>${body}</svg>`;

function seatPosition(table: Table, seat: number) {
  if (table.id === 'couple') return { x: 30, y: -34.5 + seat * 39 };
  const index = seat <= 4 ? seat - 1 : seat - 5;
  if (table.horizontal) {
    if (seat === 0) return { x: -95, y: -12 };
    if (seat === 9) return { x: 69, y: -12 };
    return { x: -60 + index * 31, y: seat <= 4 ? -62 : 37 };
  }
  if (seat === 0) return { x: -13, y: -94 };
  if (seat === 9) return { x: -13, y: 69 };
  return { x: seat <= 4 ? -77 : 51, y: -59 + index * 31 };
}

function drawMap(guests: readonly Guest[]) {
  let body = rect(143, 68, 704, 674, '#fdfbfe', '#c7b8ce', 0);
  body += '<path d="M143 210H847" stroke="#c7b8ce" stroke-width="3"/>';
  body += text(
    495,
    40,
    'PLANO DEL SALÓN · VISTA SUPERIOR',
    16,
    MUTED,
    'middle',
  );
  for (const x of [49, 862]) {
    body += rect(x, 85, 78, 80, '#f3f0f6');
    body += text(x + 39, 131, 'W.C.', 18, MUTED, 'middle');
  }
  body += rect(414, 110, 157, 36, '#f8f0e8', '#ddcec3');
  body += text(492, 134, 'BAR', 18, '#82634a', 'middle');
  body += text(492, 188, 'TERRAZA', 14, MUTED, 'middle');
  for (const [x, y] of [
    [310, 399],
    [632, 399],
    [201, 477],
    [310, 527],
    [632, 527],
  ])
    body += rect(x, y, 25, 25, '#eeebf0', '#d7d1dc', 2);
  body +=
    '<circle cx="498.5" cy="469.5" r="39.5" fill="#fbf0e9" stroke="#e3cbbd"/>';
  body += text(498.5, 475, 'PONQUÉ', 13, '#82634a', 'middle');
  for (const table of tables) {
    const occupants = guests.filter((guest) => guest.tableId === table.id);
    const couple = table.id === 'couple';
    const width = couple ? 41 : table.horizontal ? 122 : 86;
    const height = couple ? 85 : table.horizontal ? 60 : 122;
    let group = rect(
      -width / 2,
      -height / 2,
      width,
      height,
      couple ? '#f9ecef' : occupants.length ? '#f0e3f7' : '#ffffff',
    );
    group += text(
      0,
      -2,
      couple ? '♥' : table.name.replace('Mesa ', ''),
      couple ? 23 : 25,
      '#704680',
      'middle',
    );
    group += text(
      0,
      21,
      `${occupants.length}/${table.capacity}`,
      14,
      MUTED,
      'middle',
    );
    if (couple) group += text(0, 64, 'Pareja', 14, '#916274', 'middle');
    for (let seat = 0; seat < table.capacity; seat++) {
      const guest = occupants.find((person) => person.seat === seat);
      const { x, y } = seatPosition(table, seat);
      const initials =
        guest?.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => Array.from(part)[0])
          .join('') ?? '';
      group += `<g><title>${escape(`${table.name} · Lugar ${seat + 1} · ${guest?.name ?? 'Disponible'}`)}</title>`;
      group += rect(x, y, 26, 25, guest ? '#e6d4ef' : '#ffffff', '#c9b3d4', 6);
      group += text(
        x + 13,
        y + (guest ? 12 : 17),
        guest ? initials : String(seat + 1),
        guest ? 10 : 11,
        '#633a78',
        'middle',
      );
      if (guest)
        group += text(x + 13, y + 22, String(seat + 1), 8, MUTED, 'middle');
      group += '</g>';
    }
    body += `<g transform="translate(${table.x} ${table.y})">${group}</g>`;
  }
  body += text(
    495,
    775,
    'Asientos: iniciales y número de lugar · Blanco: disponible · Cuadrados grises: columnas',
    13,
    MUTED,
    'middle',
  );
  return `<g transform="translate(40 100)">${body}</g>`;
}

// Conservative glyph widths keep full names (including long unbroken words)
// inside the 238px text column without depending on a remote font or the DOM.
function wrapName(name: string): string[] {
  const lines: string[] = [];
  let line = '';
  const width = (value: string) =>
    Array.from(value).reduce(
      (sum, character) =>
        sum +
        (character.codePointAt(0)! > 255 || /[WM@]/.test(character)
          ? 16
          : /[ilI.,' !]/.test(character)
            ? 5
            : /[A-Z]/.test(character)
              ? 12
              : 10),
      0,
    );
  for (const character of Array.from(name)) {
    if (width(line + character) > 238) {
      const space = line.lastIndexOf(' ');
      if (space > 12) {
        lines.push(line.slice(0, space));
        line = line.slice(space + 1);
      } else {
        lines.push(line);
        line = '';
      }
    }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

type Section = {
  title: string;
  subtitle: string;
  people: { label: string; name: string }[];
};
export function createSeatingReport(
  guests: readonly Guest[],
  date = new Date(),
) {
  const unassigned = guests.filter((guest) => guest.tableId === null);
  const timestamp = date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const heading =
    text(40, 44, 'Recepción · Distribución de invitados', 28) +
    text(
      40,
      76,
      `${guests.length} personas · ${guests.length - unassigned.length} con lugar · ${unassigned.length} sin mesa`,
      16,
      MUTED,
    ) +
    text(1000, 76, timestamp, 14, MUTED, 'end');
  const sections: Section[] = tables.map((table) => ({
    title: table.name,
    subtitle: `${guests.filter((guest) => guest.tableId === table.id).length} de ${table.capacity} lugares ocupados`,
    people: Array.from({ length: table.capacity }, (_, seat) => ({
      label: String(seat + 1).padStart(2, '0'),
      name:
        guests.find(
          (guest) => guest.tableId === table.id && guest.seat === seat,
        )?.name ?? 'Disponible',
    })),
  }));
  // Bound each print block, even if a growing event has many unassigned people.
  for (let index = 0; index < unassigned.length; index += 10) {
    sections.push({
      title: index === 0 ? 'Sin mesa' : 'Sin mesa · continuación',
      subtitle: `${unassigned.length} ${unassigned.length === 1 ? 'persona' : 'personas'} por ubicar`,
      people: unassigned
        .slice(index, index + 10)
        .map((guest) => ({ label: '—', name: guest.name })),
    });
  }
  const rows: { height: number; body: string }[] = [];
  for (let index = 0; index < sections.length; index += 3) {
    let rowHeight = 0;
    const cards = sections.slice(index, index + 3).map((section, column) => {
      let y = 88;
      let content =
        text(20, 32, section.title, 20) +
        text(20, 57, section.subtitle, 14, MUTED);
      for (const person of section.people) {
        content += text(20, y, person.label, 13, MUTED);
        const lines = wrapName(person.name);
        for (const line of lines) {
          content += text(50, y, line, 16);
          y += 22;
        }
        y += 6;
      }
      const height = y + 8;
      rowHeight = Math.max(rowHeight, height);
      return `<g transform="translate(${40 + column * 326} 0)">${rect(0, 0, 308, height, '#fcfafe')}${content}</g>`;
    });
    rows.push({ height: rowHeight + 20, body: cards.join('') });
  }
  const map =
    heading +
    drawMap(guests) +
    text(40, 930, 'Invitados por mesa', 26) +
    text(40, 956, 'El número corresponde al lugar en el plano.', 16, MUTED);
  let height = 984;
  let body = map;
  for (const row of rows) {
    body += `<g transform="translate(0 ${height})">${row.body}</g>`;
    height += row.height;
  }
  height += 24;
  return {
    width: WIDTH,
    height,
    svg: svg(height, body),
    printHtml: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recepción - Distribución de invitados</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: white; }
      svg { display: block; width: 100%; height: auto; }
      .report-block { break-inside: avoid; page-break-inside: avoid; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body><div class="report-block">${svg(984, map)}</div>${rows.map((row) => `<div class="report-block">${svg(row.height, row.body)}</div>`).join('')}</body></html>`,
  };
}

export async function downloadSeatingPng(guests: readonly Guest[]) {
  const report = createSeatingReport(guests);
  // Stay below mobile canvas limits for unusually large guest lists.
  const scale = Math.min(
    2,
    8192 / report.height,
    Math.sqrt(16_000_000 / (report.width * report.height)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(report.width * scale);
  canvas.height = Math.ceil(report.height * scale);
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('No se pudo crear la imagen. Prueba la opción PDF.');
  const url = URL.createObjectURL(
    new Blob([report.svg], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error('No se pudo generar la imagen. Prueba la opción PDF.'),
        );
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(
                new Error(
                  'No se pudo guardar la imagen. Prueba la opción PDF.',
                ),
              ),
        'image/png',
      ),
    );
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `recepcion-distribucion-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function printSeatingPdf(guests: readonly Guest[]) {
  const frame = document.createElement('iframe');
  frame.title = 'Distribución de invitados para guardar en PDF';
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1040px;height:800px;border:0;';
  frame.setAttribute('aria-hidden', 'true');
  const loaded = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('No se pudo preparar el PDF. Intenta de nuevo.')),
      15_000,
    );
    frame.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
  });
  frame.srcdoc = createSeatingReport(guests).printHtml;
  document.body.appendChild(frame);
  try {
    await loaded;
    const printWindow = frame.contentWindow;
    if (!printWindow)
      throw new Error(
        'No se pudo abrir la impresión. Prueba descargar la imagen.',
      );
    await printWindow.document.fonts.ready;
    printWindow.addEventListener(
      'afterprint',
      () => window.setTimeout(() => frame.remove(), 1000),
      { once: true },
    );
    printWindow.focus();
    printWindow.print();
    // Some mobile browsers do not emit afterprint. Keep the document alive meanwhile.
    window.setTimeout(() => frame.remove(), 300_000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
