'use client';
import { useState } from 'react';

export default function BrasseriePage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-14">
      <div className="mb-8">
        <h1 className="section-title mb-2">Red Planet Brasserie</h1>
        <p className="text-white/60">
          La brasserie intégrée à Multiwex — snacks, plats, produits locaux, cocktails, bières artisanales.
          Parfait pour prolonger votre session de jeu autour d'un bon repas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-mw-red/15 via-mw-pink/5 to-transparent p-6">
          <div className="mb-3 text-4xl">🍺</div>
          <h2 className="display mb-2 text-2xl">Sur place</h2>
          <p className="mb-4 text-sm text-white/70">
            Ouvert pendant les heures d'activité Multiwex. Présentez-vous directement à la brasserie,
            aucune réservation nécessaire pour la plupart des créneaux.
          </p>
          <ul className="mb-4 space-y-1 text-xs text-white/60">
            <li>✓ Bières locales & cocktails</li>
            <li>✓ Planches apéritives à partager</li>
            <li>✓ Repas chauds, burgers, pizzas</li>
            <li>✓ Produits régionaux de la Famenne</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-mw-pink/40 bg-gradient-to-br from-mw-pink/20 via-transparent to-transparent p-6">
          <div className="mb-3 text-4xl">📅</div>
          <h2 className="display mb-2 text-2xl">Réserver une table</h2>
          <p className="mb-4 text-sm text-white/70">
            Pour les groupes ou les soirs de forte affluence, réservez via notre partenaire Zenchef.
            Conseillé pour vos sessions de jeu en groupe.
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary w-full !py-3">
            Je réserve →
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="display mb-3 text-xl">Horaires & contact</h3>
        <div className="grid gap-4 text-sm text-white/70 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40">Adresse</div>
            <div>Rue des Deux Provinces 1</div>
            <div>6900 Marche-en-Famenne</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40">Contact</div>
            <div>+32 (0)84 770 222</div>
            <div>info@multiwex.be</div>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl border border-mw-pink/40 bg-mw-darker p-4 shadow-neon-pink"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink"
              aria-label="Fermer"
            >
              ✕
            </button>
            <div className="mb-3 px-2">
              <div className="display text-lg">Red Planet Brasserie</div>
              <div className="text-xs text-white/60">Powered by Zenchef</div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white" style={{ height: '520px' }}>
              <iframe
                src="https://bookings.zenchef.com/results?rid=378158&pid=menu"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Réservation Red Planet Brasserie"
              />
            </div>
            <p className="mt-3 text-center text-[11px] text-white/50">
              Si le widget ne charge pas,{' '}
              <a
                href="https://www.google.com/maps/reserve/v/dine/c/VQ5EgyH_iZg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mw-pink hover:underline"
              >
                ouvrez Google Reserve →
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
