'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import TransposedDayView from '@/components/staff/TransposedDayView';
import {
  generateSlotsForActivity,
  getHoursForDate,
  toMinutes,
  fromMinutes,
  toDateStr,
  parseDate,
  dayLabelsFrFull,
  monthsFr,
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

const ZOOM_PRESETS = [
  { id: 'compact', label: 'S', px: 40 },
  { id: 'normal', label: 'M', px: 64 },
  { id: 'large', label: 'L', px: 96 },
  { id: 'xl', label: 'XL', px: 128 },
];

function hashRoom(id) {
  const h = String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['k7-record', 'k7-studio', 'k7-dancefloor'][h % 3];
}

export default function StaffCalendarPage() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [view, setView] = useState('day');
  const [dayLayout, setDayLayout] = useState('transposed'); // 'classic' or 'transposed'
  const [zoom, setZoom] = useState('normal');
  const [pxTime, setPxTime] = useState(64);   // px par heure (axe temps)
  const [pxActivity, setPxActivity] = useState(160); // px par activité (axe activités)
  const [visible, setVisible] = useState(new Set(activities.filter((a) => a.bookable).map((a) => a.id)));
  const [k7Open, setK7Open] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  const [selAnchor, setSelAnchor] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [search, setSearch] = useState('');
  const [hoverSlot, setHoverSlot] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef(null);
  const [datePicker, setDatePicker] = useState(false);

  useEffect(() => {
    listBookings({ from: date, to: date }).then(setBookings);
    getSlotBlocks(date).then(setBlocks);
  }, [date, tick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setTick((t) => t + 1));
    return unsub;
  }, []);

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

  // Search highlight
  const highlightIds = useMemo(() => {
    if (!search.trim()) return new Set();
    const q = search.trim().toLowerCase();
    const ids = new Set();
    bookings.forEach((b) => {
      const match =
        (b.id || b.reference || '').toLowerCase().includes(q) ||
        (b.customer?.name || '').toLowerCase().includes(q) ||
        (b.customer?.email || '').toLowerCase().includes(q);
      if (match) ids.add(b.id || b.reference);
    });
    return ids;
  }, [search, bookings]);

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
  const calRef = useRef(null);
  useEffect(() => {
    const el = calRef.current;
    if (!el) return;
    const handler = (e) => e.preventDefault();
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  return (
    <div ref={calRef} className="mx-auto max-w-7xl px-2 py-4 md:px-4 md:py-6" onClick={() => { setCtxMenu(null); }} onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Calendrier</h1>
          <div className="text-sm text-white/60">
            {dayLabelsFrFull[parseDate(date).getDay()]} {parseDate(date).getDate()} {monthsFr[parseDate(date).getMonth()]} {parseDate(date).getFullYear()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher ID, nom, email…"
            className="input !py-2 max-w-xs text-sm"
          />
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            {[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} className={`display rounded px-3 py-1 text-xs ${view === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            <button onClick={goPrev} className="px-2 py-1 text-sm text-white/70 hover:text-white">←</button>
            <button onClick={goToday} className="display px-3 py-1 text-xs text-white/70 hover:text-mw-pink">Auj</button>
            <button onClick={goNext} className="px-2 py-1 text-sm text-white/70 hover:text-white">→</button>
            <button onClick={() => setDatePicker(!datePicker)} className="px-2 py-1 text-sm text-white/70 hover:text-mw-pink" title="Choisir une date">📅</button>
          </div>
          {view === 'day' && (
            <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
              {ZOOM_PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setZoom(p.id); setPxTime(p.px); }} className={`display rounded px-2 py-1 text-xs ${zoom === p.id ? 'bg-mw-pink text-white' : 'text-white/70'}`}>{p.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date picker popup */}
      {datePicker && (
        <div className="mb-4 rounded border border-white/10 bg-mw-surface p-3 max-w-xs">
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setDatePicker(false); }} className="input" />
        </div>
      )}

      {/* Activity toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        {activities.filter((a) => a.bookable).map((a) => (
          <button key={a.id} onClick={() => toggleVis(a.id)} className={`flex items-center gap-1.5 rounded border px-3 py-1 text-xs transition ${visible.has(a.id) ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/40'}`}>
            <div className="relative h-4 w-4"><Image src={a.logo} alt="" fill sizes="16px" className="object-contain" /></div>
            <span className="display">{a.name}</span>
          </button>
        ))}
        {visible.has('k7') && (
          <button onClick={() => setK7Open(!k7Open)} className={`rounded border px-3 py-1 text-xs transition ${k7Open ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/30 text-white/60'}`}>
            {k7Open ? '−' : '+'} Salles K7
          </button>
        )}
        {visible.has('slashhit') && (
          <button onClick={() => setSlashOpen(!slashOpen)} className={`rounded border px-3 py-1 text-xs transition ${slashOpen ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/30 text-white/60'}`}>
            {slashOpen ? '−' : '+'} Pistes Slash
          </button>
        )}
      </div>

      {/* Multi-sel banner */}
      {multiSel.length > 1 && (
        <div className="sticky top-[158px] z-20 mb-3 flex items-center justify-between gap-3 rounded border-2 border-blue-400 bg-blue-500/15 px-4 py-3 text-sm">
          <div className="display text-blue-300">{multiSel.length} créneau(x) · Shift pour étendre · Ctrl pour ajouter</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setMultiSel([]); setSelAnchor(null); }} className="text-xs text-white/60 hover:text-mw-red">Annuler</button>
            <button onClick={() => setSelected({ batch: multiSel })} className="btn-primary !py-2 !px-4 text-xs">Bloquer & noter →</button>
          </div>
        </div>
      )}

      {/* Day layout toggle + sliders */}
      {view === 'day' && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            <button onClick={() => setDayLayout('classic')} className={`display rounded px-3 py-1 text-xs ${dayLayout === 'classic' ? 'bg-mw-pink text-white' : 'text-white/70'}`}>Classique ↕</button>
            <button onClick={() => setDayLayout('transposed')} className={`display rounded px-3 py-1 text-xs ${dayLayout === 'transposed' ? 'bg-mw-pink text-white' : 'text-white/70'}`}>Transposée ↔</button>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="text-[10px]">Heures</span>
            <input type="range" min="24" max="600" value={pxTime} onChange={(e) => setPxTime(Number(e.target.value))} className="w-24 accent-mw-pink" />
            <span className="w-10 text-[10px] text-white/40">{pxTime}px</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="text-[10px]">Activités</span>
            <input type="range" min="30" max="600" value={pxActivity} onChange={(e) => setPxActivity(Number(e.target.value))} className="w-24 accent-mw-pink" />
            <span className="w-10 text-[10px] text-white/40">{pxActivity}px</span>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === 'day' && hours && dayLayout === 'transposed' && (
        <TransposedDayView
          date={date} lanes={lanes} bookings={bookings} blocks={blocks}
          pxPerHour={pxH} pxActivity={pxActivity} hours={hours}
          multiSel={multiSel} highlightIds={highlightIds}
          onClick={handleClick} onRightClick={handleRightClick}
          onHoverEnter={onSlotEnter} onHoverLeave={onSlotLeave}
          onBlockHour={blockHour} k7Open={k7Open} onToggleK7={() => setK7Open(!k7Open)}
        />
      )}
      {view === 'day' && hours && dayLayout === 'classic' && (
        <DayViewV2
          date={date} lanes={lanes} bookings={bookings} blocks={blocks}
          pxH={pxH} pxActivity={pxActivity} hours={hours}
          multiSel={multiSel} highlightIds={highlightIds}
          onClick={handleClick} onRightClick={handleRightClick}
          onHoverEnter={onSlotEnter} onHoverLeave={onSlotLeave}
          onBlockHour={blockHour} k7Open={k7Open} onToggleK7={() => setK7Open(!k7Open)}
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
                <button
                  key={i}
                  onClick={() => {
                    // Highlight all slots from this customer
                    setSearch(it.booking?.customer?.name || it.booking?.id || '');
                    setCtxMenu(null);
                  }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10"
                >
                  <span className="text-mw-pink">{it.booking?.customer?.name || 'Client'}</span>
                  <span className="ml-2 text-white/50">{it.players}j · {it.booking?.id || it.booking?.reference}</span>
                </button>
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
              onClick={() => { window.location.href = '/staff/on-site'; setCtxMenu(null); }}
              className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-white/10"
            >
              📝 Effectuer une réservation
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

function DayViewV2({ date, lanes, bookings, blocks, pxH, pxActivity = 160, hours, multiSel, highlightIds, onClick, onRightClick, onHoverEnter, onHoverLeave, onBlockHour, k7Open, onToggleK7, onOpenBlock }) {
  // Full 24h display
  const hourCount = 24;
  const openM = hours ? toMinutes(hours.open) : -1;
  const closeM = hours ? toMinutes(hours.close) : -1;

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-mw-bg">
      <div className="flex min-w-max">
        {/* Time column */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-white/10 bg-mw-bg">
          <div className="h-12 border-b border-white/10" />
          {Array.from({ length: hourCount }).map((_, i) => {
            const h = fromMinutes(i * 60);
            const inOpen = openM >= 0 && i * 60 >= openM && i * 60 < closeM;
            return (
              <div key={i} className={`group relative border-b border-white/5 pr-1 pt-1 ${!inOpen ? 'cal-closed-hour' : ''}`} style={{ height: `${pxH}px` }}>
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
            <div key={lane.laneId} className="shrink-0 border-r border-white/10" style={{ width: `${laneW}px` }}>
              <div className="sticky top-0 z-10 flex h-12 items-center gap-1 border-b border-white/10 bg-mw-bg px-1.5 cursor-pointer" onClick={lane.id === 'k7' ? onToggleK7 : undefined}>
                <div className="relative h-5 w-5 shrink-0"><Image src={lane.logo} alt="" fill sizes="20px" className="object-contain" /></div>
                <div className="display min-w-0 truncate text-[12px]">{lane.laneLabel}</div>
                {lane.id === 'k7' && <span className="text-[10px] text-white/40">{k7Open ? '−' : '+'}</span>}
              </div>
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
  );
}

function BlockDialog({ slot, onClose, onBlock, onUnblock, onUpdateLabel }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [blockedSeats, setBlockedSeats] = useState(0);
  const [shiftMin, setShiftMin] = useState(5);
  const [shiftMode, setShiftMode] = useState('single'); // 'single' or 'line'
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

        {/* Décalage de créneau */}
        {!isBatch && !existingBlock && (
          <div className="mt-4 rounded border border-white/10 bg-white/[0.02] p-4">
            <div className="display mb-2 text-sm text-white/70">Décaler ce créneau</div>
            <div className="mb-2 flex items-center gap-2">
              <select value={shiftMode} onChange={(e) => setShiftMode(e.target.value)} className="input !py-1 !w-auto text-xs">
                <option value="single">Ce créneau seul</option>
                <option value="line">Toute la ligne (après ce créneau)</option>
              </select>
              <div className="flex items-center gap-1">
                {[-30, -15, -10, -5, 5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const shifts = JSON.parse(localStorage.getItem('mw_slot_shifts') || '{}');
                        const key = `${slot.activityId}-${slot.date}`;
                        if (!shifts[key]) shifts[key] = {};
                        if (shiftMode === 'line') {
                          // Décale tous les créneaux à partir de celui-ci
                          shifts[key]._lineShift = (shifts[key]._lineShift || 0) + m;
                          shifts[key]._lineFrom = slot.start;
                        } else {
                          shifts[key][slot.start] = (shifts[key][slot.start] || 0) + m;
                        }
                        localStorage.setItem('mw_slot_shifts', JSON.stringify(shifts));
                        alert(`Créneau décalé de ${m > 0 ? '+' : ''}${m} min (${shiftMode === 'line' ? 'toute la ligne' : 'ce créneau'}). Rechargez pour voir le changement.`);
                      }
                    }}
                    className={`rounded border px-2 py-1 text-xs ${m > 0 ? 'border-green-500/40 text-green-400' : 'border-mw-red/40 text-mw-red'} hover:bg-white/10`}
                  >
                    {m > 0 ? '+' : ''}{m}'
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-white/40">En prod, le décalage se synchronise avec le site en ligne via Supabase.</p>
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
