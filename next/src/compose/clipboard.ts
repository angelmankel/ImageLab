/**
 * Paste on every picture slot (fix list 2 item 36: "a button to paste clipboard content into
 * dropzones ALWAYS"). Two ways in, one result (a `DropItem`, what a drop gives):
 *   - the Paste button → `readClipboard()`: navigator.clipboard.read() picture blobs first, then a
 *     link (uri-list / an <img> in HTML / plain text) that `dropToBlob` fetches like a dropped URL
 *     (L1 #42); readText() where read() is missing;
 *   - Ctrl+V → the `paste` event's clipboardData through the drop reader (`readDrop`).
 * When the clipboard holds nothing usable the result says why, in a few words, for an inline note
 * (no toast, item 12). Pure apart from `readClipboard` itself: tested in tests/paste.test.cjs.
 */
import { firstUrl, imgSrcFromHtml, nameFromUrl, type DropItem } from '~/dnd';

/** Why nothing was pasted. */
export type PasteMiss = 'empty' | 'text' | 'denied' | 'unsupported';

export type PasteResult = { item: DropItem } | { miss: PasteMiss };

export const PASTE_MISS: Record<PasteMiss, string> = {
  empty: 'No picture on the clipboard. Copy a picture or its link first.',
  text: 'The clipboard has text, not a picture or a link to one.',
  denied: 'The browser blocked the clipboard. Press Ctrl+V here instead.',
  unsupported: 'This browser cannot read the clipboard from a button. Press Ctrl+V here.',
};

/** The minimum of a ClipboardItem this reader needs (so it is testable). */
export interface ClipItemLike {
  types: readonly string[];
  getType: (type: string) => Promise<Blob>;
}

const extOf = (mime: string) => (mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png');

/** A picture blob as a File (pasted pictures have no name). */
export function pastedFile(blob: Blob, type = blob.type || 'image/png'): File {
  return new File([blob], `pasted.${extOf(type)}`, { type });
}

/** A link in pasted text as a URL item, or null. */
export function urlItem(text: string | null | undefined, html?: string | null): DropItem | null {
  const url = firstUrl(text) || imgSrcFromHtml(html);
  return url ? { kind: 'url', url, name: nameFromUrl(url), payload: null } : null;
}

/** ClipboardItems → the best thing in them: a picture blob, else a link, else why not. */
export async function fromClipboardItems(items: readonly ClipItemLike[]): Promise<PasteResult> {
  for (const it of items) {
    const type = it.types.find((t) => t.startsWith('image/'));
    if (type) {
      const blob = await it.getType(type);
      return { item: { kind: 'file', file: pastedFile(blob, type), name: `pasted.${extOf(type)}` } };
    }
  }
  const text = async (type: string) => {
    for (const it of items) if (it.types.includes(type)) { try { return await (await it.getType(type)).text(); } catch { /* next */ } }
    return '';
  };
  const plain = await text('text/plain');
  const item = urlItem((await text('text/uri-list')) || plain, await text('text/html'));
  if (item) return { item };
  return { miss: plain.trim() ? 'text' : 'empty' };
}

/** A clipboard read failure → why (a permission refusal says so, anything else = empty). */
export function missOfError(e: unknown): PasteMiss {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'DataError' || name === 'NotFoundError') return 'empty';
  return 'denied';
}

/** The Paste button: read the system clipboard now (needs a user gesture). */
export async function readClipboard(): Promise<PasteResult> {
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb) return { miss: 'unsupported' };
  try {
    if (typeof cb.read === 'function') return await fromClipboardItems(await cb.read());
    if (typeof cb.readText === 'function') {
      const t = await cb.readText();
      const item = urlItem(t);
      return item ? { item } : { miss: t.trim() ? 'text' : 'empty' };
    }
    return { miss: 'unsupported' };
  } catch (e) {
    return { miss: missOfError(e) };
  }
}
