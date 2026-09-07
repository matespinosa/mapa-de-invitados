import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier.startsWith('./') && !/\.[a-z]+$/i.test(specifier)
        ? `${specifier}.ts`
        : specifier,
      context,
    );
  },
});
const { createSeatingReport } = await import('../app/seating-export.ts');
const { initialGuests, moveGuest, tables } = await import('../app/seating.ts');
const date = new Date('2026-09-07T12:00:00Z');

test('export reflects current names, exact seats, additions, removals and unassigned people without mutating state', () => {
  const moved = moveGuest(initialGuests, 'g1', 't4', 3).guests;
  const guests = moved
    .filter((guest) => guest.id !== 'g3')
    .map((guest) =>
      guest.id === 'g1' ? { ...guest, name: 'Nombre actualizado' } : guest,
    );
  guests.push({ id: 'new', name: 'Nueva persona', tableId: null, seat: null });
  const before = structuredClone(guests);
  const report = createSeatingReport(guests, date);
  assert.match(report.svg, /Mesa 04 · Lugar 4 · Nombre actualizado/);
  assert.match(report.svg, /Mesa 01 · Lugar 1 · Disponible/);
  assert.doesNotMatch(report.svg, /Vicente/);
  assert.match(report.svg, /Nueva persona/);
  assert.match(report.svg, /Sin mesa/);
  for (const table of tables) assert.ok(report.svg.includes(table.name));
  assert.ok(
    report.svg.indexOf('PLANO DEL SALÓN') <
      report.svg.indexOf('Invitados por mesa'),
  );
  assert.deepEqual(guests, before);
});

test('guest names are escaped in image and print output', () => {
  const name = '<script>alert("&")</script>';
  const report = createSeatingReport(
    [{ id: 'test', name, tableId: 't1', seat: 0 }],
    date,
  );
  for (const output of [report.svg, report.printHtml]) {
    assert.ok(!output.includes('<script>'));
    assert.ok(output.includes('&lt;script&gt;'));
    assert.ok(output.includes('&amp;'));
  }
});

test('long names expand the image and print blocks; large unassigned lists remain paginated', () => {
  const normal = createSeatingReport(initialGuests, date);
  const guests = initialGuests.map((guest) => ({
    ...guest,
    name: 'W'.repeat(70),
  }));
  guests.push(
    ...Array.from({ length: 105 }, (_, i) => ({
      id: `new-${i}`,
      name: `Persona pendiente ${i}`,
      tableId: null,
      seat: null,
    })),
  );
  const report = createSeatingReport(guests, date);
  assert.ok(report.height > normal.height);
  assert.ok(report.svg.includes('Persona pendiente 104'));
  assert.ok(report.printHtml.includes('Sin mesa · continuación'));
  const blocks = [...report.printHtml.matchAll(/<svg[^>]+height="(\d+)"/g)].map(
    (match) => Number(match[1]),
  );
  // 190mm printable width scales 1040px to 190mm; no block exceeds A4 height.
  assert.ok(blocks.every((height) => (height * 190) / report.width < 277));
  assert.match(report.printHtml, /break-inside: avoid/);
});

test('an empty event still exports all tables and available seats', () => {
  const report = createSeatingReport([], date);
  assert.match(report.svg, /0 personas · 0 con lugar · 0 sin mesa/);
  assert.equal((report.svg.match(/<title>/g) ?? []).length, 102);
  assert.ok(report.svg.includes('Mesa de la pareja'));
});
