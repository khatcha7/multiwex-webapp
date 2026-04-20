'use client';
import { useEffect, useRef, useState } from 'react';
import { sanitizeHTML } from '@/lib/sanitize';
import { getConfig, getBool } from '@/lib/data';

// Convertit markdown simple → HTML.
function md2html(s) {
  if (!s) return '';
  let h = String(s);
  h = h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-mw-pink underline">$1</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/(^|\n)([•\-]) (.+)/g, '$1<li>$3</li>');
  h = h.replace(/(<li>.*?<\/li>(?:\n?)+)/gs, '<ul class="list-disc pl-5 space-y-1 my-1">$1</ul>');
  h = h.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return h;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [contactEmail, setContactEmail] = useState('info@multiwex.be');

  // Email form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [mailName, setMailName] = useState('');
  const [mailEmail, setMailEmail] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailSent, setMailSent] = useState(false);

  const scrollRef = useRef(null);

  // Bulle déplaçable (mobile + desktop) + masquage temporaire
  const [bubblePos, setBubblePos] = useState(null); // { x, y } en pixels OU null = position par défaut
  const [hidden, setHidden] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, dragging: false });
  const justDragged = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mw_chat_bubble_pos');
      if (saved) {
        const p = JSON.parse(saved);
        // Clamp dans le viewport actuel — sinon position desktop hérite sur mobile et bulle off-screen
        const W = window.innerWidth, H = window.innerHeight;
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
          const x = Math.max(8, Math.min(W - 64, p.x));
          const y = Math.max(8, Math.min(H - 64, p.y));
          setBubblePos({ x, y });
        }
      }
    } catch {}
    // Re-clamp on resize (rotation mobile, redim desktop)
    const onResize = () => {
      setBubblePos((p) => {
        if (!p) return p;
        const W = window.innerWidth, H = window.innerHeight;
        return { x: Math.max(8, Math.min(W - 64, p.x)), y: Math.max(8, Math.min(H - 64, p.y)) };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sauvegarde la position quand elle change (après un drag)
  useEffect(() => {
    if (bubblePos) {
      try { localStorage.setItem('mw_chat_bubble_pos', JSON.stringify(bubblePos)); } catch {}
    }
  }, [bubblePos]);

  function onPointerDown(e) {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      dragging: false,
      target,
    };
    target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const d = dragRef.current;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.dragging && Math.abs(dx) + Math.abs(dy) < 8) return;
      d.dragging = true;
      const W = window.innerWidth, H = window.innerHeight;
      const newX = Math.max(8, Math.min(W - 64, d.origX + dx));
      const newY = Math.max(8, Math.min(H - 64, d.origY + dy));
      setBubblePos({ x: newX, y: newY });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      if (dragRef.current.dragging) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 150);
      }
      dragRef.current.dragging = false;
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  // Config dynamique (lue côté client depuis cache config)
  const enabled = getBool('chatbot.enabled', true);
  const botName = getConfig('chatbot.bot_name') || '🤖 Multibot';
  const welcomeMsg = getConfig('chatbot.welcome_message') || "👋 Bonjour ! Je suis l'assistant Multiwex. Posez-moi vos questions ou cliquez sur une suggestion ci-dessous.";
  const starterRaw = getConfig('chatbot.starter_suggestions') || "Quels sont vos horaires d'ouverture ?\nComment réserver ?\nQuels sont vos tarifs ?";
  const starterSuggestions = String(starterRaw).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const bubbleColor = getConfig('chatbot.bubble_color') || '#e8005a';
  const positionLeft = getConfig('chatbot.position') === 'bottom-left';

  useEffect(() => {
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
  }, [messages, open, showEmailForm, mailSent]);

  const sendMessage = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setShowEmailForm(false);
    setMailSent(false);
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
        setMessages((prev) => [...prev, {
          role: 'bot',
          content: j.answer,
          source: j.source,
          suggestions: j.suggestions || [],
        }]);
        if (j.conversationId && !conversationId) setConversationId(j.conversationId);
        if (j.contactEmail) setContactEmail(j.contactEmail);
      } else {
        setMessages((prev) => [...prev, { role: 'bot', content: j.error || 'Erreur. Réessaie plus tard.', source: 'error' }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'bot', content: 'Erreur réseau. Vérifie ta connexion.', source: 'error' }]);
    }
    setSending(false);
  };

  const sendContactMail = async () => {
    if (!mailName.trim() || !mailEmail.trim() || !mailMessage.trim() || mailSending) return;
    setMailSending(true);
    try {
      const r = await fetch('/api/chat/contact-mail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: mailName.trim(),
          email: mailEmail.trim(),
          message: mailMessage.trim(),
          sessionId,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setMailSent(true);
        setMailName(''); setMailEmail(''); setMailMessage('');
        setTimeout(() => { setShowEmailForm(false); setMailSent(false); }, 3000);
      } else {
        alert(j.error || 'Échec envoi');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
    setMailSending(false);
  };

  if (!enabled) return null;

  const lastBot = [...messages].reverse().find((m) => m.role === 'bot');
  const liveSuggestions = lastBot?.suggestions || [];
  const bubbleStyle = bubblePos
    ? { left: bubblePos.x, top: bubblePos.y }
    : (positionLeft ? { bottom: '6rem', left: '1.25rem' } : { bottom: '6rem', right: '1.25rem' });
  const panelStyle = positionLeft
    ? { bottom: '1.25rem', left: '1.25rem' }
    : { bottom: '1.25rem', right: '1.25rem' };

  // Si masqué : afficher un mini-tab discret en bas à droite pour le réafficher
  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        aria-label="Réafficher le chat"
        title="Réafficher le chat"
        className="fixed bottom-4 right-2 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/60 shadow ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20 hover:text-white"
      >
        💬
      </button>
    );
  }

  return (
    <>
      {!open && (
        <div className="fixed z-50" style={bubbleStyle}>
          <button
            onPointerDown={onPointerDown}
            onClick={(e) => { if (!justDragged.current) setOpen(true); }}
            aria-label="Ouvrir le chat"
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition hover:scale-110 select-none touch-none"
            style={{ background: `linear-gradient(135deg, ${bubbleColor} 0%, #7b00e0 100%)`, color: '#fff', cursor: 'grab' }}
          >
            💬
          </button>
          <button
            onClick={() => setHidden(true)}
            aria-label="Masquer le chat"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white/70 shadow ring-1 ring-white/20 hover:text-white"
            title="Masquer (réafficher via le mini-bouton coin bas-droit)"
          >
            ×
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed z-50 flex h-[min(640px,85vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-mw-surface shadow-2xl"
          style={{ ...panelStyle, boxShadow: `0 20px 60px -10px ${bubbleColor}55` }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3" style={{ background: `linear-gradient(90deg, ${bubbleColor} 0%, #7b00e0 100%)` }}>
            <div>
              <div className="display text-sm uppercase tracking-wider text-white">{botName}</div>
              <div className="text-[10px] text-white/80">Assistant Multiwex · 24/7</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-xl text-white/80 hover:text-white">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && !showEmailForm && (
              <>
                <div className="mb-3 rounded bg-white/5 p-3 text-white/80">{welcomeMsg}</div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">Questions fréquentes</div>
                  {starterSuggestions.map((s) => (
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
                      ? 'text-white'
                      : m.source === 'error'
                      ? 'bg-mw-red/20 text-mw-red'
                      : 'bg-white/5 text-white/90'
                  }`}
                  style={m.role === 'user' ? { background: bubbleColor } : undefined}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(md2html(m.content)) }}
                />
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-1 px-3 py-2 text-xs text-white/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: bubbleColor }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:200ms]" style={{ background: bubbleColor }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:400ms]" style={{ background: bubbleColor }} />
              </div>
            )}

            {!sending && messages.length > 0 && liveSuggestions.length > 0 && !showEmailForm && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Suggestions</div>
                {liveSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="block w-full rounded border border-mw-cyan/30 bg-mw-cyan/5 px-3 py-2 text-left text-xs text-white/90 transition hover:border-mw-cyan hover:bg-mw-cyan/10"
                  >
                    💡 {s}
                  </button>
                ))}
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="mt-2 block w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-center text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10"
                >
                  📧 Aucune réponse ne convient ? Envoie-nous un email
                </button>
              </div>
            )}

            {showEmailForm && !mailSent && (
              <div className="mt-3 rounded border border-mw-pink/40 bg-mw-pink/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="display text-xs uppercase text-mw-pink">📧 Contactez-nous</div>
                  <button onClick={() => setShowEmailForm(false)} className="text-xs text-white/50 hover:text-white">✕</button>
                </div>
                <div className="mb-2 text-[10px] text-white/50">Votre message + l'historique de la conversation seront envoyés à {contactEmail}</div>
                <input value={mailName} onChange={(e) => setMailName(e.target.value)} placeholder="Votre nom" className="mb-2 w-full rounded border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-mw-pink" />
                <input type="email" value={mailEmail} onChange={(e) => setMailEmail(e.target.value)} placeholder="Votre email" className="mb-2 w-full rounded border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-mw-pink" />
                <textarea value={mailMessage} onChange={(e) => setMailMessage(e.target.value)} placeholder="Votre question / message…" rows={4} className="mb-2 w-full rounded border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none resize-none focus:border-mw-pink" />
                <button
                  onClick={sendContactMail}
                  disabled={!mailName.trim() || !mailEmail.trim() || !mailMessage.trim() || mailSending}
                  className="w-full rounded py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-30"
                  style={{ background: bubbleColor }}
                >
                  {mailSending ? 'Envoi…' : 'Envoyer →'}
                </button>
              </div>
            )}

            {mailSent && (
              <div className="mt-3 rounded border border-mw-green/40 bg-mw-green/10 p-4 text-center">
                <div className="mb-1 text-2xl">✓</div>
                <div className="text-xs text-white">Message envoyé !</div>
                <div className="mt-1 text-[10px] text-white/60">On revient vers vous rapidement</div>
              </div>
            )}
          </div>

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
                className="rounded px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-30"
                style={{ background: bubbleColor }}
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
