/**
 * The app-wide drag payload (fix list 42): ONE in-app format for every picture that is dragged —
 * the canvas image, a history tile, the viewer, a model's preview, a Collection's picture — and
 * ONE reader for whatever a drop carries, from inside the app or from outside the window (a file,
 * a URL, text/uri-list, an HTML <img>, a blob: / data: URL). Pure: tested in tests/dnd.test.cjs.
 *
 *   Source  →  useImageDrag(payload)        sets MIME + text/uri-list + text/plain
 *   Target  →  useImageDrop({ onDrop })     gives you a DropItem (readDrop)
 *   Then    →  importImage.ts               a DropItem → Blob / dataUrl (CORS fallbacks)
 */

export const MIME = 'application/x-imagelab-image';

export type DragSource = 'canvas' | 'history' | 'viewer' | 'model' | 'collection' | 'input' | 'other';

export interface ImagePayload {
  v: 1;
  /** Where the picture can be fetched (a /view URL, an https URL, a blob: or data: URL). */
  url: string;
  /** A file name with its extension ("portrait_0012.png"). */
  name: string;
  kind: 'image' | 'video';
  /** The result's key (history id / run url) when the picture is one of the app's own results. */
  key?: string;
  /** The history entry id when it is an image result (lets a target reuse its prompt / settings). */
  entryId?: string;
  source?: DragSource;
}

/** What a drop resolved to. `file` came from the OS / clipboard; `url` from inside the app or another site. */
export type DropItem =
  | { kind: 'file'; file: File; name: string }
  | { kind: 'url'; url: string; name: string; payload: ImagePayload | null };

export function makePayload(p: Omit<ImagePayload, 'v' | 'kind'> & { kind?: 'image' | 'video' }): ImagePayload {
  return { v: 1, kind: p.kind ?? (isVideoName(p.name) ? 'video' : 'image'), ...p };
}

export const encodePayload = (p: ImagePayload): string => JSON.stringify(p);

/** Tolerant: the old `{ url, name }` shape (what the History panel set before) decodes too. */
export function decodePayload(json: string | null | undefined): ImagePayload | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Partial<ImagePayload>;
    if (!o || typeof o.url !== 'string' || !o.url) return null;
    const name = typeof o.name === 'string' && o.name ? o.name : nameFromUrl(o.url);
    const p: ImagePayload = { v: 1, url: o.url, name, kind: o.kind === 'video' ? 'video' : 'image' };
    if (typeof o.key === 'string') p.key = o.key;
    if (typeof o.entryId === 'string') p.entryId = o.entryId;
    if (typeof o.source === 'string') p.source = o.source;
    return p;
  } catch { return null; }
}

export const isVideoName = (name: string): boolean => /\.(mp4|webm|mov|m4v|gif)$/i.test(name);

/** A usable file name from a URL: the `filename` query (ComfyUI /view), else the last path segment, else image.png. */
export function nameFromUrl(url: string, fallback = 'image.png'): string {
  if (/^(data|blob):/i.test(url)) return fallback;
  try {
    const u = new URL(url, 'http://x/');
    const q = u.searchParams.get('filename');
    if (q) return q.split('/').pop() || fallback;
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
    if (seg && /\.[a-z0-9]{2,5}$/i.test(seg)) return seg;
    return seg ? `${seg}.png` : fallback;
  } catch { return fallback; }
}

const URL_RE = /^(https?:|blob:|data:)/i;

/** First http(s)/blob/data URL in a text/uri-list or plain text (comment lines start with #). */
export function firstUrl(text: string | null | undefined): string {
  if (!text) return '';
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith('#')) continue;
    if (URL_RE.test(s)) return s;
  }
  return '';
}

/** The `src` of the first <img> in an HTML fragment (what dragging a picture out of another tab carries). */
export function imgSrcFromHtml(html: string | null | undefined): string {
  if (!html) return '';
  const m = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(html);
  const src = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').replace(/&amp;/g, '&');
  return URL_RE.test(src) ? src : '';
}

/** The minimum of a DataTransfer / ClipboardData this reader needs (so it is testable). */
export interface TransferLike {
  types?: ArrayLike<string> | readonly string[];
  getData: (type: string) => string;
  files?: ArrayLike<File> | null;
}

/**
 * What a drop (or a paste) carries, best source first: our payload, then a picture file, then a
 * URL (uri-list / an <img> in HTML / plain text). Null = nothing we can use.
 */
export function readDrop(dt: TransferLike | null | undefined): DropItem | null {
  if (!dt) return null;
  const types = Array.from(dt.types ?? []);
  const has = (t: string) => types.includes(t);
  const get = (t: string) => { try { return dt.getData(t) || ''; } catch { return ''; } };
  if (has(MIME)) {
    const p = decodePayload(get(MIME));
    if (p) return { kind: 'url', url: p.url, name: p.name, payload: p };
  }
  const files = Array.from(dt.files ?? []);
  const file = files.find((f) => f.type.startsWith('image/') || f.type.startsWith('video/') || /\.(png|jpe?g|webp|gif|avif|bmp|mp4|webm)$/i.test(f.name));
  if (file) return { kind: 'file', file, name: file.name || 'image.png' };
  const url = firstUrl(get('text/uri-list')) || imgSrcFromHtml(get('text/html')) || firstUrl(get('text/plain'));
  if (url) return { kind: 'url', url, name: nameFromUrl(url), payload: null };
  return null;
}

/** True when a drag could be a picture (ours, a file, a URL, an <img>) — for highlighting targets before the drop. */
export function mayCarryImage(types: ArrayLike<string> | readonly string[] | null | undefined): boolean {
  const t = Array.from(types ?? []);
  return t.includes(MIME) || t.includes('Files') || t.includes('text/uri-list') || t.includes('text/html');
}
