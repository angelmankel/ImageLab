/**
 * One saved workflow, one line (FIXLIST-2 #53; mockup agent-handoffs/fixlist2-mockups/53-workflows-list.html):
 * type badge (image / video / upscale / other), name, short meta ("9 nodes · 4m"). The one open
 * in ComfyUI is highlighted (ember bar + tint). Hover / keyboard focus swaps the meta for
 * "Use as step" + "⋯"; "⋯", right-click and long-press open the 'comfy-workflow' menu
 * (./workflowMenu). Click = open it in the embedded ComfyUI. `large` = the phone's 52px rows,
 * where "⋯" always shows (no hover).
 */
import { useRef } from 'react';
import { IconArrowsMaximize, IconDots, IconMovie, IconPhoto, IconTopologyStar3 } from '@tabler/icons-react';
import { menuProps, openMenu } from '~/app/contextMenu';
import type { ComfyWorkflowTarget } from './workflowMenu';
import { rowMeta, type WorkflowType } from './workflowListLogic';
import type { ComfyWorkflowRow } from './useComfyWorkflows';

const TYPE: Record<WorkflowType, { icon: typeof IconPhoto; color: string; label: string }> = {
  image: { icon: IconPhoto, color: 'var(--il-ember)', label: 'Image workflow' },
  video: { icon: IconMovie, color: 'var(--il-info)', label: 'Video workflow' },
  upscale: { icon: IconArrowsMaximize, color: 'var(--il-ok)', label: 'Upscale workflow' },
  other: { icon: IconTopologyStar3, color: 'var(--il-muted)', label: 'Workflow' },
};

export function WorkflowRow({ row, selected, now, target, large }: {
  row: ComfyWorkflowRow; selected: boolean; now: number; target: ComfyWorkflowTarget; large?: boolean;
}) {
  const more = useRef<HTMLButtonElement>(null);
  const t = TYPE[row.type ?? 'other'];
  const Icon = t.icon;
  const meta = rowMeta(row.nodes, row.usedAt, row.savedAt, now, large);
  const folder = row.path.includes('/') ? row.path.slice(0, row.path.lastIndexOf('/')) : '';
  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      className={`il-wf-row${selected ? ' is-on' : ''}${large ? ' is-large' : ''}`}
      {...menuProps<ComfyWorkflowTarget>('comfy-workflow', target)}
      onClick={target.open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); target.open(); } }}
      title={row.path}
    >
      <span aria-label={t.label} className="il-wf-badge" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 16%, transparent)` }}>
        <Icon size={large ? 16 : 13} stroke={2.2} />
      </span>
      <span className="il-wf-name">
        {row.name}
        {folder && <span className="il-wf-folder"> · {folder}</span>}
      </span>
      {meta && <span className="il-wf-meta">{meta}</span>}
      <span className="il-wf-acts">
        {!large && (
          <button type="button" className="il-wf-use" onClick={(e) => { e.stopPropagation(); target.use(); }} onKeyDown={(e) => e.stopPropagation()}
            title="Add as step">
            Use as step
          </button>
        )}
        <button type="button" ref={more} className="il-wf-more" aria-label={`More for ${row.name}`} aria-haspopup="menu"
          onClick={(e) => { e.stopPropagation(); if (more.current) openMenu('comfy-workflow', target, more.current, { keyboard: e.detail === 0 }); }}
          onKeyDown={(e) => e.stopPropagation()}>
          <IconDots size={large ? 18 : 15} stroke={2.4} />
        </button>
      </span>
    </div>
  );
}
