// Rate limit in-memory simple (par instance serverless Vercel).
// Pour un rate limit distribué cross-instance, utiliser Vercel KV ou Upstash Redis.
// Suffisant pour empêcher le spam basique sur les endpoints mail.

const buckets = new Map(); // ip → { count, resetAt }

export function checkRateLimit(req, { limit = 10, windowSec = 60 } = {}) {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const key = `${ip}|${new URL(req.url).pathname}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetIn: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { ok: true, remaining: limit - bucket.count };
}

// Cleanup périodique (les buckets expirés s'accumulent sinon)
let cleanupTimer = null;
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }, 60_000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}
startCleanup();
