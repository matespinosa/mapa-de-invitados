'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  Undo2,
  X,
  CircleHelp,
  Pencil,
  CheckCircle2,
  UserRound,
  MapPin,
  ArrowLeftRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  initialGuests,
  tables,
  moveGuest,
  validateGuests,
  type Guest,
  type Table,
} from './seating';
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
    [dropTarget, setDropTarget] = useState<string | null>(null);
  const [focusedTableId, setFocusedTableId] = useState<string | null>(null),
    [focusedGuestId, setFocusedGuestId] = useState<string | null>(null),
    [movingGuestId, setMovingGuestId] = useState<string | null>(null),
    [tableDetailsOpen, setTableDetailsOpen] = useState(false);
  const [toast, setToast] = useState(''),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(true);
  const [zoom, setZoom] = useState(1),
    [fit, setFit] = useState(0.85),
    [mobilePanel, setMobilePanel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  function startPointer(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    suppressClick.current = false;
    pointer.current = { id, x: e.clientX, y: e.clientY, moved: false };
  }
  const active = guests.find((g) => g.id === selectedGuest),
    seated = guests.filter((g) => g.tableId).length,
    selected = tables.find((t) => t.id === selectedTable),
    focusedTable = tables.find((t) => t.id === focusedTableId),
    movingGuest = guests.find((g) => g.id === movingGuestId),
    focusedOccupants = focusedTable
      ? guests.filter((g) => g.tableId === focusedTable.id)
      : [];
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
    const o = new ResizeObserver((e) =>
      setFit(
        Math.min(
          1.15,
          Math.max(0.35, (e[0].contentRect.width - 32) / 960),
          (e[0].contentRect.height - 12) / 760,
        ),
      ),
    );
    o.observe(canvasRef.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = pointer.current;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6)
        p.moved = true;
      if (!p.moved) return;
      e.preventDefault();
      setMovingGuestId(p.id);
      setFocusedTableId(null);
      setFocusedGuestId(null);
      setTableDetailsOpen(false);
      setMobilePanel(false);
      setDragging(p.id);
      setDragPosition({ x: e.clientX, y: e.clientY });
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-table-id]');
      setDropTarget(target?.dataset.tableId ?? null);
    }
    function onUp(e: PointerEvent) {
      const p = pointer.current;
      pointer.current = null;
      if (p?.moved) {
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-table-id]');
        if (target) {
          const id = target.dataset.tableId!;
          assign(
            p.id,
            id === 'none' ? null : id,
            target.dataset.seatIndex === undefined
              ? undefined
              : Number(target.dataset.seatIndex),
          );
        }
      }
      setDragging(null);
      setDropTarget(null);
    }
    function cancel() {
      pointer.current = null;
      setDragging(null);
      setDropTarget(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [assign]);
  function undo() {
    if (!history.length) return;
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
  function handleGuestClick(g: Guest) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (movingGuestId && g.tableId) {
      assign(movingGuestId, g.tableId, g.seat ?? undefined);
    } else if (g.tableId) focusTable(g.tableId, g.id);
    else openGuest(g);
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
    const occupants = guests.filter((g) => g.tableId === table.id),
      highlighted = occupants.some(
        (g) => query && normalize(g.name).includes(normalize(query)),
      );
    return (
      <div
        key={table.id}
        data-table-id={table.id}
        className={`table-group ${table.horizontal ? 'horizontal' : ''} ${table.id === 'couple' ? 'couple-group' : ''} ${selectedTable === table.id ? 'is-selected' : ''} ${highlighted ? 'is-found' : ''} ${dropTarget === table.id ? 'is-dropping' : ''} ${occupants.length === 0 ? 'is-empty' : ''}`}
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
          className="table-surface"
          aria-label={`${table.name}, ${occupants.length} de ${table.capacity} lugares. Ver invitados`}
          onClick={() => {
            if (movingGuestId) assign(movingGuestId, table.id);
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
              onPointerDown={(e) => {
                if (guest && !movingGuestId) startPointer(e, guest.id);
              }}
              className={`seat ${side} ${guest ? 'occupied' : 'vacant'} ${guest && query && normalize(guest.name).includes(normalize(query)) ? 'search-match' : ''} ${dragging === guest?.id ? 'is-dragging' : ''} ${movingGuestId === guest?.id ? 'move-origin' : ''}`}
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
              aria-label={
                guest
                  ? `${guest.name}, ${table.name}, lugar ${seat + 1}. Editar o mover`
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
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                if (movingGuestId) assign(movingGuestId, table.id, seat);
                else focusTable(table.id, guest?.id ?? null);
              }}
            >
              {guest ? initials(guest.name) : <Plus size={12} />}
            </button>
          );
        })}
        {table.id === 'couple' && (
          <span className="couple-label">Mesa de la pareja</span>
        )}
      </div>
    );
  }
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="./" aria-label="Recepción, inicio">
          <span className="brand-icon">
            <Armchair size={23} strokeWidth={1.8} />
          </span>
          Recepción<span className="brand-dot">.</span>
        </a>
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
              <span>{selected ? visibleGuests.length : 90}</span>
            </h2>
            {selected ? (
              <button
                className="icon-button"
                aria-label="Ver todos los invitados"
                onClick={() => setSelectedTable(null)}
              >
                <X size={17} />
              </button>
            ) : (
              <Users size={19} className="muted" />
            )}
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
                Todos <span>90</span>
              </TabsTrigger>
              <TabsTrigger value="unassigned">
                Sin mesa <span>{90 - seated}</span>
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
                <span className={`avatar tone-${Number(g.id.slice(1)) % 4}`}>
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
          className="plan-panel"
          aria-label="Plano interactivo del salón"
        >
          <div className="plan-toolbar">
            <div className="plan-title">
              <LayoutGrid size={18} />
              <h2>Plano del salón</h2>
              <span className="subtle-badge">Según tu foto</span>
            </div>
            <button
              className="button text-button"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={16} />
              <span>Deshacer</span>
            </button>
          </div>
          <div className="plan-stats">
            <span>
              <i className="status-dot purple" />
              <strong>{seated}</strong> con lugar
            </span>
            <span>
              <i className="status-dot amber" />
              <strong>{90 - seated}</strong> sin mesa
            </span>
            <span>
              <Armchair size={15} />
              <strong>{102 - seated}</strong> lugares libres
            </span>
            <span className="table-count">10 mesas + pareja</span>
          </div>
          {movingGuest && (
            <output className="move-banner">
              <span
                className={`avatar tone-${Number(movingGuest.id.slice(1)) % 4}`}
              >
                {initials(movingGuest.name)}
              </span>
              <span className="move-banner-copy">
                <small>MOVIENDO A</small>
                <strong>{movingGuest.name}</strong>
                <span>Toca otra mesa o un asiento para ubicarlo.</span>
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
              className="map-scroll-area"
              style={{ width: 960 * fit * zoom, height: 760 * fit * zoom }}
            >
              <div
                className="floor-map"
                style={{ transform: `scale(${fit * zoom})` }}
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
                <div className="open-floor-label">Un espacio para celebrar</div>
                {tables.map(renderTable)}
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
      </div>
      <footer className="workspace-footer">
        <span>
          <GripVertical size={15} />
          Toca una mesa para enfocarla; toca un nombre para moverlo.
        </span>
        <span>
          <Heart size={13} />
          Hecho para reunir
        </span>
      </footer>
      {focusedTable && !movingGuest && (
        <div className="table-focus-layer">
          <button
            className="table-focus-backdrop"
            aria-label="Cerrar vista de la mesa"
            onClick={() => {
              setFocusedTableId(null);
              setFocusedGuestId(null);
            }}
          />
          <dialog
            open
            className="table-focus-card"
            aria-modal="true"
            aria-labelledby="focused-table-title"
          >
            <header className="table-focus-header">
              <div>
                <span className="focus-kicker">MESA EN FOCO</span>
                <h2 id="focused-table-title">{focusedTable.name}</h2>
                <p>
                  {focusedOccupants.length} de {focusedTable.capacity} lugares
                  ocupados
                </p>
              </div>
              <button
                className="focus-close"
                aria-label="Cerrar mesa enfocada"
                onClick={() => {
                  setFocusedTableId(null);
                  setFocusedGuestId(null);
                }}
              >
                <X size={20} />
              </button>
            </header>
            <div className="focus-table-layout">
              <div className="focus-seat-column">
                {Array.from(
                  { length: Math.ceil(focusedTable.capacity / 2) },
                  (_, seat) => {
                    const guest = focusedOccupants.find((g) => g.seat === seat);
                    return (
                      <button
                        key={seat}
                        className={`focus-seat ${guest ? 'occupied' : 'vacant'} ${guest?.id === focusedGuestId ? 'is-current' : ''}`}
                        onPointerDown={(e) => {
                          if (guest) startPointer(e, guest.id);
                        }}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          if (guest) beginMove(guest.id);
                          else setToast('Este lugar está disponible.');
                        }}
                      >
                        <span className="focus-seat-number">
                          {String(seat + 1).padStart(2, '0')}
                        </span>
                        <span className="focus-seat-name">
                          {guest?.name ?? 'Disponible'}
                        </span>
                        {guest ? (
                          <GripVertical size={15} />
                        ) : (
                          <Plus size={15} />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                className={`focus-table-core ${focusedTable.id === 'couple' ? 'couple' : ''}`}
                onClick={() => setTableDetailsOpen(true)}
                aria-label={`Abrir detalle de ${focusedTable.name}`}
              >
                {focusedTable.id === 'couple' ? (
                  <Heart size={28} />
                ) : (
                  <span>{focusedTable.name.replace('Mesa ', '')}</span>
                )}
                <strong>{focusedTable.name}</strong>
                <small>Toca otra vez para ver el detalle</small>
              </button>
              <div className="focus-seat-column">
                {Array.from(
                  { length: Math.floor(focusedTable.capacity / 2) },
                  (_, index) => {
                    const seat = index + Math.ceil(focusedTable.capacity / 2);
                    const guest = focusedOccupants.find((g) => g.seat === seat);
                    return (
                      <button
                        key={seat}
                        className={`focus-seat ${guest ? 'occupied' : 'vacant'} ${guest?.id === focusedGuestId ? 'is-current' : ''}`}
                        onPointerDown={(e) => {
                          if (guest) startPointer(e, guest.id);
                        }}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          if (guest) beginMove(guest.id);
                          else setToast('Este lugar está disponible.');
                        }}
                      >
                        <span className="focus-seat-number">
                          {String(seat + 1).padStart(2, '0')}
                        </span>
                        <span className="focus-seat-name">
                          {guest?.name ?? 'Disponible'}
                        </span>
                        {guest ? (
                          <GripVertical size={15} />
                        ) : (
                          <Plus size={15} />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
            <div className="table-focus-tip">
              <ArrowLeftRight size={17} />
              <span>
                Toca un nombre para moverlo, o arrástralo directamente a otro
                lugar.
              </span>
            </div>
          </dialog>
        </div>
      )}
      {dragging && (
        <div
          className="drag-preview"
          style={{ left: dragPosition.x + 15, top: dragPosition.y + 15 }}
        >
          <GripVertical size={16} />
          {guests.find((g) => g.id === dragging)?.name}
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
          <DialogTitle>{focusedTable?.name}</DialogTitle>
          <DialogDescription>
            Revisa cada lugar. Puedes mover o editar a cualquier integrante.
          </DialogDescription>
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
                      className={`avatar ${guest ? `tone-${Number(guest.id.slice(1)) % 4}` : ''}`}
                    >
                      {guest ? initials(guest.name) : <Plus size={14} />}
                    </span>
                    <span className="detail-guest-name">
                      <strong>{guest?.name ?? 'Lugar disponible'}</strong>
                      <small>Lugar {seat + 1}</small>
                    </span>
                    {guest && (
                      <span className="detail-actions">
                        <button
                          onClick={() => beginMove(guest.id)}
                          aria-label={`Mover a ${guest.name}`}
                        >
                          <ArrowLeftRight size={15} />
                          Mover
                        </button>
                        <button
                          className="detail-edit"
                          onClick={() => {
                            setTableDetailsOpen(false);
                            openGuest(guest);
                          }}
                          aria-label={`Editar a ${guest.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
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
            <label className="field-label" id="table-label">
              Mesa
            </label>
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
          </form>
        </DialogContent>
      </Dialog>
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
