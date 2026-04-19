// CRUD FAQ — endpoint pour la page settings staff
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET() {
  const { data, error } = await client().from('chat_faq').select('*').order('position');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, faqs: data || [] });
}

export async function POST(req) {
  const body = await req.json();
  const supabase = client();
  if (body.id) {
    // Update
    const { error } = await supabase
      .from('chat_faq')
      .update({
        question: body.question,
        keywords: body.keywords || [],
        answer: body.answer,
        category: body.category || null,
        enabled: body.enabled !== false,
        position: body.position ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } else {
    // Insert
    const { data, error } = await supabase
      .from('chat_faq')
      .insert({
        question: body.question,
        keywords: body.keywords || [],
        answer: body.answer,
        category: body.category || null,
        enabled: body.enabled !== false,
        position: body.position ?? 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, faq: data });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  const { error } = await client().from('chat_faq').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
