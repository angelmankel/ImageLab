/**
 * Rule 1 + 7: the stage. The toolbar is its own 52px row; the picture gets the rest, centred,
 * `object-fit: contain`, nothing over it. Pan and zoom (`useStageZoom`: wheel, trackpad pinch,
 * two-finger pinch, drag), a click or tap that did not move opens the fullscreen viewer: the
 * original ImageLab viewer with the history pager for images
 * (`FullscreenViewer`), `FullscreenImage` for video / workflow results. The live preview replaces
 * the picture while this step's job runs; its progress is a thin line under the toolbar row.
 */
import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { FullscreenImage } from '@/components/FullscreenImage';
import { FullscreenViewer } from '@/features/history/FullscreenViewer';
import { playOrMute, videoHasAudio } from '@/lib/videoAudio';
import type { Step } from '~/app/stepsStore';
import { useStageMedia } from './useStageMedia';
import { useStageZoom } from './useStageZoom';
import { transformOf } from './stageZoom';
import { Toolbar } from './Toolbar';
import { T } from '~/theme/tokens';

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
  const open = () => {
    if (media.source === 'image') { if (history.length || media.live) openViewer(); return; }
    if (media.item) setRunFull(media.index); else if (media.live) setRunFull('live');
  };
  const zoom = useStageZoom(ref, shown, isVideo ? undefined : open, !isVideo);
  const canOpen = !!media.item || !!media.live;

  const noOverlay = () => !viewerOpen && runFull === null;
  useShortcut('ArrowLeft', () => media.pick(media.index + 1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });
  useShortcut('ArrowRight', () => media.pick(media.index - 1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });

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
      <div ref={ref} {...(isVideo ? {} : zoom.handlers)} aria-label="Stage"
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--il-bg-deep)', overflow: 'hidden', touchAction: shown && !isVideo ? 'none' : 'auto', cursor: zoom.state.zoom > 1 ? 'grab' : shown ? 'zoom-in' : 'default', position: 'relative', userSelect: 'none' }}>
        {shown ? (
          isVideo ? (
            // Plays at once; an H3 clip (a soundtrack of its own) unmuted, falling back to muted when the browser refuses.
            <video key={shown} src={shown} controls playsInline loop autoPlay muted={!videoHasAudio(shown)} ref={(el) => { if (el) playOrMute(el); }}
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', outline: 'none' }} />
          ) : (
            <img key={shown} src={shown} alt="" draggable={false} data-viewer-origin={media.entry?.id}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', transform: transformOf(zoom.state), transformOrigin: 'center', transition: zoom.state.zoom === 1 ? 'transform .15s' : undefined, willChange: 'transform' }} />
          )
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 600, padding: 24 }}>
            {media.busy ? (media.statusLine ?? 'Working…') : 'No image yet — press Generate.'}
          </div>
        )}
        {media.busy && shown && media.statusLine && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 0 }} aria-live="polite" aria-label={media.statusLine} />
        )}
      </div>
      {viewerOpen && media.source === 'image' && (history.length > 0 || !!media.live) && (
        <FullscreenViewer list={history} index={viewerIndex} onIndexChange={(i) => { const e = history[i]; if (e) select(e); }} onClose={closeViewer} instantClose />
      )}
      {runFull !== null && (
        <FullscreenImage
          items={runFull === 'live' ? [] : media.items.map((i) => ({ key: i.key, url: i.url }))}
          index={runFull === 'live' ? 0 : runFull}
          liveUrl={runFull === 'live' ? media.live : null}
          onIndexChange={(i) => { setRunFull(i); media.pick(i); }}
          onClose={() => setRunFull(null)}
          instantClose
          pageCaption={runFull === 'live' ? 'Live preview' : media.items[runFull]?.filename}
        />
      )}
      <span hidden>{T.size.toolbar}</span>
    </main>
  );
}
