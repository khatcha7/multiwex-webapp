'use client';
import { useState } from 'react';
import { useBooking } from '@/lib/store';
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
  { id: 'confirm', label: 'Confirmation' },
];

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const { cart, hydrated } = useBooking();

  if (!hydrated) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-white/60">Chargement…</div>;
  }

  const bookableSelected = cart.activityIds.filter((id) => id !== 'battlekart' && id !== 'starcadium');
  const canNext = () => {
    if (step === 0) return bookableSelected.length > 0;
    if (step === 1) return cart.players > 0;
    if (step === 2) return cart.date && bookableSelected.every((id) => cart.slots[id]);
    if (step === 3) return true;
    return false;
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
      {step < 3 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-outline disabled:opacity-30"
          >
            ← Retour
          </button>
          <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="btn-primary">
            Continuer →
          </button>
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
                ? 'border-mw-cyan bg-mw-cyan text-black shadow-neon-cyan'
                : i < step
                ? 'border-mw-cyan/60 bg-mw-cyan/20 text-mw-cyan'
                : 'border-white/20 text-white/40'
            }`}
          >
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`text-xs font-medium md:text-sm ${i === step ? 'text-white' : 'text-white/40'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px w-4 bg-white/20 md:w-8" />}
        </div>
      ))}
    </div>
  );
}
