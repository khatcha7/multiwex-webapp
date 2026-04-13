'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { generateFakeBookings } from '@/lib/fakeBookings';
import { activities, getActivity } from '@/lib/activities';

const PRESETS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7d', label: '7 derniers jours' },
  { id: '30d', label: '30 derniers jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'lastmonth', label: 'Mois passé' },
  { id: 'all', label: 'Tout' },
];

function getRange(preset) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let prevStart, prevEnd;
  switch (preset) {
    case 'today':
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
      break;
    case 'yesterday':
      end.setDate(end.getDate() - 1); start.setDate(start.getDate() - 1);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 30);
      prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 1); prevEnd.setMilliseconds(-1);
      break;
    case 'lastmonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 1); prevEnd.setMilliseconds(-1);
      break;
    default:
      start = new Date(0);
      prevStart = null; prevEnd = null;
  }
  return { start, end, prevStart, prevEnd };
}

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState('');
  const [bookings, setBookings] = useState([]);
  const [preset, setPreset] = useState('30d');

  useEffect(() => {
    if (sessionStorage.getItem('mw_admin') === '1') setAuth(true);
    const existing = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    const cacheKey = 'mw_fake_bookings_v2';
    let fake = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (!fake) {
      fake = generateFakeBookings(200);
      localStorage.setItem(cacheKey, JSON.stringify(fake));
    }
    setBookings([...existing, ...fake]);
  }, []);

  const stats = useMemo(() => {
    if (!bookings.length) return null;
    const { start, end, prevStart, prevEnd } = getRange(preset);
    const inRange = bookings.filter((b) => {
      const d = new Date(b.createdAt);
      return d >= start && d <= end;
    });
    const prevRange = prevStart
      ? bookings.filter((b) => {
          const d = new Date(b.createdAt);
          return d >= prevStart && d <= prevEnd;
        })
      : [];
    const revenue = inRange.reduce((s, b) => s + b.total, 0);
    const prevRevenue = prevRange.reduce((s, b) => s + b.total, 0);
    const evolution = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
    const totalPlayers = inRange.reduce((s, b) => s + b.players, 0);
    const avgBasket = inRange.length > 0 ? revenue / inRange.length : 0;

    const perActivity = {};
    inRange.forEach((b) => b.items.forEach((i) => {
      const a = getActivity(i.activityId);
      if (!a) return;
      if (!perActivity[i.activityId]) {
        perActivity[i.activityId] = { name: a.name, logo: a.logo, sessions: 0, players: 0, minutes: 0, revenue: 0 };
      }
      perActivity[i.activityId].sessions += 1;
      perActivity[i.activityId].players += b.players;
      perActivity[i.activityId].minutes += a.duration * b.players;
      perActivity[i.activityId].revenue += i.total;
    }));
    const topActivities = Object.values(perActivity).sort((a, b) => b.revenue - a.revenue);

    return { revenue, prevRevenue, evolution, totalPlayers, avgBasket, count: inRange.length, topActivities, recent: inRange.slice(0, 20) };
  }, [bookings, preset]);

  if (!auth) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <h1 className="section-title mb-2 text-center">Admin</h1>
        <p className="mb-6 text-center text-white/60">Code démo&nbsp;: <code className="text-mw-pink">admin</code></p>
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Admin</h1>
        <button onClick={() => { sessionStorage.removeItem('mw_admin'); setAuth(false); }} className="btn-outline text-sm">Quitter</button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              preset === p.id ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/70 hover:border-white/40'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Chiffre d'affaires" value={`${stats.revenue.toFixed(0)}€`} sub={stats.evolution !== null && (
          <span className={stats.evolution >= 0 ? 'text-mw-pink' : 'text-mw-red'}>
            {stats.evolution >= 0 ? '↑' : '↓'} {Math.abs(stats.evolution).toFixed(0)}% vs période préc.
          </span>
        )} accent />
        <KPI label="Réservations" value={stats.count} />
        <KPI label="Panier moyen" value={`${stats.avgBasket.toFixed(0)}€`} />
        <KPI label="Joueurs" value={stats.totalPlayers} />
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-4 text-2xl">Stats par activité</h2>
        <div className="space-y-3">
          {stats.topActivities.map((a) => {
            const maxRev = stats.topActivities[0].revenue;
            const pct = maxRev > 0 ? (a.revenue / maxRev) * 100 : 0;
            return (
              <div key={a.name} className="rounded-xl bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-black/40">
                    <Image src={a.logo} alt="" fill className="object-contain p-1.5" sizes="40px" />
                  </div>
                  <div className="display flex-1 text-lg">{a.name}</div>
                  <div className="display text-xl text-mw-pink">{a.revenue.toFixed(0)}€</div>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-mw-pink to-mw-pink/60" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                  <span>🎯 {a.sessions} parties</span>
                  <span>👥 {a.players} joueurs</span>
                  <span>⏱ {a.minutes.toLocaleString()} min jouées</span>
                </div>
              </div>
            );
          })}
          {stats.topActivities.length === 0 && (
            <div className="py-6 text-center text-white/40">Aucune réservation sur cette période.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-4 text-2xl">Dernières réservations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-white/50">
              <tr><th className="pb-2">ID</th><th className="pb-2">Client</th><th className="pb-2">Date</th><th className="pb-2">Activités</th><th className="pb-2 text-right">Total</th></tr>
            </thead>
            <tbody>
              {stats.recent.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="py-2 font-mono text-xs text-mw-pink">{b.id}</td>
                  <td className="py-2">{b.customer.name}</td>
                  <td className="py-2 text-white/70">{new Date(b.createdAt).toLocaleDateString('fr-FR')}</td>
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
      <div className={`display mt-1 text-3xl md:text-4xl ${accent ? 'text-mw-pink' : 'text-white'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  );
}
