'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import { getRestrictions } from '@/lib/restrictions';
import { generateSlotsForActivity, toDateStr } from '@/lib/hours';
import { createBooking, logAudit, getActiveStaff, getSlotOccupancy } from '@/lib/data';
import { computeSessionsNeeded } from '@/lib/store';
import { getActivityPrice } from '@/lib/activities';

export default function OnSiteBookingPage() {
  const today = toDateStr(new Date());
  const [step, setStep] = useState('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [players, setPlayers] = useState(2);
  const [items, setItems] = useState({});
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState({});
  const [payment, setPayment] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const staff = typeof window !== 'undefined' ? getActiveStaff() : null;

  const toggleActivity = (id) => {
    const next = { ...items };
    if (next[id]) delete next[id];
    else next[id] = { quantity: 1 };
    setItems(next);
  };

  const bookable = Object.keys(items).map((id) => activities.find((a) => a.id === id)).filter(Boolean);
  const itemsArr = Object.entries(slots).flatMap(([id, arr]) => {
    const a = activities.find((x) => x.id === id);
    const unit = getActivityPrice(a, date);
    return (arr || []).map((s) => ({
      activityId: id,
      activityName: a.name,
      activity: a,
      start: s.start,
      end: s.end,
      unit,
      total: unit * players,
    }));
  }).sort((a, b) => a.start.localeCompare(b.start));

  const subtotal = itemsArr.reduce((s, i) => s + i.total, 0);

  const submitPayment = async (method) => {
    setPayment({ method, status: 'processing' });
    await new Promise((r) => setTimeout(r, method === 'card' ? 2500 : 1000));
    setPayment({ method, status: 'success' });
    await new Promise((r) => setTimeout(r, 600));
    const booking = {
      id: 'MW-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      date,
      players,
      items: itemsArr.map((i) => ({ ...i, activityName: i.activityName })),
      subtotal,
      discount: 0,
      total: subtotal,
      paid: true,
      source: 'on_site',
      promoCode: null,
      packageId: null,
      customer: { name, email: '', phone },
      createdAt: new Date().toISOString(),
      staffId: staff?.id,
      staffName: staff?.name,
      paymentMethod: method === 'card' ? 'on_site_card' : 'on_site_cash',
    };
    await createBooking(booking);
    await logAudit({
      action: 'create_booking',
      entityType: 'booking',
      entityId: booking.id,
      notes: `Réservation sur place par ${staff?.name || 'staff'}`,
      after: { total: booking.total, method: booking.paymentMethod },
    });
    setConfirmed(booking);
    setStep('done');
  };

  if (confirmed && step === 'done') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-4xl shadow-neon-cyan">✓</div>
        <h1 className="section-title mb-2">Réservation enregistrée</h1>
        <div className="mb-6 text-white/60">Facture Odoo créée automatiquement (simulation)</div>
        <div className="mx-auto max-w-md rounded-2xl border border-mw-pink/40 bg-gradient-to-br from-mw-pink/10 to-transparent p-6 text-left">
          <div className="mb-3 flex justify-between">
            <div>
              <div className="text-xs text-white/50">N°</div>
              <div className="display font-mono text-mw-pink">{confirmed.id}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Total</div>
              <div className="display text-2xl">{confirmed.total}€</div>
            </div>
          </div>
          <div className="mb-3 text-sm">{confirmed.customer.name} · {confirmed.players} joueurs</div>
          <div className="space-y-1 text-xs text-white/60">
            {confirmed.items.map((i, idx) => <div key={idx}>· {i.activityName} @ {i.start}</div>)}
          </div>
          <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/50">
            Paiement : {confirmed.paymentMethod === 'on_site_card' ? '💳 Carte' : '💵 Espèces'} · Staff : {confirmed.staffName}
          </div>
        </div>
        <button
          onClick={() => {
            setConfirmed(null); setPayment(null); setStep('customer');
            setName(''); setPhone(''); setPlayers(2); setItems({}); setSlots({});
          }}
          className="btn-primary mt-6"
        >
          Nouvelle réservation sur place
        </button>
      </div>
    );
  }

  if (payment) {
    return <PaymentSimulation payment={payment} total={subtotal} onCancel={() => setPayment(null)} />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="section-title mb-1">Réservation sur place</h1>
      <p className="mb-6 text-sm text-white/60">
        Mode accueil — créez une réservation pour un client présent, encaissement direct.
      </p>

      {/* Customer */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 display text-sm">1. Client</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="input" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className="input" />
        </div>
      </div>

      {/* Players */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 display text-sm">2. Joueurs</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPlayers(Math.max(1, players - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl">−</button>
          <div className="w-12 text-center display text-3xl text-mw-pink">{players}</div>
          <button onClick={() => setPlayers(players + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl">+</button>
        </div>
      </div>

      {/* Activities */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 display text-sm">3. Activités</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {activities.filter((a) => a.bookable).map((a) => {
            const sel = !!items[a.id];
            return (
              <button
                key={a.id}
                onClick={() => toggleActivity(a.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                  sel ? 'border-mw-pink bg-mw-pink/10' : 'border-white/15 hover:border-white/40'
                }`}
              >
                <div className="relative h-10 w-10">
                  <Image src={a.logo} alt="" fill sizes="40px" className="object-contain" />
                </div>
                <div className="display text-[10px] text-white/80">{a.name}</div>
                <div className="text-[9px] text-mw-pink">{a.priceRegular}€</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {bookable.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 display text-sm">4. Créneaux</div>
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setSlots({}); }}
            className="input mb-3 max-w-xs"
          />
          {bookable.map((a) => {
            const needed = computeSessionsNeeded(a, players, items[a.id].quantity);
            const allSlots = generateSlotsForActivity(a, date);
            const selected = slots[a.id] || [];
            return (
              <div key={a.id} className="mb-3">
                <div className="mb-1 text-xs text-white/60">
                  {a.name} — {selected.length}/{needed} créneaux
                </div>
                <div className="flex flex-wrap gap-1">
                  {allSlots.slice(0, 30).map((slot) => {
                    const chosen = selected.some((s) => s.start === slot.start);
                    return (
                      <button
                        key={slot.start}
                        onClick={() => {
                          const cur = selected.slice();
                          const idx = cur.findIndex((s) => s.start === slot.start);
                          if (idx >= 0) cur.splice(idx, 1);
                          else if (cur.length < needed) cur.push(slot);
                          else { cur.shift(); cur.push(slot); }
                          setSlots({ ...slots, [a.id]: cur.sort((x, y) => x.start.localeCompare(y.start)) });
                        }}
                        className={`rounded border px-2 py-1 text-xs ${chosen ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/70 hover:border-white/40'}`}
                      >
                        {slot.start}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment */}
      {itemsArr.length > 0 && (
        <div className="rounded-2xl border border-mw-pink/30 bg-gradient-to-br from-mw-pink/10 to-transparent p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="display text-sm">5. Paiement</div>
            <div className="display text-3xl text-mw-pink">{subtotal.toFixed(2)}€</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => submitPayment('card')}
              disabled={!name || itemsArr.length === 0}
              className="btn-primary !py-4 disabled:opacity-30"
            >
              💳 Carte bancaire
            </button>
            <button
              onClick={() => submitPayment('cash')}
              disabled={!name || itemsArr.length === 0}
              className="btn-outline !py-4 disabled:opacity-30"
            >
              💵 Espèces
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-white/40">
            Simulation : aucune transaction réelle n'est effectuée. En prod, branchement Worldline/SumUp + caisse Odoo.
          </p>
        </div>
      )}
    </div>
  );
}

function PaymentSimulation({ payment, total, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-mw-pink/40 bg-mw-darker p-8 text-center shadow-neon-pink">
        {payment.method === 'card' ? (
          <>
            <div className="mb-4 text-6xl">💳</div>
            <div className="display mb-2 text-xl">Paiement par carte</div>
            {payment.status === 'processing' ? (
              <>
                <div className="text-sm text-white/60">Insérez ou approchez votre carte…</div>
                <div className="mt-4 flex items-center justify-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:0ms]"></span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:200ms]"></span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink [animation-delay:400ms]"></span>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto my-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/30 text-4xl">✓</div>
                <div className="display text-green-400">Paiement accepté</div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 text-6xl">💵</div>
            <div className="display mb-2 text-xl">Paiement espèces</div>
            {payment.status === 'processing' ? (
              <div className="text-sm text-white/60">Ouverture de la caisse enregistreuse Odoo…</div>
            ) : (
              <div className="display text-green-400">✓ Caisse ouverte</div>
            )}
          </>
        )}
        <div className="mt-6 display text-3xl text-mw-pink">{total.toFixed(2)}€</div>
        {payment.status === 'processing' && (
          <button onClick={onCancel} className="mt-4 text-xs text-white/50 hover:text-mw-red">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
