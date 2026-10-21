/**
 * Fix list 2 item 17: ONE badge at a step circle's bottom right that changes (Donny's option 1):
 *   red !   the step cannot run (list 1 #17; the circle also gets the red ring),
 *   amber ↻ it has an output, but it is out of date,
 *   green ✓ its newest output matches the settings as they are now,
 *   none    no output yet.
 * Tooltips stay a few words (item 35). The details are a click (a tap on a phone) away: the ↻ and
 * the ! open a small popover — what changed since the last run (CFG 1 → 5 …) with Re-run and
 * Revert to last run, or why the step cannot run. A Generate skipped as up to date pulses the ✓.
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconArrowBackUp, IconCheck, IconExclamationMark, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { Tip } from '~/ui/Tip';
import { Button } from '~/ui/Button';
import { T } from '~/theme/tokens';
import { vw } from '~/theme/uiScale';
import { useSkipFlash, type StepFresh } from '~/app/stepFingerprint';
import type { Step } from '~/app/stepsStore';
import { runStepNow } from '../GenerateAll';
import { revertBlocked, revertStep } from '../stepRevert';

const DOT: React.CSSProperties = {
  width: 16, height: 16, borderRadius: '50%', color: 'var(--il-bg)',
  display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--il-bg)',
};
/** The dot's corner; a clickable badge gets a 30 px hit area around the same dot. */
const AT: React.CSSProperties = { position: 'absolute', right: -3, bottom: -3, zIndex: 2 };
const HIT: React.CSSProperties = { position: 'absolute', right: -10, bottom: -10, width: 30, height: 30, padding: 0, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 2 };

function BadgePopover({ tip, dot, children }: { tip: string; dot: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover opened={open} onChange={setOpen} position="right-start" shadow="lg" withinPortal zIndex={T.z.popover}>
      <Popover.Target>
        <span style={HIT}>
          <Tip label={tip} position="right" disabled={open}>
            <button type="button" aria-label={tip} aria-haspopup="dialog" aria-expanded={open}
              onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
              style={{ ...HIT, position: 'static' }}>
              {dot}
            </button>
          </Tip>
        </span>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.xl, padding: 12, width: 260, maxWidth: `calc(${vw(100)} - 24px)` }}>
        {children(() => setOpen(false))}
      </Popover.Dropdown>
    </Popover>
  );
}

export function StepBadge({ step, problem, fresh }: { step: Step; problem: string | null; fresh: StepFresh | undefined }) {
  const flash = useSkipFlash((s) => s.stepId === step.id);
  if (problem) {
    return (
      <BadgePopover tip="Can't run" dot={<span style={{ ...DOT, background: 'var(--il-err)' }}><IconExclamationMark size={11} stroke={3.5} /></span>}>
        {() => (
          <>
            <div className="il-eyebrow" style={{ marginBottom: 6, color: 'var(--il-err)' }}>Can't run</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-fg2)', lineHeight: 1.45 }}>{problem}</div>
          </>
        )}
      </BadgePopover>
    );
  }
  if (fresh?.state === 'stale') {
    return (
      <BadgePopover tip="Out of date" dot={<span style={{ ...DOT, background: 'var(--il-warn)' }}><IconRefresh size={10} stroke={3.2} /></span>}>
        {(close) => {
          const blocked = revertBlocked(step.id);
          return (
            <>
              <div className="il-eyebrow" style={{ marginBottom: 6, color: 'var(--il-warn)' }}>{fresh.reason === 'above' ? 'Out of date' : 'Changed since last run'}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {fresh.changes.map((c) => (
                  <li key={c} style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{c}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <Button size="sm" tone="primary" icon={<IconPlayerPlay size={13} />} onClick={() => { close(); void runStepNow(step); }}>Re-run</Button>
                <Button size="sm" tone="card" icon={<IconArrowBackUp size={13} />} disabled={!!blocked} tooltip={blocked ?? undefined}
                  onClick={() => { if (revertStep(step.id)) close(); }}>Revert to last run</Button>
              </div>
            </>
          );
        }}
      </BadgePopover>
    );
  }
  if (fresh?.state === 'fresh') {
    return (
      <span aria-hidden style={{
        ...AT, ...DOT, background: 'var(--il-ok)', pointerEvents: 'none',
        transform: flash ? 'scale(calc(1 + .35 * var(--il-motion)))' : undefined, transition: 'transform calc(.18s * var(--il-motion)) ease',
        boxShadow: flash ? '0 0 0 2px var(--il-bg), 0 0 0 5px color-mix(in srgb, var(--il-ok) 35%, transparent)' : DOT.boxShadow,
      }}><IconCheck size={10} stroke={3.5} /></span>
    );
  }
  return null;
}
