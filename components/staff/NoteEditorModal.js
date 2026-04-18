'use client';
import { useEffect, useState } from 'react';
import { listNoteCategories, createNote, updateNote, deleteNote } from '@/lib/data';
import RichTextEditor from './RichTextEditor';

export default function NoteEditorModal({ editor, activities, onClose, onSaved }) {
  const isEdit = editor.mode === 'edit';
  const [content, setContent] = useState(editor.content || '');
  const [scope, setScope] = useState(editor.scope || 'slot');
  const [categoryId, setCategoryId] = useState(editor.category_id || editor.categoryId || '');
  const [activityId, setActivityId] = useState(editor.activity_id || editor.activityId || '');
  const [slotStart, setSlotStart] = useState(editor.slot_start || editor.slotStart || '');
  const [slotEnd, setSlotEnd] = useState(editor.slot_end || editor.slotEnd || '');
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listNoteCategories().then(setCategories);
  }, []);

  const canSave = !!content.trim() && (scope === 'day' || (activityId && slotStart));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        content: content.trim(),
        scope,
        date: editor.date,
        categoryId: categoryId || null,
        activityId: scope === 'day' ? null : activityId,
        slotStart: scope === 'day' ? null : slotStart,
        slotEnd: scope === 'range' ? slotEnd : (scope === 'slot' ? slotEnd : null),
      };
      if (isEdit) await updateNote(editor.id, payload);
      else await createNote(payload);
      onSaved();
    } catch (e) {
      console.error('Note save error', e);
      alert('Erreur lors de la sauvegarde : ' + (e?.message || 'inconnue'));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!isEdit) return;
    if (!confirm('Supprimer cette note ?')) return;
    setSaving(true);
    try {
      await deleteNote(editor.id);
      onSaved();
    } finally { setSaving(false); }
  };

  const bookableActivities = activities.filter((a) => a.bookable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded border-2 border-mw-pink bg-mw-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="display text-xl">{isEdit ? '✏️ Éditer la note' : '🗒 Nouvelle note'}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-white/60">Catégorie</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              <option value="">— Sans catégorie —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {categoryId && (
              <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: categories.find((c) => c.id === categoryId)?.color }} />
                Aperçu bulle
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">Portée</label>
            <div className="flex gap-2">
              {[
                ['slot', 'Créneau précis'],
                ['range', 'Plage horaire'],
                ['day', 'Journée entière'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setScope(v)}
                  className={`flex-1 rounded border px-3 py-1.5 text-xs transition ${scope === v ? 'border-mw-pink bg-mw-pink/20 text-mw-pink' : 'border-white/20 text-white/70 hover:border-white/40'}`}
                >{l}</button>
              ))}
            </div>
          </div>

          {scope !== 'day' && (
            <>
              <div>
                <label className="mb-1 block text-xs text-white/60">Activité</label>
                <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className="input">
                  <option value="">— Sélectionner —</option>
                  {bookableActivities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className={scope === 'range' ? 'grid grid-cols-2 gap-2' : ''}>
                <div>
                  <label className="mb-1 block text-xs text-white/60">{scope === 'range' ? 'Début' : 'Créneau'}</label>
                  <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="input" />
                </div>
                {scope === 'range' && (
                  <div>
                    <label className="mb-1 block text-xs text-white/60">Fin</label>
                    <input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="input" />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs text-white/60">Contenu</label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {isEdit && (editor.created_by_name || editor.updated_by_name) && (
            <div className="rounded bg-white/[0.03] p-2 text-[11px] text-white/50">
              {editor.created_by_name && <div>Créée par <span className="text-white/70">{editor.created_by_name}</span> le {new Date(editor.created_at).toLocaleString('fr-BE')}</div>}
              {editor.updated_by_name && editor.updated_at !== editor.created_at && (
                <div>Modifiée par <span className="text-white/70">{editor.updated_by_name}</span> le {new Date(editor.updated_at).toLocaleString('fr-BE')}</div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          {isEdit ? (
            <button onClick={remove} disabled={saving} className="text-xs text-mw-red hover:underline disabled:opacity-30">🗑 Supprimer</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="btn-outline !py-2 !px-4 text-sm">Annuler</button>
            <button onClick={save} disabled={!canSave || saving} className="btn-primary !py-2 !px-4 text-sm disabled:opacity-30">
              {saving ? '…' : (isEdit ? 'Enregistrer' : 'Créer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
