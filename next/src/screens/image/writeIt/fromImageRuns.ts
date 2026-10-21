/**
 * "Snippets from a picture" (fix list 2, ADDED after close): the state and the vision call, per
 * session and outside the window, like the prompt studio's `studioRuns`. The active provider's
 * vision model (`visionModelOf`) looks at the picture and writes N snippet candidates (name, text,
 * category) plus, optionally, one overall "Style" snippet. Closing the window never stops it; a
 * result that lands while the window is closed is `fresh` (the badge), cleared on open.
 * Open it from anywhere with `openSnippetsFromImage({ url | blob, categoryId })`.
 */
import { create } from 'zustand';
import { useStore } from '@/lib/store';
import { aiChat, blobToDataUrl, visionModelOf } from '@/lib/ai';
import type { SnippetCategory } from '@/lib/types';
import { fetchImageBlob } from '~/dnd';
import { isModelSpecific } from '../prompt/promptSearch';
import { addSnippets, snippetPicture } from '../snippets/snippetOps';
import { imageSnippetSystem, imageSnippetUser, matchCategory, parseImageSnippets } from './studioLogic';
import { sessionNow } from './studioRuns';

export const AUTO = 'auto';
const UNCAT = 'uncategorized';

export interface FromImageRow { key: string; name: string; text: string; categoryId: string; keep: boolean; style?: boolean }

export interface FromImageJob {
  image: { url: string; name: string } | null;
  hint: string;
  /** A category id, or AUTO = the model picks per snippet. */
  categoryId: string;
  count: number;
  withStyle: boolean;
  usePicture: boolean;
  running: boolean;
  error?: string;
  rows: FromImageRow[];
  fresh: boolean;
}

const BLANK: FromImageJob = Object.freeze({ image: null, hint: '', categoryId: AUTO, count: 6, withStyle: true, usePicture: true, running: false, rows: [], fresh: false }) as FromImageJob;

interface State { bySession: Record<string, FromImageJob>; openFor: string | null }
const useFromImage = create<State>(() => ({ bySession: {}, openFor: null }));
const ctrls = new Map<string, AbortController>();
let seq = 0;

export function useFromImageJob(sessionId: string): FromImageJob {
  return useFromImage((s) => s.bySession[sessionId] ?? BLANK);
}
export function useFromImageOpen(): string | null {
  return useFromImage((s) => s.openFor);
}
/** The badge: writing, and how many candidates wait unseen. */
export function useFromImageBadge(sessionId: string): { running: boolean; fresh: number } {
  const running = useFromImage((s) => !!s.bySession[sessionId]?.running);
  const fresh = useFromImage((s) => (s.bySession[sessionId]?.fresh ? s.bySession[sessionId].rows.length : 0));
  return { running, fresh };
}

export function patchJob(sessionId: string, patch: Partial<FromImageJob> | ((j: FromImageJob) => Partial<FromImageJob>)): void {
  useFromImage.setState((s) => {
    const cur = s.bySession[sessionId] ?? BLANK;
    const p = typeof patch === 'function' ? patch(cur) : patch;
    return { bySession: { ...s.bySession, [sessionId]: { ...cur, ...p } } };
  });
}

/** A picture shrunk for the vision model (max side 1024, JPEG) as a data URL. */
export async function shrinkForVision(blob: Blob, max = 1024): Promise<string> {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return c.toDataURL('image/jpeg', 0.9);
  } catch {
    return blobToDataUrl(blob);
  }
}

export async function setJobImage(sessionId: string, blob: Blob, name: string): Promise<void> {
  const url = await shrinkForVision(blob);
  patchJob(sessionId, { image: { url, name }, error: undefined });
}

export function closeSnippetsFromImage(): void {
  useFromImage.setState({ openFor: null });
}

/** Open the window for the open session, optionally with a picture and / or a target category. */
export function openSnippetsFromImage(opts: { url?: string; blob?: Blob; name?: string; categoryId?: string } = {}): void {
  const sid = sessionNow();
  useFromImage.setState((s) => {
    const cur = s.bySession[sid] ?? BLANK;
    return { openFor: sid, bySession: { ...s.bySession, [sid]: { ...cur, fresh: false, ...(opts.categoryId ? { categoryId: opts.categoryId } : {}) } } };
  });
  const name = opts.name ?? 'picture';
  if (opts.blob) void setJobImage(sid, opts.blob, name);
  else if (opts.url) {
    fetchImageBlob(opts.url)
      .then((b) => setJobImage(sid, b, name))
      .catch((e) => patchJob(sid, { error: `Could not load that picture: ${e instanceof Error ? e.message : String(e)}` }));
  }
}

/** The categories the model may use: positive, not model-specific. */
export function pickableCategories(cats: SnippetCategory[]): SnippetCategory[] {
  return cats.filter((c) => !c.id.startsWith('neg-') && !isModelSpecific({ id: '', categoryId: c.id }));
}
export const cleanCatName = (n: string) => n.replace(/^[^\p{L}\p{N}]+/u, '').trim();

/** Ask the vision model. Runs in the background; the window may close meanwhile. */
export async function runFromImage(sessionId: string): Promise<void> {
  const job = useFromImage.getState().bySession[sessionId] ?? BLANK;
  if (!job.image || job.running) return;
  ctrls.get(sessionId)?.abort();
  const ctrl = new AbortController();
  ctrls.set(sessionId, ctrl);
  const st = useStore.getState();
  const settings = st.ai;
  const cats = pickableCategories(st.snippetCategories);
  const target = job.categoryId !== AUTO ? cats.find((c) => c.id === job.categoryId) ?? null : null;
  patchJob(sessionId, { running: true, error: undefined, rows: [] });
  try {
    const raw = await aiChat({
      settings, model: visionModelOf(settings), signal: ctrl.signal, noThinking: true, temperature: 0.7, maxTokens: 140 * (job.count + 1) + 300,
      messages: [
        { role: 'system', content: imageSnippetSystem(settings.promptStyle, target ? [] : cats.map((c) => cleanCatName(c.name)), job.withStyle) },
        { role: 'user', content: [
          { type: 'text', text: imageSnippetUser({ count: job.count, hint: job.hint, category: target ? cleanCatName(target.name) : null }) },
          { type: 'image_url', image_url: { url: job.image.url } },
        ] },
      ],
    });
    if (ctrl.signal.aborted) return;
    const ideas = parseImageSnippets(raw, target ? cleanCatName(target.name) : '');
    if (!ideas.length) throw new Error('The AI returned nothing usable — try again or change the hint.');
    const styleId = cats.find((c) => c.id === 'style')?.id ?? null;
    const rows: FromImageRow[] = ideas.slice(0, job.count + (job.withStyle ? 1 : 0)).map((i) => ({
      key: `f${++seq}`, name: i.name, text: i.text, keep: true, style: i.style,
      categoryId: i.style ? (styleId ?? target?.id ?? UNCAT) : target?.id ?? matchCategory(i.category, cats) ?? UNCAT,
    }));
    patchJob(sessionId, { running: false, rows, fresh: useFromImage.getState().openFor !== sessionId });
  } catch (e) {
    if (!ctrl.signal.aborted) patchJob(sessionId, { running: false, error: e instanceof Error ? e.message : 'Failed' });
  } finally {
    if (ctrls.get(sessionId) === ctrl) ctrls.delete(sessionId);
  }
}

/** Save the ticked rows as one undo step (with the picture as their preview when asked). */
export async function saveFromImage(sessionId: string): Promise<number> {
  const job = useFromImage.getState().bySession[sessionId] ?? BLANK;
  const kept = job.rows.filter((r) => r.keep && r.text.trim());
  if (!kept.length) return 0;
  let image: string | undefined;
  if (job.usePicture && job.image) {
    try { image = await snippetPicture(await (await fetch(job.image.url)).blob()); } catch { image = undefined; }
  }
  addSnippets(kept.map((r) => ({ name: r.name, text: r.text, categoryId: r.categoryId, kind: 'positive', ...(image ? { image } : {}) })));
  patchJob(sessionId, { rows: [], fresh: false });
  return kept.length;
}
