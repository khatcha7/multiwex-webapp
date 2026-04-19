import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createVivaOrder } from '@/lib/viva';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(req) {
  // Anti-spam : 10 créations d'ordres par minute par IP
  const rl = checkRateLimit(req, { limit: 10, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });

  try {
    const { bookingRef, amount, customer, merchantTrns, customerTrns } = await req.json();
    if (!bookingRef) return NextResponse.json({ ok: false, error: 'Missing bookingRef' }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ ok: false, error: 'Invalid amount' }, { status: 400 });

    // Crée l'ordre Viva
    const { orderCode, checkoutUrl } = await createVivaOrder({
      amount,
      merchantTrns: merchantTrns || bookingRef,
      customerTrns: customerTrns || `Multiwex — Réservation ${bookingRef}`,
      customer: customer || {},
    });

    // Stocke le mapping orderCode → bookingRef en DB pour pouvoir confirmer au retour
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    // Met à jour la booking si elle existe déjà
    await supabase.from('bookings').update({
      viva_order_code: orderCode,
    }).eq('reference', bookingRef);

    return NextResponse.json({ ok: true, orderCode, checkoutUrl });
  } catch (e) {
    console.error('[viva/create-order] error', e);
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
