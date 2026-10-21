/**
 * Fix list 2 item 17: ONE badge at a step circle's bottom right that changes (Donny's option 1):
 *   red !   the step cannot run (list 1 #17; the circle also gets the red ring),
 *   amber ↻ it has an output, but it is out of date — hover: "Changed since last run: CFG 4.5 → 6",
 *   green ✓ its newest output matches the settings as they are now,
 *   none    no output yet.
 * A Generate that was skipped because the step is up to date pulses the ✓ for a moment.
 */
import { IconCheck, IconExclamationMark, IconRefresh } from '@tabler/icons-react';
import { Tip } from '~/ui/Tip';
import { useSkipFlash, type StepFresh } from '~/app/stepFingerprint';

const BOX: React.CSSProperties = {
  position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%', color: 'var(--il-bg)',
  display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--il-bg)', zIndex: 2,
};

export function StepBadge({ stepId, problem, fresh }: { stepId: string; problem: string | null; fresh: StepFresh | undefined }) {
  const flash = useSkipFlash((s) => s.stepId === stepId);
  if (problem) return <span aria-hidden style={{ ...BOX, background: 'var(--il-err)', pointerEvents: 'none' }}><IconExclamationMark size={11} stroke={3.5} /></span>;
  if (fresh?.state === 'stale') {
    const label = fresh.reason === 'above' ? fresh.changes[0] : `Changed since last run: ${fresh.changes.join(' · ')}`;
    return (
      <Tip label={`Out of date — ${label}`} position="right" multiline w={240}>
        <span role="img" aria-label={`Out of date: ${label}`} style={{ ...BOX, background: 'var(--il-warn)', cursor: 'help' }}>
          <IconRefresh size={10} stroke={3.2} />
        </span>
      </Tip>
    );
  }
  if (fresh?.state === 'fresh') {
    return (
      <span aria-hidden style={{
        ...BOX, background: 'var(--il-ok)', pointerEvents: 'none',
        transform: flash ? 'scale(calc(1 + .35 * var(--il-motion)))' : undefined, transition: 'transform calc(.18s * var(--il-motion)) ease',
        boxShadow: flash ? '0 0 0 2px var(--il-bg), 0 0 0 5px color-mix(in srgb, var(--il-ok) 35%, transparent)' : BOX.boxShadow,
      }}><IconCheck size={10} stroke={3.5} /></span>
    );
  }
  return null;
}
