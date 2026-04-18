export const openingHours = {
  0: { open: '10:00', close: '20:00' },
  1: null,
  2: null,
  3: { open: '12:00', close: '21:00' },
  4: { open: '14:00', close: '22:00' },
  5: { open: '14:00', close: '23:00' },
  6: { open: '10:00', close: '23:00' },
};

// JS getDay() : 0=Dim, 1=Lun ... 6=Sam — mapping interne
export const dayLabelsFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const dayLabelsFrFull = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Pour affichage calendrier commençant par lundi
export const dayLabelsFrMondayFirst = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const dayLabelsFrFullMondayFirst = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// Convertit getDay() (0=dim) en index lundi-first (0=lun)
export function dayToMondayIndex(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }
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

// Toujours formaté en heure de Bruxelles (le centre est en Belgique)
const TZ = 'Europe/Brussels';

export function toDateStr(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date); // en-CA → YYYY-MM-DD
}

export function isToday(dateStr) {
  return toDateStr(new Date()) === dateStr;
}

export function nowMinutesBrussels() {
  const fmt = new Intl.DateTimeFormat('fr-BE', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const m = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return h * 60 + m;
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

// Plus de buffer entre activités — les groupes peuvent se splitter et
// faire plusieurs activités en parallèle. Seul le cutoff "rejoindre un
// créneau" s'applique encore (10 min avant start, briefing sécurité).
export const BUFFER_MIN = 0;
// Cutoff pour REJOINDRE un créneau existant (briefing) — sur place seulement
export const JOIN_CUTOFF_MIN_ONSITE = 0;
// Fermeture auto des créneaux en LIGNE X min avant le start (le client ne peut plus réserver)
export const CLOSURE_MIN_ONLINE = 30;
// Pas de cutoff online pour rejoindre — c'est la closure qui gère
export const JOIN_CUTOFF_MIN_ONLINE = 0;

export function generateSlotsForActivity(activity, dateStr, { fullDay = false } = {}) {
  const hours = getHoursForDate(dateStr);
  if (!activity.bookable && !activity.selectable) return [];

  const openM = fullDay ? 0 : (hours ? toMinutes(hours.open) : 0);
  const closeM = fullDay ? 1440 : (hours ? toMinutes(hours.close) : 0);
  if (openM >= closeM && !fullDay) return [];

  const step = activity.duration + (activity.bufferMin || 0);
  const slots = [];

  let minStart = openM;
  if (!fullDay && isToday(dateStr)) {
    const nowM = nowMinutesBrussels();
    minStart = Math.max(openM, Math.ceil(nowM / step) * step);
  }

  for (let t = minStart; t + activity.duration <= closeM; t += step) {
    slots.push({ start: fromMinutes(t), end: fromMinutes(t + activity.duration) });
  }
  return slots;
}

// Fake booked slots for demo — deterministic per date+activity
// Returns both "full" (complete) and "partial" (some players)
export function getFakeOccupiedSlots(activity, dateStr) {
  const seed = (dateStr + activity.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (offset = 0) => ((seed + offset) * 9301 + 49297) % 233280 / 233280;
  const all = generateSlotsForActivity(activity, dateStr);
  if (all.length === 0) return { full: [], partial: {} };

  const fullCount = Math.floor(all.length * 0.12);
  const partialCount = Math.floor(all.length * (activity.privative ? 0.18 : 0.35));
  const full = new Set();
  for (let i = 0; i < fullCount; i++) {
    const idx = Math.floor(rand(i * 3) * all.length);
    full.add(all[idx].start);
  }
  const partial = {};
  for (let i = 0; i < partialCount; i++) {
    const idx = Math.floor(rand(i * 7 + 100) * all.length);
    const slot = all[idx].start;
    if (full.has(slot)) continue;
    if (partial[slot]) continue;
    // Generate 1-3 groups with players 2-4 each
    const groups = Math.floor(rand(i * 11 + 200) * 2) + 1;
    const playersPerGroup = Math.floor(rand(i * 13 + 300) * 3) + 2;
    const players = Math.min(groups * playersPerGroup, activity.maxPlayers - 1);
    partial[slot] = { groups, players };
  }
  return { full: [...full], partial };
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
