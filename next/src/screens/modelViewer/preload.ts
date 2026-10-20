/**
 * Warm the browser's image + decoded-bitmap caches for the samples around the shown one, so
 * paging feels instant (Donny, 10-19: "can we preload images in the fullscreen model viewer?").
 * One `new Image()` + `decode()` per URL, remembered in a module-level map so a URL is never
 * asked for twice; at most `AT_ONCE` neighbours in flight, the rest queue. The shown picture
 * itself is `urgent` and skips the queue. Videos are never preloaded (the clip plays itself).
 */
import { useEffect } from 'react';
import { neighbourOrder } from './modelViewerLogic';

const AT_ONCE = 4;
const MAX_REMEMBERED = 300;
const started = new Map<string, Promise<void>>();
const queue: Array<() => void> = [];
let active = 0;

const isVideo = (u: string) => /\.(mp4|webm|mov)(\?|&|$)/i.test(u);

function run(url: string, resolve: () => void) {
  active++;
  const img = new Image();
  img.decoding = 'async';
  const done = () => { active--; resolve(); queue.shift()?.(); };
  img.onload = () => { img.decode().catch(() => undefined).then(done); };
  img.onerror = done;
  img.src = url;
}

/** Fetch and decode `url` off screen; the same promise for the same URL every time. */
export function preloadImage(url: string, urgent = false): Promise<void> {
  if (!url || isVideo(url)) return Promise.resolve();
  const hit = started.get(url);
  if (hit) return hit;
  if (started.size >= MAX_REMEMBERED) started.clear();
  const p = new Promise<void>((resolve) => {
    if (urgent || active < AT_ONCE) run(url, resolve);
    else queue.push(() => run(url, resolve));
  });
  started.set(url, p);
  return p;
}

/**
 * Resolves when `url` is decoded, or after `capMs` — whichever is first — so a swap can wait for
 * a warm picture without ever holding paging up on a cold one.
 */
export function whenReady(url: string, capMs: number): Promise<void> {
  const p = preloadImage(url, true);
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, capMs);
    p.then(() => { clearTimeout(t); resolve(); });
  });
}

/** Keep the pictures around `index` decoded (nearest first; '' entries — clips — are skipped). */
export function usePreloadAround(urls: readonly string[], index: number, radius = 2) {
  useEffect(() => {
    for (const i of neighbourOrder(index, urls.length, radius)) {
      const u = urls[i];
      if (u) void preloadImage(u, i === index);
    }
  }, [urls, index, radius]);
}
