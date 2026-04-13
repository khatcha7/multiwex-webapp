'use client';
import { activities } from '@/lib/activities';
import { useBooking } from '@/lib/store';
import ActivityLogoCard from '@/components/ActivityLogoCard';

export default function StepActivities() {
  const { cart, toggleActivity } = useBooking();
  return (
    <div>
      <h1 className="section-title mb-2">Choisissez vos activités</h1>
      <p className="mb-6 text-white/60">Sélectionnez une ou plusieurs activités. Le nombre de joueurs sera demandé à l'étape suivante.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {activities.map((a) => {
          const selected = cart.activityIds.includes(a.id);
          const external = !a.bookable && !a.walkIn;

          if (external) {
            return (
              <a key={a.id} href={a.external} target="_blank" rel="noopener" className="block">
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
    </div>
  );
}
