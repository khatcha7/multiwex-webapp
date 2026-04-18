'use client';
import { deleteNote } from '@/lib/data';

export default function SlotNotesPopover({ notes, categories, position, onClose, onEdit, onDeleted, onAddNew }) {
  const remove = async (note) => {
    if (!confirm('Supprimer cette note ?')) return;
    await deleteNote(note.id);
    onDeleted?.();
  };

  // Position the popover near the click coords, clamped to viewport
  const left = Math.min(position.x, (typeof window !== 'undefined' ? window.innerWidth - 340 : 800));
  const top = Math.min(position.y, (typeof window !== 'undefined' ? window.innerHeight - 280 : 500));

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-80 max-h-[400px] overflow-y-auto rounded border-2 border-mw-pink bg-mw-surface shadow-xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-mw-surface px-3 py-2">
          <div className="display text-xs">📓 Notes ({notes.length})</div>
          <div className="flex items-center gap-2">
            {onAddNew && <button onClick={onAddNew} className="text-xs text-mw-pink hover:underline">+ Ajouter</button>}
            <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
          </div>
        </div>
        <div className="divide-y divide-white/10">
          {notes.map((n) => {
            const cat = categories.find((c) => c.id === n.category_id);
            return (
              <div key={n.id} className="p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat?.color || '#888' }} />
                    <span className="text-white/70">{cat?.name || 'Sans catégorie'}</span>
                    {n.locked && <span title="Verrouillée par admin" className="text-[10px]">🔒</span>}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {new Date(n.updated_at || n.created_at).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="prose-tiptap mb-2 text-xs text-white/85" dangerouslySetInnerHTML={{ __html: n.content }} />
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>{n.updated_by_name || n.created_by_name || '—'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(n)} className="text-mw-pink hover:underline">Éditer</button>
                    <button onClick={() => remove(n)} className="text-mw-red hover:underline">Suppr.</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
