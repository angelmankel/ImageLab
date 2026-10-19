import type { ReactNode } from 'react';
import { Tip } from '@/components/ui/Tooltip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/cn';
import { IconEraser } from '@tabler/icons-react';
import { clearAllSettings } from './clearAll';
import { PRESET_SLOTS, useParamPresets } from './paramPresets';

const iconButton = 'flex items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-35';

function ToolButton({ label, children, big, ...rest }: { label: string; children: ReactNode; big?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip label={label} side="bottom">
      <button type="button" aria-label={label} {...rest} className={cn(iconButton, big ? 'h-10 w-10' : 'h-7 w-7', rest.className)}>{children}</button>
    </Tip>
  );
}

/**
 * The strip across the top of the left panel, as in v1: what is being edited on the left (a
 * canvas layer's name), then "Clear all" (settings to defaults, no models; Undo in a notification),
 * then five preset slots. An empty slot saves, a saved slot loads, and the active slot saves
 * again — the two saves ask first. Folding moved to the tab bar. `big`: the phone's version, a
 * card in the settings list with thumb-sized buttons.
 */
export function PanelToolbar({ note, big = false }: { note?: string; big?: boolean }) {
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
    <div className={big
      ? 'flex shrink-0 flex-wrap items-center justify-between gap-2'
      : 'flex shrink-0 items-center justify-between gap-2 border-b border-border-default bg-bg-base/40 py-1.5 pl-3 pr-2.5'}>
      {!big && <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">{note}</span>}
      <Tip label="Set every setting back to its default and remove all models. Prompts stay." side="bottom">
        <button type="button" onClick={clearAllSettings}
          className={cn(big ? 'h-10 px-2.5 text-[13px]' : 'h-7 px-1.5 text-[11px]', 'flex shrink-0 items-center gap-1 rounded-md text-fg-muted outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent')}>
          <IconEraser size={14} stroke={1.7} />
          Clear all
        </button>
      </Tip>
      <div className={cn('flex items-center', big ? 'gap-1.5' : 'gap-0.5')}>
        <span className={cn('mr-1 text-fg-muted', big ? 'text-[13px]' : 'text-[11px]')}>Presets</span>
        {Array.from({ length: PRESET_SLOTS }, (_, i) => i + 1).map(slot => {
          const saved = !!slots[slot];
          const isActive = active === slot && saved;
          return (
            <ToolButton
              key={slot}
              big={big}
              label={isActive ? `Click to update preset ${slot}` : saved ? `Load preset ${slot}` : `Save to preset ${slot}`}
              onClick={() => { void onSlot(slot); }}
              className={cn(
                big ? 'text-[14px]' : 'text-[11px]',
                'font-semibold tabular-nums',
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
