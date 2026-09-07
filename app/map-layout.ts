import type { Guest, Table } from './seating';

export type Size = { width: number; height: number };
export type Box = Size & { left: number; top: number };
export type ExpandedTable = Size & { surface: Box; seats: Box[] };

const gap = 8;
const labelHeight = (name: string, width: number, compact: boolean) =>
  Math.max(
    44,
    Math.ceil((name.length * (compact ? 7 : 8)) / (width - 20)) * 18 + 16,
  );

// These are the same seats, in the same order and orientation as the room plan.
// Only their dimensions and spacing change when names replace initials.
export function expandTable(
  table: Table,
  guests: Guest[],
  viewport: Size,
): ExpandedTable {
  const compact = viewport.width <= 480;
  const seatHeight = (name: string, width: number) =>
    labelHeight(name, width, compact);
  const name = (seat: number) =>
    guests.find((g) => g.tableId === table.id && g.seat === seat)?.name ??
    'Disponible';
  const width = Math.max(
    240,
    Math.min(table.horizontal ? 520 : 360, viewport.width - 24),
  );
  if (table.horizontal) {
    const seatWidth = (width - 3 * gap) / 4;
    const headWidth = Math.min(110, width * 0.25);
    const rowHeight = Math.max(
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((s) => seatHeight(name(s), seatWidth)),
    );
    const surfaceHeight = Math.max(
      104,
      seatHeight(name(0), headWidth),
      seatHeight(name(9), headWidth),
    );
    const height = 2 * (rowHeight + gap) + surfaceHeight;
    const surface = {
      left: headWidth + gap,
      top: rowHeight + gap,
      width: width - 2 * (headWidth + gap),
      height: surfaceHeight,
    };
    const seats = Array.from({ length: table.capacity }, (_, seat) => {
      if (seat === 0 || seat === 9)
        return {
          left: seat === 0 ? 0 : width - headWidth,
          top: rowHeight + gap,
          width: headWidth,
          height: surfaceHeight,
        };
      const index = seat <= 4 ? seat - 1 : seat - 5;
      return {
        left: index * (seatWidth + gap),
        top: seat <= 4 ? 0 : height - rowHeight,
        width: seatWidth,
        height: rowHeight,
      };
    });
    return { width, height, surface, seats };
  }
  const surfaceWidth = compact ? 88 : 96;
  const seatWidth = (width - surfaceWidth - 2 * gap) / 2;
  if (table.id === 'couple') {
    const rowHeight = Math.max(
      seatHeight(name(0), seatWidth),
      seatHeight(name(1), seatWidth),
    );
    const height = 2 * rowHeight + gap;
    return {
      width,
      height,
      surface: { left: seatWidth + gap, top: 0, width: surfaceWidth, height },
      seats: [0, 1].map((seat) => ({
        left: width - seatWidth,
        top: seat * (rowHeight + gap),
        width: seatWidth,
        height: rowHeight,
      })),
    };
  }
  const rowHeights = [1, 2, 3, 4].map((seat) =>
    Math.max(
      seatHeight(name(seat), seatWidth),
      seatHeight(name(seat + 4), seatWidth),
    ),
  );
  const headHeight = Math.max(
    seatHeight(name(0), seatWidth),
    seatHeight(name(9), seatWidth),
  );
  const surfaceHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) + 3 * gap;
  const height = surfaceHeight + 2 * (headHeight + gap);
  const surface = {
    left: seatWidth + gap,
    top: headHeight + gap,
    width: surfaceWidth,
    height: surfaceHeight,
  };
  const seats = Array.from({ length: table.capacity }, (_, seat) => {
    if (seat === 0 || seat === 9)
      return {
        left: (width - seatWidth) / 2,
        top: seat === 0 ? 0 : height - headHeight,
        width: seatWidth,
        height: headHeight,
      };
    const index = seat <= 4 ? seat - 1 : seat - 5;
    const top =
      surface.top +
      rowHeights.slice(0, index).reduce((sum, height) => sum + height + gap, 0);
    return {
      left: seat <= 4 ? 0 : width - seatWidth,
      top,
      width: seatWidth,
      height: rowHeights[index],
    };
  });
  return { width, height, surface, seats };
}

export function fitRoom(viewport: Size) {
  return Math.max(
    0.1,
    Math.min(1.15, (viewport.width - 24) / 960, (viewport.height - 24) / 760),
  );
}

export function roomGeometry(
  viewport: Size,
  scale: number,
  table?: Table,
  expanded?: ExpandedTable,
) {
  const mapWidth = 960 * scale,
    mapHeight = 760 * scale;
  // Add only the extra room needed to reveal edge seats, then pan the whole room.
  // The selected table's center never moves independently of the map.
  const extraLeft =
    table && expanded ? Math.max(0, expanded.width / 2 - table.x * scale) : 0;
  const extraRight =
    table && expanded
      ? Math.max(0, expanded.width / 2 - (960 - table.x) * scale)
      : 0;
  const extraTop =
    table && expanded ? Math.max(0, expanded.height / 2 - table.y * scale) : 0;
  const extraBottom =
    table && expanded
      ? Math.max(0, expanded.height / 2 - (760 - table.y) * scale)
      : 0;
  const width = Math.max(
    viewport.width,
    mapWidth + extraLeft + extraRight + 24,
  );
  const height = Math.max(
    viewport.height,
    mapHeight + extraTop + extraBottom + 24,
  );
  const left =
    extraLeft + 12 + (width - mapWidth - extraLeft - extraRight - 24) / 2;
  const top =
    extraTop + 12 + (height - mapHeight - extraTop - extraBottom - 24) / 2;
  const focus =
    table && expanded
      ? {
          left: left + table.x * scale - expanded.width / 2,
          top: top + table.y * scale - expanded.height / 2,
          width: expanded.width,
          height: expanded.height,
        }
      : null;
  return { width, height, left, top, focus };
}

export function revealAxis(
  scroll: number,
  start: number,
  size: number,
  viewport: number,
  content: number,
) {
  const next =
    size > viewport - 24
      ? start - 12
      : Math.min(start - 12, Math.max(scroll, start + size + 12 - viewport));
  return Math.max(0, Math.min(content - viewport, next));
}

export function dragThreshold(pointerType: string, dx: number, dy: number) {
  return Math.hypot(dx, dy) >= (pointerType === 'mouse' ? 6 : 12);
}

export function edgeScroll(position: number, start: number, end: number) {
  if (position < start || position > end) return 0;
  const edge = Math.min(44, (end - start) / 4);
  if (position < start + edge) return -10 * (1 - (position - start) / edge);
  if (position > end - edge) return 10 * (1 - (end - position) / edge);
  return 0;
}
