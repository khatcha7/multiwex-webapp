'use client';
import { useEffect, useRef, useState } from 'react';
import { sanitizeHTML } from '@/lib/sanitize';

// Convertit markdown simple → HTML (titres, gras, italique, liens, listes)
// On reste minimaliste pour éviter une dépendance complète à un parser markdown.
function md2html(s) {
  if (!s) return '';
  let h = String(s);
  // Échappe HTML existant
  h = h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Liens [text](url)
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-mw-pink underline">$1</a>');
  // Gras **
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italique *
  h = h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Listes • ou -
  h = h.replace(/(^|\n)([•\-]) (.+)/g, '$1<li>$3</li>');
  h = h.replace(/(<li>.*?<\/li>(?:\n?)+)/gs, '<ul class="list-disc pl-5 space-y-1 my-1">$1</ul>');
  // Sauts de ligne
  h = h.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return h;
}

const SUGGESTIONS = [
  "Quels sont vos horaires d'ouverture ?",
  "Comment réserver ?",
  "Quels sont vos tarifs ?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Génère un sessionId persistant par tab
    let sid = sessionStorage.getItem('mw_chat_sid');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('mw_chat_sid', sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, conversationId }),
      });
      const j = await r.json();
      if (j.ok) {
        setMessages((prev) => [...prev, { role: 'bot', content: j.answer, source: j.source }]);
        if (j.conversationId && !conversationId) setConversationId(j.conversationId);
      } else {
        setMessages((prev) => [...prev, { role: 'bot', content: j.error || 'Erreur. Réessaie plus tard.', source: 'error' }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'bot', content: 'Erreur réseau. Vérifie ta connexion.', source: 'error' }]);
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition hover:scale-110"
          style={{ background: 'linear-gradient(135deg, #e8005a 0%, #7b00e0 100%)', color: '#fff' }}
        >
          💬
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 flex h-[min(600px,80vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-mw-surface shadow-2xl"
          style={{ boxShadow: '0 20px 60px -10px rgba(232,0,90,0.35)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3" style={{ background: 'linear-gradient(90deg, #e8005a 0%, #7b00e0 100%)' }}>
            <div>
              <div className="display text-sm uppercase tracking-wider text-white">🤖 Multibot</div>
              <div className="text-[10px] text-white/80">Assistant Multiwex · 24/7</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-xl text-white/80 hover:text-white">✕</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <>
                <div className="mb-3 rounded bg-white/5 p-3 text-white/80">
                  👋 Bonjour ! Je suis l'assistant Multiwex. Posez-moi vos questions sur les activités, les tarifs, ou comment réserver.
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">Questions fréquentes</div>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="block w-full rounded border border-mw-pink/30 bg-mw-pink/5 px-3 py-2 text-left text-xs text-white/90 transition hover:border-mw-pink hover:bg-mw-pink/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-mw-pink text-white'
                      : m.source === 'error'
                      ? 'bg-mw-red/20 text-mw-red'
                      : 'bg-white/5 text-white/90'
                  }`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(md2html(m.content)) }}
                />
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-1 px-3 py-2 text-xs text-white/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mw-pink" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mw-pink [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mw-pink [animation-delay:400ms]" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-2">
            <div className="flex gap-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !sending) sendMessage(); }}
                placeholder="Pose ta question…"
                disabled={sending}
                className="flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-mw-pink disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="rounded bg-mw-pink px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-30"
              >
                →
              </button>
            </div>
            <div className="mt-1 text-center text-[9px] text-white/30">Powered by Multiwex IA · réponses préconfigurées</div>
          </div>
        </div>
      )}
    </>
  );
}
