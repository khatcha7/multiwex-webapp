'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPopups } from '@/lib/data';

export default function StepConfirm({ onRestart }) {
  const [booking, setBooking] = useState(null);
  const [popupQueue, setPopupQueue] = useState([]);
  const [popupIndex, setPopupIndex] = useState(-1);
  const [zenchefOpen, setZenchefOpen] = useState(false);

  useEffect(() => {
    const b = sessionStorage.getItem('mw_last_booking');
    if (b) {
      setBooking(JSON.parse(b));
      const popups = getPopups().filter((p) => p.enabled && p.trigger === 'after_confirmation').sort((a, b) => (a.order || 0) - (b.order || 0));
      setPopupQueue(popups);
      if (popups.length > 0) {
        const t = setTimeout(() => setPopupIndex(0), 1500);
        return () => clearTimeout(t);
      }
    }
  }, []);

  const current = popupIndex >= 0 ? popupQueue[popupIndex] : null;

  const dismissPopup = () => {
    const next = popupIndex + 1;
    if (next < popupQueue.length) setPopupIndex(next);
    else setPopupIndex(-1);
  };

  const handlePopupCta = () => {
    if (!current) return;
    if (current.cta_action === 'zenchef') {
      setZenchefOpen(true);
    } else if (current.cta_action === 'upsell_addactivities') {
      const code = current.promo_code || 'UPSELL20';
      const discount = current.discount_pct || 20;
      // Préserve la date de la résa initiale + pré-applique le code promo
      sessionStorage.setItem('mw_upsell', JSON.stringify({
        code,
        discount,
        originalBookingId: booking?.id,
        originalDate: booking?.date,
      }));
      // Redirige vers l'étape activités (skip date grâce au param)
      window.location.href = `/booking?upsell=1&date=${booking?.date}`;
      return;
    } else if (current.cta_url) {
      window.open(current.cta_url, '_blank');
    }
    dismissPopup();
  };

  if (!booking) return null;

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mw-pink/20 text-5xl shadow-neon-pink">
        ✓
      </div>
      <h1 className="section-title mb-2">Réservation confirmée&nbsp;!</h1>
      <p className="mb-6 text-white/60">
        Un email de confirmation a été envoyé à <span className="text-mw-pink">{booking.customer.email}</span>
        <span className="text-xs text-white/40"> (simulation démo)</span>
      </p>
      <div className="mx-auto max-w-md rounded border border-mw-pink/40 bg-gradient-to-br from-mw-pink/10 to-transparent p-6 text-left">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Numéro</div>
            <div className="display font-mono text-lg text-mw-pink">{booking.id}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/50">Total</div>
            <div className="display text-2xl">{booking.total.toFixed(2)}€</div>
          </div>
        </div>
        <div className="mb-3 text-sm text-white/70">
          {new Date(booking.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — max {booking.players} joueur(s)
        </div>
        <div className="space-y-2">
          {booking.items.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between rounded bg-white/[0.05] p-2 text-sm">
              <span className="font-medium">{i.activityName} <span className="text-white/50">· {i.players}j</span></span>
              <span className="font-mono text-mw-pink">{i.start}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="btn-outline">Voir mon compte</Link>
        <button onClick={onRestart} className="btn-primary">Nouvelle réservation</button>
      </div>

      {current && !zenchefOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-md rounded border border-mw-pink/50 bg-mw-surface p-6 shadow-neon-pink">
            <button
              onClick={dismissPopup}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink"
            >
              ✕
            </button>
            {current.emoji && <div className="mb-3 text-center text-5xl">{current.emoji}</div>}
            <div className="display mb-2 text-center text-2xl">{current.title}</div>
            <p className="mb-5 text-center text-sm text-white/70" style={{ whiteSpace: 'pre-line' }}>{current.body}</p>
            <div className="flex flex-col gap-2">
              <button onClick={handlePopupCta} className="btn-primary w-full">
                {current.cta_label}
              </button>
              <button onClick={dismissPopup} className="btn-outline w-full text-sm">
                Non merci
              </button>
            </div>
          </div>
        </div>
      )}

      {zenchefOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => { setZenchefOpen(false); dismissPopup(); }}
        >
          <div
            className="relative w-full max-w-xl rounded border border-mw-pink/40 bg-mw-surface p-4 shadow-neon-pink"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setZenchefOpen(false); dismissPopup(); }}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-mw-pink"
            >
              ✕
            </button>
            <div className="mb-3 px-2 text-left">
              <div className="display text-lg">Red Planet Brasserie</div>
              <div className="text-xs text-white/60">Powered by Zenchef</div>
            </div>
            <div className="overflow-hidden rounded bg-white" style={{ height: '520px' }}>
              <iframe
                src="https://bookings.zenchef.com/results?rid=378158&pid=menu"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Réservation Red Planet Brasserie"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
