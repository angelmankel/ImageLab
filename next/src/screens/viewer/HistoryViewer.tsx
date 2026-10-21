/**
 * Item 30: the viewer over the image history (the stage's and the phone Output page's
 * `openViewer()`), in place of the old `FullscreenViewer`. Pages the same list the history shows,
 * keeps the store's selection in step, and shows the running job's frame (LIVE) when the live
 * preview is on and a job streams one.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useSessionImageResults } from '~/app/outputs';
import { useLiveFrame } from '@/features/history/FullscreenViewer';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { ImageViewer } from './ImageViewer';
import type { ViewerItem } from './types';

export function HistoryViewer({ onClose, showLive = false }: { onClose: () => void; showLive?: boolean }) {
  const images = useSessionImageResults(); // this session's pictures (fix list 2, item 9)
  const selected = useStore((s) => s.selectedEntry);
  const select = useStore((s) => s.selectHistoryEntry);
  const liveFrame = useLiveFrame();
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const items = useMemo<ViewerItem[]>(() => images.map((r) => ({ key: r.key, url: r.url, kind: r.kind, filename: r.filename, createdAt: r.createdAt, durationMs: r.durationMs, entry: r.entry })), [images]);
  const index = Math.max(0, items.findIndex((it) => it.key === (selected?.id ?? items[0]?.key)));
  const liveUrl = showLive && livePreview ? liveFrame : null;
  if (!items.length && !liveUrl) return null;
  return <ImageViewer items={items} index={index} onIndexChange={(i) => { const e = items[i]?.entry; if (e) select(e); }} onClose={onClose} liveUrl={liveUrl} />;
}
