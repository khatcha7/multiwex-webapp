'use client';
import Link from 'next/link';
import { useState } from 'react';

const AMOUNTS = [20, 50, 100, 150];

export default function GiftCardPage() {
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState(false);
  const [done, setDone] = useState(null);

  const value = custom ? parseFloat(custom) : amount;
  const final = applied ? 0 : value;

  const apply = () => {
    if (promo.trim().toUpperCase() === 'DEMO100') setApplied(true);
    else alert('Code invalide. Essaie DEMO100 pour la démo.');
  };

  const submit = () => {
    if (!from || !to || !email || !value) return alert('Remplis tous les champs requis');
    const code = 'GIFT-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const card = {
      code,
      amount: value,
      from,
      to,
      email,
      message,
      createdAt: new Date().toISOString(),
      paid: final === 0,
    };
    const all = JSON.parse(localStorage.getItem('mw_giftcards') || '[]');
    all.push(card);
    localStorage.setItem('mw_giftcards', JSON.stringify(all));
    setDone(card);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mw-pink/20 text-5xl shadow-neon-pink">🎁</div>
        <h1 className="section-title mb-2">Carte cadeau envoyée&nbsp;!</h1>
        <p className="mb-6 text-white/60">Un email a été envoyé à <span className="text-mw-pink">{done.email}</span> <span className="text-xs text-white/40">(simulation démo)</span></p>
        <div className="rounded-2xl border border-mw-pink/40 bg-gradient-to-br from-mw-pink/10 to-mw-cyan/5 p-6 text-left">
          <div className="text-xs uppercase tracking-wider text-white/50">Code</div>
          <div className="font-mono text-2xl font-black text-mw-pink">{done.code}</div>
          <div className="mt-3 text-xs uppercase tracking-wider text-white/50">Montant</div>
          <div className="text-2xl font-black">{done.amount}€</div>
        </div>
        <button onClick={() => { setDone(null); setApplied(false); setFrom(''); setTo(''); setEmail(''); setMessage(''); setPromo(''); }} className="btn-primary mt-6">Nouvelle carte</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link href="/booking" className="mb-4 inline-flex items-center gap-1 text-xs text-white/60 hover:text-mw-pink">
        ← Retour au booking
      </Link>
      <h1 className="section-title mb-2">🎁 Carte cadeau Multiwex</h1>
      <p className="mb-8 text-white/60">Offrez l'accès à toutes nos activités. La carte est envoyée par email au bénéficiaire.</p>

      <div className="mb-6">
        <div className="mb-3 text-xs uppercase tracking-wider text-white/50">Montant</div>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setCustom(''); }}
              className={`rounded-xl border py-4 font-black transition ${
                !custom && amount === a ? 'border-mw-pink bg-mw-pink text-white shadow-neon-pink' : 'border-white/15 bg-white/[0.03] text-white hover:border-mw-pink'
              }`}
            >
              {a}€
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="Ou montant personnalisé…"
          className="input"
          inputMode="decimal"
        />
      </div>

      <div className="mb-6 rounded-3xl border border-mw-pink/30 bg-gradient-to-br from-mw-pink/20 via-black/60 to-mw-cyan/10 p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/70">Multiwex</div>
            <div className="text-2xl font-black text-white">Carte cadeau</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/70">Valeur</div>
            <div className="text-3xl font-black text-mw-pink">{value || '—'}€</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">De</div>
            <div className="font-medium">{from || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">Pour</div>
            <div className="font-medium">{to || '—'}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="De (votre nom)" className="input" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Pour (bénéficiaire)" className="input" />
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email du bénéficiaire" className="input" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Message personnel (optionnel)" className="input resize-none" />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Code promo</div>
        <div className="flex gap-2">
          <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="DEMO100" disabled={applied} className="input flex-1" />
          <button onClick={apply} disabled={applied} className="btn-outline shrink-0">{applied ? '✓' : 'Appliquer'}</button>
        </div>
        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-white/70"><span>Montant</span><span>{(value || 0).toFixed(2)}€</span></div>
          {applied && <div className="flex justify-between text-mw-pink"><span>Code DEMO100</span><span>−{(value || 0).toFixed(2)}€</span></div>}
          <div className="flex justify-between pt-2 text-lg font-black"><span>Total</span><span className="text-mw-pink">{final.toFixed(2)}€</span></div>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!applied || !from || !to || !email || !value}
        className="btn-primary mt-6 w-full md:w-auto"
      >
        Offrir cette carte →
      </button>
      <p className="mt-3 text-xs text-white/40">En démo, le paiement est bypassé via DEMO100. En prod, lien Stripe/Odoo à brancher dans <code>/api/giftcards</code>.</p>
    </div>
  );
}
