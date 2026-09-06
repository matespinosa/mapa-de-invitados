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
  DoorOpen,
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
  tables,
  moveGuest,
  validateGuests,
  type Guest,
  type Table,
} from './seating';
import { expandTable, fitRoom, revealAxis, roomGeometry } from './map-layout';
import {
  captureGuestPointer,
  releaseGuestPointer,
  watchGuestDrag,
  type GuestPointer,
} from './guest-drag';
const STORAGE_KEY = 'ensulugar-recepcion-v1';
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
export default function Home() {
  const [guests, setGuests] = useState<Guest[]>(initialGuests),
    [history, setHistory] = useState<Guest[][]>([]);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null),
    [editName, setEditName] = useState(''),
    [editTable, setEditTable] = useState('none');
  const [referenceOpen, setReferenceOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null),
    [dropSeat, setDropSeat] = useState<number | null>(null);
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null),
    [focusedGuestId, setFocusedGuestId] = useState<string | null>(null),
    [movingGuestId, setMovingGuestId] = useState<string | null>(null),
    [tableDetailsOpen, setTableDetailsOpen] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false),
    [addPersonName, setAddPersonName] = useState(''),
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
  function startPointer(e: React.PointerEvent, id: string) {
    captureGuestPointer(e, e.currentTarget as HTMLElement, id, pointer);
  }
  const active = guests.find((g) => g.id === selectedGuest),
    seated = guests.filter((g) => g.tableId).length,
    guestCount = guests.length,
    unassigned = guestCount - seated,
    selected = tables.find((t) => t.id === selectedTable),
    focusedTable = tables.find((t) => t.id === focusedTableId),
    movingGuest = guests.find((g) => g.id === movingGuestId),
    focusedOccupants = focusedTable
      ? guests.filter((g) => g.tableId === focusedTable.id)
      : [],
    pendingDelete = guests.find((g) => g.id === pendingDeleteId);
  const expandedTable = dragging ? undefined : focusedTable;
  const expandedLayout = expandedTable
    ? expandTable(expandedTable, guests, viewport)
    : undefined;
  const fit = fitRoom(viewport);
  const scale = fit * zoom;
  const geometry = roomGeometry(viewport, scale, expandedTable, expandedLayout);
  const focusLeft = geometry.focus?.left,
    focusTop = geometry.focus?.top;
  const focusWidth = geometry.focus?.width,
    focusHeight = geometry.focus?.height;
  const visibleGuests = guests.filter(
    (g) =>
      normalize(g.name).includes(normalize(query)) &&
      (filter !== 'unassigned' || !g.tableId) &&
      (!selectedTable || g.tableId === selectedTable),
  );
  const cancelMove = useCallback(() => {
    setMovingGuestId(null);
    setDragging(null);
    setDropTarget(null);
    setDropSeat(null);
    setFocusedTableId(null);
    setFocusedGuestId(null);
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
        // A full table needs an explicit seat choice, directly on the same map.
        if (target && seat === undefined) {
          setMovingGuestId(id);
          setFocusedTableId(target);
          setFocusedGuestId(null);
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
        if (validateGuests(parsed)) setGuests(parsed);
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
    // Preserve the camera's map coordinate while its scale or padding changes.
    const centerX = previous
      ? (previous.scrollLeft + previous.width / 2 - previous.left) /
        previous.scale
      : 480;
    const centerY = previous
      ? (previous.scrollTop + previous.height / 2 - previous.top) /
        previous.scale
      : 380;
    let left = geometry.left + centerX * scale - viewport.width / 2;
    let top = geometry.top + centerY * scale - viewport.height / 2;
    if (
      focusLeft !== undefined &&
      focusTop !== undefined &&
      focusWidth !== undefined &&
      focusHeight !== undefined
    ) {
      left = revealAxis(
        left,
        focusLeft,
        focusWidth,
        viewport.width,
        geometry.width,
      );
      top = revealAxis(
        top,
        focusTop,
        focusHeight,
        viewport.height,
        geometry.height,
      );
    }
    scroller.scrollLeft = left;
    scroller.scrollTop = top;
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
    focusLeft,
    focusTop,
    focusWidth,
    focusHeight,
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
          setFocusedTableId(null);
          setFocusedGuestId(null);
          setTableDetailsOpen(false);
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
        !tableDetailsOpen &&
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
    tableDetailsOpen,
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
  }
  function focusTable(id: string, guestId: string | null = null) {
    setFocusedTableId(id);
    setFocusedGuestId(guestId);
    setSelectedTable(id);
    setFilter('all');
    setQuery('');
    setMovingGuestId(null);
    setMobilePanel(false);
  }
  function beginMove(id: string) {
    const guest = guests.find((g) => g.id === id);
    if (!guest) return;
    setMovingGuestId(id);
    setFocusedTableId(null);
    setFocusedGuestId(null);
    setTableDetailsOpen(false);
    setMobilePanel(false);
    setToast(`Elige una mesa o un lugar para ${guest.name}`);
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
    } else if (g.tableId) focusTable(g.tableId, g.id);
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
    setAddPersonTable(canAssignToTable && table ? table.id : 'none');
    setAddPersonSeat(canAssignToTable ? seat : null);
    setAddFromTableId(tableId);
    setTableDetailsOpen(false);
    setAddPersonOpen(true);
  }
  function addPerson() {
    const name = addPersonName.trim();
    if (!name) return;
    const id = createGuestId(guests);
    const draft: Guest[] = [...guests, { id, name, tableId: null, seat: null }];
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
    if (returnToTable) setTableDetailsOpen(true);
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
    setFocusedGuestId(null);
    setToast(`${guest.name} quedó sin mesa`);
  }
  function requestDelete(id: string) {
    setTableDetailsOpen(false);
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
    setFocusedGuestId(null);
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
        g.id === active.id ? { ...g, name: editName.trim() } : g,
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
    const expanded = expandedTable?.id === table.id;
    const layout = expanded ? expandedLayout : undefined;
    const occupants = guests.filter((g) => g.tableId === table.id),
      highlighted = occupants.some(
        (g) => query && normalize(g.name).includes(normalize(query)),
      );
    return (
      <div
        key={table.id}
        data-table-id={table.id}
        inert={!!expandedTable && !expanded}
        className={`table-group ${table.horizontal ? 'horizontal' : ''} ${table.id === 'couple' ? 'couple-group' : ''} ${selectedTable === table.id ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''} ${highlighted ? 'is-found' : ''} ${dropTarget === table.id ? 'is-dropping' : ''} ${occupants.length === 0 ? 'is-empty' : ''}`}
        style={
          {
            left: table.x,
            top: table.y,
            ...(layout
              ? {
                  width: layout.width,
                  height: layout.height,
                  '--name-scale': 1 / scale,
                }
              : {}),
          } as React.CSSProperties
        }
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
        {layout && (
          <svg
            className="seat-connectors"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.seats.map((seat, index) => (
              <line
                key={index}
                x1={Math.max(
                  layout.surface.left,
                  Math.min(
                    seat.left + seat.width / 2,
                    layout.surface.left + layout.surface.width,
                  ),
                )}
                y1={Math.max(
                  layout.surface.top,
                  Math.min(
                    seat.top + seat.height / 2,
                    layout.surface.top + layout.surface.height,
                  ),
                )}
                x2={seat.left + seat.width / 2}
                y2={seat.top + seat.height / 2}
              />
            ))}
          </svg>
        )}
        <button
          className="table-touch-target"
          tabIndex={-1}
          aria-hidden="true"
          aria-label={`Seleccionar ${table.name}`}
          onClick={() => {
            if (movingGuestId) assign(movingGuestId, table.id);
            else focusTable(table.id);
          }}
        />
        <button
          className="table-surface"
          style={layout?.surface}
          aria-expanded={expanded}
          aria-label={`${table.name}, ${occupants.length} de ${table.capacity} lugares. ${expanded ? 'Editar lugares' : 'Ver invitados'}`}
          onClick={() => {
            if (movingGuestId) assign(movingGuestId, table.id);
            else if (expanded) setTableDetailsOpen(true);
            else focusTable(table.id);
          }}
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
          {table.id !== 'couple' && occupants.length === 0 && (
            <Plus size={14} />
          )}
          {expanded && <Pencil size={14} className="table-edit-hint" />}
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
              data-table-id={table.id}
              data-seat-index={seat}
              data-guest-id={guest?.id}
              onPointerDown={(e) => {
                if (
                  guest &&
                  (!movingGuestId || movingGuestId === guest.id) &&
                  (expanded || e.pointerType === 'mouse')
                )
                  startPointer(e, guest.id);
              }}
              onContextMenu={(e) => {
                if (expanded && guest) e.preventDefault();
              }}
              className={`seat ${side} ${guest ? 'occupied' : 'vacant'} ${guest && query && normalize(guest.name).includes(normalize(query)) ? 'search-match' : ''} ${dragging === guest?.id ? 'is-dragging' : ''} ${movingGuestId === guest?.id ? 'move-origin' : ''} ${expanded && guest?.id === focusedGuestId ? 'is-current' : ''} ${dropTarget === table.id && dropSeat === seat ? 'is-drop-seat' : ''}`}
              style={
                {
                  '--seat-index': table.id === 'couple' ? seat : index,
                  ...(layout
                    ? { ...layout.seats[seat], right: 'auto', bottom: 'auto' }
                    : {}),
                } as React.CSSProperties
              }
              title={
                guest
                  ? `${guest.name} · ${table.name} · Lugar ${seat + 1}`
                  : `${table.name} · Lugar ${seat + 1} disponible`
              }
              aria-label={
                guest
                  ? `${guest.name}, ${table.name}, lugar ${seat + 1}. ${expanded ? 'Arrastrar o tocar para mover' : 'Ver nombres de la mesa'}`
                  : `${table.name}, lugar ${seat + 1} disponible`
              }
              draggable={false}
              onDragStart={(e) => {
                if (!guest) return;
                e.dataTransfer.setData('text/plain', guest.id);
                e.dataTransfer.effectAllowed = 'move';
                setDragging(guest.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, table.id, seat)}
              onClick={() => {
                if (movingGuestId) assign(movingGuestId, table.id, seat);
                else if (expanded && guest) beginMove(guest.id);
                else if (expanded) openAddPerson(table.id, seat);
                else focusTable(table.id, guest?.id ?? null);
              }}
            >
              {expanded ? (
                <span className="seat-name">{guest?.name ?? 'Disponible'}</span>
              ) : guest ? (
                initials(guest.name)
              ) : (
                <Plus size={12} />
              )}
            </button>
          );
        })}
        {table.id === 'couple' && !expanded && (
          <span className="couple-label">Mesa de la pareja</span>
        )}
      </div>
    );
  }
  return (
    <main className={`app-shell ${mapOnly ? 'map-only' : ''}`}>
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
      <div className="workspace">
        <aside className={`guest-panel ${mobilePanel ? 'mobile-open' : ''}`}>
          <div className="panel-heading">
            <h2>
              {selected ? selected.name : 'Tus invitados'}
              <span>{selected ? visibleGuests.length : guestCount}</span>
            </h2>
            <div className="panel-heading-actions">
              <button
                className="button add-person-trigger"
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
                onPointerDown={(e) => startPointer(e, g.id)}
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
                <GripVertical size={14} className="drag-handle" />
                <span className={`avatar tone-${toneIndex(g.id)}`}>
                  {initials(g.name)}
                </span>
                <span className="guest-info">
                  <strong>{g.name}</strong>
                  <span>
                    {tableName(g.tableId)}
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
            <span>Toca un nombre para ver su mesa y moverlo.</span>
          </div>
        </aside>
        <section
          className={`plan-panel ${expandedTable ? 'has-expanded-table' : ''}`}
          aria-label="Plano interactivo del salón"
        >
          <div className="plan-toolbar">
            <div className="plan-title">
              <LayoutGrid size={18} />
              <h2>{expandedTable?.name ?? 'Plano del salón'}</h2>
              {!expandedTable && (
                <span className="subtle-badge">Según tu foto</span>
              )}
            </div>
            <div className="plan-actions">
              {expandedTable && (
                <button
                  className="icon-button focus-dismiss"
                  aria-label="Cerrar nombres de la mesa"
                  onClick={() => {
                    setFocusedTableId(null);
                    setFocusedGuestId(null);
                  }}
                >
                  <X size={19} />
                </button>
              )}
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
            <span className="table-count">10 mesas + pareja</span>
          </div>
          {movingGuest && !dragging && (
            <output className="move-banner">
              <span className={`avatar tone-${toneIndex(movingGuest.id)}`}>
                {initials(movingGuest.name)}
              </span>
              <span className="move-banner-copy">
                <small>MOVIENDO A</small>
                <strong>{movingGuest.name}</strong>
                <span>
                  {expandedTable
                    ? 'Toca un nombre para intercambiar sus lugares.'
                    : 'Toca otra mesa o un asiento para ubicarlo.'}
                </span>
              </span>
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
                  className={`floor-map ${expandedTable ? 'has-table-focus' : ''}`}
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
                    <div className="door-gap">
                      <DoorOpen size={20} />
                      <span>ENTRADA</span>
                    </div>
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
                  <div className="open-floor-label">
                    Un espacio para celebrar
                  </div>
                  {expandedTable && (
                    <button
                      className="map-focus-dimmer"
                      aria-label="Cerrar nombres de la mesa"
                      style={{
                        left: -geometry.left / scale,
                        top: -geometry.top / scale,
                        width: geometry.width / scale,
                        height: geometry.height / scale,
                      }}
                      onClick={() => {
                        setFocusedTableId(null);
                        setFocusedGuestId(null);
                      }}
                    />
                  )}
                  {tables.map(renderTable)}
                </div>
              </div>
            </div>
          </div>
          <div className="canvas-bottom">
            {expandedTable ? (
              <span className="map-instruction">
                {movingGuest
                  ? 'Toca un asiento para ubicarlo.'
                  : 'Arrastra un nombre hacia otra mesa.'}
              </span>
            ) : (
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
            )}
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
      </div>
      <footer className="workspace-footer">
        <span>
          <GripVertical size={15} />
          Toca una inicial para ver los nombres; arrastra un nombre para
          moverlo.
        </span>
        <span>
          <Heart size={13} />
          Hecho para reunir
        </span>
      </footer>
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
      <Dialog
        open={tableDetailsOpen && !!focusedTable}
        onOpenChange={setTableDetailsOpen}
      >
        <DialogContent className="table-detail-dialog" showCloseButton={false}>
          <DialogClose className="dialog-close-button" aria-label="Cerrar">
            <X size={18} />
          </DialogClose>
          <div className="table-detail-heading">
            <div>
              <DialogTitle>Información de {focusedTable?.name}</DialogTitle>
              <DialogDescription>
                Administra quién ocupa cada lugar de esta mesa.
              </DialogDescription>
            </div>
            <button
              className="button table-add-button"
              onClick={() => openAddPerson(focusedTable?.id ?? null)}
            >
              <Plus size={15} />
              <span>Agregar persona</span>
            </button>
          </div>
          <div className="table-detail-list">
            {focusedTable &&
              Array.from({ length: focusedTable.capacity }, (_, seat) => {
                const guest = focusedOccupants.find((g) => g.seat === seat);
                return (
                  <div
                    className={`table-detail-row ${guest ? '' : 'is-vacant'}`}
                    key={seat}
                  >
                    <span className="detail-seat-number">
                      {String(seat + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`avatar ${guest ? `tone-${toneIndex(guest.id)}` : ''}`}
                    >
                      {guest ? initials(guest.name) : <Plus size={14} />}
                    </span>
                    <span className="detail-guest-name">
                      <strong>{guest?.name ?? 'Lugar disponible'}</strong>
                      <small>Lugar {seat + 1}</small>
                    </span>
                    {guest ? (
                      <span className="detail-actions">
                        <button
                          onClick={() => beginMove(guest.id)}
                          aria-label={`Mover a ${guest.name}`}
                          title="Mover a otra mesa"
                        >
                          <ArrowLeftRight size={15} />
                          <span className="detail-action-label">Mover</span>
                        </button>
                        <button
                          className="detail-remove"
                          onClick={() => removeFromTable(guest.id)}
                          aria-label={`Quitar a ${guest.name} de la mesa`}
                          title="Quitar de la mesa"
                        >
                          <UserRoundMinus size={15} />
                          <span className="detail-action-label">Quitar</span>
                        </button>
                        <button
                          className="detail-edit"
                          onClick={() => {
                            setTableDetailsOpen(false);
                            openGuest(guest);
                          }}
                          aria-label={`Editar a ${guest.name}`}
                          title="Editar persona"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="detail-delete"
                          onClick={() => requestDelete(guest.id)}
                          aria-label={`Eliminar a ${guest.name} del evento`}
                          title="Eliminar del evento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    ) : (
                      <button
                        className="detail-add-slot"
                        onClick={() =>
                          openAddPerson(focusedTable?.id ?? null, seat)
                        }
                        aria-label={`Agregar una persona al lugar ${seat + 1}`}
                      >
                        <Plus size={15} />
                        <span>Agregar aquí</span>
                      </button>
                    )}
                  </div>
                );
              })}
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
            Edita su nombre o elige la mesa en la que estará.
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
            Tres formas sencillas de organizar la recepción.
          </DialogDescription>
          <div className="help-step">
            <LayoutGrid />
            <div>
              <strong>Enfoca una mesa</strong>
              <p>
                Toca una mesa o una persona para ver todos los nombres de ese
                grupo.
              </p>
            </div>
          </div>
          <div className="help-step">
            <ArrowLeftRight />
            <div>
              <strong>Mueve con un toque o arrastre</strong>
              <p>
                Toca un nombre y luego su destino. También puedes arrastrarlo
                sobre otra mesa o persona.
              </p>
            </div>
          </div>
          <div className="help-step">
            <Pencil />
            <div>
              <strong>Abre el detalle</strong>
              <p>
                Con la mesa enfocada, tócala de nuevo para revisar y editar cada
                lugar.
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
