'use client';
import { useEffect, useMemo, useState } from 'react';
import { generateFakeBookings } from '@/lib/fakeBookings';
import { activities } from '@/lib/activities';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState('');
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (sessionStorage.getItem('mw_admin') === '1') setAuth(true);
    const existing = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    let fake = JSON.parse(localStorage.getItem('mw_fake_bookings') || 'null');
    if (!fake) {
      fake = generateFakeBookings(80);
      localStorage.setItem('mw_fake_bookings', JSON.stringify(fake));
    }
    setBookings([...existing, ...fake]);
  }, []);

  const stats = useMemo(() => {
    if (!bookings.length) return null;
    const now = new Date();
    const thisMonth = bookings.filter((b) => {
      const d = new Date(b.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const revenue = bookings.reduce((s, b) => s + b.total, 0);
    const revenueMonth = thisMonth.reduce((s, b) => s + b.total, 0);
    const byActivity = {};
    bookings.forEach((b) => b.items.forEach((i) => {
      byActivity[i.activityName] = (byActivity[i.activityName] || 0) + i.total;
    }));
    const topActivities = Object.entries(byActivity).sort((a, b) => b[1] - a[1]);
    const avgBasket = revenue / bookings.length;
    const totalPlayers = bookings.reduce((s, b) => s + b.players, 0);
    return { revenue, revenueMonth, topActivities, avgBasket, totalPlayers, count: bookings.length, monthCount: thisMonth.length };
  }, [bookings]);

  if (!auth) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <h1 className="section-title mb-2 text-center">Admin</h1>
        <p className="mb-6 text-center text-white/60">Code d'accès démo&nbsp;: <code className="text-mw-pink">admin</code></p>
        <div className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pw === 'admin' && (sessionStorage.setItem('mw_admin', '1'), setAuth(true))}
            className="input"
            placeholder="Code d'accès"
          />
          <button
            onClick={() => pw === 'admin' && (sessionStorage.setItem('mw_admin', '1'), setAuth(true))}
            className="btn-primary w-full"
          >
            Accéder
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Dashboard admin</h1>
        <button onClick={() => { sessionStorage.removeItem('mw_admin'); setAuth(false); }} className="btn-outline text-sm">Quitter</button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Chiffre d'affaires" value={`${stats.revenue.toFixed(0)}€`} sub={`${stats.count} résas`} accent />
        <KPI label="CA ce mois" value={`${stats.revenueMonth.toFixed(0)}€`} sub={`${stats.monthCount} résas`} />
        <KPI label="Panier moyen" value={`${stats.avgBasket.toFixed(0)}€`} />
        <KPI label="Joueurs total" value={stats.totalPlayers} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Top activités (CA)</h2>
          <div className="space-y-2">
            {stats.topActivities.slice(0, 6).map(([name, total]) => {
              const pct = (total / stats.topActivities[0][1]) * 100;
              return (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="font-mono text-mw-pink">{total.toFixed(0)}€</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-mw-pink to-mw-pink/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-bold">Activités</h2>
          <div className="text-sm text-white/70">
            <div className="flex justify-between"><span>Réservables</span><span className="font-bold text-white">{activities.filter((a) => a.bookable).length}</span></div>
            <div className="flex justify-between"><span>Externes</span><span className="font-bold text-white">{activities.filter((a) => !a.bookable && !a.walkIn).length}</span></div>
            <div className="flex justify-between"><span>Walk-in</span><span className="font-bold text-white">{activities.filter((a) => a.walkIn).length}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold">Dernières réservations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-white/50">
              <tr><th className="pb-2">ID</th><th className="pb-2">Client</th><th className="pb-2">Date</th><th className="pb-2">Activités</th><th className="pb-2 text-right">Total</th></tr>
            </thead>
            <tbody>
              {bookings.slice(0, 20).map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="py-2 font-mono text-xs text-mw-pink">{b.id}</td>
                  <td className="py-2">{b.customer.name}</td>
                  <td className="py-2 text-white/70">{new Date(b.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 text-xs text-white/60">{b.items.map((i) => i.activityName).join(', ')}</td>
                  <td className="py-2 text-right font-bold">{b.total.toFixed(0)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-mw-pink/40 bg-mw-pink/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className={`mt-1 text-3xl font-black ${accent ? 'text-mw-pink' : 'text-white'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-white/50">{sub}</div>}
    </div>
  );
}
