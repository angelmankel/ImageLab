/**
 * Fix list 2 "Video previews": THE video thumbnail. Follows Settings → Appearance → Video
 * previews (`~/app/videoPreview`): On hover (default) plays while the pointer is on the tile,
 * Autoplay plays the on-screen ones (nearest the centre, at most 4 — 2 on a phone — through ONE
 * app-wide `VideoAutoplay`, root = the viewport), Off never plays. Muted, inline, looped, nothing
 * loaded until near (`preload="none"`), released when it scrolls away, paused while the tab is
 * hidden; reduced motion and Save-Data turn Autoplay into On hover.
 *
 * The still: `poster` (a picture URL), or `overlay` (the parent already draws the still under it:
 * the video only shows while it plays), else the clip's first frame, loaded when near.
 * Hover is read from `hovered` when the parent tracks it, else from the parent element.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useVideoPreview } from '~/app/videoPreview';
import { VideoAutoplay } from '~/screens/library/videoAutoplay';
import { autoplayAllowed, playCap } from '~/screens/library/videoAutoplayLogic';

let shared: VideoAutoplay | null = null;

const media = (q: string) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null);
export function saveData(): boolean {
  const c = (typeof navigator !== 'undefined' ? navigator : null) as (Navigator & { connection?: { saveData?: boolean } }) | null;
  return !!c?.connection?.saveData;
}

/** The app-wide controller (created on the first thumbnail; follows the setting by itself). */
export function sharedAutoplay(): VideoAutoplay {
  if (shared) return shared;
  const ctl = new VideoAutoplay();
  shared = ctl;
  ctl.attach(null);
  const reduced = media('(prefers-reduced-motion: reduce)');
  const phone = media('(max-width: 767px)');
  const sync = () => {
    // A little under the Library grid's cap: these share the screen with the rest of the app.
    ctl.setCap(Math.max(2, playCap(!!phone?.matches) - 2));
    ctl.setAllowed(useVideoPreview.getState().mode === 'autoplay' && autoplayAllowed({ reducedMotion: !!reduced?.matches, saveData: saveData() }));
  };
  sync();
  useVideoPreview.subscribe(sync);
  reduced?.addEventListener?.('change', sync);
  phone?.addEventListener?.('change', sync);
  return ctl;
}

/**
 * Hover → play for a registered <video>: from `hovered` when given, else the parent element's
 * pointer enter / leave (a mouse or pen; a touch has no hover). Nothing in Off.
 */
export function useHoverPlay(ref: React.RefObject<HTMLVideoElement>, ctl: VideoAutoplay | null, hovered?: boolean, active = true) {
  const mode = useVideoPreview((s) => s.mode);
  const on = active && mode !== 'off' && !!ctl;
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || hovered === undefined) return;
    ctl!.hover(el, hovered);
    return () => ctl!.hover(el, false);
  }, [on, hovered, ctl, ref]);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!on || !el || !host || hovered !== undefined) return;
    const enter = (e: PointerEvent) => { if (e.pointerType !== 'touch') ctl!.hover(el, true); };
    const leave = () => ctl!.hover(el, false);
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    return () => { host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave); ctl!.hover(el, false); };
  }, [on, hovered, ctl, ref]);
}

export function VideoThumb({ src, poster, overlay, hovered, autoplay = true, style, className, onLoadedMetadata }: {
  src: string;
  /** A still to show until it plays. */
  poster?: string;
  /** The parent draws the still: the video shows only while it plays. */
  overlay?: boolean;
  /** The parent's hover state; omitted = the parent element's pointer. */
  hovered?: boolean;
  /** False: never plays on its own, only on hover (a tiny thumb, e.g. a session tab). */
  autoplay?: boolean;
  style?: CSSProperties;
  className?: string;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const ctl = sharedAutoplay();
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    return ctl.register(el, src, { still: !poster && !overlay, overlay, autoplay });
  }, [ctl, src, poster, overlay, autoplay]);
  useHoverPlay(ref, ctl, hovered, !!src);
  return (
    <video ref={ref} muted loop playsInline disablePictureInPicture preload="none" poster={poster} aria-hidden className={className} onLoadedMetadata={onLoadedMetadata}
      style={{ display: 'block', objectFit: 'cover', background: 'transparent', pointerEvents: 'none', ...style }} />
  );
}
