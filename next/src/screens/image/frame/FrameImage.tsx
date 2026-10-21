/**
 * Item 41: a picture that never flashes when it changes. The shown frame stays on screen until
 * the next one has DECODED (an off-screen `Image` + `decode()`; the browser's list of available
 * images then paints the new `<img>` at once), then the new one goes on top: a ~150 ms cross-fade
 * over the old (`fade`, the live preview) or a straight cut (motion off / reduced, or `fade`
 * false: paging results, the final image, L1 #3). Only after that is the old layer dropped.
 * The layer maths is `frameLayers.ts` (tested).
 *
 * `FrameImage` stacks <img> layers in one grid cell (all laid out the same; `imgStyle` holds the
 * stage's zoom transform etc.); `useFrameLayers` is the hook for other renderers (background-image
 * tiles in the live grid).
 */
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { fadeMs, frameReducer, topReady, type FrameLayer } from './frameLayers';

let nextId = 1;

/** The theme's motion factor right now (`--il-motion`: 0 = off / reduced). */
function motionNow(): number {
  if (typeof document === 'undefined') return 1;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--il-motion'));
  return Number.isFinite(v) ? v : 1;
}

export interface FrameLayers {
  /** Layers that are decoded and on screen, bottom first; the last is the newest. */
  shown: FrameLayer[];
  /** The newest shown layer finished arriving (fade done / cut painted): drop what is under it. */
  settle: (id: number) => void;
}

export function useFrameLayers(src: string | null, onNatural?: (w: number, h: number) => void): FrameLayers {
  const [layers, dispatch] = useReducer(frameReducer, [] as FrameLayer[]);
  const natural = useRef(onNatural); natural.current = onNatural;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A decode that finishes after a newer src keeps going (the reducer decides if it still shows),
  // so frames that come faster than they decode never leave the old one up forever.
  useLayoutEffect(() => {
    const id = nextId++;
    dispatch({ type: 'push', id, url: src });
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    const ok = () => { if (!mounted.current) return; natural.current?.(img.naturalWidth, img.naturalHeight); dispatch({ type: 'ready', id }); };
    const bad = () => { if (mounted.current) dispatch({ type: 'fail', id }); };
    img.decode().then(ok, () => {
      // decode() can reject for an image that still loads (e.g. some SVGs): fall back to load.
      if (img.complete && img.naturalWidth) ok(); else { img.onload = ok; img.onerror = bad; }
    });
  }, [src]);
  const settle = useCallback((id: number) => dispatch({ type: 'settle', id }), []);
  const shown = layers.filter((l) => l.ready);
  return { shown, settle };
}

/**
 * Animate the newest layer in over the ones under it: a WAAPI opacity fade, or a cut that settles
 * on the next frame. Returns the ref callback for the newest layer's element.
 */
export function useArrive(f: FrameLayers, fade: boolean) {
  const top = f.shown[f.shown.length - 1];
  const below = f.shown.length > 1;
  const ms = fade && below ? fadeMs(motionNow()) : 0;
  const { settle } = f;
  // A cut: the new layer is painted this frame; drop the old one on the next.
  useEffect(() => {
    if (!top || !below || ms > 0) return;
    const r = requestAnimationFrame(() => settle(top.id));
    return () => cancelAnimationFrame(r);
  }, [top?.id, below, ms, settle]); // eslint-disable-line react-hooks/exhaustive-deps
  // Every element of the newest layer fades (the live grid has one per tile); the first to finish settles.
  const started = useRef<{ id: number; els: WeakSet<HTMLElement> }>({ id: 0, els: new WeakSet() });
  return useCallback((el: HTMLElement | null) => {
    if (!el || !top || !below || ms <= 0) return;
    if (started.current.id !== top.id) started.current = { id: top.id, els: new WeakSet() };
    if (started.current.els.has(el)) return;
    started.current.els.add(el);
    const id = top.id;
    const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out', fill: 'backwards' });
    a.finished.then(() => settle(id), () => settle(id));
  }, [top?.id, below, ms, settle]); // eslint-disable-line react-hooks/exhaustive-deps
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'style'>;

export function FrameImage({ src, fade = false, imgStyle, imgProps, style, onNatural, layerStyle }: {
  src: string | null;
  /** Cross-fade each new picture in (~150 ms, the theme's motion); false = a clean cut. */
  fade?: boolean;
  /** Style of every <img> layer (sizing, transform, checkerboard…). */
  imgStyle?: CSSProperties;
  /** Per-layer style by url (e.g. a checkerboard only under pictures that may carry alpha). */
  layerStyle?: (url: string) => CSSProperties | undefined;
  /** Props on every layer (drag source, data attributes…). */
  imgProps?: ImgProps & Record<string, unknown>;
  /** The box: by default it fills its positioned parent. */
  style?: CSSProperties;
  onNatural?: (w: number, h: number) => void;
}) {
  const f = useFrameLayers(src, onNatural);
  const arrive = useArrive(f, fade);
  const top = topReady(f.shown);
  if (!f.shown.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplate: '100% / 100%', placeItems: 'center', pointerEvents: 'none', ...style }}>
      {f.shown.map((l) => (
        <img key={l.id} ref={l === top ? arrive : undefined} src={l.url} alt="" {...imgProps}
          style={{ gridArea: '1 / 1', minWidth: 0, minHeight: 0, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', pointerEvents: l === top ? 'auto' : 'none', ...imgStyle, ...layerStyle?.(l.url) }} />
      ))}
    </div>
  );
}
