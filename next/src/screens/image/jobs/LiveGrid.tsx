/**
 * Item 4: several live previews at once, side by side / in a grid on the stage, each updating
 * live. A frame comes per server that is running an image job (`canvasStore.livePreviews`); a
 * batch's frame is a strip of its N pictures (ImageLabCore's batch preview), cut into N tiles with
 * CSS (no decode per tile). The grid picks the columns that make the tiles biggest
 * (`liveGridLogic.bestGrid`). Used by the stage only when there is more than one picture to show;
 * one picture keeps the stage's own zoomable image.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { isJobOfSession, useOutputs } from '~/app/outputs';
import { useSessions } from '~/app/sessionsStore';
import { bestGrid, stripBackground, stripCount } from './liveGridLogic';
import { useArrive, useFrameLayers } from '../frame/FrameImage';

export interface LiveFrame { key: string; url: string; n: number; aspect: number }

const NONE: LiveFrame[] = [];

/** The running image jobs' frames, when there is more than one picture to show (else none). */
export function useLiveFrames(enabled: boolean): LiveFrame[] {
  const previews = useCanvasStore((s) => s.livePreviews);
  const jobs = useStore((s) => s.jobs);
  const sessionId = useSessions((s) => s.currentId);
  const owners = useOutputs((s) => s.jobs);
  return useMemo(() => {
    if (!enabled) return NONE;
    const out: LiveFrame[] = [];
    for (const j of jobs) {
      // Another session's job never paints this session's stage (fix list 2, item 15).
      if (j.status !== 'running' || !isJobOfSession(j.id, sessionId, owners)) continue;
      const url = previews[j.serverId];
      if (!url || out.some((f) => f.key === j.serverId)) continue;
      const w = j.workflow?.width || 1;
      const h = j.workflow?.height || 1;
      out.push({ key: j.serverId, url, n: Math.max(1, j.workflow?.batch ?? 1), aspect: w / h });
    }
    return out.length > 1 || (out[0]?.n ?? 1) > 1 ? out : NONE;
  }, [enabled, previews, jobs, sessionId, owners]);
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

  const total = frames.reduce((n, f) => n + (counts[f.key] ?? 1), 0);
  const aspect = frames[0]?.aspect ?? 1;
  const grid = bestGrid(total, aspect, size.w, size.h, 6);
  const onCount = useCallback((key: string, c: number) => setCounts((m) => (m[key] === c ? m : { ...m, [key]: c })), []);

  return (
    <div ref={box} aria-label={`${total} live previews`} style={{ position: 'absolute', inset: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: grid.tileW > 0 ? 'grid' : 'none', gridTemplateColumns: `repeat(${grid.cols}, ${Math.floor(grid.tileW)}px)`, gap: 6 }}>
        {frames.map((f) => <FrameTiles key={f.key} frame={f} n={counts[f.key] ?? 1} tileW={Math.floor(grid.tileW)} onCount={onCount} />)}
      </div>
    </div>
  );
}

/**
 * Item 41: one server's tiles. A new frame decodes off screen first, then cross-fades in over the
 * old one on every tile at once (`useFrameLayers` / `useArrive`); never an empty tile in between.
 */
function FrameTiles({ frame: f, n, tileW, onCount }: { frame: LiveFrame; n: number; tileW: number; onCount: (key: string, c: number) => void }) {
  const layers = useFrameLayers(f.url, (w, h) => onCount(f.key, stripCount(w, h, f.n, f.aspect)));
  const arrive = useArrive(layers, true);
  const top = layers.shown[layers.shown.length - 1];
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'relative', width: tileW, height: Math.floor(tileW / f.aspect), borderRadius: 6, overflow: 'hidden', backgroundColor: 'var(--il-card)' }}>
          {layers.shown.map((l) => (
            <div key={l.id} ref={l === top ? arrive : undefined}
              style={{ position: 'absolute', inset: 0, backgroundImage: `url("${l.url}")`, backgroundRepeat: 'no-repeat', ...stripBackground(i, n) }} />
          ))}
        </div>
      ))}
    </>
  );
}
