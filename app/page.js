import Link from 'next/link';
import { activities } from '@/lib/activities';
import ActivityLogoCard from '@/components/ActivityLogoCard';

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-mw-pink/20 via-transparent to-mw-cyan/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mw-pink/50 bg-mw-pink/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-mw-pink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink" /> Centre de loisirs indoor · Marche-en-Famenne
          </div>
          <h1 className="section-title text-white">
            Choisissez vos activités,<br />
            <span className="bg-gradient-to-r from-mw-pink to-mw-pink-2 bg-clip-text text-transparent">on s'occupe du reste.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
            Réservez plusieurs activités en quelques clics — vos créneaux s'enchaînent automatiquement sans conflits.
            Mercredi&nbsp;: jusqu'à <span className="font-bold text-mw-pink">-50%</span> sur toutes les activités.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className="btn-primary">Commencer la réservation →</Link>
            <a href="#activities" className="btn-outline">Voir les activités</a>
            <Link href="/giftcard" className="btn-outline">🎁 Carte cadeau</Link>
          </div>
        </div>
      </section>

      <section id="activities" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-black md:text-3xl">Nos activités</h2>
          <Link href="/booking" className="hidden text-sm font-medium text-mw-pink hover:underline md:block">Réserver →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {activities.map((a) => {
            const external = !a.bookable && !a.walkIn;
            if (external) {
              return (
                <a key={a.id} href={a.external} target="_blank" rel="noopener noreferrer" className="block">
                  <ActivityLogoCard activity={a} as="div" badge="Externe ↗" />
                </a>
              );
            }
            return <ActivityLogoCard key={a.id} activity={a} as="div" />;
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-mw-pink/30 bg-gradient-to-br from-mw-pink/15 to-transparent p-8 text-center md:p-10">
            <div className="mb-3 text-4xl">🎯</div>
            <h3 className="text-xl font-black md:text-2xl">Prêt à réserver&nbsp;?</h3>
            <p className="mt-2 text-sm text-white/70">Sélectionnez plusieurs activités et enchaînez sans conflit d'horaires.</p>
            <Link href="/booking" className="btn-primary mt-5">Réserver maintenant →</Link>
          </div>
          <div className="rounded-3xl border border-mw-cyan/30 bg-gradient-to-br from-mw-cyan/10 to-transparent p-8 text-center md:p-10">
            <div className="mb-3 text-4xl">🎁</div>
            <h3 className="text-xl font-black md:text-2xl">Offrez une carte cadeau</h3>
            <p className="mt-2 text-sm text-white/70">Montants de 20€, 50€ ou 100€ — livraison par email.</p>
            <Link href="/giftcard" className="btn-outline mt-5">Acheter une carte →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
