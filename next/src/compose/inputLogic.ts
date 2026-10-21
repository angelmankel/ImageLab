/**
 * Pure rules of the ONE input-image drop zone (fix list 41), tested in tests/compose.test.cjs:
 * the source choice's words (they say what they do: "My image" / "Last from 1" / "Pick from 1",
 * not Off / Auto · last / Pick), where a picture came from (the badge under the preview), a clean
 * display name (no ComfyUI subfolder, no "[input]"), and the slot's label without raw node names
 * ("Load Image #8" → "Input image").
 */

export type SourceMode = 'off' | 'auto' | 'pick';

export interface SourceChoice { key: SourceMode; label: string; sub: string; title: string }

/** The three ways a step 2+ gets its picture; `from` = the previous step's number (1-based). */
export function sourceChoices(from: number): SourceChoice[] {
  return [
    { key: 'off', label: 'My image', sub: 'upload / drop', title: 'Your own picture' },
    { key: 'auto', label: `Last from ${from}`, sub: 'newest result', title: `Always step ${from}'s newest result` },
    { key: 'pick', label: `Pick from ${from}`, sub: 'choose one', title: `One result of step ${from}` },
  ];
}

/** Where a picture came from. */
export type Origin = 'upload' | 'paste' | 'drop' | 'web' | 'history' | 'collection' | 'server' | 'canvas' | 'viewer' | 'model' | 'step';

export const ORIGIN_LABEL: Record<Origin, string> = {
  upload: 'Uploaded',
  paste: 'Pasted',
  drop: 'Dropped',
  web: 'From the web',
  history: 'From history',
  collection: 'From a collection',
  server: 'On the server',
  canvas: 'From the canvas',
  viewer: 'From the viewer',
  model: 'From a model',
  step: 'Sent from a step',
};

/** A drop's origin from what it carried: our payload's source, a file, or a foreign URL. */
export function originOfDrop(item: { kind: 'file' } | { kind: 'url'; url: string; payload: { source?: string } | null }): Origin {
  if (item.kind === 'file') return 'drop';
  const src = item.payload?.source;
  if (src === 'canvas' || src === 'history' || src === 'viewer' || src === 'model' || src === 'collection') return src;
  if (item.payload) return 'history';
  return /^(blob|data):/i.test(item.url) ? 'drop' : 'web';
}

/**
 * A short fingerprint of a picture value (a data URL, a /view URL, a server file name), so a
 * remembered origin is only shown while the slot still holds the same picture.
 */
export function valueRef(value: string | null | undefined): string {
  if (!value) return '';
  return value.length <= 96 ? value : `${value.length}:${value.slice(0, 48)}…${value.slice(-40)}`;
}

/** "subfolder/12345-portrait.png [input]" → "12345-portrait.png"; data / blob URLs → the fallback. */
export function displayName(name: string | null | undefined, fallback = 'image.png'): string {
  const s = String(name ?? '').trim();
  if (!s || /^(data|blob):/i.test(s)) return fallback;
  let out = s.replace(/\s*\[(input|output|temp)\]\s*$/i, '');
  if (/^https?:/i.test(out)) {
    try {
      const u = new URL(out);
      out = u.searchParams.get('filename') || decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '') || fallback;
    } catch { /* keep it */ }
  }
  return out.replace(/^.*[\\/]/, '') || fallback;
}

/** "Load Image" and friends are ComfyUI class names, not words Donny chose: hide them. */
const RAW_NODE = /^(load ?image|loadimage|image ?loader|load image \(.*\)|loadimagemask|load image mask)$/i;

/**
 * The label of a workflow's picture slot: the first one is "Input image"; another one keeps the
 * title it was given in ComfyUI, else "Picture N" (never "Load Image #8").
 */
export function slotLabel(nodeLabel: string | null | undefined, index: number): string {
  const t = String(nodeLabel ?? '').trim();
  const custom = t && !RAW_NODE.test(t) && !/^#?\d+$/.test(t);
  if (index === 0) return custom ? t : 'Input image';
  return custom ? t : `Picture ${index + 1}`;
}

/** `832 × 1216`, or '' when unknown. */
export const fmtDims = (w?: number | null, h?: number | null): string => (w && h ? `${w} × ${h}` : '');
