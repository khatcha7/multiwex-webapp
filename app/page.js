import Link from 'next/link';
import Image from 'next/image';
import { activities } from '@/lib/activities';

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mw-cyan/40 bg-mw-cyan/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-mw-cyan">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mw-cyan" /> Centre de loisirs indoor
          </div>
          <h1 className="section-title text-white">
            Choisissez vos activités,<br />
            <span className="bg-gradient-to-r from-mw-cyan to-white bg-clip-text text-transparent">on s'occupe du reste.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
            Réservez plusieurs activités en quelques clics — vos créneaux s'enchaînent automatiquement sans conflits.
            Mercredi&nbsp;: jusqu'à <span className="font-bold text-mw-cyan">-50%</span> sur toutes les activités.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className="btn-primary">Commencer la réservation →</Link>
            <a href="#activities" className="btn-outline">Voir les activités</a>
          </div>
        </div>
      </section>

      <section id="activities" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-black md:text-3xl">Nos activités</h2>
          <Link href="/booking" className="hidden text-sm font-medium text-mw-cyan hover:underline md:block">Réserver →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a) => (
            <div key={a.id} className="card group">
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image src={a.image} alt={a.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div>
                    <div className="text-xl font-black text-white drop-shadow">{a.name}</div>
                    <div className="text-xs text-mw-cyan">{a.tagline}</div>
                  </div>
                  {a.bookable && (
                    <div className="rounded-lg bg-black/60 px-2 py-1 text-right text-xs text-white backdrop-blur">
                      <div className="font-bold">{a.priceRegular}€</div>
                      <div className="text-mw-cyan">{a.priceWed}€ mer.</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="mb-3 text-sm text-white/70">{a.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.bookable && <span className="chip chip-cyan">{a.duration} min</span>}
                  {a.maxPlayers > 0 && a.bookable && <span className="chip">Max {a.maxPlayers}</span>}
                  {a.walkIn && <span className="chip">Sans réservation</span>}
                  {!a.bookable && !a.walkIn && <span className="chip chip-red">Réservation externe</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl border border-mw-cyan/30 bg-gradient-to-br from-mw-cyan/10 to-transparent p-8 text-center md:p-12">
          <h3 className="text-2xl font-black md:text-3xl">Prêt à réserver&nbsp;?</h3>
          <p className="mt-2 text-white/70">Sélectionnez plusieurs activités et bénéficiez d'un parcours enchaîné sans conflits d'horaires.</p>
          <Link href="/booking" className="btn-primary mt-6">Réserver maintenant →</Link>
        </div>
      </section>
    </div>
  );
}
