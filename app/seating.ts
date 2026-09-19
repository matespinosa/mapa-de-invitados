import roster from './guest-roster';

export type Meal = 'chicken' | 'beef' | 'vegetarian';
export const mealLabels = {
  pending: 'Por confirmar',
  chicken: 'Pollo',
  beef: 'Carne',
  vegetarian: 'Vegetariano',
} as const;
export const mealLabel = (meal: Meal | null | undefined) =>
  mealLabels[meal ?? 'pending'];
export function mealSummary(guests: readonly Guest[]) {
  const counts = { chicken: 0, beef: 0, vegetarian: 0, pending: 0 };
  for (const guest of guests) counts[guest.meal ?? 'pending']++;
  return counts;
}

export type Guest = {
  id: string;
  name: string;
  meal?: Meal | null;
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
// Transcribed from mesas 1.pdf; full names and menus from Confirmacion.pdf.
export const initialGuests: Guest[] = roster;

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
      g.name.length > 70 ||
      (g.meal !== undefined &&
        g.meal !== null &&
        !['chicken', 'beef', 'vegetarian'].includes(g.meal))
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
