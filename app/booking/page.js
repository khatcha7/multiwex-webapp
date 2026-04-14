'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBooking, computeSessionsNeeded } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getPackage } from '@/lib/packages';
import StepActivities from '@/components/booking/StepActivities';
import StepPlayers from '@/components/booking/StepPlayers';
import StepSlots from '@/components/booking/StepSlots';
import StepRecap from '@/components/booking/StepRecap';
import StepConfirm from '@/components/booking/StepConfirm';

const STEPS = [
  { id: 'activities', label: 'Activités', short: '1' },
  { id: 'players', label: 'Joueurs', short: '2' },
  { id: 'slots', label: 'Créneaux', short: '3' },
  { id: 'recap', label: 'Récap', short: '4' },
  { id: 'confirm', label: 'OK', short: '✓' },
];

function BookingInner() {
  const [step, setStep] = useState(0);
  const topRef = useRef(null);
  const { cart, hydrated, applyPackage } = useBooking();
  const params = useSearchParams();
  const packageId = params.get('package');

  useEffect(() => {
    if (hydrated && packageId) {
      const pkg = getPackage(packageId);
      if (pkg && pkg.activities && applyPackage) {
        applyPackage(pkg);
        setStep(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, packageId]);

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  if (!hydrated) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-white/60">Chargement…</div>;
  }

  const activityIds = Object.keys(cart.items);
  const bookable = activityIds.map(getActivity).filter((a) => a && a.bookable);

  const canNext = () => {
    if (step === 0) return bookable.length > 0;
    if (step === 1) return cart.players > 0;
    if (step === 2) {
      if (!cart.date) return false;
      return bookable.every((a) => {
        const item = cart.items[a.id];
        const needed = computeSessionsNeeded(a, cart.players, item.quantity);
        return (cart.slots[a.id] || []).length === needed;
      });
    }
    return true;
  };

  return (
    <div ref={topRef} className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Stepper step={step} />
      <div className="mt-6 md:mt-10">
        {step === 0 && <Suspense fallback={null}><StepActivities /></Suspense>}
        {step === 1 && <StepPlayers />}
        {step === 2 && <StepSlots />}
        {step === 3 && <StepRecap onConfirm={() => setStep(4)} />}
        {step === 4 && <StepConfirm onRestart={() => setStep(0)} />}
      </div>
      {step < 4 && (
        <div className="sticky bottom-3 mt-8 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/70 p-2 backdrop-blur-md md:static md:bg-transparent md:p-0 md:backdrop-blur-0">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-outline !py-2.5 !px-5 text-sm disabled:opacity-30"
          >
            ← Retour
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="btn-primary !py-2.5 !px-5 text-sm">
              Continuer →
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-white/60">Chargement…</div>}>
      <BookingInner />
    </Suspense>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex flex-1 min-w-0 items-center gap-1 last:flex-none">
          <div
            className={`flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full border text-[10px] md:text-xs font-bold transition ${
              i === step
                ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                : i < step
                ? 'border-mw-pink/60 bg-mw-pink/20 text-mw-pink'
                : 'border-white/20 text-white/40'
            }`}
          >
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`display hidden truncate text-[11px] md:inline md:text-sm ${i === step ? 'text-white' : 'text-white/40'}`}>
            {s.label}
          </span>
          <span className={`display truncate text-[10px] md:hidden ${i === step ? 'text-white' : 'text-white/40'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px flex-1 min-w-[6px] bg-white/20" />}
        </div>
      ))}
    </div>
  );
}
