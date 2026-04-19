// Génère un fichier .ics (RFC 5545) à partir d'une réservation.
// Permet au client d'ajouter la résa à son agenda Google/Apple/Outlook en 1 clic.

function fmtICSDate(date, time) {
  // date: 'YYYY-MM-DD', time: 'HH:MM'
  const [y, m, d] = (date || '').split('-');
  const [h, mn] = (time || '00:00').split(':');
  // Format ICS local : YYYYMMDDTHHMMSS
  return `${y}${m}${d}T${h}${mn}00`;
}

function escapeText(s) {
  if (!s) return '';
  return String(s).replace(/[\\;,\n]/g, (c) => ({ '\\': '\\\\', ';': '\\;', ',': '\\,', '\n': '\\n' }[c]));
}

export function generateBookingICS({ booking, company }) {
  const items = booking.items || [];
  if (items.length === 0) return '';

  // Détermine début/fin globaux : min(start) → max(end) sur la date
  const sorted = [...items].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const firstStart = sorted[0].start;
  const lastEnd = sorted[sorted.length - 1].end;

  const dtStart = fmtICSDate(booking.date, firstStart);
  const dtEnd = fmtICSDate(booking.date, lastEnd);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `${booking.reference || booking.id}@multiwex.be`;

  const summary = `Réservation Multiwex — ${booking.reference || booking.id}`;
  const description = items
    .map((it) => `${it.activityName || it.activityId} ${it.start}-${it.end} (${it.players}j)`)
    .join('\\n');

  const location = company
    ? `${company.legalName}, ${company.addressStreet}, ${company.addressZip} ${company.addressCity}`
    : 'Multiwex, Marche-en-Famenne';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Multiwex//Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Brussels:${dtStart}`,
    `DTEND;TZID=Europe/Brussels:${dtEnd}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel : votre réservation Multiwex est dans 2h',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
