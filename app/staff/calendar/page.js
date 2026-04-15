'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { activities } from '@/lib/activities';
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

const VIEWS = ['day', 'week', 'month'];
const ZOOM_PRESETS = [
  { id: 'compact', label: 'S', pxPerHour: 40 },
  { id: 'normal', label: 'M', pxPerHour: 64 },
  { id: 'large', label: 'L', pxPerHour: 96 },
  { id: 'xl', label: 'XL', pxPerHour: 128 },
];

// Pour chaque K7 booking, attribue une salle déterministiquement (hash du booking id)
function hashRoomForBooking(bookingId) {
  const hash = String(bookingId || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['k7-studio', 'k7-record', 'k7-dancefloor'][hash % 3];
}

export default function StaffCalendarPage() {
  const [date, setDateStr] = useState(toDateStr(new Date()));
  const [view, setView] = useState('day');
  const [zoom, setZoom] = useState('normal');
  const [visible, setVisible] = useState(new Set(activities.filter((a) => a.bookable).map((a) => a.id)));
  const [k7Expanded, setK7Expanded] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null); // either {...slot} or {batch:[...]}
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectionStart, setSelectionStart] = useState(null); // {activityId, slot} for range-select anchor
  const [multiSelection, setMultiSelection] = useState([]);

  useEffect(() => {
    listBookings({ from: date, to: date }).then(setBookings);
    getSlotBlocks(date).then(setBlocks);
  }, [date, refreshTick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setRefreshTick((t) => t + 1));
    return unsub;
  }, []);

  // Construit la liste des "lanes" à afficher. K7 = 1 lane ou 3 si expanded.
  const lanes = useMemo(() => {
    const out = [];
    activities.filter((a) => a.bookable && visible.has(a.id)).forEach((a) => {
      if (a.id === 'k7' && k7Expanded && a.rooms) {
        a.rooms.forEach((room) => {
          out.push({ ...a, laneId: room.id, laneLabel: `${a.name} ${room.name}`, isRoom: true, roomId: room.id, maxPlayers: room.maxPlayers });
        });
      } else {
        out.push({ ...a, laneId: a.id, laneLabel: a.name, isRoom: false });
      }
    });
    return out;
  }, [visible, k7Expanded]);

  const hours = getHoursForDate(date);
  const pxPerHour = ZOOM_PRESETS.find((p) => p.id === zoom).pxPerHour;

  const toggleVisible = (id) => {
    const next = new Set(visible);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisible(next);
  };

  // Range-select : si on shift-click sur un slot dans la MÊME lane que l'ancre, on
  // sélectionne tout entre les deux. Sinon, toggle simple.
  const handleSlotClick = (laneId, activityDef, slot, e) => {
    const withShift = e.shiftKey || e.metaKey || e.ctrlKey;

    // Si pas de shift et pas de multi-sel en cours → ouvre le détail
    if (!withShift && multiSelection.length === 0) {
      const block = blocks.find(
        (b) =>
          (b.activity_id || b.activityId) === activityDef.id &&
          (b.laneId || b.roomId || b.activityId || b.activity_id) === laneId &&
          (b.start_time?.slice(0, 5) || b.start) === slot.start
      );
      const items = bookings.flatMap((bk) =>
        (bk.items || [])
          .filter((i) => i.activityId === activityDef.id && i.start === slot.start)
          .map((i) => ({ ...i, booking: bk }))
      );
      setSelected({ ...slot, laneId, activityId: activityDef.id, activity: activityDef, date, items, block });
      return;
    }

    // Shift-click range
    if (withShift && selectionStart && selectionStart.laneId === laneId) {
      const allSlots = generateSlotsForActivity(activityDef, date);
      const startIdx = allSlots.findIndex((s) => s.start === selectionStart.slot.start);
      const endIdx = allSlots.findIndex((s) => s.start === slot.start);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const range = allSlots.slice(lo, hi + 1).map((s) => ({ laneId, activityDef, slot: s }));
        setMultiSelection(range);
        return;
      }
    }

    // Toggle simple
    setMultiSelection((prev) => {
      const key = `${laneId}-${slot.start}`;
      const exists = prev.find((s) => `${s.laneId}-${s.slot.start}` === key);
      if (exists) return prev.filter((s) => `${s.laneId}-${s.slot.start}` !== key);
      return [...prev, { laneId, activityDef, slot }];
    });
    setSelectionStart({ laneId, slot });
  };

  const blockSelection = async (reason, note, label) => {
    const batchId = 'batch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    for (const sel of multiSelection) {
      await blockSlot({
        activityId: sel.activityDef.id,
        laneId: sel.laneId,
        roomId: sel.laneId !== sel.activityDef.id ? sel.laneId : null,
        date,
        start: sel.slot.start,
        end: sel.slot.end,
        reason,
        note,
        label,
        batchId,
      });
    }
    await logAudit({
      action: 'block_slots_batch',
      entityType: 'slots',
      entityId: batchId,
      notes: `${multiSelection.length} slots — ${reason}${label ? ` — ${label}` : ''}`,
      after: { reason, note, label, count: multiSelection.length },
    });
    setMultiSelection([]);
    setSelectionStart(null);
    setSelected(null);
    setRefreshTick((t) => t + 1);
  };

  const blockHourTransversal = async (hourStart) => {
    if (!confirm(`Bloquer ${hourStart} sur toutes les activités affichées ?`)) return;
    const batchId = 'batch-h-' + Date.now();
    for (const lane of lanes) {
      const slots = generateSlotsForActivity(lane, date);
      const s = slots.find((sl) => sl.start === hourStart);
      if (s) {
        await blockSlot({
          activityId: lane.id,
          laneId: lane.laneId,
          roomId: lane.isRoom ? lane.roomId : null,
          date,
          start: s.start,
          end: s.end,
          reason: 'b2b',
          note: `Blocage transversal ${hourStart}`,
          batchId,
        });
      }
    }
    setRefreshTick((t) => t + 1);
  };

  const goPrev = () => {
    const d = parseDate(date);
    d.setDate(d.getDate() - (view === 'month' ? 30 : view === 'week' ? 7 : 1));
    setDateStr(toDateStr(d));
  };
  const goNext = () => {
    const d = parseDate(date);
    d.setDate(d.getDate() + (view === 'month' ? 30 : view === 'week' ? 7 : 1));
    setDateStr(toDateStr(d));
  };
  const today = () => setDateStr(toDateStr(new Date()));

  return (
    <div className="mx-auto max-w-7xl px-2 py-4 md:px-4 md:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Calendrier</h1>
          <div className="text-sm text-white/60">
            {dayLabelsFrFull[parseDate(date).getDay()]} {parseDate(date).getDate()} {monthsFr[parseDate(date).getMonth()]} {parseDate(date).getFullYear()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`display rounded px-3 py-1 text-xs ${view === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          {view === 'day' && (
            <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
              <span className="px-2 text-[10px] text-white/40">Zoom</span>
              {ZOOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setZoom(p.id)}
                  className={`display rounded px-2 py-1 text-xs ${zoom === p.id ? 'bg-mw-pink text-white' : 'text-white/70'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            <button onClick={goPrev} className="px-2 py-1 text-sm text-white/70 hover:text-white">←</button>
            <button onClick={today} className="display px-3 py-1 text-xs text-white/70 hover:text-mw-pink">Auj</button>
            <button onClick={goNext} className="px-2 py-1 text-sm text-white/70 hover:text-white">→</button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {activities.filter((a) => a.bookable).map((a) => {
          const on = visible.has(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggleVisible(a.id)}
              className={`flex items-center gap-1.5 rounded border px-3 py-1 text-xs transition ${
                on ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/40'
              }`}
            >
              <div className="relative h-4 w-4">
                <Image src={a.logo} alt="" fill sizes="16px" className="object-contain" />
              </div>
              <span className="display">{a.name}</span>
            </button>
          );
        })}
        {visible.has('k7') && (
          <button
            onClick={() => setK7Expanded(!k7Expanded)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1 text-xs transition ${
              k7Expanded ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/30 text-white/60'
            }`}
          >
            {k7Expanded ? '−' : '+'} K7 Salles
          </button>
        )}
      </div>

      {multiSelection.length > 0 && (
        <div className="sticky top-[158px] z-20 mb-3 flex items-center justify-between gap-3 rounded border-2 border-mw-pink bg-mw-pink/15 px-4 py-3 text-sm">
          <div className="display text-mw-pink">
            {multiSelection.length} créneau(x) sélectionné(s)
            <span className="ml-2 text-[10px] font-normal opacity-70">Shift+clic pour étendre la sélection</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setMultiSelection([]); setSelectionStart(null); }} className="text-xs text-white/60 hover:text-mw-red">
              Annuler
            </button>
            <button
              onClick={() => setSelected({ batch: multiSelection })}
              className="btn-primary !py-2 !px-4 text-xs"
            >
              Bloquer & noter →
            </button>
          </div>
        </div>
      )}

      {view === 'day' && (
        <DayView
          date={date}
          lanes={lanes}
          bookings={bookings}
          blocks={blocks}
          onSelect={setSelected}
          hours={hours}
          pxPerHour={pxPerHour}
          multiSelection={multiSelection}
          onSlotClick={handleSlotClick}
          onBlockHour={blockHourTransversal}
        />
      )}
      {view === 'week' && <WeekView date={date} activities={lanes} bookings={bookings} />}
      {view === 'month' && <MonthView date={date} bookings={bookings} onChangeDate={setDateStr} />}

      {selected && (
        <SlotDetailPanel
          slot={selected}
          onClose={() => setSelected(null)}
          onBlockBatch={blockSelection}
          onBlock={async (reason, note, label) => {
            const batchId = 'single-' + Date.now();
            const entry = await blockSlot({
              activityId: selected.activityId,
              laneId: selected.laneId,
              date: selected.date,
              start: selected.start,
              end: selected.end,
              reason,
              note,
              label,
              batchId,
            });
            await logAudit({
              action: 'block_slot',
              entityType: 'slot',
              entityId: `${selected.activityId}-${selected.date}-${selected.start}`,
              notes: `${reason}${label ? ` — ${label}` : ''}`,
              after: { reason, note, label },
            });
            setSelected(null);
            setRefreshTick((t) => t + 1);
          }}
          onUnblock={async (block) => {
            if (block.batchId && block.batchId.startsWith('batch-')) {
              await unblockBatch(block.batchId);
            } else {
              await unblockSlot(block.id);
            }
            await logAudit({
              action: 'unblock_slot',
              entityType: 'slot',
              entityId: `${selected.activityId}-${selected.date}-${selected.start}`,
            });
            setSelected(null);
            setRefreshTick((t) => t + 1);
          }}
          onUpdateLabel={async (block, label, note) => {
            if (block.batchId) {
              await updateSlotBlockBatch(block.batchId, { label, note });
            } else {
              await updateSlotBlock(block.id, { label, note });
            }
            setSelected(null);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function DayView({ date, lanes, bookings, blocks, onSelect, hours, pxPerHour, multiSelection, onSlotClick, onBlockHour }) {
  if (!hours) return <div className="rounded border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">Fermé ce jour-là.</div>;

  const openM = toMinutes(hours.open);
  const closeM = toMinutes(hours.close);
  const totalMin = closeM - openM;
  const hourCount = Math.ceil(totalMin / 60);

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-white/[0.02]">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-white/10 bg-mw-bg">
          <div className="h-12 border-b border-white/10" />
          {Array.from({ length: hourCount }).map((_, i) => {
            const hour = fromMinutes(openM + i * 60);
            return (
              <div key={i} className="group relative border-b border-white/5 pr-1 pt-1" style={{ height: `${pxPerHour}px` }}>
                <div className="display text-right text-[10px] text-white/40">{hour}</div>
                <button
                  onClick={() => onBlockHour(hour)}
                  className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-l bg-mw-red px-1 text-[9px] text-white group-hover:block"
                  title={`Bloquer ${hour} sur toutes les activités`}
                >
                  🔒
                </button>
              </div>
            );
          })}
        </div>

        {lanes.map((lane) => {
          const activityDef = lane;
          const slots = generateSlotsForActivity(lane, date);
          // Filter bookings for this lane (K7 room filter)
          const laneBookings = bookings.flatMap((b) =>
            (b.items || [])
              .filter((i) => i.activityId === lane.id)
              .filter((i) => {
                if (!lane.isRoom) return true;
                // If room view, route K7 bookings to specific rooms via hash
                const assigned = hashRoomForBooking(b.id || b.reference);
                return assigned === lane.roomId;
              })
              .map((i) => ({ ...i, booking: b }))
          );
          const laneBlocks = blocks.filter(
            (bl) =>
              (bl.activity_id || bl.activityId) === lane.id &&
              (lane.isRoom ? (bl.roomId === lane.roomId || bl.laneId === lane.roomId) : !bl.roomId)
          );

          // Group blocks by batchId for merged visual display
          const byBatch = {};
          const standalone = [];
          laneBlocks.forEach((bl) => {
            const bid = bl.batchId;
            if (bid && bid.startsWith('batch-')) {
              if (!byBatch[bid]) byBatch[bid] = [];
              byBatch[bid].push(bl);
            } else {
              standalone.push(bl);
            }
          });

          return (
            <div key={lane.laneId} className="w-40 shrink-0 border-r border-white/10">
              <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-white/10 bg-mw-bg px-2">
                <div className="relative h-6 w-6">
                  <Image src={lane.logo} alt={lane.name} fill sizes="24px" className="object-contain" />
                </div>
                <div className="display min-w-0 truncate text-xs">{lane.laneLabel}</div>
              </div>
              <div className="relative" style={{ height: `${hourCount * pxPerHour}px` }}>
                {Array.from({ length: hourCount }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-b border-white/5" style={{ top: `${i * pxPerHour}px`, height: `${pxPerHour}px` }} />
                ))}

                {/* Slot boutons normaux */}
                {slots.map((slot) => {
                  const slotMinutes = toMinutes(slot.start) - openM;
                  const top = (slotMinutes / 60) * pxPerHour;
                  const height = Math.max((lane.duration / 60) * pxPerHour - 1, 14);
                  const slotItems = laneBookings.filter((i) => i.start === slot.start);
                  const players = slotItems.reduce((s, i) => s + (i.players || 0), 0);
                  const standaloneBlock = standalone.find((bl) => (bl.start_time?.slice(0, 5) || bl.start) === slot.start);
                  // Si ce slot fait partie d'un batch, on ne l'affiche pas (le merged block s'en occupe)
                  const inBatch = Object.values(byBatch).some((arr) =>
                    arr.some((bl) => (bl.start_time?.slice(0, 5) || bl.start) === slot.start)
                  );
                  if (inBatch) return null;

                  const isSelected = multiSelection.some((s) => s.laneId === lane.laneId && s.slot.start === slot.start);

                  let bg = 'bg-white/[0.02] hover:bg-white/[0.08] border-white/10';
                  if (isSelected) bg = 'bg-mw-pink/40 border-mw-pink';
                  else if (standaloneBlock) bg = 'bg-mw-red/30 border-mw-red hover:bg-mw-red/40';
                  else if (players >= lane.maxPlayers) bg = 'bg-mw-red/20 border-mw-red/50';
                  else if (players > 0) bg = 'bg-mw-yellow/20 border-mw-yellow/60 hover:bg-mw-yellow/30';

                  return (
                    <button
                      key={slot.start}
                      onClick={(e) => onSlotClick(lane.laneId, activityDef, slot, e)}
                      className={`absolute left-0.5 right-0.5 flex flex-col items-start justify-between overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] transition ${bg}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="display text-white">{slot.start}</span>
                        {standaloneBlock ? (
                          <span className="text-[9px] text-mw-red">🔒</span>
                        ) : (
                          <span className="text-[9px] text-white/60">{players}/{lane.maxPlayers}</span>
                        )}
                      </div>
                      {standaloneBlock?.label && (
                        <div className="truncate text-[9px] text-white/80">{standaloneBlock.label}</div>
                      )}
                    </button>
                  );
                })}

                {/* Merged batch blocks — span across all slots of the same batch */}
                {Object.entries(byBatch).map(([bid, arr]) => {
                  const sorted = arr.slice().sort((a, b) =>
                    (a.start_time || a.start).localeCompare(b.start_time || b.start)
                  );
                  const firstStart = (sorted[0].start_time || sorted[0].start).slice(0, 5);
                  const lastEnd = (sorted[sorted.length - 1].end_time || sorted[sorted.length - 1].end).slice(0, 5);
                  const startM = toMinutes(firstStart);
                  const endM = toMinutes(lastEnd);
                  const top = ((startM - openM) / 60) * pxPerHour;
                  const height = Math.max(((endM - startM) / 60) * pxPerHour - 1, 20);
                  const label = sorted[0].label;
                  const note = sorted[0].note;
                  const reason = sorted[0].block_reason || sorted[0].reason;
                  return (
                    <button
                      key={bid}
                      onClick={() =>
                        onSelect({
                          ...sorted[0],
                          start: firstStart,
                          end: lastEnd,
                          laneId: lane.laneId,
                          activityId: lane.id,
                          activity: lane,
                          date,
                          block: sorted[0],
                          batchSlots: sorted,
                        })
                      }
                      className="absolute left-0.5 right-0.5 flex flex-col items-start justify-start overflow-hidden rounded border-2 border-mw-red bg-gradient-to-br from-mw-red/50 to-mw-red/30 px-1.5 py-1 text-left text-[10px] hover:from-mw-red/60"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="display text-[11px] text-white">{firstStart}–{lastEnd}</span>
                        <span className="text-[9px] text-white/80">🔒</span>
                      </div>
                      {label && <div className="mt-1 display truncate text-[11px] font-bold text-white">{label}</div>}
                      {!label && reason && <div className="mt-1 text-[9px] text-white/80">{reason}</div>}
                      {note && <div className="truncate text-[9px] text-white/70">{note}</div>}
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

function WeekView({ date, activities: acts, bookings }) {
  const start = parseDate(date);
  start.setDate(start.getDate() - start.getDay());
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
              return (
                <th key={d} className="px-2 py-2 text-center">
                  <div className="text-[10px] text-white/50">{dayLabelsFrFull[dt.getDay()].slice(0, 3)}</div>
                  <div className="display text-base">{dt.getDate()}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {acts.map((a) => (
            <tr key={a.laneId} className="border-b border-white/5">
              <td className="sticky left-0 z-10 bg-mw-bg px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6">
                    <Image src={a.logo} alt="" fill sizes="24px" className="object-contain" />
                  </div>
                  <span className="display">{a.laneLabel}</span>
                </div>
              </td>
              {days.map((d) => {
                const dayBookings = bookings.filter((b) => b.date === d);
                const items = dayBookings.flatMap((b) => b.items?.filter((i) => i.activityId === a.id) || []);
                const players = items.reduce((s, i) => s + (i.players || 0), 0);
                const slotsForDay = generateSlotsForActivity(a, d).length;
                const capacityTotal = slotsForDay * a.maxPlayers;
                const rate = capacityTotal > 0 ? players / capacityTotal : 0;
                let color = 'bg-white/5';
                if (rate > 0.7) color = 'bg-mw-red/30 border-mw-red/50';
                else if (rate > 0.3) color = 'bg-mw-yellow/20 border-mw-yellow/50';
                else if (rate > 0) color = 'bg-mw-pink/15 border-mw-pink/40';
                return (
                  <td key={d} className="px-1 py-2">
                    <div className={`rounded border p-2 text-center ${color}`}>
                      <div className="display text-sm">{players}</div>
                      <div className="text-[9px] text-white/50">/{capacityTotal}</div>
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

function MonthView({ date, bookings, onChangeDate }) {
  const current = parseDate(date);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(year, month, d)));

  return (
    <div className="overflow-hidden rounded border border-white/10 bg-white/[0.02]">
      <div className="grid grid-cols-7 border-b border-white/10 bg-mw-bg">
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d) => (
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
          if (rate > 1) color = 'bg-mw-red/25';
          else if (rate > 0.5) color = 'bg-mw-yellow/20';
          else if (rate > 0) color = 'bg-mw-pink/15';
          return (
            <button
              key={cell}
              onClick={() => onChangeDate(cell)}
              className={`relative aspect-square border-b border-r border-white/5 p-2 text-left transition hover:bg-white/5 ${color}`}
            >
              <div className={`display text-sm ${isToday ? 'text-mw-pink' : 'text-white'}`}>{parseDate(cell).getDate()}</div>
              {dayBookings.length > 0 && (
                <div className="mt-1 text-[9px] text-white/60">
                  <div>{totalPlayers} joueurs</div>
                  <div className="text-mw-pink">{totalRevenue.toFixed(0)}€</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotDetailPanel({ slot, onClose, onBlock, onUnblock, onBlockBatch, onUpdateLabel }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const isBatch = Boolean(slot.batch);
  const existingBlock = slot.block;

  useEffect(() => {
    if (existingBlock) {
      setReason(existingBlock.block_reason || existingBlock.reason || '');
      setNote(existingBlock.note || '');
      setLabel(existingBlock.label || '');
    }
  }, [existingBlock]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t border-t-2 border-mw-pink bg-mw-surface p-5 md:rounded md:border-2">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="display text-2xl">
              {isBatch ? `${slot.batch.length} créneaux` : slot.activity?.name || 'Créneau'}
            </div>
            {!isBatch && (
              <div className="text-sm text-white/60">
                {new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {slot.start} → {slot.end}
              </div>
            )}
            {isBatch && (
              <div className="text-sm text-white/60">Sélection multiple — toutes bloquées ensemble</div>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink">✕</button>
        </div>

        {!isBatch && existingBlock ? (
          <div className="space-y-3">
            <div className="rounded border border-mw-red/40 bg-mw-red/10 p-4">
              <div className="display mb-1 text-mw-red">🔒 Créneau bloqué</div>
              {slot.batchSlots && <div className="text-[10px] text-white/60">Fait partie d'un lot de {slot.batchSlots.length} créneaux</div>}
              <div className="mt-2 text-xs">
                <div className="mb-1 text-white/40">Label visible</div>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: ERES 25P" className="input text-sm" />
              </div>
              <div className="mt-2 text-xs">
                <div className="mb-1 text-white/40">Raison</div>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="input text-sm">
                  <option value="">—</option>
                  <option value="b2b">Team building B2B</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="private">Privatisation</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="mt-2 text-xs">
                <div className="mb-1 text-white/40">Note détaillée</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input resize-none text-sm" />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onUpdateLabel(existingBlock, label, note)} className="btn-outline flex-1 !py-2 text-xs">
                  Mettre à jour
                </button>
                <button onClick={() => onUnblock(existingBlock)} className="btn-outline flex-1 !py-2 text-xs text-mw-red">
                  Débloquer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {!isBatch && slot.items && slot.items.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="display text-xs text-mw-pink">
                  {slot.items.length} groupe{slot.items.length > 1 ? 's' : ''} · {slot.items.reduce((s, i) => s + (i.players || 0), 0)}/{slot.activity.maxPlayers} joueurs
                </div>
                {slot.items.map((i, idx) => (
                  <div key={idx} className="rounded bg-white/5 p-3 text-xs">
                    <div className="display mb-1">{i.booking?.customer?.name || 'Client'}</div>
                    <div className="text-white/60">{i.players} joueurs · {i.booking?.reference || i.booking?.id}</div>
                  </div>
                ))}
              </div>
            )}
            {!isBatch && (!slot.items || slot.items.length === 0) && (
              <div className="mb-4 rounded bg-white/5 p-4 text-center text-sm text-white/50">Créneau libre</div>
            )}

            <div className="rounded border-2 border-mw-pink/40 bg-mw-pink/5 p-4">
              <div className="display mb-3 text-sm text-mw-pink">
                {isBatch ? `🔒 Bloquer les ${slot.batch.length} créneaux` : '🔒 Bloquer ce créneau'}
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Label visible *</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: ERES 25P, Mariage Dupont, …"
                  className="input text-sm"
                />
                <p className="mt-1 text-[10px] text-white/40">Ce label apparaîtra directement sur le créneau dans le calendrier</p>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Raison *</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="input text-sm">
                  <option value="">Choisir…</option>
                  <option value="b2b">Team building B2B</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="private">Privatisation</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Note détaillée (optionnel)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Détails sur l'événement, contact, etc."
                  className="input text-sm resize-none"
                />
              </div>
              <button
                onClick={() => (isBatch ? onBlockBatch(reason, note, label) : onBlock(reason, note, label))}
                disabled={!reason || !label}
                className="btn-primary w-full !py-3 text-sm"
              >
                Confirmer le blocage
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
