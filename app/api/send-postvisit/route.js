import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { buildPostvisitEmail } from '@/lib/email/giftcardTemplate';

export const runtime = 'nodejs';

// Cron Vercel : appelé chaque jour. Trouve les bookings dont la date == today - delay_hours
// et envoie un mail post-visite. Tag les bookings traités via post_visit_sent_at.
export async function GET(req) {
  // Auth obligatoire : CRON_SECRET requis (sinon endpoint exposé publiquement = spam)
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET missing' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: cfg } = await supabase.from('site_config').select('key, value');
  const config = {};
  (cfg || []).forEach((row) => { config[row.key] = row.value; });

  // Default true si pas explicitement set à false dans la config
  const enabled = config['email.postvisit_enabled'] !== false && config['email.postvisit_enabled'] !== 'false';
  if (!enabled) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  // Override date via query (utile pour tests manuels) : ?date=YYYY-MM-DD
  const url = new URL(req.url);
  const dateOverride = url.searchParams.get('date');
  const delayHours = Number(config['email.postvisit_delay_hours']) || 24;
  const target = new Date(Date.now() - delayHours * 3600 * 1000);
  const targetDate = dateOverride || target.toISOString().slice(0, 10);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customers(*)')
    .eq('booking_date', targetDate)
    .is('post_visit_sent_at', null);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, date: targetDate });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  const resend = apiKey ? new Resend(apiKey) : null;
  const from = `${config['email.from_name'] || 'Multiwex'} <${config['email.from'] || 'onboarding@resend.dev'}>`;

  let sent = 0;
  for (const b of bookings) {
    const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    if (!customer?.email) continue;

    const booking = {
      reference: b.reference,
      date: b.booking_date,
      customer: { name: customer.name, email: customer.email },
    };
    const { subject, html, text } = buildPostvisitEmail({ booking, config, baseUrl });

    if (resend) {
      try {
        await resend.emails.send({
          from,
          to: [customer.email],
          reply_to: config['email.reply_to'] || config['contact.email'],
          subject, html, text,
          headers: { 'X-Entity-Ref-ID': b.reference },
        });
        sent++;
      } catch (e) {
        console.error('[postvisit] send failed for', b.reference, e);
      }
    } else {
      console.log('[postvisit] simulated', b.reference);
      sent++;
    }

    // Tag pour ne pas renvoyer
    await supabase.from('bookings').update({ post_visit_sent_at: new Date().toISOString() }).eq('id', b.id);
  }

  return NextResponse.json({ ok: true, sent, date: targetDate });
}
