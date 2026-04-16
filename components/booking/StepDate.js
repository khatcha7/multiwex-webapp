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

export default function StepDate() {
  const { cart, setDate } = useBooking();
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = cart.date ? parseDate(cart.date) : today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { year, month } = viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const isPastMonth = new Date(year, month, 1) < new Date(today.getFullYear(), today.getMonth(), 1);

  const cells = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(year, month, d)));

  const todayStr = toDateStr(today);
  const selectedHours = cart.date ? getHoursForDate(cart.date) : null;
  const selectedDate = cart.date ? parseDate(cart.date) : null;

  const nextMonth = () => {
    const nm = new Date(year, month + 1, 1);
    setViewMonth({ year: nm.getFullYear(), month: nm.getMonth() });
  };
  const prevMonth = () => {
    if (isPastMonth) return;
    const pm = new Date(year, month - 1, 1);
    if (pm < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setViewMonth({ year: pm.getFullYear(), month: pm.getMonth() });
  };

  return (
    <div>
      <h1 className="section-title mb-2">Quand venez-vous&nbsp;?</h1>
      <p className="mb-6 text-white/60">Choisissez votre date de visite.</p>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* Calendrier compact */}
        <div className="flex-1 rounded border border-white/10 bg-mw-surface p-3 md:max-w-sm md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              disabled={isPastMonth || (year === today.getFullYear() && month === today.getMonth())}
              className="flex h-7 w-7 items-center justify-center rounded border border-white/15 text-sm disabled:opacity-20"
            >
              ←
            </button>
            <div className="display text-base">{monthsFr[month]} {year}</div>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded border border-white/15 text-sm hover:border-mw-pink hover:text-mw-pink">
              →
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white/40">
            {dayLabelsFr.map((d) => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={idx} />;
              const open = isOpenOn(cell);
              const isToday = cell === todayStr;
              const active = cart.date === cell;
              const date = parseDate(cell);
              const isWed = date.getDay() === 3;
              const isPastDay = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const disabled = !open || isPastDay;

              return (
                <button
                  key={cell}
                  onClick={() => !disabled && setDate(cell)}
                  disabled={disabled}
                  className={`relative flex flex-col items-center justify-center rounded border py-1 text-center transition ${
                    active
                      ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink'
                      : disabled
                      ? 'cursor-not-allowed border-transparent text-white/20'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {isToday && !active && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-mw-pink" />}
                  <div className="display text-sm leading-none">{date.getDate()}</div>
                  {isWed && !disabled && <div className={`text-[10px] font-bold ${active ? 'text-white' : 'text-mw-pink'}`}>-50%</div>}
                  {isToday && <div className={`text-[10px] ${active ? 'text-white' : 'text-mw-pink'}`}>auj</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horaires + infos du jour à droite */}
        <div className="flex-1 md:max-w-xs">
          {cart.date && selectedDate ? (
            <div className="rounded border border-mw-pink/30 bg-mw-pink/5 p-4">
              <div className="display text-xl">
                {dayLabelsFrFull[selectedDate.getDay()]} {selectedDate.getDate()} {monthsFr[selectedDate.getMonth()]}
              </div>
              {selectedHours ? (
                <>
                  <div className="mt-2 text-sm text-white/70">
                    Ouverture&nbsp;: <span className="display text-lg text-mw-pink">{selectedHours.open} → {selectedHours.close}</span>
                  </div>
                  {selectedDate.getDay() === 3 && (
                    <div className="mt-2 rounded bg-mw-pink/10 p-2 text-center text-sm font-bold text-mw-pink">
                      MERCREDI -50%
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-2 text-sm text-mw-red">Fermé ce jour-là</div>
              )}
              <div className="mt-3 text-[11px] text-white/50">
                Rue des Deux Provinces 1, 6900 Marche-en-Famenne<br />
                +32 (0)84 770 222
              </div>
            </div>
          ) : (
            <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/50">
              ← Sélectionnez une date pour voir les horaires
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
