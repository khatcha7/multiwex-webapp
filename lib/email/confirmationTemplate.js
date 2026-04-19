// Template HTML mail de confirmation Multiwex.
// Format tables-based pour compatibilité maximale (Outlook, Gmail, Apple Mail).
// Couleurs : rose Multiwex #e8005a, rouge #ff004b, noir profond #0a0a0a.

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

function fmtDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-BE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtMoney(n) {
  return `${(Number(n) || 0).toFixed(2)} €`;
}

function applyVars(template, vars) {
  let out = template || '';
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return out;
}

export function buildConfirmationEmail({ booking, config, baseUrl }) {
  const customer = booking.customer || {};
  const items = booking.items || [];
  const ref = booking.reference || booking.id;
  const firstName = customer.name?.split(' ')[0] || '';

  const subject = applyVars(config['email.subject_confirmation'] || '✓ Votre réservation Multiwex — {ref}', {
    ref,
    firstName: escapeHtml(firstName),
    date: fmtDate(booking.date),
    total: fmtMoney(booking.total),
  });

  const intro = applyVars(config['email.intro_confirmation'] || '', {
    ref,
    firstName: escapeHtml(firstName),
    date: fmtDate(booking.date),
    total: fmtMoney(booking.total),
  });

  // URLs CTAs
  const accountUrl = `${baseUrl}/account?booking=${encodeURIComponent(ref)}`;
  const addPlayersUrl = `${accountUrl}&action=add-players`;
  const editUrl = `${accountUrl}&action=edit`;
  const cancelUrl = `${accountUrl}&action=cancel`;
  const invoiceUrl = `${accountUrl}&action=invoice`;
  const icsUrl = `${baseUrl}/api/booking-ics?ref=${encodeURIComponent(ref)}`;
  const mapsUrl = config['company.maps_url'] || 'https://maps.google.com';
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(`Je viens de réserver au Multiwex ! ${booking.date} — viens avec moi : ${baseUrl}/booking`)}`;

  // Infos pratiques par activité (uniques)
  const uniqueActIds = [...new Set(items.map((i) => i.activityId))];
  const practicalNotes = uniqueActIds
    .map((aid) => ({ id: aid, text: config[`practical.${aid}`], name: items.find((i) => i.activityId === aid)?.activityName }))
    .filter((p) => p.text);

  // Items rendus
  const itemsRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:14px 12px;border-bottom:1px solid ${BORDER};color:${WHITE};">
          <div style="font-family:Arial Black,Impact,sans-serif;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(it.activityName || it.activityId)}</div>
          ${it.roomName ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${escapeHtml(it.roomName)}</div>` : ''}
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid ${BORDER};color:${WHITE};font-size:13px;">
          <div>${it.start} → ${it.end}</div>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid ${BORDER};color:${PINK};text-align:center;font-family:Arial Black,sans-serif;font-size:14px;">${it.players}</td>
        <td style="padding:14px 12px;border-bottom:1px solid ${BORDER};color:${WHITE};text-align:right;font-family:Arial Black,sans-serif;">${fmtMoney(it.total)}</td>
      </tr>`
    )
    .join('');

  // Bloc infos pratiques
  const practicalBlock =
    practicalNotes.length > 0
      ? `
      <tr><td style="padding:24px 24px 8px;">
        <div style="font-family:Arial Black,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${YELLOW};margin-bottom:12px;">⚡ Infos pratiques</div>
        ${practicalNotes
          .map(
            (p) => `
          <div style="background:${BG_CARD};border-left:3px solid ${YELLOW};padding:12px 14px;margin-bottom:8px;">
            <div style="font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;color:${WHITE};margin-bottom:4px;">${escapeHtml(p.name || p.id)}</div>
            <div style="font-size:12px;color:${MUTED};line-height:1.5;">${escapeHtml(p.text)}</div>
          </div>`
          )
          .join('')}
      </td></tr>`
      : '';

  // Bloc Red Planet upsell
  const redPlanetBlock =
    config['crosssell.redplanet_enabled']
      ? `
      <tr><td style="padding:8px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,${PURPLE} 0%,${PINK} 100%);border-radius:6px;">
          <tr><td style="padding:20px;">
            <div style="font-family:Arial Black,sans-serif;font-size:16px;color:${WHITE};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🍽 Red Planet Brasserie</div>
            <div style="font-size:13px;color:${WHITE};line-height:1.5;margin-bottom:14px;opacity:0.95;">${escapeHtml(config['crosssell.redplanet_text'] || '')}</div>
            <a href="${config['crosssell.redplanet_url']}" style="display:inline-block;padding:10px 20px;background:${WHITE};color:${BG_DARK};text-decoration:none;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">Réserver une table →</a>
          </td></tr>
        </table>
      </td></tr>`
      : '';

  // Bloc cross-sell autres activités
  const xSellBlock =
    config['crosssell.activities_enabled']
      ? `
      <tr><td style="padding:8px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:6px;">
          <tr><td style="padding:20px;">
            <div style="font-family:Arial Black,sans-serif;font-size:14px;color:${CYAN};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">+ Encore plus de fun ?</div>
            <div style="font-size:13px;color:${WHITE};line-height:1.5;margin-bottom:14px;opacity:0.85;">${escapeHtml(config['crosssell.activities_text'] || '')}</div>
            <a href="${baseUrl}/booking" style="display:inline-block;padding:10px 20px;background:${CYAN};color:${BG_DARK};text-decoration:none;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">Découvrir les activités →</a>
          </td></tr>
        </table>
      </td></tr>`
      : '';

  // Bloc partage
  const shareBlock =
    config['crosssell.share_enabled']
      ? `
      <tr><td style="padding:8px 24px 24px;text-align:center;">
        <div style="font-size:11px;color:${MUTED};margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Partage cette aventure</div>
        <a href="${whatsappShare}" style="display:inline-block;padding:8px 18px;background:#25D366;color:${WHITE};text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;border-radius:3px;">📱 Partager via WhatsApp</a>
      </td></tr>`
      : '';

  // === HTML complet ===
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG_DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- Pre-header (caché) -->
  <div style="display:none;font-size:1px;color:${BG_DARK};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Réservation ${ref} confirmée — ${fmtDate(booking.date)} — ${fmtMoney(booking.total)}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DARK};">
    <tr><td align="center" style="padding:30px 12px;">

      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BG_DARK};border:1px solid ${BORDER};">

        <!-- Bandeau gradient haut -->
        <tr><td style="height:6px;background:linear-gradient(90deg,${YELLOW} 0%,${RED} 35%,${PINK} 60%,${PURPLE} 80%,${CYAN} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header logo + statut -->
        <tr><td style="padding:32px 24px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:Arial Black,Impact,sans-serif;font-size:28px;letter-spacing:2px;color:${WHITE};">MULTIWEX</td>
              <td style="text-align:right;font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Confirmation de réservation</td>
            </tr>
          </table>
        </td></tr>

        <!-- Hero confirmation -->
        <tr><td style="padding:8px 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(232,0,90,0.15) 0%,rgba(123,0,224,0.10) 100%);border:1px solid ${PINK};border-radius:6px;">
            <tr><td style="padding:24px;">
              <div style="font-family:Arial Black,Impact,sans-serif;font-size:24px;color:${WHITE};text-transform:uppercase;letter-spacing:1px;line-height:1.1;margin-bottom:8px;">
                ✓ Réservation confirmée
              </div>
              <div style="color:${MUTED};font-size:13px;margin-bottom:16px;">
                Bonjour <strong style="color:${WHITE};">${escapeHtml(firstName || customer.name || '')}</strong>, ${escapeHtml(intro)}
              </div>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:20px;">
                    <div style="font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Référence</div>
                    <div style="font-family:'Courier New',monospace;font-size:16px;color:${PINK};font-weight:bold;">${escapeHtml(ref)}</div>
                  </td>
                  <td>
                    <div style="font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Date</div>
                    <div style="font-family:Arial Black,sans-serif;font-size:14px;color:${WHITE};text-transform:capitalize;">${fmtDate(booking.date)}</div>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA principal Voir ma résa -->
        <tr><td style="padding:0 24px 16px;text-align:center;">
          <a href="${accountUrl}" style="display:inline-block;padding:16px 32px;background:linear-gradient(90deg,${RED} 0%,${PINK} 100%);color:${WHITE};text-decoration:none;font-family:Arial Black,Impact,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;">
            🎟 Voir ma réservation
          </a>
        </td></tr>

        <!-- Tableau items -->
        <tr><td style="padding:8px 24px 16px;">
          <div style="font-family:Arial Black,sans-serif;font-size:13px;color:${WHITE};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Détail de votre venue</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:4px;">
            <thead>
              <tr style="background:${BG_DARK};">
                <th style="padding:10px 12px;text-align:left;color:${MUTED};font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:normal;">Activité</th>
                <th style="padding:10px 12px;text-align:left;color:${MUTED};font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:normal;">Horaire</th>
                <th style="padding:10px 12px;text-align:center;color:${MUTED};font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:normal;">Joueurs</th>
                <th style="padding:10px 12px;text-align:right;color:${MUTED};font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:normal;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
            <tfoot>
              <tr><td colspan="4" style="padding:14px 12px;text-align:right;background:${BG_DARK};">
                <span style="color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-right:12px;">Total TTC (TVA ${config['invoice.tva_rate'] || 21}%)</span>
                <span style="color:${PINK};font-family:Arial Black,sans-serif;font-size:20px;">${fmtMoney(booking.total)}</span>
              </td></tr>
            </tfoot>
          </table>
        </td></tr>

        <!-- CTAs secondaires -->
        <tr><td style="padding:8px 24px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px;width:50%;">
                <a href="${addPlayersUrl}" style="display:block;padding:12px;background:${BG_CARD};border:1px solid ${PINK};color:${PINK};text-decoration:none;text-align:center;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">
                  + Ajouter joueurs
                </a>
              </td>
              <td style="padding:4px;width:50%;">
                <a href="${invoiceUrl}" style="display:block;padding:12px;background:${BG_CARD};border:1px solid ${BORDER};color:${WHITE};text-decoration:none;text-align:center;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">
                  📄 Télécharger facture
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:4px;">
                <a href="${icsUrl}" style="display:block;padding:12px;background:${BG_CARD};border:1px solid ${BORDER};color:${WHITE};text-decoration:none;text-align:center;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">
                  📅 Ajouter à l'agenda
                </a>
              </td>
              <td style="padding:4px;">
                <a href="${mapsUrl}" style="display:block;padding:12px;background:${BG_CARD};border:1px solid ${BORDER};color:${WHITE};text-decoration:none;text-align:center;font-family:Arial Black,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;">
                  📍 Itinéraire
                </a>
              </td>
            </tr>
          </table>
          <div style="text-align:center;margin-top:8px;font-size:11px;">
            <a href="${editUrl}" style="color:${MUTED};text-decoration:underline;margin:0 8px;">Modifier</a>
            <span style="color:${BORDER};">·</span>
            <a href="${cancelUrl}" style="color:${MUTED};text-decoration:underline;margin:0 8px;">Annuler</a>
          </div>
        </td></tr>

        ${practicalBlock}
        ${redPlanetBlock}
        ${xSellBlock}
        ${shareBlock}

        <!-- Footer entreprise -->
        <tr><td style="padding:24px;border-top:1px solid ${BORDER};background:${BG_CARD};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:11px;color:${MUTED};line-height:1.6;">
              <strong style="color:${WHITE};font-family:Arial Black,sans-serif;">${escapeHtml(config['company.legal_name'] || 'Multiwex')}</strong><br>
              ${escapeHtml(config['company.address_street'] || '')}<br>
              ${escapeHtml(config['company.address_zip'] || '')} ${escapeHtml(config['company.address_city'] || '')}<br>
              ${escapeHtml(config['company.address_country'] || '')}<br>
              <br>
              BCE / TVA : ${escapeHtml(config['company.bce'] || '')}<br>
              📧 <a href="mailto:${config['contact.email']}" style="color:${PINK};text-decoration:none;">${escapeHtml(config['contact.email'] || '')}</a> · 📞 ${escapeHtml(config['contact.phone'] || '')}
            </td></tr>
            <tr><td style="padding-top:14px;text-align:center;">
              ${config['social.facebook'] ? `<a href="${config['social.facebook']}" style="display:inline-block;margin:0 6px;color:${MUTED};text-decoration:none;font-size:11px;">Facebook</a>` : ''}
              ${config['social.instagram'] ? `<a href="${config['social.instagram']}" style="display:inline-block;margin:0 6px;color:${MUTED};text-decoration:none;font-size:11px;">Instagram</a>` : ''}
              ${config['social.tiktok'] ? `<a href="${config['social.tiktok']}" style="display:inline-block;margin:0 6px;color:${MUTED};text-decoration:none;font-size:11px;">TikTok</a>` : ''}
              ${config['social.linkedin'] ? `<a href="${config['social.linkedin']}" style="display:inline-block;margin:0 6px;color:${MUTED};text-decoration:none;font-size:11px;">LinkedIn</a>` : ''}
            </td></tr>
            <tr><td style="padding-top:14px;text-align:center;font-size:10px;color:${MUTED};">
              Vous recevez cet email suite à votre réservation chez Multiwex.<br>
              <a href="${config['invoice.cgv_url'] || '#'}" style="color:${MUTED};text-decoration:underline;">Conditions générales</a>
            </td></tr>
          </table>
        </td></tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;

  // Plain text fallback (anti-spam : Gmail recommande d'avoir un text/plain)
  const text = [
    `MULTIWEX — Confirmation de réservation`,
    ``,
    `Bonjour ${firstName || customer.name || ''},`,
    intro,
    ``,
    `Référence : ${ref}`,
    `Date : ${fmtDate(booking.date)}`,
    ``,
    `Détail :`,
    ...items.map((it) => `- ${it.activityName || it.activityId} ${it.start}-${it.end} (${it.players}j) — ${fmtMoney(it.total)}`),
    ``,
    `Total TTC : ${fmtMoney(booking.total)}`,
    ``,
    `Voir ma réservation : ${accountUrl}`,
    `+ Ajouter des joueurs : ${addPlayersUrl}`,
    `Télécharger la facture : ${invoiceUrl}`,
    `Itinéraire : ${mapsUrl}`,
    ``,
    `${config['company.legal_name']}`,
    `${config['company.address_street']}, ${config['company.address_zip']} ${config['company.address_city']}`,
    `BCE : ${config['company.bce']}`,
    `${config['contact.email']} · ${config['contact.phone']}`,
  ].join('\n');

  return { subject, html, text };
}
