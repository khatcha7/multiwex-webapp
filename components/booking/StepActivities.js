'use client';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import { useBooking } from '@/lib/store';
import ActivityLogoCard from '@/components/ActivityLogoCard';

export default function StepActivities() {
  const { cart, toggleActivity, setItemQuantity } = useBooking();
  return (
    <div>
      <h1 className="section-title mb-2">Vos activités</h1>
      <p className="mb-6 text-white/60">
        Sélectionnez vos activités. Vous pourrez ensuite préciser le nombre de parties désirées pour chacune.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {activities.map((a) => {
          const selected = !!cart.items[a.id];
          const external = !a.bookable && !a.walkIn;

          if (external) {
            return (
              <a key={a.id} href={a.external} target="_blank" rel="noopener noreferrer" className="block">
                <ActivityLogoCard activity={a} as="div" badge="Externe ↗" />
              </a>
            );
          }
          if (a.walkIn) {
            return <ActivityLogoCard key={a.id} activity={a} as="div" />;
          }
          return (
            <ActivityLogoCard
              key={a.id}
              activity={a}
              selected={selected}
              onClick={() => toggleActivity(a.id)}
            />
          );
        })}
      </div>

      {Object.keys(cart.items).length > 0 && (
        <div className="mt-8">
          <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Nombre de parties par activité</div>
          <div className="space-y-2">
            {Object.entries(cart.items).map(([id, item]) => {
              const a = activities.find((x) => x.id === id);
              if (!a) return null;
              return (
                <div key={id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="relative h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-black/40 p-1.5">
                    <Image src={a.logo} alt={a.name} fill className="object-contain p-1.5" sizes="48px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="display text-lg leading-none">{a.name}</div>
                    <div className="text-xs text-white/50">{a.duration} min · max {a.maxPlayers}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItemQuantity(id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-xl font-bold transition hover:border-mw-pink hover:text-mw-pink disabled:opacity-30"
                    >
                      −
                    </button>
                    <div className="w-8 text-center text-lg font-black text-mw-pink">{item.quantity}</div>
                    <button
                      onClick={() => setItemQuantity(id, item.quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-xl font-bold transition hover:border-mw-pink hover:text-mw-pink"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/40">
            💡 Si votre groupe dépasse la capacité max d'une activité, des créneaux additionnels seront automatiquement requis.
          </p>
        </div>
      )}
    </div>
  );
}
