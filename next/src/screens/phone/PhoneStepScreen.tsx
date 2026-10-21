/**
 * The phone's step screen (rule 11): a sideways pager of the chain of steps. Each step has two
 * pages, Create and Output (the dock's tabs pick one; the choice holds across steps). Swipe the
 * page left / right = the next / previous step: the page follows the finger 1:1 with the
 * neighbour (a `StepPeek`) beside it, a release past a third of the width or a flick slides it
 * over (the thresholds are `@/lib/swipe`), the ends rubber-band. A touch on a slider, text box,
 * sideways scroller or the picture (`data-no-swipe`) is never a step swipe (`@/hooks/useSwipe`).
 * A tap on a step in the dock jumps there with a short slide.
 */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { useSteps } from '~/app/stepsStore';
import { CreatePage } from './CreatePage';
import { MoreSheet } from './MoreSheet';
import { OutputPage } from './OutputPage';
import { PhoneDock } from './PhoneDock';
import { StepPeek } from './StepPeek';
import { StepSheet } from './StepSheet';
import { usePhone } from './phoneStore';
import { PAGE_GAP, PAGE_SLIDE_MS, pageDragOffset, pageSettleOffset, stepForSwipe } from './phoneLogic';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function PhoneStepScreen() {
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const setActive = useSteps((s) => s.setActive);
  const page = usePhone((s) => s.page);
  const found = steps.findIndex((s) => s.id === activeId);
  const index = found < 0 ? 0 : found;
  const step = steps[index];
  const prev = steps[index - 1];
  const next = steps[index + 1];

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ index, steps });
  latest.current = { index, steps };
  /** A committed slide is running; drags wait for it. */
  const settling = useRef(false);
  /** How the next active-step change arrives: after a slide (reset the track) or a jump (slide in). */
  const arrival = useRef<{ kind: 'slid' } | { kind: 'jump'; from: 1 | -1 } | null>(null);

  const width = () => rootRef.current?.clientWidth || window.innerWidth;
  const write = (x: number, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${PAGE_SLIDE_MS}ms ${EASE}` : 'none';
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
  };

  const onMove = (dx: number) => {
    if (settling.current) return;
    if (dx === 0) { write(0, true); return; }
    const { index: i, steps: list } = latest.current;
    const has = stepForSwipe(i, dx > 0 ? 1 : -1, list.length) != null;
    write(pageDragOffset(dx, has, width()), false);
  };
  const commit = (fingerDir: 1 | -1) => {
    const { index: i, steps: list } = latest.current;
    const target = stepForSwipe(i, fingerDir, list.length);
    if (target == null || settling.current) return; // onMove(0) already springs it back
    settling.current = true;
    write(pageSettleOffset(fingerDir, width()), true);
    window.setTimeout(() => {
      arrival.current = { kind: 'slid' };
      settling.current = false;
      setActive(list[target].id);
    }, PAGE_SLIDE_MS);
  };

  useSwipe(rootRef, { dir: 1, enabled: true, onMove, onSwipe: () => commit(1) });
  useSwipe(rootRef, { dir: -1, enabled: true, onMove, onSwipe: () => commit(-1) });

  /** The dock's step pills: jump, with a short slide from the side it comes from. */
  const jump = useCallback((id: string) => {
    const { index: i, steps: list } = latest.current;
    const to = list.findIndex((s) => s.id === id);
    if (to < 0 || to === i || settling.current) return;
    arrival.current = { kind: 'jump', from: to > i ? 1 : -1 };
    setActive(id);
  }, [setActive]);

  // Before paint: the new step's real page takes the place of the peek in the same frame.
  useLayoutEffect(() => {
    const a = arrival.current;
    arrival.current = null;
    write(0, false);
    const el = trackRef.current;
    if (a?.kind === 'jump' && el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ transform: `translate3d(${a.from * 56}px, 0, 0)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: EASE });
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const side = (s: -1 | 1): React.CSSProperties => ({ position: 'absolute', inset: 0, transform: `translateX(calc(${s} * (100% + ${PAGE_GAP}px)))` });

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--il-bg)' }}>
      <div ref={rootRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'pan-y' }}>
        <div ref={trackRef} style={{ position: 'absolute', inset: 0 }}>
          {prev && <div style={side(-1)}><StepPeek step={prev} index={index - 1} page={page} /></div>}
          <div style={{ position: 'absolute', inset: 0 }}>
            <div style={{ position: 'absolute', inset: 0, display: page === 'create' ? 'block' : 'none' }}>
              <CreatePage key={step.id} step={step} />
            </div>
            <div style={{ position: 'absolute', inset: 0, display: page === 'output' ? 'block' : 'none' }}>
              <OutputPage key={step.id} step={step} index={index} />
            </div>
          </div>
          {next && <div style={side(1)}><StepPeek step={next} index={index + 1} page={page} /></div>}
        </div>
      </div>
      <PhoneDock onJump={jump} />
      <MoreSheet />
      <StepSheet />
    </div>
  );
}
