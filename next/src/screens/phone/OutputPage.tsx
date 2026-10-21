/**
 * The phone's Output page for one step (rules 11 + 15), top to bottom:
 *   "Output" · Step N · Live preview on / off · Fullscreen
 *   the step's stage (`PhoneStage`: the desktop stage's media for this step — picture, progress,
 *   the toolbar's actions, results, prompt line, Send to the next step — and its viewers)
 *   the Queue card (Stop / Cancel per job; the Generate badge scrolls here)
 */
import { useEffect, useRef } from 'react';
import { IconMaximize } from '@tabler/icons-react';
import { STEP_LABEL, type Step } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import { DOCK_SPACE } from './PhoneDock';
import { QueueCard } from './QueueCard';
import { LiveToggle } from './OutputActions';
import { PhoneStage, usePhoneStage } from './PhoneStage';
import { usePhone } from './phoneStore';

export function OutputPage({ step, index }: { step: Step; index: number }) {
  const stage = usePhoneStage(step);
  const queueAsk = usePhone((s) => s.queueAsk);
  const queueRef = useRef<HTMLDivElement>(null);
  const seenAsk = useRef(queueAsk);
  useEffect(() => {
    if (queueAsk === seenAsk.current) return;
    seenAsk.current = queueAsk;
    requestAnimationFrame(() => queueRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  }, [queueAsk]);
  const canFull = stage.media.items.length > 0 || !!stage.media.live;

  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: `calc(${DOCK_SPACE + 12}px + var(--il-safe-bottom))` }}>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: `calc(env(safe-area-inset-top, 0px)) ${T.pad.panel}px 0`, boxSizing: 'content-box' }}>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Output</span>
        <span style={{ height: 30, padding: '0 10px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-ember)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          Step {index + 1} · {STEP_LABEL[step.kind]}
        </span>
        <LiveToggle />
        <button type="button" aria-label="Fullscreen" disabled={!canFull} onClick={() => stage.open()}
          style={{ width: 40, height: 40, border: 0, borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', opacity: canFull ? 1 : 0.4, cursor: 'pointer' }}>
          <IconMaximize size={15} stroke={2.4} />
        </button>
      </div>
      <PhoneStage step={step} stage={stage} />
      <div style={{ padding: `${T.gap.md}px ${T.pad.panel}px 0` }}><QueueCard ref={queueRef} /></div>
    </div>
  );
}
