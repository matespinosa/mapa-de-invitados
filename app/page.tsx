'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Armchair,
  Users,
  Search,
  LayoutGrid,
  Image as ImageIcon,
  ArrowUpRight,
  Check,
  ChevronRight,
  GripVertical,
  Heart,
  Wine,
  CakeSlice,
  Minus,
  Plus,
  Maximize,
  Maximize2,
  Minimize2,
  Undo2,
  X,
  CircleHelp,
  Pencil,
  CheckCircle2,
  UserRound,
  MapPin,
  ArrowLeftRight,
  Trash2,
  UserRoundMinus,
  Download,
  FileText,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import {
  initialGuests,
  mealLabels,
  mealLabel,
  mealSummary,
  type Meal,
  tables,
  moveGuest,
  validateGuests,
  type Guest,
  type Table,
} from './seating';
import { fitRoom, roomGeometry } from './map-layout';
import {
  MAX_OPEN_TABLES,
  closeTable,
  openTable,
  rowAction,
  seatRows,
  summarize,
  tableStrip,
} from './open-tables';
import { downloadSeatingPng, printSeatingPdf } from './seating-export';
import {
  captureGuestPointer,
  releaseGuestPointer,
  watchGuestDrag,
  type GuestPointer,
} from './guest-drag';
// Keep the previous draft under v2; this PDF revision starts a fresh saved plan.
const STORAGE_KEY = 'ensulugar-recepcion-v3-pdf-20260919';
const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const tableName = (id: string | null) =>
  tables.find((t) => t.id === id)?.name ?? 'Sin mesa';
const totalSeats = tables.reduce((sum, table) => sum + table.capacity, 0);
const toneIndex = (id: string) => {
  const digits = id.match(/\d+/)?.[0];
  if (digits) return Number(digits) % 4;
  return (
    Array.from(id).reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ) % 4
  );
};
const createGuestId = (guests: readonly Guest[]) => {
  const used = new Set(guests.map((guest) => guest.id));
  const prefix = `guest-${Date.now().toString(36)}`;
  let candidate = prefix;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${prefix}-${suffix++}`;
  return candidate;
};
const sameRoster = (left: readonly Guest[], right: readonly Guest[]) => {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map((guest) => [guest.id, guest]));
  return left.every((guest) => {
    const baseline = rightById.get(guest.id);
    return (
      baseline?.name === guest.name &&
      baseline.tableId === guest.tableId &&
      baseline.seat === guest.seat &&
      (baseline.meal ?? null) === (guest.meal ?? null)
    );
  });
};
export default function Home() {
  const [guests, setGuests] = useState<Guest[]>(initialGuests),
    [history, setHistory] = useState<Guest[][]>([]);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null),
    [editName, setEditName] = useState(''),
    [editTable, setEditTable] = useState('none'),
    [editMeal, setEditMeal] = useState<Meal | 'pending'>('pending');
  const [referenceOpen, setReferenceOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState('');
  const [dragging, setDragging] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null),
    [dropSeat, setDropSeat] = useState<number | null>(null);
  const [pressedSeatId, setPressedSeatId] = useState<string | null>(null);
  const [openTables, setOpenTables] = useState<string[]>([]),
    [compareOpen, setCompareOpen] = useState(false),
    [movingGuestId, setMovingGuestId] = useState<string | null>(null),
    [sheetTall, setSheetTall] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false),
    [addPersonName, setAddPersonName] = useState(''),
    [addPersonMeal, setAddPersonMeal] = useState<Meal | 'pending'>('pending'),
    [addPersonTable, setAddPersonTable] = useState('none'),
    [addPersonSeat, setAddPersonSeat] = useState<number | null>(null),
    [addFromTableId, setAddFromTableId] = useState<string | null>(null),
    [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState(''),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(true);
  const [zoom, setZoom] = useState(1),
    [viewport, setViewport] = useState({ width: 840, height: 680 }),
    [mobilePanel, setMobilePanel] = useState(false),
    [mapOnly, setMapOnly] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const previousView = useRef<{
    left: number;
    top: number;
    scale: number;
    width: number;
    height: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const zoomBeforeMapOnly = useRef(1);
  const pointer = useRef<GuestPointer | null>(null);
  const suppressClick = useRef(0);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  async function exportDistribution(format: 'png' | 'pdf') {
    if (exporting) return;
    setExporting(format);
    setExportError('');
    try {
      if (format === 'png') await downloadSeatingPng(guests);
      else await printSeatingPdf(guests);
      setToast(
        format === 'png'
          ? 'Imagen lista. Revisa las descargas de tu navegador.'
          : 'Elige «Guardar como PDF» en la ventana de impresión.',
      );
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'No se pudo exportar. Intenta de nuevo.',
      );
    } finally {
      setExporting(null);
    }
  }
  function startPointer(e: React.PointerEvent, id: string) {
    captureGuestPointer(e, e.currentTarget as HTMLElement, id, pointer);
  }
  const active = guests.find((g) => g.id === selectedGuest),
    seated = guests.filter((g) => g.tableId).length,
    guestCount = guests.length,
    unassigned = guestCount - seated,
    selected = tables.find((t) => t.id === selectedTable),
    movingGuest = guests.find((g) => g.id === movingGuestId),
    pendingDelete = guests.find((g) => g.id === pendingDeleteId);
  const hasRosterChanges = !sameRoster(guests, initialGuests);
  const boardTables = openTables
    .map((id) => tables.find((t) => t.id === id))
    .filter((table): table is Table => !!table);
  const strip = tableStrip(guests);
  const menus = mealSummary(guests);
  const fit = fitRoom(viewport);
  const scale = fit * zoom;
  const geometry = roomGeometry(viewport, scale);
  const visibleGuests = guests.filter(
    (g) =>
      normalize(g.name).includes(normalize(query)) &&
      (filter !== 'unassigned' || !g.tableId) &&
      (!selectedTable || g.tableId === selectedTable),
  );
  const cancelMove = useCallback(() => {
    setPressedSeatId(null);
    setMovingGuestId(null);
    setDragging(null);
    setDropTarget(null);
    setDropSeat(null);
  }, []);
  const commit = useCallback(
    (next: Guest[]) => {
      setHistory((h) => [...h.slice(-39), guests]);
      setGuests(next);
    },
    [guests],
  );
  const assign = useCallback(
    (id: string, target: string | null, seat?: number): boolean => {
      const result = moveGuest(guests, id, target, seat);
      if (result.error) {
        setToast(result.error);
        // A full table needs an explicit seat choice: open it beside the origin
        // so the person can be swapped with someone already sitting there.
        if (target && seat === undefined) {
          setMovingGuestId(id);
          setOpenTables((open) => openTable(open, target, open.length > 0));
        }
        return false;
      }
      if (!result.changed) {
        setToast('Ese ya es su lugar. Elige otro asiento o mesa.');
        return false;
      }
      commit(result.guests);
      cancelMove();
      setToast(
        result.swapped
          ? 'Lugares intercambiados'
          : `${guests.find((g) => g.id === id)?.name} · ${tableName(target)}`,
      );
      return true;
    },
    [cancelMove, commit, guests],
  );
  useEffect(() => {
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (validateGuests(parsed)) {
          setGuests(parsed);
        }
      }
    } catch {
      setSaved(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [guests, ready]);
  function resetToOriginal() {
    setGuests(initialGuests.map((guest) => ({ ...guest })));
    setHistory([]);
    setSelectedTable(null);
    setSelectedGuest(null);
    setOpenTables([]);
    setMovingGuestId(null);
    setDragging(null);
    setDropTarget(null);
    setDropSeat(null);
    setResetOpen(false);
    setToast('Distribución original restaurada');
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!canvasRef.current) return;
    const o = new ResizeObserver(([entry]) =>
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    o.observe(canvasRef.current);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const previous = previousView.current;
    // Preserve the camera's map coordinate while the plan resizes around the
    // open tables, so opening a panel never shifts the room under the user.
    const centerX = previous
      ? (previous.scrollLeft + previous.width / 2 - previous.left) /
        previous.scale
      : 480;
    const centerY = previous
      ? (previous.scrollTop + previous.height / 2 - previous.top) /
        previous.scale
      : 380;
    scroller.scrollLeft = geometry.left + centerX * scale - viewport.width / 2;
    scroller.scrollTop = geometry.top + centerY * scale - viewport.height / 2;
    previousView.current = {
      left: geometry.left,
      top: geometry.top,
      scale,
      width: viewport.width,
      height: viewport.height,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
    };
  }, [
    geometry.width,
    geometry.height,
    geometry.left,
    geometry.top,
    scale,
    viewport.width,
    viewport.height,
  ]);
  useEffect(
    () =>
      watchGuestDrag({
        pointer,
        scroller: scrollerRef,
        suppressClick,
        start(id) {
          setMovingGuestId(id);
          setMobilePanel(false);
          setDragging(id);
        },
        position: setDragPosition,
        target(tableId, seat) {
          setDropTarget(tableId);
          setDropSeat(seat);
        },
        drop: assign,
        outside() {
          setMovingGuestId(null);
          setToast('Movimiento cancelado. Suelta sobre una mesa o un asiento.');
        },
        end() {
          setDragging(null);
          setDropTarget(null);
          setDropSeat(null);
        },
        cancel: cancelMove,
      }),
    [assign, cancelMove],
  );
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !addPersonOpen &&
        !pendingDeleteId &&
        !selectedGuest &&
        !helpOpen &&
        !referenceOpen
      ) {
        releaseGuestPointer(pointer);
        cancelMove();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    addPersonOpen,
    cancelMove,
    helpOpen,
    pendingDeleteId,
    referenceOpen,
    selectedGuest,
  ]);
  function undo() {
    if (!history.length) return;
    releaseGuestPointer(pointer);
    setGuests(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    cancelMove();
    setToast('Último cambio deshecho');
  }
  function openGuest(g: Guest) {
    setSelectedGuest(g.id);
    setEditName(g.name);
    setEditTable(g.tableId ?? 'none');
    setEditMeal(g.meal ?? 'pending');
  }
  // Opening a table never moves the plan: it adds a panel beside it.
  function showTable(id: string, compare = false) {
    setOpenTables((open) => openTable(open, id, compare));
    setSheetTall(false);
    setMobilePanel(false);
  }
  function hideTable(id: string) {
    setOpenTables((open) => closeTable(open, id));
  }
  function beginMove(id: string, revealTable = true) {
    const guest = guests.find((g) => g.id === id);
    if (!guest) return;
    setMovingGuestId(id);
    setMobilePanel(false);
    if (revealTable && guest.tableId) setOpenTables((open) => openTable(open, guest.tableId!));
    setToast('');
  }
  // Tapping a seat row picks someone up, seats them, or swaps two people.
  function tapSeat(tableId: string, seat: number, guest?: Guest, revealTable = true) {
    const action = rowAction(movingGuestId, { guest: guest ?? null });
    if (action === 'unpick') return cancelMove();
    if (action === 'pick') return beginMove(guest!.id, revealTable);
    if (action === 'add') return openAddPerson(tableId, seat);
    assign(movingGuestId!, tableId, seat);
  }
  function toggleMapOnly() {
    if (mapOnly) {
      setMapOnly(false);
      setZoom(zoomBeforeMapOnly.current);
      return;
    }
    zoomBeforeMapOnly.current = zoom;
    if (window.innerWidth <= 800 && zoom < 1.5) setZoom(1.5);
    setMobilePanel(false);
    setMapOnly(true);
  }
  function handleGuestClick(g: Guest) {
    if (movingGuestId && g.tableId) {
      assign(movingGuestId, g.tableId, g.seat ?? undefined);
    } else if (g.tableId) showTable(g.tableId);
    else openGuest(g);
  }
  function openAddPerson(
    tableId: string | null = null,
    seat: number | null = null,
  ) {
    const table = tableId
      ? tables.find((candidate) => candidate.id === tableId)
      : undefined;
    const occupied = table
      ? guests.filter((guest) => guest.tableId === table.id).length
      : 0;
    const seatIsFree =
      table && seat !== null
        ? !guests.some(
            (guest) => guest.tableId === table.id && guest.seat === seat,
          )
        : true;
    const canAssignToTable = Boolean(
      table && occupied < table.capacity && seatIsFree,
    );
    setAddPersonName('');
    setAddPersonMeal('pending');
    setAddPersonTable(canAssignToTable && table ? table.id : 'none');
    setAddPersonSeat(canAssignToTable ? seat : null);
    setAddFromTableId(tableId);
    setAddPersonOpen(true);
  }
  function addPerson() {
    const name = addPersonName.trim();
    if (!name) return;
    const id = createGuestId(guests);
    const draft: Guest[] = [...guests, { id, name, tableId: null, seat: null, meal: addPersonMeal === 'pending' ? null : addPersonMeal }];
    let next = draft;
    if (addPersonTable !== 'none') {
      const result = moveGuest(
        draft,
        id,
        addPersonTable,
        addPersonSeat ?? undefined,
      );
      if (result.error) {
        setToast(result.error);
        return;
      }
      next = result.guests;
    }
    commit(next);
    const placedAt = next.find((guest) => guest.id === id)?.tableId;
    const returnToTable = addFromTableId;
    setAddPersonOpen(false);
    setAddPersonName('');
    setAddPersonTable('none');
    setAddPersonSeat(null);
    setAddFromTableId(null);
    if (returnToTable) showTable(returnToTable);
    setToast(
      placedAt
        ? `${name} agregado · ${tableName(placedAt)}`
        : `${name} agregado a la lista sin mesa`,
    );
  }
  function removeFromTable(id: string) {
    const guest = guests.find((candidate) => candidate.id === id);
    if (!guest?.tableId) return;
    commit(
      guests.map((candidate) =>
        candidate.id === id
          ? { ...candidate, tableId: null, seat: null }
          : candidate,
      ),
    );
    if (movingGuestId === id) setMovingGuestId(null);
    setToast(`${guest.name} quedó sin mesa`);
  }
  function requestDelete(id: string) {
    setSelectedGuest(null);
    setPendingDeleteId(id);
  }
  function deletePerson() {
    const guest = guests.find((candidate) => candidate.id === pendingDeleteId);
    if (!guest) {
      setPendingDeleteId(null);
      return;
    }
    commit(guests.filter((candidate) => candidate.id !== guest.id));
    setPendingDeleteId(null);
    if (movingGuestId === guest.id) setMovingGuestId(null);
    setToast(`${guest.name} eliminado del evento`);
  }
  function saveGuest() {
    if (!active || !editName.trim()) return;
    const r = moveGuest(
      guests,
      active.id,
      editTable === 'none' ? null : editTable,
    );
    if (r.error) {
      setToast(r.error);
      return;
    }
    commit(
      r.guests.map((g) =>
        g.id === active.id ? { ...g, name: editName.trim(), meal: editMeal === 'pending' ? null : editMeal } : g,
      ),
    );
    setSelectedGuest(null);
    setToast('Invitado actualizado');
  }
  function handleDrop(
    e: React.DragEvent,
    tableId: string | null,
    seat?: number,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    if (guests.some((g) => g.id === id)) assign(id, tableId, seat);
    setDragging(null);
    setDropTarget(null);
  }
  function renderTable(table: Table) {
    const occupants = guests.filter((g) => g.tableId === table.id),
      isOpen = openTables.includes(table.id),
      highlighted = occupants.some(
        (g) => query && normalize(g.name).includes(normalize(query)),
      );
    const free = table.capacity - occupants.length;
    const openThis = () => {
      if (movingGuestId) assign(movingGuestId, table.id);
      else showTable(table.id, openTables.length === 1 && !isOpen);
    };
    return (
      <div
        key={table.id}
        data-table-id={table.id}
        className={`table-group ${table.horizontal ? 'horizontal' : ''} ${table.id === 'couple' ? 'couple-group' : ''} ${isOpen || selectedTable === table.id ? 'is-selected' : ''} ${highlighted ? 'is-found' : ''} ${dropTarget === table.id ? 'is-dropping' : ''} ${occupants.length === 0 ? 'is-empty' : ''} ${movingGuestId && free > 0 ? 'has-room' : ''} ${movingGuestId && free === 0 ? 'is-full' : ''}`}
        style={{ left: table.x, top: table.y }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropTarget(table.id);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDropTarget(null);
        }}
        onDrop={(e) => handleDrop(e, table.id)}
      >
        <button
          className="table-touch-target"
          tabIndex={-1}
          aria-hidden="true"
          onClick={openThis}
        />
        <button
          className="table-surface"
          aria-pressed={isOpen}
          aria-label={`${table.name}, ${occupants.length} de ${table.capacity} lugares. ${movingGuestId ? 'Mover aquí' : 'Abrir la mesa'}`}
          onClick={openThis}
        >
          {table.id === 'couple' ? (
            <Heart size={20} />
          ) : (
            <span className="table-number">
              {table.name.replace('Mesa ', '')}
            </span>
          )}
          <span className="table-occupancy">
            {occupants.length}
            <span> / {table.capacity}</span>
          </span>
        </button>
        {Array.from({ length: table.capacity }, (_, seat) => {
          const guest = occupants.find((g) => g.seat === seat),
            side =
              table.id === 'couple'
                ? 'couple-seat'
                : seat === 0
                  ? 'head top'
                  : seat === 9
                    ? 'head bottom'
                    : seat <= 4
                      ? 'left'
                      : 'right',
            index = seat <= 4 ? seat - 1 : seat - 5;
          return (
            <button
              key={seat}
              type="button"
              aria-label={`${guest?.name ?? 'Disponible'} · ${table.name} · Lugar ${seat + 1}`}
              aria-pressed={Boolean(guest && movingGuestId === guest.id)}
              onPointerDown={(event) => {
                if (guest && event.isPrimary && event.button === 0) {
                  setPressedSeatId(guest.id);
                  startPointer(event, guest.id);
                }
              }}
              onPointerUp={() => setPressedSeatId(null)}
              onPointerCancel={() => setPressedSeatId(null)}
              onLostPointerCapture={() => setPressedSeatId(null)}
              onClick={() => tapSeat(table.id, seat, guest, false)}
              data-table-id={table.id}
              data-seat-index={seat}
              data-guest-id={guest?.id}
              data-pressing={Boolean(guest && pressedSeatId === guest.id)}
              className={`seat ${side} ${guest ? 'occupied' : 'vacant'} ${guest && query && normalize(guest.name).includes(normalize(query)) ? 'search-match' : ''} ${movingGuestId === guest?.id ? 'move-origin' : ''} ${dropTarget === table.id && dropSeat === seat ? 'is-drop-seat' : ''}`}
              style={
                {
                  '--seat-index': table.id === 'couple' ? seat : index,
                } as React.CSSProperties
              }
              title={
                guest
                  ? `${guest.name} · ${table.name} · Lugar ${seat + 1}`
                  : `${table.name} · Lugar ${seat + 1} disponible`
              }
            >
              {guest ? initials(guest.name) : ''}
              {guest && (movingGuestId === guest.id || pressedSeatId === guest.id) && (
                <span className="seat-selection-mark" aria-hidden="true">
                  <CheckCircle2 size={13} />
                </span>
              )}
            </button>
          );
        })}
        {table.id === 'couple' && <span className="couple-label">Pareja</span>}
      </div>
    );
  }
  function renderSeatRow(table: Table, seat: number, guest: Guest | null) {
    const picked = movingGuestId === guest?.id;
    const action = rowAction(movingGuestId, { guest });
    const hint = picked
      ? 'Elige su nuevo lugar'
      : action === 'swap'
        ? 'Tocar para intercambiar'
        : action === 'place'
          ? `Sentar aquí a ${movingGuest?.name}`
          : guest
            ? `Lugar ${seat + 1}`
            : 'Lugar disponible';
    return (
      <div
        key={seat}
        data-table-id={table.id}
        data-seat-index={seat}
        data-guest-id={guest?.id}
        className={`seat-row ${guest ? '' : 'is-free'} ${picked ? 'is-picked' : ''} ${!picked && action === 'place' ? 'is-target' : ''} ${!picked && action === 'swap' ? 'is-swappable' : ''} ${guest && query && normalize(guest.name).includes(normalize(query)) ? 'is-found' : ''} ${dropTarget === table.id && dropSeat === seat ? 'is-drop-seat' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, table.id, seat)}
      >
        <span className="sr-num">{String(seat + 1).padStart(2, '0')}</span>
        <button
          className="sr-main"
          onClick={() => tapSeat(table.id, seat, guest ?? undefined)}
          aria-label={
            guest
              ? `${guest.name}, ${table.name}, lugar ${seat + 1}. ${hint}`
              : `${table.name}, lugar ${seat + 1} disponible. ${hint}`
          }
        >
          {guest ? (
            <span className={`avatar tone-${toneIndex(guest.id)}`}>
              {initials(guest.name)}
            </span>
          ) : (
            <span className="sr-plus">
              <Plus size={15} />
            </span>
          )}
          <span className="sr-body">
            <strong>{guest?.name ?? 'Lugar libre'}</strong>
            <small>{guest ? `${mealLabel(guest.meal)} · ${hint}` : hint}</small>
          </span>
        </button>
        {guest && !picked && (
          <button
            className="sr-edit"
            aria-label={`Editar a ${guest.name}`}
            title="Editar o eliminar"
            onClick={() => openGuest(guest)}
          >
            <Pencil size={15} />
          </button>
        )}
        {guest && (
          <span
            className="sr-grip"
            aria-hidden="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              startPointer(e, guest.id);
            }}
          >
            <GripVertical size={15} />
          </span>
        )}
      </div>
    );
  }
  function renderTablePanel(table: Table) {
    const { occupied, free } = summarize(guests, table);
    const canCompare = openTables.length < MAX_OPEN_TABLES;
    return (
      <article className="table-panel" key={table.id} data-table-id={table.id}>
        <header className="tp-head">
          <span className="tp-titles">
            <strong>{table.name}</strong>
            <small>
              {occupied} de {table.capacity}
              {free > 0
                ? ` · ${free} ${free === 1 ? 'lugar libre' : 'lugares libres'}`
                : ' · completa'}
            </small>
          </span>
          <span className="tp-actions">
            {canCompare && (
              <button
                className="button tp-compare"
                onClick={() => setCompareOpen(true)}
              >
                <ArrowLeftRight size={14} />
                <span>Comparar</span>
              </button>
            )}
            <button
              className="icon-button"
              aria-label={`Cerrar ${table.name}`}
              onClick={() => hideTable(table.id)}
            >
              <X size={18} />
            </button>
          </span>
        </header>
        <div className="tp-rows">
          {seatRows(guests, table).map((row) =>
            renderSeatRow(table, row.seat, row.guest),
          )}
        </div>
        <footer className="tp-foot">
          <button
            className="button text-button"
            onClick={() => openAddPerson(table.id)}
          >
            <Plus size={15} />
            Agregar persona a esta mesa
          </button>
        </footer>
      </article>
    );
  }
  return (
    <main
      className={`app-shell ${mapOnly ? 'map-only' : ''} ${
        boardTables.length ? 'has-board' : ''
      } ${boardTables.length > 1 ? 'has-two' : ''}`}
    >
      <header className="app-header">
        <Link className="brand" href="/" aria-label="Recepción, inicio">
          <span className="brand-icon">
            <Armchair size={23} strokeWidth={1.8} />
          </span>
          Recepción<span className="brand-dot">.</span>
        </Link>
        <div className="event-title">
          <span className="header-divider" />
          <span>Acomodación de invitados</span>
          <span className="event-tag">Planeación</span>
        </div>
        <div className="header-actions">
          <button
            className="button export-trigger"
            disabled={!ready}
            onClick={() => {
              setExportError('');
              setExportOpen(true);
            }}
          >
            <Download size={16} />
            Exportar
          </button>
          <button
            className="button light reset-trigger"
            disabled={!ready || !hasRosterChanges}
            aria-label="Restablecer distribución original"
            title="Restablecer distribución original"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={16} />
            <span>Restablecer originales</span>
          </button>
          <span className={`save-status ${!saved ? 'save-error' : ''}`}>
            <CheckCircle2 size={14} />
            {saved ? 'Guardado en este dispositivo' : 'No se pudo guardar'}
          </span>
          <button
            className="button light reference-button"
            onClick={() => setReferenceOpen(true)}
          >
            <ImageIcon size={16} />
            Ver foto original
            <ArrowUpRight size={14} />
          </button>
          <button
            className="icon-button help-button"
            aria-label="Cómo usar el organizador"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="export-dialog" showCloseButton={false}>
          <DialogClose
            className="dialog-close-button"
            aria-label="Cerrar exportación"
          >
            <X size={20} />
          </DialogClose>
          <DialogTitle>Guardar distribución</DialogTitle>
          <DialogDescription>
            El plano completo con las personas en sus lugares y, debajo, el
            listado por mesa con nombres completos. Incluye a quienes siguen sin
            mesa.
          </DialogDescription>
          <div className="export-summary">
            {guestCount} personas · {seated} con lugar · {unassigned} sin mesa
          </div>
          <button
            className="export-option"
            disabled={exporting !== null}
            onClick={() => void exportDistribution('png')}
          >
            {exporting === 'png' ? (
              <LoaderCircle className="export-spinner" size={24} />
            ) : (
              <ImageIcon size={24} />
            )}
            <span>
              <strong>
                {exporting === 'png'
                  ? 'Preparando imagen…'
                  : 'Descargar imagen PNG'}
              </strong>
              <small>Un solo archivo para guardar o compartir.</small>
            </span>
            <Download size={18} />
          </button>
          <button
            className="export-option"
            disabled={exporting !== null}
            onClick={() => void exportDistribution('pdf')}
          >
            {exporting === 'pdf' ? (
              <LoaderCircle className="export-spinner" size={24} />
            ) : (
              <FileText size={24} />
            )}
            <span>
              <strong>
                {exporting === 'pdf' ? 'Preparando PDF…' : 'Guardar como PDF'}
              </strong>
              <small>
                Elige «Guardar como PDF» al abrirse la impresión. Se organiza en
                páginas A4.
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
          {exporting && (
            <output className="export-progress">
              Preparando la distribución actual…
            </output>
          )}
          {exportError && (
            <p role="alert" className="export-error">
              {exportError}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="reset-dialog" size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="reset-dialog-media">
              <RotateCcw size={20} />
            </AlertDialogMedia>
            <AlertDialogTitle>
              ¿Restablecer la distribución original?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se reemplazarán los cambios guardados, incluyendo personas
              agregadas, eliminadas o movidas, por la plantilla original del
              proyecto. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="reset-confirm-action"
              onClick={resetToOriginal}
            >
              Restablecer originales
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div
        className={`workspace ${boardTables.length ? 'with-board' : ''} ${
          boardTables.length > 1 ? 'with-two' : ''
        }`}
      >
        <aside
          className={`guest-panel ${mobilePanel ? 'mobile-open' : ''} ${selected && selected.name.length > 12 ? 'has-long-table-title' : ''}`}
        >
          <div className="panel-heading">
            <h2>
              {selected ? selected.name : 'Tus invitados'}
              <span>{selected ? visibleGuests.length : guestCount}</span>
            </h2>
            <div className="panel-heading-actions">
              <button
                className="button add-person-trigger"
                aria-label="Agregar persona"
                onClick={() => openAddPerson(selected?.id ?? null)}
              >
                <Plus size={15} />
                <span>Agregar</span>
              </button>
              {selected ? (
                <button
                  className="icon-button"
                  aria-label="Ver todos los invitados"
                  onClick={() => setSelectedTable(null)}
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>
            <button
              className="icon-button mobile-close"
              aria-label="Cerrar invitados"
              onClick={() => setMobilePanel(false)}
            >
              <X size={20} />
            </button>
          </div>
          <p className="panel-subtitle">
            {selected
              ? `${selected.capacity - guests.filter((g) => g.tableId === selected.id).length} lugares disponibles en esta mesa`
              : 'Buena compañía, bien ubicada.'}
          </p>
          <p className="menu-summary" aria-label="Resumen de menús">
            {menus.chicken} pollo · {menus.beef} carne · {menus.vegetarian} vegetariano · {menus.pending} por confirmar
          </p>
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Buscar invitado"
              placeholder="Buscar un invitado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <Tabs
            value={filter}
            onValueChange={(v) => {
              setFilter(String(v));
              setSelectedTable(null);
            }}
          >
            <TabsList className="guest-tabs">
              <TabsTrigger value="all">
                Todos <span>{guestCount}</span>
              </TabsTrigger>
              <TabsTrigger value="unassigned">
                Sin mesa <span>{unassigned}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="list-label">
            <span>
              {selected
                ? 'EN ESTA MESA'
                : query
                  ? `${visibleGuests.length} RESULTADOS`
                  : 'LISTA DE INVITADOS'}
            </span>
            <span>
              <GripVertical size={13} />
              Arrastra para mover
            </span>
          </div>
          <div
            className="guest-list"
            onDragOver={(e) => {
              if (filter === 'unassigned') e.preventDefault();
            }}
            onDrop={(e) => {
              if (filter === 'unassigned') handleDrop(e, null);
            }}
          >
            {visibleGuests.map((g) => (
              <button
                key={g.id}
                className={`guest-row ${!g.tableId ? 'unassigned-row' : ''}`}
                onPointerDown={(e) => {
                  if (!mobilePanel && e.pointerType !== 'touch')
                    startPointer(e, g.id);
                }}
                draggable={false}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', g.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragging(g.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onClick={() => handleGuestClick(g)}
              >
                <span
                  className="drag-handle"
                  aria-hidden="true"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startPointer(e, g.id);
                  }}
                >
                  <GripVertical size={14} />
                </span>
                <span className={`avatar tone-${toneIndex(g.id)}`}>
                  {initials(g.name)}
                </span>
                <span className="guest-info">
                  <strong>{g.name}</strong>
                  <span>
                    {tableName(g.tableId)} · {mealLabel(g.meal)}
                    {g.tableId && (
                      <>
                        <i />
                        Lugar {(g.seat ?? 0) + 1}
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight size={15} className="row-arrow" />
              </button>
            ))}
            {!visibleGuests.length && (
              <div className="empty-list">
                <UserRound size={28} />
                <strong>
                  {query
                    ? 'No encontramos ese nombre'
                    : selected
                      ? 'Una mesa por llenar'
                      : '¡Todos tienen su lugar!'}
                </strong>
                <p>
                  {query
                    ? 'Prueba con otro nombre.'
                    : selected
                      ? 'Abre un invitado y elige esta mesa para ubicarlo.'
                      : 'Puedes seguir ajustando la distribución.'}
                </p>
              </div>
            )}
          </div>
          <div
            data-table-id="none"
            className={`unassigned-drop ${dropTarget === 'none' ? 'drop-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget('none');
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => handleDrop(e, null)}
          >
            <span className="drop-icon">
              <UserRound size={16} />
            </span>
            <span>
              <strong>Dejar sin mesa</strong>
              <small>Arrastra aquí para liberar su lugar</small>
            </span>
          </div>
          <div className="panel-foot">
            <CircleHelp size={14} />
            <span>Toca una mesa del plano para abrir sus lugares.</span>
          </div>
        </aside>
        <section className="plan-panel" aria-label="Plano del salón">
          <div className="plan-toolbar">
            <div className="plan-title">
              <LayoutGrid size={18} />
              <h2>Plano del salón</h2>
            </div>
            <div className="plan-actions">
              <button
                className="button text-button undo-button"
                disabled={!history.length}
                onClick={undo}
              >
                <Undo2 size={16} />
                <span>Deshacer</span>
              </button>
              <button
                className="button map-only-toggle"
                aria-pressed={mapOnly}
                onClick={toggleMapOnly}
              >
                {mapOnly ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span className="map-only-label-full">
                  {mapOnly ? 'Salir de solo mapa' : 'Ver solo el mapa'}
                </span>
                <span className="map-only-label-short">
                  {mapOnly ? 'Salir' : 'Solo mapa'}
                </span>
              </button>
            </div>
          </div>
          <div className="plan-stats">
            <span>
              <i className="status-dot purple" />
              <strong>{seated}</strong> con lugar
            </span>
            <span>
              <i className="status-dot amber" />
              <strong>{unassigned}</strong> sin mesa
            </span>
            <span>
              <Armchair size={15} />
              <strong>{totalSeats - seated}</strong> lugares libres
            </span>
          </div>
          {movingGuest && !dragging && (
            <output className="move-banner">
              <span className={`avatar tone-${toneIndex(movingGuest.id)}`}>
                {initials(movingGuest.name)}
              </span>
              <span className="move-banner-copy">
                <small>ASIENTO SELECCIONADO</small>
                <strong>{movingGuest.name}</strong>
                <span>
                  Toca una silla vacía para mover o una ocupada para intercambiar.
                </span>
              </span>
              <button
                className="move-banner-unseat"
                onClick={() => {
                  if (movingGuest?.tableId) removeFromTable(movingGuest.id);
                  cancelMove();
                }}
              >
                <UserRoundMinus size={15} />
                <span>Sin mesa</span>
              </button>
              <button onClick={cancelMove} aria-label="Cancelar movimiento">
                <X size={18} />
              </button>
            </output>
          )}
          <button
            className="button mobile-guests"
            onClick={() => setMobilePanel(true)}
          >
            <Users size={16} />
            Ver invitados
            <ChevronRight size={15} />
          </button>
          <div
            className={`canvas-viewport ${dragging || movingGuest ? 'is-moving move-mode' : ''}`}
            ref={canvasRef}
          >
            <div
              className="canvas-scroller"
              ref={scrollerRef}
              onScroll={(e) => {
                if (previousView.current) {
                  previousView.current.scrollLeft = e.currentTarget.scrollLeft;
                  previousView.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
            >
              <div
                className="map-scroll-area"
                style={{ width: geometry.width, height: geometry.height }}
              >
                <div
                  className="floor-map"
                  style={{
                    left: geometry.left,
                    top: geometry.top,
                    transform: `scale(${scale})`,
                  }}
                >
                  <div className="map-compass">
                    <MapPin size={15} />
                    <span>VISTA SUPERIOR</span>
                  </div>
                  <div className="wc wc-left">
                    <UserRound size={19} />
                    <span>W.C.</span>
                  </div>
                  <div className="wc wc-right">
                    <UserRound size={19} />
                    <span>W.C.</span>
                  </div>
                  <div className="hall-outline">
                    <span className="hall-label">SALÓN DE RECEPCIÓN</span>
                    <div className="terrace-divider" />
                  </div>
                  <div className="bar-zone">
                    <Wine size={17} />
                    <span>BAR</span>
                  </div>
                  <div className="terrace-caption">TERRAZA</div>
                  {[
                    [310, 399],
                    [632, 399],
                    [201, 477],
                    [310, 527],
                    [632, 527],
                  ].map(([x, y], i) => (
                    <div
                      className="column"
                      key={i}
                      style={{ left: x, top: y }}
                      title="Columna fija"
                    />
                  ))}
                  <div className="cake-zone">
                    <CakeSlice size={21} />
                    <span>PONQUÉ</span>
                  </div>
                  {tables.map(renderTable)}
                </div>
              </div>
            </div>
          </div>
          <div className="canvas-bottom">
            <div className="legend">
              <span>
                <i className="legend-seat assigned" />
                Ocupado
              </span>
              <span>
                <i className="legend-seat" />
                Disponible
              </span>
              <span className="column-legend">
                <i className="legend-column" />
                Columna fija
              </span>
            </div>
            <div className="zoom-control">
              <button
                aria-label="Alejar plano"
                disabled={zoom <= 0.75}
                onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
              >
                <Minus size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Acercar plano"
                disabled={zoom >= 2}
                onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
              >
                <Plus size={16} />
              </button>
              <span className="zoom-divider" />
              <button
                aria-label="Ajustar plano a la pantalla"
                onClick={() => setZoom(1)}
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
        </section>
        <section
          className={`table-board ${boardTables.length ? 'has-tables' : ''} ${sheetTall ? 'is-tall' : ''}`}
          aria-label="Mesas abiertas"
        >
          <button
            className="sheet-grab"
            aria-label={sheetTall ? 'Encoger el panel' : 'Agrandar el panel'}
            aria-expanded={sheetTall}
            onClick={() => setSheetTall((tall) => !tall)}
          >
            <span />
          </button>
          {boardTables.length ? (
            <>
              <div className="mesa-sheet-actions">
                <strong>Mesas abiertas</strong>
                <button
                  className="button text-button"
                  onClick={() => setMobilePanel(true)}
                >
                  <Users size={15} />
                  Invitados
                </button>
              </div>
              <div className="mesa-tabs" aria-label="Cambiar de mesa">
                {strip.map(({ table, occupied, free, full }) => (
                  <button
                    key={table.id}
                    data-table-id={table.id}
                    className={`mesa-tab ${openTables.includes(table.id) ? 'is-open' : ''} ${full ? 'is-full' : ''}`}
                    aria-pressed={openTables.includes(table.id)}
                    aria-label={`${table.name}, ${occupied} de ${table.capacity}`}
                    onClick={() => showTable(table.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, table.id)}
                  >
                    <strong>
                      {table.id === 'couple'
                        ? 'Pareja'
                        : table.name.replace('Mesa ', '')}
                    </strong>
                    <small>{full ? 'llena' : `${free} libre${free === 1 ? '' : 's'}`}</small>
                  </button>
                ))}
              </div>
              {boardTables.map(renderTablePanel)}
            </>
          ) : (
            <div className="mesa-browser">
              <div className="mesa-browser-head">
                <span className="mesa-browser-titles">
                  <strong>Mesas</strong>
                  <small>Toca una para abrir sus lugares</small>
                </span>
                <button
                  className="button text-button"
                  onClick={() => setMobilePanel(true)}
                >
                  <Users size={15} />
                  Invitados
                </button>
              </div>
              <div className="mesa-strip">
                {strip.map(({ table, occupied, free, full }) => (
                  <button
                    key={table.id}
                    data-table-id={table.id}
                    className={`mesa-card ${full ? 'is-full' : ''} ${occupied === 0 ? 'is-empty' : ''}`}
                    onClick={() => showTable(table.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, table.id)}
                  >
                    <span className="mc-top">
                      <span className="mc-num">
                        {table.id === 'couple' ? (
                          <Heart size={17} />
                        ) : (
                          table.name.replace('Mesa ', '')
                        )}
                      </span>
                      <span className="mc-cap">
                        {occupied}
                        <small>/{table.capacity}</small>
                      </span>
                    </span>
                    <span className="mc-dots">
                      {Array.from({ length: table.capacity }, (_, i) => (
                        <i key={i} className={i < occupied ? '' : 'free'} />
                      ))}
                    </span>
                    <span className="mc-label">
                      {full
                        ? 'Completa'
                        : `${free} ${free === 1 ? 'libre' : 'libres'}`}
                    </span>
                  </button>
                ))}
              </div>
              <div
                data-table-id="none"
                className={`unassigned-drop mesa-unassigned ${dropTarget === 'none' ? 'drop-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget('none');
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, null)}
              >
                <span className="drop-icon">
                  <UserRound size={16} />
                </span>
                <span>
                  <strong>Sin mesa</strong>
                  <small>
                    {unassigned === 0
                      ? 'Todos tienen lugar'
                      : `${unassigned} ${unassigned === 1 ? 'persona' : 'personas'} por ubicar`}
                  </small>
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
      {dragging && (
        <div
          className="drag-preview"
          style={{ left: dragPosition.x, top: dragPosition.y - 24 }}
        >
          <GripVertical size={16} />
          <span>
            {guests.find((g) => g.id === dragging)?.name}
            <small>
              {dropTarget
                ? dropSeat !== null
                  ? `Lugar ${dropSeat + 1} · ${tableName(dropTarget)}`
                  : tableName(dropTarget)
                : 'Arrastra hacia una mesa'}
            </small>
          </span>
        </div>
      )}
      {toast && (
        <output className="app-toast">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button aria-label="Cerrar mensaje" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </output>
      )}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="compare-dialog" showCloseButton={false}>
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <DialogTitle>Comparar con otra mesa</DialogTitle>
          <DialogDescription>
            Se abre junto a la actual para pasar personas de una a otra.
          </DialogDescription>
          <div className="compare-grid">
            {strip
              .filter(({ table }) => !openTables.includes(table.id))
              .map(({ table, occupied, free }) => (
                <button
                  key={table.id}
                  className="compare-option"
                  onClick={() => {
                    showTable(table.id, true);
                    setCompareOpen(false);
                  }}
                >
                  <strong>{table.name}</strong>
                  <small>
                    {occupied}/{table.capacity} ·{' '}
                    {free === 0
                      ? 'completa'
                      : `${free} ${free === 1 ? 'libre' : 'libres'}`}
                  </small>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={addPersonOpen}
        onOpenChange={(open) => {
          setAddPersonOpen(open);
          if (!open) {
            setAddPersonName('');
            setAddPersonTable('none');
            setAddPersonSeat(null);
            setAddFromTableId(null);
          }
        }}
      >
        <DialogContent
          className="guest-dialog add-person-dialog"
          showCloseButton={false}
        >
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <DialogTitle>Agregar persona</DialogTitle>
          <DialogDescription>
            {addFromTableId
              ? `Añade un nombre a ${tableName(addFromTableId)} o déjalo sin mesa por ahora.`
              : 'Añade un nombre a la lista y decide dónde ubicarlo.'}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPerson();
            }}
          >
            <label className="field-label" htmlFor="new-person-name">
              Nombre de la persona
            </label>
            <div className="dialog-input">
              <UserRound size={16} />
              <input
                id="new-person-name"
                value={addPersonName}
                maxLength={70}
                required
                placeholder="Ej. Laura Martínez"
                onChange={(e) => setAddPersonName(e.target.value)}
              />
            </div>
            <label className="field-label" htmlFor="new-person-meal">Menú</label>
            <select id="new-person-meal" className="meal-select" value={addPersonMeal}
              onChange={(e) => setAddPersonMeal(e.target.value as Meal | 'pending')}>
              {Object.entries(mealLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span className="field-label" id="new-person-table-label">
              Mesa
            </span>
            <Select
              value={addPersonTable}
              onValueChange={(value) => {
                setAddPersonTable(String(value));
                setAddPersonSeat(null);
              }}
            >
              <SelectTrigger
                aria-labelledby="new-person-table-label"
                className="table-select"
              >
                <SelectValue>
                  {tableName(addPersonTable === 'none' ? null : addPersonTable)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin mesa</SelectItem>
                {tables.map((table) => {
                  const occupied = guests.filter(
                    (guest) => guest.tableId === table.id,
                  ).length;
                  const free = table.capacity - occupied;
                  return (
                    <SelectItem
                      key={table.id}
                      value={table.id}
                      disabled={free === 0}
                    >
                      {table.name} · {free} {free === 1 ? 'libre' : 'libres'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {addPersonTable !== 'none' && addPersonSeat !== null ? (
              <p className="seat-assignment-note">
                Se asignará al lugar {addPersonSeat + 1} de{' '}
                {tableName(addPersonTable)}.
              </p>
            ) : null}
            <div className="dialog-tip">
              <LayoutGrid size={17} />
              <span>
                Puedes moverla después desde el plano o desde la información de
                la mesa.
              </span>
            </div>
            <button
              className="button primary"
              type="submit"
              disabled={!addPersonName.trim()}
            >
              <Plus size={17} />
              Agregar persona
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setSelectedGuest(null);
        }}
      >
        <DialogContent className="guest-dialog" showCloseButton={false}>
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <DialogTitle>Un lugar para {active?.name}</DialogTitle>
          <DialogDescription>
            Edita su nombre, elige su menú o la mesa en la que estará.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveGuest();
            }}
          >
            <label className="field-label" htmlFor="guest-name">
              Nombre del invitado
            </label>
            <div className="dialog-input">
              <Pencil size={16} />
              <input
                id="guest-name"
                value={editName}
                maxLength={70}
                required
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <label className="field-label" htmlFor="guest-meal">Menú</label>
            <select id="guest-meal" className="meal-select" value={editMeal}
              onChange={(e) => setEditMeal(e.target.value as Meal | 'pending')}>
              {Object.entries(mealLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span className="field-label" id="table-label">
              Mesa
            </span>
            <Select
              value={editTable}
              onValueChange={(v) => setEditTable(String(v))}
            >
              <SelectTrigger
                aria-labelledby="table-label"
                className="table-select"
              >
                <SelectValue>
                  {tableName(editTable === 'none' ? null : editTable)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin mesa</SelectItem>
                {tables.map((t) => {
                  const count = guests.filter(
                    (g) => g.tableId === t.id && g.id !== active?.id,
                  ).length;
                  return (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      disabled={count >= t.capacity}
                    >
                      {t.name} · {t.capacity - count} libres
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="dialog-tip">
              <ArrowLeftRight size={17} />
              <span>
                Para intercambiar dos personas, arrastra una sobre el lugar de
                la otra en el plano.
              </span>
            </div>
            <button
              className="button primary"
              type="submit"
              disabled={!editName.trim()}
            >
              <Check size={17} />
              Guardar cambios
            </button>
            <button
              className="delete-person-button"
              type="button"
              onClick={() => {
                if (active) requestDelete(active.id);
              }}
            >
              <Trash2 size={15} />
              Eliminar persona del evento
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent className="delete-dialog" size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="delete-dialog-media">
              <Trash2 size={20} />
            </AlertDialogMedia>
            <AlertDialogTitle>
              ¿Eliminar a {pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta persona se quitará del evento y de su mesa. Si solo quieres
              liberar el lugar, usa «Quitar de la mesa».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="delete-confirm-action"
              onClick={deletePerson}
            >
              Eliminar persona
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={referenceOpen} onOpenChange={setReferenceOpen}>
        <DialogContent className="reference-dialog" showCloseButton={false}>
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <DialogTitle>Tu plano original</DialogTitle>
          <DialogDescription>
            La distribución está basada en esta foto. Los nombres transcritos
            son editables; revisa su ortografía. Se incluyen 89 nombres y un
            invitado pendiente por identificar.
          </DialogDescription>
          <img
            src="/plano-original.jpg"
            alt="Foto original del salón: bar y dos mesas arriba, cuatro mesas centrales, ponqué, mesa de pareja a la derecha y cuatro mesas abajo."
          />
          <p>
            Plano orientativo: las proporciones no representan medidas reales.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="help-dialog" showCloseButton={false}>
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <DialogTitle>Todo el mundo en su lugar</DialogTitle>
          <DialogDescription>
            El plano te ubica; las mesas abiertas son donde se edita.
          </DialogDescription>
          <div className="help-step">
            <LayoutGrid />
            <div>
              <strong>Abre una mesa</strong>
              <p>
                Toca una mesa del plano y sus lugares se abren al lado, con los
                nombres completos.
              </p>
            </div>
          </div>
          <div className="help-step">
            <ArrowLeftRight />
            <div>
              <strong>Abre una segunda y pasa gente</strong>
              <p>
                «Comparar» deja dos mesas abiertas a la vez. Arrastra un nombre
                de una a la otra, o tócalo y luego toca su nuevo lugar.
              </p>
            </div>
          </div>
          <div className="help-step">
            <UserRoundMinus />
            <div>
              <strong>Intercambia o deja sin mesa</strong>
              <p>
                Al tocar a alguien que ya está sentado, los dos intercambian
                lugares. «Sin mesa» lo libera sin borrarlo del evento.
              </p>
            </div>
          </div>
          <p className="local-note">
            Los cambios se guardan solo en este navegador. Puedes deshacer los
            últimos cambios durante la sesión.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
