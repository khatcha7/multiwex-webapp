'use client';
import { useMemo, useState } from 'react';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { generateSlotsForActivity, slotConflicts, isOpenOn, dayLabelsFr } from '@/lib/hours';

function buildUpcomingDays(count = 14) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
}

export default function StepSlots() {
  const { cart, setDate, setSlot } = useBooking();
  const days = useMemo(() => buildUpcomingDays(14), []);
  const [activeActivity, setActiveActivity] = useState(null);

  const bookable = cart.activityIds.map(getActivity).filter((a) => a && a.bookable);
  const currentActivityId = activeActivity || bookable[0]?.id;
  const currentActivity = getActivity(currentActivityId);

  const existingBookings = Object.entries(cart.slots)
    .filter(([id]) => id !== currentActivityId)
    .map(([id, s]) => ({ ...s, duration: getActivity(id).duration }));

  const slots = cart.date && currentActivity ? generateSlotsForActivity(currentActivity, cart.date) : [];

  return (
    <div>
      <h1 className="section-title mb-2">Date et créneaux</h1>
      <p className="mb-6 text-white/60">
        Choisissez une date puis sélectionnez un créneau pour chaque activité. Les conflits sont bloqués automatiquement
        (+ buffer de 10 min entre deux activités).
      </p>

      <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Date</div>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {days.map((d) => {
          const date = new Date(d);
          const open = isOpenOn(d);
          const isWed = date.getDay() === 3;
          const active = cart.date === d;
          return (
            <button
              key={d}
              onClick={() => open && setDate(d)}
              disabled={!open}
              className={`shrink-0 rounded-xl border px-4 py-3 text-center transition ${
                active ? 'border-mw-pink bg-mw-pink text-black shadow-neon-pink' : 'border-white/15 bg-white/[0.03] hover:border-white/40'
              } ${!open ? 'cursor-not-allowed opacity-30' : ''}`}
            >
              <div className="text-[10px] font-bold uppercase">{dayLabelsFr[date.getDay()]}</div>
              <div className="text-xl font-black">{date.getDate()}</div>
              <div className="text-[10px]">{date.toLocaleDateString('fr-FR', { month: 'short' })}</div>
              {isWed && open && (
                <div className={`mt-1 text-[9px] font-bold ${active ? 'text-mw-red' : 'text-mw-pink'}`}>-50%</div>
              )}
            </button>
          );
        })}
      </div>

      {cart.date && bookable.length > 1 && (
        <>
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Activité à planifier</div>
          <div className="mb-6 flex flex-wrap gap-2">
            {bookable.map((a) => {
              const chosen = cart.slots[a.id];
              const active = currentActivityId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveActivity(a.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  {chosen ? '✓ ' : ''}{a.name}
                  {chosen && <span className="ml-1 text-xs opacity-70">{chosen.start}</span>}
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
            </div>
            {cart.slots[currentActivityId] && (
              <button onClick={() => setSlot(currentActivityId, null)} className="text-xs text-mw-red hover:underline">
                Effacer
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((slot) => {
              const conflict = slotConflicts(existingBookings, slot, currentActivity);
              const selected = cart.slots[currentActivityId]?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  onClick={() => !conflict && setSlot(currentActivityId, slot)}
                  disabled={conflict}
                  className={`rounded-lg border py-2.5 text-sm font-bold transition ${
                    selected
                      ? 'border-mw-pink bg-mw-pink text-black shadow-neon-pink'
                      : conflict
                      ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through'
                      : 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink'
                  }`}
                >
                  {slot.start}
                </button>
              );
            })}
            {slots.length === 0 && (
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
