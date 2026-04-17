export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-mw-darker/60">
      <div className="mx-auto max-w-7xl px-4 py-3 text-[11px] text-white/55">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:justify-between">
          <div>
            <span className="font-medium text-white/80">Multiwex</span> · Rue des Deux Provinces 1, 6900 Marche-en-Famenne
          </div>
          <div>
            +32 (0)84 770 222 · <span className="text-mw-pink/80">info@multiwex.be</span>
          </div>
          <div className="text-white/35">
            © 2026 — Maquette démo · Code promo <span className="font-mono text-mw-pink/70">DEMO100</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
