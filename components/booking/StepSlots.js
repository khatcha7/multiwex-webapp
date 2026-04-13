'use client';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useBooking, computeSessionsNeeded } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import {
  generateSlotsForActivity,
  getFakeOccupiedSlots,
  slotConflicts,
  dayLabelsFr,
  monthsFr,
  isOpenOn,
  toDateStr,
  parseDate,
} from '@/lib/hours';

function buildUpcomingDays(count = 60) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

export default function StepSlots() {
  const { cart, setDate, setActivitySlots } = useBooking();
  const days = useMemo(() => buildUpcomingDays(60), []);
  const [activeActivity, setActiveActivity] = useState(null);

  useEffect(() => {
    if (!cart.date) {
      const firstOpen = days.find((d) => isOpenOn(d));
      if (firstOpen) setDate(firstOpen);
    }
  }, [cart.date, days, setDate]);

  const activityIds = Object.keys(cart.items);
  const bookable = activityIds.map(getActivity).filter((a) => a && a.bookable);
  const currentActivityId = activeActivity || bookable[0]?.id;
  const currentActivity = getActivity(currentActivityId);
  const currentItem = cart.items[currentActivityId];
  const currentSessions = currentActivity ? computeSessionsNeeded(currentActivity, cart.players, currentItem.quantity) : 0;

  const existingBookings = Object.entries(cart.slots).flatMap(([id, arr]) => {
    if (id === currentActivityId) return [];
    const act = getActivity(id);
    return (arr || []).map((s) => ({ ...s, duration: act.duration }));
  });

  const ownSelected = cart.slots[currentActivityId] || [];
  const allSlots = cart.date && currentActivity ? generateSlotsForActivity(currentActivity, cart.date) : [];
  const occupied = cart.date && currentActivity ? new Set(getFakeOccupiedSlots(currentActivity, cart.date)) : new Set();

  const toggleSlot = (slot) => {
    const has = ownSelected.find((s) => s.start === slot.start);
    if (has) {
      setActivitySlots(currentActivityId, ownSelected.filter((s) => s.start !== slot.start));
    } else {
      if (ownSelected.length >= currentSessions) {
        const next = [...ownSelected.slice(1), slot].sort((a, b) => a.start.localeCompare(b.start));
        setActivitySlots(currentActivityId, next);
      } else {
        const next = [...ownSelected, slot].sort((a, b) => a.start.localeCompare(b.start));
        setActivitySlots(currentActivityId, next);
      }
    }
  };

  // Group days by month for display
  const byMonth = {};
  days.forEach((d) => {
    const dt = parseDate(d);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (!byMonth[key]) byMonth[key] = { label: `${monthsFr[dt.getMonth()]} ${dt.getFullYear()}`, days: [] };
    byMonth[key].days.push(d);
  });

  return (
    <div>
      <h1 className="section-title mb-2">Date & créneaux</h1>
      <p className="mb-6 text-white/60">
        Sélectionnez {currentSessions > 1 ? <>{currentSessions} créneaux pour </> : 'le créneau pour '}
        chaque activité. Les conflits ({'+'}10 min de buffer) sont bloqués automatiquement.
      </p>

      <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Date</div>
      <div className="mb-8 space-y-3">
        {Object.entries(byMonth).map(([key, { label, days: monthDays }]) => (
          <div key={key}>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {monthDays.map((d) => {
                const date = parseDate(d);
                const open = isOpenOn(d);
                const isWed = date.getDay() === 3;
                const active = cart.date === d;
                const today = toDateStr(new Date()) === d;
                return (
                  <button
                    key={d}
                    onClick={() => open && setDate(d)}
                    disabled={!open}
                    className={`relative shrink-0 rounded-xl border px-3.5 py-2.5 text-center transition ${
                      active
                        ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                        : 'border-white/15 bg-white/[0.03] hover:border-white/40'
                    } ${!open ? 'cursor-not-allowed opacity-25' : ''}`}
                  >
                    {today && !active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mw-pink" />}
                    <div className="text-[10px] font-bold uppercase opacity-80">{dayLabelsFr[date.getDay()]}</div>
                    <div className="display text-xl leading-none">{date.getDate()}</div>
                    {isWed && open && (
                      <div className={`mt-0.5 text-[9px] font-bold ${active ? 'text-white' : 'text-mw-pink'}`}>-50%</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cart.date && bookable.length > 1 && (
        <>
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Activité à planifier</div>
          <div className="mb-6 flex flex-wrap gap-2">
            {bookable.map((a) => {
              const item = cart.items[a.id];
              const needed = computeSessionsNeeded(a, cart.players, item.quantity);
              const chosen = (cart.slots[a.id] || []).length;
              const active = currentActivityId === a.id;
              const complete = chosen === needed;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveActivity(a.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="relative h-5 w-5">
                    <Image src={a.logo} alt="" fill className="object-contain" sizes="20px" />
                  </div>
                  <span className="display uppercase tracking-wider">{a.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${complete ? 'bg-mw-pink text-white' : 'bg-white/10 text-white/60'}`}>
                    {chosen}/{needed}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {cart.date && currentActivity && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-white/50">
              Créneaux {currentActivity.name} ({currentActivity.duration} min)
              {currentSessions > 1 && <> — {ownSelected.length}/{currentSessions} sélectionnés</>}
            </div>
            {ownSelected.length > 0 && (
              <button onClick={() => setActivitySlots(currentActivityId, [])} className="text-xs text-mw-red hover:underline">
                Effacer
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {allSlots.map((slot) => {
              const conflict = slotConflicts(existingBookings, slot, currentActivity);
              const selected = ownSelected.some((s) => s.start === slot.start);
              const isOccupied = occupied.has(slot.start);
              const disabled = conflict || isOccupied;
              return (
                <button
                  key={slot.start}
                  onClick={() => !disabled && toggleSlot(slot)}
                  disabled={disabled}
                  className={`relative rounded-lg border py-2.5 text-sm font-bold transition ${
                    selected
                      ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                      : isOccupied
                      ? 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30 line-through'
                      : conflict
                      ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through'
                      : 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink'
                  }`}
                >
                  {slot.start}
                  {isOccupied && <div className="text-[8px] font-normal opacity-80">complet</div>}
                </button>
              );
            })}
            {allSlots.length === 0 && (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
                Aucun créneau disponible pour cette activité ce jour-là.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
