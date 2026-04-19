'use client';
import { useEffect, useMemo, useState } from 'react';
import { activities } from '@/lib/activities';
import { listNotes, listNoteCategories, ensureDefaultNoteCategories, deleteNote } from '@/lib/data';
import { toDateStr, parseDate } from '@/lib/hours';
import NoteEditorModal from '@/components/staff/NoteEditorModal';

export default function StaffNotesPage() {
  const today = toDateStr(new Date());
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [tick, setTick] = useState(0);

  // Filters
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [actFilter, setActFilter] = useState('');
  const [search, setSearch] = useState('');

  const reload = async () => {
    setLoading(true);
    const [n, c] = await Promise.all([
      listNotes({ from: from || undefined, to: to || undefined, activityId: actFilter || undefined }),
      ensureDefaultNoteCategories(),
    ]);
    setNotes(n);
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [from, to, actFilter, tick]);

  const filtered = useMemo(() => {
    let arr = notes;
    if (catFilter) arr = arr.filter((n) => n.category_id === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((n) => {
        const plain = (n.content || '').replace(/<[^>]+>/g, '').toLowerCase();
        return plain.includes(q) || (n.created_by_name || '').toLowerCase().includes(q);
      });
    }
    return arr;
  }, [notes, catFilter, search]);

  const remove = async (n) => {
    if (!confirm('Supprimer cette note ?')) return;
    await deleteNote(n.id);
    setTick((t) => t + 1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="section-title">📝 Notes</h1>
        <button onClick={() => setEditor({ mode: 'create', scope: 'day', date: today })} className="btn-primary !py-2 !px-4 text-sm">
          + Nouvelle note
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded border border-white/10 bg-mw-surface p-3 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Catégorie</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input !py-1.5 text-sm">
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Activité</label>
          <select value={actFilter} onChange={(e) => setActFilter(e.target.value)} className="input !py-1.5 text-sm">
            <option value="">Toutes</option>
            {activities.filter((a) => a.bookable).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">Recherche</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Texte ou auteur…" className="input !py-1.5 text-sm" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded border border-white/10 bg-mw-surface p-10 text-center text-white/50">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-white/10 bg-mw-surface p-10 text-center text-white/50">Aucune note pour ce filtre.</div>
      ) : (
        <div className="overflow-hidden rounded border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs text-white/60">
              <tr>
                <th className="p-2 text-left w-32">Date</th>
                <th className="p-2 text-left w-28">Catégorie</th>
                <th className="p-2 text-left w-32">Portée</th>
                <th className="p-2 text-left">Contenu</th>
                <th className="p-2 text-left w-32">Auteur</th>
                <th className="p-2 text-left w-32">Modifiée</th>
                <th className="p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const cat = categories.find((c) => c.id === n.category_id);
                const act = activities.find((a) => a.id === n.activity_id);
                const room = act?.rooms?.find((r) => r.id === n.room_id);
                const actLabel = act ? (room ? `${act.name} · ${room.name}` : act.name) : null;
                const scopeLabel = n.scope === 'day' ? 'Journée' : n.scope === 'range'
                  ? `${(n.slot_start||'').slice(0,5)}-${(n.slot_end||'').slice(0,5)}`
                  : (n.slot_start || '').slice(0, 5);
                return (
                  <tr key={n.id} className="border-t border-white/10 hover:bg-white/[0.02]">
                    <td className="p-2 font-mono text-xs">{n.note_date}</td>
                    <td className="p-2">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : <span className="text-white/30 text-xs">—</span>}
                    </td>
                    <td className="p-2 text-xs">
                      {actLabel && <span className="text-white/70">{actLabel}</span>}
                      <span className="block text-white/50">{scopeLabel}</span>
                    </td>
                    <td className="p-2">
                      <div className="prose-tiptap text-xs text-white/85" dangerouslySetInnerHTML={{ __html: n.content }} />
                    </td>
                    <td className="p-2 text-xs text-white/60">{n.created_by_name || '—'}</td>
                    <td className="p-2 text-xs text-white/50">
                      {new Date(n.updated_at || n.created_at).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {n.updated_by_name && n.updated_by_name !== n.created_by_name && (
                        <div className="text-white/40">par {n.updated_by_name}</div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => setEditor({ mode: 'edit', ...n })} className="text-xs text-mw-pink hover:underline mr-2">Éditer</button>
                      <button onClick={() => remove(n)} className="text-xs text-mw-red hover:underline">Suppr.</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <NoteEditorModal
          editor={editor}
          activities={activities}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); setTick((t) => t + 1); }}
        />
      )}
    </div>
  );
}
