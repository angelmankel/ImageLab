/**
 * Item 13: the GPU canvas engine (PixiJS 8, WebGL), the classic app's engine idea
 * (`@/lib/canvasController`: a world container whose transform IS the view, the picture at world
 * (0, 0) at its pixel size, a zoom-aware grid drawn with overscan, render only on demand, momentum
 * from `@/lib/momentum`) without the layer / brush / mask machinery, plus what the next UI needs:
 *  - `setPicture(url, { fade })`: decode off screen, then cross-fade the new picture over the old one
 *    (item 41) or cut; the size change re-fits when the view was fitted.
 *  - `setLook(look)`: live colour adjustments on the GPU (ColorMatrixFilter + BlurFilter), and
 *    `bake(url, look)` renders the same filters at full size into a PNG.
 *  - insets (the Edit mode's floating bar) so Fit centres the picture in the free area.
 *  - view or edit zoom limits: view = fit … 8× fit (the old stage), edit = 0.1× fit … 32×.
 * Input: wheel / trackpad pinch zoom about the cursor, drag pans (mouse, one finger), two fingers
 * pinch, a flick throws, a tap that did not move calls `onTap`.
 */
import { Application, BlurFilter, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { createVelocityTracker, runInertia } from '@/lib/momentum';
import { fitView, gridSpec, isFitted, panBy, toScreen, toWorld, zoomAt, NO_INSETS, type Insets, type Pt, type View } from './gpuView';
import { lookMatrix, isNeutralLook, type Look } from '../edit/editLogic';
import { fadeMs } from '~/screens/image/frame/frameLayers';
import { toCssPx, uiZoom } from '~/theme/uiScale';

export type ZoomMode = 'view' | 'edit';

export interface GpuCanvasOptions {
  onTap?: (e: PointerEvent) => void;
  /** Called after any view / picture change (overlays, the toolbar's zoom state). */
  onChange?: () => void;
  /** Padding (px) around the picture at fit. */
  pad?: number;
}

export interface GpuCanvas {
  readonly ready: Promise<boolean>;
  setPicture(url: string | null, o?: { fade?: boolean; refit?: boolean }): Promise<boolean>;
  pictureSize(): { w: number; h: number } | null;
  pictureUrl(): string | null;
  setLook(look: Look | null): void;
  setGrid(on: boolean): void;
  setChecker(on: boolean): void;
  setInsets(ins: Insets): void;
  setZoomMode(m: ZoomMode): void;
  /** Padding (px) around the picture at fit. */
  setPad(px: number): void;
  /** The picture's rect on screen (CSS px in the host), or null without a picture. */
  pictureRect(): { x: number; y: number; w: number; h: number } | null;
  setPanEnabled(on: boolean): void;
  fit(): void;
  zoomBy(factor: number): void;
  /** Zoom relative to fit (1 = fitted). */
  relZoom(): number;
  isFitted(): boolean;
  view(): View;
  viewport(): { w: number; h: number };
  toScreen(p: Pt): Pt;
  toWorld(s: Pt): Pt;
  bake(url: string, look: Look | null): Promise<Blob>;
  dispose(): void;
}

const VIEW_MAX_REL = 8;
const EDIT_MIN_REL = 0.1;
const EDIT_MAX_Z = 32;
const TAP_PX = 5;

function cssColor(name: string, fallback: number): number {
  try {
    const el = document.createElement('div');
    el.style.color = `var(${name})`;
    el.style.display = 'none';
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    return m ? (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]) : fallback;
  } catch { return fallback; }
}

function motionNow(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--il-motion'));
  return Number.isFinite(v) ? v : 1;
}

/** A decoded picture (an off-screen Image, so the texture upload never waits on the network). */
async function decoded(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  try { await img.decode(); } catch {
    if (!(img.complete && img.naturalWidth)) await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Could not load the picture')); });
  }
  return img;
}

function checkerTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2a30'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#3a3a42'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
  return Texture.from(c);
}

export function createGpuCanvas(host: HTMLElement, opts: GpuCanvasOptions = {}): GpuCanvas {
  let disposed = false;
  let app: Application | null = null;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  // First child, so the DOM overlays (crop handles, the tool bar) stay above it.
  host.prepend(canvas);

  let vw = Math.max(1, host.clientWidth);
  let vh = Math.max(1, host.clientHeight);
  let view: View = { cx: 0, cy: 0, z: 1 };
  let insets: Insets = NO_INSETS;
  let mode: ZoomMode = 'view';
  let panEnabled = true;
  let pad = opts.pad ?? 0;

  const bg = new Graphics();
  const world = new Container();
  const grid = new Graphics();
  const checker = new TilingSprite({ texture: Texture.EMPTY, width: 1, height: 1 });
  checker.visible = false;
  const pic = new Container();
  world.addChild(grid, checker, pic);
  let gridOn = false;
  let checkerOn = false;
  let look: Look | null = null;
  const matrix = new ColorMatrixFilter();
  const blur = new BlurFilter({ strength: 0, quality: 4 });

  /** The shown sprites, oldest first; the last is the current picture. */
  const sprites: { sprite: Sprite; url: string }[] = [];
  let picW = 0;
  let picH = 0;
  let loadSeq = 0;
  /** The seq of the picture on screen: a load that finishes after a newer one showed is dropped,
   *  but one overtaken while decoding still shows (frames faster than decode never starve). */
  let shownSeq = 0;
  let fadeRaf = 0;

  const fitNow = () => fitView(picW, picH, vw, vh, insets, pad);
  const minZ = () => (picW ? fitNow().z * (mode === 'view' ? 1 : EDIT_MIN_REL) : 0.05);
  const maxZ = () => (picW ? (mode === 'view' ? fitNow().z * VIEW_MAX_REL : Math.max(EDIT_MAX_Z, fitNow().z * 8)) : EDIT_MAX_Z);

  let raf = 0;
  const render = () => {
    raf = 0;
    if (!app || disposed) return;
    world.scale.set(view.z);
    world.position.set(vw / 2 - view.cx * view.z, vh / 2 - view.cy * view.z);
    drawGrid();
    // The checkerboard keeps 8 px squares on screen at any zoom.
    if (checker.visible) checker.tileScale.set(1 / view.z);
    if (look && look.blur > 0) blur.strength = look.blur * view.z;
    app.renderer.render(app.stage);
  };
  const paint = () => { if (!raf && !disposed) raf = requestAnimationFrame(render); };
  const changed = () => { paint(); opts.onChange?.(); };

  let gridKey = '';
  function drawGrid() {
    if (!gridOn) { if (gridKey) { grid.clear(); gridKey = ''; } return; }
    const { step, minor, major } = gridSpec(view.z);
    const tl = toWorld(view, vw, vh, { x: -vw, y: -vh });
    const br = toWorld(view, vw, vh, { x: vw * 2, y: vh * 2 });
    const key = `${step}|${view.z.toFixed(4)}|${Math.floor(tl.x / (step * 8))}|${Math.floor(tl.y / (step * 8))}|${vw}|${vh}`;
    if (key === gridKey) return;
    gridKey = key;
    // Drawn with 3 viewports of overscan, so a pan redraws only once it nears the edge.
    const sub = step * 8;
    const l = Math.floor(tl.x / sub) * sub - sub, t = Math.floor(tl.y / sub) * sub - sub;
    const r = br.x + sub, b = br.y + sub;
    const w = 1 / view.z;
    grid.clear();
    const lines = (s: number, alpha: number) => {
      if (alpha <= 0) return;
      for (let x = l; x <= r; x += s) grid.moveTo(x, t).lineTo(x, b);
      for (let y = t; y <= b; y += s) grid.moveTo(l, y).lineTo(r, y);
      grid.stroke({ width: w, color: 0xffffff, alpha });
    };
    lines(step, minor);
    lines(sub, major);
  }

  const layoutSprites = () => {
    for (const s of sprites) { s.sprite.width = picW; s.sprite.height = picH; }
    checker.width = picW; checker.height = picH;
    checker.visible = checkerOn && picW > 0;
  };

  const applyLook = () => {
    const fs = [];
    if (look && !isNeutralLook(look)) {
      const steps = lookMatrix(look);
      if (steps.length) {
        matrix.reset();
        for (const s of steps) {
          if (s[0] === 'negative') matrix.negative(true);
          else (matrix[s[0]] as (v: number, m: boolean) => void).call(matrix, s[1], true);
        }
        fs.push(matrix);
      }
      if (look.blur > 0) { blur.strength = look.blur * view.z; fs.push(blur); }
    }
    pic.filters = fs.length ? fs : null;
  };

  const ro = new ResizeObserver(() => {
    if (!app || disposed) return;
    const w = Math.max(1, Math.floor(host.clientWidth));
    const h = Math.max(1, Math.floor(host.clientHeight));
    if (w === vw && h === vh) return;
    const wasFitted = picW > 0 && isFitted(view, fitNow());
    vw = w; vh = h;
    app.renderer.resize(w, h);
    bg.width = w; bg.height = h;
    if (wasFitted) view = fitNow();
    changed();
  });

  const ready: Promise<boolean> = (async () => {
    const a = new Application();
    try {
      await a.init({ canvas, width: vw, height: vh, background: cssColor('--il-bg-deep', 0x0f0f11), antialias: true, resolution: (window.devicePixelRatio || 1) * uiZoom(), autoDensity: true, autoStart: false, preference: 'webgl' });
    } catch (e) {
      console.error('[gpu-canvas] init failed', e);
      return false;
    }
    if (disposed) { a.destroy({ removeView: false }, { children: true, texture: true, textureSource: true }); return false; }
    app = a;
    a.stage.addChild(bg, world);
    bg.rect(0, 0, 1, 1).fill({ color: cssColor('--il-bg-deep', 0x0f0f11) });
    bg.width = vw; bg.height = vh;
    checker.texture = checkerTexture();
    ro.observe(host);
    paint();
    return true;
  })();

  // ---- Input -----------------------------------------------------------------
  const pointers = new Map<number, Pt>();
  let drag: { id: number; x: number; y: number; moved: boolean; start: Pt } | null = null;
  let pinch: { d: number; v: View; mid: Pt } | null = null;
  let pinched = false;
  const vel = createVelocityTracker();
  let stopThrow: (() => void) | null = null;
  // Window px → CSS px inside the UI-scaled body (theme/uiScale).
  const local = (e: { clientX: number; clientY: number }): Pt => { const r = host.getBoundingClientRect(); return { x: toCssPx(e.clientX - r.left), y: toCssPx(e.clientY - r.top) }; };

  const onWheel = (e: WheelEvent) => {
    if (!picW) return;
    e.preventDefault();
    stopThrow?.(); stopThrow = null;
    const delta = -e.deltaY * (e.deltaMode === 1 ? 30 : 1);
    const factor = Math.exp(delta * (e.ctrlKey ? 0.01 : 0.002));
    view = zoomAt(view, factor, local(e), vw, vh, minZ(), maxZ());
    if (mode === 'view' && view.z <= fitNow().z * 1.0005) view = fitNow();
    changed();
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    stopThrow?.(); stopThrow = null;
    // A mouse press on a draggable element (the picture's drag source, `~/dnd`) may become a native
    // drag: capturing the pointer would swallow it. Its dragstart ends the gesture (no tap).
    const nativeDrag = e.pointerType === 'mouse' && (e.target as HTMLElement | null)?.draggable === true;
    if (!nativeDrag) { try { host.setPointerCapture(e.pointerId); } catch { /* gone */ } }
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      pinched = false;
      drag = { id: e.pointerId, x: p.x, y: p.y, moved: false, start: p };
      vel.reset(p.x, p.y);
    } else if (pointers.size === 2) {
      pinched = true; drag = null;
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), v: view, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };
  const onMove = (e: PointerEvent) => {
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    const p = local(e);
    pt.x = p.x; pt.y = p.y;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Zoom about the start midpoint, then follow the midpoint (two fingers also pan).
      let v = zoomAt(pinch.v, pinch.d > 0 ? d / pinch.d : 1, pinch.mid, vw, vh, minZ(), maxZ());
      v = panBy(v, mid.x - pinch.mid.x, mid.y - pinch.mid.y);
      view = v;
      changed();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < TAP_PX) return;
    drag.moved = true;
    drag.x = p.x; drag.y = p.y;
    vel.sample(p.x, p.y);
    if (!panEnabled || (mode === 'view' && isFitted(view, fitNow()))) return;
    view = panBy(view, dx, dy);
    changed();
  };
  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size === 1) {
      const [id, p] = [...pointers.entries()][0];
      pinch = null;
      drag = { id, x: p.x, y: p.y, moved: true, start: p };
      return;
    }
    if (pointers.size > 1) return;
    const d = drag;
    drag = null; pinch = null;
    const tap = e.type !== 'pointercancel' && !pinched && !!d && d.id === e.pointerId && !d.moved;
    pinched = false;
    if (tap) { opts.onTap?.(e); return; }
    if (d?.moved && panEnabled && !(mode === 'view' && isFitted(view, fitNow()))) {
      const v = vel.release();
      stopThrow = runInertia(v, (dx, dy) => { view = panBy(view, dx, dy); changed(); });
    }
  };
  const onDragStart = () => { pointers.clear(); drag = null; pinch = null; pinched = false; };
  host.addEventListener('dragstart', onDragStart);
  host.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);

  // ---- Picture ---------------------------------------------------------------
  const dropOld = () => {
    while (sprites.length > 1) {
      const s = sprites.shift()!;
      pic.removeChild(s.sprite);
      s.sprite.destroy({ texture: true, textureSource: true });
    }
  };

  const setPicture = async (url: string | null, o: { fade?: boolean; refit?: boolean } = {}): Promise<boolean> => {
    const seq = ++loadSeq;
    if (!url) {
      shownSeq = seq;
      cancelAnimationFrame(fadeRaf);
      for (const s of sprites) { pic.removeChild(s.sprite); s.sprite.destroy({ texture: true, textureSource: true }); }
      sprites.length = 0; picW = picH = 0;
      layoutSprites(); changed();
      return true;
    }
    // Already on screen: it is the newest wish, so a slower older load must not replace it.
    if (sprites.length && sprites[sprites.length - 1].url === url) { shownSeq = seq; return true; }
    let img: HTMLImageElement;
    try { img = await decoded(url); } catch { return false; }
    if (!(await ready) || disposed) return false;
    if (seq < shownSeq) return true;
    shownSeq = seq;
    const tex = Texture.from(img);
    const sprite = new Sprite(tex);
    const w = img.naturalWidth, h = img.naturalHeight;
    const wasFitted = !picW || isFitted(view, fitNow());
    const sizeChanged = w !== picW || h !== picH;
    picW = w; picH = h;
    pic.addChild(sprite);
    sprites.push({ sprite, url });
    layoutSprites();
    if (o.refit || (sizeChanged && wasFitted) || sprites.length === 1) view = fitNow();
    const ms = o.fade && sprites.length > 1 ? fadeMs(motionNow()) : 0;
    cancelAnimationFrame(fadeRaf);
    if (ms <= 0) { dropOld(); changed(); return true; }
    sprite.alpha = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      if (disposed) return;
      const k = Math.min(1, (now - t0) / ms);
      sprite.alpha = k;
      render();
      if (k < 1) fadeRaf = requestAnimationFrame(step); else { dropOld(); changed(); }
    };
    fadeRaf = requestAnimationFrame(step);
    opts.onChange?.();
    return true;
  };

  const bake = async (url: string, lk: Look | null): Promise<Blob> => {
    if (!(await ready) || !app) throw new Error('The GPU canvas is not ready');
    const img = await decoded(url);
    const tex = Texture.from(img);
    const holder = new Container();
    const s = new Sprite(tex);
    holder.addChild(s);
    const fs = [];
    let cm: ColorMatrixFilter | null = null; let bl: BlurFilter | null = null;
    if (lk && !isNeutralLook(lk)) {
      const steps = lookMatrix(lk);
      if (steps.length) {
        cm = new ColorMatrixFilter();
        for (const st of steps) {
          if (st[0] === 'negative') cm.negative(true);
          else (cm[st[0]] as (v: number, m: boolean) => void).call(cm, st[1], true);
        }
        fs.push(cm);
      }
      if (lk.blur > 0) { bl = new BlurFilter({ strength: lk.blur, quality: 4 }); fs.push(bl); }
    }
    s.filters = fs.length ? fs : null;
    try {
      const out = app.renderer.extract.canvas({ target: holder, frame: new Rectangle(0, 0, img.naturalWidth, img.naturalHeight), resolution: 1, clearColor: [0, 0, 0, 0] }) as HTMLCanvasElement;
      return await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the picture'))), 'image/png'));
    } finally {
      holder.destroy({ children: true, texture: true, textureSource: true });
      cm?.destroy(); bl?.destroy();
    }
  };

  return {
    ready,
    setPicture,
    pictureSize: () => (picW ? { w: picW, h: picH } : null),
    pictureUrl: () => sprites[sprites.length - 1]?.url ?? null,
    setLook(l) { look = l; applyLook(); changed(); },
    setGrid(on) { gridOn = on; changed(); },
    setChecker(on) { checkerOn = on; layoutSprites(); changed(); },
    setInsets(ins) {
      const wasFitted = picW > 0 && isFitted(view, fitNow());
      insets = ins;
      if (wasFitted) view = fitNow();
      changed();
    },
    setZoomMode(m) {
      mode = m;
      if (picW) { const f = fitNow(); if (m === 'view' && view.z < f.z) view = f; }
      changed();
    },
    setPanEnabled(on) { panEnabled = on; },
    setPad(px) {
      const wasFitted = picW > 0 && isFitted(view, fitNow());
      pad = px;
      if (wasFitted) view = fitNow();
      changed();
    },
    pictureRect() {
      if (!picW) return null;
      const a = toScreen(view, vw, vh, { x: 0, y: 0 });
      return { x: a.x, y: a.y, w: picW * view.z, h: picH * view.z };
    },
    fit() { stopThrow?.(); stopThrow = null; if (picW) { view = fitNow(); changed(); } },
    zoomBy(f) {
      if (!picW) return;
      const fit = fitNow();
      const centre = toScreen(fit, vw, vh, { x: picW / 2, y: picH / 2 });
      view = zoomAt(view, f, isFitted(view, fit) ? centre : { x: vw / 2, y: vh / 2 }, vw, vh, minZ(), maxZ());
      if (mode === 'view' && view.z <= fit.z * 1.0005) view = fit;
      changed();
    },
    relZoom: () => (picW ? view.z / fitNow().z : 1),
    isFitted: () => !picW || isFitted(view, fitNow()),
    view: () => view,
    viewport: () => ({ w: vw, h: vh }),
    toScreen: (p) => toScreen(view, vw, vh, p),
    toWorld: (s) => toWorld(view, vw, vh, s),
    bake,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); cancelAnimationFrame(fadeRaf);
      stopThrow?.();
      ro.disconnect();
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('dragstart', onDragStart);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      if (app) app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
      app = null;
      matrix.destroy(); blur.destroy();
      canvas.remove();
    },
  };
}
