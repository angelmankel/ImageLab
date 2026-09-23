import type { ReactNode } from 'react';
import { CollapseAllIcon, ExpandAllIcon, SingleOpenIcon } from '@/components/ui/icons';
import { Tip } from '@/components/ui/Tooltip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/cn';
import { isOpen, useSectionGroup } from './sectionGroup';
import { PRESET_SLOTS, useParamPresets } from './paramPresets';

const iconButton = 'flex h-7 w-7 items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-35';

function ToolButton({ label, children, ...rest }: { label: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip label={label} side="bottom">
      <button type="button" aria-label={label} {...rest} className={cn(iconButton, rest.className)}>{children}</button>
    </Tip>
  );
}

/**
 * The strip across the top of the left panel, as in v1: expand all, collapse all, and single-open
 * mode on the left; five preset slots on the right. An empty slot saves, a saved slot loads, and
 * the active slot saves again — the two saves ask first.
 */
export function PanelToolbar({ note }: { note?: string }) {
  const allOpen = useSectionGroup(s => s.mounted.length > 0 && s.mounted.every(m => isOpen(s, m.id, m.defaultCollapsed)));
  const noneOpen = useSectionGroup(s => s.mounted.every(m => !isOpen(s, m.id, m.defaultCollapsed)));
  const singleOpen = useSectionGroup(s => s.singleOpen);
  const { expandAll, collapseAll, toggleSingleOpen } = useSectionGroup.getState();

  const slots = useParamPresets(s => s.slots);
  const active = useParamPresets(s => s.active);
  const confirm = useConfirm();

  const onSlot = async (slot: number) => {
    const saved = !!slots[slot];
    if (saved && active !== slot) return useParamPresets.getState().load(slot);
    const ok = await confirm({
      title: `Save to preset ${slot}`,
      message: saved
        ? `Overwrite preset ${slot} with the current prompts and settings?`
        : `Save the current prompts and settings to preset ${slot}?`,
      confirmLabel: 'Save',
      destructive: false,
    });
    if (ok) useParamPresets.getState().save(slot);
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default bg-bg-base/40 py-1.5 pl-3 pr-2.5">
      <div className="flex items-center gap-0.5">
        <ToolButton label="Expand all" disabled={allOpen || singleOpen} onClick={expandAll}><ExpandAllIcon size={14} /></ToolButton>
        <ToolButton label="Collapse all" disabled={noneOpen} onClick={collapseAll}><CollapseAllIcon size={14} /></ToolButton>
        <ToolButton
          label={singleOpen ? 'Single-open mode: on (one section open at a time)' : 'Single-open mode: off (several sections can be open)'}
          aria-pressed={singleOpen}
          onClick={toggleSingleOpen}
          className={singleOpen ? 'bg-accent text-white hover:bg-accent-hover hover:text-white' : undefined}
        >
          <SingleOpenIcon size={14} />
        </ToolButton>
      </div>
      {note && <span className="min-w-0 flex-1 truncate text-center text-[11px] text-fg-muted">{note}</span>}
      <div className="flex items-center gap-0.5">
        <span className="mr-1 text-[11px] text-fg-muted">Presets</span>
        {Array.from({ length: PRESET_SLOTS }, (_, i) => i + 1).map(slot => {
          const saved = !!slots[slot];
          const isActive = active === slot && saved;
          return (
            <ToolButton
              key={slot}
              label={isActive ? `Click to update preset ${slot}` : saved ? `Load preset ${slot}` : `Save to preset ${slot}`}
              onClick={() => { void onSlot(slot); }}
              className={cn(
                'text-[11px] font-semibold tabular-nums',
                isActive ? 'bg-accent text-white hover:bg-accent-hover hover:text-white'
                  : saved ? 'bg-accent-soft text-accent-fg hover:bg-accent-soft hover:text-fg-primary'
                  : 'text-fg-tertiary',
              )}
            >
              {slot}
            </ToolButton>
          );
        })}
      </div>
    </div>
  );
}
