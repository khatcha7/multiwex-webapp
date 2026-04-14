'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { listBookings, subscribeBookings } from '@/lib/data';
import { activities, getActivity } from '@/lib/activities';
import { generateFakeBookings } from '@/lib/fakeBookings';
import { generateSlotsForActivity, isOpenOn, toDateStr, parseDate } from '@/lib/hours';

const PRESETS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7d', label: '7 derniers jours' },
  { id: '30d', label: '30 derniers jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'lastmonth', label: 'Mois passé' },
  { id: 'ytd', label: 'Année en cours' },
  { id: 'all', label: 'Tout' },
];

function getRange(preset, customFrom, customTo) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let prevStart, prevEnd;
  const mkPrev = (days) => {
    const ps = new Date(start); ps.setDate(ps.getDate() - days);
    const pe = new Date(start); pe.setMilliseconds(-1);
    return [ps, pe];
  };
  switch (preset) {
    case 'today':
      [prevStart, prevEnd] = mkPrev(1);
      break;
    case 'yesterday':
      end.setDate(end.getDate() - 1); start.setDate(start.getDate() - 1);
      [prevStart, prevEnd] = mkPrev(1);
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      [prevStart, prevEnd] = mkPrev(7);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      [prevStart, prevEnd] = mkPrev(30);
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
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear(), 0, 1); prevEnd.setMilliseconds(-1);
      break;
    case 'custom':
      if (customFrom) start = new Date(customFrom);
      if (customTo) { end.setTime(new Date(customTo).getTime()); end.setHours(23, 59, 59, 999); }
      prevStart = null; prevEnd = null;
      break;
    default:
      start = new Date(0);
      prevStart = null; prevEnd = null;
  }
  return { start, end, prevStart, prevEnd };
}

export default function StaffReportsPage() {
  const [bookings, setBookings] = useState([]);
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [kpiVisible, setKpiVisible] = useState({
    revenue: true, bookings: true, avgBasket: true, players: true, occupancy: true, newCustomers: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      let fake = JSON.parse(localStorage.getItem('mw_fake_bookings_v3') || 'null');
      if (!fake) {
        fake = generateFakeBookings(300);
        localStorage.setItem('mw_fake_bookings_v3', JSON.stringify(fake));
      }
      const real = await listBookings();
      setBookings([...real, ...fake.filter((f) => !real.find((r) => r.id === f.id))]);
    };
    load();
  }, [tick]);

  useEffect(() => {
    const unsub = subscribeBookings(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getRange(preset, customFrom, customTo);
    const inRange = bookings.filter((b) => {
      const d = new Date(b.createdAt || b.created_at);
      return d >= start && d <= end;
    });
    const prevRange = prevStart ? bookings.filter((b) => {
      const d = new Date(b.createdAt || b.created_at);
      return d >= prevStart && d <= prevEnd;
    }) : [];

    const revenue = inRange.reduce((s, b) => s + (b.total || 0), 0);
    const prevRevenue = prevRange.reduce((s, b) => s + (b.total || 0), 0);
    const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

    const totalPlayers = inRange.reduce((s, b) => s + (b.players || 0), 0);
    const prevPlayers = prevRange.reduce((s, b) => s + (b.players || 0), 0);
    const playersDelta = prevPlayers > 0 ? ((totalPlayers - prevPlayers) / prevPlayers) * 100 : null;

    const count = inRange.length;
    const countDelta = prevRange.length > 0 ? ((count - prevRange.length) / prevRange.length) * 100 : null;

    const avg = count > 0 ? revenue / count : 0;
    const prevAvg = prevRange.length > 0 ? prevRevenue / prevRange.length : 0;
    const avgDelta = prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : null;

    // Per activity stats
    const perActivity = {};
    inRange.forEach((b) => b.items?.forEach((i) => {
      const a = getActivity(i.activityId);
      if (!a) return;
      if (!perActivity[i.activityId]) {
        perActivity[i.activityId] = { name: a.name, logo: a.logo, sessions: 0, players: 0, minutes: 0, revenue: 0 };
      }
      perActivity[i.activityId].sessions += 1;
      perActivity[i.activityId].players += b.players;
      perActivity[i.activityId].minutes += a.duration * b.players;
      perActivity[i.activityId].revenue += i.total || 0;
    }));
    const topActivities = Object.values(perActivity).sort((a, b) => b.revenue - a.revenue);

    // Occupancy rate approximation
    const daysInRange = Math.max(1, Math.ceil((end - start) / 86400000));
    let capacityTotal = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d);
      if (!isOpenOn(ds)) continue;
      activities.filter((a) => a.bookable).forEach((a) => {
        const slots = generateSlotsForActivity(a, ds).length;
        capacityTotal += slots * a.maxPlayers;
      });
    }
    const occupancyRate = capacityTotal > 0 ? (totalPlayers / capacityTotal) * 100 : 0;

    const uniqueCustomers = new Set(inRange.map((b) => b.customer?.email).filter(Boolean)).size;

    return {
      revenue, revenueDelta, totalPlayers, playersDelta, count, countDelta,
      avg, avgDelta, topActivities, occupancyRate, uniqueCustomers,
      inRange, daysInRange,
    };
  }, [bookings, preset, customFrom, customTo]);

  const exportCsv = () => {
    const rows = [
      ['id', 'date', 'client', 'email', 'joueurs', 'total', 'source', 'activités'],
      ...stats.inRange.map((b) => [
        b.id || b.reference,
        b.date,
        b.customer?.name || '',
        b.customer?.email || '',
        b.players,
        b.total,
        b.source || 'online',
        (b.items || []).map((i) => i.activityName || i.activity_id).join('|'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multiwex-reservations-${preset}.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Reports</h1>
        <button onClick={exportCsv} className="btn-outline !py-2 text-xs">📥 Export CSV</button>
      </div>

      {/* Period selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              preset === p.id ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/70 hover:border-white/40'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${
            preset === 'custom' ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/15 text-white/70 hover:border-white/40'
          }`}
        >
          Personnalisé
        </button>
      </div>

      {preset === 'custom' && (
        <div className="mb-4 flex items-center gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input max-w-xs" />
          <span className="text-white/40">→</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input max-w-xs" />
        </div>
      )}

      {/* KPI toggles */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.keys(kpiVisible).map((k) => (
          <label key={k} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1">
            <input
              type="checkbox"
              checked={kpiVisible[k]}
              onChange={(e) => setKpiVisible({ ...kpiVisible, [k]: e.target.checked })}
              className="accent-mw-pink"
            />
            <span className="capitalize text-white/60">{k}</span>
          </label>
        ))}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiVisible.revenue && (
          <KPI label="Chiffre d'affaires" value={`${stats.revenue.toFixed(0)}€`} delta={stats.revenueDelta} accent />
        )}
        {kpiVisible.bookings && (
          <KPI label="Réservations" value={stats.count} delta={stats.countDelta} />
        )}
        {kpiVisible.avgBasket && (
          <KPI label="Panier moyen" value={`${stats.avg.toFixed(0)}€`} delta={stats.avgDelta} />
        )}
        {kpiVisible.players && (
          <KPI label="Joueurs" value={stats.totalPlayers} delta={stats.playersDelta} />
        )}
        {kpiVisible.occupancy && (
          <KPI label="Taux d'occupation" value={`${stats.occupancyRate.toFixed(1)}%`} />
        )}
        {kpiVisible.newCustomers && (
          <KPI label="Clients uniques" value={stats.uniqueCustomers} />
        )}
      </div>

      {/* Top activities */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-4 text-2xl">Stats par activité</h2>
        <div className="space-y-3">
          {stats.topActivities.map((a) => {
            const maxRev = stats.topActivities[0]?.revenue || 1;
            const pct = (a.revenue / maxRev) * 100;
            return (
              <div key={a.name} className="rounded-xl bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-black/40">
                    <Image src={a.logo} alt="" fill sizes="40px" className="object-contain p-1.5" />
                  </div>
                  <div className="display flex-1 text-lg">{a.name}</div>
                  <div className="display text-xl text-mw-pink">{a.revenue.toFixed(0)}€</div>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-mw-red to-mw-pink" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                  <span>🎯 {a.sessions} parties</span>
                  <span>👥 {a.players} joueurs</span>
                  <span>⏱ {a.minutes.toLocaleString()} min</span>
                  <span>💰 avg {a.sessions > 0 ? (a.revenue / a.sessions).toFixed(0) : 0}€/partie</span>
                </div>
              </div>
            );
          })}
          {stats.topActivities.length === 0 && (
            <div className="py-6 text-center text-white/40">Aucune donnée sur cette période.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, delta, accent }) {
  const deltaClass = delta == null ? 'text-white/50' : delta >= 0 ? 'text-green-400' : 'text-red-400';
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-mw-pink/40 bg-mw-pink/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className={`display mt-1 text-2xl md:text-3xl ${accent ? 'text-mw-pink' : 'text-white'}`}>{value}</div>
      {delta != null && (
        <div className={`mt-1 text-xs ${deltaClass}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs préc.
        </div>
      )}
    </div>
  );
}
