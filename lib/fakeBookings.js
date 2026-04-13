import { activities } from './activities';

const names = [
  ['Julie Dubois', 'julie.dubois@example.com'],
  ['Marc Lambert', 'marc.l@example.com'],
  ['Sarah Martens', 'sarah.m@example.com'],
  ['Antoine Leroy', 'a.leroy@example.com'],
  ['Emma Vincent', 'emma.v@example.com'],
  ['Thomas Noël', 't.noel@example.com'],
  ['Léa Hubert', 'lea@example.com'],
  ['Nicolas Faure', 'n.faure@example.com'],
  ['Camille Roy', 'c.roy@example.com'],
  ['Hugo Morel', 'hugo.morel@example.com'],
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

export function generateFakeBookings(count = 200) {
  const bookable = activities.filter((a) => a.bookable);
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const daysAgo = rand(0, 90);
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    const [name, email] = pick(names);
    const players = rand(2, 8);
    const nItems = rand(1, 3);
    const chosen = [];
    const used = new Set();
    for (let j = 0; j < nItems; j++) {
      let a;
      do { a = pick(bookable); } while (used.has(a.id));
      used.add(a.id);
      chosen.push(a);
    }
    const isWed = d.getDay() === 3;
    const items = chosen.map((a, idx) => {
      const unit = isWed ? a.priceWed : a.priceRegular;
      const start = `${14 + idx * 2}:${pick(['00', '30'])}`;
      return { activityId: a.id, activityName: a.name, start, end: start, unit, total: unit * players };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    out.push({
      id: 'MW-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      date: dateStr,
      players,
      items,
      subtotal,
      discount: 0,
      total: subtotal,
      paid: true,
      customer: { name, email, phone: '' },
      createdAt: d.toISOString(),
    });
  }
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
