'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import TransposedDayView from '@/components/staff/TransposedDayView';
import EditBookingItemModal from '@/components/staff/EditBookingItemModal';
import {
  generateSlotsForActivity,
  getHoursForDate,
  toMinutes,
  fromMinutes,
  toDateStr,
  parseDate,
  dayLabelsFrFull,
} from '@/lib/hours';
import {
  listBookings,
  getSlotBlocks,
  blockSlot,
  unblockSlot,
  unblockBatch,
  updateSlotBlock,
  updateSlotBlockBatch,
  subscribeBookings,
  logAudit,
} from '@/lib/data';

function hashRoom(id) {
  const h = String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['k7-record', 'k7-studio', 'k7-dancefloor'][h % 3];
}

function loadPref(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(`mw_cal_${key}`); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function savePref(key, value) {
  if (typeof window !== 'undefined') localStorage.setItem(`mw_cal_${key}`, JSON.stringify(value));
}

export default function StaffCalendarPage() {
  const searchParams = useSearchParams();
  const [date, setDate] = useState(toDateStr(new Date()));
  const [view, _setView] = useState(() => loadPref('view', 'day'));
  const setView = (v) => { _setView(v); savePref('view', v); };
  const [dayLayout, _setDayLayout] = useState(() => loadPref('layout', 'transposed'));
  const setDayLayout = (v) => { _setDayLayout(v); savePref('layout', v); };
  const [pxTime, _setPxTime] = useState(() => Math.max(100, loadPref('pxTime', 100)));
  const setPxTime = (v) => { const clamped = Math.max(100, Number(v) || 100); _setPxTime(clamped); savePref('pxTime', clamped); };
  const [pxActivity, _setPxActivity] = useState(() => loadPref('pxActivity', 160));
  const setPxActivity = (v) => { _setPxActivity(v); savePref('pxActivity', v); };
  const [visible, setVisible] = useState(new Set(activities.filter((a) => a.bookable).map((a) => a.id)));
  const [k7Open, setK7Open] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  const [selAnchor, setSelAnchor] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState('');
  const [hoverSlot, setHoverSlot] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef(null);
  const dateInputRef = useRef(null);
  const calRef = useRef(null);
  const stickyHeaderRef = useRef(null);

  // Mesure dynamique de la hauteur du sticky header → publie une CSS var
  // utilisée par les en-têtes de colonnes d'activités (sticky bar séparée au-dessus de la grille).
  useEffect(() => {
    if (!stickyHeaderRef.current || !calRef.current) return;
    const STAFF_NAV = 44;
    const update = () => {
      const h = stickyHeaderRef.current?.offsetHeight || 0;
      calRef.current?.style.setProperty('--cal-lane-top', `${STAFF_NAV + h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(stickyHeaderRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [view]);
  const [highlightBookingId, setHighlightBookingId] = useState(null);

  useEffect(() => {
    listBookings({ from: date, to: date }).then(setBookings);
    getSlotBlocks(date).then(setBlocks);
  }, [date, tick]);

  useEffect(() => {
    listBookings().then(setAllBookings);
  }, [tick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const d = searchParams.get('date');
    if (d) setDate(d);
    // Si on arrive avec un highlight (depuis /staff/bookings), forcer la vue classique
    // car l'autoscroll vertical y fonctionne mieux qu'en transposée.
    if (searchParams.get('highlight')) setDayLayout('classic');
  }, [searchParams]);

  const autoScrolledRef = useRef(null);

  const goNow = () => {
    const today = toDateStr(new Date());
    if (date !== today) setDate(today);
    if (view !== 'day') setView('day');
    if (dayLayout !== 'classic') setDayLayout('classic');
    // Heure courante en fuseau Europe/Brussels — H-15min, arrondi inférieur 5min
    const fmt = new Intl.DateTimeFormat('fr-BE', {
      timeZone: 'Europe/Brussels',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === 'hour').value, 10);
    const m = parseInt(parts.find((p) => p.type === 'minute').value, 10);
    const targetMin = Math.max(0, h * 60 + m - 15);
    const targetHour = Math.floor(targetMin / 60);
    const targetHourStr = `${String(targetHour).padStart(2, '0')}:00`;
    let attempts = 0;
    const tryScroll = () => {
      const root = calRef.current;
      if (root) {
        const target = root.querySelector(`[data-hour="${targetHourStr}"]`);
        if (target) {
          const rect = target.getBoundingClientRect();
          const targetY = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
          return;
        }
      }
      attempts += 1;
      if (attempts < 15) setTimeout(tryScroll, 200);
    };
    setTimeout(tryScroll, 350);
  };

  useEffect(() => {
    if (!searchParams) return;
    const hl = searchParams.get('highlight');
    if (!hl) return;
    setHighlightBookingId(hl);
    if (autoScrolledRef.current === hl) return;
    if (!bookings || bookings.length === 0) return;
    const target = bookings.find((b) => (b.id || b.reference) === hl);
    if (!target) return;
    autoScrolledRef.current = hl;
    // scrollIntoView traverse tous les ancestors scrollables — plus robuste qu'un scrollTo manuel.
    // Retry car le slot peut ne pas être rendu immédiatement.
    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector('.cal-slot-highlight');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < 8) setTimeout(tryScroll, 200);
    };
    setTimeout(tryScroll, 250);
  }, [bookings, searchParams]);

  const pxH = pxTime; // Contrôlé par le slider (les presets mettent à jour pxTime)
  const hours = getHoursForDate(date);

  // Lanes
  const [slashOpen, setSlashOpen] = useState(false);

  const lanes = useMemo(() => {
    const out = [];
    activities.filter((a) => a.bookable && visible.has(a.id)).forEach((a) => {
      // K7 et Slash : afficher les sous-lanes (rooms/pistes)
      const hasRooms = a.rooms && a.rooms.length > 0;
      const isExpanded = (a.id === 'k7' && k7Open) || (a.id === 'slashhit' && slashOpen);
      if (hasRooms && isExpanded) {
        a.rooms.forEach((r) => out.push({ ...a, laneId: r.id, laneLabel: `${a.name} ${r.name}`, isRoom: true, roomId: r.id, maxPlayers: r.maxPlayers, minPlayers: r.minPlayers || a.minPlayers }));
      } else if (hasRooms && !isExpanded) {
        // Compacté : 1 colonne par room mais largeur réduite
        a.rooms.forEach((r) => out.push({ ...a, laneId: r.id, laneLabel: r.name, isRoom: true, roomId: r.id, maxPlayers: r.maxPlayers, minPlayers: r.minPlayers || a.minPlayers, compact: true }));
      } else {
        out.push({ ...a, laneId: a.id, laneLabel: a.name });
      }
    });
    return out;
  }, [visible, k7Open, slashOpen]);

  // Selected search result → highlight slots (cyan)
  const highlightIds = useMemo(() => {
    const s = new Set();
    if (highlightBookingId) s.add(highlightBookingId);
    return s;
  }, [highlightBookingId]);

  // Search dropdown results — current day first, then upcoming, then past
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const matched = allBookings.filter((b) => {
      return (
        (b.id || b.reference || '').toLowerCase().includes(q) ||
        (b.customer?.name || '').toLowerCase().includes(q) ||
        (b.customer?.firstName || '').toLowerCase().includes(q) ||
        (b.customer?.lastName || '').toLowerCase().includes(q) ||
        (b.customer?.email || '').toLowerCase().includes(q)
      );
    });
    const today = date;
    return matched.sort((a, b) => {
      const aIsDay = a.date === today ? 0 : 1;
      const bIsDay = b.date === today ? 0 : 1;
      if (aIsDay !== bIsDay) return aIsDay - bIsDay;
      // Then sort by absolute distance to displayed date
      const da = Math.abs(new Date(a.date) - new Date(today));
      const db = Math.abs(new Date(b.date) - new Date(today));
      return da - db;
    }).slice(0, 30);
  }, [search, allBookings, date]);

  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const onPickSearchResult = (b) => {
    if (b.date !== date) setDate(b.date);
    if (view !== 'day') setView('day');
    setHighlightBookingId(b.id || b.reference);
    setSearch('');
    setSearchFocused(false);
    // Autoscroll vers le 1er créneau de la résa
    const items = (b.items || []).slice().sort((a, c) => (a.start || '').localeCompare(c.start || ''));
    const first = items[0];
    if (!first?.start) return;
    const [hh] = first.start.split(':').map(Number);
    const targetHourStr = `${String(hh).padStart(2, '0')}:00`;
    let attempts = 0;
    const tryScroll = () => {
      const root = calRef.current;
      if (root) {
        const target = root.querySelector(`[data-hour="${targetHourStr}"]`);
        if (target) {
          const rect = target.getBoundingClientRect();
          const targetY = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
          return;
        }
      }
      attempts += 1;
      if (attempts < 15) setTimeout(tryScroll, 200);
    };
    setTimeout(tryScroll, 350);
  };

  const toggleVis = (id) => { const n = new Set(visible); if (n.has(id)) n.delete(id); else n.add(id); setVisible(n); };
  const goPrev = () => { const d = parseDate(date); d.setDate(d.getDate() - (view === 'month' ? 30 : view === 'week' ? 7 : 1)); setDate(toDateStr(d)); };
  const goNext = () => { const d = parseDate(date); d.setDate(d.getDate() + (view === 'month' ? 30 : view === 'week' ? 7 : 1)); setDate(toDateStr(d)); };
  const goToday = () => setDate(toDateStr(new Date()));

  // Click handler for slots
  const handleClick = useCallback((laneId, actDef, slot, e) => {
    if (e.shiftKey && selAnchor && selAnchor.laneId === laneId) {
      const all = generateSlotsForActivity(actDef, date, { fullDay: true });
      const i1 = all.findIndex((s) => s.start === selAnchor.slot.start);
      const i2 = all.findIndex((s) => s.start === slot.start);
      if (i1 >= 0 && i2 >= 0) {
        const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
        setMultiSel(all.slice(lo, hi + 1).map((s) => ({ laneId, actDef, slot: s })));
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setMultiSel((prev) => {
        const key = `${laneId}-${slot.start}`;
        const has = prev.find((s) => `${s.laneId}-${s.slot.start}` === key);
        if (has) return prev.filter((s) => `${s.laneId}-${s.slot.start}` !== key);
        return [...prev, { laneId, actDef, slot }];
      });
      setSelAnchor({ laneId, slot });
      return;
    }
    // Normal click with multi-sel active
    if (multiSel.length > 0) {
      setMultiSel([{ laneId, actDef, slot }]);
      setSelAnchor({ laneId, slot });
      return;
    }
    // Normal click → select single (blue border)
    setMultiSel([{ laneId, actDef, slot }]);
    setSelAnchor({ laneId, slot });
  }, [selAnchor, multiSel, date]);

  // Right-click handler
  const handleRightClick = useCallback((e, laneId, actDef, slot) => {
    e.preventDefault();
    e.stopPropagation();
    // If nothing is selected, select this one first
    if (multiSel.length === 0) {
      setMultiSel([{ laneId, actDef, slot }]);
      setSelAnchor({ laneId, slot });
    }
    const items = bookings.flatMap((b) =>
      (b.items || []).filter((i) => i.activityId === actDef.id && i.start === slot.start).map((i) => ({ ...i, booking: b }))
    );
    const block = blocks.find((bl) => (bl.activity_id || bl.activityId) === actDef.id && (bl.start_time?.slice(0, 5) || bl.start) === slot.start);
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      laneId,
      actDef,
      slot,
      items,
      block,
    });
  }, [multiSel, bookings, blocks]);

  // Hover tooltip
  const onSlotEnter = (laneId, actDef, slot) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const items = bookings.flatMap((b) =>
        (b.items || []).filter((i) => i.activityId === actDef.id && i.start === slot.start).map((i) => ({ ...i, booking: b }))
      );
      setHoverSlot({ laneId, slot, items, actDef });
    }, 800);
  };
  const onSlotLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverSlot(null);
  };

  // Block batch
  const blockBatch = async (reason, note, label, blockedSeats = 0) => {
    const bid = 'batch-' + Date.now();
    for (const s of multiSel) {
      await blockSlot({ activityId: s.actDef.id, laneId: s.laneId, date, start: s.slot.start, end: s.slot.end, reason, note, label, batchId: bid, blockedSeats });
    }
    await logAudit({ action: 'block_batch', entityType: 'slots', entityId: bid, notes: `${multiSel.length} slots — ${label || reason}` });
    setMultiSel([]); setSelAnchor(null); setSelected(null); setTick((t) => t + 1);
  };

  const blockHour = async (hour) => {
    if (!confirm(`Bloquer ${hour} sur toutes les activités affichées ?`)) return;
    const bid = 'batch-h-' + Date.now();
    for (const l of lanes) {
      const slots = generateSlotsForActivity(l, date, { fullDay: true });
      const s = slots.find((sl) => sl.start === hour);
      if (s) await blockSlot({ activityId: l.id, laneId: l.laneId, date, start: s.start, end: s.end, reason: 'b2b', batchId: bid });
    }
    setTick((t) => t + 1);
  };

  // Disable native context menu on calendar
  useEffect(() => {
    const el = calRef.current;
    if (!el) return;
    const handler = (e) => e.preventDefault();
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  return (
    <div ref={calRef} className="mx-auto max-w-7xl px-2 py-4 md:px-4 md:py-6" onClick={() => { setCtxMenu(null); }} onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}>
      <div ref={stickyHeaderRef} className={view === 'day' ? 'sticky top-[44px] z-30 bg-mw-bg pt-3 pb-2' : ''}>
      {/* Header — titre, toggles activités (logos compacts), recherche */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <h1 className="section-title shrink-0 hidden md:block">Calendrier</h1>
        <div className="flex flex-1 items-center justify-start gap-1.5 flex-wrap md:justify-center">
          {activities.filter((a) => a.bookable).map((a) => (
            <button
              key={a.id}
              onClick={() => toggleVis(a.id)}
              title={a.name}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded border transition ${
                visible.has(a.id)
                  ? 'border-mw-pink bg-mw-pink/10'
                  : 'border-white/15 bg-white/5 opacity-50 hover:opacity-80'
              }`}
            >
              <Image src={a.logo} alt={a.name} fill sizes="36px" className="object-contain p-1.5" />
            </button>
          ))}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            title="Rechercher"
            className={`md:hidden relative ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border transition ${
              mobileSearchOpen ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 bg-white/5 text-white/70'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </button>
        </div>

        <div className={`relative w-full md:w-[490px] md:shrink-0 ${mobileSearchOpen ? '' : 'hidden md:block'}`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Rechercher ID, nom, email…"
            className="input !py-2 text-sm w-full"
          />
          {searchFocused && search.trim() && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded border border-white/10 bg-mw-surface shadow-xl">
              {searchResults.length === 0 && (
                <div className="px-3 py-2 text-xs text-white/40">Aucun résultat</div>
              )}
              {searchResults.map((b) => {
                const isOtherDay = b.date !== date;
                return (
                  <button
                    key={b.id || b.reference}
                    onMouseDown={(e) => { e.preventDefault(); onPickSearchResult(b); }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-white/5"
                  >
                    <span className="font-mono text-mw-pink shrink-0">{b.id || b.reference}</span>
                    <span className="flex-1 truncate text-white/80">
                      {b.customer?.name || `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || '—'}
                      <span className="ml-2 text-white/40">{b.customer?.email}</span>
                    </span>
                    {isOtherDay && (
                      <span className="shrink-0 rounded bg-mw-yellow/20 px-2 py-0.5 text-[10px] text-mw-yellow">
                        {new Date(b.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-sel banner */}
      {multiSel.length > 1 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded border-2 border-blue-400 bg-blue-500/15 px-4 py-3 text-sm">
          <div className="display text-blue-300">{multiSel.length} créneau(x) · Shift pour étendre · Ctrl pour ajouter</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setMultiSel([]); setSelAnchor(null); }} className="text-xs text-white/60 hover:text-mw-red">Annuler</button>
            <button onClick={() => setSelected({ batch: multiSel })} className="btn-primary !py-2 !px-4 text-xs">Bloquer & noter →</button>
          </div>
        </div>
      )}

      {/* Toolbar — view buttons, sliders, view selector, date picker */}
      <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-3">
        {view === 'day' && (
          <div className="flex w-full flex-nowrap items-center gap-2 md:w-auto md:contents">
            <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1 shrink-0">
              <button onClick={() => setDayLayout('classic')} className={`display rounded px-2 py-1 text-xs md:px-3 ${dayLayout === 'classic' ? 'bg-mw-pink text-white' : 'text-white/70'}`}>↕</button>
              <button onClick={() => setDayLayout('transposed')} className={`display rounded px-2 py-1 text-xs md:px-3 ${dayLayout === 'transposed' ? 'bg-mw-pink text-white' : 'text-white/70'}`}>↔</button>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-white/60 md:flex-none md:gap-2">
              <span className="text-[10px] hidden md:inline">Heures</span>
              <span className="text-[10px] md:hidden">H</span>
              <input type="range" min="104" max="600" value={pxTime} onChange={(e) => setPxTime(Number(e.target.value))} className="min-w-0 flex-1 accent-mw-pink md:w-24 md:flex-none" />
              <span className="shrink-0 text-[10px] text-white/40 md:w-10">{pxTime}</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-white/60 md:flex-none md:gap-2">
              <span className="text-[10px] hidden md:inline">Activités</span>
              <span className="text-[10px] md:hidden">A</span>
              <input type="range" min="30" max="600" value={pxActivity} onChange={(e) => setPxActivity(Number(e.target.value))} className="min-w-0 flex-1 accent-mw-pink md:w-24 md:flex-none" />
              <span className="shrink-0 text-[10px] text-white/40 md:w-10">{pxActivity}</span>
            </div>
          </div>
        )}

        <div className="ml-auto flex w-full flex-nowrap items-center justify-between gap-2 md:w-[490px] md:justify-between">
          <button
            onClick={goNow}
            className="display flex h-9 items-center whitespace-nowrap rounded border border-mw-yellow/40 bg-mw-yellow/15 px-2.5 text-xs text-mw-yellow hover:border-mw-yellow"
            title="Aujourd'hui — H-15min (Europe/Brussels)"
          >
            NOW
          </button>

          <div className="flex h-9 shrink-0 items-center gap-0.5 rounded border border-white/15 bg-white/5 p-1">
            {[['day', 'Jour', 'J'], ['week', 'Sem', 'S'], ['month', 'Mois', 'M']].map(([v, l, s]) => (
              <button key={v} onClick={() => setView(v)} className={`display flex h-full min-w-[28px] items-center justify-center rounded px-2 text-[11px] md:px-1.5 md:text-[10px] ${view === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}>
                <span className="hidden md:inline">{l}</span>
                <span className="md:hidden">{s}</span>
              </button>
            ))}
          </div>

          <div className="relative flex h-9 min-w-0 flex-1 items-center gap-1 rounded border border-white/15 bg-white/5 p-1 md:w-[300px]">
            <button onClick={goPrev} className="shrink-0 px-2 py-1 text-sm text-white/70 hover:text-white">←</button>
            <button
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="display min-w-0 flex-1 truncate px-1 py-1 text-center text-[11px] font-bold text-white hover:text-mw-pink"
            >
              <span className="hidden md:inline">{parseDate(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span>
              <span className="md:hidden">{parseDate(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</span>
            </button>
            <button onClick={goNext} className="shrink-0 px-2 py-1 text-sm text-white/70 hover:text-white">→</button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>
      </div>
      </div>

      {/* Calendar view */}
      {view === 'day' && hours && dayLayout === 'transposed' && (
        <TransposedDayView
          date={date} lanes={lanes} bookings={bookings} blocks={blocks}
          pxPerHour={pxH} pxActivity={pxActivity} hours={hours}
          multiSel={multiSel} highlightIds={highlightIds}
          onClick={handleClick} onRightClick={handleRightClick}
          onHoverEnter={onSlotEnter} onHoverLeave={onSlotLeave}
          onBlockHour={blockHour}
          k7Open={k7Open} onToggleK7={() => setK7Open(!k7Open)}
          slashOpen={slashOpen} onToggleSlash={() => setSlashOpen(!slashOpen)}
        />
      )}
      {view === 'day' && hours && dayLayout === 'classic' && (
        <DayViewV2
          date={date} lanes={lanes} bookings={bookings} blocks={blocks}
          pxH={pxH} pxActivity={pxActivity} hours={hours}
          multiSel={multiSel} highlightIds={highlightIds}
          onClick={handleClick} onRightClick={handleRightClick}
          onHoverEnter={onSlotEnter} onHoverLeave={onSlotLeave}
          onBlockHour={blockHour}
          k7Open={k7Open} onToggleK7={() => setK7Open(!k7Open)}
          slashOpen={slashOpen} onToggleSlash={() => setSlashOpen(!slashOpen)}
          onOpenBlock={setSelected}
        />
      )}
      {view === 'day' && !hours && (
        <div className="rounded border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">Fermé.</div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <WeekView date={date} lanes={lanes} bookings={bookings} />
      )}

      {/* Month view */}
      {view === 'month' && (
        <MonthView date={date} bookings={bookings} onChangeDate={setDate} visibleActivityIds={visible} />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[220px] rounded border border-white/20 bg-mw-surface shadow-lg"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 240), top: Math.min(ctxMenu.y, window.innerHeight - 300) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-white/10 px-3 py-2 text-xs text-white/50">
            {ctxMenu.actDef.name} · {ctxMenu.slot.start}→{ctxMenu.slot.end}
          </div>
          {ctxMenu.items.length > 0 && (
            <div className="border-b border-white/10 px-3 py-2">
              <div className="mb-1 text-[10px] uppercase text-white/40">Réservations</div>
              {ctxMenu.items.map((it, i) => (
                <div key={i} className="flex w-full items-center gap-1">
                  <button
                    onClick={() => {
                      setHighlightBookingId(it.booking?.id || it.booking?.reference || null);
                      setCtxMenu(null);
                    }}
                    className="flex-1 rounded px-2 py-1 text-left text-xs hover:bg-white/10"
                  >
                    <span className="text-mw-pink">{it.booking?.customer?.name || 'Client'}</span>
                    <span className="ml-2 text-white/50">{it.players}j · {it.booking?.id || it.booking?.reference}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem({ booking: it.booking, item: it });
                      setCtxMenu(null);
                    }}
                    title="Modifier (déplacer ou splitter)"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/60 hover:bg-mw-pink/20 hover:text-mw-pink"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="px-1 py-1">
            <button
              onClick={() => {
                setSelected({ batch: multiSel.length > 0 ? multiSel : [{ laneId: ctxMenu.laneId, actDef: ctxMenu.actDef, slot: ctxMenu.slot }] });
                setCtxMenu(null);
              }}
              className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-white/10"
            >
              🔒 Bloquer ce(s) créneau(x)
            </button>
            <button
              onClick={() => {
                // Pré-remplir avec les créneaux sélectionnés (multiSel ou créneau unique)
                const slotsToBook = multiSel.length > 0
                  ? multiSel.map((s) => ({ activityId: s.actDef.id, start: s.slot.start, end: s.slot.end }))
                  : [{ activityId: ctxMenu.actDef.id, start: ctxMenu.slot.start, end: ctxMenu.slot.end }];
                sessionStorage.setItem('mw_onsite_prefill', JSON.stringify({ date, slots: slotsToBook }));
                setCtxMenu(null);
                window.location.href = '/staff/on-site';
              }}
              className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-white/10"
            >
              📝 Réserver sur ce(s) créneau(x)
            </button>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoverSlot && (
        <div className="fixed z-40 rounded border border-white/20 bg-mw-surface px-3 py-2 shadow-lg text-xs pointer-events-none"
          style={{ left: Math.min(hoverPos.x + 15, (typeof window !== 'undefined' ? window.innerWidth - 250 : 500)), top: Math.min(hoverPos.y - 10, (typeof window !== 'undefined' ? window.innerHeight - 100 : 400)) }}>
          <div className="display text-sm">{hoverSlot.actDef.name} · {hoverSlot.slot.start}→{hoverSlot.slot.end}</div>
          {hoverSlot.items.length === 0 && <div className="text-white/50">Libre</div>}
          {hoverSlot.items.map((it, i) => (
            <div key={i} className="text-white/70">{it.booking?.customer?.name || 'Client'} — {it.players} joueurs</div>
          ))}
        </div>
      )}

      <EditBookingItemModal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        booking={editingItem?.booking}
        item={editingItem?.item}
        onSaved={() => { setTick((t) => t + 1); setEditingItem(null); }}
      />

      {/* Block dialog */}
      {selected && (
        <BlockDialog
          slot={selected}
          onClose={() => setSelected(null)}
          onBlock={blockBatch}
          onUnblock={async (block) => {
            if (block.batchId?.startsWith('batch-')) await unblockBatch(block.batchId);
            else await unblockSlot(block.id);
            setSelected(null); setTick((t) => t + 1);
          }}
          onUpdateLabel={async (block, label, note) => {
            if (block.batchId) await updateSlotBlockBatch(block.batchId, { label, note });
            else await updateSlotBlock(block.id, { label, note });
            setSelected(null); setTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function DayViewV2({ date, lanes, bookings, blocks, pxH, pxActivity = 160, hours, multiSel, highlightIds, onClick, onRightClick, onHoverEnter, onHoverLeave, onBlockHour, k7Open, onToggleK7, slashOpen, onToggleSlash, onOpenBlock }) {
  // Full 24h display
  const hourCount = 24;
  const openM = hours ? toMinutes(hours.open) : -1;
  const closeM = hours ? toMinutes(hours.close) : -1;

  const gridScrollRef = useRef(null);
  const headerInnerRef = useRef(null);

  useEffect(() => {
    const grid = gridScrollRef.current;
    const inner = headerInnerRef.current;
    if (!grid || !inner) return;
    const sync = () => { inner.style.transform = `translateX(${-grid.scrollLeft}px)`; };
    grid.addEventListener('scroll', sync, { passive: true });
    sync();
    return () => grid.removeEventListener('scroll', sync);
  }, []);

  return (
    <>
      {/* Sticky activity headers — sous la toolbar, scroll horizontal synchro avec la grille */}
      <div className="sticky z-20 flex overflow-hidden border border-b-0 border-white/10 bg-mw-bg" style={{ top: 'var(--cal-lane-top, 44px)' }}>
        <div className="w-14 shrink-0 border-r border-white/10 bg-mw-bg" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div ref={headerInnerRef} className="flex min-w-full" style={{ willChange: 'transform' }}>
            {lanes.map((lane) => {
              const laneW = lane.compact ? Math.round(pxActivity / 3) : pxActivity;
              return (
                <div
                  key={lane.laneId}
                  className="flex h-12 shrink-0 grow items-center gap-1 border-r border-white/10 px-1.5 cursor-pointer"
                  style={{ width: `${laneW}px`, minWidth: `${laneW}px` }}
                  onClick={lane.id === 'k7' ? onToggleK7 : (lane.id === 'slashhit' ? onToggleSlash : undefined)}
                >
                  <div className="relative h-5 w-5 shrink-0"><Image src={lane.logo} alt="" fill sizes="20px" className="object-contain" /></div>
                  <div className="display min-w-0 truncate text-[12px]">{lane.laneLabel}</div>
                  {lane.id === 'k7' && <span className="text-[10px] text-white/40">{k7Open ? '−' : '+'}</span>}
                  {lane.id === 'slashhit' && <span className="text-[10px] text-white/40">{slashOpen ? '−' : '+'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    <div ref={gridScrollRef} className="overflow-x-auto rounded-b border border-white/10 bg-mw-bg">
      <div className="flex min-w-full">
        {/* Time column */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-white/10 bg-mw-bg">
          {Array.from({ length: hourCount }).map((_, i) => {
            const h = fromMinutes(i * 60);
            const inOpen = openM >= 0 && i * 60 >= openM && i * 60 < closeM;
            return (
              <div key={i} data-hour={h} className={`group relative border-b border-white/5 pr-1 pt-1 ${!inOpen ? 'cal-closed-hour' : ''}`} style={{ height: `${pxH}px` }}>
                <div className="display text-right text-[12px] text-white/40">{h}</div>
                {inOpen && (
                  <button onClick={() => onBlockHour(h)} className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-l bg-mw-red px-1 text-[9px] text-white group-hover:block" title={`Bloquer ${h}`}>🔒</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Lanes */}
        {lanes.map((lane) => {
          const slots = generateSlotsForActivity(lane, date, { fullDay: true });
          const laneW = lane.compact ? Math.round(pxActivity / 3) : pxActivity;
          const laneBookings = bookings.flatMap((b) =>
            (b.items || []).filter((i) => i.activityId === lane.id).filter((i) => {
              if (!lane.isRoom) return true;
              return hashRoom(b.id || b.reference) === lane.roomId;
            }).map((i) => ({ ...i, booking: b }))
          );
          const laneBlocks = blocks.filter((bl) => (bl.activity_id || bl.activityId) === lane.id && (lane.isRoom ? (bl.roomId === lane.roomId || bl.laneId === lane.roomId) : !bl.roomId));

          // Batch grouping
          const byBatch = {};
          const standalone = [];
          laneBlocks.forEach((bl) => {
            if (bl.batchId?.startsWith('batch-')) { if (!byBatch[bl.batchId]) byBatch[bl.batchId] = []; byBatch[bl.batchId].push(bl); }
            else standalone.push(bl);
          });

          return (
            <div key={lane.laneId} className="shrink-0 grow border-r border-white/10" style={{ width: `${laneW}px`, minWidth: `${laneW}px` }}>
              <div className="relative" style={{ height: `${hourCount * pxH}px` }}>
                {Array.from({ length: hourCount }).map((_, i) => {
                  const inOpen = openM >= 0 && i * 60 >= openM && i * 60 < closeM;
                  return <div key={i} className={`absolute left-0 right-0 border-b border-white/5 ${!inOpen ? 'cal-closed-hour' : ''}`} style={{ top: `${i * pxH}px`, height: `${pxH}px` }} />;
                })}

                {slots.map((slot) => {
                  const slotM = toMinutes(slot.start);
                  const top = (slotM / 60) * pxH;
                  const height = Math.max((lane.duration / 60) * pxH - 1, 14);
                  const slotItems = laneBookings.filter((i) => i.start === slot.start);
                  const players = slotItems.reduce((s, i) => s + (i.players || 0), 0);
                  const sBlock = standalone.find((bl) => (bl.start_time?.slice(0, 5) || bl.start) === slot.start);
                  const inBatch = Object.values(byBatch).some((arr) => arr.some((bl) => (bl.start_time?.slice(0, 5) || bl.start) === slot.start));
                  if (inBatch) return null;

                  const isSel = multiSel.some((s) => s.laneId === lane.laneId && s.slot.start === slot.start);
                  const isHighlight = slotItems.some((it) => highlightIds.has(it.booking?.id || it.booking?.reference));
                  const full = lane.privative ? players > 0 : players >= lane.maxPlayers;
                  const partial = players > 0 && !full;

                  let cls = 'cal-slot-free';
                  if (sBlock) cls = 'cal-slot-blocked';
                  else if (full) cls = 'cal-slot-full';
                  else if (partial) cls = 'cal-slot-partial';
                  if (isSel) cls += ' cal-slot-selected';
                  if (isHighlight) cls += ' cal-slot-highlight';

                  const slotInOpen = openM >= 0 && slotM >= openM && slotM < closeM;

                  return (
                    <button
                      key={slot.start}
                      data-time={slot.start}
                      onClick={(e) => onClick(lane.laneId, lane, slot, e)}
                      onContextMenu={(e) => onRightClick(e, lane.laneId, lane, slot)}
                      onMouseEnter={() => onHoverEnter(lane.laneId, lane, slot)}
                      onMouseLeave={onHoverLeave}
                      className={`absolute left-0.5 right-0.5 flex flex-col items-start justify-between overflow-hidden rounded border px-1 py-0.5 text-left transition ${cls}`}
                      style={{ top: `${top}px`, height: `${height}px`, opacity: slotInOpen ? 1 : 0.5 }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="cal-time display">{slot.start}</span>
                        {sBlock ? <span className="text-[10px]">🔒</span> : <span className="cal-players">{players}/{lane.maxPlayers}</span>}
                      </div>
                      {sBlock?.label && <div className="truncate text-[10px] font-bold">{sBlock.label}</div>}
                    </button>
                  );
                })}

                {/* Merged batch blocks */}
                {Object.entries(byBatch).map(([bid, arr]) => {
                  const sorted = arr.sort((a, b) => (a.start || a.start_time || '').localeCompare(b.start || b.start_time || ''));
                  const firstS = (sorted[0].start_time || sorted[0].start).slice(0, 5);
                  const lastE = (sorted[sorted.length - 1].end_time || sorted[sorted.length - 1].end).slice(0, 5);
                  const top = (toMinutes(firstS) / 60) * pxH;
                  const height = Math.max(((toMinutes(lastE) - toMinutes(firstS)) / 60) * pxH - 1, 20);
                  const label = sorted[0].label;
                  return (
                    <button
                      key={bid}
                      onClick={() => onOpenBlock && onOpenBlock({
                        start: firstS, end: lastE, laneId: lane.laneId, activityId: lane.id, activity: lane, date,
                        block: sorted[0], batchSlots: sorted,
                        items: [],
                      })}
                      className="absolute left-0.5 right-0.5 flex flex-col items-start justify-start overflow-hidden rounded border-2 border-[#CC003C] bg-[#CC003C]/60 px-1.5 py-1 text-left hover:bg-[#CC003C]/70"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="display text-[12px] text-white">{firstS}–{lastE}</span>
                        <span className="text-[10px]">🔒</span>
                      </div>
                      {label && <div className="mt-1 display text-[12px] font-bold text-white">{label}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

function BlockDialog({ slot, onClose, onBlock, onUnblock, onUpdateLabel }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [blockedSeats, setBlockedSeats] = useState(0);
  const isBatch = Boolean(slot.batch);
  const existingBlock = slot.block;
  const maxPlayers = slot.activity?.maxPlayers || 12;

  // Alerte si des joueurs sont déjà réservés sur les créneaux sélectionnés
  const hasExistingBookings = isBatch
    ? slot.batch.some((s) => s.slot?.players > 0 || (s.actDef?.items || []).length > 0)
    : (slot.items || []).length > 0;
  const existingPlayers = !isBatch && slot.items ? slot.items.reduce((s, i) => s + (i.players || 0), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded border-2 border-mw-pink bg-mw-surface p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="display text-2xl">{isBatch ? `${slot.batch.length} créneaux` : slot.activity?.name || 'Créneau'}</div>
            {!isBatch && <div className="text-xs text-white/60">{slot.start} → {slot.end}</div>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink">✕</button>
        </div>

        {/* Alerte si réservations existantes */}
        {hasExistingBookings && (
          <div className="mb-4 rounded border border-mw-yellow/50 bg-mw-yellow/10 p-3 text-xs text-mw-yellow">
            ⚠ Attention : {isBatch ? 'certains créneaux ont' : 'ce créneau a'} déjà des réservations ({existingPlayers} joueurs). Le blocage n'annulera pas les réservations existantes.
          </div>
        )}

        {/* Infos réservations existantes */}
        {!isBatch && slot.items && slot.items.length > 0 && (
          <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-1 text-[10px] uppercase text-white/50">Réservations sur ce créneau</div>
            {slot.items.map((it, idx) => (
              <div key={idx} className="text-xs text-white/70">
                {it.booking?.customer?.name || it.booking?.customer?.firstName || 'Client'} — {it.players} joueurs — {it.booking?.id || it.booking?.reference}
              </div>
            ))}
          </div>
        )}

        {!isBatch && existingBlock ? (
          <div className="space-y-3">
            <div className="rounded border border-[#CC003C] bg-[#CC003C]/20 p-4">
              <div className="display mb-1 text-[#CC003C]">🔒 Bloqué</div>
              {existingBlock.blockedSeats > 0 && <div className="text-xs text-white/60">{existingBlock.blockedSeats} places bloquées</div>}
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label visible" className="input mt-2 text-sm" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Notes (multi-lignes)" className="input mt-2 text-sm resize-none" style={{ whiteSpace: 'pre-wrap' }} />
              <div className="mt-3 flex gap-2">
                <button onClick={() => onUpdateLabel(existingBlock, label, note)} className="btn-outline flex-1 !py-2 text-xs">Mettre à jour</button>
                <button onClick={() => onUnblock(existingBlock)} className="btn-outline flex-1 !py-2 text-xs text-mw-red">Débloquer</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded border-2 border-mw-pink/40 bg-mw-pink/5 p-4">
            <div className="display mb-3 text-sm text-mw-pink">🔒 Bloquer {isBatch ? `${slot.batch.length} créneaux` : 'ce créneau'}</div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label visible (ex: ERES 25P)" className="input mb-2 text-sm" />
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="input mb-2 text-sm">
              <option value="">Raison…</option>
              <option value="b2b">Team building B2B</option>
              <option value="maintenance">Maintenance</option>
              <option value="private">Privatisation</option>
              <option value="other">Autre</option>
            </select>
            <div className="mb-2">
              <label className="mb-1 block text-[10px] uppercase text-white/50">Places à bloquer (0 = créneau complet)</label>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max={maxPlayers} value={blockedSeats} onChange={(e) => setBlockedSeats(Number(e.target.value))} className="flex-1 accent-mw-pink" />
                <span className="w-10 text-center display text-mw-pink">{blockedSeats === 0 ? 'Tout' : blockedSeats}</span>
              </div>
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Notes détaillées (multi-lignes supportées)" className="input mb-2 text-sm resize-none" />
            <button onClick={() => onBlock(reason, note, label, blockedSeats)} disabled={!reason || !label} className="btn-primary w-full !py-3 text-sm">Confirmer le blocage</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ============================================================
// WEEK VIEW
// ============================================================
function WeekView({ date, lanes, bookings }) {
  const start = parseDate(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Start Monday
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateStr(d);
  });

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="border-b border-white/10">
            <th className="display sticky left-0 z-10 w-40 bg-mw-bg px-2 py-2 text-left">Activité</th>
            {days.map((d) => {
              const dt = parseDate(d);
              const isToday = toDateStr(new Date()) === d;
              return (
                <th key={d} className={`px-2 py-2 text-center ${isToday ? 'text-mw-pink' : ''}`}>
                  <div className="text-[10px] text-white/50">{dayLabelsFrFull[dt.getDay()].slice(0, 3)}</div>
                  <div className="display text-base">{dt.getDate()}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {lanes.map((a) => (
            <tr key={a.laneId} className="border-b border-white/5">
              <td className="sticky left-0 z-10 bg-mw-bg px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6"><Image src={a.logo} alt="" fill sizes="24px" className="object-contain" /></div>
                  <span className="display text-[12px]">{a.laneLabel}</span>
                </div>
              </td>
              {days.map((d) => {
                const dayBookings = bookings.filter((b) => b.date === d);
                const items = dayBookings.flatMap((b) => (b.items || []).filter((i) => i.activityId === a.id));
                const resaCount = items.length;
                const slotsForDay = generateSlotsForActivity(a, d).length;
                const rate = slotsForDay > 0 ? resaCount / slotsForDay : 0;
                let color = 'bg-white/5';
                if (rate > 0.7) color = 'cal-slot-full';
                else if (rate > 0.3) color = 'cal-slot-partial';
                else if (rate > 0) color = 'cal-slot-free';
                return (
                  <td key={d} className="px-1 py-2">
                    <div className={`rounded border p-2 text-center ${color}`}>
                      <div className="display text-sm">{resaCount}</div>
                      <div className="text-[9px]">/{slotsForDay}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// MONTH VIEW
// ============================================================
function MonthView({ date, bookings, onChangeDate, visibleActivityIds }) {
  const current = parseDate(date);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday-first
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(year, month, d)));

  return (
    <div className="overflow-hidden rounded border border-white/10 bg-white/[0.02]">
      <div className="grid grid-cols-7 border-b border-white/10 bg-mw-bg">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="display py-2 text-center text-[10px] text-white/40">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={idx} className="aspect-square border-b border-r border-white/5" />;
          const dayBookings = bookings.filter((b) => b.date === cell);
          const totalPlayers = dayBookings.reduce((s, b) => s + (b.players || 0), 0);
          const totalRevenue = dayBookings.reduce((s, b) => s + (b.total || 0), 0);
          const isToday = toDateStr(new Date()) === cell;
          const rate = totalPlayers / 40;
          let color = '';
          if (rate > 1) color = 'bg-[#CC003C]/25';
          else if (rate > 0.5) color = 'bg-[#EBC800]/20';
          else if (rate > 0) color = 'bg-mw-pink/15';
          return (
            <button
              key={cell}
              onClick={() => onChangeDate(cell)}
              className={`relative aspect-square border-b border-r border-white/5 p-2 text-left transition hover:bg-white/5 ${color}`}
            >
              <div className={`display text-sm ${isToday ? 'text-mw-pink' : 'text-white'}`}>{parseDate(cell).getDate()}</div>
              <div className="mt-0.5 text-[8px] leading-tight text-white/60">
                {activities.filter((a) => a.bookable && (visibleActivityIds || new Set()).has(a.id)).map((a) => {
                  const totalSlots = generateSlotsForActivity(a, cell).length;
                  if (totalSlots === 0) return null;
                  const resaCount = dayBookings.reduce((s, b) => s + (b.items || []).filter((i) => i.activityId === a.id).length, 0);
                  return (
                    <div key={a.id} className={resaCount > 0 ? 'text-mw-pink' : 'text-white/30'}>
                      {a.name.slice(0, 6)}: {resaCount}/{totalSlots}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
