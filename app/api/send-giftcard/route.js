import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { generateGiftCardPDF } from '@/lib/pdf/generateInvoice';
import { buildGiftCardEmail } from '@/lib/email/giftcardTemplate';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

async function loadConfig(supabase) {
  const { data } = await supabase.from('site_config').select('key, value');
  const map = {};
  (data || []).forEach((row) => { map[row.key] = row.value; });
  return map;
}

export async function POST(req) {
  const rl = checkRateLimit(req, { limit: 5, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });

  try {
    const body = await req.json();
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Lookup serveur — on n'utilise JAMAIS le payload pour les valeurs sensibles
    // (montant, paid, code). Seul le code identifiant est accepté du client.
    const { data: dbCard, error: lookupErr } = await supabase
      .from('giftcards')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (lookupErr || !dbCard) {
      return NextResponse.json({ ok: false, error: 'Giftcard not found' }, { status: 404 });
    }
    if (!dbCard.paid) {
      return NextResponse.json({ ok: false, error: 'Giftcard not paid yet' }, { status: 400 });
    }
    const giftcard = {
      code: dbCard.code,
      amount: parseFloat(dbCard.amount),
      balance: parseFloat(dbCard.balance),
      fromName: dbCard.from_name,
      toName: dbCard.to_name,
      toEmail: dbCard.to_email,
      message: dbCard.message,
    };
    if (!giftcard.toEmail) {
      return NextResponse.json({ ok: false, error: 'No recipient email on giftcard' }, { status: 400 });
    }

    const config = await loadConfig(supabase);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || `https://${req.headers.get('host')}`;

    const company = {
      legalName: config['company.legal_name'],
      bce: config['company.bce'],
      addressStreet: config['company.address_street'],
      addressZip: config['company.address_zip'],
      addressCity: config['company.address_city'],
      website: config['company.website'],
    };

    let pdfBuffer = null;
    try {
      pdfBuffer = await generateGiftCardPDF({ giftcard, company });
    } catch (e) {
      console.error('[send-giftcard] PDF failed', e);
    }

    const { subject, html, text } = buildGiftCardEmail({ giftcard, config, baseUrl });

    if (!apiKey) {
      console.log('[send-giftcard] simulated', giftcard.code);
      return NextResponse.json({ ok: true, simulated: true });
    }

    const resend = new Resend(apiKey);
    const from = `${config['email.from_name'] || 'Multiwex'} <${config['email.from'] || 'onboarding@resend.dev'}>`;
    const attachments = pdfBuffer ? [{
      filename: `carte-cadeau-${giftcard.code}.pdf`,
      content: Buffer.from(pdfBuffer).toString('base64'),
    }] : [];

    const result = await resend.emails.send({
      from,
      to: [giftcard.toEmail],
      reply_to: config['email.reply_to'] || config['contact.email'],
      subject,
      html,
      text,
      attachments,
      headers: { 'X-Entity-Ref-ID': giftcard.code },
    });

    if (result.error) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (e) {
    console.error('[send-giftcard] fatal', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
