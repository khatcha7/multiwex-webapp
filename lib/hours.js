export const openingHours = {
  0: { open: '10:00', close: '20:00' },
  1: null,
  2: null,
  3: { open: '12:00', close: '21:00' },
  4: { open: '14:00', close: '22:00' },
  5: { open: '14:00', close: '23:00' },
  6: { open: '10:00', close: '23:00' },
};

export const dayLabelsFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const dayLabelsFrFull = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function isOpenOn(dateStr) {
  const d = parseDate(dateStr);
  return openingHours[d.getDay()] !== null;
}

export function getHoursForDate(dateStr) {
  const d = parseDate(dateStr);
  return openingHours[d.getDay()];
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isToday(dateStr) {
  return toDateStr(new Date()) === dateStr;
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const BUFFER_MIN = 10;

export function generateSlotsForActivity(activity, dateStr) {
  const hours = getHoursForDate(dateStr);
  if (!hours || !activity.bookable) return [];
  const openM = toMinutes(hours.open);
  const closeM = toMinutes(hours.close);
  const step = activity.duration;
  const slots = [];

  let minStart = openM;
  if (isToday(dateStr)) {
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    minStart = Math.max(openM, Math.ceil(nowM / step) * step);
  }

  for (let t = minStart; t + activity.duration <= closeM; t += step) {
    slots.push({ start: fromMinutes(t), end: fromMinutes(t + activity.duration) });
  }
  return slots;
}

// Fake booked slots for demo — deterministic per date+activity
export function getFakeOccupiedSlots(activity, dateStr) {
  const seed = (dateStr + activity.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (offset = 0) => ((seed + offset) * 9301 + 49297) % 233280 / 233280;
  const all = generateSlotsForActivity(activity, dateStr);
  if (all.length === 0) return [];
  const count = Math.floor(all.length * 0.25);
  const occupied = new Set();
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand(i * 3) * all.length);
    occupied.add(all[idx].start);
  }
  return [...occupied];
}

export function slotConflicts(existingBookings, candidate, activity) {
  const cStart = toMinutes(candidate.start);
  const cEnd = cStart + activity.duration;
  for (const b of existingBookings) {
    const bStart = toMinutes(b.start);
    const bEnd = bStart + b.duration;
    const overlap = cStart < bEnd + BUFFER_MIN && cEnd + BUFFER_MIN > bStart;
    if (overlap) return true;
  }
  return false;
}
