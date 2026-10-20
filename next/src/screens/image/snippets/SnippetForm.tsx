/**
 * Rule 6: the small inline snippet form — name, text, category — used by "+ New" under the chips
 * and by the browser's add / edit. Plain inputs in the Ember look; Save is off until name and
 * text are both there. Enter in the name box saves, Escape cancels.
 */
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Snippet, SnippetCategory } from '@/lib/types';
import { canSave } from './snippetLogic';

export type SnippetFormValues = { name: string; text: string; categoryId: string };

const field: CSSProperties = {
  width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-elev)', color: 'var(--il-fg)',
  fontSize: 12, fontWeight: 600, padding: '7px 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

function btn(primary: boolean, disabled = false): CSSProperties {
  return {
    height: 28, padding: '0 12px', border: 0, borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: disabled ? 'default' : 'pointer',
    background: primary ? 'var(--il-ember)' : 'var(--il-card-on)', color: primary ? 'var(--il-bg)' : 'var(--il-fg2)', opacity: disabled ? 0.45 : 1,
  };
}

export function SnippetForm({ initial, categories, defaultCategory, onSave, onCancel, saveLabel = 'Save', autoFocus = true }: {
  initial?: Pick<Snippet, 'name' | 'text' | 'categoryId'>; categories: SnippetCategory[]; defaultCategory: string;
  onSave: (v: SnippetFormValues) => void; onCancel: () => void; saveLabel?: string; autoFocus?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategory);
  const ok = canSave(name, text);
  const save = () => { if (ok) onSave({ name: name.trim(), text: text.trim(), categoryId }); };
  const onKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && !e.shiftKey && (e.currentTarget.tagName !== 'TEXTAREA' || e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  };

  return (
    <div data-no-swipe style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 14, background: 'var(--il-card)', border: '1px solid var(--il-line-soft)' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Snippet name" autoFocus={autoFocus} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder="Name" style={{ ...field, flex: 1, minWidth: 0 }} />
        <select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...field, width: 'auto', maxWidth: '45%', cursor: 'pointer' }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
        </select>
      </div>
      <textarea aria-label="Snippet text" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="What it puts in the prompt" style={{ ...field, resize: 'vertical', lineHeight: 1.4 }} />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btn(false)}>Cancel</button>
        <button type="button" onClick={save} disabled={!ok} style={btn(true, !ok)}>{saveLabel}</button>
      </div>
    </div>
  );
}
