/**
 * A dropped / pasted / picked picture → bytes the app can use (fix list 42: "import from outside
 * must work whatever the drag carries"). A file is used as is. A URL is fetched directly first
 * (same origin, CORS-friendly hosts), then drawn through an <img crossOrigin> (hosts that allow
 * images but not fetch), then through the server's fetch proxy (`/imagelab/api/fetch?url=` on
 * ImageLabCore: for sites that allow neither, like most CDNs when the referer is foreign).
 */
import { useStore } from '@/lib/store';
import { comfyHttpFor } from '@/lib/comfyHost';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { nameFromUrl, type DropItem } from './payload';

export interface ImportedBlob { blob: Blob; name: string; /** Where it came from, when it came from a URL. */ sourceUrl?: string }

/** `{ dataUrl, name, width, height }`: what the Image step's `workflow.inputImage` holds. */
export type ImageState = { dataUrl: string; name: string; width: number; height: number };

const isLocal = (url: string) => url.startsWith('blob:') || url.startsWith('data:');

/** The server fetch proxy for a URL, or null when no server is set up. */
export function proxyUrl(url: string): string | null {
  const host = useStore.getState().servers[0]?.host;
  if (!host) return null;
  return `${comfyHttpFor(host)}/imagelab/api/fetch?${new URLSearchParams({ url })}`;
}

async function viaFetch(url: string): Promise<Blob> {
  const r = await fetch(url, { mode: 'cors', credentials: isLocal(url) || sameOrigin(url) ? 'include' : 'omit' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  if (blob.size === 0) throw new Error('empty');
  return blob;
}

function sameOrigin(url: string): boolean {
  try { return new URL(url, window.location.href).origin === window.location.origin; } catch { return false; }
}

async function viaCanvas(url: string): Promise<Blob> {
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image load failed'));
    i.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

/** Fetch a picture URL as a Blob, trying each route in turn. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const errors: string[] = [];
  const tries: Array<[string, () => Promise<Blob>]> = [['fetch', () => viaFetch(url)]];
  if (!isLocal(url)) tries.push(['image', () => viaCanvas(url)]);
  const proxy = isLocal(url) ? null : proxyUrl(url);
  if (proxy) tries.push(['server', () => viaFetch(proxy)]);
  for (const [how, go] of tries) {
    try { return await go(); } catch (e) { errors.push(`${how}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  throw new Error(`Could not fetch the picture (${errors.join('; ')})`);
}

/** A DropItem → Blob + name. */
export async function dropToBlob(item: DropItem): Promise<ImportedBlob> {
  if (item.kind === 'file') return { blob: item.file, name: item.name };
  const blob = await fetchImageBlob(item.url);
  const name = withExt(item.name || nameFromUrl(item.url), blob.type);
  return { blob, name, sourceUrl: item.url };
}

/** A DropItem → dataUrl + size (decoded in the browser). */
export async function dropToImageState(item: DropItem): Promise<ImageState> {
  const { blob, name } = await dropToBlob(item);
  return blobToImageState(blob, name);
}

/** Give a name the extension its bytes say when it has none (a CivitAI URL ends in a width, not a file). */
export function withExt(name: string, mime: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : mime === 'image/gif' ? 'gif' : 'png';
  return `${name || 'image'}.${ext}`;
}

/**
 * A drop as a step's input picture (`{ url, name }`, what `step.input` holds): one of the app's
 * own results keeps its server URL; a file, a blob: / data: URL or a picture from another site is
 * read now and kept as a data URL (a blob: URL dies with the page, a foreign URL may refuse a
 * later fetch).
 */
export async function dropToStepInput(item: DropItem): Promise<{ url: string; name: string }> {
  if (item.kind === 'url' && item.payload && /^https?:/i.test(item.url)) return { url: item.url, name: item.name };
  const st = await dropToImageState(item);
  return { url: st.dataUrl, name: st.name };
}
