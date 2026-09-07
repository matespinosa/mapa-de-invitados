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

test('the default seating matches the supplied reception plan', () => {
  assert.deepEqual(namesAt('t1'), [
    'Daniela',
    'Samuel',
    'Vicente',
    'Luis',
    'Tefa',
    'Mariana',
    'Blanca',
    'Anaid',
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
