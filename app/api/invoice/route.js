import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF } from '@/lib/pdf/generateInvoice';
import { getActivity } from '@/lib/activities';
import { verifyRef } from '@/lib/signedToken';

export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  const token = searchParams.get('token');
  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 });
  if (!verifyRef(ref, token)) return NextResponse.json({ error: 'Invalid or missing token' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: b } = await supabase
    .from('bookings')
    .select('*, booking_items(*), customers(*)')
    .eq('reference', ref)
    .maybeSingle();
  if (!b) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: cfg } = await supabase.from('site_config').select('key, value');
  const config = {};
  (cfg || []).forEach((row) => { config[row.key] = row.value; });

  const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  const booking = {
    reference: b.reference,
    id: b.reference,
    date: b.booking_date,
    total: b.total,
    subtotal: b.subtotal,
    discount: b.discount,
    paid: b.paid,
    paymentMethod: b.payment_method,
    customer: customer ? {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      companyName: customer.company_name,
      vatNumber: customer.vat_number,
      address: customer.address,
    } : {},
    items: (b.booking_items || []).map((i) => {
      const a = getActivity(i.activity_id);
      return {
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
    email: config['contact.email'] || '',
    phone: config['contact.phone'] || '',
  };

  const pdf = await generateInvoicePDF({
    number: `${config['invoice.prefix'] || 'MWX-'}${ref}`,
    issueDate: b.created_at || new Date(),
    booking,
    company,
    tvaRate: Number(config['invoice.tva_rate']) || 21,
    cgvUrl: config['invoice.cgv_url'] || '',
    footerLegal: config['invoice.footer_legal'] || '',
  });

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-multiwex-${ref}.pdf"`,
    },
  });
}
