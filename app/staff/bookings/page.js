'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listBookings, subscribeBookings } from '@/lib/data';
import { toDateStr } from '@/lib/hours';
import EditBookingItemModal from '@/components/staff/EditBookingItemModal';
import AddPlayersModal from '@/components/booking/AddPlayersModal';

export default function StaffBookingsPage() {
  const router = useRouter();
  const [all, setAll] = useState([]);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('all'); // all, online, on_site
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [addPlayersBooking, setAddPlayersBooking] = useState(null);

  useEffect(() => {
    listBookings().then(setAll);
  }, [tick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const filtered = all.filter((b) => {
    if (sourceFilter === 'online' && b.source === 'on_site') return false;
    if (sourceFilter === 'on_site' && b.source !== 'on_site') return false;
    if (dateFrom && (b.date || '') < dateFrom) return false;
    if (dateTo && (b.date || '') > dateTo) return false;
    if (!q) return true;
    const low = q.toLowerCase();
    return (
      (b.id || b.reference || '').toLowerCase().includes(low) ||
      (b.customer?.name || '').toLowerCase().includes(low) ||
      (b.customer?.firstName || '').toLowerCase().includes(low) ||
      (b.customer?.lastName || '').toLowerCase().includes(low) ||
      (b.customer?.email || '').toLowerCase().includes(low) ||
      (b.date || '').includes(low)
    );
  });

  const formatCreatedAt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Réservations</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
            {[['all', 'Tout'], ['online', '💻 En ligne'], ['on_site', '🏢 Sur place']].map(([v, l]) => (
              <button key={v} onClick={() => setSourceFilter(v)} className={`display rounded px-3 py-1 text-xs ${sourceFilter === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/50">Du</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input !py-2 text-sm"
            />
            <span className="text-[10px] uppercase tracking-wider text-white/50">Au</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input !py-2 text-sm"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-[10px] text-white/60 hover:text-mw-pink"
              >
                Reset dates
              </button>
            )}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher ID, nom, email…"
            className="input !py-2 max-w-xs text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-2 py-3 text-center w-8">📅</th>
              <th className="px-2 py-3 text-center w-8"></th>
              <th className="px-3 py-3 text-left">ID</th>
              <th className="px-3 py-3 text-left">Client</th>
              <th className="px-3 py-3 text-left">Commandé le</th>
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Activités</th>
              <th className="px-3 py-3 text-center">Joueurs</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-center">Formule</th>
              <th className="px-3 py-3 text-center">Paiement</th>
              <th className="px-3 py-3 text-center">Source</th>
              <th className="px-3 py-3 text-left">Staff</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3 text-center">+</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((b) => (
              <tr key={b.id || b.reference} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => {
                      sessionStorage.setItem('mw_calendar_highlight', JSON.stringify({ bookingId: b.id || b.reference, date: b.date }));
                      router.push(`/staff/calendar?date=${b.date}&highlight=${b.id || b.reference}`);
                    }}
                    className="text-white/50 hover:text-mw-pink"
                    title="Voir dans le calendrier"
                  >
                    📅
                  </button>
                </td>
                <td className="px-2 py-2 text-center">
                  {(b.items || []).length > 0 ? (
                    <button
                      onClick={() => setEditingItem({ booking: b, item: b.items[0] })}
                      className="text-white/50 hover:text-mw-pink"
                      title={`Édite le créneau de ${b.items[0]?.activityName || b.items[0]?.activity_id || ''}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 7 12 12 15 14" />
                      </svg>
                    </button>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-mw-pink">{b.id || b.reference}</td>
                <td className="px-3 py-2">
                  <div className="display">{b.customer?.name || '—'}</div>
                  <div className="text-[10px] text-white/40">{b.customer?.email}</div>
                </td>
                <td className="px-3 py-2 text-xs text-white/70">{formatCreatedAt(b.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-white/70">{new Date(b.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2 text-[10px] text-white/60">
                  {b.items?.map((i, idx) => <div key={idx}>· {i.activityName || i.activity_id} @ {i.start || i.slot_start}</div>)}
                </td>
                <td className="px-3 py-2 text-center">{b.players}</td>
                <td className="px-3 py-2 text-right font-bold">{(b.total || 0).toFixed(0)}€</td>
                <td className="px-3 py-2 text-center text-xs">
                  {b.packageId ? (
                    <span className="chip chip-pink">{b.packageId.replace('anniv-', 'Anniv ').replace('evg', 'EVG').replace('evjf', 'EVJF').replace('-', ' ')}</span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-[10px] text-white/60">
                  {b.paymentMethod === 'on_site_card' ? '💳 Carte' :
                   b.paymentMethod === 'on_site_cash' ? '💵 Cash' :
                   b.paymentMethod === 'card' ? '💳 CB' :
                   b.paymentMethod === 'bancontact' ? '🇧🇪 Banc.' :
                   b.paymentMethod === 'giftcard' ? '🎁 Cadeau' :
                   b.paymentMethod === 'free' ? '🏷️ Promo' : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`chip ${b.source === 'on_site' ? 'chip-yellow' : ''}`}>
                    {b.source === 'on_site' ? `🏢 ${b.staffName || 'Staff'}` : '💻 En ligne'}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px] text-white/60">{b.staffName || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>
                    {b.paid ? '✓ Payé' : 'Impayé'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <button
                    onClick={() => setAddPlayersBooking(b)}
                    className="text-xs text-mw-pink hover:underline mr-2"
                    title="Ajouter des joueurs"
                  >
                    +
                  </button>
                  <button
                    onClick={async () => {
                      const ref = b.reference || b.id;
                      if (!confirm(`Renvoyer le mail de confirmation pour ${ref} à ${b.customer?.email || 'le client'} ?`)) return;
                      try {
                        const r = await fetch('/api/send-confirmation', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ ref }),
                        });
                        const j = await r.json();
                        if (r.ok && j.ok) alert('✓ Mail renvoyé');
                        else alert('Échec : ' + (j.error?.message || j.error || 'erreur inconnue'));
                      } catch (e) {
                        alert('Erreur : ' + e.message);
                      }
                    }}
                    className="text-xs text-white/60 hover:text-mw-cyan hover:underline"
                    title="Renvoyer le mail de confirmation"
                  >
                    ✉
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-white/40">Aucune réservation.</div>
        )}
      </div>

      <EditBookingItemModal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        booking={editingItem?.booking}
        item={editingItem?.item}
        onSaved={() => { setTick((t) => t + 1); setEditingItem(null); }}
      />

      {addPlayersBooking && (
        <AddPlayersModal
          booking={addPlayersBooking}
          onClose={() => setAddPlayersBooking(null)}
          onUpdated={() => { setTick((t) => t + 1); setAddPlayersBooking(null); }}
        />
      )}
    </div>
  );
}
