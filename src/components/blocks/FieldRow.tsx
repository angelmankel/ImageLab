/** A label on the left, its control on the right, one touch-sized line. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function FieldRow({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-11 items-center gap-3', className)}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg-secondary">{label}</div>
        {hint && <div className="truncate text-[11px] text-fg-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
