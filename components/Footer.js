export default function Footer() {
  return (
    <footer className="mt-14 border-t border-white/10 bg-mw-darker/60">
      <div className="mx-auto max-w-6xl px-4 py-5 text-[11px] leading-snug text-white/60">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 font-medium text-white text-xs">Multiwex</div>
            <div>Rue des Deux Provinces, 1</div>
            <div>6900 Marche-en-Famenne</div>
          </div>
          <div>
            <div className="mb-1 font-medium text-white text-xs">Contact</div>
            <div>+32 (0)84 770 222</div>
            <div>info@multiwex.be</div>
          </div>
          <div>
            <div className="mb-1 font-medium text-white text-xs">Démo</div>
            <div className="text-[10px]">
              Maquette de réservation — paiement bypassé par code promo{" "}
              <span className="font-mono text-mw-pink">DEMO100</span>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2 text-center text-[10px] text-white/40">
          © 2026 Multiwex — Maquette démonstration
        </div>
      </div>
    </footer>
  );
}
