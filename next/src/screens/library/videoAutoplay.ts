/**
 * Video previews (Library rule 12; fix list 2 "Video previews" setting): one autoplay controller
 * per scroll area — the Library grid has its own, every other thumbnail shares the app-wide one
 * (`~/ui/VideoThumb`, root = the viewport). ONE IntersectionObserver (100px margin, 25% visible)
 * watches every registered <video>:
 *  - `still` slots get their src when near (the first frame is the picture); poster / `overlay`
 *    slots load nothing until they play (the poster, or the parent's still, shows meanwhile);
 *  - when autoplay is allowed, the visible ones nearest the centre play, up to the cap;
 *  - off screen they pause and, after RELEASE_MS, drop their src so the decoder and buffers go;
 *  - `hover(el, on)` plays one under the pointer whatever the mode (except Off, the caller's call);
 *    an `overlay` slot is released when the pointer leaves, so the parent's still shows again.
 * A tile under another layer (a modal, the viewer) does not count as visible (hit-tested at its centre,
 * re-checked every second). Nothing new starts while the page scrolls (only after it settles, 150 ms). Tab hidden / detach = pause all. Imperative on purpose: no React state, so playing / pausing
 * never re-renders a grid.
 */
import { pickPlaying, RELEASE_MS, ROOT_MARGIN, VISIBLE_RATIO, zoneFor, type Zone } from './videoAutoplayLogic';

export interface SlotOptions {
  /** Load the first frame when near, as the tile's picture (no poster). Default true. */
  still?: boolean;
  /** The parent draws the still: show the video only while it plays (released when it stops). */
  overlay?: boolean;
  /** False: never plays on its own (hover only), e.g. a 20 px tab thumbnail. Default true. */
  autoplay?: boolean;
}

interface Slot { key: string; el: HTMLVideoElement; url: string; zone: Zone; loaded: boolean; timer: number; still: boolean; overlay: boolean; autoplay: boolean; hovered: boolean }

export class VideoAutoplay {
  private slots = new Map<HTMLVideoElement, Slot>();
  private playing = new Set<HTMLVideoElement>();
  private io: IntersectionObserver | null = null;
  private root: Element | null = null;
  private attached = false;
  private cap = 6;
  private allowed = true;
  private raf = 0;
  private scrollTimer = 0;
  /** True while the page scrolls: no new clip starts (a fling would fetch every clip it passes). */
  private scrolling = false;
  /** Re-checks once a second: a layer opened over the tiles (a modal, a viewer) moves no observer. */
  private tick = 0;
  private seq = 0;

  /** A tile mounts its <video>; returns the unregister. Before attach() the element just waits. */
  register(el: HTMLVideoElement, url: string, opts: SlotOptions = {}): () => void {
    const slot: Slot = { key: String(++this.seq), el, url, zone: 'off', loaded: false, timer: 0, still: opts.still ?? true, overlay: !!opts.overlay, autoplay: opts.autoplay ?? true, hovered: false };
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = 'none';
    this.slots.set(el, slot);
    this.io?.observe(el);
    return () => {
      this.io?.unobserve(el);
      this.release(slot);
      window.clearTimeout(slot.timer);
      this.slots.delete(el);
      this.playing.delete(el);
      this.schedule();
    };
  }

  /** `root` = the scroll container (null = the viewport: scrolls anywhere on the page are heard). */
  attach(root: Element | null) {
    this.detach();
    this.root = root;
    this.attached = true;
    this.io = new IntersectionObserver(this.onEntries, { root, rootMargin: ROOT_MARGIN, threshold: [0, VISIBLE_RATIO] });
    this.slots.forEach((s) => this.io!.observe(s.el));
    (root ?? document).addEventListener('scroll', this.onScroll, { passive: true, capture: !root });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.tick = window.setInterval(() => { if (this.slots.size) this.schedule(); }, 1000);
  }

  detach() {
    if (!this.io) return;
    this.io.disconnect();
    this.io = null;
    (this.root ?? document).removeEventListener('scroll', this.onScroll, { capture: !this.root });
    this.attached = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.clearInterval(this.tick);
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.scrollTimer);
    this.raf = 0;
    this.slots.forEach((s) => { window.clearTimeout(s.timer); s.zone = 'off'; this.release(s); });
    this.playing.clear();
  }

  isAttached() { return this.attached; }
  setCap(n: number) { if (n !== this.cap) { this.cap = n; this.schedule(); } }
  setAllowed(on: boolean) { if (on !== this.allowed) { this.allowed = on; this.schedule(); } }

  /** The pointer entered / left the tile: play it now / stop (an overlay goes back to the still). */
  hover(el: HTMLVideoElement, on: boolean) {
    const s = this.slots.get(el);
    if (!s || s.hovered === on) return;
    s.hovered = on;
    if (on) {
      this.load(s);
      el.play().catch(() => undefined);
    } else if (!this.playing.has(el)) {
      this.pause(el);
      if (s.overlay) this.release(s);
    }
  }

  private onEntries = (entries: IntersectionObserverEntry[]) => {
    for (const e of entries) {
      const s = this.slots.get(e.target as HTMLVideoElement);
      if (!s) continue;
      s.zone = zoneFor(e.isIntersecting, e.intersectionRatio);
      window.clearTimeout(s.timer);
      if (s.zone === 'off') {
        this.pause(s.el);
        s.timer = window.setTimeout(() => { if (s.zone === 'off') this.release(s); }, RELEASE_MS);
      } else if (s.still) this.load(s);
    }
    this.schedule();
  };

  /** Scrolling inside a stable visible set can change who is nearest the centre: re-pick once it settles. */
  private onScroll = () => {
    this.scrolling = true;
    window.clearTimeout(this.scrollTimer);
    this.scrollTimer = window.setTimeout(() => { this.scrolling = false; this.schedule(); }, 150);
  };

  private onVisibility = () => this.schedule();

  private schedule() {
    if (this.raf || !this.io) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  }

  private update() {
    if (!this.allowed || document.hidden) {
      this.playing.forEach((el) => { const s = this.slots.get(el); this.pause(el); if (s?.overlay && !s.hovered) this.release(s); });
      if (document.hidden) this.slots.forEach((s) => { if (s.hovered) s.el.pause(); });
      return;
    }
    const cands: Slot[] = [];
    this.slots.forEach((s) => { if (s.zone === 'visible' && s.autoplay && this.onTop(s)) cands.push(s); });
    const r = this.root?.getBoundingClientRect();
    const view = r ? { top: r.top, height: r.height } : { top: 0, height: window.innerHeight };
    const boxes = cands.map((s) => { const b = s.el.getBoundingClientRect(); return { key: s.key, top: b.top, height: b.height }; });
    const win = new Set(pickPlaying(boxes, view, this.cap));
    this.playing.forEach((el) => { const s = this.slots.get(el); if (!s || (!win.has(s.key) && !s.hovered)) this.pause(el); });
    if (this.scrolling) return; // the winners start once the scroll settles
    for (const s of cands) {
      if (!win.has(s.key) || this.playing.has(s.el)) continue;
      this.load(s);
      this.playing.add(s.el);
      s.el.muted = true;
      s.el.play().catch(() => this.playing.delete(s.el));
    }
  }

  /** Not under another layer (a modal, the viewer): the tile itself is what is hit at its centre. */
  private onTop(s: Slot): boolean {
    const b = s.el.getBoundingClientRect();
    if (!b.width || !b.height) return false;
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!hit && (hit === s.el || (s.el.parentElement ?? s.el).contains(hit));
  }

  private load(s: Slot) {
    if (s.loaded) return;
    s.loaded = true;
    s.el.preload = s.still ? 'metadata' : 'auto';
    s.el.src = s.still ? `${s.url}#t=0.1` : s.url;
  }

  private pause(el: HTMLVideoElement) {
    this.playing.delete(el);
    if (!el.paused) el.pause();
  }

  /** Drop the src so the browser frees the decoder and buffered data; the tile shows its still / card colour until near again. */
  private release(s: Slot) {
    this.pause(s.el);
    if (!s.loaded) return;
    s.loaded = false;
    s.el.removeAttribute('src');
    s.el.preload = 'none';
    s.el.load();
  }
}
