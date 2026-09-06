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
const { expandTable, fitRoom, roomGeometry, revealAxis } =
  await import('../app/map-layout.ts');
const { captureGuestPointer, watchGuestDrag } =
  await import('../app/guest-drag.ts');
const { tables, initialGuests, moveGuest, validateGuests } =
  await import('../app/seating.ts');

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} ≠ ${expected}`);
const overlaps = (a, b) =>
  a.left < b.left + b.width - 0.01 &&
  a.left + a.width > b.left + 0.01 &&
  a.top < b.top + b.height - 0.01 &&
  a.top + a.height > b.top + 0.01;

test('expanded seats retain their table center, order and orientation without overlap', () => {
  for (const width of [286, 326, 358, 390, 768, 1120]) {
    for (const table of tables) {
      const view = { width, height: 400 };
      const layout = expandTable(table, initialGuests, view);
      assert.equal(layout.seats.length, table.capacity);
      close(layout.surface.left + layout.surface.width / 2, layout.width / 2);
      close(layout.surface.top + layout.surface.height / 2, layout.height / 2);
      assert.ok(layout.width <= width - 24);
      for (const [index, seat] of layout.seats.entries()) {
        assert.ok(seat.height >= 44);
        assert.ok(seat.left >= 0 && seat.top >= 0);
        assert.ok(seat.left + seat.width <= layout.width + 0.01);
        assert.ok(seat.top + seat.height <= layout.height + 0.01);
        assert.ok(
          !overlaps(seat, layout.surface),
          `${table.id}:${index} overlaps its table`,
        );
        for (const other of layout.seats.slice(index + 1))
          assert.ok(!overlaps(seat, other));
      }
      if (table.horizontal) {
        assert.ok(layout.seats[0].left < layout.surface.left);
        assert.ok(layout.seats[9].left > layout.surface.left);
        assert.ok(layout.seats[1].top < layout.surface.top);
        assert.ok(layout.seats[5].top > layout.surface.top);
      } else if (table.id !== 'couple') {
        assert.ok(layout.seats[0].top < layout.surface.top);
        assert.ok(layout.seats[9].top > layout.surface.top);
        assert.ok(layout.seats[1].left < layout.surface.left);
        assert.ok(layout.seats[5].left > layout.surface.left);
      }
    }
  }
});

test('every edge table remains reachable and fits in phone and desktop views at every zoom', () => {
  for (const width of [286, 326, 358, 390, 768, 1120]) {
    for (const height of [218, 400, 680]) {
      for (const zoom of [0.75, 1, 1.5, 2]) {
        const view = { width, height };
        assert.ok(960 * fitRoom(view) <= width - 24 + 0.01);
        for (const table of tables) {
          const scale = fitRoom(view) * zoom;
          const layout = expandTable(table, initialGuests, view);
          const room = roomGeometry(view, scale, table, layout);
          const bounds = room.focus;
          // The physical table remains at the same map coordinate.
          close((bounds.left + layout.width / 2 - room.left) / scale, table.x);
          close((bounds.top + layout.height / 2 - room.top) / scale, table.y);
          const left = revealAxis(
            0,
            bounds.left,
            bounds.width,
            width,
            room.width,
          );
          const top = revealAxis(
            0,
            bounds.top,
            bounds.height,
            height,
            room.height,
          );
          assert.ok(bounds.left - left >= 12 - 0.01);
          assert.ok(bounds.left + bounds.width - left <= width - 12 + 0.01);
          assert.ok(bounds.top - top >= 12 - 0.01);
          if (bounds.height <= height - 24)
            assert.ok(bounds.top + bounds.height - top <= height - 12 + 0.01);
          else assert.ok(bounds.top + bounds.height <= room.height - 12 + 0.01);
        }
      }
    }
  }
});

function setup() {
  const events = new EventTarget(),
    frames = new Map(),
    held = new Set();
  let guests = structuredClone(initialGuests),
    frameId = 0,
    destination = null;
  const calls = {
    start: [],
    drops: [],
    targets: [],
    outside: 0,
    cancel: 0,
    scroll: [],
  };
  const pointer = { current: null },
    suppressClick = { current: 0 };
  const capture = {
    setPointerCapture(id) {
      held.add(id);
    },
    hasPointerCapture(id) {
      return held.has(id);
    },
    releasePointerCapture(id) {
      held.delete(id);
    },
  };
  const cleanup = watchGuestDrag(
    {
      pointer,
      suppressClick,
      scroller: {
        current: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            right: 330,
            bottom: 400,
          }),
          scrollBy(x, y) {
            calls.scroll.push([x, y]);
          },
        },
      },
      start: (id) => calls.start.push(id),
      position() {},
      target: (...args) => calls.targets.push(args),
      drop(id, tableId, seat) {
        const result = moveGuest(guests, id, tableId, seat);
        if (result.changed) guests = result.guests;
        calls.drops.push(result);
      },
      outside() {
        calls.outside++;
      },
      end() {},
      cancel() {
        calls.cancel++;
        if (pointer.current)
          capture.releasePointerCapture(pointer.current.pointerId);
        pointer.current = null;
      },
    },
    {
      events,
      targetAt: () => destination,
      requestFrame(callback) {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelFrame(id) {
        frames.delete(id);
      },
    },
  );
  const event = (type, x, y, pointerId = 1, pointerType = 'touch') =>
    Object.assign(new Event(type, { cancelable: true }), {
      clientX: x,
      clientY: y,
      pointerId,
      pointerType,
      button: 0,
      isPrimary: pointerId === 1,
    });
  return {
    calls,
    pointer,
    held,
    suppressClick,
    cleanup,
    get guests() {
      return guests;
    },
    start(id = 'g1', type = 'touch') {
      captureGuestPointer(
        event('pointerdown', 100, 100, 1, type),
        capture,
        id,
        pointer,
      );
    },
    send(type, x, y, pointerId = 1) {
      const e = event(type, x, y, pointerId);
      events.dispatchEvent(e);
      return e;
    },
    target(tableId, seat) {
      destination = tableId ? { tableId, seat } : null;
    },
    tick() {
      const current = [...frames];
      frames.clear();
      for (const [, callback] of current) callback();
    },
    get frames() {
      return frames.size;
    },
  };
}

test('a brief touch with finger jitter remains a tap and does not move anyone', () => {
  const env = setup();
  env.start();
  assert.ok(
    env.held.has(1),
    'touch input must be captured, not rejected as non-mouse',
  );
  assert.equal(env.send('pointermove', 104, 105).defaultPrevented, false);
  env.send('pointerup', 104, 105);
  assert.equal(env.calls.start.length, 0);
  assert.equal(env.calls.drops.length, 0);
  assert.equal(env.suppressClick.current, 0);
  assert.equal(env.held.size, 0);
  assert.deepEqual(env.guests, initialGuests);
  env.cleanup();
});

test('touch drag transfers a guest to another table exactly once and suppresses the release click', () => {
  const env = setup();
  env.start();
  env.target('t4', 3);
  assert.equal(env.send('pointermove', 220, 200).defaultPrevented, true);
  env.send('pointerup', 220, 200);
  env.send('pointerup', 220, 200);
  assert.deepEqual(env.calls.start, ['g1']);
  assert.equal(env.calls.drops.length, 1);
  assert.equal(env.guests.find((g) => g.id === 'g1').tableId, 't4');
  assert.equal(env.guests.find((g) => g.id === 'g1').seat, 3);
  assert.ok(validateGuests(env.guests));
  assert.ok(env.suppressClick.current > Date.now());
  assert.equal(env.send('click', 220, 200).defaultPrevented, true);
  env.send('pointerdown', 120, 110);
  assert.equal(env.send('click', 120, 110).defaultPrevented, false);
  assert.equal(env.held.size, 0);
  assert.equal(env.frames, 0);
  env.cleanup();
});

test('dragging onto a person swaps places both within and between tables', () => {
  for (const tableId of ['t1', 't3']) {
    const env = setup();
    const other = env.guests.find((g) => g.tableId === tableId && g.seat === 1);
    env.start();
    env.target(tableId, 1);
    env.send('pointermove', 230, 240);
    env.send('pointerup', 230, 240);
    assert.equal(env.calls.drops[0].swapped, true);
    assert.equal(env.guests.find((g) => g.id === other.id).tableId, 't1');
    assert.equal(env.guests.find((g) => g.id === other.id).seat, 0);
    assert.ok(validateGuests(env.guests));
    env.cleanup();
  }
});

test('a full table requires a seat choice and never silently displaces someone', () => {
  const env = setup();
  env.start();
  env.target('t3');
  env.send('pointermove', 230, 240);
  env.send('pointerup', 230, 240);
  assert.ok(env.calls.drops[0].error);
  assert.deepEqual(env.guests, initialGuests);
  env.cleanup();
});

test('other fingers cannot hijack or end a drag; pointercancel and outside drops preserve seats', () => {
  const env = setup();
  env.start();
  env.target('t4');
  env.send('pointermove', 230, 240, 2);
  env.send('pointerup', 230, 240, 2);
  assert.equal(env.calls.start.length, 0);
  assert.ok(env.pointer.current);
  env.send('pointermove', 230, 240);
  env.send('pointercancel', 230, 240);
  assert.equal(env.calls.cancel, 1);
  assert.equal(env.calls.drops.length, 0);
  assert.deepEqual(env.guests, initialGuests);
  assert.equal(env.frames, 0);
  env.start();
  env.target(null);
  env.send('pointermove', 230, 240);
  env.send('pointerup', 230, 240);
  assert.equal(env.calls.outside, 1);
  assert.deepEqual(env.guests, initialGuests);
  env.cleanup();
});

test('the map pans at its edge during a touch drag and stops after release', () => {
  const env = setup();
  env.start();
  env.target('t4');
  env.send('pointermove', 325, 200);
  env.tick();
  assert.ok(env.calls.scroll[0][0] > 0);
  assert.equal(env.calls.scroll[0][1], 0);
  env.send('pointerup', 325, 200);
  env.tick();
  assert.equal(env.calls.scroll.length, 1);
  assert.equal(env.frames, 0);
  env.cleanup();
});

test('mouse dragging still works alongside touch input', () => {
  const env = setup();
  env.start('g1', 'mouse');
  env.target('t4');
  env.send('pointermove', 108, 100);
  env.send('pointerup', 108, 100);
  assert.equal(env.calls.start.length, 1);
  assert.equal(env.guests.find((g) => g.id === 'g1').tableId, 't4');
  env.cleanup();
});

test('disposing a view releases touch capture and stops pending drag work', () => {
  const env = setup();
  env.start();
  env.target('t4');
  env.send('pointermove', 325, 200);
  env.cleanup();
  env.tick();
  env.send('pointerup', 325, 200);
  assert.equal(env.held.size, 0);
  assert.equal(env.frames, 0);
  assert.equal(env.calls.drops.length, 0);
  assert.deepEqual(env.guests, initialGuests);
});

test('the roster accepts a new guest, assigns an exact seat, and preserves unassigned guests', () => {
  const added = {
    id: 'guest-test-1',
    name: 'Laura Martínez',
    tableId: null,
    seat: null,
  };
  const extended = [...initialGuests, added];
  assert.ok(validateGuests(extended));

  const placed = moveGuest(extended, added.id, 't4', 3);
  assert.equal(placed.error, undefined);
  assert.equal(placed.guests.at(-1).tableId, 't4');
  assert.equal(placed.guests.at(-1).seat, 3);
  assert.ok(validateGuests(placed.guests));

  const removedFromTable = moveGuest(placed.guests, added.id, null);
  assert.equal(removedFromTable.guests.at(-1).tableId, null);
  assert.equal(removedFromTable.guests.at(-1).seat, null);
  assert.ok(validateGuests(removedFromTable.guests));
});

test('deleting a guest is represented by a valid shorter roster', () => {
  const remaining = initialGuests.filter((guest) => guest.id !== 'g1');
  assert.equal(remaining.length, initialGuests.length - 1);
  assert.ok(validateGuests(remaining));
});
