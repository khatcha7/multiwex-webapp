'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { updateBooking, logAudit, getSlotOccupancy } from '@/lib/data';
import { getActivity, getActivityPrice } from '@/lib/activities';
import { getPackage } from '@/lib/packages';

export default function AddPlayersModal({ booking, onClose, onUpdated }) {
  const [addPerSession, setAddPerSession] = useState({});
  const [checks, setChecks] = useState({});
  const [paymentStep, setPaymentStep] = useState(null);
  const isFormula = Boolean(booking?.packageId);
  const pkg = isFormula ? getPackage(booking.packageId) : null;
  const [globalAdd, setGlobalAdd] = useState(0);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [giftcardInput, setGiftcardInput] = useState('');
  const [giftcardApplied, setGiftcardApplied] = useState(null);

  useEffect(() => {
    if (!booking) return;
    setAddPerSession({});
    setGlobalAdd(0);
    setPaymentStep(null);
    setPromoInput('');
    setPromoApplied(false);
    setGiftcardInput('');
    setGiftcardApplied(null);
    const load = async () => {
      const res = {};
      for (let i = 0; i < booking.items.length; i++) {
        const item = booking.items[i];
        const act = getActivity(item.activityId);
        if (!act) continue;
        const room = item.roomId && Array.isArray(act.rooms) ? act.rooms.find((r) => r.id === item.roomId) : null;
        const cap = room ? room.maxPlayers : act.maxPlayers;
        const occ = await getSlotOccupancy(item.activityId, booking.date, item.roomId || undefined);
        const slotOcc = occ[item.start] || { players: 0 };
        const remainingCapacity = Math.max(0, cap - slotOcc.players);
        res[i] = {
          activityName: room ? `${act.name} · ${room.name}` : act.name,
          logo: act.logo,
          start: item.start,
          current: item.players || 0,
          maxAdd: remainingCapacity,
          unit: item.unit || getActivityPrice(act, booking.date),
        };
      }
      setChecks(res);
    };
    load();
  }, [booking]);

  if (!booking) return null;

  const extraTotal = isFormula
    ? globalAdd * (pkg?.pricePerPerson || 0)
    : Object.entries(addPerSession).reduce((s, [idx, extra]) => {
        const c = checks[idx];
        return s + (c ? c.unit * extra : 0);
      }, 0);

  const hasChanges = isFormula ? globalAdd > 0 : Object.values(addPerSession).some((v) => v > 0);

  const promoReduction = promoApplied ? extraTotal : 0;
  const giftcardReduction = giftcardApplied ? Math.min(giftcardApplied.balance, Math.max(0, extraTotal - promoReduction)) : 0;
  const finalTotal = Math.max(0, extraTotal - promoReduction - giftcardReduction);

  const tryApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (code === 'DEMO100') setPromoApplied(true);
    else alert('Code promo invalide. Essayez DEMO100 pour la démo.');
  };

  const tryApplyGiftcard = () => {
    const code = giftcardInput.trim().toUpperCase();
    if (!code) return;
    try {
      const all = JSON.parse(localStorage.getItem('mw_giftcards') || '[]');
      const card = all.find((g) => (g.code || '').toUpperCase() === code && g.paid && (g.balance || 0) > 0);
      if (card) setGiftcardApplied(card);
      else alert('Carte cadeau introuvable, déjà utilisée ou solde insuffisant.');
    } catch {
      alert('Erreur lors de la vérification de la carte cadeau.');
    }
  };

  const startPayment = () => {
    if (!hasChanges) return;
    setPaymentStep('choose');
  };

  const processPayment = async (method) => {
    setPaymentStep('processing');
    await new Promise((r) => setTimeout(r, 2000));
    setPaymentStep('success');
    await new Promise((r) => setTimeout(r, 800));

    if (isFormula) {
      const newItems = booking.items.map((it) => ({
        ...it,
        players: (it.players || 0) + globalAdd,
      }));
      const updated = {
        ...booking,
        items: newItems,
        players: (booking.players || 0) + globalAdd,
      };
      await updateBooking(booking.id || booking.reference, updated);
    } else {
      const newItems = booking.items.map((it, i) => ({
        ...it,
        players: (it.players || 0) + (addPerSession[i] || 0),
      }));
      const updated = {
        ...booking,
        items: newItems,
        players: Math.max(...newItems.map((i) => i.players || 0)),
      };
      await updateBooking(booking.id || booking.reference, updated);
    }

    await logAudit({
      action: 'add_players_paid',
      entityType: 'booking',
      entityId: booking.id || booking.reference,
      after: { isFormula, globalAdd, addPerSession, extraTotal, paymentMethod: method },
    });

    setPaymentStep(null);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded border border-mw-pink/40 bg-mw-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="display mb-2 text-2xl">Ajouter des joueurs</h2>
        <p className="mb-4 text-xs text-white/60">
          Uniquement <span className="text-white">ajouter</span> (pas de remboursement). Modifiable jusqu'à 24h avant.
          {isFormula && <span className="ml-1 text-mw-pink">Formule {pkg?.name} — ajout global.</span>}
        </p>

        {isFormula ? (
          <div className="mb-4 rounded border border-mw-pink/30 bg-mw-pink/5 p-4">
            <div className="mb-2 display text-sm text-mw-pink">Ajout global (formule)</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setGlobalAdd(Math.max(0, globalAdd - 1))} className="flex h-10 w-10 items-center justify-center rounded border border-white/20 text-xl">−</button>
              <div className="w-16 text-center">
                <div className="display text-3xl text-mw-pink">+{globalAdd}</div>
                <div className="text-[10px] text-white/50">participant(s)</div>
              </div>
              <button onClick={() => setGlobalAdd(globalAdd + 1)} className="flex h-10 w-10 items-center justify-center rounded border border-white/20 text-xl">+</button>
            </div>
            <div className="mt-3 text-center text-sm text-mw-pink display">{extraTotal.toFixed(2)}€ supplémentaire</div>
          </div>
        ) : (
          <div className="space-y-2">
            {booking.items.map((it, idx) => {
              const c = checks[idx];
              if (!c) return null;
              const extra = addPerSession[idx] || 0;
              const isFull = c.maxAdd === 0;
              return (
                <div key={idx} className={`rounded border p-3 ${isFull ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0">
                      <Image src={c.logo} alt="" fill sizes="32px" className="object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="display text-sm leading-none">{c.activityName}</div>
                      <div className="text-[10px] text-white/50">{c.start} · {c.current}j actuellement</div>
                    </div>
                  </div>
                  {isFull ? (
                    <div className="text-[11px] text-mw-red">Complet — plus de place sur ce créneau</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAddPerSession({ ...addPerSession, [idx]: Math.max(0, extra - 1) })}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/20"
                      >−</button>
                      <div className="display w-8 text-center text-mw-pink">+{extra}</div>
                      <button
                        onClick={() => setAddPerSession({ ...addPerSession, [idx]: Math.min(c.maxAdd, extra + 1) })}
                        disabled={extra >= c.maxAdd}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/20 disabled:opacity-30"
                      >+</button>
                      <span className="text-[10px] text-white/50">(reste {c.maxAdd - extra})</span>
                      <span className="ml-auto text-[10px] text-mw-pink">+{(c.unit * extra).toFixed(0)}€</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasChanges && (
          <div className="mt-4 rounded border border-mw-pink/30 bg-mw-pink/5 p-3 text-center">
            <div className="text-xs text-white/50">Supplément à régler</div>
            <div className="display text-2xl text-mw-pink">{extraTotal.toFixed(2)}€</div>
            <p className="mt-1 text-[10px] text-white/40">Paiement requis. Si non payé dans 15 min, l'ajout sera annulé.</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Annuler</button>
          <button onClick={startPayment} disabled={!hasChanges} className="btn-primary flex-1 !py-2.5 text-sm">
            Payer & confirmer →
          </button>
        </div>

        {paymentStep && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded border border-mw-pink/40 bg-mw-surface p-6 text-center">
              {paymentStep === 'choose' && (
                <>
                  <div className="mb-3 display text-2xl">Paiement</div>
                  <div className="mb-1 text-xs text-white/50">Total à régler</div>
                  <div className="display mb-1 text-3xl text-mw-pink">{finalTotal.toFixed(2)}€</div>
                  {(promoApplied || giftcardApplied) && (
                    <div className="mb-4 text-[11px] text-white/50">
                      <span className="line-through">{extraTotal.toFixed(2)}€</span>
                      {promoApplied && <span className="ml-2 text-mw-pink">−{promoReduction.toFixed(2)}€ promo</span>}
                      {giftcardApplied && <span className="ml-2 text-mw-pink">−{giftcardReduction.toFixed(2)}€ carte cadeau</span>}
                    </div>
                  )}

                  {!promoApplied && (
                    <div className="mb-2 flex gap-1.5">
                      <input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Code promo (DEMO100)"
                        className="input !py-2 flex-1 text-xs"
                      />
                      <button onClick={tryApplyPromo} className="btn-outline !py-2 !px-3 text-xs">Appliquer</button>
                    </div>
                  )}
                  {promoApplied && (
                    <div className="mb-2 flex items-center justify-between rounded border border-mw-pink/40 bg-mw-pink/10 px-3 py-1.5 text-[11px] text-mw-pink">
                      <span>✓ Code DEMO100 appliqué</span>
                      <button onClick={() => { setPromoApplied(false); setPromoInput(''); }} className="text-white/50 hover:text-mw-red">✕</button>
                    </div>
                  )}

                  {!giftcardApplied && (
                    <div className="mb-3 flex gap-1.5">
                      <input
                        value={giftcardInput}
                        onChange={(e) => setGiftcardInput(e.target.value)}
                        placeholder="Code carte cadeau"
                        className="input !py-2 flex-1 text-xs"
                      />
                      <button onClick={tryApplyGiftcard} className="btn-outline !py-2 !px-3 text-xs">Appliquer</button>
                    </div>
                  )}
                  {giftcardApplied && (
                    <div className="mb-3 flex items-center justify-between rounded border border-mw-pink/40 bg-mw-pink/10 px-3 py-1.5 text-[11px] text-mw-pink">
                      <span>✓ Carte {giftcardApplied.code} (solde {giftcardApplied.balance.toFixed(2)}€)</span>
                      <button onClick={() => { setGiftcardApplied(null); setGiftcardInput(''); }} className="text-white/50 hover:text-mw-red">✕</button>
                    </div>
                  )}

                  {finalTotal === 0 ? (
                    <button
                      onClick={() => processPayment(promoApplied ? 'free' : 'giftcard')}
                      className="btn-primary w-full !py-4"
                    >
                      ✓ Confirmer (gratuit)
                    </button>
                  ) : (
                    <div className="grid gap-3">
                      <button onClick={() => processPayment('card')} className="btn-primary !py-4">💳 Carte bancaire</button>
                      <button onClick={() => processPayment('bancontact')} className="btn-outline !py-4">🇧🇪 Bancontact</button>
                    </div>
                  )}
                  <button onClick={() => setPaymentStep(null)} className="mt-4 text-xs text-white/50 hover:text-mw-red">Annuler</button>
                  <p className="mt-4 text-[10px] text-white/40">Simulation — aucune transaction réelle.</p>
                </>
              )}
              {paymentStep === 'processing' && (
                <>
                  <div className="mb-4 text-6xl">💳</div>
                  <div className="display mb-4 text-xl">Traitement…</div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink"></span>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:200ms]"></span>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:400ms]"></span>
                  </div>
                </>
              )}
              {paymentStep === 'success' && (
                <>
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/30 text-5xl">✓</div>
                  <div className="display mb-2 text-2xl text-green-400">Paiement accepté</div>
                  <div className="display text-3xl text-mw-pink">{extraTotal.toFixed(2)}€</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
