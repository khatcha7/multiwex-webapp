export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-mw-darker/60">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/60">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 font-semibold text-white text-sm">Multiwex</div>
            <div>Rue des Deux Provinces, 1</div>
            <div>6900 Marche-en-Famenne</div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-white text-sm">Contact</div>
            <div>+32 (0)84 770 222</div>
            <div>info@multiwex.be</div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-white text-sm">Démo</div>
            <div className="text-[11px]">
              Maquette de réservation — paiement bypassé par code promo{" "}
              <span className="font-mono text-mw-pink">DEMO100</span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3 text-center text-[11px] text-white/40">
          © 2026 Multiwex — Maquette démonstration
        </div>
      </div>
    </footer>
  );
}
