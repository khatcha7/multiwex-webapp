// Seed la table `activities` depuis lib/activities.js (source de vérité).
// Usage : node scripts/seed-activities.mjs [staging|prod]
//   - sans argument : utilise NEXT_PUBLIC_SUPABASE_URL/KEY de l'env (donc .env.local = staging par défaut)
//   - "prod" : utilise les credentials prod hardcodés

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charge .env.local manuellement (pas de dotenv requis)
try {
  const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
  env.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch {}

const TARGETS = {
  staging: {
    url: 'https://hetmxvinccqgyfelpjpp.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhldG14dmluY2NxZ3lmZWxwanBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTcwMDUsImV4cCI6MjA5MjAzMzAwNX0.7uE_NG1rOPOHZoMV3d72S-4DN11of54rb_C0-UmYpVA',
  },
  prod: {
    url: 'https://yvrlnylguwgouuacqqsk.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cmxueWxndXdnb3V1YWNxcXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTY5OTcsImV4cCI6MjA5MjAzMjk5N30.R_mtp7vBrMRp1L03GAPxHhiEbADNAgu34MtutrYsmeg',
  },
};

const target = process.argv[2];
const conf = TARGETS[target] || {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
if (!conf.url || !conf.key) {
  console.error('Missing URL/KEY. Pass `staging` or `prod`, or set env vars.');
  process.exit(1);
}

console.log(`→ seeding into ${conf.url}`);
const supabase = createClient(conf.url, conf.key);

// Import dynamic du catalogue (ESM)
const { activities } = await import('../lib/activities.js');

const rows = activities.map((a) => ({
  id: a.id,
  name: a.name,
  tagline: a.tagline ?? null,
  duration_min: a.duration ?? 0,
  price_regular: a.priceRegular ?? 0,
  price_wed: a.priceWed ?? 0,
  max_players: a.maxPlayers ?? 0,
  bookable: a.bookable ?? false,
  walk_in: a.walkIn ?? false,
  external_url: a.external ?? null,
  logo_path: a.logo ?? null,
  image_path: a.image ?? null,
  description: a.description ?? null,
  // Tout ce qui ne tient pas dans les colonnes va dans restrictions (jsonb)
  restrictions: {
    minPlayers: a.minPlayers ?? 1,
    privative: a.privative ?? false,
    selectable: a.selectable ?? false,
    bufferMin: a.bufferMin ?? 0,
    rooms: a.rooms ?? null,
  },
}));

const { data, error } = await supabase.from('activities').upsert(rows, { onConflict: 'id' }).select();
if (error) {
  console.error('❌ seed failed:', error);
  process.exit(1);
}
console.log(`✅ ${data.length} activities upserted into ${target || '(env target)'}`);
data.forEach((d) => console.log(`   - ${d.id} : ${d.name}`));
