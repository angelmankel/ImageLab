/**
 * One saved workflow (rule 14): graph icon, name, "12 nodes · used 2 min ago", delete, and
 * "Use as step". Click = open it in the embedded ComfyUI (FIXLIST 34). Selected = the one open
 * there (else the one in the shared Studio store). `large` = the phone's 56px thumb rows.
 * Right-click / long-press: the 'comfy-workflow' menu (./workflowMenu).
 */
import { IconTopologyStar3, IconTrash } from '@tabler/icons-react';
import { menuProps } from '~/app/contextMenu';
import type { ComfyWorkflowTarget } from './workflowMenu';
import { workflowDetail } from './comfyHelpers';
import type { ComfyWorkflowRow } from './useComfyWorkflows';

export function WorkflowRow({ row, selected, now, onSelect, onUse, onDelete, large }: {
  row: ComfyWorkflowRow; selected: boolean; now: number; onSelect: () => void; onUse: () => void; onDelete?: () => void; large?: boolean;
}) {
  const detail = workflowDetail(row.nodes, row.usedAt, row.savedAt, now);
  return (
    <div
      role="button"
      tabIndex={0}
      {...menuProps<ComfyWorkflowTarget>('comfy-workflow', { row, open: onSelect, use: onUse, remove: onDelete ?? null })}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: large ? 56 : 52, padding: large ? '8px 8px 8px 10px' : '7px 8px 7px 10px',
        borderRadius: 14, background: selected ? 'var(--il-card-on)' : 'transparent', color: 'var(--il-fg)', cursor: 'pointer',
      }}
    >
      <span aria-hidden style={{ width: large ? 32 : 30, height: large ? 32 : 30, flex: 'none', borderRadius: 10, background: large ? 'var(--il-panel)' : 'var(--il-card)', color: selected ? 'var(--il-ember-hi)' : 'var(--il-muted)', display: 'grid', placeItems: 'center' }}>
        <IconTopologyStar3 size={16} stroke={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.path}>{row.name}</span>
        {detail && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{detail}</span>}
      </span>
      {onDelete && (
        <button
          type="button"
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--il-err)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--il-dim)'; }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Delete ${row.name}`} title="Delete this workflow from ComfyUI (Undo in the note)"
          style={{ flex: 'none', width: large ? 40 : 28, height: large ? 40 : 28, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-dim)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
        >
          <IconTrash size={15} stroke={2.2} />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUse(); }}
        title="Add a step that runs this workflow"
        style={{
          flex: 'none', border: 0, borderRadius: 999, padding: large ? '8px 10px' : '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
          background: selected ? 'var(--il-ember)' : 'var(--il-card-on)', color: selected ? 'var(--il-bg)' : 'var(--il-fg2)',
        }}
      >
        Use as step
      </button>
    </div>
  );
}
