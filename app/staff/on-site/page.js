'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { activities, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';
import { generateSlotsForActivity, toDateStr, parseDate, isOpenOn, monthsFr, dayLabelsFr } from '@/lib/hours';
import { createBooking, logAudit, getActiveStaff, getSlotOccupancy, getSlotBlocks } from '@/lib/data';

export default function OnSiteBookingPage() {
  const today = toDateStr(new Date());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [date, setDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDate(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // items = { activityId: [{ players, slot }] }  (une entrée = un créneau demandé)
  const [items, setItems] = useState({});
  const [occupancy, setOccupancy] = useState({});
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    getSlotBlocks(date).then(setBlocks);
  }, [date]);
  const [payment, setPayment] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  // Add-ons sans créneau (BattleKart + Starcadium) — combinés avec les activités slot
  const [extras, setExtras] = useState({ battlekart: 0, starcadium: { qty: 0, amount: 10 } });
  const [prefilled, setPrefilled] = useState(false);
  const staff = typeof window !== 'undefined' ? getActiveStaff() : null;

  // Pré-remplissage depuis le calendrier (sessionStorage)
  useEffect(() => {
    if (prefilled) return;
    try {
      const raw = sessionStorage.getItem('mw_onsite_prefill');
      if (raw) {
        const parsed = JSON.parse(raw);
        sessionStorage.removeItem('mw_onsite_prefill');
        // Compat : ancien format = array de slots, nouveau = { date, slots }
        const slotsToBook = Array.isArray(parsed) ? parsed : (parsed.slots || []);
        if (parsed && parsed.date) {
          setDate(parsed.date);
          const dd = parseDate(parsed.date);
          setViewMonth({ year: dd.getFullYear(), month: dd.getMonth() });
        }
        const newItems = {};
        slotsToBook.forEach((s) => {
          const a = activities.find((x) => x.id === s.activityId);
          if (!a) return;
          if (!newItems[s.activityId]) newItems[s.activityId] = [];
          // Back-end : init à 1 joueur (pas le min activité, le staff peut juste ajouter 1 personne)
          newItems[s.activityId].push({
            players: 1,
            roomId: s.roomId || null,
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
    // Charge occupation par activité + par room (pour rooms multi)
    // Stocké { [activityId]: { [roomId|'_']: occMap } }
    const load = async () => {
      const o = {};
      for (const id of Object.keys(items)) {
        const act = activities.find((a) => a.id === id);
        if (!act) continue;
        o[id] = {};
        if (act.rooms?.length) {
          for (const rm of act.rooms) {
            // eslint-disable-next-line no-await-in-loop
            o[id][rm.id] = await getSlotOccupancy(id, date, rm.id);
          }
        } else {
          o[id]._ = await getSlotOccupancy(id, date);
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
      else next[id] = [{ players: 1, slot: null }];
      return next;
    });
  };

  const addSession = (id) => {
    const a = activities.find((x) => x.id === id);
    setItems((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { players: 1, slot: null }],
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
    // En back-end (sur place) : pas de min activité, juste 1 (staff peut ajouter 1 personne à un groupe)
    const minP = 1;
    // maxP = capacité de la room choisie si applicable, sinon max activité
    const cur = items[id]?.[idx];
    const room = (a.rooms || []).find((r) => r.id === cur?.roomId);
    let maxP = room?.maxPlayers || a.maxPlayers;
    if (cur?.slot) {
      const occMap = (occupancy[id] || {})[cur.roomId || '_'] || {};
      const occ = occMap[cur.slot.start];
      const playersInSlot = occ?.players || 0;
      const blocksHere = (blocks || []).filter((b) => b.activityId === id && b.start === cur.slot.start && (cur.roomId ? b.roomId === cur.roomId : true));
      const hasFullBlock = blocksHere.some((b) => b.seatsBlocked == null);
      const baseCap = room?.maxPlayers || a.maxPlayers;
      const seatsBlockedTotal = hasFullBlock ? baseCap : blocksHere.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
      const effectiveMax = Math.max(0, baseCap - seatsBlockedTotal);
      // Back-end staff peut joindre un groupe privatif tant qu'il reste de la place
      maxP = Math.max(0, effectiveMax - playersInSlot);
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
      const cur = arr[idx] || { players: 1 };
      let players = cur.players;
      if (a.rooms) {
        const room = a.rooms.find((r) => r.id === roomId);
        if (room) players = Math.min(Math.max(1, players), room.maxPlayers);
      }
      // Si le changement de room crée un conflit avec une autre session sur le même slot+room → reset le slot
      let newSlot = cur.slot;
      if (newSlot && arr.some((other, oIdx) => oIdx !== idx && other.slot?.start === newSlot.start && (other.roomId || null) === roomId)) {
        newSlot = null;
      }
      arr[idx] = { ...cur, roomId, players, slot: newSlot };
      return { ...prev, [id]: arr };
    });
  };

  const setSessionSlot = (id, idx, slot) => {
    const a = activities.find((x) => x.id === id);
    const cur = items[id]?.[idx];
    const room = (a.rooms || []).find((r) => r.id === cur?.roomId);
    const baseCap = room?.maxPlayers || a.maxPlayers;
    const occMap = (occupancy[id] || {})[cur?.roomId || '_'] || {};
    const occ = occMap[slot.start];
    const playersInSlot = occ?.players || 0;
    const blocksHere = (blocks || []).filter((b) => b.activityId === id && b.start === slot.start && (cur?.roomId ? b.roomId === cur.roomId : true));
    const hasFullBlock = blocksHere.some((b) => b.seatsBlocked == null);
    const seatsBlockedTotal = hasFullBlock ? baseCap : blocksHere.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
    const effectiveMax = Math.max(0, baseCap - seatsBlockedTotal);
    setItems((prev) => {
      const arr = (prev[id] || []).slice();
      const c = arr[idx] || { players: 1 };
      const maxAllowed = effectiveMax - playersInSlot;
      if (maxAllowed <= 0) return prev;
      // Min 1 en back-end (on garde le min activité que pour la facturation, pas la sélection)
      const newPlayers = Math.max(1, Math.min(c.players, Math.max(1, maxAllowed)));
      arr[idx] = { ...c, slot, players: newPlayers };
      return { ...prev, [id]: arr };
    });
  };

  const flat = Object.entries(items).flatMap(([id, arr]) => {
    const a = activities.find((x) => x.id === id);
    const unit = getActivityPrice(a, date);
    return arr
      .filter((s) => s.slot)
      .map((s) => {
        // Si le slot a déjà des joueurs (ajout à un groupe existant) → on facture le réel,
        // sinon (nouveau groupe) → facture au minimum activité.
        const occMap = (occupancy[id] || {})[s.roomId || '_'] || {};
        const playersAlready = (occMap[s.slot.start]?.players) || 0;
        const minBilling = playersAlready > 0 ? 1 : (a.minPlayers || 1);
        const billed = Math.max(s.players, minBilling);
        return {
          activityId: id,
          activity: a,
          activityName: a.name,
          start: s.slot.start,
          end: s.slot.end,
          players: s.players,
          billedPlayers: billed,
          unit,
          total: unit * billed,
          roomId: s.roomId || null,
        };
      })
      .sort((x, y) => x.start.localeCompare(y.start));
  });

  // Extras sans créneau (BattleKart, Starcadium) → ajoutés en items à la résa
  const battleKart = activities.find((a) => a.id === 'battlekart');
  const isWedToday = isWednesdayDiscount(date);
  const battleKartUnit = isWedToday ? (battleKart?.priceWed || 10) : (battleKart?.priceRegular || 19);
  const extraItems = [];
  if (extras.battlekart > 0) {
    extraItems.push({
      activityId: 'battlekart',
      activity: battleKart,
      activityName: 'BattleKart',
      start: null, end: null,
      players: extras.battlekart,
      billedPlayers: extras.battlekart,
      unit: battleKartUnit,
      total: battleKartUnit * extras.battlekart,
      roomId: null,
    });
  }
  if (extras.starcadium.qty > 0) {
    const stTotal = extras.starcadium.amount * extras.starcadium.qty;
    extraItems.push({
      activityId: 'starcadium',
      activity: activities.find((a) => a.id === 'starcadium'),
      activityName: `Starcadium — Carte ${extras.starcadium.amount}€`,
      start: null, end: null,
      players: extras.starcadium.qty,
      billedPlayers: extras.starcadium.qty,
      unit: extras.starcadium.amount,
      total: stTotal,
      roomId: null,
    });
  }
  const flatWithExtras = [...flat, ...extraItems];
  const subtotal = flatWithExtras.reduce((s, i) => s + i.total, 0);
  const hasExtras = extras.battlekart > 0 || extras.starcadium.qty > 0;
  const allAssigned =
    (Object.keys(items).length > 0 || hasExtras) &&
    Object.entries(items).every(([id, arr]) => {
      const a = activities.find((x) => x.id === id);
      const needsRoom = a?.rooms && a.rooms.length > 0;
      return arr.every((s) => s.slot && (!needsRoom || s.roomId));
    });

  const submitPayment = async (method) => {
    if (payment?.status === 'processing' || payment?.status === 'success') return; // Anti double-click
    setPayment({ method, status: 'processing' });
    await new Promise((r) => setTimeout(r, method === 'card' ? 2500 : 1000));
    setPayment({ method, status: 'success' });
    await new Promise((r) => setTimeout(r, 600));
    const booking = {
      id: 'MW-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
      date,
      players: Math.max(...flatWithExtras.map((i) => i.players), 0),
      items: flatWithExtras,
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
    // Envoie le mail de confirmation au client (si email présent) — await + log
    if (booking.customer?.email) {
      try {
        const r = await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(booking),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          console.warn('[mail on-site] failed — staff peut renvoyer depuis /staff/bookings', j.error);
        }
      } catch (e) { console.warn('send-confirmation on-site failed', e); }
    }
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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="section-title">Réservation sur place</h1>
        <button onClick={() => setQuickSaleOpen(true)} className="btn-outline !py-2 !px-4 text-xs whitespace-nowrap">
          ⚡ Vente rapide (BattleKart / Starcadium)
        </button>
      </div>
      <p className="mb-6 text-sm text-white/60">Mode accueil — créez une réservation pour un client présent, encaissement direct.</p>

      {quickSaleOpen && (
        <QuickSaleModal
          staff={staff}
          onClose={() => setQuickSaleOpen(false)}
          onConfirmed={(b) => { setQuickSaleOpen(false); setConfirmed(b); }}
        />
      )}

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

      {/* Date */}
      <div className="mb-4 rounded border border-white/10 bg-mw-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="display text-sm">Date {date === today && <span className="text-mw-pink text-xs">(aujourd'hui)</span>}</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const t = parseDate(today);
                const pm = new Date(viewMonth.year, viewMonth.month - 1, 1);
                if (pm < new Date(t.getFullYear(), t.getMonth(), 1)) return;
                setViewMonth({ year: pm.getFullYear(), month: pm.getMonth() });
              }}
              disabled={(() => { const t = parseDate(today); return viewMonth.year === t.getFullYear() && viewMonth.month === t.getMonth(); })()}
              className="flex h-8 w-8 items-center justify-center rounded border border-white/15 text-sm disabled:opacity-20"
            >←</button>
            <div className="display w-32 text-center text-sm">{monthsFr[viewMonth.month]} {viewMonth.year}</div>
            <button
              onClick={() => {
                const nm = new Date(viewMonth.year, viewMonth.month + 1, 1);
                setViewMonth({ year: nm.getFullYear(), month: nm.getMonth() });
              }}
              className="flex h-8 w-8 items-center justify-center rounded border border-white/15 text-sm hover:border-mw-pink hover:text-mw-pink"
            >→</button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {(() => {
            const todayStr = today;
            const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
            const days = [];
            for (let d = 1; d <= lastDay.getDate(); d++) {
              const ds = toDateStr(new Date(viewMonth.year, viewMonth.month, d));
              if (ds >= todayStr) days.push(ds);
            }
            return days.map((d) => {
              const dt = parseDate(d);
              const open = isOpenOn(d);
              const isWed = dt.getDay() === 3;
              const active = date === d;
              const isTodayD = todayStr === d;
              const disabled = !open;
              return (
                <button
                  key={d}
                  onClick={() => !disabled && setDate(d)}
                  disabled={disabled}
                  className={`relative shrink-0 rounded border px-3.5 py-2.5 text-center transition ${
                    active ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink' : 'border-white/15 bg-white/[0.03] hover:border-white/40'
                  } ${disabled ? 'cursor-not-allowed opacity-25' : ''}`}
                >
                  {isTodayD && !active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mw-pink" />}
                  <div className="text-[10px] font-bold uppercase opacity-80">{dayLabelsFr[dt.getDay()]}</div>
                  <div className="display text-xl leading-none">{dt.getDate()}</div>
                  {isWed && open && (
                    <div className={`mt-0.5 text-[9px] font-bold ${active ? 'text-white' : 'text-mw-pink'}`}>-50%</div>
                  )}
                </button>
              );
            });
          })()}
        </div>
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
                {arr.map((sess, idx) => {
                  // Capacité de la room choisie ou activité sans rooms
                  const sessRoom = (a.rooms || []).find((r) => r.id === sess.roomId);
                  const sessBaseCap = sessRoom?.maxPlayers || a.maxPlayers;
                  let sessEffectiveMax = sessBaseCap;
                  let sessSeatsBlocked = 0;
                  if (sess.slot) {
                    const sb = (blocks || []).filter((b) => b.activityId === id && b.start === sess.slot.start && (sess.roomId ? b.roomId === sess.roomId : true));
                    const fullB = sb.some((b) => b.seatsBlocked == null);
                    sessSeatsBlocked = fullB ? sessBaseCap : sb.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
                    const sessOccMap = (occ || {})[sess.roomId || '_'] || {};
                    const occInfo = sessOccMap[sess.slot.start];
                    const playersInSlot = occInfo?.players || 0;
                    sessEffectiveMax = Math.max(0, sessBaseCap - sessSeatsBlocked - playersInSlot);
                  }
                  const atMax = sess.players >= sessEffectiveMax;
                  const atMin = sess.players <= 1;
                  return (
                  <div key={idx} className="mb-2 rounded border border-white/10 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mw-pink text-[10px] font-bold text-white">{idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSessionPlayers(id, idx, sess.players - 1)} disabled={atMin} className="flex h-7 w-7 items-center justify-center rounded border border-white/20 disabled:opacity-30">−</button>
                          <span className="display w-7 text-center text-mw-pink">{sess.players}</span>
                          <button onClick={() => setSessionPlayers(id, idx, sess.players + 1)} disabled={atMax} className="flex h-7 w-7 items-center justify-center rounded border border-white/20 disabled:opacity-30" title={atMax ? `Max ${sessEffectiveMax}${sessSeatsBlocked ? ` (${sessSeatsBlocked} bloquées)` : ''}` : ''}>+</button>
                          <span className="ml-1 text-[10px] text-white/50">joueurs</span>
                          {sess.slot && sessSeatsBlocked > 0 && <span className="text-[9px] text-mw-red">🔒{sessSeatsBlocked}</span>}
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
                        // occ par room si applicable
                        const occMap = (occ || {})[sess.roomId || '_'] || {};
                        const occInfo = occMap[slot.start];
                        const playersInSlot = occInfo?.players || 0;
                        const privative = a.privative;
                        // Capacité max selon room sélectionnée
                        const room = (a.rooms || []).find((r) => r.id === sess.roomId);
                        const baseCap = room?.maxPlayers || a.maxPlayers;
                        // Blocs sur ce slot — filtrés par room si applicable
                        const blocksHere = (blocks || []).filter((b) => b.activityId === a.id && b.start === slot.start && (sess.roomId ? b.roomId === sess.roomId : true));
                        const hasFullBlock = blocksHere.some((b) => b.seatsBlocked == null);
                        const seatsBlockedTotal = hasFullBlock
                          ? baseCap
                          : blocksHere.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
                        const effectiveMax = Math.max(0, baseCap - seatsBlockedTotal);
                        // Conflit interne : autre session de la même résa déjà sur ce slot+room
                        const conflictWithOtherSession = arr.some((other, oIdx) => oIdx !== idx && other.slot?.start === slot.start && (other.roomId || null) === (sess.roomId || null));
                        // En back-end : staff peut joindre un groupe privatif tant qu'il y a de la place
                        const full = effectiveMax === 0 || playersInSlot >= effectiveMax || conflictWithOtherSession;
                        const partialBlock = !hasFullBlock && seatsBlockedTotal > 0;
                        // Jaune dès qu'il y a 1 joueur OU bloc partiel — y compris privatif (back-end)
                        const shared = (playersInSlot > 0 || partialBlock) && !full;
                        let cls = 'border-white/15 text-white/70 hover:border-white/40';
                        if (chosen) cls = 'border-mw-pink bg-mw-pink text-white';
                        else if (full) cls = 'cursor-not-allowed border-mw-red/30 bg-mw-red/10 text-white/30 line-through';
                        else if (shared) cls = 'border-mw-yellow/60 bg-mw-yellow/10 text-mw-yellow';
                        if (partialBlock && !chosen) cls += ' !border-mw-red border-2';
                        return (
                          <button
                            key={slot.start}
                            onClick={() => !full && setSessionSlot(id, idx, slot)}
                            disabled={full}
                            className={`relative rounded border px-2 py-1 text-xs ${cls}`}
                            title={conflictWithOtherSession ? 'Déjà sélectionné par un autre créneau de cette résa' : shared ? `Libre: ${effectiveMax - playersInSlot}/${baseCap}` : full ? 'Complet' : 'Libre'}
                          >
                            {slot.start}
                            {shared && <div className="text-[8px]">{playersInSlot + seatsBlockedTotal}/{baseCap}{partialBlock ? ` 🔒${seatsBlockedTotal}` : ''}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Vente directe — BattleKart + Starcadium (sans créneau) */}
      <div className="mb-4 rounded border border-white/10 bg-mw-surface p-4">
        <div className="mb-2 display text-sm">3. Vente directe (sans créneau)</div>
        <p className="mb-3 text-[11px] text-white/50">Optionnel — combiné au panier ci-dessus, un seul paiement.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* BattleKart */}
          <div className="rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="display text-sm">🏎 BattleKart</div>
                <div className="text-[10px] text-white/50">{battleKartUnit}€/joueur {isWedToday && <span className="text-mw-yellow">⚡ Mer -50%</span>}</div>
              </div>
              <div className="text-right text-mw-pink display">{(battleKartUnit * extras.battlekart).toFixed(2)}€</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExtras({ ...extras, battlekart: Math.max(0, extras.battlekart - 1) })} className="flex h-8 w-8 items-center justify-center rounded border border-white/20">−</button>
              <input
                type="number"
                min="0"
                max="50"
                value={extras.battlekart}
                onChange={(e) => setExtras({ ...extras, battlekart: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                className="input !py-1 w-16 text-center"
              />
              <button onClick={() => setExtras({ ...extras, battlekart: Math.min(50, extras.battlekart + 1) })} className="flex h-8 w-8 items-center justify-center rounded border border-white/20">+</button>
              <span className="text-xs text-white/50">joueur(s)</span>
            </div>
          </div>

          {/* Starcadium */}
          <div className="rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="display text-sm">🕹 Starcadium</div>
                <div className="text-[10px] text-white/50">Carte arcade</div>
              </div>
              <div className="text-right text-mw-pink display">{(extras.starcadium.amount * extras.starcadium.qty).toFixed(2)}€</div>
            </div>
            <div className="mb-2 flex gap-1">
              {[5, 10, 20, 50].map((a) => (
                <button
                  key={a}
                  onClick={() => setExtras({ ...extras, starcadium: { ...extras.starcadium, amount: a } })}
                  className={`flex-1 rounded border py-1 text-xs transition ${extras.starcadium.amount === a ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/70 hover:border-mw-pink'}`}
                >
                  {a}€
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExtras({ ...extras, starcadium: { ...extras.starcadium, qty: Math.max(0, extras.starcadium.qty - 1) } })} className="flex h-8 w-8 items-center justify-center rounded border border-white/20">−</button>
              <input
                type="number"
                min="0"
                max="20"
                value={extras.starcadium.qty}
                onChange={(e) => setExtras({ ...extras, starcadium: { ...extras.starcadium, qty: Math.max(0, Math.min(20, Number(e.target.value) || 0)) } })}
                className="input !py-1 w-16 text-center"
              />
              <button onClick={() => setExtras({ ...extras, starcadium: { ...extras.starcadium, qty: Math.min(20, extras.starcadium.qty + 1) } })} className="flex h-8 w-8 items-center justify-center rounded border border-white/20">+</button>
              <span className="text-xs text-white/50">carte(s)</span>
            </div>
          </div>
        </div>
      </div>

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

// ====================================================================
// VENTE RAPIDE (BattleKart + Starcadium — pas de slot, juste qty × prix)
// ====================================================================
function QuickSaleModal({ staff, onClose, onConfirmed }) {
  const [type, setType] = useState('battlekart'); // 'battlekart' | 'starcadium'
  const [qty, setQty] = useState(1);
  const [starcadiumAmount, setStarcadiumAmount] = useState(10);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paying, setPaying] = useState(false);

  const STARCADIUM_AMOUNTS = [5, 10, 20, 50];
  const battleKart = activities.find((a) => a.id === 'battlekart');
  const isWed = isWednesdayDiscount(toDateStr(new Date()));
  // BattleKart : prix automatique selon jour (pas modifiable par staff)
  const battleKartPrice = isWed ? (battleKart?.priceWed || 10) : (battleKart?.priceRegular || 19);

  // Total
  const total = type === 'battlekart' ? battleKartPrice * qty : starcadiumAmount * qty;

  const buildBookingItems = () => {
    if (type === 'battlekart') {
      return [{
        activityId: 'battlekart',
        activityName: 'BattleKart',
        roomId: null,
        start: null,
        end: null,
        players: qty,
        billedPlayers: qty,
        unit: battleKartPrice,
        total: total,
      }];
    } else {
      return [{
        activityId: 'starcadium',
        activityName: `Starcadium — Carte ${starcadiumAmount}€`,
        roomId: null,
        start: null,
        end: null,
        players: qty,
        billedPlayers: qty,
        unit: starcadiumAmount,
        total: total,
      }];
    }
  };

  const submit = async (method) => {
    if (paying) return;
    if (qty < 1) return alert('Quantité invalide');
    if (total <= 0) return alert('Total invalide');

    setPaying(true);
    try {
      const ref = 'MW-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      const booking = {
        id: ref,
        date: toDateStr(new Date()),
        players: qty,
        items: buildBookingItems(),
        subtotal: total,
        discount: 0,
        total,
        paid: method !== 'card', // Cash + test → paid immédiatement, viva → après webhook
        source: 'on_site',
        kind: 'quick_sale',
        customer: {
          name: customerName || 'Client comptoir',
          email: customerEmail || null,
          firstName: customerName.split(' ')[0] || 'Client',
          lastName: customerName.split(' ').slice(1).join(' ') || 'Comptoir',
        },
        createdAt: new Date().toISOString(),
        staffId: staff?.id,
        staffName: staff?.name,
        paymentMethod: method === 'card' ? 'on_site_viva_wallet' : method === 'test' ? 'on_site_test' : 'on_site_cash',
      };

      await createBooking(booking);
      await logAudit({
        action: 'create_quick_sale',
        entityType: 'booking',
        entityId: ref,
        notes: `Vente rapide ${type} par ${staff?.name || 'staff'} (${method})`,
        after: { type, total, qty, method },
      });

      // VivaWallet → crée ordre + redirect terminal staff (ou popup)
      if (method === 'card') {
        const r = await fetch('/api/payment/viva/create-order', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            bookingRef: ref,
            amount: total,
            customer: { email: booking.customer.email || '', name: booking.customer.name, country: 'BE' },
            merchantTrns: ref,
            customerTrns: `Multiwex — Vente rapide ${type}`,
          }),
        });
        const j = await r.json();
        if (!j.ok || !j.checkoutUrl) {
          throw new Error(j.error || 'Erreur création ordre VivaWallet');
        }
        // Ouvre dans nouvel onglet pour pas perdre le contexte staff
        window.open(j.checkoutUrl, '_blank');
        alert(`Lien de paiement VivaWallet ouvert dans un nouvel onglet.\nRéf : ${ref}\n\nUne fois payé, le statut sera mis à jour automatiquement.`);
        onConfirmed(booking);
        return;
      }

      // Cash + test : mail confirmation immédiate si email fourni
      if (booking.customer?.email) {
        fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(booking),
        }).catch(() => {});
      }

      onConfirmed(booking);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setPaying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded border border-mw-pink/40 bg-mw-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">⚡ Vente rapide</h2>
          <button onClick={onClose} className="text-xl text-white/50 hover:text-white">✕</button>
        </div>

        {/* Type */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setType('battlekart'); setUnitPrice(battleKartPrice); }}
            className={`rounded border p-4 transition ${type === 'battlekart' ? 'border-mw-pink bg-mw-pink/10' : 'border-white/15 hover:border-mw-pink/50'}`}
          >
            <div className="display text-sm">🏎 BattleKart</div>
            <div className="mt-1 text-xs text-white/50">Tour: {battleKartPrice}€{isWed && ' (mer)'}</div>
          </button>
          <button
            onClick={() => setType('starcadium')}
            className={`rounded border p-4 transition ${type === 'starcadium' ? 'border-mw-pink bg-mw-pink/10' : 'border-white/15 hover:border-mw-pink/50'}`}
          >
            <div className="display text-sm">🕹 Starcadium</div>
            <div className="mt-1 text-xs text-white/50">Carte arcade</div>
          </button>
        </div>

        {/* BattleKart fields — prix fixé par règles métier (auto mer) */}
        {type === 'battlekart' && (
          <div className="mb-4">
            <div className="mb-2 rounded border border-white/10 bg-white/[0.02] p-3 text-xs">
              <div className="text-white/50">Tarif appliqué</div>
              <div className="display text-mw-pink">{battleKartPrice} € / joueur</div>
              {isWed && <div className="mt-1 text-[10px] text-mw-yellow">⚡ Tarif mercredi auto -50%</div>}
            </div>
            <div>
              <div className="mb-1 text-xs text-white/50">Nombre de joueurs</div>
              <input type="number" min="1" max="50" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" />
            </div>
          </div>
        )}

        {/* Starcadium fields */}
        {type === 'starcadium' && (
          <>
            <div className="mb-3">
              <div className="mb-2 text-xs text-white/50">Montant carte</div>
              <div className="grid grid-cols-4 gap-2">
                {STARCADIUM_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setStarcadiumAmount(a)}
                    className={`rounded border py-3 text-center font-bold transition ${starcadiumAmount === a ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/80 hover:border-mw-pink'}`}
                  >
                    {a}€
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="mb-1 text-xs text-white/50">Quantité de cartes</div>
              <input type="number" min="1" max="20" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" />
            </div>
          </>
        )}

        {/* Customer (optional) */}
        <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 text-xs text-white/50">Client (optionnel — pour reçu mail)</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom (optionnel)" className="input" />
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email (optionnel)" type="email" className="input" />
          </div>
        </div>

        {/* Total */}
        <div className="mb-4 rounded border border-mw-pink/40 bg-mw-pink/5 p-4 text-center">
          <div className="text-xs text-white/50">TOTAL À ENCAISSER</div>
          <div className="display text-3xl text-mw-pink">{total.toFixed(2)} €</div>
        </div>

        {/* Payment buttons */}
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => submit('card')}
            disabled={paying || total <= 0}
            className="btn-primary !py-3 text-sm disabled:opacity-30"
          >
            {paying ? 'Traitement…' : '💳 VivaWallet (carte)'}
          </button>
          <button
            onClick={() => submit('cash')}
            disabled={paying || total <= 0}
            className="btn-outline !py-3 text-sm disabled:opacity-30"
          >
            💵 Cash
          </button>
          <button
            onClick={() => submit('test')}
            disabled={paying || total <= 0}
            className="rounded border border-mw-yellow/40 bg-mw-yellow/5 py-3 text-xs text-mw-yellow hover:bg-mw-yellow/10 disabled:opacity-30"
          >
            🧪 Bypass test (gratuit, pour démo)
          </button>
        </div>
      </div>
    </div>
  );
}
