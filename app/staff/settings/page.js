'use client';
import { useEffect, useState } from 'react';
import { getAllConfig, setConfig, logAudit, getPopups, savePopups, upsertPopup, deletePopup } from '@/lib/data';
import { activities } from '@/lib/activities';

export default function StaffSettingsPage() {
  const [cfg, setCfg] = useState({});
  const [popups, setPopups] = useState([]);
  const [editingPopup, setEditingPopup] = useState(null);

  useEffect(() => {
    setCfg(getAllConfig());
    setPopups(getPopups());
  }, []);

  const save = (key, value) => {
    setConfig(key, value);
    setCfg(getAllConfig());
    logAudit({ action: 'update_config', entityType: 'config', entityId: key, after: { value } });
  };

  const savePopup = (popup) => {
    const all = upsertPopup(popup);
    setPopups(all);
    setEditingPopup(null);
    logAudit({ action: 'upsert_popup', entityType: 'popup', entityId: popup.id, after: popup });
  };

  const removePopup = (id) => {
    if (!confirm('Supprimer cette pop-up ?')) return;
    const all = deletePopup(id);
    setPopups(all);
    logAudit({ action: 'delete_popup', entityType: 'popup', entityId: id });
  };

  const togglePopupEnabled = (id) => {
    const p = popups.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, enabled: !p.enabled };
    savePopup(updated);
  };

  const movePopup = (id, delta) => {
    const sorted = [...popups].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    const renumbered = sorted.map((p, i) => ({ ...p, order: i }));
    savePopups(renumbered);
    setPopups(renumbered);
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
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="section-title mb-4">Réglages</h1>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
        <h2 className="display mb-3 text-xl">Contenu éditable</h2>
        <div className="space-y-4">
          <Field label="Tagline homepage" value={cfg['site.tagline']} onSave={(v) => save('site.tagline', v)} />
          <Field label="Texte Flash Sale (marquee)" value={cfg['site.flash_sale_text']} onSave={(v) => save('site.flash_sale_text', v)} />
          <Field label="Téléphone contact" value={cfg['contact.phone']} onSave={(v) => save('contact.phone', v)} />
          <Field label="Email contact" value={cfg['contact.email']} onSave={(v) => save('contact.email', v)} />
        </div>
      </div>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      <div className="mb-6 rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      <div className="rounded border border-white/10 bg-mw-surface p-5">
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
      </div>

      {editingPopup && <PopupEditor popup={editingPopup} onSave={savePopup} onCancel={() => setEditingPopup(null)} />}
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
