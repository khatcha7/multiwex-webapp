'use client';
import { useState } from 'react';
import { useBooking } from '@/lib/store';
import { getActivity, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';

export default function StepRecap({ onConfirm }) {
  const { cart, user, saveBooking, clearCart } = useBooking();
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');

  const items = Object.entries(cart.slots)
    .filter(([, s]) => s)
    .map(([id, slot]) => {
      const a = getActivity(id);
      const unit = getActivityPrice(a, cart.date);
      return { activity: a, slot, unit, total: unit * cart.players };
    })
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = promoApplied ? subtotal : 0;
  const total = subtotal - discount;
  const wed = cart.date && isWednesdayDiscount(cart.date);

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'DEMO100') setPromoApplied(true);
    else alert('Code promo invalide. Essayez DEMO100 pour la démo.');
  };

  const confirm = () => {
    if (!email || !name) return alert('Nom et email requis');
    const booking = {
      id: 'MW-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      date: cart.date,
      players: cart.players,
      items: items.map((i) => ({
        activityId: i.activity.id,
        activityName: i.activity.name,
        start: i.slot.start,
        end: i.slot.end,
        unit: i.unit,
        total: i.total,
      })),
      subtotal,
      discount,
      total,
      paid: total === 0,
      customer: { name, email, phone },
      createdAt: new Date().toISOString(),
    };
    saveBooking(booking);
    sessionStorage.setItem('mw_last_booking', JSON.stringify(booking));
    clearCart();
    onConfirm();
  };

  return (
    <div>
      <h1 className="section-title mb-2">Récapitulatif</h1>
      <p className="mb-6 text-white/60">Vérifiez votre sélection et appliquez le code promo de démonstration.</p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Date</div>
            <div className="font-bold">{new Date(cart.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/50">Joueurs</div>
            <div className="font-bold text-mw-pink">{cart.players}</div>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.activity.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3">
              <div className="min-w-0">
                <div className="truncate font-bold">{i.activity.name}</div>
                <div className="text-xs text-white/60">
                  {i.slot.start} → {i.slot.end} · {i.activity.duration} min
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{i.total.toFixed(2)}€</div>
                <div className="text-xs text-white/50">{i.unit}€ × {cart.players}</div>
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
            <button onClick={applyPromo} disabled={promoApplied} className="btn-outline shrink-0">
              {promoApplied ? '✓' : 'Appliquer'}
            </button>
          </div>
          {wed && <p className="mt-2 text-xs text-mw-pink">✓ Tarif mercredi -50% déjà appliqué</p>}
          {promoApplied && <p className="mt-2 text-xs text-mw-pink">✓ Code DEMO100 — paiement offert</p>}
        </div>

        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-white/70"><span>Sous-total</span><span>{subtotal.toFixed(2)}€</span></div>
          {discount > 0 && <div className="flex justify-between text-mw-pink"><span>Code promo</span><span>−{discount.toFixed(2)}€</span></div>}
          <div className="flex justify-between pt-2 text-lg font-black"><span>Total</span><span className="text-mw-pink">{total.toFixed(2)}€</span></div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
        <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Vos infos</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" className="input" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="input" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (facultatif)" className="input sm:col-span-2" />
        </div>
      </div>

      <button onClick={confirm} disabled={!promoApplied || !name || !email} className="btn-primary mt-6 w-full md:w-auto">
        Confirmer la réservation →
      </button>
    </div>
  );
}
