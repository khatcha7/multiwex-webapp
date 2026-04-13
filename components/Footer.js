export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-mw-darker/60">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-white/60">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="mb-2 font-bold text-white">Multiwex</div>
            <div>Rue des Deux Provinces, 1</div>
            <div>6900 Marche-en-Famenne</div>
          </div>
          <div>
            <div className="mb-2 font-bold text-white">Contact</div>
            <div>+32 (0)84 770 222</div>
            <div>info@multiwex.be</div>
          </div>
          <div>
            <div className="mb-2 font-bold text-white">Démo</div>
            <div className="text-xs">Maquette de réservation — paiement bypassé par code promo <span className="font-mono text-mw-cyan">DEMO100</span></div>
          </div>
        </div>
        <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-white/40">
          © 2026 Multiwex — Maquette démonstration
        </div>
      </div>
    </footer>
  );
}
