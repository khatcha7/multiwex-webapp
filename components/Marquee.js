'use client';
import { useEffect, useState } from 'react';
import { openingHours, dayLabelsFrFull } from '@/lib/hours';

function getCurrentStatus() {
  const now = new Date();
  const today = openingHours[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  if (today) {
    const open = toMin(today.open);
    const close = toMin(today.close);
    if (minutes >= open && minutes < close) {
      return `OUVERT AUJOURD'HUI JUSQU'À ${today.close}`;
    }
    if (minutes < open) {
      return `OUVERTURE AUJOURD'HUI À ${today.open}`;
    }
  }
  // trouver prochain jour ouvert
  for (let i = 1; i <= 7; i++) {
    const nextDay = (now.getDay() + i) % 7;
    if (openingHours[nextDay]) {
      return `ACTUELLEMENT FERMÉ · OUVERTURE ${dayLabelsFrFull[nextDay].toUpperCase()} DE ${openingHours[nextDay].open} À ${openingHours[nextDay].close}`;
    }
  }
  return 'MULTIWEX · MARCHE-EN-FAMENNE';
}

export default function Marquee() {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(getCurrentStatus());
    const id = setInterval(() => setText(getCurrentStatus()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!text) return null;

  const phrase = `${text} · `;
  const items = Array.from({ length: 12 }).map((_, i) => phrase).join('');

  return (
    <div className="relative z-20 overflow-hidden" style={{ transform: 'rotate(-1.5deg)', marginTop: '-4px', marginBottom: '-4px' }}>
      <div
        className="flex items-center whitespace-nowrap py-2 font-display uppercase text-sm tracking-wider text-white"
        style={{
          background: 'linear-gradient(90deg, #F3D10B 0%, #FF8A00 20%, #FF007D 45%, #B200D9 62%, #00D9FF 82%, #07EFFE 100%)',
          animation: 'mw-marquee 28s linear infinite',
          minWidth: '200%',
        }}
      >
        <span>{items}</span>
        <span aria-hidden="true">{items}</span>
      </div>
      <style>{`
        @keyframes mw-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
