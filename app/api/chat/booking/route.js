// POST /api/chat/booking
// Mode "réservation IA" — agent Claude tool-use qui peut réserver en live.
// Séparé de /api/chat (FAQ) pour ne rien casser.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runBookingAgent } from '@/lib/chatbot/bookingAgent';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function isEllieEnabled() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data } = await supabase.from('site_config').select('value').eq('key', 'chatbot.ellie_enabled').maybeSingle();
    const v = data?.value;
    return v === true || v === 'true' || v === 1 || v === '1';
  } catch {
    return false;
  }
}

export async function POST(req) {
  // Kill switch : si Ellie IA désactivée dans les settings → refuse l'appel, zéro token consommé
  if (!(await isEllieEnabled())) {
    return NextResponse.json({
      ok: false,
      error: 'Ellie IA est actuellement désactivée. Contacte le staff via le bouton "Envoyer un email".',
    }, { status: 403 });
  }

  // Rate limit plus strict que FAQ : les appels Claude Opus coûtent cher
  const rl = checkRateLimit(req, { limit: 10, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json({
      ok: false,
      error: 'Trop de messages, réessaie dans une minute.',
    }, { status: 429 });
  }

  try {
    const { history, message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, error: 'Message manquant' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ ok: false, error: 'Message trop long (500 car. max)' }, { status: 400 });
    }

    // baseUrl pour les appels internes à /api/payment/viva/create-order
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const result = await runBookingAgent({
      history: history || [],
      userMessage: message,
      baseUrl,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[chat/booking] error', e);
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
