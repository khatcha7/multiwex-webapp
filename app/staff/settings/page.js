'use client';
import { useEffect, useState } from 'react';
import { getAllConfig, setConfig, logAudit } from '@/lib/data';
import { activities } from '@/lib/activities';

export default function StaffSettingsPage() {
  const [cfg, setCfg] = useState({});
  const [editedActivities, setEditedActivities] = useState({});

  useEffect(() => {
    setCfg(getAllConfig());
    const ed = {};
    activities.forEach((a) => {
      ed[a.id] = { priceRegular: a.priceRegular, priceWed: a.priceWed, duration: a.duration, maxPlayers: a.maxPlayers };
    });
    setEditedActivities(ed);
  }, []);

  const save = (key, value) => {
    setConfig(key, value);
    setCfg(getAllConfig());
    logAudit({ action: 'update_config', entityType: 'config', entityId: key, after: { value } });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="section-title mb-4">Réglages</h1>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-3 text-xl">Contenu éditable</h2>
        <div className="space-y-4">
          <Field label="Tagline homepage" value={cfg['site.tagline']} onSave={(v) => save('site.tagline', v)} />
          <Field label="Texte Flash Sale" value={cfg['site.flash_sale_text']} onSave={(v) => save('site.flash_sale_text', v)} />
          <Field label="Téléphone contact" value={cfg['contact.phone']} onSave={(v) => save('contact.phone', v)} />
          <Field label="Email contact" value={cfg['contact.email']} onSave={(v) => save('contact.email', v)} />
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-3 text-xl">Règles métier</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField label="Buffer entre activités (min)" value={cfg['booking.buffer_min']} onSave={(v) => save('booking.buffer_min', v)} />
          <NumField label="Cutoff rejoindre groupe (min)" value={cfg['booking.join_cutoff_min']} onSave={(v) => save('booking.join_cutoff_min', v)} />
          <NumField label="Cutoff modification (h)" value={cfg['booking.cancel_cutoff_hours']} onSave={(v) => save('booking.cancel_cutoff_hours', v)} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="display mb-1 text-xl">Tarifs & capacités</h2>
        <p className="mb-4 text-xs text-white/50">
          ⚠ Édition locale uniquement en démo. En prod, sync avec Odoo bidirectionnelle via <code className="text-mw-pink">/api/odoo/pricing</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="py-2 text-left">Activité</th>
                <th className="py-2 text-right">Prix normal</th>
                <th className="py-2 text-right">Prix mer.</th>
                <th className="py-2 text-right">Durée</th>
                <th className="py-2 text-right">Max joueurs</th>
              </tr>
            </thead>
            <tbody>
              {activities.filter((a) => a.bookable).map((a) => {
                const ed = editedActivities[a.id] || {};
                return (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="py-2 display">{a.name}</td>
                    <td className="py-1.5">
                      <input type="number" defaultValue={ed.priceRegular} className="input !py-1 text-right text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input type="number" defaultValue={ed.priceWed} className="input !py-1 text-right text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input type="number" defaultValue={ed.duration} className="input !py-1 text-right text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input type="number" defaultValue={ed.maxPlayers} className="input !py-1 text-right text-sm" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/40">
          En prod, ces valeurs sont lues depuis Odoo (table <code>product.template</code>). Sauvegarde désactivée en démo.
        </p>
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
        <button onClick={() => onSave(v)} className="btn-outline !py-2.5 text-xs">Sauver</button>
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
