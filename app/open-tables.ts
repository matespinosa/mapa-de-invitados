import { tables, type Guest, type Table } from './seating';

// The plan orients; the open tables edit. At most two tables stay open so a
// move always has a visible origin and a visible destination.
export const MAX_OPEN_TABLES = 2;

export function openTable(
  open: readonly string[],
  id: string,
  compare = false,
): string[] {
  if (!tables.some((table) => table.id === id)) return [...open];
  if (open.includes(id)) return [...open];
  if (!compare) return [id];
  return [...open, id].slice(-MAX_OPEN_TABLES);
}

export function closeTable(open: readonly string[], id: string): string[] {
  return open.filter((candidate) => candidate !== id);
}

export type TableSummary = {
  table: Table;
  occupied: number;
  free: number;
  full: boolean;
};

export function summarize(
  guests: readonly Guest[],
  table: Table,
): TableSummary {
  const occupied = guests.filter((g) => g.tableId === table.id).length;
  return {
    table,
    occupied,
    free: table.capacity - occupied,
    full: occupied >= table.capacity,
  };
}

export function tableStrip(guests: readonly Guest[]): TableSummary[] {
  return tables.map((table) => summarize(guests, table));
}

export type SeatRow = { seat: number; guest: Guest | null };

export function seatRows(guests: readonly Guest[], table: Table): SeatRow[] {
  return Array.from({ length: table.capacity }, (_, seat) => ({
    seat,
    guest:
      guests.find((g) => g.tableId === table.id && g.seat === seat) ?? null,
  }));
}

// What tapping a seat row means depends only on who is currently picked up.
export type RowAction = 'pick' | 'unpick' | 'place' | 'swap' | 'add';

export function rowAction(
  pickedId: string | null,
  row: Pick<SeatRow, 'guest'>,
): RowAction {
  if (!pickedId) return row.guest ? 'pick' : 'add';
  if (row.guest?.id === pickedId) return 'unpick';
  return row.guest ? 'swap' : 'place';
}
