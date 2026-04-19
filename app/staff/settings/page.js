'use client';
import { useEffect, useState } from 'react';
import { getAllConfig, setConfig, logAudit, getPopups, savePopups, upsertPopup, deletePopup, listNoteCategories, createNoteCategory, updateNoteCategory, deleteNoteCategory, restoreDefaultNoteCategories, ensureDefaultNoteCategories, initConfig, migrateLocalStorageToSupabase } from '@/lib/data';
import { activities } from '@/lib/activities';
import { isSupabaseConfigured } from '@/lib/supabase';

const TABS = [
  { id: 'general', label: 'Général' },
  { id: 'company', label: 'Entreprise' },
  { id: 'email', label: 'Email' },
  { id: 'templates', label: 'Templates email' },
  { id: 'invoice', label: 'Facture' },
  { id: 'practical', label: 'Infos pratiques' },
  { id: 'crosssell', label: 'Cross-sell' },
  { id: 'rules', label: 'Règles métier' },
  { id: 'display', label: 'Affichage' },
  { id: 'activities', label: 'Activités' },
  { id: 'packs', label: 'Packs' },
  { id: 'popups', label: 'Pop-ups' },
  { id: 'pdf', label: 'PDF (legacy)' },
  { id: 'pricing', label: 'Tarifs' },
  { id: 'notes', label: 'Notes' },
];

export default function StaffSettingsPage() {
  const [cfg, setCfg] = useState({});
  const [popups, setPopups] = useState([]);
  const [editingPopup, setEditingPopup] = useState(null);
  const [tab, setTab] = useState('general');

  const reloadAll = async () => {
    await initConfig();
    setCfg(getAllConfig());
    const ps = await getPopups();
    setPopups(ps);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const save = async (key, value) => {
    await setConfig(key, value);
    setCfg(getAllConfig());
    logAudit({ action: 'update_config', entityType: 'config', entityId: key, after: { value } });
  };

  const savePopup = async (popup) => {
    const all = await upsertPopup(popup);
    setPopups(all);
    setEditingPopup(null);
    logAudit({ action: 'upsert_popup', entityType: 'popup', entityId: popup.id, after: popup });
  };

  const removePopup = async (id) => {
    if (!confirm('Supprimer cette pop-up ?')) return;
    const all = await deletePopup(id);
    setPopups(all);
    logAudit({ action: 'delete_popup', entityType: 'popup', entityId: id });
  };

  const togglePopupEnabled = (id) => {
    const p = popups.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, enabled: !p.enabled };
    savePopup(updated);
  };

  const movePopup = async (id, delta) => {
    const sorted = [...popups].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    const renumbered = sorted.map((p, i) => ({ ...p, order: i }));
    await savePopups(renumbered);
    setPopups(renumbered);
  };

  const runMigration = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase non configuré. Vérifiez NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    if (!confirm('Migrer toutes les données localStorage vers Supabase ? À ne faire qu\'une seule fois.')) return;
    const res = await migrateLocalStorageToSupabase();
    if (res.ok) {
      const r = res.report;
      alert(`Migration OK :\n- ${r.config} clés config\n- ${r.popups} pop-ups\n- ${r.staff} staff\n- ${r.slot_blocks} blocs\n- ${r.notes} notes\n${r.errors.length ? '\\nErreurs :\\n' + r.errors.join('\\n') : ''}`);
      await reloadAll();
    } else {
      alert('Échec : ' + res.reason);
    }
  };

  const addNewPopup = () => {
    setEditingPopup({
      id: 'popup-' + Date.now(),
      title: 'Nouveau titre',
      body: 'Contenu de la pop-up…',
      emoji: '✨',
      cta_label: 'OK',
      cta_action: 'dismiss',
      cta_url: null,
      promo_code: null,
      discount_pct: 0,
      enabled: false,
      order: popups.length,
      trigger: 'after_confirmation',
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="section-title mb-4">Réglages</h1>

      <div className="mb-6 flex flex-wrap gap-1 rounded border border-white/15 bg-white/5 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`display rounded px-3 py-1.5 text-xs transition ${tab === t.id ? 'bg-mw-pink text-white' : 'text-white/60 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Contenu éditable</h2>
        <div className="space-y-4">
          <Field label="Tagline homepage" value={cfg['site.tagline']} onSave={(v) => save('site.tagline', v)} />
          <Field label="Texte Flash Sale (marquee)" value={cfg['site.flash_sale_text']} onSave={(v) => save('site.flash_sale_text', v)} />
          <Field label="Téléphone contact" value={cfg['contact.phone']} onSave={(v) => save('contact.phone', v)} />
          <Field label="Email contact" value={cfg['contact.email']} onSave={(v) => save('contact.email', v)} />
        </div>

        <div className="mt-6 rounded border border-white/10 bg-white/[0.02] p-4">
          <h3 className="display mb-2 text-sm">Stockage des données</h3>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className={`inline-block h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-mw-green' : 'bg-mw-red'}`} />
            <span className="text-white/70">
              {isSupabaseConfigured
                ? 'Supabase connecté — les données sont persistées en base.'
                : 'Supabase NON configuré — fallback localStorage (vos modifications restent sur ce device uniquement).'}
            </span>
          </div>
          {isSupabaseConfigured && (
            <button onClick={runMigration} className="btn-outline !py-2 !px-4 text-xs">
              ⇪ Migrer données localStorage → Supabase (one-shot)
            </button>
          )}
        </div>
      </div>)}

      {tab === 'company' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Informations entreprise</h2>
        <p className="mb-4 text-xs text-white/50">Utilisées dans les factures, mails de confirmation et footer.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raison sociale" value={cfg['company.legal_name']} onSave={(v) => save('company.legal_name', v)} />
          <Field label="Numéro BCE" value={cfg['company.bce']} onSave={(v) => save('company.bce', v)} />
          <Field label="Numéro TVA" value={cfg['company.tva']} onSave={(v) => save('company.tva', v)} />
          <Field label="IBAN" value={cfg['company.iban']} onSave={(v) => save('company.iban', v)} />
          <Field label="BIC (optionnel)" value={cfg['company.bic']} onSave={(v) => save('company.bic', v)} />
          <Field label="Site web" value={cfg['company.website']} onSave={(v) => save('company.website', v)} />
          <Field label="Adresse — rue + n°" value={cfg['company.address_street']} onSave={(v) => save('company.address_street', v)} />
          <Field label="Code postal" value={cfg['company.address_zip']} onSave={(v) => save('company.address_zip', v)} />
          <Field label="Ville" value={cfg['company.address_city']} onSave={(v) => save('company.address_city', v)} />
          <Field label="Pays" value={cfg['company.address_country']} onSave={(v) => save('company.address_country', v)} />
          <Field label="Téléphone" value={cfg['contact.phone']} onSave={(v) => save('contact.phone', v)} />
          <Field label="Email contact" value={cfg['contact.email']} onSave={(v) => save('contact.email', v)} />
          <Field label="URL Google Maps (itinéraire)" value={cfg['company.maps_url']} onSave={(v) => save('company.maps_url', v)} />
          <Field label="URL Google Reviews (post-visite)" value={cfg['company.google_reviews_url']} onSave={(v) => save('company.google_reviews_url', v)} />
        </div>
        <h3 className="display mt-6 mb-2 text-sm text-white/70">Réseaux sociaux</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Facebook" value={cfg['social.facebook']} onSave={(v) => save('social.facebook', v)} />
          <Field label="Instagram" value={cfg['social.instagram']} onSave={(v) => save('social.instagram', v)} />
          <Field label="TikTok" value={cfg['social.tiktok']} onSave={(v) => save('social.tiktok', v)} />
          <Field label="LinkedIn" value={cfg['social.linkedin']} onSave={(v) => save('social.linkedin', v)} />
          <Field label="YouTube" value={cfg['social.youtube']} onSave={(v) => save('social.youtube', v)} />
        </div>
      </div>)}

      {tab === 'email' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Configuration Email (Resend)</h2>
        <div className="mb-4 rounded border border-mw-yellow/30 bg-mw-yellow/5 p-3 text-xs text-white/80">
          ⚠ <strong>Délivrabilité</strong> : pour éviter le spam, le domaine de l'adresse <code>From</code> doit être vérifié dans Resend (DNS : SPF + DKIM + DMARC). Sans cela, utiliser <code>onboarding@resend.dev</code> en attendant.
          La clé API est lue depuis la variable d'env <code>RESEND_API_KEY</code> côté serveur (Vercel).
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Adresse expéditeur (From)" value={cfg['email.from']} onSave={(v) => save('email.from', v)} />
          <Field label="Nom expéditeur" value={cfg['email.from_name']} onSave={(v) => save('email.from_name', v)} />
          <Field label="Reply-To" value={cfg['email.reply_to']} onSave={(v) => save('email.reply_to', v)} />
          <Field label="BCC interne (optionnel)" value={cfg['email.bcc_internal']} onSave={(v) => save('email.bcc_internal', v)} />
        </div>
        <h3 className="display mt-6 mb-2 text-sm text-white/70">Mail post-visite</h3>
        <label className="mb-3 flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={cfg['email.postvisit_enabled'] === true || cfg['email.postvisit_enabled'] === 'true'} onChange={(e) => save('email.postvisit_enabled', e.target.checked)} className="h-4 w-4 accent-mw-pink" />
          Activer l'envoi automatique du mail post-visite
        </label>
        <NumField label="Délai après la résa (heures)" value={cfg['email.postvisit_delay_hours']} onSave={(v) => save('email.postvisit_delay_hours', v)} />
      </div>)}

      {tab === 'templates' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Templates email — sujets &amp; intros</h2>
        <p className="mb-4 text-xs text-white/50">Variables disponibles : <code>{'{ref}'}</code> (n° réservation), <code>{'{firstName}'}</code>, <code>{'{date}'}</code>, <code>{'{total}'}</code>.</p>

        <h3 className="display mt-2 mb-2 text-sm text-white/70">Mail de confirmation</h3>
        <div className="space-y-3">
          <Field label="Sujet" value={cfg['email.subject_confirmation']} onSave={(v) => save('email.subject_confirmation', v)} />
          <TextareaField label="Texte d'intro" value={cfg['email.intro_confirmation']} onSave={(v) => save('email.intro_confirmation', v)} rows={3} />
        </div>

        <h3 className="display mt-6 mb-2 text-sm text-white/70">Mail post-visite</h3>
        <div className="space-y-3">
          <Field label="Sujet" value={cfg['email.subject_postvisit']} onSave={(v) => save('email.subject_postvisit', v)} />
          <TextareaField label="Texte d'intro" value={cfg['email.intro_postvisit']} onSave={(v) => save('email.intro_postvisit', v)} rows={3} />
          <Field label="CTA Google Reviews (label)" value={cfg['postvisit.review_cta']} onSave={(v) => save('postvisit.review_cta', v)} />
          <TextareaField label="Outro" value={cfg['postvisit.outro']} onSave={(v) => save('postvisit.outro', v)} rows={2} />
        </div>

        <h3 className="display mt-6 mb-2 text-sm text-white/70">Mail carte cadeau</h3>
        <div className="space-y-3">
          <Field label="Sujet" value={cfg['email.subject_giftcard']} onSave={(v) => save('email.subject_giftcard', v)} />
          <TextareaField label="Texte d'intro" value={cfg['email.intro_giftcard']} onSave={(v) => save('email.intro_giftcard', v)} rows={3} />
        </div>
      </div>)}

      {tab === 'invoice' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Paramètres facture</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField label="Taux de TVA (%)" value={cfg['invoice.tva_rate']} onSave={(v) => save('invoice.tva_rate', v)} />
          <Field label="Préfixe n° facture" value={cfg['invoice.prefix']} onSave={(v) => save('invoice.prefix', v)} />
          <NumField label="Prochain n° de facture" value={cfg['invoice.next_number']} onSave={(v) => save('invoice.next_number', v)} />
          <Field label="URL CGV" value={cfg['invoice.cgv_url']} onSave={(v) => save('invoice.cgv_url', v)} />
        </div>
        <div className="mt-3">
          <TextareaField label="Pied de facture (mention légale)" value={cfg['invoice.footer_legal']} onSave={(v) => save('invoice.footer_legal', v)} rows={2} />
        </div>
      </div>)}

      {tab === 'practical' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Infos pratiques par activité</h2>
        <p className="mb-4 text-xs text-white/50">Affichées dans le mail de confirmation, sous chaque activité réservée.</p>
        <div className="space-y-3">
          {activities.filter((a) => a.bookable).map((a) => (
            <TextareaField
              key={a.id}
              label={a.name}
              value={cfg[`practical.${a.id}`]}
              onSave={(v) => save(`practical.${a.id}`, v)}
              rows={2}
            />
          ))}
        </div>
      </div>)}

      {tab === 'crosssell' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Cross-sell &amp; partage</h2>
        <p className="mb-4 text-xs text-white/50">Blocs affichés dans le mail de confirmation pour générer des ventes additionnelles.</p>

        <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-4">
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg['crosssell.redplanet_enabled'] === true || cfg['crosssell.redplanet_enabled'] === 'true'} onChange={(e) => save('crosssell.redplanet_enabled', e.target.checked)} className="h-4 w-4 accent-mw-pink" />
            <span className="display">Bloc Red Planet Brasserie</span>
          </label>
          <div className="space-y-3">
            <TextareaField label="Texte d'invitation" value={cfg['crosssell.redplanet_text']} onSave={(v) => save('crosssell.redplanet_text', v)} rows={2} />
            <Field label="URL de réservation table" value={cfg['crosssell.redplanet_url']} onSave={(v) => save('crosssell.redplanet_url', v)} />
          </div>
        </div>

        <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-4">
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg['crosssell.activities_enabled'] === true || cfg['crosssell.activities_enabled'] === 'true'} onChange={(e) => save('crosssell.activities_enabled', e.target.checked)} className="h-4 w-4 accent-mw-pink" />
            <span className="display">Bloc cross-sell autres activités</span>
          </label>
          <TextareaField label="Texte d'invitation" value={cfg['crosssell.activities_text']} onSave={(v) => save('crosssell.activities_text', v)} rows={2} />
        </div>

        <div className="rounded border border-white/10 bg-white/[0.02] p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg['crosssell.share_enabled'] === true || cfg['crosssell.share_enabled'] === 'true'} onChange={(e) => save('crosssell.share_enabled', e.target.checked)} className="h-4 w-4 accent-mw-pink" />
            <span className="display">Bouton "Partager" (WhatsApp / SMS)</span>
          </label>
        </div>
      </div>)}

      {tab === 'rules' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Règles métier</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField label="Fermeture auto en ligne (min avant)" value={cfg['booking.closure_min_online']} onSave={(v) => save('booking.closure_min_online', v)} />
          <NumField label="Cutoff modification client (h)" value={cfg['booking.cancel_cutoff_hours']} onSave={(v) => save('booking.cancel_cutoff_hours', v)} />
          <NumField label="Max cartes cadeaux par commande" value={cfg['payment.max_giftcards']} onSave={(v) => save('payment.max_giftcards', v)} />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={cfg['booking.bypass_package_toggle'] === true || cfg['booking.bypass_package_toggle'] === 'true'} onChange={(e) => save('booking.bypass_package_toggle', e.target.checked)} className="h-4 w-4 accent-mw-pink" />
          Masquer le bloc "Packages de groupe" dans l'étape Activités
        </label>
      </div>)}

      {tab === 'display' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Affichage (on/off)</h2>
        <p className="mb-3 text-xs text-white/50">Activez ou désactivez les fonctionnalités visuelles.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['display.calendar_stats_bar', 'Stats rapides en bas du calendrier'],
            ['display.formula_badges', 'Badges formule sur les créneaux'],
            ['display.checkin_presence', 'Check-in / présence par groupe'],
            ['display.share_button', 'Bouton "Partager" après réservation'],
            ['display.promo_report_bloc', 'Bloc codes promos dans les reports'],
            ['display.funnel_analytics', 'Funnel analytics dans les reports'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded bg-white/[0.02] p-2 text-sm text-white/80">
              <input type="checkbox" checked={cfg[key] === true || cfg[key] === 'true' || cfg[key] === undefined} onChange={(e) => save(key, e.target.checked)} className="h-4 w-4 accent-mw-pink" />
              {label}
            </label>
          ))}
        </div>
      </div>)}

      {tab === 'popups' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-xl">Pop-ups post-confirmation</h2>
          <button onClick={addNewPopup} className="btn-outline !py-2 !px-4 text-xs">+ Ajouter</button>
        </div>
        <p className="mb-4 text-xs text-white/50">
          Ces pop-ups s'affichent après la confirmation d'une réservation, dans l'ordre défini ci-dessous (ordre croissant).
          Si l'utilisateur refuse la première, la deuxième s'affiche, etc.
        </p>
        <div className="space-y-2">
          {popups.sort((a, b) => (a.order || 0) - (b.order || 0)).map((p, idx) => (
            <div key={p.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-col gap-1">
                <button onClick={() => movePopup(p.id, -1)} disabled={idx === 0} className="text-xs disabled:opacity-20">↑</button>
                <button onClick={() => movePopup(p.id, 1)} disabled={idx === popups.length - 1} className="text-xs disabled:opacity-20">↓</button>
              </div>
              <div className="text-2xl">{p.emoji || '💬'}</div>
              <div className="min-w-0 flex-1">
                <div className="display truncate text-sm">{p.title}</div>
                <div className="truncate text-[10px] text-white/50">{p.body?.slice(0, 80)}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                  <span className="chip">{p.cta_action || 'dismiss'}</span>
                  {p.promo_code && <span className="chip chip-pink">{p.promo_code} -{p.discount_pct}%</span>}
                </div>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => togglePopupEnabled(p.id)}
                  className="accent-mw-pink"
                />
                <span className={p.enabled ? 'text-mw-pink' : 'text-white/40'}>{p.enabled ? 'ON' : 'OFF'}</span>
              </label>
              <button onClick={() => setEditingPopup(p)} className="text-xs text-white/60 hover:text-mw-pink">Éditer</button>
              <button onClick={() => removePopup(p.id)} className="text-xs text-white/40 hover:text-mw-red">✕</button>
            </div>
          ))}
          {popups.length === 0 && (
            <div className="py-6 text-center text-sm text-white/40">Aucune pop-up configurée.</div>
          )}
        </div>
      </div>)}

      {tab === 'packs' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Packs — mode de réservation</h2>
        <p className="mb-3 text-xs text-white/50">Pour chaque pack, choisissez si le client réserve directement via la webapp ("interne") ou s'il est redirigé vers le site Multiwex pour un devis ("redirect").</p>
        <div className="space-y-2">
          {require('@/lib/packages').packages.filter((p) => !p.requiresQuote).map((p) => {
            const key = `pack.mode.${p.id}`;
            const mode = cfg[key] || 'internal';
            return (
              <div key={p.id} className="flex items-center justify-between rounded bg-white/[0.02] p-2 text-sm">
                <span className="display">{p.name} <span className="text-xs text-white/50">{p.tagline}</span></span>
                <select value={mode} onChange={(e) => save(key, e.target.value)} className="input !w-auto !py-1 text-xs">
                  <option value="internal">Interne (webapp)</option>
                  <option value="redirect">Redirect (site Multiwex)</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>)}

      {tab === 'pdf' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Template PDF / Invitation</h2>
        <div className="space-y-3">
          <Field label="Nom entreprise (header PDF)" value={cfg['pdf.company_name']} onSave={(v) => save('pdf.company_name', v)} />
          <Field label="Footer PDF" value={cfg['pdf.footer']} onSave={(v) => save('pdf.footer', v)} />
          <Field label="Couleur accent (hex)" value={cfg['pdf.accent_color']} onSave={(v) => save('pdf.accent_color', v)} />
        </div>
      </div>)}

      {tab === 'activities' && (<div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Disponibilité des activités</h2>
        <p className="mb-3 text-xs text-white/50">Désactivez temporairement une activité (maintenance, panne, etc.). Elle apparaîtra grisée et non cliquable côté client.</p>
        <div className="space-y-2">
          {activities.filter((a) => a.bookable || a.selectable).map((a) => {
            const disabled = (cfg['activities.disabled'] || {})[a.id];
            const isOff = disabled?.disabled;
            return (
              <div key={a.id} className="flex items-center gap-3 rounded bg-white/[0.02] p-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!isOff}
                    onChange={(e) => {
                      const current = cfg['activities.disabled'] || {};
                      if (e.target.checked) {
                        const next = { ...current };
                        delete next[a.id];
                        save('activities.disabled', next);
                      } else {
                        save('activities.disabled', { ...current, [a.id]: { disabled: true, reason: '' } });
                      }
                    }}
                    className="h-4 w-4 accent-mw-pink"
                  />
                  <span className={`display text-sm ${isOff ? 'text-mw-red line-through' : ''}`}>{a.name}</span>
                </label>
                {isOff && (
                  <input
                    value={disabled.reason || ''}
                    onChange={(e) => {
                      const current = cfg['activities.disabled'] || {};
                      save('activities.disabled', { ...current, [a.id]: { disabled: true, reason: e.target.value } });
                    }}
                    placeholder="Raison (ex: maintenance)"
                    className="input !py-1 flex-1 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>)}

      {tab === 'pricing' && (<div className="rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-1 text-xl">Tarifs & capacités</h2>
        <p className="mb-4 text-xs text-white/50">
          ⚠ Synchro Odoo à venir. En prod, ces valeurs sont lues depuis la table <code className="text-mw-pink">product.template</code> via API.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="py-2 text-left">Activité</th>
                <th className="py-2 text-right">Prix normal</th>
                <th className="py-2 text-right">Prix mer.</th>
                <th className="py-2 text-right">Durée</th>
                <th className="py-2 text-right">Min joueurs</th>
                <th className="py-2 text-right">Max joueurs</th>
                <th className="py-2 text-right">Buffer (min)</th>
              </tr>
            </thead>
            <tbody>
              {activities.filter((a) => a.bookable).map((a) => (
                <tr key={a.id} className="border-b border-white/5">
                  <td className="py-2 display">{a.name}</td>
                  <td className="py-2 text-right">{a.priceRegular}€</td>
                  <td className="py-2 text-right text-mw-pink">{a.priceWed}€</td>
                  <td className="py-2 text-right">{a.duration}'</td>
                  <td className="py-2 text-right">{a.minPlayers}</td>
                  <td className="py-2 text-right">{a.maxPlayers}</td>
                  <td className="py-2 text-right">{a.bufferMin || 0}'</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>)}

      {tab === 'notes' && <NoteCategoriesPanel />}

      {editingPopup && <PopupEditor popup={editingPopup} onSave={savePopup} onCancel={() => setEditingPopup(null)} />}
    </div>
  );
}

function NoteCategoriesPanel() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // { [id]: { name, color } } unsaved edits
  const [adding, setAdding] = useState(null); // { name, color } for new row

  const reload = async () => {
    setLoading(true);
    const list = await ensureDefaultNoteCategories();
    setCats(list);
    setDrafts({});
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const startEdit = (c) => setDrafts((d) => ({ ...d, [c.id]: { name: c.name, color: c.color } }));
  const cancelEdit = (id) => setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
  const saveEdit = async (id) => {
    const draft = drafts[id];
    if (!draft || !draft.name?.trim()) return;
    await updateNoteCategory(id, { name: draft.name.trim(), color: draft.color });
    await reload();
  };
  const removeCat = async (id) => {
    if (!confirm('Supprimer cette catégorie ? Les notes existantes resteront mais sans catégorie.')) return;
    await deleteNoteCategory(id);
    await reload();
  };
  const addNew = () => setAdding({ name: '', color: '#e8005a' });
  const cancelNew = () => setAdding(null);
  const saveNew = async () => {
    if (!adding?.name?.trim()) return;
    await createNoteCategory({ name: adding.name.trim(), color: adding.color, position: cats.length });
    setAdding(null);
    await reload();
  };
  const restoreDefaults = async () => {
    await restoreDefaultNoteCategories();
    await reload();
  };

  if (loading) return <div className="rounded border border-white/10 bg-mw-surface p-5 text-white/60">Chargement…</div>;

  return (
    <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="display text-xl">Catégories de notes</h2>
        <div className="flex gap-2">
          <button onClick={restoreDefaults} className="btn-outline !py-1.5 !px-3 text-xs">Restaurer défauts</button>
          <button onClick={addNew} disabled={!!adding} className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-40">+ Catégorie</button>
        </div>
      </div>

      <div className="overflow-hidden rounded border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs text-white/60">
            <tr>
              <th className="p-2 text-left">Aperçu</th>
              <th className="p-2 text-left">Nom</th>
              <th className="p-2 text-left">Couleur</th>
              <th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-t border-white/10 bg-mw-pink/5">
                <td className="p-2"><span className="inline-block h-5 w-5 rounded-full" style={{ background: adding.color }} /></td>
                <td className="p-2">
                  <input autoFocus value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="Nom catégorie" className="input !py-1.5 text-sm" />
                </td>
                <td className="p-2">
                  <input type="color" value={adding.color} onChange={(e) => setAdding({ ...adding, color: e.target.value })} className="h-8 w-16 cursor-pointer rounded border border-white/15 bg-transparent" />
                </td>
                <td className="p-2 text-right">
                  <button onClick={saveNew} disabled={!adding.name.trim()} className="text-xs text-mw-green disabled:opacity-30 mr-2">Sauver</button>
                  <button onClick={cancelNew} className="text-xs text-white/50">Annuler</button>
                </td>
              </tr>
            )}
            {cats.map((c) => {
              const draft = drafts[c.id];
              const isEditing = !!draft;
              const dispName = isEditing ? draft.name : c.name;
              const dispColor = isEditing ? draft.color : c.color;
              return (
                <tr key={c.id} className="border-t border-white/10 hover:bg-white/[0.02]">
                  <td className="p-2"><span className="inline-block h-5 w-5 rounded-full" style={{ background: dispColor }} /></td>
                  <td className="p-2">
                    {isEditing ? (
                      <input value={draft.name} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], name: e.target.value } }))} className="input !py-1.5 text-sm" />
                    ) : (
                      <span className="display">{c.name}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <input type="color" value={draft.color} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], color: e.target.value } }))} className="h-8 w-16 cursor-pointer rounded border border-white/15 bg-transparent" />
                    ) : (
                      <span className="font-mono text-xs text-white/50">{c.color}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(c.id)} disabled={!draft.name.trim()} className="text-xs text-mw-green disabled:opacity-30 mr-2">Sauver</button>
                        <button onClick={() => cancelEdit(c.id)} className="text-xs text-white/50">Annuler</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(c)} className="text-xs text-mw-pink hover:underline mr-2">Éditer</button>
                        <button onClick={() => removeCat(c.id)} className="text-xs text-mw-red hover:underline">Suppr.</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {cats.length === 0 && !adding && (
              <tr><td colSpan={4} className="p-4 text-center text-white/40 text-xs">Aucune catégorie. Clique "+ Catégorie" ou "Restaurer défauts".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PopupEditor({ popup, onSave, onCancel }) {
  const [p, setP] = useState(popup);
  const upd = (k, v) => setP({ ...p, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded border border-mw-pink/40 bg-mw-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="display mb-4 text-xl">Éditer la pop-up</h3>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs text-white/50">Emoji</div>
            <input value={p.emoji || ''} onChange={(e) => upd('emoji', e.target.value)} className="input" />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/50">Titre</div>
            <input value={p.title} onChange={(e) => upd('title', e.target.value)} className="input" />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/50">Corps (texte)</div>
            <textarea value={p.body || ''} onChange={(e) => upd('body', e.target.value)} rows={4} className="input resize-none" />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/50">Label bouton CTA</div>
            <input value={p.cta_label || ''} onChange={(e) => upd('cta_label', e.target.value)} className="input" />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/50">Action CTA</div>
            <select value={p.cta_action || 'dismiss'} onChange={(e) => upd('cta_action', e.target.value)} className="input">
              <option value="dismiss">Fermer</option>
              <option value="zenchef">Ouvrir Zenchef brasserie</option>
              <option value="upsell_addactivities">Upsell — ajouter activités</option>
              <option value="external">Lien externe</option>
            </select>
          </div>
          {p.cta_action === 'external' && (
            <div>
              <div className="mb-1 text-xs text-white/50">URL externe</div>
              <input value={p.cta_url || ''} onChange={(e) => upd('cta_url', e.target.value)} className="input" />
            </div>
          )}
          {p.cta_action === 'upsell_addactivities' && (
            <>
              <div>
                <div className="mb-1 text-xs text-white/50">Code promo auto-appliqué</div>
                <input value={p.promo_code || ''} onChange={(e) => upd('promo_code', e.target.value)} className="input" placeholder="UPSELL20" />
              </div>
              <div>
                <div className="mb-1 text-xs text-white/50">% de réduction</div>
                <input type="number" value={p.discount_pct || 0} onChange={(e) => upd('discount_pct', Number(e.target.value))} className="input" />
              </div>
            </>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.enabled} onChange={(e) => upd('enabled', e.target.checked)} className="accent-mw-pink" />
            <span>Activée</span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="btn-outline flex-1 !py-2 text-sm">Annuler</button>
          <button onClick={() => onSave(p)} className="btn-primary flex-1 !py-2 text-sm">Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onSave }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <div>
      <div className="mb-1 text-xs text-white/50">{label}</div>
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} className="input flex-1" />
        <button onClick={() => onSave(v)} className="btn-outline !py-2.5 !px-4 text-xs">Sauver</button>
      </div>
    </div>
  );
}

function TextareaField({ label, value, onSave, rows = 3 }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <div>
      <div className="mb-1 text-xs text-white/50">{label}</div>
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={rows} className="input resize-none w-full" />
      <div className="mt-1 flex justify-end">
        <button onClick={() => onSave(v)} className="btn-outline !py-1.5 !px-3 text-xs">Sauver</button>
      </div>
    </div>
  );
}

function NumField({ label, value, onSave }) {
  const [v, setV] = useState(value ?? 0);
  useEffect(() => setV(value ?? 0), [value]);
  return (
    <div>
      <div className="mb-1 text-xs text-white/50">{label}</div>
      <input
        type="number"
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onBlur={() => onSave(v)}
        className="input"
      />
    </div>
  );
}
