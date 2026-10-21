/**
 * Fix list 2 item 16: the ring around a step circle in the rail — its job's progress.
 *   running   a thin green arc fills 0 → 100 % with the job's progress (sampler steps); no
 *             number yet (loading, uploading) → a short arc that turns,
 *   done      the ring closes full, holds a moment, then fades (the line to the next step lights
 *             up in the same green, `StepConnector`),
 *   queued    a faint dashed ring (a job of this step waits, or Generate all reaches it later),
 *   nothing   no ring. A step that cannot run keeps only its red ring (list 1 #17): no progress ring.
 * Green = the up-to-date colour (the ✓ badge, the lit line); the open step's circle is ember, so an
 * ember ring would vanish against it. Motion follows the theme setting (`--il-motion`).
 */
import { useEffect, useRef, useState } from 'react';

export type RingState = { kind: 'idle' } | { kind: 'queued' } | { kind: 'running'; progress: number | null };

/** Circle 46 px + a 3 px gap each side: the ring sits just outside the circle and its red error ring. */
const SIZE = 56;
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const SETTLE_MS = 900;

/** `ok`: the step's newest output is up to date — a finished run closes the ring only then (a failed one just fades). */
export function StepRing({ ring, ok }: { ring: RingState; ok: boolean }) {
  // Done = it was running and is not any more: close the ring, hold it, fade it.
  const wasRunning = useRef(false);
  const last = useRef(0);
  if (ring.kind === 'running' && ring.progress != null) last.current = ring.progress;
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (ring.kind === 'running') { wasRunning.current = true; setSettling(false); return; }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    if (ring.kind === 'queued') return;
    setSettling(true);
    const t = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(t);
  }, [ring.kind]);

  const show = ring.kind !== 'idle' || settling;
  // The result is credited a moment after the job leaves the queue: the ring closes as soon as it is.
  const progress = settling ? (ok ? 1 : last.current) : ring.kind === 'running' ? ring.progress : null;
  const spinning = ring.kind === 'running' && ring.progress == null;
  const off = (SIZE - 46) / 2;
  return (
    <svg aria-hidden width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{
        position: 'absolute', left: -off, top: -off, pointerEvents: 'none', zIndex: 1, overflow: 'visible',
        opacity: show ? 1 : 0, transition: `opacity calc(${settling ? 0.2 : 0.35}s * var(--il-motion)) ease`,
        transform: 'rotate(-90deg)',
      }}>
      {ring.kind === 'queued' && !settling ? (
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--il-muted)" strokeOpacity={0.55} strokeWidth={STROKE} strokeDasharray="3 4.2" strokeLinecap="round" />
      ) : (
        <>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--il-ok)" strokeOpacity={0.16} strokeWidth={STROKE} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--il-ok)" strokeWidth={STROKE} strokeLinecap="round"
            className={spinning ? 'il-ring-spin' : undefined}
            strokeDasharray={spinning ? `${C * 0.22} ${C}` : `${C} ${C}`}
            strokeDashoffset={spinning ? 0 : C * (1 - Math.max(0.02, Math.min(1, progress ?? 0)))}
            style={{ transition: spinning ? undefined : 'stroke-dashoffset calc(.3s * var(--il-motion)) ease' }} />
        </>
      )}
    </svg>
  );
}
