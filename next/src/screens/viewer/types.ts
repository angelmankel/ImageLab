/** Item 30: one picture the viewer pages through — a history image (with its entry) or a run result. */
import type { HistoryEntry } from '@/lib/types';
import type { CivitaiImageMeta } from '@/lib/civitai';

/**
 * List-2 item 31: a picture from outside the history (a CivitAI sample in the model viewer). No
 * favourite / delete / Remove BG; the Details tab shows its generation data with Use prompt /
 * Reuse settings; `nsfw` covers it until a tap (the caller applies the opt-in rules, item 27).
 */
export interface ExternalMeta {
  meta: CivitaiImageMeta | null;
  width?: number;
  height?: number;
  /** Cover it ("NSFW · tap to show") until the user taps. */
  nsfw?: boolean;
  /** Where it comes from, shown in the top bar / panel (e.g. the model's name). */
  source?: string;
  /** A page to open it at (e.g. the CivitAI image page). */
  link?: string;
}

export interface ViewerItem {
  key: string;
  url: string;
  kind: 'image' | 'video';
  filename: string;
  createdAt?: number;
  durationMs?: number;
  /** The history entry for an image result (prompt, settings, favourite); run results have none. */
  entry?: HistoryEntry | null;
  /** Set for an external picture (item 31). */
  external?: ExternalMeta;
}
