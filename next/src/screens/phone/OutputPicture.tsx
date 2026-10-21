/**
 * The Output page's picture (rule 11): the step's current result, full width, its own aspect
 * (capped so the strip below stays in reach), nothing over it.
 *   A picture (or a live frame) is the main app's swipeable hero (`HeroResult` bare: swipe left /
 *   right = next / previous result) and a TAP opens the original fullscreen viewer straight away —
 *   the viewer grows out of this picture (`data-viewer-origin`).
 *   A clip is the stage's `StagePlayer` in phone mode: the clip in the same box, its controls row
 *   (44px) under it, a tap opens the touch fullscreen player (`VideoFullscreen`: drag to seek,
 *   rotate) and carries on where it left off, a sideways swipe pages results.
 * While the picture can page it is `data-no-swipe`, so its sideways swipes never change the step.
 */
import { useState } from 'react';
import { HeroResult } from '@/components/blocks/HeroResult';
import { VideoFullscreen } from '@/components/VideoFullscreen';
import { useMediaAspect } from '@/hooks/useMediaAspect';
import type { ResultItem } from '@/lib/workspace';
import { StagePlayer } from '~/screens/image/player';
import { LiveGrid, useLiveFrames } from '~/screens/image/jobs/LiveGrid';
import { FrameImage } from '~/screens/image/frame/FrameImage';
import { dvh, vw } from '~/theme/uiScale';
import { CompareView } from '~/screens/image/CompareView';
import { compareIndex } from '~/screens/image/compareLogic';
import { useStage } from '~/screens/image/stageStore';

export function OutputPicture({ items, currentKey, onPick, onOpen, live, busy, status, fallbackAspect, empty, liveGrid = false, compare = false, sourceKey = null, fill = false }: {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
  live: string | null;
  busy: boolean;
  status?: string | null;
  fallbackAspect: number;
  /** Image step: a batch's / several servers' live previews show as a grid (item 4). */
  liveGrid?: boolean;
  empty: string;
  /** Compare may split the picture (the Output actions' Compare is on and 2+ pictures). */
  compare?: boolean;
  /** Compare's default Before: the picture a derived result came from. */
  sourceKey?: string | null;
  /** Fill the parent's height (the landscape main pane) instead of full width at its aspect. */
  fill?: boolean;
}) {
  const current = items.find((i) => i.key === currentKey) ?? null;
  const size = (a: number): React.CSSProperties => (fill
    ? { width: '100%', height: '100%', flex: 1, minHeight: 0 }
    : { width: '100%', aspectRatio: String(a || 1), maxHeight: dvh(68), flex: 'none' });
  const shown = live ?? current?.url ?? null;
  const isClip = !live && current?.kind === 'video';
  const measured = useMediaAspect(shown, isClip ? 'video' : 'image');
  const aspect = measured ?? fallbackAspect;
  const canPage = items.length > 1 && !live;
  const [full, setFull] = useState<{ url: string; time: number } | null>(null);
  const [resume, setResume] = useState<{ time: number; nonce: number } | null>(null);
  const liveFrames = useLiveFrames(liveGrid && !!live);
  const compareOn = useStage((st) => st.compare);
  const compareKey = useStage((st) => st.compareKey);
  const shownAt = current ? items.indexOf(current) : -1;
  const other = compare && compareOn && !live && current?.kind === 'image' && shownAt >= 0 ? compareIndex(items, shownAt, compareKey, sourceKey) : -1;

  // Compare (the desktop toolbar's split view, touch version): its own 48 px row on top, then the split.
  if (other >= 0) {
    return (
      <div data-no-swipe style={{ width: '100%', flex: 'none', display: 'flex', flexDirection: 'column', height: fill ? '100%' : `calc(min(${vw(100)} / ${aspect || 1}, ${dvh(68)}) + 48px)` }}>
        <CompareView items={items} shown={shownAt} other={other} />
      </div>
    );
  }

  if (liveFrames.length) {
    return (
      <div onClick={() => onOpen(currentKey ?? '')} style={{ position: 'relative', ...size(fallbackAspect), overflow: 'hidden', background: 'var(--il-bg)' }}>
        <LiveGrid frames={liveFrames} />
      </div>
    );
  }

  // Item 41: a live frame never flashes: the old one stays until the next decoded, then a quick cross-fade.
  if (live) {
    return (
      <div onClick={() => onOpen(currentKey ?? '')} aria-label="Live preview" style={{ position: 'relative', ...size(aspect), overflow: 'hidden', background: 'var(--il-bg)' }}>
        <FrameImage src={live} fade imgProps={{ draggable: false }} />
      </div>
    );
  }

  if (isClip && current) {
    const index = items.indexOf(current);
    const swipe = (dir: 1 | -1) => { const it = items[index + dir]; if (it) onPick(it.key); };
    const openFull = (time: number) => setFull({ url: current.url, time });
    return (
      <div data-no-swipe={canPage ? '' : undefined} style={fill ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } : { width: '100%', flex: 'none' }}>
        <StagePlayer
          phone
          src={current.url}
          name={current.filename}
          busy={busy}
          statusLine={status ?? null}
          progress={null}
          onFullscreen={() => openFull(0)}
          canFullscreen
          onTap={openFull}
          onSwipe={swipe}
          resumeAt={resume}
          clipStyle={size(aspect)}
          style={fill ? { flex: 1, minHeight: 0 } : { flex: 'none' }}
        />
        {full && (
          <VideoFullscreen url={full.url} startTime={full.time} onClose={(t) => { setFull(null); setResume((r) => ({ time: t, nonce: (r?.nonce ?? 0) + 1 })); }} />
        )}
      </div>
    );
  }

  return (
    <div
      data-no-swipe={canPage ? '' : undefined}
      style={{ position: 'relative', ...size(aspect), overflow: 'hidden', background: 'var(--il-bg)' }}
    >
      <HeroResult
        bare
        hideProgress
        slideOnlyOnDrag
        items={items}
        currentKey={currentKey}
        onPick={onPick}
        preview={live}
        busy={busy}
        statusLine={status ?? undefined}
        onOpen={(it) => onOpen(it.key)}
        empty={empty}
      />
    </div>
  );
}
