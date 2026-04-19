import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateBookingICS } from '@/lib/ics';

export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: b } = await supabase
    .from('bookings')
    .select('*, booking_items(*)')
    .eq('reference', ref)
    .maybeSingle();
  if (!b) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: cfg } = await supabase.from('site_config').select('key, value');
  const config = {};
  (cfg || []).forEach((row) => { config[row.key] = row.value; });

  const booking = {
    reference: b.reference,
    id: b.reference,
    date: b.booking_date,
    items: (b.booking_items || []).map((i) => ({
      activityId: i.activity_id,
      activityName: i.activity_id,
      start: (i.slot_start || '').slice(0, 5),
      end: (i.slot_end || '').slice(0, 5),
      players: i.players,
    })),
  };

  const ics = generateBookingICS({
    booking,
    company: {
      legalName: config['company.legal_name'],
      addressStreet: config['company.address_street'],
      addressZip: config['company.address_zip'],
      addressCity: config['company.address_city'],
    },
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="multiwex-${ref}.ics"`,
    },
  });
}
