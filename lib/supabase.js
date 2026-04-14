'use client';
import { createClient } from '@supabase/supabase-js';

// Client Supabase — fonctionne offline si les env vars ne sont pas définies
// (retombera sur le fallback localStorage pour la démo autonome).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);
