'use client';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getSlotOccupancy, getSlotBlocks, subscribeBookings } from '@/lib/data';
import {
  generateSlotsForActivity,
  dayLabelsFrMondayFirst,
  dayLabelsFr,
  dayLabelsFrFull,
  monthsFr,
  isOpenOn,
  toDateStr,
  parseDate,
  toMinutes,
  dayToMondayIndex,
  CLOSURE_MIN_ONLINE,
} from '@/lib/hours';

export default function StepSlots() {
  const { cart, setDate, assignSlot, clearSlot, setCart } = useBooking();
  const [activeActivityId, setActiveActivityId] = useState(null);
  const [prevDate, setPrevDate] = useState(cart.date);
  const [occupancy, setOccupancy] = useState({});
  const [blocks, setBlocks] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = cart.date ? parseDate(cart.date) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Reset tous les slots si la date change + revenir sur la première activité
  useEffect(() => {
    if (prevDate && cart.date && prevDate !== cart.date) {
      setCart((c) => ({ ...c, slots: {} }));
      setActiveActivityId(null); // revient à la première activité
    }
    setPrevDate(cart.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.date]);

  // BattleKart exclu des créneaux (réservation séparée)
  const bookable = Object.keys(cart.items).map(getActivity).filter((a) => a && (a.bookable || a.selectable) && a.id !== 'battlekart');
  const currentActivityId = activeActivityId || bookable[0]?.id;
  const currentActivity = getActivity(currentActivityId);
  const currentSessions = cart.items[currentActivityId]?.sessions || [];
  const currentSlots = cart.slots[currentActivityId] || [];

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

  const allSlots = cart.date && currentActivity ? generateSlotsForActivity(currentActivity, cart.date) : [];

  // Trouve le prochain index de session non assigné
  const nextUnassignedIndex = () => {
    for (let i = 0; i < currentSessions.length; i++) {
      if (!currentSlots[i]) return i;
    }
    return currentSessions.length - 1;
  };

  const handleSlotClickForGroup = (slot, groupIndices) => {
    // Si ce slot est déjà assigné dans CE groupe, on le désassigne
    const existingIdx = groupIndices.find((i) => currentSlots[i] && currentSlots[i].start === slot.start);
    if (existingIdx != null) {
      clearSlot(currentActivityId, existingIdx);
      return;
    }

    // Prochain index non assigné dans CE groupe
    const nextIdx = groupIndices.find((i) => !currentSlots[i]);
    if (nextIdx == null) return; // tout est déjà assigné dans ce groupe

    assignSlot(currentActivityId, nextIdx, slot);

    // Auto-advance : si TOUTE l'activité est maintenant complète, passer à la suivante
    const willBeComplete = currentSessions.every((_, i) => i === nextIdx || currentSlots[i]);
    if (willBeComplete) {
      setTimeout(() => {
        const currentIdx = bookable.findIndex((a) => a.id === currentActivityId);
        const nextActivity = bookable.find((a, i) => {
          if (i <= currentIdx) return false;
          const slots = cart.slots[a.id] || [];
          const sessions = cart.items[a.id]?.sessions || [];
          return slots.filter(Boolean).length < sessions.length;
        });
        if (nextActivity) setActiveActivityId(nextActivity.id);
      }, 300);
    }
  };

  const navPrev = () => {
    const pm = new Date(viewMonth.year, viewMonth.month - 1, 1);
    const today = new Date();
    if (pm < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setViewMonth({ year: pm.getFullYear(), month: pm.getMonth() });
  };
  const navNext = () => {
    const nm = new Date(viewMonth.year, viewMonth.month + 1, 1);
    setViewMonth({ year: nm.getFullYear(), month: nm.getMonth() });
  };

  // Liste des jours du mois — uniquement aujourd'hui et après (pas de dates passées)
  const today = new Date();
  const todayStr = toDateStr(today);
  const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
  const monthDays = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds = toDateStr(new Date(viewMonth.year, viewMonth.month, d));
    if (ds >= todayStr) monthDays.push(ds);
  }

  return (
    <div>
      <h1 className="section-title mb-2">Créneaux</h1>
      <p className="mb-6 text-white/60">
        Sélectionnez un créneau pour chaque session. Numéro de la bulle = numéro du créneau.
        Les activités peuvent se chevaucher (votre groupe peut se splitter).
      </p>

      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-white/50">
          Date {cart.date === toDateStr(today) && <span className="text-mw-pink">(aujourd'hui)</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={navPrev}
            disabled={viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth()}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/15 text-sm disabled:opacity-20"
          >
            ←
          </button>
          <div className="display w-32 text-center text-sm">
            {monthsFr[viewMonth.month]} {viewMonth.year}
          </div>
          <button onClick={navNext} className="flex h-8 w-8 items-center justify-center rounded border border-white/15 text-sm hover:border-mw-pink hover:text-mw-pink">
            →
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {monthDays.map((d) => {
          const dt = parseDate(d);
          const open = isOpenOn(d);
          const isWed = dt.getDay() === 3;
          const active = cart.date === d;
          const isToday = toDateStr(today) === d;
          const isPast = dt < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const disabled = !open || isPast;
          return (
            <button
              key={d}
              onClick={() => !disabled && setDate(d)}
              disabled={disabled}
              className={`relative shrink-0 rounded border px-3.5 py-2.5 text-center transition ${
                active
                  ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                  : 'border-white/15 bg-white/[0.03] hover:border-white/40'
              } ${disabled ? 'cursor-not-allowed opacity-25' : ''}`}
            >
              {isToday && !active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mw-pink" />}
              <div className="text-[10px] font-bold uppercase opacity-80">{dayLabelsFr[dt.getDay()]}</div>
              <div className="display text-xl leading-none">{dt.getDate()}</div>
              {isWed && open && (
                <div className={`mt-0.5 text-[9px] font-bold ${active ? 'text-white' : 'text-mw-pink'}`}>-50%</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Activité tabs */}
      {cart.date && bookable.length > 1 && (
        <>
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Activité à planifier</div>
          <div className="mb-5 flex flex-wrap gap-2">
            {bookable.map((a) => {
              const slots = cart.slots[a.id] || [];
              const sessions = cart.items[a.id]?.sessions || [];
              const chosen = slots.filter(Boolean).length;
              const needed = sessions.length;
              const active = currentActivityId === a.id;
              const complete = chosen === needed;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveActivityId(a.id)}
                  className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
                    active ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="relative h-5 w-5">
                    <Image src={a.logo} alt="" fill className="object-contain" sizes="20px" />
                  </div>
                  <span className="display tracking-wider">{a.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${complete ? 'bg-mw-pink text-white' : 'bg-white/10 text-white/60'}`}>
                    {chosen}/{needed}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Sessions à assigner */}
      {currentActivity && (
        <>
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">
            {currentActivity.name} · Créneaux à placer
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {currentSessions.map((sess, idx) => {
              const assigned = currentSlots[idx];
              const roomName = sess.roomId && currentActivity.rooms
                ? currentActivity.rooms.find((r) => r.id === sess.roomId)?.name
                : null;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${
                    assigned ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/20 text-white/60 border-dashed'
                  }`}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-mw-pink text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                  <span className="display">{sess.players}j</span>
                  {roomName && <span className="text-[9px] text-white/40">{roomName}</span>}
                  {assigned ? (
                    <>
                      <span className="font-mono">{assigned.start}</span>
                      <button onClick={() => clearSlot(currentActivityId, idx)} className="text-mw-red hover:underline">✕</button>
                    </>
                  ) : (
                    <span className="opacity-50">à placer</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-white/50">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-white/10 border border-white/30"></span>Libre</span>
            {!currentActivity.privative && (
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-yellow/30 border border-mw-yellow"></span>Groupe(s) présent(s)</span>
            )}
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-red/20 border border-mw-red line-through"></span>Complet</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-mw-pink border border-mw-pink"></span>Sélectionné</span>
          </div>

          {/* Groupes par salle/piste — si rooms différentes, afficher un calendrier par room */}
          {(() => {
            const hasRooms = currentActivity.rooms && currentActivity.rooms.length > 0;
            const uniqueRoomIds = hasRooms
              ? [...new Set(currentSessions.map((s) => s.roomId).filter(Boolean))]
              : [null];
            // Si pas de rooms ou toutes les sessions ont le même roomId → 1 calendrier
            // Sinon → un calendrier par roomId
            return uniqueRoomIds.map((roomId) => {
              const roomDef = roomId ? currentActivity.rooms.find((r) => r.id === roomId) : null;
              // Indices des sessions qui appartiennent à ce groupe
              const sessionIndices = currentSessions.map((s, i) => i).filter((i) => {
                if (!hasRooms || uniqueRoomIds.length <= 1) return true;
                return currentSessions[i].roomId === roomId;
              });
              const roomCap = roomDef ? roomDef.maxPlayers : currentActivity.maxPlayers;

              return (
                <div key={roomId || 'default'} className="mb-4">
                  {roomDef && uniqueRoomIds.length > 1 && (
                    <div className="mb-2 rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs">
                      <span className="display text-mw-pink">{roomDef.name}</span>
                      <span className="ml-2 text-white/50">{roomDef.minPlayers}-{roomDef.maxPlayers} joueurs</span>
                      <span className="ml-2 text-white/40">
                        — {sessionIndices.filter((i) => currentSlots[i]).length}/{sessionIndices.length} créneau(x) placé(s)
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {allSlots.map((slot) => {
              const occ = occupancy[slot.start];
              const blockedHere = blocks.find(
                (b) => (b.activity_id || b.activityId) === currentActivity.id && (b.start_time?.slice(0, 5) === slot.start || b.start === slot.start)
              );

              const totalCap = roomCap;
              const playersInSlot = occ?.players || 0;
              const groupsInSlot = occ?.groups || 0;

              const privative = currentActivity.privative;
              const full = privative ? playersInSlot > 0 : playersInSlot >= totalCap;
              const shared = !privative && playersInSlot > 0 && !full;

              const isToday = toDateStr(new Date()) === cart.date;
              let pastCutoff = false;
              if (isToday) {
                const now = new Date();
                const nowM = now.getHours() * 60 + now.getMinutes();
                const slotM = toMinutes(slot.start);
                if (slotM - nowM < CLOSURE_MIN_ONLINE) pastCutoff = true;
              }

              // Prochain index non assigné DANS CE GROUPE de room
              const nextInGroup = sessionIndices.find((i) => !currentSlots[i]);
              const nextPlayers = nextInGroup != null ? currentSessions[nextInGroup]?.players || 0 : 0;
              const wouldFit = shared ? playersInSlot + nextPlayers <= totalCap : true;

              // Est-ce que ce slot est assigné à une session de CE GROUPE ?
              const assignedSessionIdx = sessionIndices.find((i) => currentSlots[i] && currentSlots[i].start === slot.start);
              const isAssigned = assignedSessionIdx != null;

              const disabled = Boolean(blockedHere) || full || pastCutoff || (shared && !wouldFit);

              let classes = '';
              if (isAssigned) classes = 'border-mw-pink bg-mw-pink text-white shadow-neon-pink';
              else if (blockedHere) classes = 'cursor-not-allowed border-mw-red/50 bg-mw-red/20 text-white/40';
              else if (full) classes = 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30 line-through';
              else if (shared && !wouldFit) classes = 'cursor-not-allowed border-mw-red/50 bg-mw-red/15 text-mw-red';
              else if (shared) classes = 'border-mw-yellow/60 bg-mw-yellow/10 text-mw-yellow hover:bg-mw-yellow/20';
              else if (pastCutoff) classes = 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20';
              else classes = 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink';

              return (
                <button
                  key={`${roomId || 'x'}-${slot.start}`}
                  onClick={() => !disabled && handleSlotClickForGroup(slot, sessionIndices)}
                  disabled={disabled}
                  className={`relative rounded border py-2.5 text-sm font-bold transition ${classes}`}
                  title={
                    blockedHere ? `Bloqué: ${blockedHere.block_reason || blockedHere.reason || 'staff'}`
                      : full ? 'Complet'
                      : shared ? `Libre ${totalCap - playersInSlot}/${totalCap} — ${groupsInSlot} groupe(s) déjà présent(s)`
                      : pastCutoff ? 'Fermé (moins de 30 min avant le créneau)'
                      : `Libre ${totalCap}/${totalCap}`
                  }
                >
                  {isAssigned && (
                    <div className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-mw-pink text-[10px] font-bold text-white ring-2 ring-mw-darker">
                      {assignedSessionIdx + 1}
                    </div>
                  )}
                  {slot.start}
                  {!privative && shared && wouldFit && (
                    <div className="mt-0.5 text-[8px] font-normal">Libre {totalCap - playersInSlot}/{totalCap}</div>
                  )}
                  {!privative && !shared && !full && !blockedHere && !pastCutoff && (
                    <div className="mt-0.5 text-[8px] font-normal opacity-60">Libre {totalCap}/{totalCap}</div>
                  )}
                  {(full || blockedHere) && <div className="text-[8px] font-normal opacity-80">{blockedHere ? 'bloqué' : 'complet'}</div>}
                </button>
              );
            })}
            {allSlots.length === 0 && (
              <div className="col-span-full rounded border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
                Aucun créneau disponible.
              </div>
            )}
          </div>
                </div>
              );
            });
          })()}

          {currentSlots.filter(Boolean).length > 0 && (
            <div className="mt-4 rounded border border-mw-yellow/30 bg-mw-yellow/5 p-3 text-[11px] text-mw-yellow">
              ℹ Le briefing sécurité démarre 10 min avant. Merci d'arriver au moins 15 min à l'avance.
            </div>
          )}
        </>
      )}
    </div>
  );
}
