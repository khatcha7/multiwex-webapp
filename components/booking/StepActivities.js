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
  const disabledActivities = (typeof window !== 'undefined' ? getConfig('activities.disabled') : {}) || {};
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
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <a
            href="https://www.multiwex.be/fr/groupes/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded border border-mw-pink/30 bg-gradient-to-r from-mw-pink/10 to-transparent px-3 py-2.5 transition hover:border-mw-pink"
          >
            <div className="text-xl">🎉</div>
            <div>
              <div className="display text-sm">Groupe · Anniversaire · EVG · EVJF</div>
              <div className="text-[11px] text-white/60">Packages tout inclus — demandez un devis →</div>
            </div>
          </a>
          <a
            href="https://www.multiwex.be/fr/entreprises/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded border border-mw-pink/30 bg-gradient-to-r from-mw-pink/10 to-transparent px-3 py-2.5 transition hover:border-mw-pink"
          >
            <div className="text-xl">🏢</div>
            <div>
              <div className="display text-sm">Team building · Entreprise · Family day</div>
              <div className="text-[11px] text-white/60">Événements sur mesure — contactez-nous →</div>
            </div>
          </a>
        </div>
      )}

      {/* Grille d'activités — BattleKart + Starcadium fusionnés en position 1 pour avoir 8 cards propres */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 ${isFormula ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Cell composite : BattleKart + Starcadium — position 1, même style qu'ActivityLogoCard */}
        {(() => {
          const bk = activities.find((a) => a.id === 'battlekart');
          const sk = activities.find((a) => a.id === 'starcadium');
          if (!bk && !sk) return null;
          const bkSelected = bk && !!cart.items[bk.id];
          const bkDisabled = bk && disabledActivities[bk.id]?.disabled;
          const skDisabled = sk && disabledActivities[sk.id]?.disabled;
          return (
            <div
              className={`relative flex overflow-hidden rounded-2xl border bg-gradient-to-br from-white/[0.06] to-white/[0.01] backdrop-blur-sm transition ${
                bkSelected ? 'border-mw-pink shadow-neon-pink' : 'border-white/10'
              }`}
            >
              {/* Sous-cell BattleKart */}
              {bk && (
                <button
                  onClick={() => !isFormula && !bkDisabled && toggleActivity(bk.id)}
                  disabled={bkDisabled}
                  className={`group relative flex flex-1 flex-col border-r border-white/10 text-left transition hover:-translate-y-0.5 ${
                    bkDisabled ? 'cursor-not-allowed opacity-40' : ''
                  }`}
                >
                  {/* Image background + overlay */}
                  <div className="absolute inset-0 opacity-30 transition group-hover:opacity-50">
                    {bk.image && (
                      <Image src={bk.image} alt="" fill sizes="(max-width: 640px) 25vw, 16vw" className="object-cover blur-[1px]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/80 to-black/95" />
                  </div>
                  {bkSelected && (
                    <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-mw-pink text-[10px] font-black text-white shadow-neon-pink">
                      ✓
                    </div>
                  )}
                  {/* Logo + nom + badge */}
                  <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-2 pt-4 pb-2">
                    <div className="relative h-10 w-full">
                      <Image src={bk.logo} alt={bk.name} fill sizes="90px" className="object-contain [filter:drop-shadow(0_0_6px_rgba(255,0,125,0.35))]" />
                    </div>
                  </div>
                  <div className="relative z-10 border-t border-white/10 bg-black/40 px-2 py-1.5 text-center text-[10px] font-bold text-mw-yellow">
                    {bkSelected ? '✓ Sélectionné' : '🏁 Résa séparée'}
                  </div>
                </button>
              )}
              {/* Sous-cell Starcadium */}
              {sk && (
                <div className={`relative flex flex-1 flex-col ${skDisabled ? 'opacity-40' : ''}`}>
                  <div className="absolute inset-0 opacity-30">
                    {sk.image && (
                      <Image src={sk.image} alt="" fill sizes="(max-width: 640px) 25vw, 16vw" className="object-cover blur-[1px]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/80 to-black/95" />
                  </div>
                  <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-2 pt-4 pb-2">
                    <div className="relative h-10 w-full">
                      <Image src={sk.logo} alt={sk.name} fill sizes="90px" className="object-contain [filter:drop-shadow(0_0_6px_rgba(0,217,255,0.35))]" />
                    </div>
                  </div>
                  <div className="relative z-10 border-t border-white/10 bg-black/40 px-2 py-1.5 text-center text-[10px] font-bold text-white/70">
                    Sans réservation
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Activités normales (hors BK/SK) */}
        {activities
          .filter((a) => a.id !== 'battlekart' && a.id !== 'starcadium')
          .map((a) => {
            const selected = !!cart.items[a.id];

            // Activité désactivée par le staff
            const actDisabled = disabledActivities[a.id];
            if (actDisabled?.disabled) {
              return (
                <div key={a.id} className="relative opacity-40 cursor-not-allowed" onClick={() => alert(`${a.name} n'est pas disponible actuellement.\n${actDisabled.reason || ''}`)}>
                  <ActivityLogoCard activity={a} as="div" date={cart.date} badge="Indisponible" />
                </div>
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
