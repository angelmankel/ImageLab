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

/** What a badge's details say (the desktop popover, the phone's step sheet): why it cannot run, or what changed + Re-run / Revert. */
export function StepBadgeDetails({ step, problem, fresh, close, large = false }: { step: Step; problem: string | null; fresh: StepFresh | undefined; close: () => void; large?: boolean }) {
  if (problem) {
    return (
      <>
        <div className="il-eyebrow" style={{ marginBottom: 6, color: 'var(--il-err)' }}>Can't run</div>
        <div style={{ fontSize: large ? 13 : 12, fontWeight: 600, color: 'var(--il-fg2)', lineHeight: 1.45 }}>{problem}</div>
      </>
    );
  }
  if (fresh?.state !== 'stale') return null;
  const blocked = revertBlocked(step.id);
  const size = large ? 'lg' : 'sm';
  return (
    <>
      <div className="il-eyebrow" style={{ marginBottom: 6, color: 'var(--il-warn)' }}>{fresh.reason === 'above' ? 'Out of date' : 'Changed since last run'}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {fresh.changes.map((c) => (
          <li key={c} style={{ fontSize: large ? 13 : 12, fontWeight: 600, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{c}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: large ? 8 : 6, marginTop: large ? 14 : 10, flexWrap: large ? 'nowrap' : 'wrap' }}>
        <Button size={size} tone="primary" grow={large} icon={<IconPlayerPlay size={13} />} onClick={() => { close(); void runStepNow(step); }}>Re-run</Button>
        <Button size={size} tone="card" grow={large} icon={<IconArrowBackUp size={13} />} disabled={!!blocked} tooltip={blocked ?? undefined}
          onClick={() => { if (revertStep(step.id)) close(); }}>Revert to last run</Button>
      </div>
    </>
  );
}

/** The phone steps strip's badge: the same dot, a 44 px hit area, a tap calls `onTap` (the step sheet) instead of a popover. */
function TapBadge({ tip, dot, onTap, at }: { tip: string; dot: React.ReactNode; onTap: () => void; at: React.CSSProperties }) {
  return (
    <button type="button" aria-label={tip} aria-haspopup="dialog" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onTap(); }}
      style={{ position: 'absolute', width: 44, height: 44, padding: 0, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 2, ...at }}>
      {dot}
    </button>
  );
}

export function StepBadge({ step, problem, fresh, onTap, small = false }: {
  step: Step; problem: string | null; fresh: StepFresh | undefined;
  /** Phone: a tap opens the step sheet (no popover, no hover). */
  onTap?: () => void;
  /** A smaller dot (the phone strip's 32 px circles). */
  small?: boolean;
}) {
  const flash = useSkipFlash((s) => s.stepId === step.id);
  const d = small ? 14 : 16;
  const dot = (bg: string, icon: React.ReactNode) => <span style={{ ...DOT, width: d, height: d, background: bg }}>{icon}</span>;
  const tapAt: React.CSSProperties = { right: -(25 - d / 2), bottom: -(25 - d / 2) };
  if (problem) {
    const tip = "Can't run";
    const d1 = dot('var(--il-err)', <IconExclamationMark size={small ? 10 : 11} stroke={3.5} />);
    if (onTap) return <TapBadge tip={tip} dot={d1} onTap={onTap} at={tapAt} />;
    return (
      <BadgePopover tip={tip} dot={d1}>
        {(close) => <StepBadgeDetails step={step} problem={problem} fresh={fresh} close={close} />}
      </BadgePopover>
    );
  }
  if (fresh?.state === 'stale') {
    const tip = 'Out of date';
    const d1 = dot('var(--il-warn)', <IconRefresh size={small ? 9 : 10} stroke={3.2} />);
    if (onTap) return <TapBadge tip={tip} dot={d1} onTap={onTap} at={tapAt} />;
    return (
      <BadgePopover tip={tip} dot={d1}>
        {(close) => <StepBadgeDetails step={step} problem={problem} fresh={fresh} close={close} />}
      </BadgePopover>
    );
  }
  if (fresh?.state === 'fresh') {
    return (
      <span aria-hidden style={{
        ...AT, ...DOT, width: d, height: d, background: 'var(--il-ok)', pointerEvents: 'none',
        transform: flash ? 'scale(calc(1 + .35 * var(--il-motion)))' : undefined, transition: 'transform calc(.18s * var(--il-motion)) ease',
        boxShadow: flash ? '0 0 0 2px var(--il-bg), 0 0 0 5px color-mix(in srgb, var(--il-ok) 35%, transparent)' : DOT.boxShadow,
      }}><IconCheck size={small ? 9 : 10} stroke={3.5} /></span>
    );
  }
  return null;
}
