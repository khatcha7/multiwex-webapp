'use client';
import { useState } from 'react';
import { useBooking, computeSessionsNeeded } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import StepActivities from '@/components/booking/StepActivities';
import StepPlayers from '@/components/booking/StepPlayers';
import StepSlots from '@/components/booking/StepSlots';
import StepRecap from '@/components/booking/StepRecap';
import StepConfirm from '@/components/booking/StepConfirm';

const STEPS = [
  { id: 'activities', label: 'Activités' },
  { id: 'players', label: 'Joueurs' },
  { id: 'slots', label: 'Créneaux' },
  { id: 'recap', label: 'Récap' },
  { id: 'confirm', label: 'OK' },
];

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const { cart, hydrated } = useBooking();

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
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Stepper step={step} />
      <div className="mt-6 md:mt-10">
        {step === 0 && <StepActivities />}
        {step === 1 && <StepPlayers />}
        {step === 2 && <StepSlots />}
        {step === 3 && <StepRecap onConfirm={() => setStep(4)} />}
        {step === 4 && <StepConfirm onRestart={() => setStep(0)} />}
      </div>
      {step < 4 && (
        <div className="sticky bottom-4 mt-8 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/60 p-2 backdrop-blur-md md:static md:bg-transparent md:p-0 md:backdrop-blur-0">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-outline !px-5 disabled:opacity-30"
          >
            ← Retour
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="btn-primary !px-5">
              Continuer →
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin md:gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex shrink-0 items-center gap-1 md:gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
              i === step
                ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                : i < step
                ? 'border-mw-pink/60 bg-mw-pink/20 text-mw-pink'
                : 'border-white/20 text-white/40'
            }`}
          >
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`display text-xs md:text-sm ${i === step ? 'text-white' : 'text-white/40'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px w-4 bg-white/20 md:w-8" />}
        </div>
      ))}
    </div>
  );
}
