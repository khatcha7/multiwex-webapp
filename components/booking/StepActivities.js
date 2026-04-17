'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { activities, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';
import { getRestrictions } from '@/lib/restrictions';
import { packages, getPackage } from '@/lib/packages';
import { useBooking } from '@/lib/store';
import { getConfig } from '@/lib/data';
import ActivityLogoCard from '@/components/ActivityLogoCard';

export default function StepActivities() {
  const { cart, toggleActivity, setSessionCount, applyPackage, clearPackage } = useBooking();
  const [showPackages, setShowPackages] = useState(false);

  const bypassPackage = typeof window !== 'undefined' && (getConfig('booking.bypass_package_toggle') === true || getConfig('booking.bypass_package_toggle') === 'true');
  const isWed = isWednesdayDiscount(cart.date);
  const isFormula = Boolean(cart.packageId);
  const currentPkg = isFormula ? getPackage(cart.packageId) : null;

  const exitFormula = () => {
    // Sort de la formule, garde les activités sélectionnées, remet les tarifs normaux
    // et remet les joueurs à 1 par créneau
    const itemsCopy = { ...cart.items };
    Object.keys(itemsCopy).forEach((id) => {
      const a = activities.find((x) => x.id === id);
      if (a) {
        itemsCopy[id] = { sessions: [{ players: a.minPlayers || 1 }] };
      }
    });
    // NOTE: we do a direct setCart from the provider.
    // For simplicity, we'll re-apply via applyPackage with null,
    // but we need a clearPackage function. Let's just set packageId to null.
    // We'll use setCart if available, otherwise toggle.
    // Simpler: call the parent method.
  };

  return (
    <div>
      <h1 className="section-title mb-2">Vos activités</h1>
      <p className="mb-4 text-white/60">
        Sélectionnez une ou plusieurs activités puis indiquez combien de parties vous voulez faire.
      </p>

      {/* Bulle formule active */}
      {isFormula && currentPkg && (
        <div className="mb-5 flex items-center gap-2 rounded bg-mw-pink/15 border border-mw-pink/50 px-4 py-3">
          <div className="flex-1">
            <div className="display text-sm">Formule {currentPkg.name}</div>
            <div className="text-xs text-white/60">{currentPkg.tagline} · {currentPkg.pricePerPerson}€/pers</div>
          </div>
          <button
            onClick={() => clearPackage()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-mw-red text-xs"
            title="Quitter la formule — revenir en mode libre"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bloc groupes / entreprises (si pas déjà en formule et pas bypass) */}
      {!bypassPackage && !isFormula && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <a
            href="https://www.multiwex.be/fr/groupes/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded border border-mw-pink/30 bg-gradient-to-r from-mw-pink/10 to-transparent p-4 transition hover:border-mw-pink"
          >
            <div className="text-2xl">🎉</div>
            <div>
              <div className="display text-sm">Groupe · Anniversaire · EVG · EVJF</div>
              <div className="text-[11px] text-white/60">Packages tout inclus — demandez un devis →</div>
            </div>
          </a>
          <a
            href="https://www.multiwex.be/fr/entreprises/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded border border-mw-pink/30 bg-gradient-to-r from-mw-pink/10 to-transparent p-4 transition hover:border-mw-pink"
          >
            <div className="text-2xl">🏢</div>
            <div>
              <div className="display text-sm">Team building · Entreprise · Family day</div>
              <div className="text-[11px] text-white/60">Événements sur mesure — contactez-nous →</div>
            </div>
          </a>
        </div>
      )}

      {/* Grille d'activités */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 ${isFormula ? 'opacity-50 pointer-events-none' : ''}`}>
        {activities.map((a) => {
          const selected = !!cart.items[a.id];
          const external = !a.bookable && !a.selectable && !a.walkIn;

          // BattleKart : sélectionnable mais pas réservable chez nous
          if (a.id === 'battlekart') {
            return (
              <ActivityLogoCard
                key={a.id}
                activity={a}
                selected={selected}
                onClick={() => !isFormula && toggleActivity(a.id)}
                date={cart.date}
                badge={selected ? null : 'Résa séparée'}
              />
            );
          }
          if (a.walkIn) {
            return <ActivityLogoCard key={a.id} activity={a} as="div" date={cart.date} />;
          }
          if (!a.bookable) return null;
          return (
            <ActivityLogoCard
              key={a.id}
              activity={a}
              selected={selected}
              onClick={() => !isFormula && toggleActivity(a.id)}
              date={cart.date}
            />
          );
        })}
      </div>

      {/* Info sélection figée pour formules */}
      {isFormula && (
        <p className="mt-3 text-center text-xs text-mw-yellow">
          🔒 Activités figées par la formule {currentPkg?.name}. Cliquez ✕ ci-dessus pour passer en mode libre.
        </p>
      )}

      {/* Encart nombre de parties + infos */}
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
              const isBattleKart = a.id === 'battlekart';

              return (
                <div key={id} className="rounded border border-white/10 bg-mw-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 rounded border border-white/10 bg-black/40 p-1.5">
                      <Image src={a.logo} alt={a.name} fill className="object-contain p-1.5" sizes="48px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="display text-lg leading-none">{a.name}</div>
                      <div className="mt-0.5 text-[11px] text-white/60">
                        {a.duration} min · <span className="text-mw-pink">{a.minPlayers}-{a.maxPlayers}</span> joueurs
                        {!isBattleKart && (
                          <>
                            {' · '}
                            {isFormula ? (
                              <span className="text-mw-red line-through">{price}€</span>
                            ) : (
                              <span className="display text-mw-pink">{price}€</span>
                            )}
                            <span className="text-white/40">/pers</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isBattleKart ? (
                      <div className="shrink-0 rounded bg-mw-yellow/10 border border-mw-yellow/40 px-3 py-2 text-center">
                        <div className="text-[10px] text-mw-yellow">🏁 Réservation</div>
                        <div className="text-[10px] text-mw-yellow">séparée après paiement</div>
                      </div>
                    ) : isFormula ? (
                      <div className="shrink-0 text-center">
                        <div className="display text-lg text-mw-red line-through">{price * count}€</div>
                        <div className="text-[10px] text-white/40">incl. formule</div>
                      </div>
                    ) : (
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
                    )}
                  </div>
                  {r?.disclaimerShort && (
                    <div className="mt-2 text-[10px] text-mw-yellow">⚠ {r.disclaimerShort}</div>
                  )}
                </div>
              );
            })}
          </div>
          {isFormula && currentPkg && (
            <div className="mt-3 rounded bg-mw-pink/10 border border-mw-pink/30 p-3 text-center">
              <div className="display text-sm text-mw-pink">Formule {currentPkg.name}</div>
              <div className="text-xs text-white/60">Tarif {currentPkg.pricePerPerson}€ par participant (activités incluses)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
