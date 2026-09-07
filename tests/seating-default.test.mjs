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

const { initialGuests, migrateLegacyDefault, tables, validateGuests } =
  await import('../app/seating.ts');

const namesAt = (tableId) =>
  initialGuests
    .filter((guest) => guest.tableId === tableId)
    .sort((a, b) => a.seat - b.seat)
    .map((guest) => guest.name);

test('the default seating matches the supplied reception plan', () => {
  assert.deepEqual(namesAt('t1'), [
    'Daniela',
    'Samuel',
    'Vicente',
    'Luis',
    'Efraín',
    'Mariana',
    'Blanca',
    'Mabel',
    'Julio',
    'Betty',
  ]);
  assert.deepEqual(namesAt('t2'), [
    'Juan David',
    'Gary',
    'Jessica',
    'Camila',
    'Nicolás',
    'Elías',
    'Fernanda',
    'Dayana',
  ]);
  assert.deepEqual(namesAt('t3'), [
    'Daniel',
    'Camilo',
    'Darío',
    'Marlen',
    'Cristian',
    'María José',
    'Milena',
    'Germán',
    'Geraldín',
    'Samuel',
  ]);
  assert.deepEqual(namesAt('t5'), [
    'Sebastián',
    'Luisa',
    'Valentina',
    'Alicia',
    'Juan José',
    'Karen',
    'Cristian',
    'Sandra',
    'Juanita',
  ]);
  assert.deepEqual(namesAt('t6'), [
    'Raúl',
    'Liliana',
    'Daniela',
    'Sara',
    'Miguel',
    'Jaime',
    'Aleja',
    'Sabine',
    'Malú',
    'Adriana',
  ]);
  assert.equal(namesAt('t4').length, 0);
  assert.equal(initialGuests.at(-1).name, 'Invitado 90');
  assert.equal(initialGuests.at(-1).tableId, null);
  assert.ok(validateGuests(initialGuests));
  assert.equal(tables.length, 11);
});

test('only an untouched previous default is migrated; saved edits are preserved', () => {
  const legacy = initialGuests.map((guest) => ({ ...guest }));
  const move = (id, name, tableId, seat) => {
    const guest = legacy.find((entry) => entry.id === id);
    Object.assign(guest, { name, tableId, seat });
  };
  move('g1', 'Samuel', 't1', 0);
  move('g2', 'Vicente', 't1', 1);
  move('g3', 'Luis', 't1', 2);
  move('g4', 'Efraín', 't1', 3);
  move('g5', 'Daniela', 't1', 4);
  move('g6', 'Mariana', 't1', 5);
  move('g7', 'Eliana', 't1', 6);
  move('g8', 'Mabel', 't1', 7);
  move('g9', 'Julio', 't1', 8);
  move('g10', 'Pedro', 't1', 9);
  move('g11', 'Gary', 't2', 0);
  move('g12', 'Yessi', 't2', 1);
  move('g13', 'Camila', 't2', 2);
  move('g14', 'Nicolás', 't2', 3);
  move('g15', 'Juan David', 't2', 4);
  move('g16', 'Elías', 't2', 5);
  move('g17', 'Fernanda', 't2', 6);
  move('g18', 'Dayana', 't2', 7);
  move('g45', 'Salomé', 't6', 7);
  const migrated = migrateLegacyDefault(legacy);
  assert.equal(migrated[0].name, 'Daniela');
  assert.equal(migrated[9].name, 'Betty');
  const edited = legacy.map((guest) => ({ ...guest }));
  edited[0].name = 'Cambio personal';
  assert.equal(migrateLegacyDefault(edited)[0].name, 'Cambio personal');
});
