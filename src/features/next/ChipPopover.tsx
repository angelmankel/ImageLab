/**
 * One setting as a chip that reads `Name value`, filled when it differs from its default. A tap
 * opens its editor: on desktop a popover beside the chip (`components/ui/popover`, the one base:
 * portal, flip, shift, z 300); on a phone a full-screen window, since the phone has no overlays
 * that hang off a point. The editor is tap-able preset chips on top (`presets`) and the real
 * field under them (`children`), so a quick change is one tap and a precise one is still there.
 */
import { forwardRef, useState, type ReactNode } from 'react';
import { Modal, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft } from '@tabler/icons-react';
import * as Popover from '@/components/ui/popover';
import { POPOVER_UNDER_MODALS_Z } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

export interface ChipPreset { label: string; on: boolean; onPick: () => void }

/** forwardRef: the popover hangs off it, and Mantine's Target needs the DOM node. */
export const Chip = forwardRef<HTMLButtonElement, {
  label: string; value: string; changed: boolean; large?: boolean; onClick?: () => void; icon?: ReactNode;
  /** Something is wrong with it (a file the server lacks). */
  warn?: string;
}>(function Chip({ label, value, changed, large, onClick, icon, warn }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={warn}
      aria-label={`${label}: ${value}`}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border text-left outline-none transition-colors',
        'focus-visible:ring-1 focus-visible:ring-accent',
        large ? 'h-10 px-3.5 text-[13px]' : 'h-9 px-3 text-[12.5px]',
        changed
          ? 'border-transparent bg-accent-soft text-accent-fg hover:brightness-110'
          : 'border-border-default bg-bg-elev text-fg-secondary hover:border-border-strong',
        warn && 'border-status-err/60',
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className={cn('max-w-[160px] truncate', changed ? 'opacity-90' : 'text-fg-muted')}>{value}</span>
      {warn && <span className="text-status-err">!</span>}
    </button>
  );
});

/** The preset row of an editor: tap a value. */
export function PresetChips({ presets, large }: { presets: readonly ChipPreset[]; large?: boolean }) {
  if (!presets.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map(p => (
        <button key={p.label} type="button" onClick={p.onPick} aria-pressed={p.on}
          className={cn(
            'rounded-full border px-3 font-medium tabular-nums outline-none transition-colors focus-visible:ring-1 focus-visible:ring-accent',
            large ? 'h-10 text-[13px]' : 'h-8 text-[12px]',
            p.on ? 'border-transparent bg-accent text-white' : 'border-border-default bg-bg-input text-fg-secondary hover:border-border-strong',
          )}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function ChipPopover({ label, value, changed, icon, warn, presets, width = 360, children }: {
  label: string; value: string; changed: boolean; icon?: ReactNode; warn?: string;
  presets?: readonly ChipPreset[];
  width?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;

  const body = (
    <div className={cn('flex flex-col gap-3', narrow ? 'p-4 [&_.mantine-Text-root]:text-[14px]' : 'p-3')}>
      {presets && presets.length > 0 && <PresetChips presets={presets} large={narrow} />}
      {children}
    </div>
  );

  if (narrow) {
    return (
      <>
        <Chip label={label} value={value} changed={changed} icon={icon} warn={warn} large onClick={() => setOpen(true)} />
        <Modal
          opened={open} onClose={() => setOpen(false)} fullScreen withCloseButton={false} padding={0}
          transitionProps={{ transition: 'fade', duration: 120 }}
          styles={{ content: { display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: 'var(--mantine-color-dark-7)' }, body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-2 py-2">
            <button type="button" onClick={() => setOpen(false)} data-pad-back className="flex h-10 items-center gap-1 rounded-md px-2 text-[14px] text-fg-secondary hover:bg-bg-elev" aria-label="Back">
              <IconChevronLeft size={18} /> Back
            </button>
            <Text size="sm" fw={600} className="min-w-0 flex-1 truncate">{label}</Text>
            <Text size="sm" c="dimmed" className="truncate">{value}</Text>
          </div>
          <div className="scroll-y min-h-0 flex-1" style={{ touchAction: 'pan-y' }}>{open && body}</div>
        </Modal>
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Chip label={label} value={value} changed={changed} icon={icon} warn={warn} />
      </Popover.Trigger>
      {/* Under the modals its fields open (model pickers, the image browser), above every panel. */}
      <Popover.Content side="right" align="start" sideOffset={8} collisionPadding={12} zIndex={POPOVER_UNDER_MODALS_Z}
        className="scroll-y max-h-[min(80vh,calc(100dvh-24px))] rounded-xl border border-border-default bg-bg-elev shadow-2xl"
        style={{ width, touchAction: 'pan-y' }}>
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
          <Text size="sm" fw={600}>{label}</Text>
          <Text size="xs" c="dimmed" className="truncate">{value}</Text>
        </div>
        {open && body}
      </Popover.Content>
    </Popover.Root>
  );
}

/** A titled row of chips. */
export function ChipRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" className="tracking-wide">{title}</Text>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
