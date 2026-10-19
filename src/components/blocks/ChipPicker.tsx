/**
 * A sideways-scrolling row of chips: tap one to pick it. Selected chips are filled. The row never
 * wraps, so it takes one line wherever it sits; a trailing chip can open "more".
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Chip {
  id: string;
  label: ReactNode;
  selected?: boolean;
  /** A Mantine colour name; the accent when missing. */
  color?: string;
  icon?: ReactNode;
  title?: string;
  disabled?: boolean;
}

export function ChipPicker({ items, onPick, trailing, large, className }: {
  items: readonly Chip[];
  onPick: (id: string) => void;
  /** Chips after the list: "Suggest", "All…". */
  trailing?: ReactNode;
  /** Thumb-sized chips for the phone. */
  large?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('scroll-x-thin flex items-center gap-1.5 py-0.5', className)} style={{ touchAction: 'pan-x' }}>
      {items.map(c => <ChipButton key={c.id} chip={c} large={large} onClick={() => onPick(c.id)} />)}
      {trailing}
    </div>
  );
}

export function ChipButton({ chip, large, onClick }: { chip: Chip; large?: boolean; onClick: () => void }) {
  const color = chip.color;
  const on = !!chip.selected;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={chip.disabled}
      title={chip.title}
      aria-pressed={on}
      className={cn(
        'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border text-left font-medium outline-none transition-colors',
        'focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40',
        large ? 'h-9 px-3.5 text-[13px]' : 'h-7 px-2.5 text-[12px]',
        on ? 'border-transparent text-white' : 'border-border-default bg-bg-elev text-fg-secondary hover:border-border-strong',
      )}
      style={on ? { background: color ? `var(--mantine-color-${color}-7)` : 'var(--mantine-primary-color-filled)' }
        : color ? { borderColor: `color-mix(in srgb, var(--mantine-color-${color}-6) 55%, transparent)` } : undefined}
    >
      {chip.icon}
      <span className={cn('truncate', large ? 'max-w-[180px]' : 'max-w-[140px]')}>{chip.label}</span>
    </button>
  );
}
