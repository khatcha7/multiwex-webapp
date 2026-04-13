'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StepConfirm({ onRestart }) {
  const [booking, setBooking] = useState(null);
  useEffect(() => {
    const b = sessionStorage.getItem('mw_last_booking');
    if (b) setBooking(JSON.parse(b));
  }, []);

  if (!booking) return null;

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mw-cyan/20 text-5xl shadow-neon-cyan">
        ✓
      </div>
      <h1 className="section-title mb-2">Réservation confirmée&nbsp;!</h1>
      <p className="mb-6 text-white/60">
        Un email de confirmation a été envoyé à <span className="text-mw-cyan">{booking.customer.email}</span>
        <span className="text-xs text-white/40"> (simulation démo)</span>
      </p>
      <div className="mx-auto max-w-md rounded-2xl border border-mw-cyan/40 bg-gradient-to-br from-mw-cyan/10 to-transparent p-6 text-left">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Numéro</div>
            <div className="font-mono text-lg font-black text-mw-cyan">{booking.id}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/50">Total</div>
            <div className="text-lg font-black">{booking.total.toFixed(2)}€</div>
          </div>
        </div>
        <div className="mb-3 text-sm text-white/70">
          {new Date(booking.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — {booking.players} joueur(s)
        </div>
        <div className="space-y-2">
          {booking.items.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg bg-white/[0.05] p-2 text-sm">
              <span className="font-medium">{i.activityName}</span>
              <span className="font-mono text-mw-cyan">{i.start}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="btn-outline">Voir mon compte</Link>
        <button onClick={onRestart} className="btn-primary">Nouvelle réservation</button>
      </div>
    </div>
  );
}
