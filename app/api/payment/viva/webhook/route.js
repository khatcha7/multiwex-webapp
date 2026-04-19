// VivaWallet ISN webhook — appelé par VivaWallet quand un paiement réussit/échoue.
// Doc : https://developer.vivawallet.com/webhooks-for-payments/transaction-payment-created-event/
//
// IMPORTANT : VivaWallet exige un challenge GET avant les notifications POST.
// Au premier ping GET, on doit renvoyer { Key: <random-string> }
// Le merchant configure ensuite cette key dans le dashboard Viva pour valider l'origine.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET : challenge — Viva veut un objet { Key: ... }
export async function GET() {
  const key = process.env.VIVA_WEBHOOK_KEY || 'multiwex-webhook-key-2026-CHANGE-ME';
  return NextResponse.json({ Key: key });
}

// POST : événement de paiement
export async function POST(req) {
  try {
    const body = await req.json();
    // Structure typique :
    // { EventTypeId: 1796, Created, Url, EventData: { OrderCode, StatusId, Amount, ... } }
    const ed = body.EventData || body.eventData || {};
    const orderCode = String(ed.OrderCode || ed.orderCode || '');
    const statusId = ed.StatusId || ed.statusId; // 'F' = Finalized (success)
    const amountCents = ed.Amount || ed.amount; // en cents

    if (!orderCode) {
      console.warn('[viva webhook] missing orderCode', body);
      return NextResponse.json({ ok: false, error: 'Missing OrderCode' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Trouve la booking via le orderCode stocké
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, reference, total, paid')
      .eq('viva_order_code', orderCode)
      .maybeSingle();

    if (!booking) {
      console.warn('[viva webhook] no booking for orderCode', orderCode);
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (statusId === 'F') {
      // Paiement OK → marque comme payé
      await supabase.from('bookings').update({
        paid: true,
        payment_method: 'viva_wallet',
      }).eq('id', booking.id);

      console.log('[viva webhook] booking paid', booking.reference, 'amount', amountCents / 100);
    } else {
      console.log('[viva webhook] non-success status', statusId, 'for', booking.reference);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[viva webhook] error', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
