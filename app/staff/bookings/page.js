'use client';
import { useEffect, useState } from 'react';
import { listBookings, subscribeBookings } from '@/lib/data';
import { toDateStr } from '@/lib/hours';

export default function StaffBookingsPage() {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    listBookings().then(setAll);
  }, [tick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const filtered = all.filter((b) => {
    if (!q) return true;
    const low = q.toLowerCase();
    return (
      (b.id || b.reference || '').toLowerCase().includes(low) ||
      (b.customer?.name || '').toLowerCase().includes(low) ||
      (b.customer?.email || '').toLowerCase().includes(low) ||
      (b.date || '').includes(low)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="section-title">Réservations</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher ID, client, email, date…"
          className="input max-w-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-3 py-3 text-left">ID</th>
              <th className="px-3 py-3 text-left">Client</th>
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Activités</th>
              <th className="px-3 py-3 text-center">Joueurs</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-center">Source</th>
              <th className="px-3 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((b) => (
              <tr key={b.id || b.reference} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-xs text-mw-pink">{b.id || b.reference}</td>
                <td className="px-3 py-2">
                  <div className="display">{b.customer?.name || '—'}</div>
                  <div className="text-[10px] text-white/40">{b.customer?.email}</div>
                </td>
                <td className="px-3 py-2 text-xs text-white/70">{new Date(b.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2 text-[10px] text-white/60">
                  {b.items?.map((i, idx) => <div key={idx}>· {i.activityName || i.activity_id} @ {i.start || i.slot_start}</div>)}
                </td>
                <td className="px-3 py-2 text-center">{b.players}</td>
                <td className="px-3 py-2 text-right font-bold">{(b.total || 0).toFixed(0)}€</td>
                <td className="px-3 py-2 text-center">
                  <span className={`chip ${b.source === 'on_site' ? 'chip-yellow' : ''}`}>
                    {b.source === 'on_site' ? '🏢 Sur place' : '💻 En ligne'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>
                    {b.paid ? '✓ Payé' : 'Impayé'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-white/40">Aucune réservation.</div>
        )}
      </div>
    </div>
  );
}
