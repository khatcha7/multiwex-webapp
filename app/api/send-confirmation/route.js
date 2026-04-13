import { NextResponse } from 'next/server';

// Envoi d'email de confirmation via Resend.
// Pour activer : ajouter RESEND_API_KEY dans .env.local (gratuit : https://resend.com)
// et FROM_EMAIL (doit être un domaine vérifié dans Resend, ou onboarding@resend.dev en test).
//
// Sans clé configurée : l'API simule l'envoi et retourne { simulated: true }.

function renderHtml(booking) {
  const lines = booking.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #222;"><strong>${i.activityName}</strong></td><td align="right" style="padding:8px 0;border-bottom:1px solid #222;color:#ff007d;">${i.start} → ${i.end}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#050508;font-family:-apple-system,Segoe UI,sans-serif;color:#fff;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="margin:0;font-size:32px;text-transform:uppercase;letter-spacing:0.05em;">MULTIWEX</h1>
    <div style="color:#ff007d;font-weight:bold;letter-spacing:0.15em;text-transform:uppercase;font-size:12px;">Réservation confirmée</div>
  </div>
  <div style="background:#0a0a0f;border:1px solid rgba(255,0,125,0.3);border-radius:16px;padding:24px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Numéro</div>
        <div style="font-family:monospace;font-size:18px;color:#ff007d;font-weight:900;">${booking.id}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Total</div>
        <div style="font-size:20px;font-weight:900;">${booking.total.toFixed(2)}€</div>
      </div>
    </div>
    <div style="color:#bbb;font-size:14px;margin-bottom:16px;">
      ${new Date(booking.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${booking.players} joueur(s)
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${lines}</table>
  </div>
  <div style="text-align:center;color:#666;font-size:12px;margin-top:24px;">
    Multiwex · Rue des Deux Provinces 1, 6900 Marche-en-Famenne<br>
    +32 (0)84 770 222 · info@multiwex.be
  </div>
</div></body></html>`;
}

export async function POST(req) {
  try {
    const booking = await req.json();
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL || 'Multiwex <onboarding@resend.dev>';

    if (!apiKey) {
      console.log('[send-confirmation] simulated (no RESEND_API_KEY)', booking.id);
      return NextResponse.json({ ok: true, simulated: true });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [booking.customer.email],
        subject: `Confirmation Multiwex — ${booking.id}`,
        html: renderHtml(booking),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
