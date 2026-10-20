/**
 * One saved workflow (rule 14): graph icon, name, "12 nodes · used 2 min ago", and "Use as step".
 * Selected = the one open in the shared Studio store. `large` = the phone's 56px thumb rows.
 */
import { IconTopologyStar3 } from '@tabler/icons-react';
import { workflowDetail } from './comfyHelpers';
import type { ComfyWorkflowRow } from './useComfyWorkflows';

export function WorkflowRow({ row, selected, now, onSelect, onUse, large }: {
  row: ComfyWorkflowRow; selected: boolean; now: number; onSelect: () => void; onUse: () => void; large?: boolean;
}) {
  const detail = workflowDetail(row.nodes, row.usedAt, row.savedAt, now);
  return (
    <div
      role="button"
      tabIndex={0}
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
