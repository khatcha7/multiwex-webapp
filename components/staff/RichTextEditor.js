'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { useEffect } from 'react';

const COLORS = ['#ffffff', '#e8005a', '#f3d10b', '#00d9ff', '#00ff66', '#b400ff', '#ff8c00', '#888888'];

export default function RichTextEditor({ value = '', onChange, autoFocus = true, placeholder = 'Écris ta note ici…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false, blockquote: false }),
      Underline,
      TextStyle,
      Color,
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose-tiptap min-h-[120px] w-full rounded border border-white/15 bg-mw-bg p-3 text-sm focus:border-mw-pink focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (editor && autoFocus) editor.commands.focus('end');
  }, [editor, autoFocus]);

  if (!editor) return null;

  const Btn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded text-xs transition ${active ? 'bg-mw-pink text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
    >{children}</button>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Btn title="Gras (Cmd+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></Btn>
        <Btn title="Italique (Cmd+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></Btn>
        <Btn title="Souligné (Cmd+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="Barré" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <div className="mx-1 h-6 w-px bg-white/10" />
        <Btn title="Liste à puces" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
        <Btn title="Liste numérotée" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <div className="mx-1 h-6 w-px bg-white/10" />
        <div className="flex items-center gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Texte ${c}`}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); }}
              className="h-5 w-5 rounded-full border border-white/20 transition hover:scale-110"
              style={{ background: c }}
            />
          ))}
          <button
            type="button"
            title="Retirer la couleur"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
            className="ml-0.5 h-5 w-5 rounded-full border border-white/20 text-[10px] text-white/60 hover:bg-white/10"
          >✕</button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
