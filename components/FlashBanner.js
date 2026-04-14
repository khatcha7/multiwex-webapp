export default function FlashBanner() {
  const text = ' MERCREDI -50% · FLASH SALE · MERCREDI -50% · FLASH SALE ·';
  return (
    <div className="relative my-4 overflow-hidden py-3" style={{ transform: 'rotate(-1deg)' }}>
      <div
        className="flex whitespace-nowrap py-3 font-display text-2xl uppercase tracking-wider text-white md:text-4xl"
        style={{
          background: 'linear-gradient(90deg, #ff004b 0%, #ff007d 50%, #b200d9 100%)',
          animation: 'mw-banner 22s linear infinite',
          minWidth: '200%',
          boxShadow: '0 10px 40px -10px rgba(255, 0, 125, 0.6)',
        }}
      >
        <span>{text.repeat(6)}</span>
        <span aria-hidden="true">{text.repeat(6)}</span>
      </div>
      <style>{`
        @keyframes mw-banner {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
