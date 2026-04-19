// Templates HTML simples (tables-based) pour mails giftcard + post-visite.
const PINK = '#e8005a';
const RED = '#ff004b';
const PURPLE = '#7b00e0';
const CYAN = '#00d9ff';
const YELLOW = '#f3d10b';
const BG_DARK = '#0a0a0a';
const BG_CARD = '#141414';
const BORDER = '#2a2a2a';
const WHITE = '#ffffff';
const MUTED = '#9a9a9a';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function commonShell({ title, content, config }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BG_DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DARK};">
<tr><td align="center" style="padding:30px 12px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BG_DARK};border:1px solid ${BORDER};">
  <tr><td style="height:6px;background:linear-gradient(90deg,${YELLOW} 0%,${RED} 35%,${PINK} 60%,${PURPLE} 80%,${CYAN} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 24px 16px;font-family:Arial Black,Impact,sans-serif;font-size:28px;letter-spacing:2px;color:${WHITE};">MULTIWEX</td></tr>
  ${content}
  <tr><td style="padding:24px;border-top:1px solid ${BORDER};background:${BG_CARD};font-size:11px;color:${MUTED};line-height:1.6;">
    <strong style="color:${WHITE};">${escapeHtml(config['company.legal_name'] || 'Multiwex')}</strong><br>
    ${escapeHtml(config['company.address_street'] || '')} · ${escapeHtml(config['company.address_zip'] || '')} ${escapeHtml(config['company.address_city'] || '')}<br>
    BCE ${escapeHtml(config['company.bce'] || '')} · <a href="mailto:${config['contact.email']}" style="color:${PINK};text-decoration:none;">${escapeHtml(config['contact.email'] || '')}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function buildGiftCardEmail({ giftcard, config, baseUrl }) {
  const subject = (config['email.subject_giftcard'] || '🎁 Votre carte cadeau Multiwex').replace('{code}', giftcard.code);
  const intro = config['email.intro_giftcard'] || '';

  const content = `
    <tr><td style="padding:16px 24px 24px;">
      <div style="font-family:Arial Black,sans-serif;font-size:22px;color:${WHITE};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🎁 Votre carte cadeau</div>
      <div style="color:${MUTED};font-size:13px;line-height:1.5;">Bonjour <strong style="color:${WHITE};">${escapeHtml(giftcard.toName || '')}</strong>, ${escapeHtml(intro)}</div>
    </td></tr>
    <tr><td style="padding:0 24px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,${PURPLE} 0%,${PINK} 100%);border-radius:6px;">
        <tr><td style="padding:30px;text-align:center;">
          <div style="font-size:11px;color:${WHITE};opacity:0.85;text-transform:uppercase;letter-spacing:2px;">Montant</div>
          <div style="font-family:Arial Black,sans-serif;font-size:48px;color:${WHITE};margin:8px 0 16px;">${Number(giftcard.amount).toFixed(2)} €</div>
          <div style="font-size:11px;color:${WHITE};opacity:0.85;text-transform:uppercase;letter-spacing:2px;">Code</div>
          <div style="font-family:'Courier New',monospace;font-size:24px;color:${WHITE};margin-top:6px;letter-spacing:3px;background:rgba(0,0,0,0.25);padding:10px;border-radius:4px;">${escapeHtml(giftcard.code)}</div>
        </td></tr>
      </table>
    </td></tr>
    ${giftcard.message ? `
    <tr><td style="padding:0 24px 16px;">
      <div style="background:${BG_CARD};border-left:3px solid ${PINK};padding:14px;font-size:13px;color:${WHITE};font-style:italic;line-height:1.5;">
        « ${escapeHtml(giftcard.message)} »<br>
        <span style="color:${MUTED};font-style:normal;font-size:11px;">— ${escapeHtml(giftcard.fromName || '')}</span>
      </div>
    </td></tr>` : ''}
    <tr><td style="padding:0 24px 24px;text-align:center;">
      <a href="${baseUrl}/booking" style="display:inline-block;padding:14px 32px;background:linear-gradient(90deg,${RED} 0%,${PINK} 100%);color:${WHITE};text-decoration:none;font-family:Arial Black,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;">Réserver une activité →</a>
      <div style="margin-top:14px;font-size:11px;color:${MUTED};">Carte attachée en PDF · valable sur toutes les activités</div>
    </td></tr>
  `;

  const text = `Carte cadeau Multiwex\n\nMontant : ${giftcard.amount} €\nCode : ${giftcard.code}\n${giftcard.message ? `\nMessage : « ${giftcard.message} » — ${giftcard.fromName || ''}\n` : ''}\nRéservez sur ${baseUrl}/booking et entrez votre code.\n`;

  return { subject, html: commonShell({ title: subject, content, config }), text };
}

export function buildPostvisitEmail({ booking, config, baseUrl }) {
  const customer = booking.customer || {};
  const firstName = customer.name?.split(' ')[0] || '';
  const subject = config['email.subject_postvisit'] || 'Votre avis compte — Multiwex';
  const intro = config['email.intro_postvisit'] || '';
  const reviewUrl = config['company.google_reviews_url'] || 'https://google.com';
  const reviewLabel = config['postvisit.review_cta'] || 'Notez votre expérience sur Google';
  const outro = config['postvisit.outro'] || '';

  const content = `
    <tr><td style="padding:16px 24px 24px;">
      <div style="font-family:Arial Black,sans-serif;font-size:22px;color:${WHITE};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Merci d'être venu !</div>
      <div style="color:${MUTED};font-size:13px;line-height:1.6;">Bonjour <strong style="color:${WHITE};">${escapeHtml(firstName || customer.name || '')}</strong>,<br>${escapeHtml(intro)}</div>
    </td></tr>
    <tr><td style="padding:0 24px 16px;text-align:center;">
      <div style="background:${BG_CARD};border:1px solid ${YELLOW};border-radius:6px;padding:24px;">
        <div style="font-size:36px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
        <div style="font-family:Arial Black,sans-serif;font-size:14px;color:${YELLOW};text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Votre avis nous aide à grandir</div>
        <a href="${reviewUrl}" style="display:inline-block;padding:14px 28px;background:${YELLOW};color:${BG_DARK};text-decoration:none;font-family:Arial Black,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;">${escapeHtml(reviewLabel)} →</a>
      </div>
    </td></tr>
    <tr><td style="padding:0 24px 24px;text-align:center;font-size:13px;color:${MUTED};line-height:1.6;">
      ${escapeHtml(outro)}<br><br>
      <a href="${baseUrl}/booking" style="color:${PINK};text-decoration:none;font-family:Arial Black,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Réserver à nouveau →</a>
    </td></tr>
  `;

  const text = `Merci d'être venu au Multiwex !\n\n${intro}\n\nNotez votre expérience : ${reviewUrl}\n\n${outro}\n\nRéservez à nouveau : ${baseUrl}/booking`;

  return { subject, html: commonShell({ title: subject, content, config }), text };
}
