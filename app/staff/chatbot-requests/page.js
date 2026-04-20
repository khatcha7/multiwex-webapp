'use client';

import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  pending: { label: 'À traiter', color: 'bg-mw-red/20 text-mw-red' },
  in_progress: { label: 'En cours', color: 'bg-mw-yellow/20 text-mw-yellow' },
  resolved: { label: 'Résolu', color: 'bg-green-500/20 text-green-300' },
  dismissed: { label: 'Ignoré', color: 'bg-white/10 text-white/40' },
};

export default function ChatbotRequestsPage() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const url = filter ? `/api/chatbot-escalations?status=${filter}` : '/api/chatbot-escalations';
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      setEscalations(j.escalations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status, extra = {}) {
    try {
      const r = await fetch('/api/chatbot-escalations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status, ...extra }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error);
      }
      await load();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      alert('Erreur : ' + (e.message || e));
    }
  }

  const counts = {
    pending: escalations.filter((e) => e.status === 'pending').length,
    in_progress: escalations.filter((e) => e.status === 'in_progress').length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="display text-3xl text-mw-pink">💬 Demandes via chatbot IA</h1>
        <button onClick={load} className="rounded border border-white/20 px-3 py-1 text-xs hover:border-white/40">↻ Rafraîchir</button>
      </div>

      <p className="mb-6 text-sm text-white/60">
        Clients qui ont échangé avec Ellie IA et dont la demande nécessite un traitement humain (packs custom, séminaires B2B, réclamations, cas complexes).
      </p>

      <div className="mb-4 flex gap-2">
        {['pending', 'in_progress', 'resolved', 'dismissed', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`rounded border px-3 py-1 text-xs transition ${filter === s ? 'border-mw-pink bg-mw-pink/20 text-mw-pink' : 'border-white/20 text-white/60 hover:border-white/40'}`}
          >
            {s ? STATUS_LABELS[s].label : 'Tout'}
          </button>
        ))}
      </div>

      {loading && <div className="py-12 text-center text-white/40">Chargement…</div>}

      {!loading && escalations.length === 0 && (
        <div className="rounded border border-white/10 bg-white/[0.02] p-12 text-center text-white/40">
          Aucune demande {filter ? STATUS_LABELS[filter]?.label?.toLowerCase() : ''}
        </div>
      )}

      {!loading && escalations.length > 0 && (
        <div className="space-y-3">
          {escalations.map((e) => {
            const s = STATUS_LABELS[e.status] || STATUS_LABELS.pending;
            return (
              <div key={e.id} className="rounded border border-white/10 bg-[#0f0f14] p-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <div className="display text-lg">
                      {e.customer_first_name} {e.customer_last_name}
                      {e.priority === 'high' && <span className="ml-2 rounded bg-mw-red/30 px-2 py-0.5 text-[10px] font-bold text-mw-red">URGENT</span>}
                    </div>
                    <div className="text-sm text-white/60">
                      📧 {e.customer_email}
                      {e.customer_phone && <span className="ml-2">📞 {e.customer_phone}</span>}
                    </div>
                    <div className="mt-1 text-[10px] text-white/40">
                      Demande reçue {new Date(e.created_at).toLocaleString('fr-BE')}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase ${s.color}`}>{s.label}</span>
                </div>

                <div className="mt-3 rounded bg-white/[0.03] p-3 text-sm text-white/80">
                  <div className="mb-1 text-[10px] uppercase text-white/40">Demande du client</div>
                  {e.reason}
                </div>

                {e.resolution_notes && (
                  <div className="mt-2 rounded border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-300">
                    <div className="mb-1 text-[10px] uppercase text-green-400">Notes staff</div>
                    {e.resolution_notes}
                  </div>
                )}

                {e.status !== 'resolved' && e.status !== 'dismissed' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(e.id, 'in_progress')}
                        className="rounded border border-mw-yellow/40 bg-mw-yellow/10 px-3 py-1.5 text-xs text-mw-yellow hover:bg-mw-yellow/20"
                      >
                        Je prends en charge
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const n = prompt('Notes de résolution (contact fait, résultat, etc.) :', '');
                        if (n !== null) updateStatus(e.id, 'resolved', { resolution_notes: n });
                      }}
                      className="rounded border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/20"
                    >
                      ✓ Résolu
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Marquer comme ignoré (spam, erreur) ?')) updateStatus(e.id, 'dismissed');
                      }}
                      className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/60 hover:border-white/40"
                    >
                      Ignorer
                    </button>
                    <a
                      href={`mailto:${e.customer_email}?subject=Votre demande Multiwex - ${e.customer_first_name}`}
                      className="rounded border border-mw-pink/40 bg-mw-pink/10 px-3 py-1.5 text-xs text-mw-pink hover:bg-mw-pink/20"
                    >
                      📧 Répondre par mail
                    </a>
                    {e.customer_phone && (
                      <a
                        href={`tel:${e.customer_phone}`}
                        className="rounded border border-mw-cyan/40 bg-mw-cyan/10 px-3 py-1.5 text-xs text-mw-cyan hover:bg-mw-cyan/20"
                      >
                        📞 Appeler
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
