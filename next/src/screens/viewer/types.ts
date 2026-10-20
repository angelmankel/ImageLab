/** Item 30: one picture the viewer pages through — a history image (with its entry) or a run result. */
import type { HistoryEntry } from '@/lib/types';

export interface ViewerItem {
  key: string;
  url: string;
  kind: 'image' | 'video';
  filename: string;
  createdAt?: number;
  durationMs?: number;
  /** The history entry for an image result (prompt, settings, favourite); run results have none. */
  entry?: HistoryEntry | null;
}
