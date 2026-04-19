import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(req) {
  // Anti-spam : 3 envois/heure/IP
  const rl = checkRateLimit(req, { limit: 3, windowSec: 3600 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Trop d\'envois. Réessaie dans une heure.' }, { status: 429 });
  }

  try {
    const { name, email, message, sessionId } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: 'Nom, email et message requis' }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ ok: false, error: 'Message trop long (max 2000 caractères)' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: cfg } = await supabase.from('site_config').select('key, value');
    const config = {};
    (cfg || []).forEach((r) => { config[r.key] = r.value; });

    const recipient = config['contact.email'] || 'info@multiwex.be';
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.log('[chat/contact-mail] simulated', { name, email, message });
      return NextResponse.json({ ok: true, simulated: true });
    }

    // Récupère l'historique de la conversation pour contexte
    let convoHistory = '';
    if (sessionId) {
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (conv) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at');
        if (msgs && msgs.length > 0) {
          convoHistory = '\n\n--- Historique de la conversation chatbot ---\n' +
            msgs.map((m) => `${m.role === 'user' ? '👤 Visiteur' : '🤖 Bot'} : ${(m.content || '').replace(/<[^>]+>/g, '').slice(0, 300)}`).join('\n\n');
        }
      }
    }

    const resend = new Resend(apiKey);
    const fromName = config['email.from_name'] || 'Multiwex Chat';
    const fromAddr = config['email.from'] || 'reservations@multiwex.be';
    const from = `${fromName} <${fromAddr}>`;

    const escape = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0a0a0a;background:#fff;padding:20px;">
        <h2 style="color:#e8005a;border-bottom:2px solid #e8005a;padding-bottom:8px;">Nouveau message — Chatbot Multiwex</h2>
        <p><strong>De :</strong> ${escape(name)} (<a href="mailto:${escape(email)}">${escape(email)}</a>)</p>
        <div style="background:#f5f5f5;border-left:3px solid #e8005a;padding:12px;margin:16px 0;white-space:pre-wrap;">${escape(message)}</div>
        ${convoHistory ? `<details><summary style="cursor:pointer;color:#666;">Voir le contexte chatbot</summary><pre style="background:#f0f0f0;padding:12px;font-size:11px;white-space:pre-wrap;">${escape(convoHistory)}</pre></details>` : ''}
        <p style="font-size:11px;color:#888;margin-top:24px;">Envoyé via le chatbot du site Multiwex.</p>
      </div>
    `;

    const result = await resend.emails.send({
      from,
      to: [recipient],
      reply_to: email,
      subject: `[Chatbot] Question de ${name}`,
      html,
      text: `De: ${name} <${email}>\n\nMessage:\n${message}${convoHistory}`,
    });

    if (result.error) {
      console.error('[chat/contact-mail] Resend error', result.error);
      return NextResponse.json({ ok: false, error: 'Échec envoi mail' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[chat/contact-mail] fatal', e);
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 });
  }
}
