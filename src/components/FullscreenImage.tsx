import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { usePanZoom } from '@/hooks/usePanZoom';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import {
  loadSlideshowTransition,
  saveSlideshowTransition,
  type SlideshowTransition,
} from '@/lib/storage';
import { cn } from '@/lib/cn';

/**
 * Generic, reusable fullscreen image viewer.
 *
 * Owns the chrome (close, prev/next, page counter, slideshow toggle, info
 * panel) plus pan/pinch/wheel/momentum gestures and keyboard navigation
 * (←/→ for nav, S for slideshow, Esc for close). At normal zoom a sideways swipe pages and a
 * downward swipe closes; on phones prev/next sit near the bottom. The contents of the
 * info panel are caller-provided — the history viewer renders an entry's
 * metadata; the model-metadata modal can pass `null`.
 *
 * Slideshow play state can be externally controlled (pass `playing` +
 * `onPlayingChange`) for cross-component persistence, or left internal.
 */

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

  // Slideshow transition (persisted). The chosen effect only applies when
  // `playing === true` — manual prev/next stays instant so quick browsing
  // isn't blocked behind a 500 ms animation.
  const [transition, setTransitionState] = useState<SlideshowTransition>(() => loadSlideshowTransition());
  const setTransition = (t: SlideshowTransition) => {
    saveSlideshowTransition(t);
    setTransitionState(t);
  };

  // Previous-URL ref drives the dual-image transition stack. On every URL
  // change while the slideshow is playing, we capture the just-shown URL and
  // bump `animKey` so both layers remount and run their enter/exit
  // animations.
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
  const prev = () => onIndexChange((index - 1 + len) % len);
  const next = () => onIndexChange((index + 1) % len);

  // Phones: prev/next sit low where a thumb reaches, and a sideways swipe at normal zoom pages.
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const canPage = len > 1 && !live;

  const { zoom, offset, reframing, handlers } = usePanZoom(containerRef, {
    resetKey: item?.key ?? index,
    onTap: onClose,
    onSwipe: canPage ? (dir) => (dir < 0 ? prev() : next()) : undefined,
    onSwipeDown: onClose,
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
  useShortcut('Escape', () => onClose(), { priority: ShortcutPriority.TopOverlay });
  useShortcut('ArrowLeft', () => onIndexChange((index - 1 + len) % len), { priority: ShortcutPriority.TopOverlay });
  useShortcut('ArrowRight', () => onIndexChange((index + 1) % len), { priority: ShortcutPriority.TopOverlay });
  useShortcut(['s', 'S'], () => setPlaying(p => !p), { priority: ShortcutPriority.TopOverlay });

  if (!item && !live) return null;

  // Chrome buttons are v1's viewer controls: dark filled ActionIcons at 0.8 opacity. Each stops
  // its click so the container's tap-to-close does not fire underneath it.
  const chrome = { variant: 'filled', color: 'dark', size: 'lg', style: { opacity: 0.8 } } as const;

  return createPortal(
    <div
      ref={containerRef}
      // Above Mantine modals (200) so it can open from the model-metadata modal, below popovers
      // (300) so the transition picker and tooltips still show over it.
      className="fixed inset-0 z-[250] overflow-hidden"
      // Page-level swipe gestures (Studio's pane swipe, drawer edge-swipe) leave the viewer's
      // own swipes and pinches alone.
      data-no-swipe
      style={{ touchAction: 'none', backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
      onWheel={handlers.onWheel}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      onClick={handlers.onClick}
    >
      {/* Image stack — when the slideshow is playing with a non-`none`
          transition, the outgoing image (back layer) runs its exit anim
          while the new image (front layer) runs its enter anim. Outside of
          slideshow mode only the front layer is rendered, so manual prev /
          next stays instant. The user's pan/zoom transform stays on the
          inner image; the transition transform wraps it so the two compose. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {prevUrl && (
          <div key={`out-${animKey}`} className={cn('absolute', transitionClass(transition, 'out'))}>
            <img
              src={prevUrl}
              alt=""
              draggable={false}
              className={IMAGE_BOX}
            />
          </div>
        )}
        <div
          key={`in-${animKey}`}
          className={cn('absolute', prevUrl && transitionClass(transition, 'in'))}
        >
          <KenBurnsWrap active={playing && transition === 'ken-burns'} durationMs={slideshowMs} animKey={animKey}>
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className={IMAGE_BOX}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: reframing ? 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
              }}
            />
          </KenBurnsWrap>
        </div>
      </div>

      {/* Prev / next — hidden while the slideshow plays, as in v1. */}
      {canPage && !playing && (
        <>
          <ActionIcon
            {...chrome}
            size={narrow ? 56 : 'xl'}
            radius={narrow ? 'xl' : undefined}
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className={cn('!absolute left-4 z-10', narrow ? '' : 'top-1/2 -translate-y-1/2')}
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
            className={cn('!absolute z-10', narrow ? 'right-4' : 'top-1/2 -translate-y-1/2', !narrow && (infoSlot && infoOpen ? 'right-[356px]' : 'right-4'))}
            style={{ ...chrome.style, ...(narrow ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' } : null) }}
          >
            <IconChevronRight size="1.5rem" />
          </ActionIcon>
        </>
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
            onClick={(e) => { e.stopPropagation(); onClose(); }}
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
