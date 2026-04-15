'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { activities, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';
import { getRestrictions } from '@/lib/restrictions';
import { packages } from '@/lib/packages';
import { useBooking } from '@/lib/store';
import { getConfig } from '@/lib/data';
import ActivityLogoCard from '@/components/ActivityLogoCard';

export default function StepActivities() {
  const { cart, toggleActivity, setSessionCount, applyPackage } = useBooking();
  const [showPackages, setShowPackages] = useState(false);

  const bypassPackage = typeof window !== 'undefined' && (getConfig('booking.bypass_package_toggle') === true || getConfig('booking.bypass_package_toggle') === 'true');
  const isWed = isWednesdayDiscount(cart.date);

  return (
    <div>
      <h1 className="section-title mb-2">Vos activités</h1>
      <p className="mb-4 text-white/60">
        {isWed && <span className="text-mw-pink">Mercredi -50% automatiquement appliqué&nbsp;! </span>}
        Sélectionnez une ou plusieurs activités puis indiquez combien de parties vous voulez faire.
      </p>

      {!bypassPackage && (
        <div className="mb-5 rounded border border-mw-pink/30 bg-gradient-to-r from-mw-pink/10 to-transparent p-3">
          <button
            onClick={() => setShowPackages(!showPackages)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div>
              <div className="display text-sm">Venez en groupe&nbsp;? Anniversaire, EVG, team building ?</div>
              <div className="text-xs text-white/60">
                Packages tout inclus pré-configurés · formules famille, amis, entreprises
              </div>
            </div>
            <span className="display text-xs text-mw-pink">{showPackages ? '−' : '+'}</span>
          </button>
          {showPackages && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {packages.filter((p) => !p.requiresQuote).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { applyPackage(p); setShowPackages(false); }}
                  className="rounded border border-white/10 bg-mw-surface p-3 text-left transition hover:border-mw-pink"
                >
                  <div className="display text-sm">{p.name}</div>
                  <div className="text-[10px] text-white/60">{p.tagline}</div>
                  <div className="mt-1 display text-lg text-mw-pink">{p.pricePerPerson}€<span className="text-[10px] text-white/40"> /pers</span></div>
                  <div className="mt-1 text-[10px] text-white/50">min {p.minPlayers} pers</div>
                </button>
              ))}
              <Link href="/packages" className="flex items-center justify-center rounded border border-white/15 bg-white/[0.02] p-3 text-xs text-white/60 hover:border-mw-pink hover:text-mw-pink">
                Voir tous les packages →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {activities.map((a) => {
          const selected = !!cart.items[a.id];
          const external = !a.bookable && !a.walkIn;

          if (external) {
            return (
              <a key={a.id} href={a.external} target="_blank" rel="noopener noreferrer" className="block">
                <ActivityLogoCard activity={a} as="div" badge="Externe ↗" date={cart.date} />
              </a>
            );
          }
          if (a.walkIn) {
            return <ActivityLogoCard key={a.id} activity={a} as="div" date={cart.date} />;
          }
          return (
            <ActivityLogoCard
              key={a.id}
              activity={a}
              selected={selected}
              onClick={() => toggleActivity(a.id)}
              date={cart.date}
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
              const r = getRestrictions(id);
              const count = (item.sessions || []).length;
              const price = getActivityPrice(a, cart.date);
              return (
                <div key={id} className="rounded border border-white/10 bg-mw-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 rounded border border-white/10 bg-black/40 p-1.5">
                      <Image src={a.logo} alt={a.name} fill className="object-contain p-1.5" sizes="48px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="display text-lg leading-none">{a.name}</div>
                      <div className="mt-0.5 text-[11px] text-white/60">
                        {a.duration} min · <span className="text-mw-pink">{a.minPlayers}-{a.maxPlayers}</span> joueurs · <span className="display text-mw-pink">{price}€</span>/pers
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSessionCount(id, Math.max(1, count - 1))}
                        disabled={count <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg font-bold disabled:opacity-30 hover:border-mw-pink hover:text-mw-pink"
                      >
                        −
                      </button>
                      <div className="w-7 text-center display text-lg text-mw-pink">{count}</div>
                      <button
                        onClick={() => setSessionCount(id, count + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-lg font-bold hover:border-mw-pink hover:text-mw-pink"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {r?.disclaimerShort && (
                    <div className="mt-2 text-[10px] text-mw-yellow">⚠ {r.disclaimerShort}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
