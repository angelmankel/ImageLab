/**
 * The width / height of a picture or a clip at a URL, read off screen, so the phone's stage can
 * take exactly the shape of what it shows (full width, no padding, never cropped). Null until
 * known, and for a URL that cannot be read.
 */
import { useEffect, useState } from 'react';

const cache = new Map<string, number>();

export function useMediaAspect(url: string | null | undefined, kind: 'image' | 'video' = 'image'): number | null {
  const [ratio, setRatio] = useState<number | null>(() => (url && cache.get(url)) || null);
  useEffect(() => {
    if (!url) { setRatio(null); return; }
    const known = cache.get(url);
    if (known) { setRatio(known); return; }
    let alive = true;
    const done = (w: number, h: number) => {
      if (!alive || !(w > 0) || !(h > 0)) return;
      const r = w / h;
      // Blob and data URLs (live preview frames) are one-offs; do not fill the cache with them.
      if (!/^(blob|data):/.test(url)) cache.set(url, r);
      setRatio(r);
    };
    if (kind === 'video') {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => { done(v.videoWidth, v.videoHeight); v.removeAttribute('src'); };
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.src = url;
    }
    return () => { alive = false; };
  }, [url, kind]);
  return ratio;
}
