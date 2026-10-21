/**
 * The line from a step down to the next one in the rail (fix list 2 items 16 + 17): it shows what
 * flows into the next step.
 *   lit (green, the ring colour)  an up-to-date output flows down — it fills top → bottom when the
 *                                 step above finishes (the fill respects the motion setting),
 *   amber, dashed                 the step above is out of date: the chain "broke" here,
 *   dim                           nothing flows (no output yet, or the next step does not follow it).
 */
import type { Freshness } from '~/app/fingerprintLogic';

export function StepConnector({ flows, state }: { flows: boolean; state: Freshness }) {
  const lit = flows && state === 'fresh';
  const stale = flows && state === 'stale';
  return (
    <span aria-hidden style={{
      position: 'relative', width: 2, flex: 1, minHeight: 0, margin: '4px 0', borderRadius: 1, overflow: 'hidden',
      background: stale ? 'repeating-linear-gradient(to bottom, var(--il-warn) 0 4px, transparent 4px 7px)' : 'var(--il-line-strong)',
    }}>
      <span style={{
        position: 'absolute', inset: 0, background: 'var(--il-ok)', transformOrigin: 'top',
        transform: lit ? 'scaleY(1)' : 'scaleY(0)', transition: 'transform calc(.45s * var(--il-motion)) ease-out',
      }} />
    </span>
  );
}
