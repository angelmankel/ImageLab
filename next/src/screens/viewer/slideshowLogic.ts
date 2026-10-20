/**
 * Item 30: the slideshow's transitions, pure (tested in tests/viewer.test.cjs). Only auto-play
 * animates (item 3: open, close and a manual seek are cuts; a phone swipe keeps its own motion).
 * Each transition is a pair of Web Animations keyframe lists — the incoming picture and the
 * outgoing one — plus a duration and an easing. Ken Burns also drifts the shown picture slowly
 * for the whole time it is on screen (`kenBurnsFrames`). Reduced motion: a short dissolve.
 */

export type ShowTransition = 'dissolve' | 'slide' | 'kenburns' | 'zoom' | 'blur' | 'cut';

export const SHOW_TRANSITIONS: ReadonlyArray<{ id: ShowTransition; label: string }> = [
  { id: 'dissolve', label: 'Dissolve' },
  { id: 'slide', label: 'Slide' },
  { id: 'kenburns', label: 'Ken Burns' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'blur', label: 'Blur' },
  { id: 'cut', label: 'Cut' },
];

export const SHOW_SPEEDS: readonly number[] = [2000, 3000, 4000, 6000, 10000];

export const isShowTransition = (v: unknown): v is ShowTransition => SHOW_TRANSITIONS.some((t) => t.id === v);

type Frames = Keyframe[];
export interface TransitionSpec { incoming: Frames; outgoing: Frames; ms: number; easing: string }

const SMOOTH = 'cubic-bezier(.45, 0, .2, 1)';

/** The keyframes for one change. `dir` = 1 forward (the usual), -1 back. */
export function transitionFrames(kind: ShowTransition, dir: 1 | -1 = 1, reduced = false): TransitionSpec {
  if (reduced) return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 0 }], ms: 200, easing: 'linear' };
  switch (kind) {
    case 'slide':
      return {
        incoming: [{ transform: `translateX(${dir * 100}%) scale(.96)`, opacity: 0.6 }, { transform: 'translateX(0) scale(1)', opacity: 1 }],
        outgoing: [{ transform: 'translateX(0) scale(1)', opacity: 1 }, { transform: `translateX(${-dir * 35}%) scale(.92)`, opacity: 0 }],
        ms: 900, easing: 'cubic-bezier(.7, 0, .2, 1)',
      };
    case 'zoom':
      return {
        incoming: [{ transform: 'scale(1.12)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        outgoing: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }],
        ms: 1000, easing: SMOOTH,
      };
    case 'blur':
      return {
        incoming: [{ filter: 'blur(28px)', opacity: 0, transform: 'scale(1.03)' }, { filter: 'blur(0px)', opacity: 1, transform: 'scale(1)' }],
        outgoing: [{ filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(28px)', opacity: 0 }],
        ms: 1100, easing: SMOOTH,
      };
    case 'kenburns':
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 0 }], ms: 1400, easing: 'ease-in-out' };
    case 'cut':
      return { incoming: [], outgoing: [], ms: 0, easing: 'linear' };
    default:
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 0 }], ms: 1000, easing: 'ease-in-out' };
  }
}

/**
 * Ken Burns drift for the picture at position `i`: a slow push in (or out, every third) towards
 * one of four corners, picked by `i` so neighbours never drift the same way.
 */
export function kenBurnsFrames(i: number): Frames {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  const [cx, cy] = corners[((i % 4) + 4) % 4];
  const out = ((i % 3) + 3) % 3 === 2;
  const a = { transform: 'scale(1.0) translate(0%, 0%)' };
  const b = { transform: `scale(1.14) translate(${cx * 3}%, ${cy * 3}%)` };
  return out ? [b, a] : [a, b];
}

/** The next index of an auto-play (wraps). */
export const nextShowIndex = (index: number, len: number): number => (len < 1 ? 0 : (index + 1) % len);
