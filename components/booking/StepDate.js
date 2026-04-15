'use client';
import { useMemo, useState, useEffect } from 'react';
import { useBooking } from '@/lib/store';
import {
  dayLabelsFr,
  dayLabelsFrFull,
  monthsFr,
  isOpenOn,
  toDateStr,
  parseDate,
  getHoursForDate,
} from '@/lib/hours';

export default function StepDate({ onNext }) {
  const { cart, setDate } = useBooking();
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = cart.date ? parseDate(cart.date) : today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (cart.date) {
      const d = parseDate(cart.date);
      setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { year, month } = viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const isPast = new Date(year, month, 1) < new Date(today.getFullYear(), today.getMonth(), 1);

  const cells = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateStr(new Date(year, month, d)));
  }

  const todayStr = toDateStr(today);
  const selectedHours = cart.date ? getHoursForDate(cart.date) : null;

  const nextMonth = () => {
    const nm = new Date(year, month + 1, 1);
    setViewMonth({ year: nm.getFullYear(), month: nm.getMonth() });
  };
  const prevMonth = () => {
    if (isPast) return;
    const pm = new Date(year, month - 1, 1);
    if (pm < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setViewMonth({ year: pm.getFullYear(), month: pm.getMonth() });
  };

  return (
    <div>
      <h1 className="section-title mb-2">Quand venez-vous&nbsp;?</h1>
      <p className="mb-6 text-white/60">
        Choisissez votre date de visite. Ça nous permet d'afficher les bons tarifs
        (mercredi&nbsp;: <span className="font-bold text-mw-pink">-50%</span> sur toutes les activités).
      </p>

      <div className="rounded border border-white/10 bg-mw-surface p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            disabled={isPast || (year === today.getFullYear() && month === today.getMonth())}
            className="flex h-9 w-9 items-center justify-center rounded border border-white/15 text-lg disabled:opacity-20"
          >
            ←
          </button>
          <div className="display text-xl">
            {monthsFr[month]} {year}
          </div>
          <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded border border-white/15 text-lg hover:border-mw-pink hover:text-mw-pink">
            →
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">
          {dayLabelsFr.map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={idx} />;
            const open = isOpenOn(cell);
            const isToday = cell === todayStr;
            const active = cart.date === cell;
            const date = parseDate(cell);
            const isWed = date.getDay() === 3;
            const isPastDay = parseDate(cell) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const disabled = !open || isPastDay;

            return (
              <button
                key={cell}
                onClick={() => !disabled && setDate(cell)}
                disabled={disabled}
                className={`relative flex aspect-square flex-col items-center justify-center rounded border text-center transition ${
                  active
                    ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                    : disabled
                    ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20'
                    : 'border-white/15 bg-white/[0.03] hover:border-white/40'
                }`}
              >
                {isToday && !active && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-mw-pink" />}
                <div className="display text-lg leading-none">{date.getDate()}</div>
                {isWed && !disabled && <div className={`text-[8px] font-bold ${active ? 'text-white' : 'text-mw-pink'}`}>-50%</div>}
                {isToday && <div className="text-[8px] uppercase opacity-70">auj</div>}
              </button>
            );
          })}
        </div>
      </div>

      {cart.date && selectedHours && (
        <div className="mt-4 rounded border border-mw-pink/30 bg-mw-pink/5 p-4 text-center">
          <div className="display text-lg">
            {dayLabelsFrFull[parseDate(cart.date).getDay()]} {parseDate(cart.date).getDate()} {monthsFr[parseDate(cart.date).getMonth()]}
          </div>
          <div className="text-sm text-white/70">
            Ouverture&nbsp;: <span className="text-mw-pink">{selectedHours.open} → {selectedHours.close}</span>
          </div>
        </div>
      )}
    </div>
  );
}
