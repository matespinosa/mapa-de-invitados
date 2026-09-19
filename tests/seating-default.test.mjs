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

const { initialGuests, tables, validateGuests } =
  await import('../app/seating.ts');

const namesAt = (tableId) =>
  initialGuests
    .filter((guest) => guest.tableId === tableId)
    .sort((a, b) => a.seat - b.seat)
    .map((guest) => guest.name);

test('the PDF revision preserves occupancy and exact empty seats', () => {
  assert.deepEqual(
    tables.map((t) => namesAt(t.id).length),
    [8, 10, 7, 0, 7, 10, 10, 10, 10, 10, 2],
  );
  assert.deepEqual(
    initialGuests.filter((g) => g.tableId === 't1').map((g) => g.seat),
    [0, 1, 2, 3, 5, 6, 7, 8],
  );
  assert.deepEqual(
    initialGuests.filter((g) => g.tableId === 't3').map((g) => g.seat),
    [2, 3, 4, 6, 7, 8, 9],
  );
  assert.deepEqual(
    initialGuests.filter((g) => g.tableId === 't5').map((g) => g.seat),
    [0, 1, 2, 3, 5, 6, 7],
  );
  assert.equal(
    initialGuests.find((g) => g.tableId === 't6' && g.seat === 5).name,
    'Edilberto Cante',
  );
  assert.ok(validateGuests(initialGuests));
  assert.equal(tables.length, 11);
});

test('confirmed meals and explicit overrides are loaded without seating Jaime or Ana Marcela', () => {
  for (const name of ['Jaime Ponce', 'Ana Marcela Cubides (pareja)']) {
    const matches = initialGuests.filter((g) => g.name === name);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].meal, 'chicken');
    assert.equal(matches[0].tableId, null);
    assert.equal(matches[0].seat, null);
  }
  assert.equal(
    initialGuests.find((g) => g.name === 'Daniela Borie Cubillos').meal,
    'vegetarian',
  );
  assert.ok(
    !initialGuests.some((g) =>
      ['Juan José Díaz', 'Juanita Angel'].includes(g.name),
    ),
  );
  for (const name of ['Malú', 'Marce', 'Hijo', 'Nicolás', 'Invitado 90']) {
    assert.equal(initialGuests.find((g) => g.name === name).meal, null);
  }
});

test('meal validation accepts pending and legacy values but rejects unknown menus', () => {
  const guest = { id: 'test', name: 'Persona', tableId: null, seat: null };
  for (const meal of [undefined, null, 'chicken', 'beef', 'vegetarian']) {
    assert.ok(validateGuests([{ ...guest, meal }]));
  }
  for (const meal of ['fish', '', 3, {}]) {
    assert.equal(validateGuests([{ ...guest, meal }]), false);
  }
});

test('moving and swapping preserves individual meals and export includes all menu totals', async () => {
  const { moveGuest, mealSummary } = await import('../app/seating.ts');
  const { createSeatingReport } = await import('../app/seating-export.ts');
  const next = moveGuest(initialGuests, 'g1', 't6', 6).guests;
  assert.equal(next.find((g) => g.id === 'g1').meal, 'beef');
  assert.equal(
    next.find((g) => g.name === 'Daniela Borie Cubillos').meal,
    'vegetarian',
  );
  assert.deepEqual(mealSummary(next), {
    chicken: 32,
    beef: 53,
    vegetarian: 1,
    pending: 5,
  });
  const report = createSeatingReport(next);
  for (const output of [report.svg, report.printHtml]) {
    assert.match(
      output,
      /32 pollo · 53 carne · 1 vegetariano · 5 por confirmar/,
    );
    assert.match(output, /Vegetariano/);
    assert.match(output, /Por confirmar/);
  }
});
