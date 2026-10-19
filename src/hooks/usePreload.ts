import { useEffect } from 'react';

/** URLs already asked for, so a swipe back and forth never refetches or re-decodes. Bounded. */
const seen = new Set<string>();
const MAX = 300;

const isVideo = (u: string) => /\.(mp4|webm|mov)(\?|&|$)/i.test(u);

/** Fetch and decode one image off screen; videos are left to their own `<video preload>`. */
export function preloadImage(url: string) {
  if (!url || seen.has(url) || isVideo(url)) return;
  if (seen.size >= MAX) seen.clear();
  seen.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  // decode() keeps the bitmap warm in the image cache, so the slide never pops in blank.
  img.decode().catch(() => { /* a broken or cross-origin-blocked image still counts as tried */ });
}

/**
 * Keep the results around `index` decoded, `radius` to each side: the immediate neighbours are
 * already in the DOM as slides, the ones past them get a hidden fetch so a quick run of swipes
 * never waits on the network.
 */
export function usePreloadAround(urls: readonly string[], index: number, radius = 2) {
  useEffect(() => {
    for (let d = 1; d <= radius; d++) {
      const a = urls[index + d];
      const b = urls[index - d];
      if (a) preloadImage(a);
      if (b) preloadImage(b);
    }
  }, [urls, index, radius]);
}
