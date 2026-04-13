'use client';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import { useBooking } from '@/lib/store';

export default function StepActivities() {
  const { cart, toggleActivity } = useBooking();
  return (
    <div>
      <h1 className="section-title mb-2">Choisissez vos activités</h1>
      <p className="mb-6 text-white/60">Sélectionnez une ou plusieurs activités. Le nombre de joueurs sera demandé à l'étape suivante.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {activities.map((a) => {
          const selected = cart.activityIds.includes(a.id);
          const external = !a.bookable && !a.walkIn;

          if (external) {
            return (
              <a
                key={a.id}
                href={a.external}
                target="_blank"
                rel="noopener"
                className="card block"
              >
                <ActivityCardBody activity={a} selected={false} badge="Réservation externe ↗" />
              </a>
            );
          }
          if (a.walkIn) {
            return (
              <div key={a.id} className="card opacity-75">
                <ActivityCardBody activity={a} selected={false} badge="Sans réservation" />
              </div>
            );
          }
          return (
            <button
              key={a.id}
              onClick={() => toggleActivity(a.id)}
              className={`card text-left ${selected ? 'card-selected' : ''}`}
            >
              <ActivityCardBody activity={a} selected={selected} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCardBody({ activity, selected, badge }) {
  return (
    <>
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <Image src={activity.image} alt={activity.name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        {selected && (
          <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-mw-cyan text-lg font-black text-black shadow-neon-cyan">✓</div>
        )}
        {badge && (
          <div className="absolute right-3 top-3 rounded-full bg-mw-red/90 px-3 py-1 text-xs font-bold text-white">{badge}</div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-xl font-black text-white">{activity.name}</div>
          <div className="text-xs text-mw-cyan">{activity.tagline}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="line-clamp-2 text-xs text-white/60">{activity.description}</p>
        {activity.bookable && (
          <div className="shrink-0 text-right text-xs">
            <div className="font-bold text-white">{activity.priceRegular}€</div>
            <div className="text-mw-cyan">{activity.priceWed}€ mer.</div>
          </div>
        )}
      </div>
    </>
  );
}
