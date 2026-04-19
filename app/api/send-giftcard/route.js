import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { generateGiftCardPDF } from '@/lib/pdf/generateInvoice';
import { buildGiftCardEmail } from '@/lib/email/giftcardTemplate';

export const runtime = 'nodejs';

async function loadConfig(supabase) {
  const { data } = await supabase.from('site_config').select('key, value');
  const map = {};
  (data || []).forEach((row) => { map[row.key] = row.value; });
  return map;
}

export async function POST(req) {
  try {
    const giftcard = await req.json();
    const apiKey = process.env.RESEND_API_KEY;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
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
