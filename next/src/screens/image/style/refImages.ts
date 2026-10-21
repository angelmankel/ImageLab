/**
 * Style tab: turning a dropped / pasted / picked picture into a reference picture. The picture is
 * scaled to at most 1536 px on its long edge (IP-Adapter looks at 224 px, faces at ~640: plenty),
 * stored in IndexedDB under a hash of its bytes (`@/lib/styleRefImages`), and given a 160 px JPEG
 * thumbnail that rides in the workflow (bubble, history, metadata). `useRefImageUrl` shows the
 * stored picture (an object URL), falling back to the thumbnail.
 */
import { useEffect, useState } from 'react';
import { blobKey, getStyleImage, putStyleImage } from '@/lib/styleRefImages';
import type { StyleRefImage } from '@/lib/styleRefs';

const MAX_EDGE = 1536;
const THUMB = 160;

async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function draw(bmp: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the picture'))), type, q));

/** Store a picture as a reference picture; returns what the workflow keeps. */
export async function storeRefImage(blob: Blob, name: string): Promise<StyleRefImage> {
  const bmp = await decode(blob);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    // Keep a small PNG / JPEG as is; re-encode anything big or exotic as JPEG.
    const keep = scale === 1 && (blob.type === 'image/png' || blob.type === 'image/jpeg') && blob.size < 4_000_000;
    const stored = keep ? blob : await toBlob(draw(bmp, w, h), 'image/jpeg', 0.92);
    const key = await blobKey(stored);
    await putStyleImage(key, stored);
    const ts = Math.min(1, THUMB / Math.max(bmp.width, bmp.height));
    const thumb = draw(bmp, Math.max(1, Math.round(bmp.width * ts)), Math.max(1, Math.round(bmp.height * ts))).toDataURL('image/jpeg', 0.8);
    return { key, name: name || 'reference.jpg', width: w, height: h, thumb };
  } finally {
    bmp.close();
  }
}

const urls = new Map<string, string>();

/** The stored picture as an object URL (cached per key), or the thumbnail while it loads / when it is gone. */
export function useRefImageUrl(img: StyleRefImage | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (img ? urls.get(img.key) ?? img.thumb : null));
  useEffect(() => {
    if (!img) { setUrl(null); return; }
    const hit = urls.get(img.key);
    if (hit) { setUrl(hit); return; }
    setUrl(img.thumb);
    let live = true;
    void getStyleImage(img.key).then((b) => {
      if (!b || !live) return;
      const u = URL.createObjectURL(b);
      urls.set(img.key, u);
      setUrl(u);
    });
    return () => { live = false; };
  }, [img?.key, img?.thumb]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

/** Whether the stored picture is still in this browser (a reference copied from another device has only its thumbnail). */
export function useRefImageStored(key: string | undefined): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!key) { setOk(null); return; }
    let live = true;
    void getStyleImage(key).then((b) => { if (live) setOk(!!b); });
    return () => { live = false; };
  }, [key]);
  return ok;
}
