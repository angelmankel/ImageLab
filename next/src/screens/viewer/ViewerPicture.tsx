/**
 * Item 30: the viewer's picture area — its own box, nothing drawn over the picture. Two modes:
 *  - Browse (`PagerPicture`): the shared pager track (`@/hooks/usePager`, slideOnlyOnDrag: a
 *    finger's swipe slides with motion, every other seek is a cut — item 3) and pan / zoom
 *    (`@/hooks/usePanZoom`: wheel, pinch, double-tap, drag when zoomed). A one-finger pull down
 *    closes (the picture follows the finger; the close itself is instant). A tap toggles focus
 *    (the chrome hides; the picture gets the whole screen).
 *  - Slideshow (`ShowPicture`): two layers; each auto-advance waits for the next picture to
 *    decode, then runs the chosen transition (`slideshowLogic`), Ken Burns drifts the shown one.
 *    A manual seek while playing is still a cut.
 * Pictures that may carry alpha sit on the checkerboard (item 43).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePager } from '@/hooks/usePager';
import { usePanZoom, type DragPhase } from '@/hooks/usePanZoom';
import { usePreloadAround } from '@/hooks/usePreload';
import { createVelocityTracker } from '@/lib/momentum';
import { SLIDE_GAP, closeCommits, closeProgress, closeScale, lockAxis, rubberBand } from '@/lib/pager';
import { playOrMute, videoHasAudio } from '@/lib/videoAudio';
import { CHECKER, mayHaveAlpha } from '~/screens/image/checker';
import { kenBurnsFrames, nextShowIndex, transitionFrames, type ShowTransition } from './slideshowLogic';
import type { ViewerItem } from './types';

const SIDES = [-1, 0, 1] as const;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Media({ item, url, natural, live, style, current }: { item?: ViewerItem; url: string; natural?: (w: number, h: number) => void; live?: boolean; style?: React.CSSProperties; current?: boolean }) {
  const box: React.CSSProperties = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', ...style };
  if (item?.kind === 'video' && !live) {
    return current
      ? <video key={url} src={url} autoPlay loop playsInline controls muted={!videoHasAudio(url)} style={{ ...box, width: '100%', height: '100%' }}
          onLoadedMetadata={(e) => { natural?.(e.currentTarget.videoWidth, e.currentTarget.videoHeight); playOrMute(e.currentTarget); }} />
      : <video src={url} muted playsInline preload="metadata" style={{ ...box, width: '100%', height: '100%' }} />;
  }
  return (
    <img src={url} alt="" draggable={false} decoding="async"
      onLoad={(e) => natural?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      style={{ ...box, ...(!live && mayHaveAlpha(item?.filename ?? url) ? CHECKER : {}) }} />
  );
}

export function PagerPicture({ items, index, onIndexChange, liveUrl, onClose, onTap, onNatural, phone, dragProps }: {
  items: readonly ViewerItem[]; index: number; onIndexChange: (i: number) => void; liveUrl: string | null;
  onClose: () => void; onTap: () => void; onNatural: (w: number, h: number) => void; phone: boolean;
  /** `~/dnd` drag-source props for the shown picture (desktop): a mouse press at fit size drags it. */
  dragProps?: object;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  const item = items[index];
  const live = !!liveUrl;
  const canPage = items.length > 1 && !live;
  const pager = usePager({ keys: items.map((i) => i.key), index, onIndexChange, enabled: canPage, animate: true, slideOnlyOnDrag: true });
  usePreloadAround(items.map((i) => i.url), index);

  const g = useRef<{ axis: 'x' | 'y' | 'none' | null; vy: ReturnType<typeof createVelocityTracker> }>({ axis: null, vy: createVelocityTracker() });
  const setPull = (dx: number, dy: number) => {
    const el = pullRef.current; if (!el) return;
    const h = window.innerHeight;
    const y = dy >= 0 ? dy : rubberBand(dy, h / 2);
    el.style.transform = `translate(${dx * 0.3}px, ${y}px) scale(${closeScale(closeProgress(dy, h))})`;
  };
  const springBack = () => {
    const el = pullRef.current; if (!el || !el.style.transform) return;
    const from = el.style.transform; el.style.transform = '';
    el.animate([{ transform: from }, { transform: 'none' }], { duration: reduced() ? 100 : 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  };
  const onDrag = (phase: DragPhase, dx: number, dy: number) => {
    const s = g.current;
    if (phase === 'start') { s.axis = null; s.vy.reset(0, dy); return; }
    if (phase === 'move') {
      if (!s.axis) {
        const axis = lockAxis(dx, dy);
        if (!axis) return;
        if (axis === 'x') { if (canPage) { s.axis = 'x'; pager.drag.begin(); } else s.axis = 'none'; } else s.axis = 'y';
      }
      if (s.axis === 'x') pager.drag.update(dx);
      else if (s.axis === 'y') { setPull(dx, dy); s.vy.sample(0, dy); }
      return;
    }
    if (s.axis === 'x') pager.drag.finish({ cancel: phase === 'cancel' });
    else if (s.axis === 'y') {
      const vy = s.vy.release().y;
      if (phase === 'end' && closeCommits(dy, vy, window.innerHeight)) onClose(); else springBack();
    }
    s.axis = null;
  };
  const pz = usePanZoom(box, { resetKey: item?.key ?? index, onDrag, onTap });
  const isVideo = item?.kind === 'video' && !live;
  // A mouse at fit size: the press is the drag source's (native drag needs no pointer capture), a
  // click toggles focus; the wheel still zooms. Touch, pen and a zoomed picture go to pan / zoom.
  const mouseFit = (e: React.PointerEvent | React.MouseEvent) => !!dragProps && pz.zoom <= 1.05 && (e as React.PointerEvent).pointerType !== 'touch' && (e as React.PointerEvent).pointerType !== 'pen' && !isVideo;
  const mouseFitDown = useRef(false);
  const handlers = {
    ...pz.handlers,
    onPointerDown: (e: React.PointerEvent) => { mouseFitDown.current = mouseFit(e); if (!mouseFitDown.current) pz.handlers.onPointerDown(e); },
    onPointerMove: (e: React.PointerEvent) => { if (!mouseFitDown.current) pz.handlers.onPointerMove(e); },
    onPointerUp: (e: React.PointerEvent) => { if (!mouseFitDown.current) pz.handlers.onPointerUp(e); },
    onClick: (e: React.MouseEvent) => { if (mouseFitDown.current) { mouseFitDown.current = false; onTap(); } else pz.handlers.onClick(e); },
  };
  const pan = { transform: `translate(${pz.offset.x}px, ${pz.offset.y}px) scale(${pz.zoom})`, transition: pz.reframing ? 'transform 250ms cubic-bezier(.22, 1, .36, 1)' : undefined };

  const sideItem = (side: -1 | 1): ViewerItem | undefined => {
    if (live) return undefined;
    if (pager.ghost?.side === side) return items.find((i) => i.key === pager.ghost!.key);
    return items[index + side];
  };

  return (
    <div ref={box} aria-label="Picture" data-no-swipe
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none' }}
      {...(isVideo && !phone ? {} : handlers)} onPointerCancel={handlers.onPointerUp}>
      <div ref={pager.trackRef} style={{ position: 'absolute', inset: 0 }}>
        {SIDES.map((side) => {
          const it = side === 0 ? item : sideItem(side);
          if (side !== 0 && !it) return null;
          if (side === 0 && !it && !live) return null;
          const url = side === 0 && live ? liveUrl! : it!.url;
          return (
            <div key={`${side}:${side === 0 && live ? 'live' : it!.key}`}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: side ? `translateX(calc(${side} * (100% + ${SLIDE_GAP}px)))` : undefined }}>
              {side === 0 ? (
                <div ref={pullRef} {...(dragProps && !live && pz.zoom <= 1.05 ? dragProps : {})} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Media item={it} url={url} live={live} current natural={onNatural} style={isVideo ? undefined : pan} />
                </div>
              ) : <Media item={it} url={url} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The slideshow. `index` is the shown one; it asks for the next with `onIndexChange` after
 * `speedMs` (and once the next picture has decoded). An index change it asked for animates; any
 * other (a key, a thumbnail) cuts.
 */
export function ShowPicture({ items, index, onIndexChange, transition, speedMs, onTap, onNatural }: {
  items: readonly ViewerItem[]; index: number; onIndexChange: (i: number) => void;
  transition: ShowTransition; speedMs: number; onTap: () => void; onNatural: (w: number, h: number) => void;
}) {
  const item = items[index];
  const [out, setOut] = useState<{ item: ViewerItem; i: number; n: number } | null>(null);
  const asked = useRef<number | null>(null);
  const prev = useRef<{ item: ViewerItem; i: number } | null>(item ? { item, i: index } : null);
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // An index change: animate the one we asked for, cut every other.
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = item ? { item, i: index } : null;
    if (!before || !item || before.item.key === item.key) return;
    const auto = asked.current === index;
    asked.current = null;
    if (auto && transition !== 'cut') setOut({ item: before.item, i: before.i, n: ++seq.current });
    else setOut(null);
  }, [item?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run the transition once both layers are on screen.
  useLayoutEffect(() => {
    if (!out) return;
    const f = transitionFrames(transition, 1, reduced());
    const opts: KeyframeAnimationOptions = { duration: f.ms, easing: f.easing, fill: 'both' };
    const a = inRef.current?.animate(f.incoming, opts);
    outRef.current?.animate(f.outgoing, opts);
    const n = out.n;
    const end = () => setOut((o) => (o && o.n === n ? null : o));
    if (a) a.finished.then(end, end); else end();
  }, [out?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ken Burns: the shown picture drifts for its whole time on screen.
  useLayoutEffect(() => {
    if (transition !== 'kenburns' || !kbRef.current || reduced()) return;
    const anim = kbRef.current.animate(kenBurnsFrames(index), { duration: speedMs + 1600, easing: 'linear', fill: 'both' });
    return () => anim.cancel();
  }, [item?.key, transition, speedMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock: wait `speedMs`, make sure the next picture is decoded, then ask for it.
  useEffect(() => {
    if (items.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      const ni = nextShowIndex(index, items.length);
      const next = items[ni];
      const go = () => { if (alive) { asked.current = ni; onIndexChange(ni); } };
      if (!next || next.kind === 'video') { go(); return; }
      const img = new Image();
      img.src = next.url;
      img.decode().then(go, go);
    }, speedMs);
    return () => { alive = false; clearTimeout(t); };
  }, [index, items, speedMs, onIndexChange]);

  if (!item) return null;
  const layer: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform, opacity, filter' };
  return (
    <div aria-label="Slideshow" onClick={onTap} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {out && (
        <div ref={outRef} key={`out-${out.n}`} style={layer}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: transition === 'kenburns' ? String(kenBurnsFrames(out.i)[1].transform) : undefined }}>
            <Media item={out.item} url={out.item.url} />
          </div>
        </div>
      )}
      <div ref={inRef} key={`in-${item.key}`} style={layer}>
        <div ref={kbRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Media item={item} url={item.url} current natural={onNatural} />
        </div>
      </div>
    </div>
  );
}
