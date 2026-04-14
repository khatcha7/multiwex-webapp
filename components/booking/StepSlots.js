'use client';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useBooking, computeSessionsNeeded } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getSlotOccupancy, getSlotBlocks, subscribeBookings } from '@/lib/data';
import {
  generateSlotsForActivity,
  slotConflicts,
  dayLabelsFr,
  monthsFr,
  isOpenOn,
  toDateStr,
  parseDate,
  toMinutes,
} from '@/lib/hours';

const JOIN_CUTOFF_MIN = 10;

function buildUpcomingDays(count = 90) {
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
  const days = useMemo(() => buildUpcomingDays(90), []);
  const [activeActivity, setActiveActivity] = useState(null);
  const [occupancy, setOccupancy] = useState({});
  const [blocks, setBlocks] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

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

  useEffect(() => {
    if (!currentActivity || !cart.date) return;
    let cancelled = false;
    getSlotOccupancy(currentActivity.id, cart.date).then((o) => !cancelled && setOccupancy(o));
    getSlotBlocks(cart.date).then((b) => !cancelled && setBlocks(b || []));
    return () => { cancelled = true; };
  }, [currentActivity, cart.date, refreshTick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setRefreshTick((t) => t + 1));
    return unsub;
  }, []);

  const existingBookings = Object.entries(cart.slots).flatMap(([id, arr]) => {
    if (id === currentActivityId) return [];
    const act = getActivity(id);
    return (arr || []).map((s) => ({ ...s, duration: act.duration }));
  });

  const ownSelected = cart.slots[currentActivityId] || [];
  const allSlots = cart.date && currentActivity ? generateSlotsForActivity(currentActivity, cart.date) : [];

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
        chaque activité.{' '}
        <span className="text-mw-yellow">Créneaux jaunes = groupe déjà présent, vous jouerez ensemble (tant qu'il reste de la place).</span>
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
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    active ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="relative h-5 w-5">
                    <Image src={a.logo} alt="" fill className="object-contain" sizes="20px" />
                  </div>
                  <span className="display tracking-wider">{a.name}</span>
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
              {currentActivity.name} ({currentActivity.duration} min)
              {currentSessions > 1 && <> — {ownSelected.length}/{currentSessions}</>}
            </div>
            {ownSelected.length > 0 && (
              <button onClick={() => setActivitySlots(currentActivityId, [])} className="text-xs text-mw-red hover:underline">
                Effacer
              </button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-white/50">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-white/10 border border-white/30"></span>Libre</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-yellow/30 border border-mw-yellow"></span>Groupe présent</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-red/20 border border-mw-red line-through"></span>Complet</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-pink border border-mw-pink"></span>Sélectionné</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {allSlots.map((slot) => {
              const conflict = slotConflicts(existingBookings, slot, currentActivity);
              const selected = ownSelected.some((s) => s.start === slot.start);
              const occ = occupancy[slot.start];
              const blockedHere = blocks.find(
                (b) => (b.activity_id || b.activityId) === currentActivity.id && (b.start_time?.slice(0, 5) === slot.start || b.start === slot.start)
              );

              const totalCap = currentActivity.maxPlayers;
              const playersInSlot = occ?.players || 0;
              const groupsInSlot = occ?.groups || 0;
              const wouldFit = playersInSlot + cart.players <= totalCap;

              // cutoff — can't join less than JOIN_CUTOFF_MIN before start (only for today)
              const isToday = toDateStr(new Date()) === cart.date;
              let pastCutoff = false;
              if (isToday) {
                const now = new Date();
                const nowM = now.getHours() * 60 + now.getMinutes();
                const slotM = toMinutes(slot.start);
                if (slotM - nowM < JOIN_CUTOFF_MIN) pastCutoff = true;
              }

              // Activités privatives : dès qu'il y a 1 groupe, le créneau est complet
              const privative = currentActivity.privative;
              const full = privative ? playersInSlot > 0 : playersInSlot >= totalCap;
              const shared = !privative && playersInSlot > 0 && !full;
              const blocked = Boolean(blockedHere) || pastCutoff || (shared && !wouldFit);
              const disabled = conflict || full || blocked;

              let classes = '';
              if (selected) classes = 'border-mw-pink bg-mw-pink text-white shadow-neon-pink';
              else if (blockedHere) classes = 'cursor-not-allowed border-mw-red/50 bg-mw-red/20 text-white/40 line-through';
              else if (full) classes = 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30 line-through';
              else if (shared && wouldFit) classes = 'border-mw-yellow/60 bg-mw-yellow/10 text-mw-yellow hover:bg-mw-yellow/20';
              else if (shared && !wouldFit) classes = 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30';
              else if (conflict) classes = 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through';
              else if (pastCutoff) classes = 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20';
              else classes = 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink';

              return (
                <button
                  key={slot.start}
                  onClick={() => !disabled && toggleSlot(slot)}
                  disabled={disabled}
                  className={`relative rounded-lg border py-2.5 text-sm font-bold transition ${classes}`}
                  title={
                    blockedHere ? `Bloqué: ${blockedHere.block_reason || blockedHere.reason || 'staff'}`
                      : shared ? `${playersInSlot}/${totalCap} joueurs (${groupsInSlot} groupe${groupsInSlot > 1 ? 's' : ''}) — vous les rejoindrez`
                      : full ? 'Complet'
                      : pastCutoff ? 'Trop tard pour rejoindre ce créneau (briefing 10 min)'
                      : undefined
                  }
                >
                  {slot.start}
                  {shared && !full && wouldFit && (
                    <div className="mt-0.5 text-[8px] font-normal">{playersInSlot}/{totalCap}</div>
                  )}
                  {(full || blockedHere) && <div className="text-[8px] font-normal opacity-80">{blockedHere ? 'bloqué' : 'complet'}</div>}
                  {pastCutoff && !full && !blockedHere && <div className="text-[8px] font-normal opacity-60">trop tard</div>}
                </button>
              );
            })}
            {allSlots.length === 0 && (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
                Aucun créneau disponible pour cette activité ce jour-là.
              </div>
            )}
          </div>

          {currentActivity && ownSelected.length > 0 && (
            <div className="mt-4 rounded-xl border border-mw-yellow/30 bg-mw-yellow/5 p-3 text-xs text-mw-yellow">
              ℹ Le briefing sécurité démarre 10 minutes avant le créneau. Merci d'arriver au moins 15 min à l'avance.
            </div>
          )}
        </>
      )}
    </div>
  );
}
