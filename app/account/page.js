'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { listBookings, updateBooking, logAudit, getSlotOccupancy } from '@/lib/data';
import { getActivity } from '@/lib/activities';

export default function AccountPage() {
  const { user, setUser, hydrated } = useBooking();
  const [bookings, setBookings] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (hydrated && user) listBookings({ customerEmail: user.email }).then(setBookings);
  }, [hydrated, user]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-white/60">Chargement…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="section-title mb-2">Se connecter</h1>
        <p className="mb-6 text-sm text-white/60">Créez un compte pour retrouver vos réservations. Optionnel.</p>
        <div className="space-y-3 rounded border border-white/10 bg-mw-surface p-6">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nom complet" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Email" type="email" />
          <button
            onClick={() => name && email && setUser({ name, email, createdAt: new Date().toISOString() })}
            className="btn-primary w-full"
          >
            Continuer
          </button>
          <p className="text-center text-[10px] text-white/40">Démo — aucun mot de passe requis</p>
        </div>
      </div>
    );
  }

  const totalSpent = bookings.reduce((s, b) => s + (b.total || 0), 0);

  const canModify = (b) => {
    const when = new Date(`${b.date}T${b.items?.[0]?.start || '00:00'}:00`);
    const hoursBefore = (when - new Date()) / 3600000;
    return hoursBefore >= 24;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">Bonjour {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-white/60">{user.email}</p>
        </div>
        <button onClick={() => setUser(null)} className="btn-outline !py-2 text-xs">Déconnexion</button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Réservations" value={bookings.length} />
        <Stat label="Total dépensé" value={`${totalSpent.toFixed(2)}€`} />
        <Stat label="Membre depuis" value={new Date(user.createdAt).toLocaleDateString('fr-FR')} />
      </div>

      <h2 className="display mb-4 text-2xl">Mes réservations</h2>
      {bookings.length === 0 ? (
        <div className="rounded border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          Aucune réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.slice().reverse().map((b) => (
            <div key={b.id || b.reference} className="rounded border border-white/10 bg-mw-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-mw-pink">{b.id || b.reference}</div>
                  <div className="display text-lg">
                    {new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-xs text-white/60">max {b.players} joueurs · {(b.total || 0).toFixed(2)}€</div>
                </div>
                <div className="text-right">
                  <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>{b.paid ? '✓ Payé' : 'Impayé'}</span>
                  {canModify(b) ? (
                    <button
                      onClick={() => setEditing(b)}
                      className="mt-2 block btn-outline !py-1.5 !px-3 text-xs"
                    >
                      + Joueurs
                    </button>
                  ) : (
                    <div className="mt-2 text-[10px] text-white/40">Modification fermée</div>
                  )}
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {b.items?.map((i, idx) => {
                  const act = getActivity(i.activityId || i.activity_id);
                  return (
                    <div key={idx} className="flex items-center gap-2 rounded bg-white/[0.03] p-2 text-xs">
                      {act && (
                        <div className="relative h-6 w-6 shrink-0">
                          <Image src={act.logo} alt="" fill sizes="24px" className="object-contain" />
                        </div>
                      )}
                      <div className="display flex-1 truncate">{i.activityName || act?.name}</div>
                      <div className="text-white/50">{i.players || '?'}j</div>
                      <div className="font-mono text-mw-pink">{i.start || i.slot_start}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
  const [addPerSession, setAddPerSession] = useState({});
  const [checks, setChecks] = useState({});

  useEffect(() => {
    // Pour chaque item, vérifier si on peut ajouter des joueurs (capacité)
    const load = async () => {
      const res = {};
      for (let i = 0; i < booking.items.length; i++) {
        const item = booking.items[i];
        const act = getActivity(item.activityId);
        if (!act) continue;
        const occ = await getSlotOccupancy(item.activityId, booking.date);
        const slotOcc = occ[item.start] || { players: 0 };
        const remainingCapacity = act.privative ? 0 : Math.max(0, act.maxPlayers - slotOcc.players);
        res[i] = {
          activityName: act.name,
          logo: act.logo,
          start: item.start,
          current: item.players || 0,
          maxAdd: remainingCapacity,
          privative: act.privative,
        };
      }
      setChecks(res);
    };
    load();
  }, [booking]);

  const submit = async () => {
    const extras = Object.entries(addPerSession).filter(([, v]) => v > 0);
    if (extras.length === 0) return;
    // Valide que chaque ajout respecte la capacité
    for (const [idx, extra] of extras) {
      const c = checks[idx];
      if (!c) continue;
      if (c.privative) return alert(`${c.activityName} est une activité privative — impossible d'ajouter des joueurs après coup.`);
      if (extra > c.maxAdd) return alert(`${c.activityName} @ ${c.start} : ce créneau est complet ou il ne reste que ${c.maxAdd} places.`);
    }

    // Calcul du supplément
    let extraTotal = 0;
    const newItems = booking.items.map((it, i) => {
      const ex = addPerSession[i] || 0;
      if (ex > 0) extraTotal += (it.unit || 0) * ex;
      return { ...it, players: (it.players || 0) + ex };
    });
    const updated = {
      ...booking,
      items: newItems,
      players: Math.max(...newItems.map((i) => i.players || 0)),
      subtotal: (booking.subtotal || 0) + extraTotal,
      total: (booking.total || 0) + extraTotal,
    };
    await updateBooking(booking.id || booking.reference, updated);
    await logAudit({
      action: 'add_players',
      entityType: 'booking',
      entityId: booking.id || booking.reference,
      after: { extras, extraTotal },
    });
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-mw-pink/40 bg-mw-surface p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="display mb-2 text-2xl">Ajouter des joueurs</h2>
        <p className="mb-4 text-xs text-white/60">
          Vous pouvez uniquement <span className="text-white">ajouter</span> des joueurs (pas de remboursement).
          Jusqu'à 24h avant le créneau.
        </p>
        <div className="space-y-2">
          {booking.items.map((it, idx) => {
            const c = checks[idx];
            if (!c) return null;
            const extra = addPerSession[idx] || 0;
            const isFull = !c.privative && c.maxAdd === 0;
            return (
              <div key={idx} className={`rounded border p-3 ${isFull || c.privative ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="relative h-8 w-8 shrink-0">
                    <Image src={c.logo} alt="" fill sizes="32px" className="object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="display text-sm leading-none">{c.activityName}</div>
                    <div className="text-[10px] text-white/50">{c.start} · actuellement {c.current}j</div>
                  </div>
                </div>
                {c.privative ? (
                  <div className="text-[11px] text-mw-yellow">Activité privative — impossible d'ajouter après coup</div>
                ) : isFull ? (
                  <div className="text-[11px] text-mw-red">Complet — impossible d'ajouter sur ce créneau</div>
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
                    <span className="ml-auto text-[10px] text-mw-pink">+{((it.unit || 0) * extra).toFixed(0)}€</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1 !py-2 text-sm">Annuler</button>
          <button onClick={submit} disabled={Object.values(addPerSession).every((v) => !v)} className="btn-primary flex-1 !py-2 text-sm">
            Confirmer
          </button>
        </div>
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
