import { dragThreshold, edgeScroll } from './map-layout';

export type GuestPointer = {
  id: string;
  pointerId: number;
  pointerType: string;
  capture: HTMLElement;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  moved: boolean;
};
type Ref<T> = { current: T };
export function releaseGuestPointer(pointer: Ref<GuestPointer | null>) {
  const p = pointer.current;
  pointer.current = null;
  if (p?.capture.hasPointerCapture(p.pointerId))
    p.capture.releasePointerCapture(p.pointerId);
}
type Target = { tableId: string; seat?: number };
type Platform = {
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  targetAt: (x: number, y: number) => Target | null;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
};

export function captureGuestPointer(
  event: Pick<
    PointerEvent,
    'button' | 'isPrimary' | 'pointerId' | 'pointerType' | 'clientX' | 'clientY'
  >,
  capture: HTMLElement,
  id: string,
  pointer: Ref<GuestPointer | null>,
) {
  if (event.button !== 0 || !event.isPrimary || pointer.current) return;
  capture.setPointerCapture(event.pointerId);
  pointer.current = {
    id,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    capture,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  };
}

export function watchGuestDrag(
  callbacks: {
    pointer: Ref<GuestPointer | null>;
    scroller: Ref<HTMLDivElement | null>;
    suppressClick: Ref<number>;
    start: (id: string) => void;
    position: (point: { x: number; y: number }) => void;
    target: (tableId: string | null, seat: number | null) => void;
    drop: (id: string, tableId: string | null, seat?: number) => void;
    outside: () => void;
    end: () => void;
    cancel: () => void;
  },
  platform: Platform = {
    events: window,
    targetAt(x, y) {
      const element = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-table-id]');
      if (!element?.dataset.tableId) return null;
      return {
        tableId: element.dataset.tableId,
        seat:
          element.dataset.seatIndex === undefined
            ? undefined
            : Number(element.dataset.seatIndex),
      };
    },
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
  },
) {
  let frame = 0;
  const { pointer, scroller, suppressClick } = callbacks;
  function updateTarget(x: number, y: number) {
    const target = platform.targetAt(x, y);
    callbacks.target(target?.tableId ?? null, target?.seat ?? null);
  }
  function autoScroll() {
    const p = pointer.current,
      canvas = scroller.current;
    if (!p?.moved || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    canvas.scrollBy(
      edgeScroll(p.lastX, bounds.left, bounds.right),
      edgeScroll(p.lastY, bounds.top, bounds.bottom),
    );
    updateTarget(p.lastX, p.lastY);
    frame = platform.requestFrame(autoScroll);
  }
  function onMove(e: PointerEvent) {
    const p = pointer.current;
    if (!p || p.pointerId !== e.pointerId) return;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    if (
      !p.moved &&
      dragThreshold(p.pointerType, e.clientX - p.x, e.clientY - p.y)
    ) {
      p.moved = true;
      callbacks.start(p.id);
      frame = platform.requestFrame(autoScroll);
    }
    if (!p.moved) return;
    if (e.cancelable) e.preventDefault();
    callbacks.position({ x: e.clientX, y: e.clientY });
    updateTarget(e.clientX, e.clientY);
  }
  function onUp(e: PointerEvent) {
    const p = pointer.current;
    if (!p || p.pointerId !== e.pointerId) return;
    pointer.current = null;
    platform.cancelFrame(frame);
    if (p.capture.hasPointerCapture(p.pointerId))
      p.capture.releasePointerCapture(p.pointerId);
    if (p.moved) {
      // Suppress the delayed click after a touch release, until a new pointerdown.
      suppressClick.current = Date.now() + 700;
      const target = platform.targetAt(e.clientX, e.clientY);
      if (target)
        callbacks.drop(
          p.id,
          target.tableId === 'none' ? null : target.tableId,
          target.seat,
        );
      else callbacks.outside();
    }
    callbacks.end();
  }
  function cancel(e?: PointerEvent) {
    if (!pointer.current || (e && e.pointerId !== pointer.current.pointerId))
      return;
    suppressClick.current = Date.now() + 700;
    platform.cancelFrame(frame);
    releaseGuestPointer(pointer);
    callbacks.cancel();
  }
  function onBlur() {
    cancel();
  }
  function onDown() {
    if (!pointer.current) suppressClick.current = 0;
  }
  function onClick(e: MouseEvent) {
    if (Date.now() < suppressClick.current) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  platform.events.addEventListener('pointerdown', onDown, true);
  platform.events.addEventListener('click', onClick, true);
  platform.events.addEventListener('pointermove', onMove, { passive: false });
  platform.events.addEventListener('pointerup', onUp);
  platform.events.addEventListener('pointercancel', cancel);
  platform.events.addEventListener('blur', onBlur);
  return () => {
    platform.cancelFrame(frame);
    releaseGuestPointer(pointer);
    platform.events.removeEventListener('pointerdown', onDown, true);
    platform.events.removeEventListener('click', onClick, true);
    platform.events.removeEventListener('pointermove', onMove);
    platform.events.removeEventListener('pointerup', onUp);
    platform.events.removeEventListener('pointercancel', cancel);
    platform.events.removeEventListener('blur', onBlur);
  };
}
