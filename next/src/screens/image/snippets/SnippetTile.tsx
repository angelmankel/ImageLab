/**
 * Rule 6: one snippet in the browser — name, what it puts in the prompt, lit when it is in the
 * prompt; a tap toggles it. Edit and delete sit in the corner and never toggle.
 */
import type { ReactNode } from 'react';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { Snippet } from '@/lib/types';
import { previewText } from './snippetLogic';

function Corner({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ width: 26, height: 26, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
      {icon}
    </button>
  );
}

export function SnippetTile({ snippet, on, onToggle, onEdit, onDelete, phone }: {
  snippet: Snippet; on: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; phone: boolean;
}) {
  return (
    <div role="button" tabIndex={0} aria-pressed={on} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4, padding: phone ? 12 : 10, minHeight: phone ? 84 : 76, borderRadius: 14, cursor: 'pointer', userSelect: 'none',
        background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', border: on ? '1px solid var(--il-ember-line)' : '1px solid var(--il-line-soft)',
        color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{snippet.name}</span>
        <Corner icon={<IconPencil size={14} stroke={2.2} />} label="Edit" onClick={onEdit} />
        <Corner icon={<IconTrash size={14} stroke={2.2} />} label="Delete" onClick={onDelete} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4, color: on ? 'var(--il-fg2)' : 'var(--il-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
        {previewText(snippet) || '—'}
      </div>
      {snippet.layers && <span className="il-eyebrow" style={{ marginTop: 'auto' }}>preset · {snippet.layers.length} part{snippet.layers.length === 1 ? '' : 's'}</span>}
    </div>
  );
}
