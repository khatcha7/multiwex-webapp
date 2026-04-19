import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { matchFAQ } from '@/lib/chatbot/faqMatcher';
import { buildSeedFAQ } from '@/lib/chatbot/seedFAQ';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

async function loadConfig(supabase) {
  const { data } = await supabase.from('site_config').select('key, value');
  const map = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });
  return map;
}

async function loadFAQs(supabase, config) {
  let { data: faqs } = await supabase.from('chat_faq').select('*').order('position');
  if (!faqs || faqs.length === 0) {
    // Seed first time
    const seed = buildSeedFAQ(config);
    await supabase.from('chat_faq').insert(seed);
    const { data: seeded } = await supabase.from('chat_faq').select('*').order('position');
    faqs = seeded || [];
  }
  return faqs;
}

export async function POST(req) {
  // Rate limit : 30 messages par minute par IP
  const rl = checkRateLimit(req, { limit: 30, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json({
      ok: false,
      error: 'Trop de messages. Réessaye dans une minute.',
    }, { status: 429 });
  }

  try {
    const { message, sessionId, conversationId } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, error: 'Message manquant' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const config = await loadConfig(supabase);
    const faqs = await loadFAQs(supabase, config);

    // Récupère ou crée la conversation
    let convId = conversationId;
    if (!convId && sessionId) {
      const { data: created } = await supabase
        .from('chat_conversations')
        .insert({ session_id: sessionId })
        .select()
        .single();
      convId = created?.id;
    }

    // Sauve le message user
    if (convId) {
      await supabase.from('chat_messages').insert({
        conversation_id: convId,
        role: 'user',
        content: message.slice(0, 1000),
      });
    }

    // Match FAQ
    const result = matchFAQ(message, faqs);

    let answer;
    let source = 'fallback';
    let faqId = null;

    if (result) {
      answer = result.faq.answer;
      source = result.source;
      faqId = result.faq.id;
      // Increment hit
      await supabase
        .from('chat_faq')
        .update({ hits: (result.faq.hits || 0) + 1 })
        .eq('id', result.faq.id);
    } else {
      // Fallback : suggestions des 3 FAQ les plus populaires
      const topFaqs = [...faqs].sort((a, b) => (b.hits || 0) - (a.hits || 0)).slice(0, 3);
      answer = `Je n'ai pas trouvé de réponse précise à votre question. Voici les sujets les plus consultés :\n\n${topFaqs.map((f) => `• ${f.question}`).join('\n')}\n\nSinon contactez-nous directement à **${config['contact.email'] || 'info@multiwex.be'}** ou au **${config['contact.phone'] || '+32 (0)84 770 222'}**.`;
    }

    // Sauve la réponse bot
    if (convId) {
      await supabase.from('chat_messages').insert({
        conversation_id: convId,
        role: 'bot',
        content: answer,
        source,
        faq_id: faqId,
      });
      await supabase
        .from('chat_conversations')
        .update({ message_count: 0 }) // sera recalculé par trigger ou query
        .eq('id', convId);
    }

    return NextResponse.json({
      ok: true,
      answer,
      source,
      conversationId: convId,
    });
  } catch (e) {
    console.error('[/api/chat] error', e);
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 });
  }
}
