'use client';
import Link from 'next/link';
import { packages } from '@/lib/packages';
import { getActivity } from '@/lib/activities';
import Image from 'next/image';

const CATEGORIES = [
  { id: 'birthday', label: 'Anniversaire' },
  { id: 'bachelor', label: 'EVG / EVJF' },
  { id: 'corporate', label: 'Entreprises' },
  { id: 'school', label: 'Écoles' },
  { id: 'youth', label: 'Jeunesse' },
];

export default function PackagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-14">
      <div className="mb-10">
        <h1 className="section-title mb-2">Packages & Groupes</h1>
        <p className="text-white/60">
          Des formules préétablies pour les anniversaires, enterrements de vie, team building et groupes.
          <br className="hidden md:block" />
          Les packages avec BattleKart nécessitent une réservation séparée via battlekart.com.
        </p>
      </div>

      {CATEGORIES.map((cat) => {
        const items = packages.filter((p) => p.category === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id} className="mb-10">
            <h2 className="display mb-4 text-2xl text-mw-pink">{cat.label}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PackageCard({ pkg }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-mw-pink/10 via-white/[0.02] to-transparent p-5 transition hover:border-mw-pink/50">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="display text-xl">{pkg.name}</div>
          <div className="text-xs text-white/60">{pkg.tagline}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="display text-2xl text-mw-pink">{pkg.pricePerPerson}€</div>
          <div className="text-[10px] text-white/50">/ pers {pkg.priceNote || ''}</div>
        </div>
      </div>

      <p className="mb-3 text-xs text-white/70">{pkg.description}</p>

      {pkg.activities && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {pkg.activities.map((a, idx) => {
            const act = getActivity(a.activityId);
            if (!act) return null;
            return (
              <span key={idx} className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px]">
                <span className="relative h-4 w-4">
                  <Image src={act.logo} alt="" fill sizes="16px" className="object-contain" />
                </span>
                <span>{act.name}{a.or ? ' / ' + getActivity(a.or)?.name : ''}</span>
                <span className="text-white/40">· {a.duration}min</span>
              </span>
            );
          })}
        </div>
      )}

      {pkg.inclusions && (
        <div className="mb-3 text-[11px] text-white/60">
          {pkg.inclusions.map((i, idx) => <div key={idx}>✓ {i}</div>)}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
        {pkg.minPlayers && <span className="chip">min {pkg.minPlayers} pers</span>}
        {pkg.maxPlayers && <span className="chip">max {pkg.maxPlayers} pers</span>}
        {pkg.ageMin && <span className="chip">{pkg.ageMin}+ ans</span>}
        {pkg.heightMin && <span className="chip">{pkg.heightMin}cm+</span>}
        {pkg.heightMax && <span className="chip">-{pkg.heightMax}cm</span>}
      </div>

      {pkg.note && <p className="mb-3 text-[11px] text-mw-yellow">ℹ {pkg.note}</p>}

      <div className="mt-auto">
        {pkg.requiresQuote ? (
          <a
            href={pkg.contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline w-full !py-2.5 text-sm"
          >
            Demander un devis ↗
          </a>
        ) : (
          <Link href={`/booking?package=${pkg.id}`} className="btn-primary w-full !py-2.5 text-sm">
            Réserver ce package →
          </Link>
        )}
      </div>
    </div>
  );
}
