'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const params = useSearchParams();
  const orderCode = params.get('s');
  const [bookingRef, setBookingRef] = useState(null);

  useEffect(() => {
    try {
      const last = JSON.parse(sessionStorage.getItem('mw_last_booking') || 'null');
      if (last?.id) setBookingRef(last.id);
    } catch {}
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-mw-green/20 text-6xl shadow-neon-cyan">✓</div>
      <h1 className="section-title mb-2">Paiement confirmé !</h1>
      <p className="mb-6 text-white/70">Votre réservation est bien enregistrée. Vous allez recevoir un email de confirmation avec votre facture.</p>
      {bookingRef && (
        <div className="mb-6 rounded border border-mw-pink/30 bg-mw-pink/5 p-4">
          <div className="text-xs uppercase tracking-wider text-white/50">Référence</div>
          <div className="font-mono text-2xl text-mw-pink">{bookingRef}</div>
        </div>
      )}
      {orderCode && <div className="mb-6 text-xs text-white/40">Transaction VivaWallet : {orderCode}</div>}
      <div className="flex flex-col gap-2">
        <Link href="/account" className="btn-primary">Voir mes réservations</Link>
        <Link href="/" className="btn-outline">Retour à l'accueil</Link>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-center text-white/60">Chargement…</div>}>
      <SuccessContent />
    </Suspense>
  );
}
