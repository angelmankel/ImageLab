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

export function OutputPicture({ items, currentKey, onPick, onOpen, live, busy, status, fallbackAspect, empty }: {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
  live: string | null;
  busy: boolean;
  status?: string | null;
  fallbackAspect: number;
  empty: string;
}) {
  const current = items.find((i) => i.key === currentKey) ?? null;
  const shown = live ?? current?.url ?? null;
  const isClip = !live && current?.kind === 'video';
  const measured = useMediaAspect(shown, isClip ? 'video' : 'image');
  const aspect = measured ?? fallbackAspect;
  const canPage = items.length > 1 && !live;
  const [full, setFull] = useState<{ url: string; time: number } | null>(null);
  const [resume, setResume] = useState<{ time: number; nonce: number } | null>(null);

  if (isClip && current) {
    const index = items.indexOf(current);
    const swipe = (dir: 1 | -1) => { const it = items[index + dir]; if (it) onPick(it.key); };
    const openFull = (time: number) => setFull({ url: current.url, time });
    return (
      <div data-no-swipe={canPage ? '' : undefined} style={{ width: '100%', flex: 'none' }}>
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
          clipStyle={{ flex: 'none', width: '100%', aspectRatio: String(aspect || 1), maxHeight: '68dvh' }}
          style={{ flex: 'none' }}
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
      style={{ position: 'relative', width: '100%', aspectRatio: String(aspect || 1), maxHeight: '68dvh', flex: 'none', overflow: 'hidden', background: 'var(--il-bg)' }}
    >
      <HeroResult
        bare
        hideProgress
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
