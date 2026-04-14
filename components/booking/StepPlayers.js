'use client';
import Image from 'next/image';
import { useBooking, computeSessionsNeeded } from '@/lib/store';
import { getActivity } from '@/lib/activities';

export default function StepPlayers() {
  const { cart, setPlayers } = useBooking();
  const activityIds = Object.keys(cart.items);
  const bookable = activityIds.map(getActivity).filter((a) => a && a.bookable);
  const absoluteMax = cart.packageMaxPlayers || 30;
  const minPlayers = cart.packageMinPlayers || 1;

  return (
    <div>
      <h1 className="section-title mb-2">Combien de joueurs ?</h1>
      <p className="mb-6 text-white/60">
        Ce nombre s'applique à toutes vos activités. Si votre groupe dépasse une capacité max, plusieurs créneaux seront automatiquement requis.
        {cart.packageMinPlayers && (
          <span className="ml-2 text-mw-pink">Package : min {cart.packageMinPlayers} personnes.</span>
        )}
      </p>
      <div className="mb-8 flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <button
          onClick={() => setPlayers(Math.max(minPlayers, cart.players - 1))}
          disabled={cart.players <= minPlayers}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold transition hover:border-mw-pink hover:text-mw-pink disabled:opacity-30"
          aria-label="Moins"
        >
          −
        </button>
        <div className="w-24 text-center">
          <div className="display text-7xl text-mw-pink">{cart.players}</div>
          <div className="text-xs uppercase tracking-wider text-white/50">joueur{cart.players > 1 ? 's' : ''}</div>
        </div>
        <button
          onClick={() => setPlayers(Math.min(absoluteMax, cart.players + 1))}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-3xl font-bold transition hover:border-mw-pink hover:text-mw-pink"
          aria-label="Plus"
        >
          +
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Répartition automatique</div>
        {bookable.map((a) => {
          const item = cart.items[a.id];
          const sessions = computeSessionsNeeded(a, cart.players, item.quantity);
          const autoExtra = sessions > item.quantity;
          return (
            <div key={a.id} className="flex items-center gap-3 py-1 text-sm">
              <div className="relative h-8 w-8 shrink-0 rounded-md border border-white/10 bg-black/40">
                <Image src={a.logo} alt="" fill className="object-contain p-1" sizes="32px" />
              </div>
              <div className="flex-1">
                <div className="display text-sm leading-none">{a.name}</div>
                <div className="text-[11px] text-white/50">max {a.maxPlayers} / partie</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-mw-pink">
                  {sessions} créneau{sessions > 1 ? 'x' : ''}
                </div>
                {autoExtra && <div className="text-[10px] text-mw-red">+{sessions - item.quantity} auto</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
