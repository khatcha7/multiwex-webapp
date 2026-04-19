import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF, getNextInvoiceNumber } from '@/lib/pdf/generateInvoice';
import { generateBookingICS } from '@/lib/ics';
import { buildConfirmationEmail } from '@/lib/email/confirmationTemplate';
import { getActivity } from '@/lib/activities';
import { checkRateLimit } from '@/lib/rateLimit';

// Force le runtime Node.js (nécessaire pour @react-pdf/renderer côté serveur)
export const runtime = 'nodejs';

// Lit la config depuis Supabase (server-side avec service role ou anon key)
async function loadConfig(supabase) {
  if (!supabase) return {};
  const { data } = await supabase.from('site_config').select('key, value');
  const map = {};
  (data || []).forEach((row) => {
    map[row.key] = row.value;
  });
  return map;
}

// Reconstruit un objet booking à partir d'une ref Supabase (pour resend manuel)
async function loadBookingFromDB(supabase, ref) {
  const { data: b } = await supabase
    .from('bookings')
    .select('*, booking_items(*), customers(*)')
    .eq('reference', ref)
    .maybeSingle();
  if (!b) return null;
  const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  return {
    id: b.reference,
    reference: b.reference,
    date: b.booking_date,
    players: b.players,
    subtotal: b.subtotal,
    discount: b.discount,
    total: b.total,
    paid: b.paid,
    paymentMethod: b.payment_method,
    promoCode: b.promo_code,
    source: b.source,
    customer: customer ? {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      companyName: customer.company_name,
      vatNumber: customer.vat_number,
      address: customer.address,
    } : null,
    items: (b.booking_items || []).map((i) => {
      const a = getActivity(i.activity_id);
      return {
        id: i.id,
        activityId: i.activity_id,
        activityName: a?.name || i.activity_id,
        slotDate: i.slot_date,
        start: (i.slot_start || '').slice(0, 5),
        end: (i.slot_end || '').slice(0, 5),
        players: i.players,
        unit: i.unit_price,
        total: i.total_price,
      };
    }),
  };
}

export async function POST(req) {
  // Rate limit : 5 requêtes par IP par minute (anti-spam mail)
  const rl = checkRateLimit(req, { limit: 5, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded', resetIn: rl.resetIn }, { status: 429 });

  try {
    const body = await req.json();
    const apiKey = process.env.RESEND_API_KEY;

    // Init Supabase server-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Mode "resend manuel" : si seul {ref} est passé, on lookup le booking en DB
    let booking;
    if (body.ref && !body.items && supabase) {
      booking = await loadBookingFromDB(supabase, body.ref);
      if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
    } else {
      booking = body;
    }
    if (!booking?.customer?.email) {
      return NextResponse.json({ ok: false, error: 'Booking has no customer email' }, { status: 400 });
    }

    const config = await loadConfig(supabase);

    // Déduire baseUrl pour les liens (env override → request origin → fallback)
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    // ===== 1. Génère le numéro de facture (atomic via Supabase) =====
    let invoiceNumber = `MWX-${Date.now()}`;
    try {
      if (supabase) {
        invoiceNumber = await getNextInvoiceNumber(supabase, config['invoice.prefix'] || 'MWX-2026-');
      }
    } catch (e) {
      console.warn('[send-confirmation] invoice number error', e);
    }

    // ===== 2. Génère le PDF de la facture =====
    let pdfBuffer = null;
    try {
      const company = {
        legalName: config['company.legal_name'] || 'MULTIWEX SRL',
        bce: config['company.bce'] || '',
        tva: config['company.tva'] || config['company.bce'] || '',
        addressStreet: config['company.address_street'] || '',
        addressZip: config['company.address_zip'] || '',
        addressCity: config['company.address_city'] || '',
        addressCountry: config['company.address_country'] || 'Belgique',
        iban: config['company.iban'] || '',
        bic: config['company.bic'] || '',
        website: config['company.website'] || '',
        email: config['contact.email'] || '',
        phone: config['contact.phone'] || '',
      };
      pdfBuffer = await generateInvoicePDF({
        number: invoiceNumber,
        issueDate: new Date(),
        booking,
        company,
        tvaRate: Number(config['invoice.tva_rate']) || 21,
        cgvUrl: config['invoice.cgv_url'] || '',
        footerLegal: config['invoice.footer_legal'] || '',
      });
    } catch (e) {
      console.error('[send-confirmation] PDF generation failed', e);
    }

    // ===== 3. Génère le .ics agenda =====
    let icsContent = '';
    try {
      icsContent = generateBookingICS({
        booking,
        company: {
          legalName: config['company.legal_name'],
          addressStreet: config['company.address_street'],
          addressZip: config['company.address_zip'],
          addressCity: config['company.address_city'],
        },
      });
    } catch (e) {
      console.warn('[send-confirmation] ICS generation failed', e);
    }

    // ===== 4. Construit le mail HTML =====
    const { subject, html, text } = buildConfirmationEmail({ booking, config, baseUrl });

    // ===== 5. Envoie via Resend (ou simule si pas de clé) =====
    if (!apiKey) {
      console.log('[send-confirmation] simulated (no RESEND_API_KEY)', booking.id, '— invoice', invoiceNumber, '— pdf', pdfBuffer ? `${pdfBuffer.length} bytes` : 'none');
      return NextResponse.json({ ok: true, simulated: true, invoiceNumber, pdfSize: pdfBuffer?.length || 0 });
    }

    const resend = new Resend(apiKey);

    const fromName = config['email.from_name'] || 'Multiwex';
    const fromAddr = config['email.from'] || 'reservations@multiwex.be';
    const from = `${fromName} <${fromAddr}>`;
    const replyTo = config['email.reply_to'] || config['contact.email'];
    const bcc = config['email.bcc_internal'] ? [config['email.bcc_internal']] : undefined;

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `facture-${invoiceNumber}.pdf`,
        content: Buffer.from(pdfBuffer).toString('base64'),
      });
    }
    if (icsContent) {
      attachments.push({
        filename: `multiwex-${booking.reference || booking.id}.ics`,
        content: Buffer.from(icsContent, 'utf-8').toString('base64'),
      });
    }

    const sendResult = await resend.emails.send({
      from,
      to: [booking.customer.email],
      reply_to: replyTo,
      bcc,
      subject,
      html,
      text,
      attachments,
      headers: {
        'List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
        'X-Entity-Ref-ID': booking.reference || booking.id,
      },
    });

    const ref = booking.reference || booking.id;

    if (sendResult.error) {
      console.error('[send-confirmation] Resend error', sendResult.error);
      // Tag failed in DB pour permettre retry manuel
      if (supabase && ref) {
        await supabase.from('bookings').update({
          confirmation_sent_status: 'failed',
        }).eq('reference', ref);
      }
      return NextResponse.json({ ok: false, error: sendResult.error }, { status: 500 });
    }

    // Tag success
    if (supabase && ref) {
      await supabase.from('bookings').update({
        confirmation_sent_at: new Date().toISOString(),
        confirmation_sent_status: 'sent',
      }).eq('reference', ref);
    }

    return NextResponse.json({ ok: true, id: sendResult.data?.id, invoiceNumber });
  } catch (e) {
    console.error('[send-confirmation] fatal', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
