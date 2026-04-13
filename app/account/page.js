'use client';
import { useEffect, useState } from 'react';
import { useBooking } from '@/lib/store';

export default function AccountPage() {
  const { user, setUser, hydrated } = useBooking();
  const [bookings, setBookings] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (hydrated) {
      const b = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
      setBookings(b.filter((x) => !user || x.customer.email === user.email));
    }
  }, [hydrated, user]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-white/60">Chargement…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="section-title mb-2">Se connecter</h1>
        <p className="mb-6 text-white/60">Créez un compte pour retrouver vos réservations et factures. Optionnel pour réserver.</p>
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

  const totalSpent = bookings.reduce((s, b) => s + b.total, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">Bonjour {user.name.split(' ')[0]} 👋</h1>
          <p className="text-white/60">{user.email}</p>
        </div>
        <button onClick={() => setUser(null)} className="btn-outline text-sm">Déconnexion</button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Réservations" value={bookings.length} />
        <Stat label="Total dépensé" value={`${totalSpent.toFixed(2)}€`} />
        <Stat label="Membre depuis" value={new Date(user.createdAt).toLocaleDateString('fr-FR')} />
      </div>

      <h2 className="mb-4 text-xl font-bold">Historique des réservations</h2>
      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          Aucune réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.slice().reverse().map((b) => (
            <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-mw-pink">{b.id}</div>
                  <div className="text-xs text-white/60">
                    {new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {b.players} joueur(s)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black">{b.total.toFixed(2)}€</div>
                  <div className={`text-xs ${b.paid ? 'text-mw-pink' : 'text-mw-red'}`}>{b.paid ? 'Payé' : 'Impayé'}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.items.map((i, idx) => (
                  <span key={idx} className="chip">{i.activityName} · {i.start}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-black text-mw-pink">{value}</div>
    </div>
  );
}
