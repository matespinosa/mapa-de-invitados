import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Use Node's native TypeScript support without changing the site's dependencies.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('./') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const {
  MAX_OPEN_TABLES,
  closeTable,
  openTable,
  rowAction,
  seatRows,
  summarize,
  tableStrip,
} = await import('../app/open-tables.ts');
const { tables, initialGuests, moveGuest } = await import('../app/seating.ts');

test('opening a table replaces the current one; comparing keeps two', () => {
  assert.deepEqual(openTable([], 't1'), ['t1']);
  assert.deepEqual(openTable(['t1'], 't5'), ['t5']);
  assert.deepEqual(openTable(['t1'], 't5', true), ['t1', 't5']);
  // Never more than two, and the oldest is the one that leaves.
  const three = openTable(['t1', 't5'], 't9', true);
  assert.equal(three.length, MAX_OPEN_TABLES);
  assert.deepEqual(three, ['t5', 't9']);
  // Re-opening an already open table is a no-op, so the pair never duplicates.
  assert.deepEqual(openTable(['t1', 't5'], 't5', true), ['t1', 't5']);
  assert.deepEqual(openTable(['t1'], 't1'), ['t1']);
  // An unknown table is ignored rather than opening an empty panel.
  assert.deepEqual(openTable(['t1'], 'nope', true), ['t1']);
  assert.deepEqual(closeTable(['t1', 't5'], 't1'), ['t5']);
  assert.deepEqual(closeTable(['t1'], 't5'), ['t1']);
});

test('a table summary matches the roster and every seat gets a row', () => {
  const strip = tableStrip(initialGuests);
  assert.equal(strip.length, tables.length);
  for (const { table, occupied, free, full } of strip) {
    const rows = seatRows(initialGuests, table);
    assert.equal(rows.length, table.capacity);
    assert.equal(rows.filter((row) => row.guest).length, occupied);
    assert.equal(free, table.capacity - occupied);
    assert.equal(full, occupied === table.capacity);
    // Rows are in seat order and each guest sits in the seat it claims.
    rows.forEach((row, index) => {
      assert.equal(row.seat, index);
      if (row.guest) {
        assert.equal(row.guest.tableId, table.id);
        assert.equal(row.guest.seat, index);
      }
    });
  }
  const mesa1 = tables.find((t) => t.id === 't1');
  assert.deepEqual(summarize(initialGuests, mesa1), {
    table: mesa1,
    occupied: 8,
    free: 2,
    full: false,
  });
  const mesa4 = tables.find((t) => t.id === 't4');
  assert.equal(summarize(initialGuests, mesa4).occupied, 0);
});

test('tapping a row picks up, seats, swaps or unpicks depending on who is held', () => {
  const someone = { id: 'g1' };
  const other = { id: 'g2' };
  assert.equal(rowAction(null, { guest: someone }), 'pick');
  assert.equal(rowAction(null, { guest: null }), 'add');
  assert.equal(rowAction('g1', { guest: someone }), 'unpick');
  assert.equal(rowAction('g1', { guest: null }), 'place');
  assert.equal(rowAction('g1', { guest: other }), 'swap');
});

test('moving between two open tables swaps in place and never loses a seat', () => {
  const mariana = initialGuests.find(
    (g) => g.name === 'Marina Quintero' && g.tableId === 't1',
  );
  assert.equal(mariana.seat, 5);
  // The PDF preserves the empty places 5, 9 and 10.
  const free = seatRows(
    initialGuests,
    tables.find((t) => t.id === 't5'),
  )
    .filter((row) => !row.guest)
    .map((row) => row.seat);
  assert.deepEqual(free, [4, 8, 9]);

  const seated = moveGuest(initialGuests, mariana.id, 't5', 9);
  assert.equal(seated.changed, true);
  assert.equal(seated.swapped, false);
  assert.equal(seated.guests.find((g) => g.id === mariana.id).tableId, 't5');
  assert.equal(summarize(seated.guests, tables[0]).free, 3);
  assert.equal(
    summarize(
      seated.guests,
      tables.find((t) => t.id === 't5'),
    ).free,
    2,
  );

  // Tapping an occupied row swaps the two people instead of displacing one.
  const karen = initialGuests.find((g) => g.tableId === 't5' && g.seat === 5);
  const swapped = moveGuest(initialGuests, mariana.id, 't5', 5);
  assert.equal(swapped.swapped, true);
  assert.equal(swapped.guests.find((g) => g.id === mariana.id).seat, 5);
  assert.equal(swapped.guests.find((g) => g.id === karen.id).tableId, 't1');
  assert.equal(swapped.guests.find((g) => g.id === karen.id).seat, 5);
  assert.equal(swapped.guests.length, initialGuests.length);
});
