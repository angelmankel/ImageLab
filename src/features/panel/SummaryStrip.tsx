/**
 * One line under the tab bar that answers "what will the next run use?" without opening a tab:
 * model · sampler · steps · size · seed. Each part is a button to where it is edited.
 */
import type { ReactNode } from 'react';
import { IconDice5 } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import type { SectionId } from '@/lib/panelTabs';
import { usePanelTabs } from './panelTabsStore';
import { shortName, type PanelScope, type SectionStatus } from './sections';

/** The footer's seed box (LeftPanel). */
export const SEED_INPUT_ID = 'panel-seed-input';

export function SummaryStrip({ scope, status }: { scope: PanelScope; status: Record<SectionId, SectionStatus> }) {
  const base = useStore(s => s.workflow.checkpoints[0]?.name);
  const sampler = useStore(s => s.workflow.sampler);
  const steps = useStore(s => s.workflow.steps);
  const width = useStore(s => s.workflow.width);
  const height = useStore(s => s.workflow.height);
  const seed = useStore(s => s.workflow.seed);
  const auto = useStore(s => s.workflow.randomizeSeed);
  const showSection = usePanelTabs(s => s.showSection);
  const size = scope.size ?? { width, height };

  const focusSeed = () => {
    const el = document.getElementById(SEED_INPUT_ID) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  };

  return (
    <div className="scroll-x-thin flex shrink-0 items-center gap-0.5 border-b border-border-default px-1.5 py-1 text-[11px] tabular-nums text-fg-muted"
      aria-label="Current settings">
      <Part label="Model" onClick={() => showSection('models')} warn={status.models.tone === 'warn'} title={status.models.note} className="max-w-[9rem]">
        {base ? shortName(base) : 'no checkpoint'}
      </Part>
      <Dot />
      <Part label="Sampler" onClick={() => showSection('parameters')} warn={status.parameters.tone === 'warn'} className="max-w-[7rem]">{sampler}</Part>
      <Dot />
      <Part label="Steps" onClick={() => showSection('parameters')}>{steps} steps</Part>
      <Dot />
      {/* A canvas layer's size is its bounds, set on the canvas, so there is nothing to open. */}
      <Part label="Size" onClick={scope.layerScope ? undefined : () => showSection('composition')}>{size.width}×{size.height}</Part>
      <Dot />
      <Part label="Seed" onClick={focusSeed} className="flex items-center gap-1">
        <IconDice5 size={12} stroke={1.6} aria-label="Seed" />{auto ? 'auto' : seed}
      </Part>
    </div>
  );
}

function Part({ label, onClick, warn, title, className, children }: {
  label: string; onClick?: () => void; warn?: boolean; title?: string; className?: string; children: ReactNode;
}) {
  const cls = cn('shrink-0 truncate whitespace-nowrap rounded px-1 py-1', warn && 'text-red-400', className);
  if (!onClick) return <span className={cls}>{children}</span>;
  return (
    <button type="button" onClick={onClick} title={title ?? `Go to ${label.toLowerCase()}`}
      className={cn(cls, 'outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent')}>
      {children}
    </button>
  );
}

const Dot = () => <span aria-hidden className="shrink-0 opacity-40">·</span>;
