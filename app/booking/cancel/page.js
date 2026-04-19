'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function CancelContent() {
  const params = useSearchParams();
  const orderCode = params.get('s');

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-mw-red/20 text-6xl">✕</div>
      <h1 className="section-title mb-2">Paiement annulé ou échoué</h1>
      <p className="mb-6 text-white/70">
        Votre paiement n'a pas abouti. Aucun montant n'a été débité.
        <br />Vous pouvez réessayer ou choisir un autre moyen de paiement.
      </p>
      {orderCode && <div className="mb-6 text-xs text-white/40">Référence transaction : {orderCode}</div>}
      <div className="flex flex-col gap-2">
        <Link href="/booking" className="btn-primary">Réessayer la réservation</Link>
        <Link href="/" className="btn-outline">Retour à l'accueil</Link>
      </div>
    </div>
  );
}

export default function BookingCancelPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-center text-white/60">Chargement…</div>}>
      <CancelContent />
    </Suspense>
  );
}
