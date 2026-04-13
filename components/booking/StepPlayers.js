'use client';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';

export default function StepPlayers() {
  const { cart, setPlayers } = useBooking();
  const bookable = cart.activityIds.map(getActivity).filter((a) => a && a.bookable);
  const maxCap = Math.min(...bookable.map((a) => a.maxPlayers));

  return (
    <div>
      <h1 className="section-title mb-2">Combien de joueurs ?</h1>
      <p className="mb-6 text-white/60">
        Ce nombre s'applique à toutes vos activités. Capacité maximum autorisée&nbsp;: <span className="font-bold text-mw-cyan">{maxCap}</span>.
      </p>
      <div className="mb-8 flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <button
          onClick={() => setPlayers(Math.max(1, cart.players - 1))}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold transition hover:border-mw-cyan hover:text-mw-cyan"
          aria-label="Moins"
        >
          −
        </button>
        <div className="w-20 text-center">
          <div className="text-6xl font-black text-mw-cyan">{cart.players}</div>
          <div className="text-xs uppercase tracking-wider text-white/50">joueur{cart.players > 1 ? 's' : ''}</div>
        </div>
        <button
          onClick={() => setPlayers(Math.min(maxCap, cart.players + 1))}
          disabled={cart.players >= maxCap}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold transition hover:border-mw-cyan hover:text-mw-cyan disabled:opacity-30"
          aria-label="Plus"
        >
          +
        </button>
      </div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Capacités</div>
        {bookable.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span className="text-white/80">{a.name}</span>
            <span className={cart.players > a.maxPlayers ? 'text-mw-red' : 'text-white/60'}>max {a.maxPlayers}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
