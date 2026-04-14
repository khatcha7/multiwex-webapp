import Link from 'next/link';
import Image from 'next/image';
import { activities } from '@/lib/activities';
import ActivityLogoCard from '@/components/ActivityLogoCard';
import FlashBanner from '@/components/FlashBanner';

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-mw-hero" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mw-pink/50 bg-mw-pink/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-mw-pink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mw-pink" /> Marche-en-Famenne · 6000m²
          </div>
          <h1 className="section-title text-white">
            Choisissez vos activités,<br />
            <span className="bg-gradient-to-r from-mw-red to-mw-pink bg-clip-text text-transparent">on s'occupe du reste.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
            Réservez plusieurs activités en quelques clics — vos créneaux s'enchaînent automatiquement sans conflits.
            Mercredi&nbsp;: jusqu'à <span className="font-bold text-mw-pink">-50%</span> sur toutes les activités.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className="btn-primary">Commencer la réservation →</Link>
            <Link href="/packages" className="btn-outline">Packages groupes</Link>
            <Link href="/giftcard" className="btn-outline">🎁 Carte cadeau</Link>
          </div>
        </div>
      </section>

      <FlashBanner />

      <section id="activities" className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="section-title">Nos activités</h2>
          <Link href="/booking" className="hidden text-sm font-bold text-mw-pink hover:underline md:block">Réserver →</Link>
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

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-mw-pink/30 bg-gradient-to-br from-mw-pink/15 to-transparent p-8 text-center md:p-10">
            <div className="mb-3 text-4xl">🎯</div>
            <h3 className="display text-xl md:text-2xl">Réserver</h3>
            <p className="mt-2 text-sm text-white/70">Multi-activités sans conflits d'horaires.</p>
            <Link href="/booking" className="btn-primary mt-5">Je réserve →</Link>
          </div>
          <div className="rounded-3xl border border-mw-red/30 bg-gradient-to-br from-mw-red/15 to-transparent p-8 text-center md:p-10">
            <div className="mb-3 text-4xl">🎁</div>
            <h3 className="display text-xl md:text-2xl">Carte cadeau</h3>
            <p className="mt-2 text-sm text-white/70">20€, 50€, 100€ ou montant libre.</p>
            <Link href="/giftcard" className="btn-outline mt-5">Offrir →</Link>
          </div>
          <div className="rounded-3xl border border-mw-cyan/30 bg-gradient-to-br from-mw-cyan/10 to-transparent p-8 text-center md:p-10">
            <div className="mb-3 text-4xl">👥</div>
            <h3 className="display text-xl md:text-2xl">Packages</h3>
            <p className="mt-2 text-sm text-white/70">Anniversaire · EVG · EVJF · Team building</p>
            <Link href="/packages" className="btn-outline mt-5">Voir →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
