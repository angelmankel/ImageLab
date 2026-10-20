/**
 * The small badge at the left end of the toolbar row (Donny, 10-20): the shown picture's real
 * pixel size and how long it took to generate, "1024×1536 · 12.3 s". It sits in the toolbar's
 * own row, never over the picture (rule 1). The size is read from the file itself (an Image /
 * video element off screen), so Loopback growth and upscales show their true result.
 */
import { useEffect, useState } from 'react';
import type { ResultItem } from '@/lib/workspace';

const sizes = new Map<string, string>();

function readSize(item: ResultItem, done: (s: string) => void): () => void {
  const hit = sizes.get(item.url);
  if (hit) { done(hit); return () => {}; }
  let alive = true;
  const finish = (w: number, h: number) => { if (!alive || !w || !h) return; const s = `${w}×${h}`; sizes.set(item.url, s); done(s); };
  if (item.kind === 'video') {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => finish(v.videoWidth, v.videoHeight);
    v.src = item.url;
    return () => { alive = false; v.removeAttribute('src'); v.load(); };
  }
  const img = new Image();
  img.onload = () => finish(img.naturalWidth, img.naturalHeight);
  img.src = item.url;
  return () => { alive = false; };
}

/** "12.3 s" / "1 m 05 s" from ms. */
export function fmtTook(ms: number | undefined): string | null {
  if (!ms || ms < 0) return null;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} m ${String(Math.round(s - m * 60)).padStart(2, '0')} s`;
}

export function StageBadge({ item }: { item: ResultItem | null }) {
  const [size, setSize] = useState<string | null>(item ? sizes.get(item.url) ?? null : null);
  useEffect(() => {
    if (!item) { setSize(null); return; }
    setSize(sizes.get(item.url) ?? null);
    return readSize(item, setSize);
  }, [item]);
  if (!item) return null;
  const took = fmtTook(item.durationMs);
  const text = [size, took].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <span title={took ? `${size ?? ''} · generated in ${took}` : size ?? undefined}
      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', pointerEvents: 'none' }}>
      {text}
    </span>
  );
}
