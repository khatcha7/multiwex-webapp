'use client';

import { useEffect, useMemo, useState } from 'react';
import { activities, getActivity } from '@/lib/activities';
import { generateSlotsForActivity, dayLabelsFrFull, parseDate } from '@/lib/hours';
import { getSlotOccupancy, moveBookingItem, splitBookingItem } from '@/lib/data';

const bookableActivities = activities.filter((a) => a.bookable);

function makeItemRef(booking, item) {
  if (item?.id) return { id: item.id };
  return {
    bookingId: booking?.id || booking?.reference,
    activityId: item?.activityId,
    start: item?.start,
  };
}

function formatHeaderDate(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  const day = dayLabelsFrFull[d.getDay()];
  const dn = d.getDate();
  const monthsLong = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${day} ${dn} ${monthsLong[d.getMonth()]}`;
}

export default function EditBookingItemModal({ open, onClose, booking, item, onSaved }) {
  const initialActivityId = item?.activityId;
  const initialDate = booking?.date;
  const initialStart = item?.start;
  const initialPlayers = item?.players || 1;
  const initialRoomId = item?.roomId || null;

  const [mode, setMode] = useState('move');
  const [activityId, setActivityId] = useState(initialActivityId);
  const [slotDate, setSlotDate] = useState(initialDate);
  const [pickedSlot, setPickedSlot] = useState(null);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [keepPlayers, setKeepPlayers] = useState(Math.max(1, initialPlayers - 1));
  const [occupancy, setOccupancy] = useState({});
  const [loadingOcc, setLoadingOcc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMode('move');
    setActivityId(initialActivityId);
    setSlotDate(initialDate);
    setPickedSlot(null);
    setRoomId(initialRoomId);
    setKeepPlayers(Math.max(1, initialPlayers - 1));
    setError(null);
    setSubmitting(false);
  }, [open, initialActivityId, initialDate, initialPlayers, initialRoomId]);

  const targetActivity = useMemo(() => getActivity(activityId), [activityId]);
  const targetRoom = useMemo(() => {
    if (!targetActivity?.rooms || !roomId) return null;
    return targetActivity.rooms.find((r) => r.id === roomId) || null;
  }, [targetActivity, roomId]);
  const needsRoom = useMemo(() => Boolean(targetActivity?.rooms?.length), [targetActivity]);

  useEffect(() => {
    if (!targetActivity?.rooms?.length) {
      setRoomId(null);
      return;
    }
    const stillValid = targetActivity.rooms.some((r) => r.id === roomId);
    if (!stillValid) setRoomId(targetActivity.rooms[0].id);
  }, [targetActivity, roomId]);

  useEffect(() => {
    if (!open || !activityId || !slotDate) return;
    let cancelled = false;
    setLoadingOcc(true);
    getSlotOccupancy(activityId, slotDate).then((o) => {
      if (!cancelled) {
        setOccupancy(o || {});
        setLoadingOcc(false);
      }
    }).catch(() => { if (!cancelled) { setOccupancy({}); setLoadingOcc(false); } });
    return () => { cancelled = true; };
  }, [open, activityId, slotDate]);

  const slots = useMemo(() => {
    if (!targetActivity || !slotDate) return [];
    return generateSlotsForActivity(targetActivity, slotDate, { fullDay: true });
  }, [targetActivity, slotDate]);

  const playersToPlace = mode === 'move' ? initialPlayers : Math.max(initialPlayers - keepPlayers, 0);

  const isSameSlot = (slot) =>
    activityId === initialActivityId && slotDate === initialDate && slot.start === initialStart;

  const slotCapacity = targetRoom?.maxPlayers ?? targetActivity?.maxPlayers ?? 0;

  const slotInfo = (slot) => {
    const occ = occupancy[slot.start];
    let current = occ?.players || 0;
    if (isSameSlot(slot)) {
      current = Math.max(0, current - initialPlayers);
    }
    const after = current + playersToPlace;
    const overbook = after > slotCapacity;
    return { current, after, overbook };
  };

  const splitMin = targetActivity?.minPlayers || 1;
  const splitInvalid =
    mode === 'split' && (
      keepPlayers < splitMin ||
      keepPlayers >= initialPlayers ||
      keepPlayers <= 0
    );

  const confirmDisabled =
    submitting ||
    !pickedSlot ||
    splitInvalid ||
    (pickedSlot && slotInfo(pickedSlot).overbook);

  const onConfirm = async () => {
    if (!pickedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const ref = makeItemRef(booking, item);
      if (mode === 'move') {
        await moveBookingItem(ref, {
          activityId,
          activityName: targetActivity?.name,
          slotDate,
          slotStart: pickedSlot.start,
          slotEnd: pickedSlot.end,
          players: initialPlayers,
          roomId: roomId || null,
        });
      } else {
        await splitBookingItem(ref, keepPlayers, {
          activityId,
          slotDate,
          slotStart: pickedSlot.start,
          slotEnd: pickedSlot.end,
          roomId: roomId || null,
        });
      }
      if (onSaved) onSaved();
    } catch (e) {
      setError(e?.message || String(e));
      setSubmitting(false);
    }
  };

  if (!open || !booking || !item) return null;

  const ref = booking?.id || booking?.reference || '';
  const customerName = booking?.customer?.name
    || `${booking?.customer?.firstName || ''} ${booking?.customer?.lastName || ''}`.trim()
    || 'Client';
  const initialActivity = getActivity(initialActivityId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded border-2 border-mw-pink bg-mw-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="display text-2xl">Modifier la réservation</div>
            <div className="mt-1 text-xs text-white/60">
              <span className="font-mono text-mw-pink">{ref}</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span>{customerName}</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span>{formatHeaderDate(initialDate)} {initialStart}</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span>{initialActivity?.name || initialActivityId}</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span>{initialPlayers} joueur{initialPlayers > 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink">✕</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <label className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm cursor-pointer ${mode === 'move' ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70'}`}>
            <input type="radio" name="edit-mode" checked={mode === 'move'} onChange={() => setMode('move')} className="accent-mw-pink" />
            Déplacer toute la session
          </label>
          <label className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm cursor-pointer ${mode === 'split' ? 'border-mw-pink bg-mw-pink/10 text-mw-pink' : 'border-white/15 text-white/70'}`}>
            <input type="radio" name="edit-mode" checked={mode === 'split'} onChange={() => setMode('split')} className="accent-mw-pink" />
            Splitter (séparer le groupe)
          </label>
        </div>

        {mode === 'split' && (
          <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Combien de joueurs garder sur le créneau actuel ?</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setKeepPlayers((v) => Math.max(1, v - 1))}
                className="flex h-8 w-8 items-center justify-center rounded border border-white/20"
              >−</button>
              <input
                type="number"
                min={1}
                max={initialPlayers - 1}
                value={keepPlayers}
                onChange={(e) => setKeepPlayers(Math.max(1, Math.min(initialPlayers - 1, Number(e.target.value) || 1)))}
                className="input !w-20 text-center"
              />
              <button
                onClick={() => setKeepPlayers((v) => Math.min(initialPlayers - 1, v + 1))}
                className="flex h-8 w-8 items-center justify-center rounded border border-white/20"
              >+</button>
              <span className="ml-2 text-xs text-white/60">
                {keepPlayers} joueur{keepPlayers > 1 ? 's' : ''} reste{keepPlayers > 1 ? 'nt' : ''} sur {initialStart} {initialActivity?.name}, {Math.max(initialPlayers - keepPlayers, 0)} joueur{Math.max(initialPlayers - keepPlayers, 0) > 1 ? 's' : ''} vont ailleurs
              </span>
            </div>
            {keepPlayers < splitMin && (
              <div className="mt-2 text-xs text-mw-red">
                Min {splitMin} joueur{splitMin > 1 ? 's' : ''} requis pour {initialActivity?.name}
              </div>
            )}
            {keepPlayers >= initialPlayers && (
              <div className="mt-2 text-xs text-mw-red">Doit être inférieur à {initialPlayers}</div>
            )}
          </div>
        )}

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              {mode === 'split' ? 'Nouvelle activité (pour les joueurs déplacés)' : 'Activité'}
            </label>
            <select
              value={activityId || ''}
              onChange={(e) => { setActivityId(e.target.value); setPickedSlot(null); }}
              className="input text-sm w-full"
            >
              {bookableActivities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Date</label>
            <input
              type="date"
              value={slotDate || ''}
              onChange={(e) => { setSlotDate(e.target.value); setPickedSlot(null); }}
              className="input text-sm w-full"
            />
          </div>
          {needsRoom && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Salle / Piste</label>
              <select
                value={roomId || ''}
                onChange={(e) => setRoomId(e.target.value)}
                className="input text-sm w-full"
              >
                {targetActivity.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.minPlayers}-{r.maxPlayers} joueurs)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Créneau cible</div>
            {loadingOcc && <div className="text-[10px] text-white/40">Chargement…</div>}
          </div>
          {slots.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/50">
              Aucun créneau disponible pour cette activité à cette date.
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((slot) => {
                const info = slotInfo(slot);
                const isPicked = pickedSlot?.start === slot.start;
                let cls = 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink';
                if (info.overbook) cls = 'cursor-not-allowed border-mw-red/40 bg-mw-red/10 text-mw-red';
                else if (isPicked) cls = 'border-mw-pink bg-mw-pink text-white shadow-neon-pink';
                else if (info.current === 0) cls = 'border-green-500/40 bg-green-500/10 text-green-300 hover:border-mw-pink';
                else cls = 'border-mw-yellow/50 bg-mw-yellow/10 text-mw-yellow hover:border-mw-pink';
                return (
                  <button
                    key={slot.start}
                    onClick={() => !info.overbook && setPickedSlot(slot)}
                    disabled={info.overbook}
                    className={`rounded border px-2 py-1.5 text-left text-xs transition ${cls}`}
                    title={info.overbook ? `Overbook : ${info.current}+${playersToPlace} > ${slotCapacity}` : `${info.current}/${slotCapacity} actuels`}
                  >
                    <div className="display text-sm">{slot.start}–{slot.end}</div>
                    <div className="text-[10px] opacity-80">{info.current}/{slotCapacity} joueurs</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded border border-mw-red/40 bg-mw-red/10 p-2 text-xs text-mw-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button onClick={onClose} className="btn-outline !py-2 !px-4 text-sm">Annuler</button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="btn-primary !py-2 !px-4 text-sm disabled:opacity-30"
          >
            {submitting ? 'En cours…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
