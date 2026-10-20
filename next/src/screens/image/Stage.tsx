/**
 * Rule 1 + 7: the stage. The toolbar is its own 52px row; the picture gets the rest, centred,
 * `object-fit: contain`, nothing over it. Pan and zoom (`useStageZoom`: wheel, trackpad pinch,
 * two-finger pinch, drag), a click or tap that did not move opens the fullscreen viewer: the
 * original ImageLab viewer with the history pager for images
 * (`FullscreenViewer`), `FullscreenImage` for video / workflow results. The live preview replaces
 * the picture while this step's job runs; its progress is a thin line under the toolbar row.
 * A video result (or a video step's live render) goes to `StagePlayer`: the clip fills the same
 * box, its controls are their own 44px row under it (rule 1), ←/→ seek there instead of paging.
 * Delete / Backspace (desktop, no overlay, not in a text box) deletes the shown result with Undo.
 * No animation anywhere (Donny, 10-20): the viewers open, close and seek on the spot (`instant`),
 * a finished image replaces the picture at once (a keyed `<img>`, no slide).
 */
import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { FullscreenImage } from '@/components/FullscreenImage';
import { FullscreenViewer } from '@/features/history/FullscreenViewer';
import type { Step } from '~/app/stepsStore';
import { useStageMedia } from './useStageMedia';
import { useStageZoom } from './useStageZoom';
import { transformOf } from './stageZoom';
import { Toolbar } from './Toolbar';
import { StagePlayer } from './player';
import { T } from '~/theme/tokens';
import { deleteOutput } from '~/app/deleteResult';

export function StageColumn({ step, phone = false }: { step: Step; phone?: boolean }) {
  const media = useStageMedia(step);
  const history = useStore((s) => s.history);
  const viewerOpen = useStore((s) => s.viewerOpen);
  const openViewer = useStore((s) => s.openViewer);
  const closeViewer = useStore((s) => s.closeViewer);
  const select = useStore((s) => s.selectHistoryEntry);
  const [runFull, setRunFull] = useState<number | 'live' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shown = media.live ?? media.item?.url ?? null;
  const isVideo = !media.live && media.item?.kind === 'video';
  /** The player owns the stage for a shown clip and for a video step's live render. */
  const player = isVideo || (step.kind === 'video' && media.busy);
  const open = () => {
    if (media.source === 'image') { if (history.length || media.live) openViewer(); return; }
    if (media.item) setRunFull(media.index); else if (media.live) setRunFull('live');
  };
  const zoom = useStageZoom(ref, shown, player ? undefined : open, !player);
  const canOpen = !!media.item || !!media.live;

  const noOverlay = () => !viewerOpen && runFull === null;
  const pageKeys = () => noOverlay() && !isVideo;
  useShortcut('ArrowLeft', () => media.pick(media.index + 1), { priority: ShortcutPriority.Panel + 10, when: pageKeys });
  useShortcut('ArrowRight', () => media.pick(media.index - 1), { priority: ShortcutPriority.Panel + 10, when: pageKeys });
  useShortcut(['Delete', 'Backspace'], (e) => {
    const item = media.item;
    if (!item || (e.target as HTMLElement | null)?.closest?.('[role="dialog"], [role="menu"], [role="listbox"]')) return false;
    e.preventDefault();
    if (e.repeat) return;
    deleteOutput({ entry: media.source === 'image' ? media.entry : null, url: item.url });
  }, { priority: ShortcutPriority.Panel + 10, when: () => !phone && noOverlay() });

  const pct = media.progress != null ? Math.max(2, Math.round(media.progress * 100)) : null;
  const viewerIndex = Math.max(0, history.findIndex((e) => e.id === media.entry?.id));

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 'none' }}>
        <Toolbar step={step} media={media} zoom={zoom} onFullscreen={open} canFullscreen={canOpen} phone={phone} />
        {media.busy && (
          <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--il-line)', overflow: 'hidden' }}>
            {pct != null ? <div style={{ height: '100%', width: `${pct}%`, background: 'var(--il-ember)', transition: 'width .2s' }} /> : <div className="il-sweep" style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg, transparent, var(--il-ember), transparent)' }} />}
          </div>
        )}
      </div>
      {player ? (
        <StagePlayer
          src={isVideo ? media.item!.url : null}
          name={isVideo ? media.item!.filename : null}
          live={media.live}
          busy={media.busy}
          progress={media.progress}
          statusLine={media.statusLine}
          onFullscreen={open}
          canFullscreen={canOpen}
          keys={!phone}
          keysWhen={noOverlay}
          phone={phone}
        />
      ) : (
      <div ref={ref} {...zoom.handlers} aria-label="Stage"
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--il-bg-deep)', overflow: 'hidden', touchAction: shown ? 'none' : 'auto', cursor: zoom.state.zoom > 1 ? 'grab' : shown ? 'zoom-in' : 'default', position: 'relative', userSelect: 'none' }}>
        {shown ? (
          <img key={shown} src={shown} alt="" draggable={false} data-viewer-origin={media.entry?.id}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', transform: transformOf(zoom.state), transformOrigin: 'center', transition: zoom.state.zoom === 1 ? 'transform .15s' : undefined, willChange: 'transform' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 600, padding: 24 }}>
            {media.busy ? (media.statusLine ?? 'Working…') : 'No image yet — press Generate.'}
          </div>
        )}
        {media.busy && shown && media.statusLine && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 0 }} aria-live="polite" aria-label={media.statusLine} />
        )}
      </div>
      )}
      {viewerOpen && media.source === 'image' && (history.length > 0 || !!media.live) && (
        <FullscreenViewer list={history} index={viewerIndex} onIndexChange={(i) => { const e = history[i]; if (e) select(e); }} onClose={closeViewer} instant />
      )}
      {runFull !== null && (
        <FullscreenImage
          items={runFull === 'live' ? [] : media.items.map((i) => ({ key: i.key, url: i.url }))}
          index={runFull === 'live' ? 0 : runFull}
          liveUrl={runFull === 'live' ? media.live : null}
          onIndexChange={(i) => { setRunFull(i); media.pick(i); }}
          onClose={() => setRunFull(null)}
          instant
          pageCaption={runFull === 'live' ? 'Live preview' : media.items[runFull]?.filename}
        />
      )}
      <span hidden>{T.size.toolbar}</span>
    </main>
  );
}
