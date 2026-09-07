export type Guest = {
  id: string;
  name: string;
  tableId: string | null;
  seat: number | null;
};
export type Table = {
  id: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  horizontal?: boolean;
};
export const tables: Table[] = [
  { id: 't1', name: 'Mesa 01', capacity: 10, x: 265, y: 137, horizontal: true },
  { id: 't2', name: 'Mesa 02', capacity: 10, x: 717, y: 137, horizontal: true },
  ...[230, 400, 570, 740].map((x, i) => ({
    id: `t${i + 3}`,
    name: `Mesa 0${i + 3}`,
    capacity: 10,
    x,
    y: 312,
  })),
  ...[230, 400, 570, 740].map((x, i) => ({
    id: `t${i + 7}`,
    name: `Mesa ${String(i + 7).padStart(2, '0')}`,
    capacity: 10,
    x,
    y: 634,
  })),
  { id: 'couple', name: 'Mesa de la pareja', capacity: 2, x: 755, y: 472 },
];
const names: Record<string, string[]> = {
  t1: [
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
  ],
  t2: [
    'Juan David',
    'Gary',
    'Jessica',
    'Camila',
    'Nicolás',
    'Elías',
    'Fernanda',
    'Dayana',
  ],
  t3: [
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
  ],
  t4: [],
  t5: [
    'Sebastián',
    'Luisa',
    'Valentina',
    'Alicia',
    'Juan José',
    'Karen',
    'Cristian',
    'Sandra',
    'Juanita',
  ],
  t6: [
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
  ],
  t7: [
    'Lucho',
    'Nubia',
    'Sebastián',
    'Santiago',
    'Martín',
    'Giovanny',
    'Diana',
    'Saray',
    'Pablito',
    'Doña Cecilia',
  ],
  t8: [
    'Javier',
    'Clarena',
    'Nicolás',
    'Javier',
    'Daniela',
    'Elizabeth',
    'Tía Maruja',
    'Juan David',
    'Rosita',
    'Carmen',
  ],
  t9: [
    'Bonifacio',
    'Viviana',
    'Nicolás',
    'Marce',
    'Rigoberto',
    'Dora',
    'Jessica',
    'Daniel',
    'Carolina',
    'Miguel',
  ],
  t10: [
    'José',
    'Andrea',
    'Gio',
    'Blanca',
    'Ricardo',
    'Gladys',
    'Johana',
    'Horacio',
    'Luz Dary',
    'Hijo',
  ],
  couple: ['Mateo', 'Julieth'],
};
export const initialGuests: Guest[] = Object.entries(names)
  .flatMap(([tableId, list]) =>
    list.map((name, seat) => ({ name, tableId, seat })),
  )
  .map((g, i) => ({ ...g, id: `g${i + 1}` }));
while (initialGuests.length < 90)
  initialGuests.push({
    id: `g${initialGuests.length + 1}`,
    name: `Invitado ${initialGuests.length + 1}`,
    tableId: null,
    seat: null,
  });

export function validateGuests(value: unknown): value is Guest[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>(),
    occupied = new Set<string>();
  return value.every((g) => {
    if (
      !g ||
      typeof g.id !== 'string' ||
      !g.id.trim() ||
      g.id.length > 120 ||
      ids.has(g.id) ||
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      g.name.length > 70
    )
      return false;
    ids.add(g.id);
    if (g.tableId === null) return g.seat === null;
    if (typeof g.tableId !== 'string') return false;
    const t = tables.find((t) => t.id === g.tableId),
      key = `${g.tableId}:${g.seat}`;
    if (
      !t ||
      !Number.isInteger(g.seat) ||
      g.seat < 0 ||
      g.seat >= t.capacity ||
      occupied.has(key)
    )
      return false;
    occupied.add(key);
    return true;
  });
}
export function moveGuest(
  guests: readonly Guest[],
  id: string,
  tableId: string | null,
  seat?: number,
): { guests: Guest[]; changed: boolean; error?: string; swapped?: boolean } {
  const guest = guests.find((g) => g.id === id);
  if (!guest)
    return {
      guests: [...guests],
      changed: false,
      error: 'No encontramos ese invitado.',
    };
  if (tableId === null)
    return {
      guests: guests.map((g) =>
        g.id === id ? { ...g, tableId: null, seat: null } : g,
      ),
      changed: guest.tableId !== null,
    };
  const t = tables.find((t) => t.id === tableId);
  if (!t)
    return {
      guests: [...guests],
      changed: false,
      error: 'Esa mesa no existe.',
    };
  if (seat === undefined && guest.tableId === tableId)
    return { guests: [...guests], changed: false };
  const target =
    seat ??
    Array.from({ length: t.capacity }, (_, i) => i).find(
      (i) => !guests.some((g) => g.tableId === tableId && g.seat === i),
    );
  if (target === undefined)
    return {
      guests: [...guests],
      changed: false,
      error: `${t.name} está completa. Arrastra sobre una persona para intercambiar lugares.`,
    };
  if (!Number.isInteger(target) || target < 0 || target >= t.capacity)
    return {
      guests: [...guests],
      changed: false,
      error: 'Ese lugar no está disponible.',
    };
  const occupant = guests.find(
    (g) => g.tableId === tableId && g.seat === target,
  );
  if (occupant?.id === id) return { guests: [...guests], changed: false };
  return {
    guests: guests.map((g) =>
      g.id === id
        ? { ...g, tableId, seat: target }
        : g.id === occupant?.id
          ? { ...g, tableId: guest.tableId, seat: guest.seat }
          : g,
    ),
    changed: true,
    swapped: !!occupant,
  };
}
