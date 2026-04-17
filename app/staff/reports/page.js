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

    // --- PROMO CODES ---
    const promoCodes = {};
    inRange.forEach((b) => {
      const code = b.promoCode || b.promo_code;
      if (!code) return;
      if (!promoCodes[code]) promoCodes[code] = { uses: 0, revenue: 0, activities: {} };
      promoCodes[code].uses += 1;
      promoCodes[code].revenue += (b.total || 0);
      (b.items || []).forEach((i) => {
        const name = i.activityName || i.activity_id || '?';
        promoCodes[code].activities[name] = (promoCodes[code].activities[name] || 0) + 1;
      });
    });
    const promoList = Object.entries(promoCodes).map(([code, data]) => ({
      code,
      uses: data.uses,
      revenue: data.revenue,
      avgBasket: data.uses > 0 ? data.revenue / data.uses : 0,
      topActivity: Object.entries(data.activities).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
    })).sort((a, b) => b.revenue - a.revenue);

    // --- LTV / RÉCURRENCE ---
    const clientMap = {};
    inRange.forEach((b) => {
      const email = b.customer?.email;
      if (!email) return;
      if (!clientMap[email]) clientMap[email] = { name: b.customer?.name || b.customer?.firstName || email, visits: 0, spent: 0 };
      clientMap[email].visits += 1;
      clientMap[email].spent += (b.total || 0);
    });
    const clients = Object.values(clientMap).sort((a, b) => b.spent - a.spent);
    const avgVisits = clients.length > 0 ? clients.reduce((s, c) => s + c.visits, 0) / clients.length : 0;
    const avgLtv = clients.length > 0 ? clients.reduce((s, c) => s + c.spent, 0) / clients.length : 0;
    const repeatRate = clients.length > 0 ? (clients.filter((c) => c.visits > 1).length / clients.length) * 100 : 0;

    // --- CONVERSION FUNNEL (fake data for demo) ---
    const funnelSeed = inRange.length || 1;
    const funnel = {
      visits: Math.round(funnelSeed * 8.5),
      dateSelected: Math.round(funnelSeed * 6.2),
      activitiesSelected: Math.round(funnelSeed * 4.8),
      playersSet: Math.round(funnelSeed * 3.9),
      slotsChosen: Math.round(funnelSeed * 3.2),
      checkout: Math.round(funnelSeed * 2.1),
      paid: funnelSeed,
    };

    // --- DEVICE BREAKDOWN (fake data for demo) ---
    const devices = {
      mobile: Math.round(funnelSeed * 0.58),
      desktop: Math.round(funnelSeed * 0.35),
      tablet: Math.round(funnelSeed * 0.07),
    };

    // --- SOURCE (fake data for demo) ---
    const sources = {
      direct: Math.round(funnelSeed * 0.32),
      google: Math.round(funnelSeed * 0.41),
      social: Math.round(funnelSeed * 0.18),
      referral: Math.round(funnelSeed * 0.09),
    };

    return {
      revenue, revenueDelta, totalPlayers, playersDelta, count, countDelta,
      avg, avgDelta, topActivities, occupancyRate, uniqueCustomers,
      inRange, daysInRange,
      promoList, clients, avgVisits, avgLtv, repeatRate,
      funnel, devices, sources,
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

      {/* CONVERSION FUNNEL */}
      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-4 text-2xl">Tunnel de conversion</h2>
        <div className="space-y-2">
          {[
            ['Visites page', stats.funnel.visits],
            ['Date sélectionnée', stats.funnel.dateSelected],
            ['Activités choisies', stats.funnel.activitiesSelected],
            ['Joueurs configurés', stats.funnel.playersSet],
            ['Créneaux choisis', stats.funnel.slotsChosen],
            ['Checkout (récap)', stats.funnel.checkout],
            ['Paiement effectué', stats.funnel.paid],
          ].map(([label, val], idx, arr) => {
            const pct = arr[0][1] > 0 ? (val / arr[0][1] * 100) : 0;
            const dropFromPrev = idx > 0 && arr[idx - 1][1] > 0 ? ((1 - val / arr[idx - 1][1]) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <div className="w-40 text-xs text-white/70 shrink-0">{label}</div>
                <div className="flex-1">
                  <div className="h-6 rounded bg-white/10 overflow-hidden">
                    <div className="h-full rounded bg-gradient-to-r from-mw-pink to-mw-pink/60 flex items-center px-2 text-[10px] font-bold text-white" style={{ width: `${Math.max(pct, 5)}%` }}>
                      {val}
                    </div>
                  </div>
                </div>
                <div className="w-12 text-right text-xs text-white/60">{pct.toFixed(0)}%</div>
                {idx > 0 && dropFromPrev > 0 && (
                  <div className="w-16 text-right text-[10px] text-red-400">-{dropFromPrev.toFixed(0)}%</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Taux de conversion</div>
            <div className="display text-2xl text-mw-pink">{stats.funnel.visits > 0 ? (stats.funnel.paid / stats.funnel.visits * 100).toFixed(1) : 0}%</div>
          </div>
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Abandon moyen</div>
            <div className="display text-2xl text-red-400">{stats.funnel.visits > 0 ? ((1 - stats.funnel.paid / stats.funnel.visits) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Panier moyen abandonné</div>
            <div className="display text-2xl text-white">{stats.avg > 0 ? (stats.avg * 1.2).toFixed(0) : 0}€</div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-white/30">Données de démonstration — en prod, tracking réel via événements.</p>
      </div>

      {/* CODES PROMOS */}
      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-4 text-2xl">Codes promos</h2>
        {stats.promoList.length === 0 ? (
          <div className="py-6 text-center text-white/40">Aucun code promo utilisé sur cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-right">Utilisations</th>
                  <th className="py-2 text-right">CA généré</th>
                  <th className="py-2 text-right">Panier moyen</th>
                  <th className="py-2 text-left">Top activité</th>
                </tr>
              </thead>
              <tbody>
                {stats.promoList.map((p) => (
                  <tr key={p.code} className="border-b border-white/5">
                    <td className="py-2 font-mono text-mw-pink">{p.code}</td>
                    <td className="py-2 text-right">{p.uses}</td>
                    <td className="py-2 text-right font-bold">{p.revenue.toFixed(0)}€</td>
                    <td className="py-2 text-right">{p.avgBasket.toFixed(0)}€</td>
                    <td className="py-2 text-white/60">{p.topActivity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LTV / RÉCURRENCE */}
      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-4 text-2xl">Clients & récurrence</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Clients uniques</div>
            <div className="display text-2xl text-mw-pink">{stats.uniqueCustomers}</div>
          </div>
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Visites moy. / client</div>
            <div className="display text-2xl text-white">{stats.avgVisits.toFixed(1)}</div>
          </div>
          <div className="rounded bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase text-white/50">Taux de récurrence</div>
            <div className="display text-2xl text-green-400">{stats.repeatRate.toFixed(0)}%</div>
          </div>
        </div>
        <div className="mb-2 text-xs text-white/50">LTV moyenne : <span className="display text-mw-pink">{stats.avgLtv.toFixed(0)}€</span> par client</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/50">
              <tr>
                <th className="py-2 text-left">Client</th>
                <th className="py-2 text-right">Visites</th>
                <th className="py-2 text-right">Total dépensé</th>
              </tr>
            </thead>
            <tbody>
              {stats.clients.slice(0, 10).map((c, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5 text-right">{c.visits}</td>
                  <td className="py-1.5 text-right font-bold text-mw-pink">{c.spent.toFixed(0)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEVICE & SOURCE */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-mw-surface p-5">
          <h2 className="display mb-4 text-xl">Appareils</h2>
          {Object.entries(stats.devices).map(([device, count]) => {
            const total = Object.values(stats.devices).reduce((s, v) => s + v, 0) || 1;
            const pct = (count / total) * 100;
            const labels = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablette' };
            return (
              <div key={device} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/70">{labels[device] || device}</span>
                  <span className="text-mw-pink">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-mw-pink" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="mt-2 text-[10px] text-white/30">Données de démonstration.</p>
        </div>

        <div className="rounded border border-white/10 bg-mw-surface p-5">
          <h2 className="display mb-4 text-xl">Sources de trafic</h2>
          {Object.entries(stats.sources).map(([source, count]) => {
            const total = Object.values(stats.sources).reduce((s, v) => s + v, 0) || 1;
            const pct = (count / total) * 100;
            const labels = { direct: 'Direct', google: 'Google / SEO', social: 'Réseaux sociaux', referral: 'Recommandation' };
            return (
              <div key={source} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/70">{labels[source] || source}</span>
                  <span className="text-mw-pink">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-mw-pink to-[#7b00e0]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="mt-2 text-[10px] text-white/30">Données de démonstration.</p>
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
