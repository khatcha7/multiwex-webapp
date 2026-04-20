// GET /api/chatbot-escalations — liste (ou count_pending=1 pour juste le badge)
// PATCH /api/chatbot-escalations — update status/notes d'une escalation

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const supabase = supa();

  // Mode compteur rapide pour le badge
  if (searchParams.get('count_pending') === '1') {
    const { count } = await supabase
      .from('chatbot_escalations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']);
    return NextResponse.json({ count: count || 0 });
  }

  // Liste complète
  const status = searchParams.get('status');
  let q = supabase.from('chatbot_escalations').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ escalations: data || [] });
}

export async function PATCH(req) {
  try {
    const { id, status, assigned_to, resolution_notes } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
    const supabase = supa();
    const update = { updated_at: new Date().toISOString() };
    if (status) {
      update.status = status;
      if (status === 'resolved' || status === 'dismissed') update.resolved_at = new Date().toISOString();
    }
    if (assigned_to !== undefined) update.assigned_to = assigned_to;
    if (resolution_notes !== undefined) update.resolution_notes = resolution_notes;
    const { data, error } = await supabase.from('chatbot_escalations').update(update).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ escalation: data });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
