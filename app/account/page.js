'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { listBookings, updateBooking, logAudit, getSlotOccupancy, getConfig } from '@/lib/data';
import { getActivity, getActivityPrice } from '@/lib/activities';
import { getPackage } from '@/lib/packages';

export default function AccountPage() {
  const { user, setUser, hydrated } = useBooking();
  const [bookings, setBookings] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(null);

  const [giftCards, setGiftCards] = useState([]);

  useEffect(() => {
    if (hydrated && user) {
      listBookings({ customerEmail: user.email }).then(setBookings);
      // Charger les cartes cadeaux de l'utilisateur
      const allCards = JSON.parse(localStorage.getItem('mw_giftcards') || '[]');
      setGiftCards(allCards.filter((gc) => gc.to_email === user.email));
    }
  }, [hydrated, user]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-white/60">Chargement…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="section-title mb-2">Se connecter</h1>
        <p className="mb-6 text-sm text-white/60">Créez un compte pour retrouver vos réservations.</p>
        <div className="space-y-3 rounded border border-white/10 bg-mw-surface p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Nom" />
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Prénom" />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Email" type="email" />
          <button
            onClick={() => firstName && lastName && email && setUser({ firstName, lastName, name: `${firstName} ${lastName}`, email, createdAt: new Date().toISOString() })}
            className="btn-primary w-full"
          >
            Continuer
          </button>
          <p className="text-center text-[10px] text-white/40">Démo — aucun mot de passe requis</p>
        </div>
      </div>
    );
  }

  const [filter, setFilter] = useState('upcoming'); // 'all', 'past', 'today', 'upcoming'
  const totalSpent = bookings.reduce((s, b) => s + (b.total || 0), 0);
  const displayName = user.firstName ? `${user.firstName}` : user.name?.split(' ')[0] || '';
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'past') return b.date < todayStr;
    if (filter === 'today') return b.date === todayStr;
    if (filter === 'upcoming') return b.date >= todayStr;
    return true;
  });

  const canModify = (b) => {
    const items = b.items || [];
    if (items.length === 0) return false;
    const firstStart = items[0]?.start || items[0]?.slot_start || '00:00';
    const when = new Date(`${b.date}T${firstStart}:00`);
    return (when - new Date()) / 3600000 >= 24;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">Bonjour {displayName}</h1>
          <p className="text-sm text-white/60">{user.email}</p>
        </div>
        <button onClick={() => setUser(null)} className="btn-outline !py-2 text-xs">Déconnexion</button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Réservations" value={bookings.length} />
        <Stat label="Total dépensé" value={`${totalSpent.toFixed(2)}€`} />
        <Stat label="Membre depuis" value={new Date(user.createdAt).toLocaleDateString('fr-FR')} />
      </div>

      {/* Cartes cadeaux */}
      {giftCards.length > 0 && (
        <div className="mb-8">
          <h2 className="display mb-3 text-2xl">Mes cartes cadeaux</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {giftCards.map((gc) => {
              const bal = gc.balance != null ? gc.balance : gc.amount;
              const empty = bal <= 0;
              return (
                <div key={gc.code} className={`rounded border p-4 ${empty ? 'border-white/5 opacity-40' : 'border-mw-pink/30 bg-gradient-to-br from-mw-pink/10 to-mw-surface'}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm text-mw-pink">{gc.code}</div>
                    <div className="display text-xl">{bal.toFixed(2)}€</div>
                  </div>
                  <div className="mt-1 text-[10px] text-white/50">
                    {gc.from_name && <>De {gc.from_name} · </>}
                    {empty ? 'Épuisée' : 'Disponible'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-2xl">Mes réservations</h2>
        <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
          {[
            ['upcoming', 'À venir'],
            ['today', "Aujourd'hui"],
            ['past', 'Passées'],
            ['all', 'Tout'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`display rounded px-3 py-1 text-xs ${filter === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}>{l}</button>
          ))}
        </div>
      </div>
      {filteredBookings.length === 0 ? (
        <div className="rounded border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          Aucune réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((b) => {
            const isFormula = Boolean(b.packageId);
            const pkg = isFormula ? getPackage(b.packageId) : null;
            const isPast = b.date < todayStr;
            const isToday = b.date === todayStr;
            return (
              <div key={b.id || b.reference} className={`rounded border p-4 transition ${isPast ? 'opacity-50' : ''} ${isFormula ? 'border-mw-pink/40 bg-gradient-to-r from-mw-pink/5 to-mw-surface' : 'border-white/10 bg-mw-surface'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-mw-pink">{b.id || b.reference}</div>
                      {isFormula && pkg && <span className="chip chip-pink text-[10px]">{pkg.name}</span>}
                      {isPast && <span className="chip text-[10px] text-white/40">Passée</span>}
                      {isToday && <span className="chip chip-pink text-[10px]">Aujourd'hui</span>}
                    </div>
                    <div className="display text-lg">
                      {new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-xs text-white/60">
                      {isFormula ? `${b.players || 0} participants · Formule ${pkg?.pricePerPerson || 0}€/pers` : `${b.players || 0} joueurs`}
                      {' · '}{(b.total || 0).toFixed(2)}€
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>{b.paid ? '✓ Payé' : 'Impayé'}</span>
                    {!isPast && canModify(b) && (
                      <button onClick={() => setEditing(b)} className="mt-2 block btn-outline !py-1.5 !px-3 text-xs">
                        + Joueurs
                      </button>
                    )}
                    {!isPast && !canModify(b) && (
                      <div className="mt-2 text-[10px] text-white/40">Modif. fermée (&lt;24h)</div>
                    )}
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(b.items || []).map((i, idx) => {
                    const act = getActivity(i.activityId || i.activity_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 rounded bg-white/[0.03] p-2 text-xs">
                        {act && (
                          <div className="relative h-6 w-6 shrink-0">
                            <Image src={act.logo} alt="" fill sizes="24px" className="object-contain" />
                          </div>
                        )}
                        <div className="display flex-1 truncate">{i.activityName || act?.name}</div>
                        <div className="text-white/50">{i.players || '?'} joueurs</div>
                        <div className="font-mono text-mw-pink">{i.start || i.slot_start}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Boutons PDF + Partager */}
                <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                  <button
                    onClick={() => {
                      const pdfName = getConfig('pdf.company_name') || 'MULTIWEX';
                      const pdfFooter = getConfig('pdf.footer') || '';
                      const pdfColor = getConfig('pdf.accent_color') || '#e8005a';
                      const w = window.open('', '_blank');
                      const items = (b.items || []).map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${i.activityName || ''}</td><td style="padding:8px;border-bottom:1px solid #eee;">${i.start || ''}</td><td style="padding:8px;border-bottom:1px solid #eee;">${i.players || '?'} joueurs</td></tr>`).join('');
                      w.document.write(`<!doctype html><html><head><title>Réservation ${b.id}</title><style>body{font-family:sans-serif;background:#fff;color:#000;padding:40px;max-width:600px;margin:0 auto}h1{color:${pdfColor};font-size:28px;letter-spacing:0.1em}h2{font-size:18px;color:#333}table{width:100%;border-collapse:collapse;margin:20px 0}td{text-align:left}.footer{margin-top:30px;padding-top:15px;border-top:2px solid ${pdfColor};font-size:11px;color:#888}</style></head><body><h1>${pdfName}</h1><h2>Réservation ${b.id || b.reference}</h2><p style="font-size:16px;">${new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><p>${b.players || 0} joueurs · <strong>${(b.total || 0).toFixed(2)}€</strong></p><table>${items}</table><div class="footer">${pdfFooter}</div></body></html>`);
                      w.document.close();
                      w.print();
                    }}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-mw-pink"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/invite/${b.id || b.reference}`;
                      const text = `On se retrouve au Multiwex !\n${new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n${(b.items || []).map((i) => `${i.activityName} à ${i.start}`).join('\n')}\n\nDétails : ${url}`;
                      if (navigator.share) {
                        navigator.share({ title: 'Invitation Multiwex', text, url });
                      } else {
                        navigator.clipboard.writeText(text);
                        alert('Lien d\'invitation copié !');
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-mw-pink"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Partager
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditModal
          booking={editing}
          onClose={() => setEditing(null)}
          onUpdated={async () => {
            const refreshed = await listBookings({ customerEmail: user.email });
            setBookings(refreshed);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditModal({ booking, onClose, onUpdated }) {
  // IMPORTANT: reset state à chaque ouverture (fix du bug de persistance)
  const [addPerSession, setAddPerSession] = useState({});
  const [checks, setChecks] = useState({});
  const [paymentStep, setPaymentStep] = useState(null);
  const isFormula = Boolean(booking.packageId);
  const pkg = isFormula ? getPackage(booking.packageId) : null;
  const [globalAdd, setGlobalAdd] = useState(0);

  // Reset state quand le booking change
  useEffect(() => {
    setAddPerSession({});
    setGlobalAdd(0);
    setPaymentStep(null);
    const load = async () => {
      const res = {};
      for (let i = 0; i < booking.items.length; i++) {
        const item = booking.items[i];
        const act = getActivity(item.activityId);
        if (!act) continue;
        const occ = await getSlotOccupancy(item.activityId, booking.date);
        const slotOcc = occ[item.start] || { players: 0 };
        const remainingCapacity = Math.max(0, act.maxPlayers - slotOcc.players);
        res[i] = {
          activityName: act.name,
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

  const extraTotal = isFormula
    ? globalAdd * (pkg?.pricePerPerson || 0)
    : Object.entries(addPerSession).reduce((s, [idx, extra]) => {
        const c = checks[idx];
        return s + (c ? c.unit * extra : 0);
      }, 0);

  const hasChanges = isFormula ? globalAdd > 0 : Object.values(addPerSession).some((v) => v > 0);

  const startPayment = () => {
    if (!hasChanges) return;
    setPaymentStep('choose');
  };

  const processPayment = async (method) => {
    setPaymentStep('processing');
    await new Promise((r) => setTimeout(r, 2000));
    setPaymentStep('success');
    await new Promise((r) => setTimeout(r, 800));

    // Appliquer les changements
    if (isFormula) {
      const newItems = booking.items.map((it) => ({
        ...it,
        players: (it.players || 0) + globalAdd,
      }));
      const updated = {
        ...booking,
        items: newItems,
        players: (booking.players || 0) + globalAdd,
        // Nouvelle facture = montant additionnel seulement
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
                  <div className="display mb-5 text-3xl text-mw-pink">{extraTotal.toFixed(2)}€</div>
                  <div className="grid gap-3">
                    <button onClick={() => processPayment('card')} className="btn-primary !py-4">💳 Carte bancaire</button>
                    <button onClick={() => processPayment('bancontact')} className="btn-outline !py-4">🇧🇪 Bancontact</button>
                  </div>
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

function Stat({ label, value }) {
  return (
    <div className="rounded border border-white/10 bg-mw-surface p-5">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="display mt-1 text-2xl text-mw-pink">{value}</div>
    </div>
  );
}
