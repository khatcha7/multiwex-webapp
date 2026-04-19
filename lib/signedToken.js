// HMAC signed token utility for protecting endpoints accessible via mail links
// (e.g. /api/invoice?ref=X&token=Y).
//
// Usage server-side only (uses Node crypto). Reads INVOICE_TOKEN_SECRET env var,
// falls back to CRON_SECRET (re-using for simplicity), then NEXTAUTH_SECRET.

import crypto from 'node:crypto';

function getSecret() {
  const s = process.env.INVOICE_TOKEN_SECRET || process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('Missing INVOICE_TOKEN_SECRET / CRON_SECRET env var');
  return s;
}

export function signRef(ref) {
  if (!ref) return '';
  return crypto.createHmac('sha256', getSecret()).update(String(ref)).digest('hex').slice(0, 32);
}

export function verifyRef(ref, token) {
  if (!ref || !token) return false;
  try {
    const expected = signRef(ref);
    if (!expected || expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}
