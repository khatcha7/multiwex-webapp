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

export default function StaffCalendarPage() {
  const [date, setDateStr] = useState(toDateStr(new Date()));
  const [view, setView] = useState('day');
  const [zoom, setZoom] = useState('normal');
  const [visible, setVisible] = useState(new Set(activities.filter((a) => a.bookable).map((a) => a.id)));
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [multiSelection, setMultiSelection] = useState([]); // { activityId, slot }

  useEffect(() => {
    listBookings({ from: date, to: date }).then(setBookings);
    getSlotBlocks(date).then(setBlocks);
  }, [date, refreshTick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setRefreshTick((t) => t + 1));
    return unsub;
  }, []);

  const bookable = activities.filter((a) => a.bookable && visible.has(a.id));
  const hours = getHoursForDate(date);
  const pxPerHour = ZOOM_PRESETS.find((p) => p.id === zoom).pxPerHour;

  const toggleVisible = (id) => {
    const next = new Set(visible);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisible(next);
  };

  const toggleSelect = (activityId, slot, withShift) => {
    setMultiSelection((prev) => {
      const key = `${activityId}-${slot.start}`;
      const exists = prev.find((s) => `${s.activityId}-${s.slot.start}` === key);
      if (exists) return prev.filter((s) => `${s.activityId}-${s.slot.start}` !== key);
      if (!withShift) return [{ activityId, slot }];
      return [...prev, { activityId, slot }];
    });
  };

  const blockSelection = async (reason, note) => {
    for (const sel of multiSelection) {
      await blockSlot({
        activityId: sel.activityId,
        date,
        start: sel.slot.start,
        end: sel.slot.end,
        reason,
        note,
      });
      await logAudit({
        action: 'block_slot',
        entityType: 'slot',
        entityId: `${sel.activityId}-${date}-${sel.slot.start}`,
        notes: reason,
        after: { reason, note },
      });
    }
    setMultiSelection([]);
    setRefreshTick((t) => t + 1);
  };

  const blockHourTransversal = async (hourStart) => {
    // Bloque ce slot sur toutes les activités visibles
    if (!confirm(`Bloquer ${hourStart} sur toutes les activités affichées ?`)) return;
    for (const a of bookable) {
      const slots = generateSlotsForActivity(a, date);
      const s = slots.find((sl) => sl.start === hourStart || (toMinutes(sl.start) <= toMinutes(hourStart) && toMinutes(sl.start) + a.duration > toMinutes(hourStart)));
      if (s) {
        await blockSlot({
          activityId: a.id,
          date,
          start: s.start,
          end: s.end,
          reason: 'b2b',
          note: `Blocage transversal ${hourStart}`,
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
      </div>

      {multiSelection.length > 0 && (
        <div className="sticky top-[158px] z-20 mb-3 flex items-center justify-between gap-3 rounded border border-mw-pink/50 bg-mw-pink/10 px-3 py-2 text-sm">
          <div className="display text-mw-pink">{multiSelection.length} créneau(x) sélectionné(s)</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMultiSelection([])} className="text-xs text-white/60 hover:text-mw-red">Annuler</button>
            <button
              onClick={() => setSelected({ batch: multiSelection })}
              className="btn-primary !py-1.5 !px-4 text-xs"
            >
              Bloquer en batch
            </button>
          </div>
        </div>
      )}

      {view === 'day' && (
        <DayView
          date={date}
          activities={bookable}
          bookings={bookings}
          blocks={blocks}
          onSelect={setSelected}
          hours={hours}
          pxPerHour={pxPerHour}
          multiSelection={multiSelection}
          onToggleSelect={toggleSelect}
          onBlockHour={blockHourTransversal}
        />
      )}
      {view === 'week' && <WeekView date={date} activities={bookable} bookings={bookings} blocks={blocks} />}
      {view === 'month' && <MonthView date={date} bookings={bookings} onChangeDate={setDateStr} />}

      {selected && (
        <SlotDetailPanel
          slot={selected}
          onClose={() => setSelected(null)}
          onBlockBatch={async (reason, note) => {
            await blockSelection(reason, note);
            setSelected(null);
          }}
          onBlock={async (reason, note) => {
            const entry = await blockSlot({
              activityId: selected.activityId,
              date: selected.date,
              start: selected.start,
              end: selected.end,
              reason,
              note,
            });
            await logAudit({
              action: 'block_slot',
              entityType: 'slot',
              entityId: `${selected.activityId}-${selected.date}-${selected.start}`,
              notes: reason,
              after: { reason, note },
            });
            setSelected(null);
            setRefreshTick((t) => t + 1);
          }}
          onUnblock={async (id) => {
            await unblockSlot(id);
            await logAudit({
              action: 'unblock_slot',
              entityType: 'slot',
              entityId: `${selected.activityId}-${selected.date}-${selected.start}`,
            });
            setSelected(null);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function DayView({ date, activities: acts, bookings, blocks, onSelect, hours, pxPerHour, multiSelection, onToggleSelect, onBlockHour }) {
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

        {acts.map((a) => {
          const slots = generateSlotsForActivity(a, date);
          const activityBookings = bookings.flatMap((b) => b.items?.filter((i) => i.activityId === a.id).map((i) => ({ ...i, booking: b })) || []);
          const activityBlocks = blocks.filter((bl) => (bl.activity_id || bl.activityId) === a.id);

          return (
            <div key={a.id} className="w-40 shrink-0 border-r border-white/10">
              <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-white/10 bg-mw-bg px-2">
                <div className="relative h-6 w-6">
                  <Image src={a.logo} alt={a.name} fill sizes="24px" className="object-contain" />
                </div>
                <div className="display min-w-0 truncate text-xs">{a.name}</div>
              </div>
              <div className="relative" style={{ height: `${hourCount * pxPerHour}px` }}>
                {Array.from({ length: hourCount }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-b border-white/5" style={{ top: `${i * pxPerHour}px`, height: `${pxPerHour}px` }} />
                ))}

                {slots.map((slot) => {
                  const slotMinutes = toMinutes(slot.start) - openM;
                  const top = (slotMinutes / 60) * pxPerHour;
                  const height = Math.max((a.duration / 60) * pxPerHour - 1, 14);
                  const slotItems = activityBookings.filter((i) => i.start === slot.start);
                  const players = slotItems.reduce((s, i) => s + (i.players || 0), 0);
                  const block = activityBlocks.find((bl) => (bl.start_time?.slice(0, 5) || bl.start) === slot.start);
                  const isSelected = multiSelection.some((s) => s.activityId === a.id && s.slot.start === slot.start);

                  let bg = 'bg-white/[0.02] hover:bg-white/[0.08] border-white/10';
                  if (isSelected) bg = 'bg-mw-pink/30 border-mw-pink';
                  else if (block) bg = 'bg-mw-red/30 border-mw-red hover:bg-mw-red/40';
                  else if (players >= a.maxPlayers) bg = 'bg-mw-red/20 border-mw-red/50';
                  else if (players > 0) bg = 'bg-mw-yellow/20 border-mw-yellow/60 hover:bg-mw-yellow/30';

                  return (
                    <button
                      key={slot.start}
                      onClick={(e) => {
                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                          onToggleSelect(a.id, slot, true);
                        } else if (multiSelection.length > 0) {
                          onToggleSelect(a.id, slot, true);
                        } else {
                          onSelect({ ...slot, activityId: a.id, activity: a, date, items: slotItems, block });
                        }
                      }}
                      className={`absolute left-0.5 right-0.5 flex flex-col items-start justify-between overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] transition ${bg}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="display text-white">{slot.start}</span>
                        {block ? (
                          <span className="text-[9px] text-mw-red">🔒</span>
                        ) : (
                          <span className="text-[9px] text-white/60">{players}/{a.maxPlayers}</span>
                        )}
                      </div>
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
            <tr key={a.id} className="border-b border-white/5">
              <td className="sticky left-0 z-10 bg-mw-bg px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6">
                    <Image src={a.logo} alt="" fill sizes="24px" className="object-contain" />
                  </div>
                  <span className="display">{a.name}</span>
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

function SlotDetailPanel({ slot, onClose, onBlock, onUnblock, onBlockBatch }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const isBatch = Boolean(slot.batch);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t border-t border-mw-pink/50 bg-mw-surface p-5 md:rounded md:border">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="display text-2xl">{isBatch ? `${slot.batch.length} créneaux` : slot.activity.name}</div>
            {!isBatch && (
              <div className="text-sm text-white/60">
                {new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {slot.start} → {slot.end}
              </div>
            )}
            {isBatch && (
              <div className="text-sm text-white/60">Blocage en batch</div>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink">✕</button>
        </div>

        {!isBatch && slot.block ? (
          <div className="rounded border border-mw-red/40 bg-mw-red/10 p-4">
            <div className="display mb-1 text-mw-red">🔒 Créneau bloqué</div>
            <div className="text-xs text-white/70">Raison : {slot.block.block_reason || slot.block.reason || '—'}</div>
            {(slot.block.note || slot.block.notes) && <div className="mt-1 text-xs text-white/50">{slot.block.note || slot.block.notes}</div>}
            <button onClick={() => onUnblock(slot.block.id)} className="btn-outline mt-3 !py-2 text-xs">
              Débloquer ce créneau
            </button>
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

            <div className="rounded border border-white/10 p-3">
              <div className="display mb-2 text-xs text-white/70">{isBatch ? `Bloquer les ${slot.batch.length} créneaux` : 'Bloquer ce créneau'}</div>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="input mb-2 text-sm">
                <option value="">Raison…</option>
                <option value="b2b">Team building B2B</option>
                <option value="maintenance">Maintenance</option>
                <option value="private">Privatisation</option>
                <option value="other">Autre</option>
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Note (facultatif)"
                className="input mb-2 text-sm resize-none"
              />
              <button
                onClick={() => isBatch ? onBlockBatch(reason, note) : onBlock(reason, note)}
                disabled={!reason}
                className="btn-primary w-full !py-2 text-xs"
              >
                Bloquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
