/**
 * The run bar: one big Generate that turns into Stop while a job runs, with the progress as a thin
 * bar along its bottom and a status line under it. Optional second action (the seed dice).
 */
import type { ReactNode } from 'react';
import { ActionIcon, Button, Loader, Tooltip } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { cn } from '@/lib/cn';

export function RunBar({ label = 'Generate', busyLabel, busy, progress, statusLine, onRun, onStop, disabled, disabledReason, secondary, size = 'md' }: {
  label?: string;
  /** Shown on the button while running; defaults to the status line or "Working…". */
  busyLabel?: string | null;
  busy: boolean;
  /** 0..1, or null when nothing is sampling yet. */
  progress?: number | null;
  statusLine?: ReactNode;
  onRun: () => void;
  onStop?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  secondary?: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean };
  size?: 'md' | 'lg';
}) {
  const pct = progress != null ? Math.round(progress * 100) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Tooltip label={disabledReason} disabled={!disabled || !disabledReason} withArrow>
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-md">
            <Button
              aria-label={busy ? 'Stop' : label}
              onClick={busy ? onStop : onRun}
              disabled={busy ? !onStop : disabled}
              fullWidth
              size={size}
              color={busy ? 'red' : undefined}
              variant={busy ? 'light' : 'filled'}
              leftSection={busy ? (onStop ? <IconPlayerStop size="1rem" /> : <Loader size="xs" />) : <IconPlayerPlay size="1rem" />}
              styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              className={cn(!busy && 'btn-glow')}
            >
              {busy ? `${busyLabel ?? 'Working…'}${pct != null ? ` · ${pct}%` : ''}` : label}
            </Button>
            {busy && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                {pct != null
                  ? <div className="h-full bg-[var(--mantine-color-red-5)] transition-[width] duration-150" style={{ width: `${Math.max(2, pct)}%` }} />
                  : <div className="animate-view-loading h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--mantine-color-red-5)] to-transparent" />}
              </div>
            )}
          </div>
        </Tooltip>
        {secondary && !busy && (
          <Tooltip label={secondary.label} withArrow>
            <ActionIcon variant="filled" size={size === 'lg' ? 50 : 36} onClick={secondary.onClick} disabled={disabled || secondary.disabled} aria-label={secondary.label} className="shrink-0">
              {secondary.icon}
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      {statusLine && <div className="truncate text-center text-[11px] tabular-nums text-fg-muted" aria-live="polite">{statusLine}</div>}
    </div>
  );
}
