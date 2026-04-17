'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useBooking } from '@/lib/store';
import { getActivity, getActivityPrice } from '@/lib/activities';

export default function CartDrawer({ open, onClose }) {
  const { cart } = useBooking();
  const activityIds = Object.keys(cart.items || {});
  const hasDate = Boolean(cart.date);

  // Vérifie si le panier est "complet" (toutes les sessions ont un slot assigné)
  const allSlotsAssigned = activityIds.every((id) => {
    const a = getActivity(id);
    if (!a || a.id === 'battlekart') return true;
    const sessions = cart.items[id]?.sessions || [];
    const slots = cart.slots[id] || [];
    return slots.filter(Boolean).length === sessions.length;
  });

  const isComplete = hasDate && activityIds.length > 0 && allSlotsAssigned;

  // Détermine à quelle étape le client s'est arrêté
  const getCurrentStep = () => {
    if (!hasDate) return 'date';
    if (activityIds.length === 0) return 'activities';
    // Vérifie si les sessions sont complètes (joueurs + rooms)
    const sessionsOk = activityIds.every((id) => {
      const a = getActivity(id);
      if (!a || a.id === 'battlekart') return true;
      const item = cart.items[id];
      if (!item?.sessions?.length) return false;
      return item.sessions.every((s) => {
        if (s.players < (a?.minPlayers || 1)) return false;
        if (a.rooms?.length > 0 && !s.roomId) return false;
        return true;
      });
    });
    if (!sessionsOk) return 'sessions';
    if (!allSlotsAssigned) return 'slots';
    return 'recap';
  };
  const currentStep = getCurrentStep();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-mw-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="display text-lg">Mon panier</div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activityIds.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50">Votre panier est vide</div>
          ) : (
            <>
              {hasDate && (
                <div className="mb-4 rounded border border-white/10 bg-mw-surface p-3 text-xs">
                  <span className="text-white/50">Date :</span>{' '}
                  <span className="display text-mw-pink">
                    {new Date(cart.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {activityIds.map((id) => {
                  const a = getActivity(id);
                  if (!a) return null;
                  const item = cart.items[id];
                  const sessions = item?.sessions || [];
                  const slots = cart.slots[id] || [];
                  const price = hasDate ? getActivityPrice(a, cart.date) : a.priceRegular;
                  const isBK = a.id === 'battlekart';

                  return (
                    <div key={id} className="rounded border border-white/10 bg-mw-surface p-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-8 w-8 shrink-0">
                          <Image src={a.logo} alt="" fill sizes="32px" className="object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="display text-sm truncate">{a.name}</div>
                          {isBK ? (
                            <div className="text-[10px] text-mw-yellow">Résa séparée après paiement</div>
                          ) : (
                            <div className="text-[10px] text-white/50">
                              {sessions.length} créneau{sessions.length > 1 ? 'x' : ''} · {price}€/pers
                            </div>
                          )}
                        </div>
                      </div>
                      {!isBK && sessions.map((sess, idx) => {
                        const slot = slots[idx];
                        const roomName = sess.roomId && a.rooms
                          ? a.rooms.find((r) => r.id === sess.roomId)?.name
                          : null;
                        return (
                          <div key={idx} className="mt-1.5 flex items-center gap-2 pl-10 text-[11px]">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-mw-pink text-[9px] font-bold text-white">{idx + 1}</span>
                            <span className="text-white/60">{sess.players} joueur{sess.players > 1 ? 's' : ''}</span>
                            {roomName && <span className="text-white/40">{roomName}</span>}
                            {slot ? (
                              <span className="font-mono text-mw-pink">{slot.start}</span>
                            ) : (
                              <span className="text-white/30">pas encore placé</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          {isComplete ? (
            <Link href={`/booking?step=recap`} onClick={onClose} className="btn-primary w-full text-center block">
              Finaliser ma commande →
            </Link>
          ) : activityIds.length > 0 ? (
            <Link href={`/booking?step=${currentStep}`} onClick={onClose} className="btn-primary w-full text-center block">
              Continuer ma réservation →
            </Link>
          ) : (
            <Link href="/booking" onClick={onClose} className="btn-outline w-full text-center block">
              Commencer une réservation
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
