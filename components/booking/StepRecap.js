'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useBooking } from '@/lib/store';
import { getActivity, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';
import { getRestrictions } from '@/lib/restrictions';
import { createBooking, logAudit } from '@/lib/data';

export default function StepRecap({ onConfirm }) {
  const { cart, user, clearCart } = useBooking();
  const [promo, setPromo] = useState(cart.appliedPromoCode || '');
  const [promoApplied, setPromoApplied] = useState(Boolean(cart.appliedPromoCode));
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [withCompany, setWithCompany] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [disclaimersAccepted, setDisclaimersAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [paymentStep, setPaymentStep] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Génère les lignes : 1 ligne par session (créneau) = 1 activité × 1 créneau × N joueurs
  const items = Object.entries(cart.items).flatMap(([activityId, item]) => {
    const a = getActivity(activityId);
    if (!a || !a.bookable) return [];
    const slots = cart.slots[activityId] || [];
    return (item.sessions || []).map((sess, idx) => {
      const slot = slots[idx];
      if (!slot) return null;
      const unit = getActivityPrice(a, cart.date);
      // Facturation minimum : si l'activité a un min > 1, on facture au moins ce nombre
      const billedPlayers = Math.max(sess.players, a.minPlayers || 1);
      return {
        activity: a,
        sessionIndex: idx,
        slot,
        players: sess.players,
        billedPlayers,
        unit,
        total: unit * billedPlayers,
      };
    }).filter(Boolean);
  }).sort((a, b) => a.slot.start.localeCompare(b.slot.start));

  const uniqueActivities = [...new Set(items.map((i) => i.activity.id))].map(getActivity);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = promoApplied ? subtotal : 0;
  const total = subtotal - discount;
  const wed = cart.date && isWednesdayDiscount(cart.date);
  const maxPlayers = Math.max(...items.map((i) => i.players), 0);
  const largeGroup = maxPlayers >= 12;

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'DEMO100') setPromoApplied(true);
    else alert('Code promo invalide. Essayez DEMO100 pour la démo.');
  };

  const startPayment = () => {
    if (!email || !name) return alert('Nom et email requis');
    if (!cgvAccepted) return alert('Veuillez accepter les CGV');
    if (!disclaimersAccepted) return alert('Veuillez confirmer avoir pris connaissance des restrictions');
    if (total === 0) {
      confirmBooking('free');
    } else {
      setPaymentStep('choose');
    }
  };

  const processPayment = async (method) => {
    setPaymentMethod(method);
    setPaymentStep('processing');
    await new Promise((r) => setTimeout(r, method === 'card' ? 2500 : 1500));
    setPaymentStep('success');
    await new Promise((r) => setTimeout(r, 900));
    confirmBooking(method);
  };

  const confirmBooking = async (method) => {
    const booking = {
      id: 'MW-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      date: cart.date,
      players: maxPlayers,
      items: items.map((i) => ({
        activityId: i.activity.id,
        activityName: i.activity.name,
        start: i.slot.start,
        end: i.slot.end,
        players: i.players,
        billedPlayers: i.billedPlayers,
        unit: i.unit,
        total: i.total,
      })),
      subtotal,
      discount,
      total,
      paid: true,
      paymentMethod: method,
      promoCode: promoApplied ? 'DEMO100' : null,
      source: 'online',
      packageId: cart.packageId || null,
      customer: {
        name, email, phone,
        companyName: withCompany ? companyName : null,
        vatNumber: withCompany ? vatNumber : null,
      },
      createdAt: new Date().toISOString(),
    };
    setSending(true);
    try {
      await createBooking(booking);
      await logAudit({
        action: 'create_booking',
        entityType: 'booking',
        entityId: booking.id,
        after: { total: booking.total, sessions: booking.items.length, source: 'online' },
      });
      await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(booking),
      });
    } catch (e) { console.error(e); }
    setSending(false);
    sessionStorage.setItem('mw_last_booking', JSON.stringify(booking));
    clearCart();
    onConfirm();
  };

  return (
    <div>
      <h1 className="section-title mb-2">Récap</h1>
      <p className="mb-6 text-white/60">Vérifiez votre sélection, acceptez les conditions et payez.</p>

      {largeGroup && (
        <div className="mb-4 rounded border border-mw-yellow/40 bg-mw-yellow/10 p-4">
          <div className="mb-1 display text-sm text-mw-yellow">Groupe de 12 personnes ou plus</div>
          <p className="mb-3 text-xs text-white/70">
            Pour les events entreprises ou team buildings, notre formulaire dédié vous donne un devis personnalisé.
          </p>
          <a href="https://www.multiwex.be/fr/entreprises/" target="_blank" rel="noopener noreferrer" className="btn-outline !py-2 !px-5 text-xs">
            Formulaire entreprises ↗
          </a>
        </div>
      )}

      <div className="rounded border border-white/10 bg-mw-surface p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Date</div>
            <div className="display text-lg">
              {new Date(cart.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/50">Max joueurs</div>
            <div className="display text-2xl text-mw-pink">{maxPlayers}</div>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((i, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded bg-white/[0.03] p-3">
              <div className="relative h-12 w-12 shrink-0 rounded border border-mw-pink/30 bg-black/40">
                <Image src={i.activity.logo} alt={i.activity.name} fill sizes="48px" className="object-contain p-1.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="display truncate text-base leading-none">{i.activity.name}</div>
                <div className="mt-1 text-xs text-white/60">
                  {i.slot.start} → {i.slot.end} · {i.players} joueur{i.players > 1 ? 's' : ''}
                  {i.billedPlayers > i.players && <span className="ml-1 text-mw-yellow">(facturé {i.billedPlayers} min)</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{i.total.toFixed(2)}€</div>
                <div className="text-xs text-white/50">{i.unit}€ × {i.billedPlayers}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Code promo</div>
          <div className="flex gap-2">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="DEMO100"
              disabled={promoApplied}
              className="input flex-1"
            />
            <button onClick={applyPromo} disabled={promoApplied} className="btn-outline !py-2.5 !px-5 shrink-0 text-sm">
              {promoApplied ? '✓' : 'Appliquer'}
            </button>
          </div>
          {wed && <p className="mt-2 text-xs text-mw-pink">✓ Tarif mercredi -50% déjà appliqué</p>}
          {promoApplied && <p className="mt-2 text-xs text-mw-pink">✓ Code DEMO100 appliqué</p>}
        </div>

        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-white/70"><span>Sous-total</span><span>{subtotal.toFixed(2)}€</span></div>
          {discount > 0 && <div className="flex justify-between text-mw-pink"><span>Code promo</span><span>−{discount.toFixed(2)}€</span></div>}
          <div className="flex justify-between pt-2 text-lg font-black"><span>Total</span><span className="display text-2xl text-mw-pink">{total.toFixed(2)}€</span></div>
        </div>
      </div>

      <div className="mt-6 rounded border border-white/10 bg-mw-surface p-4 md:p-6">
        <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Vos infos</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" className="input" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="input" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (facultatif)" className="input sm:col-span-2" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={withCompany} onChange={(e) => setWithCompany(e.target.checked)} className="h-4 w-4 accent-mw-pink" />
          Je veux une facture au nom d'une entreprise
        </label>
        {withCompany && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Raison sociale" className="input" />
            <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="N° TVA (ex: BE0123456789)" className="input" />
          </div>
        )}
      </div>

      {uniqueActivities.length > 0 && (
        <div className="mt-6 rounded border border-mw-yellow/30 bg-mw-yellow/5 p-4 md:p-6">
          <div className="mb-3 display text-sm text-mw-yellow">Restrictions par activité</div>
          <div className="divide-y divide-white/5">
            {uniqueActivities.map((a) => {
              const r = getRestrictions(a.id);
              if (!r) return null;
              return (
                <div key={a.id} className="grid grid-cols-[auto_1fr] items-start gap-3 py-2 text-xs">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className="relative h-6 w-6 shrink-0">
                      <Image src={a.logo} alt="" fill sizes="24px" className="object-contain" />
                    </div>
                    <span className="display text-white leading-none">{a.name}</span>
                  </div>
                  <div className="text-white/60">{r.disclaimerLong}</div>
                </div>
              );
            })}
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-white">
            <input type="checkbox" checked={disclaimersAccepted} onChange={(e) => setDisclaimersAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-mw-pink" />
            <span>Je confirme avoir pris connaissance des restrictions et que tous les participants y répondent.</span>
          </label>
        </div>
      )}

      <div className="mt-4 rounded border border-white/10 bg-mw-surface p-4 md:p-6">
        <label className="flex items-start gap-2 text-xs text-white">
          <input type="checkbox" checked={cgvAccepted} onChange={(e) => setCgvAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-mw-pink" />
          <span>
            J'accepte les{' '}
            <Link href="/cgv" target="_blank" className="text-mw-pink underline">conditions générales de vente</Link>. Aucun remboursement une fois la réservation confirmée.
          </span>
        </label>
      </div>

      <button
        onClick={startPayment}
        disabled={!name || !email || !cgvAccepted || !disclaimersAccepted || sending}
        className="btn-primary mt-6 w-full md:w-auto"
      >
        {sending ? 'Envoi…' : total === 0 ? 'Confirmer la réservation →' : `Payer ${total.toFixed(2)}€ →`}
      </button>

      {paymentStep && (
        <PaymentModal
          step={paymentStep}
          method={paymentMethod}
          total={total}
          onChoose={processPayment}
          onCancel={() => setPaymentStep(null)}
        />
      )}
    </div>
  );
}

function PaymentModal({ step, method, total, onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded border border-mw-pink/40 bg-mw-surface p-6 text-center shadow-neon-pink">
        {step === 'choose' && (
          <>
            <div className="mb-3 display text-2xl">Mode de paiement</div>
            <div className="display mb-5 text-3xl text-mw-pink">{total.toFixed(2)}€</div>
            <div className="grid gap-3">
              <button onClick={() => onChoose('card')} className="btn-primary !py-4 text-base">
                💳 Carte bancaire
              </button>
              <button onClick={() => onChoose('bancontact')} className="btn-outline !py-4 text-base">
                🇧🇪 Bancontact
              </button>
              <button onClick={() => onChoose('giftcard')} className="btn-outline !py-4 text-base">
                🎁 Carte cadeau
              </button>
            </div>
            <button onClick={onCancel} className="mt-4 text-xs text-white/50 hover:text-mw-red">Annuler</button>
            <p className="mt-4 text-[10px] text-white/40">Simulation — aucune transaction réelle.</p>
          </>
        )}
        {step === 'processing' && (
          <>
            <div className="mb-4 text-6xl">{method === 'card' ? '💳' : method === 'bancontact' ? '🇧🇪' : '🎁'}</div>
            <div className="display mb-4 text-xl">
              {method === 'card' && 'Traitement en cours…'}
              {method === 'bancontact' && 'Redirection Bancontact…'}
              {method === 'giftcard' && 'Vérification du code…'}
            </div>
            <div className="mb-4 flex items-center justify-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:0ms]"></span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:200ms]"></span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:400ms]"></span>
            </div>
            <div className="display text-3xl text-mw-pink">{total.toFixed(2)}€</div>
          </>
        )}
        {step === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/30 text-5xl">✓</div>
            <div className="display mb-2 text-2xl text-green-400">Paiement accepté</div>
            <div className="display text-3xl text-mw-pink">{total.toFixed(2)}€</div>
          </>
        )}
      </div>
    </div>
  );
}
