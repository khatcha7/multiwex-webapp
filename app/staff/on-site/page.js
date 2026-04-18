'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { activities, getActivityPrice } from '@/lib/activities';
import { generateSlotsForActivity, toDateStr } from '@/lib/hours';
import { createBooking, logAudit, getActiveStaff, getSlotOccupancy } from '@/lib/data';

export default function OnSiteBookingPage() {
  const today = toDateStr(new Date());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const date = today;
  // items = { activityId: [{ players, slot }] }  (une entrée = un créneau demandé)
  const [items, setItems] = useState({});
  const [occupancy, setOccupancy] = useState({});
  const [payment, setPayment] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [prefilled, setPrefilled] = useState(false);
  const staff = typeof window !== 'undefined' ? getActiveStaff() : null;

  // Pré-remplissage depuis le calendrier (sessionStorage)
  useEffect(() => {
    if (prefilled) return;
    try {
      const raw = sessionStorage.getItem('mw_onsite_prefill');
      if (raw) {
        const slotsToBook = JSON.parse(raw);
        sessionStorage.removeItem('mw_onsite_prefill');
        const newItems = {};
        slotsToBook.forEach((s) => {
          const a = activities.find((x) => x.id === s.activityId);
          if (!a) return;
          if (!newItems[s.activityId]) newItems[s.activityId] = [];
          newItems[s.activityId].push({
            players: a.minPlayers || 1,
            slot: { start: s.start, end: s.end },
          });
        });
        if (Object.keys(newItems).length > 0) {
          setItems(newItems);
          setPrefilled(true);
        }
      }
    } catch {}
  }, [prefilled]);

  useEffect(() => {
    // Charge occupation pour toutes les activités sélectionnées
    const load = async () => {
      const o = {};
      for (const id of Object.keys(items)) {
        const act = activities.find((a) => a.id === id);
        if (act) {
          const oc = await getSlotOccupancy(id, date);
          o[id] = oc;
        }
      }
      setOccupancy(o);
    };
    load();
  }, [items, date]);

  const toggleActivity = (id) => {
    const a = activities.find((x) => x.id === id);
    if (!a) return;
    setItems((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = [{ players: a.minPlayers || 2, slot: null }];
      return next;
    });
  };

  const addSession = (id) => {
    const a = activities.find((x) => x.id === id);
    setItems((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { players: a.minPlayers || 2, slot: null }],
    }));
  };

  const removeSession = (id, idx) => {
    setItems((prev) => {
      const arr = (prev[id] || []).slice();
      arr.splice(idx, 1);
      if (arr.length === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: arr };
    });
  };

  const setSessionPlayers = (id, idx, players) => {
    const a = activities.find((x) => x.id === id);
    const minP = a.minPlayers || 1;
    let maxP = a.maxPlayers;
    // Si un slot est déjà sélectionné, max = places restantes
    const cur = items[id]?.[idx];
    if (cur?.slot) {
      const occ = (occupancy[id] || {})[cur.slot.start];
      const playersInSlot = occ?.players || 0;
      if (a.privative && playersInSlot > 0) maxP = 0;
      else maxP = Math.min(a.maxPlayers, a.maxPlayers - playersInSlot);
    }
    const clamped = Math.min(Math.max(minP, players), Math.max(minP, maxP));
    setItems((prev) => {
      const arr = (prev[id] || []).slice();
      arr[idx] = { ...arr[idx], players: clamped };
      return { ...prev, [id]: arr };
    });
  };

  const setSessionRoom = (id, idx, roomId) => {
    const a = activities.find((x) => x.id === id);
    setItems((prev) => {
      const arr = (prev[id] || []).slice();
      const cur = arr[idx] || { players: a.minPlayers || 1 };
      let players = cur.players;
      if (a.rooms) {
        const room = a.rooms.find((r) => r.id === roomId);
        if (room) players = Math.min(Math.max(room.minPlayers || 1, players), room.maxPlayers);
      }
      arr[idx] = { ...cur, roomId, players };
      return { ...prev, [id]: arr };
    });
  };

  const setSessionSlot = (id, idx, slot) => {
    const a = activities.find((x) => x.id === id);
    const occ = (occupancy[id] || {})[slot.start];
    const playersInSlot = occ?.players || 0;
    // Clamp joueurs à la capacité restante
    setItems((prev) => {
      const arr = (prev[id] || []).slice();
      const cur = arr[idx] || { players: a.minPlayers || 1 };
      let maxAllowed = a.maxPlayers - playersInSlot;
      if (a.privative && playersInSlot > 0) return prev; // bloqué
      const newPlayers = Math.max(a.minPlayers || 1, Math.min(cur.players, Math.max(a.minPlayers || 1, maxAllowed)));
      arr[idx] = { ...cur, slot, players: newPlayers };
      return { ...prev, [id]: arr };
    });
  };

  const flat = Object.entries(items).flatMap(([id, arr]) => {
    const a = activities.find((x) => x.id === id);
    const unit = getActivityPrice(a, date);
    return arr
      .filter((s) => s.slot)
      .map((s) => ({
        activityId: id,
        activity: a,
        activityName: a.name,
        start: s.slot.start,
        end: s.slot.end,
        players: s.players,
        billedPlayers: Math.max(s.players, a.minPlayers || 1),
        unit,
        total: unit * Math.max(s.players, a.minPlayers || 1),
        roomId: s.roomId || null,
      }))
      .sort((x, y) => x.start.localeCompare(y.start));
  });

  const subtotal = flat.reduce((s, i) => s + i.total, 0);
  const allAssigned =
    Object.keys(items).length > 0 &&
    Object.entries(items).every(([id, arr]) => {
      const a = activities.find((x) => x.id === id);
      const needsRoom = a?.rooms && a.rooms.length > 0;
      return arr.every((s) => s.slot && (!needsRoom || s.roomId));
    });

  const submitPayment = async (method) => {
    setPayment({ method, status: 'processing' });
    await new Promise((r) => setTimeout(r, method === 'card' ? 2500 : 1000));
    setPayment({ method, status: 'success' });
    await new Promise((r) => setTimeout(r, 600));
    const booking = {
      id: 'MW-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      date,
      players: Math.max(...flat.map((i) => i.players), 0),
      items: flat,
      subtotal,
      discount: 0,
      total: subtotal,
      paid: true,
      source: 'on_site',
      customer: { firstName, lastName, name: `${firstName} ${lastName}`, email, phone, companyName: isCompany ? companyName : null, vatNumber: isCompany ? vatNumber : null },
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
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-4xl">✓</div>
        <h1 className="section-title mb-2">Enregistrée</h1>
        <div className="mb-6 text-white/60">Facture Odoo créée automatiquement (simulation)</div>
        <div className="mx-auto max-w-md rounded border border-mw-pink/40 bg-gradient-to-br from-mw-pink/10 to-transparent p-6 text-left">
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
          <div className="mb-3 text-sm">{confirmed.customer.name} · {confirmed.players} joueurs max</div>
          <div className="space-y-1 text-xs text-white/60">
            {confirmed.items.map((i, idx) => <div key={idx}>· {i.activityName} @ {i.start} ({i.players}j)</div>)}
          </div>
          <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/50">
            {confirmed.paymentMethod === 'on_site_card' ? '💳 Carte' : '💵 Espèces'} · Staff : {confirmed.staffName}
          </div>
        </div>
        <button
          onClick={() => { setConfirmed(null); setPayment(null); setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setItems({}); }}
          className="btn-primary mt-6"
        >
          Nouvelle réservation
        </button>
      </div>
    );
  }

  if (payment) return <PaymentSimulation payment={payment} total={subtotal} onCancel={() => setPayment(null)} />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="section-title mb-1">Réservation sur place</h1>
      <p className="mb-6 text-sm text-white/60">Mode accueil — créez une réservation pour un client présent, encaissement direct.</p>

      {/* Customer */}
      <div className="mb-4 rounded border border-white/10 bg-mw-surface p-4">
        <div className="mb-2 display text-sm">1. Client</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="input" />
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="input" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="input" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className="input" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="accent-mw-pink" />
          Entreprise (facture TVA)
        </label>
        {isCompany && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Raison sociale" className="input" />
            <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="N° TVA (ex: BE0123456789)" className="input" />
          </div>
        )}
      </div>

      {/* Activities */}
      <div className="mb-4 rounded border border-white/10 bg-mw-surface p-4">
        <div className="mb-2 display text-sm">2. Activités</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {activities.filter((a) => a.bookable).map((a) => {
            const sel = !!items[a.id];
            return (
              <button
                key={a.id}
                onClick={() => toggleActivity(a.id)}
                className={`flex flex-col items-center gap-1 rounded border p-2 transition ${
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

      {/* Sessions */}
      {Object.keys(items).length > 0 && (
        <div className="mb-4 rounded border border-white/10 bg-mw-surface p-4">
          <div className="mb-2 display text-sm">3. Créneaux & joueurs</div>
          {Object.entries(items).map(([id, arr]) => {
            const a = activities.find((x) => x.id === id);
            const allSlots = generateSlotsForActivity(a, date);
            const occ = occupancy[id] || {};
            return (
              <div key={id} className="mb-4 rounded bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="display flex items-center gap-2">
                    <div className="relative h-6 w-6">
                      <Image src={a.logo} alt="" fill sizes="24px" className="object-contain" />
                    </div>
                    {a.name}
                  </div>
                  <button onClick={() => addSession(id)} className="text-xs text-mw-pink hover:underline">
                    + Créneau
                  </button>
                </div>
                {arr.map((sess, idx) => (
                  <div key={idx} className="mb-2 rounded border border-white/10 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mw-pink text-[10px] font-bold text-white">{idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSessionPlayers(id, idx, sess.players - 1)} className="flex h-7 w-7 items-center justify-center rounded border border-white/20">−</button>
                          <span className="display w-7 text-center text-mw-pink">{sess.players}</span>
                          <button onClick={() => setSessionPlayers(id, idx, sess.players + 1)} className="flex h-7 w-7 items-center justify-center rounded border border-white/20">+</button>
                          <span className="ml-1 text-[10px] text-white/50">joueurs</span>
                        </div>
                      </div>
                      <button onClick={() => removeSession(id, idx)} className="text-xs text-mw-red">✕</button>
                    </div>
                    {a.rooms && a.rooms.length > 0 && (
                      <div className="mb-2">
                        <div className="mb-1 text-[10px] text-white/50">Choisir la salle / piste :</div>
                        <div className="flex flex-wrap gap-1.5">
                          {a.rooms.map((rm) => {
                            const selected = sess.roomId === rm.id;
                            const tooMany = sess.players > rm.maxPlayers;
                            return (
                              <button
                                key={rm.id}
                                onClick={() => setSessionRoom(id, idx, rm.id)}
                                disabled={tooMany}
                                className={`rounded border px-3 py-1.5 text-xs transition ${
                                  selected
                                    ? 'border-mw-pink bg-mw-pink/20 text-mw-pink'
                                    : tooMany
                                    ? 'cursor-not-allowed border-white/10 text-white/20 opacity-50'
                                    : 'border-white/20 text-white/70 hover:border-mw-pink'
                                }`}
                                title={tooMany ? `Max ${rm.maxPlayers} joueurs pour ${rm.name}` : ''}
                              >
                                <span className="display">{rm.name}</span>
                                <span className="ml-1 text-[9px] text-white/40">{rm.minPlayers}-{rm.maxPlayers}</span>
                              </button>
                            );
                          })}
                        </div>
                        {!sess.roomId && (
                          <div className="mt-1 text-[10px] text-mw-yellow">⚠ Choisir une salle / piste avant le créneau.</div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {allSlots.slice(0, 40).map((slot) => {
                        const chosen = sess.slot?.start === slot.start;
                        const occInfo = occ[slot.start];
                        const playersInSlot = occInfo?.players || 0;
                        const privative = a.privative;
                        const full = privative ? playersInSlot > 0 : playersInSlot >= a.maxPlayers;
                        const shared = !privative && playersInSlot > 0 && !full;
                        let cls = 'border-white/15 text-white/70 hover:border-white/40';
                        if (chosen) cls = 'border-mw-pink bg-mw-pink text-white';
                        else if (full) cls = 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30 line-through';
                        else if (shared) cls = 'border-mw-yellow/60 bg-mw-yellow/10 text-mw-yellow';
                        return (
                          <button
                            key={slot.start}
                            onClick={() => !full && setSessionSlot(id, idx, slot)}
                            disabled={full}
                            className={`relative rounded border px-2 py-1 text-xs ${cls}`}
                            title={shared ? `Libre: ${playersInSlot}/${a.maxPlayers}` : full ? 'Complet' : 'Libre'}
                          >
                            {slot.start}
                            {shared && <div className="text-[8px]">{playersInSlot}/{a.maxPlayers}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment */}
      {allAssigned && subtotal > 0 && (
        <div className="rounded border border-mw-pink/30 bg-gradient-to-br from-mw-pink/10 to-transparent p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="display text-sm">4. Paiement</div>
            <div className="display text-3xl text-mw-pink">{subtotal.toFixed(2)}€</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => submitPayment('card')} disabled={!firstName || !lastName} className="btn-primary !py-4 disabled:opacity-30">
              💳 Carte bancaire
            </button>
            <button onClick={() => submitPayment('cash')} disabled={!firstName || !lastName} className="btn-outline !py-4 disabled:opacity-30">
              💵 Espèces
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-white/40">Simulation — en prod, Worldline/SumUp + caisse Odoo POS.</p>
        </div>
      )}
    </div>
  );
}

function PaymentSimulation({ payment, total, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded border border-mw-pink/40 bg-mw-surface p-8 text-center shadow-neon-pink">
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
              <div className="text-sm text-white/60">Ouverture caisse Odoo…</div>
            ) : (
              <div className="display text-green-400">✓ Caisse ouverte</div>
            )}
          </>
        )}
        <div className="mt-6 display text-3xl text-mw-pink">{total.toFixed(2)}€</div>
        {payment.status === 'processing' && (
          <button onClick={onCancel} className="mt-4 text-xs text-white/50 hover:text-mw-red">Annuler</button>
        )}
      </div>
    </div>
  );
}
