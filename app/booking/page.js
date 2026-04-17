'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBooking } from '@/lib/store';
import { getActivity } from '@/lib/activities';
import { getPackage } from '@/lib/packages';
import { getConfig } from '@/lib/data';
import StepDate from '@/components/booking/StepDate';
import StepActivities from '@/components/booking/StepActivities';
import StepSessions from '@/components/booking/StepSessions';
import StepSlots from '@/components/booking/StepSlots';
import StepRecap from '@/components/booking/StepRecap';
import StepConfirm from '@/components/booking/StepConfirm';

// Steps possibles. Certains peuvent être bypassés via la config.
const ALL_STEPS = [
  { id: 'date', label: 'Date', short: 'Date', Component: StepDate },
  { id: 'activities', label: 'Activités', short: 'Activités', Component: StepActivities },
  { id: 'sessions', label: 'Joueurs', short: 'Joueurs', Component: StepSessions },
  { id: 'slots', label: 'Créneaux', short: 'Créneaux', Component: StepSlots },
  { id: 'recap', label: 'Récap', short: 'Récap', Component: StepRecap },
  { id: 'confirm', label: 'OK', short: 'OK', Component: StepConfirm },
];

function BookingInner() {
  const [stepIndex, setStepIndex] = useState(0);
  const topRef = useRef(null);
  const { cart, hydrated, applyPackage, setDate, clearCart, applyPromoCode } = useBooking();
  const params = useSearchParams();
  const packageId = params.get('package');
  const upsellFlag = params.get('upsell');
  const upsellDate = params.get('date');
  const stepParam = params.get('step');

  // Si ?step= est passé, sauter directement à cette étape
  useEffect(() => {
    if (hydrated && stepParam && !packageId && !upsellFlag) {
      const idx = ALL_STEPS.findIndex((s) => s.id === stepParam);
      if (idx >= 0) setStepIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, stepParam]);

  // Récupère la config (certaines étapes peuvent être bypassées)
  const packageStepBypassed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const v = getConfig('booking.bypass_package_toggle');
    return v === true || v === 'true';
  }, [hydrated]);

  const STEPS = ALL_STEPS;

  useEffect(() => {
    if (hydrated && packageId) {
      const pkg = getPackage(packageId);
      if (pkg && pkg.activities && applyPackage) {
        applyPackage(pkg);
        setStepIndex(cart.date ? 3 : 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, packageId]);

  // Flow upsell après confirmation : on préserve la date, on vide le cart,
  // on saute direct à l'étape Activités avec un code promo pré-appliqué
  useEffect(() => {
    if (!hydrated || !upsellFlag) return;
    try {
      const raw = sessionStorage.getItem('mw_upsell');
      if (raw) {
        const upsell = JSON.parse(raw);
        clearCart();
        if (upsellDate) setDate(upsellDate);
        applyPromoCode(upsell.code);
        sessionStorage.removeItem('mw_upsell');
        setStepIndex(1); // Étape Activités
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, upsellFlag]);

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepIndex]);

  if (!hydrated) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-white/60">Chargement…</div>;
  }

  const currentStep = STEPS[stepIndex];
  const StepComponent = currentStep.Component;

  const bookable = Object.keys(cart.items).map(getActivity).filter((a) => a && a.bookable);

  const canNext = () => {
    if (currentStep.id === 'date') return !!cart.date;
    if (currentStep.id === 'activities') return bookable.length > 0;
    if (currentStep.id === 'sessions') {
      return bookable.every((a) => {
        if (a.id === 'battlekart') return true;
        const item = cart.items[a.id];
        if (!item?.sessions?.length) return false;
        return item.sessions.every((s) => {
          if (s.players < (a.minPlayers || 1)) return false;
          // Si l'activité a des rooms, chaque session doit avoir un roomId choisi
          if (a.rooms && a.rooms.length > 0 && !s.roomId) return false;
          return true;
        });
      });
    }
    if (currentStep.id === 'slots') {
      return bookable.every((a) => {
        const needed = (cart.items[a.id]?.sessions || []).length;
        const assigned = (cart.slots[a.id] || []).filter(Boolean).length;
        return assigned === needed;
      });
    }
    return true;
  };

  const goNext = () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));

  return (
    <div ref={topRef} className="mx-auto max-w-5xl px-4 py-3 md:py-5">
      <Stepper steps={STEPS} activeIndex={stepIndex} />
      <div className="mt-4 md:mt-6">
        <StepComponent onNext={goNext} onConfirm={() => setStepIndex(STEPS.length - 1)} onRestart={() => setStepIndex(0)} />
      </div>
      {currentStep.id !== 'confirm' && currentStep.id !== 'recap' && (
        <div className="sticky bottom-3 mt-8 flex items-center justify-between gap-3 rounded border border-white/10 bg-black/70 p-2 backdrop-blur-md md:static md:bg-transparent md:p-0 md:backdrop-blur-0">
          <button
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="btn-outline !py-2.5 !px-5 text-sm disabled:opacity-30"
          >
            ← Retour
          </button>
          <button onClick={goNext} disabled={!canNext()} className="btn-primary !py-2.5 !px-5 text-sm">
            Continuer →
          </button>
        </div>
      )}
      {currentStep.id === 'recap' && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-start gap-3 md:static">
          <button onClick={goPrev} className="btn-outline !py-2.5 !px-5 text-sm">
            ← Retour
          </button>
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

function Stepper({ steps, activeIndex }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 min-w-0 items-center gap-1 last:flex-none">
          <div
            className={`flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded border text-[10px] md:text-xs font-bold transition ${
              i === activeIndex
                ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                : i < activeIndex
                ? 'border-mw-pink/60 bg-mw-pink/20 text-mw-pink'
                : 'border-white/20 text-white/40'
            }`}
          >
            {i < activeIndex ? '✓' : i + 1}
          </div>
          <span className={`display hidden truncate text-[11px] md:inline md:text-sm ${i === activeIndex ? 'text-white' : 'text-white/40'}`}>
            {s.short}
          </span>
          <span className={`display truncate text-[10px] md:hidden ${i === activeIndex ? 'text-white' : 'text-white/40'}`}>
            {s.short}
          </span>
          {i < steps.length - 1 && <div className="h-px flex-1 min-w-[6px] bg-white/20" />}
        </div>
      ))}
    </div>
  );
}
