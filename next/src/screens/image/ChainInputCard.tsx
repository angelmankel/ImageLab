/**
 * Kept for older callers: the step-to-step source card (My image · Last from N · Pick from N and
 * the chained picture). It is now `~/compose/StepImageInput`'s `StepSource` (fix list 41); new code
 * uses `StepImageInput` with the slot's `ImageDropZone` as `own`.
 */
import type { ReactNode } from 'react';
import type { Step } from '~/app/stepsStore';
import { StepSource } from '~/compose/StepImageInput';

export function ChainInputCard({ step, bare = false, children }: {
  step: Step;
  /** Unused (the chained picture is shown big now). */
  thumb?: number;
  /** Unused. */
  note?: string;
  /** No card of its own. */
  bare?: boolean;
  children?: ReactNode;
}) {
  const body = <StepSource step={step}>{children}</StepSource>;
  if (bare) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{body}</div>;
  return <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>{body}</div>;
}
