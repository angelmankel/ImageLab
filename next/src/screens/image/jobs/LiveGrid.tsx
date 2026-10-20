/**
 * Item 4: several live previews at once, side by side / in a grid on the stage, each updating
 * live. A frame comes per server that is running an image job (`canvasStore.livePreviews`); a
 * batch's frame is a strip of its N pictures (ImageLabCore's batch preview), cut into N tiles with
 * CSS (no decode per tile). The grid picks the columns that make the tiles biggest
 * (`liveGridLogic.bestGrid`). Used by the stage only when there is more than one picture to show;
 * one picture keeps the stage's own zoomable image.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { bestGrid, stripBackground, stripCount } from './liveGridLogic';

export interface LiveFrame { key: string; url: string; n: number; aspect: number }

const NONE: LiveFrame[] = [];

/** The running image jobs' frames, when there is more than one picture to show (else none). */
export function useLiveFrames(enabled: boolean): LiveFrame[] {
  const previews = useCanvasStore((s) => s.livePreviews);
  const jobs = useStore((s) => s.jobs);
  return useMemo(() => {
    if (!enabled) return NONE;
    const out: LiveFrame[] = [];
    for (const j of jobs) {
      if (j.status !== 'running') continue;
      const url = previews[j.serverId];
      if (!url || out.some((f) => f.key === j.serverId)) continue;
      const w = j.workflow?.width || 1;
      const h = j.workflow?.height || 1;
      out.push({ key: j.serverId, url, n: Math.max(1, j.workflow?.batch ?? 1), aspect: w / h });
    }
    return out.length > 1 || (out[0]?.n ?? 1) > 1 ? out : NONE;
  }, [enabled, previews, jobs]);
}

export function LiveGrid({ frames }: { frames: LiveFrame[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** Pictures per frame, learnt from each frame's shape when it loads (strip or single). */
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles = frames.flatMap((f) => {
    const n = counts[f.key] ?? 1;
    return Array.from({ length: n }, (_, i) => ({ key: `${f.key}:${i}`, url: f.url, i, n, aspect: f.aspect }));
  });
  const aspect = frames[0]?.aspect ?? 1;
  const grid = bestGrid(tiles.length, aspect, size.w, size.h, 6);

  return (
    <div ref={box} aria-label={`${tiles.length} live previews`} style={{ position: 'absolute', inset: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {frames.map((f) => (
        <img key={f.key} src={f.url} alt="" hidden onLoad={(e) => {
          const c = stripCount(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight, f.n, f.aspect);
          setCounts((m) => (m[f.key] === c ? m : { ...m, [f.key]: c }));
        }} />
      ))}
      {grid.tileW > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grid.cols}, ${Math.floor(grid.tileW)}px)`, gap: 6 }}>
          {tiles.map((t) => (
            <div key={t.key} style={{ width: Math.floor(grid.tileW), height: Math.floor(grid.tileW / t.aspect), borderRadius: 6, backgroundColor: 'var(--il-card)', backgroundImage: `url("${t.url}")`, backgroundRepeat: 'no-repeat', ...stripBackground(t.i, t.n) }} />
          ))}
        </div>
      )}
    </div>
  );
}
