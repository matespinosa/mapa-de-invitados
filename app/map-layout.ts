export type Size = { width: number; height: number };
export type Box = Size & { left: number; top: number };

export function fitRoom(viewport: Size) {
  return Math.max(
    0.1,
    Math.min(1.15, (viewport.width - 24) / 960, (viewport.height - 24) / 760),
  );
}

// The plan is a navigator now: it only ever pans and zooms as a whole, so the
// geometry is the scaled room centred in whatever space is left for it.
export function roomGeometry(viewport: Size, scale: number) {
  const mapWidth = 960 * scale,
    mapHeight = 760 * scale;
  const width = Math.max(viewport.width, mapWidth + 24);
  const height = Math.max(viewport.height, mapHeight + 24);
  return {
    width,
    height,
    left: (width - mapWidth) / 2,
    top: (height - mapHeight) / 2,
  };
}

// Keep a table inside the viewport after the plan resizes around an open panel.
export function revealAxis(
  scroll: number,
  center: number,
  viewport: number,
  content: number,
) {
  return Math.max(0, Math.min(content - viewport, center - viewport / 2));
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
