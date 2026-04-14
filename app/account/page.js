'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { listBookings, updateBooking, logAudit } from '@/lib/data';
import { getActivity } from '@/lib/activities';

export default function AccountPage() {
  const { user, setUser, hydrated } = useBooking();
  const [bookings, setBookings] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(null);
  const [extraPlayers, setExtraPlayers] = useState(0);

  useEffect(() => {
    if (hydrated && user) {
      listBookings({ customerEmail: user.email }).then(setBookings);
    }
  }, [hydrated, user]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-white/60">Chargement…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="section-title mb-2">Se connecter</h1>
        <p className="mb-6 text-sm text-white/60">Créez un compte pour retrouver vos réservations. Optionnel pour réserver.</p>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nom complet" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Email" type="email" />
          <button
            onClick={() => name && email && setUser({ name, email, createdAt: new Date().toISOString() })}
            className="btn-primary w-full"
          >
            Continuer
          </button>
          <p className="text-center text-xs text-white/40">Démo — aucun mot de passe requis</p>
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

  const submitAddPlayers = async () => {
    if (!editing || extraPlayers <= 0) return;
    const newPlayers = editing.players + extraPlayers;
    const unitTotal = editing.items.reduce((s, i) => s + i.unit * extraPlayers, 0);
    const updated = {
      ...editing,
      players: newPlayers,
      items: editing.items.map((i) => ({ ...i, total: i.unit * newPlayers })),
      subtotal: (editing.subtotal || 0) + unitTotal,
      total: (editing.total || 0) + unitTotal,
    };
    await updateBooking(editing.id || editing.reference, updated);
    await logAudit({
      action: 'add_players',
      entityType: 'booking',
      entityId: editing.id || editing.reference,
      before: { players: editing.players },
      after: { players: newPlayers, added: extraPlayers },
    });
    const refreshed = await listBookings({ customerEmail: user.email });
    setBookings(refreshed);
    setEditing(null);
    setExtraPlayers(0);
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          Aucune réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.slice().reverse().map((b) => (
            <div key={b.id || b.reference} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-mw-pink">{b.id || b.reference}</div>
                  <div className="display text-lg">
                    {new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-xs text-white/60">{b.players} joueurs · {(b.total || 0).toFixed(2)}€</div>
                </div>
                <div className="text-right">
                  <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>{b.paid ? '✓ Payé' : 'Impayé'}</span>
                  {canModify(b) ? (
                    <button
                      onClick={() => setEditing(b)}
                      className="mt-2 block btn-outline !py-1.5 text-xs"
                    >
                      + Ajouter joueurs
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
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 text-xs">
                      {act && (
                        <div className="relative h-6 w-6 shrink-0">
                          <Image src={act.logo} alt="" fill sizes="24px" className="object-contain" />
                        </div>
                      )}
                      <div className="display truncate">{i.activityName || act?.name}</div>
                      <div className="ml-auto font-mono text-mw-pink">{i.start || i.slot_start}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl border border-mw-pink/40 bg-mw-darker p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="display mb-2 text-2xl">Ajouter des joueurs</h2>
            <p className="mb-4 text-xs text-white/60">
              Vous pouvez uniquement <span className="text-white">ajouter</span> des joueurs (pas de remboursement).
              Modifications possibles jusqu'à 24h avant le créneau.
            </p>
            <div className="mb-4 rounded-xl bg-white/5 p-3 text-sm">
              <div className="font-mono text-xs text-mw-pink">{editing.id || editing.reference}</div>
              <div className="text-white/60">Actuellement {editing.players} joueurs</div>
            </div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <button onClick={() => setExtraPlayers(Math.max(0, extraPlayers - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl">−</button>
              <div className="w-16 text-center">
                <div className="display text-3xl text-mw-pink">+{extraPlayers}</div>
                <div className="text-[10px] text-white/50">joueurs</div>
              </div>
              <button onClick={() => setExtraPlayers(extraPlayers + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl">+</button>
            </div>
            <div className="mb-4 text-center text-sm">
              <div className="text-white/60">Supplément à payer</div>
              <div className="display text-2xl text-mw-pink">
                {(editing.items.reduce((s, i) => s + i.unit, 0) * extraPlayers).toFixed(2)}€
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="btn-outline flex-1 !py-2.5 text-sm">Annuler</button>
              <button onClick={submitAddPlayers} disabled={extraPlayers === 0} className="btn-primary flex-1 !py-2.5 text-sm">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="display mt-1 text-2xl text-mw-pink">{value}</div>
    </div>
  );
}
