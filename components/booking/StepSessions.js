'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getPackage } from '@/lib/packages';
import { getRestrictions } from '@/lib/restrictions';

function getRoomForSession(activity, sess) {
  if (!activity.rooms || !sess.roomId) return null;
  return activity.rooms.find((r) => r.id === sess.roomId) || null;
}

export default function StepSessions() {
  const { cart, setSessionPlayers, setSessionCount, setSessionRoom } = useBooking();
  const activityIds = Object.keys(cart.items);
  const bookable = activityIds.map(getActivity).filter((a) => a && (a.bookable || a.selectable));
  const isFormula = Boolean(cart.packageId);
  const currentPkg = isFormula ? getPackage(cart.packageId) : null;

  // Formula mode : nombre total de participants
  const [formulaTotal, setFormulaTotal] = useState(() => {
    if (!isFormula || !currentPkg) return currentPkg?.minPlayers || 6;
    return Math.max(currentPkg.minPlayers || 6, ...bookable.map((a) => {
      const item = cart.items[a.id];
      return (item?.sessions || []).reduce((s, ss) => s + ss.players, 0);
    }));
  });

  // Auto-split : quand formulaTotal change, recalculer les sessions par activité
  useEffect(() => {
    if (!isFormula) return;
    bookable.forEach((a) => {
      if (a.id === 'battlekart') return;
      // Combien de créneaux faut-il pour cette activité ?
      const needed = Math.ceil(formulaTotal / a.maxPlayers);
      const current = (cart.items[a.id]?.sessions || []).length;
      if (needed !== current) {
        setSessionCount(a.id, needed);
      }
      // Répartir les joueurs uniformément (arrondi haut/bas)
      const basePerSlot = Math.floor(formulaTotal / needed);
      const remainder = formulaTotal - basePerSlot * needed;
      for (let i = 0; i < needed; i++) {
        const players = basePerSlot + (i < remainder ? 1 : 0);
        const clamped = Math.max(a.minPlayers || 1, Math.min(players, a.maxPlayers));
        setSessionPlayers(a.id, i, clamped);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaTotal, isFormula]);

  const formulaMin = currentPkg?.minPlayers || 1;

  if (isFormula) {
    return (
      <div>
        <h1 className="section-title mb-2">Combien de participants ?</h1>
        <p className="mb-6 text-white/60">
          Formule <span className="text-mw-pink">{currentPkg?.name}</span> — indiquez le nombre total de participants.
          Les créneaux supplémentaires seront créés automatiquement si nécessaire.
        </p>

        <div className="mb-8 flex items-center justify-center gap-4 rounded border border-white/10 bg-mw-surface p-8">
          <button
            onClick={() => setFormulaTotal(Math.max(formulaMin, formulaTotal - 1))}
            disabled={formulaTotal <= formulaMin}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
          >
            −
          </button>
          <div className="w-24 text-center">
            <div className="display text-7xl text-mw-pink">{formulaTotal}</div>
            <div className="text-xs uppercase tracking-wider text-white/50">participant{formulaTotal > 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => setFormulaTotal(formulaTotal + 1)}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold hover:border-mw-pink hover:text-mw-pink"
          >
            +
          </button>
        </div>

        <div className="mb-3 text-xs text-mw-yellow">
          ⚠ Minimum {formulaMin} participants pour la formule {currentPkg?.name}.
        </div>

        {/* Répartition auto par activité */}
        <div className="space-y-3 rounded border border-white/10 bg-mw-surface p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Répartition automatique</div>
          {bookable.filter((a) => a.id !== 'battlekart').map((a) => {
            const item = cart.items[a.id];
            const sessions = item?.sessions || [];
            const needed = Math.ceil(formulaTotal / a.maxPlayers);
            return (
              <div key={a.id} className="rounded bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="relative h-8 w-8 shrink-0 rounded border border-white/10 bg-black/40">
                    <Image src={a.logo} alt="" fill sizes="32px" className="object-contain p-1" />
                  </div>
                  <div className="flex-1 display text-sm">{a.name}</div>
                  <div className="text-sm text-mw-pink">
                    {needed} créneau{needed > 1 ? 'x' : ''}
                    {needed > 1 && <span className="ml-1 text-[10px] text-mw-yellow">(auto-split)</span>}
                  </div>
                </div>
                {sessions.length > 1 && (
                  <div className="space-y-1 pl-10">
                    <div className="text-[10px] text-white/40">Répartition des {formulaTotal} joueurs :</div>
                    {sessions.map((sess, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-mw-pink text-[9px] font-bold text-white">{idx + 1}</div>
                        <span className="text-white/60">Créneau {idx + 1} :</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (sess.players <= (a.minPlayers || 1)) return;
                              // Redistribue : prend 1 au créneau courant, donne au suivant
                              const nextIdx = (idx + 1) % sessions.length;
                              setSessionPlayers(a.id, idx, sess.players - 1);
                              setSessionPlayers(a.id, nextIdx, sessions[nextIdx].players + 1);
                            }}
                            disabled={sess.players <= (a.minPlayers || 1)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/20 text-xs disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="display w-6 text-center text-mw-pink">{sess.players}</span>
                          <button
                            onClick={() => {
                              if (sess.players >= a.maxPlayers) return;
                              const nextIdx = (idx + 1) % sessions.length;
                              if (sessions[nextIdx].players <= (a.minPlayers || 1)) return;
                              setSessionPlayers(a.id, idx, sess.players + 1);
                              setSessionPlayers(a.id, nextIdx, sessions[nextIdx].players - 1);
                            }}
                            disabled={sess.players >= a.maxPlayers}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/20 text-xs disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {bookable.some((a) => a.id === 'battlekart') && (
            <div className="rounded bg-mw-yellow/5 border border-mw-yellow/30 p-3 text-xs text-mw-yellow">
              🏁 BattleKart — réservation séparée après paiement (lien fourni sur la page de confirmation)
            </div>
          )}
        </div>

        <div className="mt-4 rounded bg-mw-pink/10 border border-mw-pink/30 p-3 text-center">
          <div className="display text-sm text-mw-pink">Formule {currentPkg?.name}</div>
          <div className="display text-2xl text-white">{(currentPkg?.pricePerPerson || 0) * formulaTotal}€</div>
          <div className="text-xs text-white/50">{currentPkg?.pricePerPerson}€ × {formulaTotal} participants</div>
        </div>
      </div>
    );
  }

  // Normal mode (pas de formule)
  const bookableActivityCount = bookable.filter((a) => a.id !== 'battlekart').length;
  const useGrid = bookableActivityCount >= 2;
  return (
    <div>
      <h1 className="section-title mb-2">Vos joueurs</h1>
      <p className="mb-4 text-white/60">
        Indiquez combien de joueurs participent à chaque créneau. Vous pouvez splitter votre groupe.
      </p>

      <div className={useGrid ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
        {bookable.map((a) => {
          if (a.id === 'battlekart') {
            return (
              <div key={a.id} className="rounded border border-mw-yellow/30 bg-mw-yellow/5 p-3 text-xs text-mw-yellow">
                🏁 <span className="display">{a.name}</span> — réservation séparée (lien après paiement)
              </div>
            );
          }
          const item = cart.items[a.id];
          const sessions = item?.sessions || [];
          const r = getRestrictions(a.id);
          return (
            <div key={a.id} className="rounded border border-white/10 bg-mw-surface p-3">
              <div className="mb-2 flex items-center gap-3">
                <div className="relative h-9 w-9 shrink-0 rounded border border-white/10 bg-black/40">
                  <Image src={a.logo} alt={a.name} fill className="object-contain p-1.5" sizes="36px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="display text-base leading-none">{a.name}</div>
                  <div className="mt-0.5 text-[11px] text-white/50">
                    {a.duration} min · {a.minPlayers}-{a.maxPlayers} joueurs
                    {a.privative && <span className="ml-1 text-mw-pink">· privatif</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {sessions.map((sess, idx) => {
                  const room = getRoomForSession(a, sess);
                  const effectiveMin = room ? room.minPlayers : (a.minPlayers || 1);
                  const effectiveMax = room ? room.maxPlayers : a.maxPlayers;
                  const atMin = sess.players <= effectiveMin;
                  const atMax = sess.players >= effectiveMax;
                  return (
                    <div key={idx} className="rounded bg-white/[0.03] p-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mw-pink text-[11px] font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="display flex-1 text-sm text-white/70">Créneau {idx + 1}</div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSessionPlayers(a.id, idx, sess.players - 1)}
                            disabled={atMin}
                            className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
                          >
                            −
                          </button>
                          <div className="w-8 text-center display text-lg text-mw-pink">{sess.players}</div>
                          <button
                            onClick={() => setSessionPlayers(a.id, idx, sess.players + 1)}
                            disabled={atMax}
                            className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {/* Choix de salle/piste si l'activité a des rooms */}
                      {a.rooms && a.rooms.length > 0 && (
                        <div className="mt-2 pl-10">
                          <div className="mb-1 text-[10px] text-white/50">Choisir la salle / piste :</div>
                          <div className="flex flex-wrap gap-1.5">
                            {a.rooms.map((rm) => {
                              const selected = sess.roomId === rm.id;
                              const tooMany = sess.players > rm.maxPlayers;
                              const tooFew = sess.players < rm.minPlayers;
                              return (
                                <button
                                  key={rm.id}
                                  onClick={() => setSessionRoom(a.id, idx, rm.id)}
                                  disabled={tooMany}
                                  className={`rounded border px-3 py-1.5 text-xs transition ${
                                    selected
                                      ? 'border-mw-pink bg-mw-pink/20 text-mw-pink'
                                      : tooMany
                                      ? 'cursor-not-allowed border-white/10 text-white/20 opacity-50'
                                      : 'border-white/20 text-white/70 hover:border-mw-pink'
                                  }`}
                                  title={tooMany ? `Max ${rm.maxPlayers} joueurs pour ${rm.name}` : tooFew ? `Min ${rm.minPlayers} joueurs pour ${rm.name}` : ''}
                                >
                                  <span className="display">{rm.name}</span>
                                  <span className="ml-1 text-[9px] text-white/40">{rm.minPlayers}-{rm.maxPlayers}</span>
                                </button>
                              );
                            })}
                          </div>
                          {sess.roomId && room && sess.players < room.minPlayers && (
                            <div className="mt-1 text-[10px] text-mw-yellow">
                              ⚠ Min {room.minPlayers} joueurs pour {room.name} — le nombre sera ajusté automatiquement.
                            </div>
                          )}
                          {!sess.roomId && (
                            <div className="mt-1 text-[10px] text-mw-yellow">
                              ⚠ Veuillez choisir une salle / piste.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {a.minPlayers > 1 && (
                <p className="mt-2 text-[10px] text-mw-yellow">
                  ⚠ Min {a.minPlayers} joueurs — facturé au minimum de {a.minPlayers} en dessous.
                </p>
              )}
              {r?.disclaimerShort && (
                <p className="mt-1 text-[10px] text-white/50">{r.disclaimerShort}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
