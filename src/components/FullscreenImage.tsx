import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@mantine/hooks';
import {
  ActionIcon, Badge, CloseButton, Group, Popover, Stack, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconCheck, IconChevronLeft, IconChevronRight, IconInfoCircle, IconPlayerPause, IconPlayerPlay,
  IconSettings, IconX,
} from '@tabler/icons-react';
import { POPOVER_Z } from '@/components/ui/popover';
import { usePager } from '@/hooks/usePager';
import { usePanZoom, type DragPhase } from '@/hooks/usePanZoom';
import { usePreloadAround } from '@/hooks/usePreload';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { createVelocityTracker } from '@/lib/momentum';
import { SLIDE_GAP, closeCommits, closeProgress, closeScale, lockAxis, rubberBand } from '@/lib/pager';
import {
  loadSlideshowTransition,
  saveSlideshowTransition,
  type SlideshowTransition,
} from '@/lib/storage';
import { cn } from '@/lib/cn';
import { playOrMute, videoHasAudio } from '@/lib/videoAudio';
import { CLOSE_MS, EASE_OUT, animateClose, animateOpen, reducedMotion, registerViewer } from './viewerTransition';

/**
 * Generic, reusable fullscreen image viewer.
 *
 * Owns the chrome (close, prev/next, page counter, slideshow toggle, info panel) plus the gestures
 * and keyboard navigation (←/→ for nav, S for slideshow, Esc for close).
 *
 * The gesture model, as a photo app's: at 1× a sideways drag moves the picture 1:1 with the next
 * or previous one sliding in beside it (`hooks/usePager`), and the release pages on distance or on
 * a flick, else springs back; the ends rubber-band. A downward pull shrinks the picture under the
 * finger and fades the backdrop, and past a fifth of the height (or a flick) closes it, shrinking
 * back into its thumbnail; let go early and it springs back. Pinch or double-tap zooms; zoomed, a
 * drag pans and a flick throws. Open and close are a shared-element transition from whatever on
 * the page shows the same result (`data-viewer-origin`), or a fade when nothing does. Arrow keys,
 * the buttons and the controller run the same animations. `prefers-reduced-motion` makes every
 * one of them a short fade.
 *
 * The contents of the info panel are caller-provided — the history viewer renders an entry's
 * metadata; the model-metadata modal can pass `null`. Slideshow play state can be externally
 * controlled (pass `playing` + `onPlayingChange`) for cross-component persistence, or left internal.
 */

/** Video by file name (CivitAI galleries mix in .mp4 clips; ComfyUI's /view?filename=x.mp4&… too);
 *  shown in a <video>, not an <img>. */
const isVideoUrl = (u: string) => /\.(mp4|webm|mov)(\?|&|$)/i.test(u);

export type FullscreenItem = {
  /** Stable identity for React key + the pan/zoom reset trigger. */
  key: string;
  /** Image URL to display. */
  url: string;
};

type Props = {
  items: FullscreenItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Optional content for the side info panel. Hides the info button if omitted. */
  infoSlot?: ReactNode;
  /** Initial open state for the info panel. */
  initialInfoOpen?: boolean;
  /** Controlled play state; falls back to internal state if undefined. */
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Milliseconds per slideshow step. */
  slideshowMs?: number;
  /** Optional caption rendered with the page counter. */
  pageCaption?: string;
  /**
   * A running job's latest preview frame. When set it is shown in place of the current item and
   * marked LIVE; each new frame swaps in without resetting pan or zoom.
   */
  liveUrl?: string | null;
  /** Extra controls at the start of the top-right cluster. */
  toolbarExtra?: ReactNode;
};

const DEFAULT_SLIDESHOW_MS = 3000;

/**
 * Every image — small previews and live frames included — is scaled to the largest size that fits
 * the whole screen, so a tall image always fills its full height. The buttons and badges float
 * over it; they never take space from it.
 */
const IMAGE_BOX = 'block h-[100dvh] w-screen select-none object-contain';

const SIDES = [-1, 0, 1] as const;

export function FullscreenImage({
  items,
  index,
  onIndexChange,
  onClose,
  infoSlot,
  initialInfoOpen = false,
  playing: playingProp,
  onPlayingChange,
  slideshowMs = DEFAULT_SLIDESHOW_MS,
  pageCaption,
  liveUrl,
  toolbarExtra,
}: Props) {
  const item = items[index];
  const live = !!liveUrl;
  const url = liveUrl || (item?.url ?? '');

  // Controlled-or-uncontrolled playing state.
  const [playingState, setPlayingState] = useState(playingProp ?? false);
  const playing = playingProp ?? playingState;
  const setPlaying = (next: boolean | ((p: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(playing) : next;
    if (onPlayingChange) onPlayingChange(resolved);
    else setPlayingState(resolved);
  };

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(initialInfoOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  /** The current slide (grows from / shrinks to the thumbnail) and the pull-down wrapper inside it. */
  const slideRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const closing = useRef(false);

  // Slideshow transition (persisted). The chosen effect only applies when `playing === true`;
  // manual prev/next slides on the pager instead.
  const [transition, setTransitionState] = useState<SlideshowTransition>(() => loadSlideshowTransition());
  const setTransition = (t: SlideshowTransition) => {
    saveSlideshowTransition(t);
    setTransitionState(t);
  };

  // Previous-URL ref drives the dual-image transition stack. On every URL change while the
  // slideshow is playing, we capture the just-shown URL and bump `animKey` so both layers remount
  // and run their enter/exit animations.
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const lastUrlRef = useRef<string>(url);
  useEffect(() => {
    if (lastUrlRef.current === url) return;
    if (playing && transition !== 'none') {
      setPrevUrl(lastUrlRef.current);
      setAnimKey((k) => k + 1);
    } else {
      setPrevUrl(null);
    }
    lastUrlRef.current = url;
  }, [url, playing, transition]);

  const len = items.length;
  // Phones: prev/next sit low where a thumb reaches.
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const canPage = len > 1 && !live;

  const keys = items.map(i => i.key);
  const pager = usePager({ keys, index, onIndexChange, enabled: canPage, animate: !playing });
  usePreloadAround(items.map(i => i.url), index);

  // Buttons and keys wrap around; the slide always goes the way that was asked.
  const prev = () => { if (canPage) pager.goTo(index > 0 ? index - 1 : len - 1, -1); };
  const next = () => { if (canPage) pager.goTo(index < len - 1 ? index + 1 : 0, 1); };

  /** Animated close: shrink into the thumbnail (or fade), then tell the owner. Idempotent. */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const root = containerRef.current;
    if (root) root.style.pointerEvents = 'none';
    const slide = slideRef.current;
    const chrome = [topBarRef.current, navRef.current].filter((c): c is HTMLDivElement => !!c);
    const pull = pullRef.current;
    const fromBackdrop = backdropRef.current ? Number(getComputedStyle(backdropRef.current).opacity) || 1 : 1;
    const done = () => onCloseRef.current();
    if (!slide || !item || live) {
      // Nothing to shrink (a live frame, or no item): a quick fade.
      if (backdropRef.current) backdropRef.current.animate([{ opacity: fromBackdrop }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).finished.then(done, done);
      else done();
      return;
    }
    if (pull && pull.style.transform) {
      pull.animate([{ transform: pull.style.transform }, { transform: 'none' }], { duration: reducedMotion() ? 100 : CLOSE_MS, easing: EASE_OUT, fill: 'forwards' });
    }
    animateClose(slide, backdropRef.current, chrome, item.key, naturalRef.current, 'none', fromBackdrop).then(done, done);
  }, [item, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;

  // Open: grow out of whatever shows this result on the page, with the chrome fading in after.
  useLayoutEffect(() => {
    const slide = slideRef.current;
    const chrome = [topBarRef.current, navRef.current].filter((c): c is HTMLDivElement => !!c);
    if (!slide || !item || live) {
      backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      return;
    }
    void animateOpen(slide, backdropRef.current, chrome, item.key, null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The controller (and anything else) drives the same animations.
  const stepRef = useRef<(dir: 1 | -1) => boolean>(() => false);
  stepRef.current = (dir) => { if (!canPage) return false; if (dir > 0) next(); else prev(); return true; };
  useEffect(() => registerViewer({ step: (dir) => stepRef.current(dir), close }), [close]);

  // ── One-finger drags at 1×: page sideways, pull down to close ─────────────
  const gesture = useRef<{ axis: 'x' | 'y' | 'none' | null; vy: ReturnType<typeof createVelocityTracker> }>({ axis: null, vy: createVelocityTracker() });

  const setPull = (dx: number, dy: number) => {
    const pull = pullRef.current;
    const h = window.innerHeight;
    const y = dy >= 0 ? dy : rubberBand(dy, h / 2);
    const p = closeProgress(dy, h);
    if (pull) {
      pull.style.willChange = 'transform';
      pull.style.transform = `translate(${dx * 0.3}px, ${y}px) scale(${closeScale(p)})`;
    }
    if (backdropRef.current) backdropRef.current.style.opacity = String(1 - 0.9 * p);
    for (const c of [topBarRef.current, navRef.current]) if (c) c.style.opacity = String(1 - p);
  };
  const springPullBack = () => {
    const pull = pullRef.current;
    const ms = reducedMotion() ? 100 : 300;
    if (pull && pull.style.transform) {
      const from = pull.style.transform;
      pull.style.transform = '';
      pull.style.willChange = '';
      pull.animate([{ transform: from }, { transform: 'none' }], { duration: ms, easing: EASE_OUT });
    }
    const back = (el: HTMLElement | null) => {
      if (!el) return;
      const from = el.style.opacity;
      el.style.opacity = '';
      if (from) el.animate([{ opacity: from }, { opacity: 1 }], { duration: ms, easing: 'ease-out' });
    };
    back(backdropRef.current); back(topBarRef.current); back(navRef.current);
  };

  const onDrag = (phase: DragPhase, dx: number, dy: number) => {
    const g = gesture.current;
    if (phase === 'start') { g.axis = null; g.vy.reset(0, dy); return; }
    if (phase === 'move') {
      if (!g.axis) {
        const axis = lockAxis(dx, dy);
        if (!axis) return;
        if (axis === 'x') { if (canPage) { g.axis = 'x'; pager.drag.begin(); } else g.axis = 'none'; }
        else g.axis = live ? 'none' : 'y';
      }
      if (g.axis === 'x') pager.drag.update(dx);
      else if (g.axis === 'y') { setPull(dx, dy); g.vy.sample(0, dy); }
      return;
    }
    // end or cancel
    if (g.axis === 'x') pager.drag.finish({ cancel: phase === 'cancel' });
    else if (g.axis === 'y') {
      const vy = g.vy.release().y;
      if (phase === 'end' && closeCommits(dy, vy, window.innerHeight)) close();
      else springPullBack();
    }
    g.axis = null;
  };

  const { zoom, offset, reframing, handlers } = usePanZoom(containerRef, {
    resetKey: item?.key ?? index,
    onTap: close,
    onDrag,
  });

  useEffect(() => { setSize(null); }, [item?.key, index]);

  // Slideshow auto-advance. The `index` dependency means a manual nav resets
  // the timer naturally — the interval is torn down + recreated.
  useEffect(() => {
    // A live frame is on screen: the slideshow waits until the job finishes.
    if (!playing || len < 2 || live) return;
    const t = setInterval(() => onIndexChange((index + 1) % len), slideshowMs);
    return () => clearInterval(t);
  }, [playing, index, len, onIndexChange, slideshowMs, live]);

  // Top-overlay priority — when the fullscreen viewer is open, its arrows
  // and Esc take precedence over the history panel / metadata gallery behind.
  useShortcut('Escape', () => close(), { priority: ShortcutPriority.TopOverlay });
  useShortcut('ArrowLeft', () => prev(), { priority: ShortcutPriority.TopOverlay });
  useShortcut('ArrowRight', () => next(), { priority: ShortcutPriority.TopOverlay });
  useShortcut(['s', 'S'], () => setPlaying(p => !p), { priority: ShortcutPriority.TopOverlay });

  if (!item && !live) return null;

  // Chrome buttons are v1's viewer controls: dark filled ActionIcons at 0.8 opacity. Each stops
  // its click so the container's tap-to-close does not fire underneath it.
  const chrome = { variant: 'filled', color: 'dark', size: 'lg', style: { opacity: 0.8 } } as const;

  /** The item drawn on a side: the one leaving (ghost) while a slide runs, else the neighbour. */
  const slideItem = (side: -1 | 0 | 1): FullscreenItem | undefined => {
    if (side === 0) return item;
    if (live) return undefined;
    if (pager.ghost?.side === side) return items.find(i => i.key === pager.ghost!.key);
    return items[index + side];
  };

  const panStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    transition: reframing ? 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
  };

  return createPortal(
    <div
      ref={containerRef}
      // Above Mantine modals (200) so it can open from the model-metadata modal, below popovers
      // (300) so the transition picker and tooltips still show over it.
      className="fixed inset-0 z-[250] overflow-hidden"
      // Page-level swipe gestures (Studio's pane swipe, drawer edge-swipe) leave the viewer's
      // own swipes and pinches alone; the controller finds it by these too.
      data-no-swipe
      data-pad-layer="viewer"
      style={{ touchAction: 'none' }}
      onWheel={handlers.onWheel}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      onClick={handlers.onClick}
    >
      {/* The backdrop fades on its own: with the pull-down, and on open and close. */}
      <div ref={backdropRef} className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }} />

      {/* The slide track: previous, current and next side by side, moved as one by the finger or
          the spring (`usePager` writes its transform). Only the current slide carries the user's
          pan/zoom on the inner image; the pull-down wrapper and the open/close transform sit on
          the slide around it, so the three compose. */}
      <div ref={pager.trackRef} className="pointer-events-none absolute inset-0">
        {SIDES.map(side => {
          const it = slideItem(side);
          if (!it && !(side === 0 && live)) return null;
          const u = side === 0 ? url : it!.url;
          const k = side === 0 ? (live ? 'live' : it!.key) : it!.key;
          return (
            <div
              key={`${side}:${k}`}
              ref={side === 0 ? slideRef : undefined}
              className={cn('absolute inset-0 flex items-center justify-center', side === 0 && prevUrl && transitionClass(transition, 'in'))}
              style={side ? { transform: `translateX(calc(${side} * (100% + ${SLIDE_GAP}px)))` } : undefined}
            >
              {side === 0 ? (
                <div ref={pullRef} className="h-full w-full">
                  <KenBurnsWrap active={playing && transition === 'ken-burns'} durationMs={slideshowMs} animKey={animKey}>
                    {isVideoUrl(u) ? (
                      <video
                        key={u} src={u} autoPlay muted={!videoHasAudio(u)} loop playsInline className={IMAGE_BOX} style={panStyle}
                        onLoadedMetadata={(e) => { const n = { w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight }; naturalRef.current = n; setSize(n); playOrMute(e.currentTarget); }}
                      />
                    ) : (
                      <img
                        src={u} alt="" draggable={false} className={IMAGE_BOX} style={panStyle}
                        onLoad={(e) => { const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; naturalRef.current = n; setSize(n); }}
                      />
                    )}
                  </KenBurnsWrap>
                </div>
              ) : isVideoUrl(u) ? (
                <video src={u} muted playsInline preload="metadata" className={IMAGE_BOX} />
              ) : (
                <img src={u} alt="" draggable={false} decoding="async" className={IMAGE_BOX} />
              )}
            </div>
          );
        })}
      </div>

      {/* The slideshow's outgoing layer runs its exit animation over the track. */}
      {prevUrl && (
        <div key={`out-${animKey}`} className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', transitionClass(transition, 'out'))}>
          {isVideoUrl(prevUrl) ? (
            <video src={prevUrl} muted playsInline className={IMAGE_BOX} />
          ) : (
            <img src={prevUrl} alt="" draggable={false} className={IMAGE_BOX} />
          )}
        </div>
      )}

      {/* Prev / next — hidden while the slideshow plays, as in v1. */}
      {canPage && !playing && (
        <div ref={navRef} className="pointer-events-none absolute inset-0 z-10">
          <ActionIcon
            {...chrome}
            size={narrow ? 56 : 'xl'}
            radius={narrow ? 'xl' : undefined}
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className={cn('pointer-events-auto !absolute left-4', narrow ? '' : 'top-1/2 -translate-y-1/2')}
            style={{ ...chrome.style, ...(narrow ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' } : null) }}
          >
            <IconChevronLeft size="1.5rem" />
          </ActionIcon>
          <ActionIcon
            {...chrome}
            size={narrow ? 56 : 'xl'}
            radius={narrow ? 'xl' : undefined}
            aria-label="Next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className={cn('pointer-events-auto !absolute', narrow ? 'right-4' : 'top-1/2 -translate-y-1/2', !narrow && (infoSlot && infoOpen ? 'right-[356px]' : 'right-4'))}
            style={{ ...chrome.style, ...(narrow ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' } : null) }}
          >
            <IconChevronRight size="1.5rem" />
          </ActionIcon>
        </div>
      )}

      {infoSlot && (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            touchAction: 'pan-y',
            backgroundColor: 'var(--mantine-color-dark-7)',
            borderLeft: '1px solid var(--mantine-color-dark-4)',
            // On a phone the panel spans under the top bar, so its header starts below it.
            paddingTop: narrow ? 'calc(env(safe-area-inset-top, 0px) + 62px)' : undefined,
          }}
          className={`absolute right-0 top-0 z-10 flex h-full w-[340px] max-w-[85vw] flex-col transition-transform duration-200 ${
            infoOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
          }`}
        >
          <Group justify="space-between" px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
            <Text size="sm" fw={600}>Image info</Text>
            <CloseButton
              size="sm"
              aria-label="Hide image info"
              onClick={(e) => { e.stopPropagation(); setInfoOpen(false); }}
            />
          </Group>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {infoSlot}
          </div>
        </div>
      )}

      {/* Top bar: one row, badges left and controls right, so the two can never overlap — the
          badges wrap onto a second line first. Padded below the notch / status bar. */}
      <div
        ref={topBarRef}
        className="pointer-events-none !absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 pl-4 transition-[padding] duration-200"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingRight: infoSlot && infoOpen && !narrow ? 356 : 16,
        }}
      >
        {/* On a phone the open info panel covers this side, so the badges step aside. */}
        <Group gap={6} className="min-w-0 flex-1" style={narrow && infoSlot && infoOpen ? { visibility: 'hidden' } : undefined}>
          {live ? (
            <Badge variant="filled" color="red" size="lg" radius="sm" leftSection={<span className="block h-2 w-2 animate-pulse rounded-full bg-white" />}>
              Live
            </Badge>
          ) : len > 0 && (
            <Badge variant="filled" color="dark" size="lg" radius="sm" className="font-mono" style={{ opacity: 0.85 }}>
              {index + 1} / {len}
            </Badge>
          )}
          {size && (
            <Badge variant="filled" color="dark" size="lg" radius="sm" className="font-mono" style={{ opacity: 0.85 }}>
              {size.w} × {size.h}
            </Badge>
          )}
          {pageCaption && (
            <Badge variant="filled" color="dark" size="lg" radius="sm" tt="none" style={{ opacity: 0.85 }}>
              {pageCaption}
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap" className="pointer-events-auto shrink-0">
          {toolbarExtra}
          {len > 1 && !live && (
            <>
              <TransitionPicker value={transition} onChange={setTransition} />
              <Tooltip label={playing ? 'Pause slideshow (S)' : 'Play slideshow (S)'} withArrow>
                <ActionIcon
                  {...chrome}
                  color={playing ? undefined : 'dark'}
                  aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
                  aria-pressed={playing}
                  onClick={(e) => { e.stopPropagation(); setPlaying(p => !p); }}
                >
                  {playing ? <IconPlayerPause size="1.2rem" /> : <IconPlayerPlay size="1.2rem" />}
                </ActionIcon>
              </Tooltip>
            </>
          )}

          {infoSlot && (
            <Tooltip label={infoOpen ? 'Hide image info' : 'Show image info'} withArrow>
              <ActionIcon
                {...chrome}
                color={infoOpen ? undefined : 'dark'}
                aria-label={infoOpen ? 'Hide image info' : 'Show image info'}
                aria-expanded={infoOpen}
                onClick={(e) => { e.stopPropagation(); setInfoOpen(o => !o); }}
              >
                <IconInfoCircle size="1.2rem" />
              </ActionIcon>
            </Tooltip>
          )}

          <ActionIcon
            {...chrome}
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); close(); }}
          >
            <IconX size="1.2rem" />
          </ActionIcon>
        </Group>
      </div>

      {playing && !live && (
        <Text size="xs" c="dimmed" className="pointer-events-none !absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          Slideshow playing — press S to pause
        </Text>
      )}
    </div>,
    document.body,
  );
}

// ── Slideshow transition helpers ──────────────────────────────────────────

/** Map a transition kind + direction to the CSS class name in index.css. */
function transitionClass(t: SlideshowTransition, dir: 'in' | 'out'): string {
  if (t === 'none') return '';
  if (t === 'fade')      return dir === 'in' ? 'ss-anim-fade-in'  : 'ss-anim-fade-out';
  if (t === 'slide')     return dir === 'in' ? 'ss-anim-slide-in' : 'ss-anim-slide-out';
  if (t === 'zoom')      return dir === 'in' ? 'ss-anim-zoom-in'  : 'ss-anim-zoom-out';
  if (t === 'ken-burns') return dir === 'in' ? 'ss-anim-fade-in'  : 'ss-anim-fade-out';
  return '';
}

/**
 * Wraps the image with a Ken-Burns continuous zoom while the slide is on
 * screen. Inert when `active` is false — just renders its children straight
 * through, so manual nav / non-Ken-Burns transitions stay untouched.
 *
 * The animation duration is tied to the slideshow step so the scale finishes
 * right as the next slide begins. `animKey` remounts the wrapper between
 * slides so the zoom restarts cleanly from scale(1).
 */
function KenBurnsWrap({
  active, durationMs, animKey, children,
}: { active: boolean; durationMs: number; animKey: number; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <div
      key={`kb-${animKey}`}
      className="ss-ken-burns"
      style={{ animationDuration: `${durationMs}ms` }}
    >
      {children}
    </div>
  );
}

const TRANSITION_OPTIONS: { value: SlideshowTransition; label: string; hint: string }[] = [
  { value: 'none',      label: 'None',           hint: 'Instant cut' },
  { value: 'fade',      label: 'Crossfade',      hint: 'Smooth blend (default)' },
  { value: 'slide',     label: 'Slide',          hint: 'Push from the right' },
  { value: 'zoom',      label: 'Zoom blur',      hint: 'Scale + fade' },
  { value: 'ken-burns', label: 'Ken Burns',      hint: 'Slow continuous zoom' },
];

/** v1's slideshow settings: a gear ActionIcon opening the effect list. Lives in the top-right
 *  cluster next to the play control. */
function TransitionPicker({
  value, onChange,
}: { value: SlideshowTransition; onChange: (v: SlideshowTransition) => void }) {
  const active = TRANSITION_OPTIONS.find(o => o.value === value) ?? TRANSITION_OPTIONS[1];
  // Controlled, so the gear's own click handler (which must stop propagation) does the toggling.
  const [open, setOpen] = useState(false);
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" withArrow withinPortal zIndex={POPOVER_Z} shadow="md">
      <Popover.Target>
        <Tooltip label={`Slideshow transition: ${active.label}`} withArrow>
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            style={{ opacity: 0.8 }}
            aria-label={`Slideshow transition: ${active.label}`}
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          >
            <IconSettings size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      {/* The dropdown is portalled, but React still bubbles its events to the viewer's
          tap-to-close handler, so it stops them. */}
      <Popover.Dropdown onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <Stack gap="xs" miw={220}>
          <Text size="sm" fw={600}>Slideshow settings</Text>
          <Text size="xs" c="dimmed">Effect</Text>
          <Stack gap={2}>
            {TRANSITION_OPTIONS.map((o) => (
              <UnstyledButton
                key={o.value}
                onClick={() => onChange(o.value)}
                aria-pressed={o.value === value}
                className="rounded-sm px-2 py-1.5 hover:bg-[var(--mantine-color-dark-5)]"
                style={o.value === value ? { backgroundColor: 'var(--mantine-primary-color-light)' } : undefined}
              >
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center">
                    {o.value === value && <IconCheck size={12} />}
                  </span>
                  <div>
                    <Text size="xs" fw={500}>{o.label}</Text>
                    <Text size="xs" c="dimmed">{o.hint}</Text>
                  </div>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
