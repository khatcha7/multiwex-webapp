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

export function isOpenOn(dateStr) {
  const d = new Date(dateStr);
  return openingHours[d.getDay()] !== null;
}

export function getHoursForDate(dateStr) {
  const d = new Date(dateStr);
  return openingHours[d.getDay()];
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
export const SLOT_STEP = 5;

export function generateSlotsForActivity(activity, dateStr) {
  const hours = getHoursForDate(dateStr);
  if (!hours || !activity.bookable) return [];
  const openM = toMinutes(hours.open);
  const closeM = toMinutes(hours.close);
  const slots = [];
  for (let t = openM; t + activity.duration <= closeM; t += SLOT_STEP) {
    slots.push({ start: fromMinutes(t), end: fromMinutes(t + activity.duration) });
  }
  return slots;
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
