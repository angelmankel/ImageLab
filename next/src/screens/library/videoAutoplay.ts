/**
 * Library (rule 12): one autoplay controller per grid. ONE IntersectionObserver (root = the
 * grid's scroll container, 100px margin, 25% visible) watches every video tile. Tiles near the
 * view get their src (first frame as the still); visible ones are candidates and the nearest the
 * centre play, up to the cap; off-screen ones pause and, after RELEASE_MS, drop their src so the
 * decoder and buffers go (memory stays flat with hundreds of tiles). Tab hidden / detach = pause all.
 * Imperative on purpose: no React state, so playing/pausing never re-renders the grid.
 */
import { pickPlaying, RELEASE_MS, ROOT_MARGIN, VISIBLE_RATIO, zoneFor, type Zone } from './videoAutoplayLogic';

interface Slot { key: string; el: HTMLVideoElement; url: string; zone: Zone; loaded: boolean; timer: number }

export class VideoAutoplay {
  private slots = new Map<HTMLVideoElement, Slot>();
  private playing = new Set<HTMLVideoElement>();
  private io: IntersectionObserver | null = null;
  private root: Element | null = null;
  private cap = 6;
  private allowed = true;
  private raf = 0;
  private scrollTimer = 0;
  private seq = 0;

  /** Tile mounts its <video>; returns the unregister. Before attach() the element just waits. */
  register(el: HTMLVideoElement, url: string): () => void {
    const slot: Slot = { key: String(++this.seq), el, url, zone: 'off', loaded: false, timer: 0 };
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

  attach(root: Element | null) {
    this.detach();
    this.root = root;
    this.io = new IntersectionObserver(this.onEntries, { root, rootMargin: ROOT_MARGIN, threshold: [0, VISIBLE_RATIO] });
    this.slots.forEach((s) => this.io!.observe(s.el));
    (root ?? window).addEventListener('scroll', this.onScroll, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach() {
    if (!this.io) return;
    this.io.disconnect();
    this.io = null;
    (this.root ?? window).removeEventListener('scroll', this.onScroll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.scrollTimer);
    this.raf = 0;
    this.slots.forEach((s) => { window.clearTimeout(s.timer); s.zone = 'off'; this.release(s); });
    this.playing.clear();
  }

  setCap(n: number) { if (n !== this.cap) { this.cap = n; this.schedule(); } }
  setAllowed(on: boolean) { if (on !== this.allowed) { this.allowed = on; this.schedule(); } }

  private onEntries = (entries: IntersectionObserverEntry[]) => {
    for (const e of entries) {
      const s = this.slots.get(e.target as HTMLVideoElement);
      if (!s) continue;
      s.zone = zoneFor(e.isIntersecting, e.intersectionRatio);
      window.clearTimeout(s.timer);
      if (s.zone === 'off') {
        this.pause(s.el);
        s.timer = window.setTimeout(() => { if (s.zone === 'off') this.release(s); }, RELEASE_MS);
      } else if (!s.loaded) {
        s.loaded = true;
        s.el.preload = 'metadata';
        s.el.src = `${s.url}#t=0.1`;
      }
    }
    this.schedule();
  };

  /** Scrolling inside a stable visible set can change who is nearest the centre: re-pick once it settles. */
  private onScroll = () => {
    window.clearTimeout(this.scrollTimer);
    this.scrollTimer = window.setTimeout(() => this.schedule(), 150);
  };

  private onVisibility = () => this.schedule();

  private schedule() {
    if (this.raf || !this.io) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  }

  private update() {
    if (!this.allowed || document.hidden) { this.playing.forEach((el) => this.pause(el)); return; }
    const cands: Slot[] = [];
    this.slots.forEach((s) => { if (s.zone === 'visible' && s.loaded) cands.push(s); });
    const r = this.root?.getBoundingClientRect();
    const view = r ? { top: r.top, height: r.height } : { top: 0, height: window.innerHeight };
    const boxes = cands.map((s) => { const b = s.el.getBoundingClientRect(); return { key: s.key, top: b.top, height: b.height }; });
    const win = new Set(pickPlaying(boxes, view, this.cap));
    this.playing.forEach((el) => { const s = this.slots.get(el); if (!s || !win.has(s.key)) this.pause(el); });
    for (const s of cands) {
      if (!win.has(s.key) || this.playing.has(s.el)) continue;
      this.playing.add(s.el);
      s.el.muted = true;
      s.el.play().catch(() => this.playing.delete(s.el));
    }
  }

  private pause(el: HTMLVideoElement) {
    this.playing.delete(el);
    if (!el.paused) el.pause();
  }

  /** Drop the src so the browser frees the decoder and buffered data; the tile shows its card colour until near again. */
  private release(s: Slot) {
    this.pause(s.el);
    if (!s.loaded) return;
    s.loaded = false;
    s.el.removeAttribute('src');
    s.el.preload = 'none';
    s.el.load();
  }
}
