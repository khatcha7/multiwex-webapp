'use client';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getRestrictions } from '@/lib/restrictions';

export default function StepSessions() {
  const { cart, setSessionPlayers } = useBooking();
  const activityIds = Object.keys(cart.items);
  const bookable = activityIds.map(getActivity).filter((a) => a && a.bookable);

  return (
    <div>
      <h1 className="section-title mb-2">Vos joueurs</h1>
      <p className="mb-6 text-white/60">
        Indiquez combien de joueurs participent à chaque créneau. Vous pouvez splitter votre groupe
        (ex&nbsp;: 3 enfants sur un créneau, 5 adultes sur un autre).
      </p>

      <div className="space-y-4">
        {bookable.map((a) => {
          const item = cart.items[a.id];
          const sessions = item?.sessions || [];
          const r = getRestrictions(a.id);
          return (
            <div key={a.id} className="rounded border border-white/10 bg-mw-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 rounded border border-white/10 bg-black/40">
                  <Image src={a.logo} alt={a.name} fill className="object-contain p-1.5" sizes="40px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="display text-lg leading-none">{a.name}</div>
                  <div className="text-[11px] text-white/50">
                    {a.duration} min · {a.minPlayers}-{a.maxPlayers} joueurs
                    {a.privative && <span className="ml-1 text-mw-yellow">· privatif</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {sessions.map((sess, idx) => {
                  const atMin = sess.players <= a.minPlayers;
                  const atMax = sess.players >= a.maxPlayers;
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded bg-white/[0.03] p-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mw-pink text-[11px] font-bold text-white">
                        {idx + 1}
                      </div>
                      <div className="display flex-1 text-sm text-white/70">Créneau {idx + 1}</div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSessionPlayers(a.id, idx, sess.players - 1)}
                          disabled={atMin}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
                        >
                          −
                        </button>
                        <div className="w-8 text-center display text-lg text-mw-pink">{sess.players}</div>
                        <button
                          onClick={() => setSessionPlayers(a.id, idx, sess.players + 1)}
                          disabled={atMax}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {a.minPlayers > 1 && (
                <p className="mt-2 text-[10px] text-mw-yellow">
                  ⚠ Minimum {a.minPlayers} joueurs — en dessous, le tarif minimum de {a.minPlayers} est appliqué.
                </p>
              )}
              {r?.disclaimerShort && (
                <p className="mt-1 text-[10px] text-white/50">{r.disclaimerShort}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
