/**
 * Library (rule 12): React glue for grid video autoplay (only with Settings → Video previews = Autoplay; hover plays otherwise). `useGridAutoplay` (in LibraryGrid) makes
 * one VideoAutoplay, attaches it to the grid's scroll container and keeps cap (phone 3 / desktop 6)
 * and the allowed flag (reduced motion, Save-Data, `paused`) current; tiles reach it through
 * AutoplayContext with `useAutoplayVideo`. Without a provider a tile is just the first-frame still.
 */
import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useIsPhone } from '~/app/useIsPhone';
import { useVideoPreview } from '~/app/videoPreview';
import { useHoverPlay } from '~/ui/VideoThumb';
import { VideoAutoplay } from './videoAutoplay';
import { autoplayAllowed, playCap } from './videoAutoplayLogic';

export const AutoplayContext = createContext<VideoAutoplay | null>(null);

const REDUCED = '(prefers-reduced-motion: reduce)';

function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}

/** Nearest scrolling ancestor (the Library's .il-scroll); null = the viewport. */
function scrollParent(el: HTMLElement): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

export function useGridAutoplay(gridRef: RefObject<HTMLElement>, paused: boolean): VideoAutoplay {
  const [ctl] = useState(() => new VideoAutoplay());
  const isPhone = useIsPhone();
  const reducedMotion = useMediaQuery(REDUCED, typeof window !== 'undefined' ? window.matchMedia(REDUCED).matches : false) ?? false;
  // Settings → Video previews: only Autoplay plays on its own (On hover / Off: the tile's hover, or nothing).
  const autoplay = useVideoPreview((s) => s.mode) === 'autoplay';

  useEffect(() => {
    const el = gridRef.current;
    ctl.attach(el ? scrollParent(el) : null);
    return () => ctl.detach();
  }, [ctl, gridRef]);
  useEffect(() => ctl.setCap(playCap(isPhone)), [ctl, isPhone]);
  useEffect(() => ctl.setAllowed(autoplay && autoplayAllowed({ reducedMotion, saveData: saveData(), paused })), [ctl, autoplay, reducedMotion, paused]);
  return ctl;
}

/** A tile's <video> ref, registered with the grid's controller while mounted. */
export function useAutoplayVideo(url: string, active: boolean): RefObject<HTMLVideoElement> {
  const ref = useRef<HTMLVideoElement>(null);
  const ctl = useContext(AutoplayContext);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    if (ctl) return ctl.register(el, url);
    el.preload = 'metadata';
    el.src = `${url}#t=0.1`;
  }, [ctl, url, active]);
  // On hover (and Autoplay's fallback): the tile under the pointer plays.
  useHoverPlay(ref, ctl, undefined, active);
  return ref;
}
