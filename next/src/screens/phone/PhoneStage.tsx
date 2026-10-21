/**
 * The phone's stage for one step (mobile pass, m-create): the same media as the desktop stage
 * (`useStageMedia`: the step's own results — the history for the Image step, the run store for
 * Video / Workflow / Refine / Upscale / Remove BG — its live preview, progress and pick), top to
 * bottom with nothing over the picture:
 *   the picture (`OutputPicture`: full width, its aspect; swipe = previous / next result, tap =
 *   the full-screen viewer, long-press = its menu; Compare splits it)
 *   the progress line while the step's job runs
 *   the desktop toolbar's actions (`OutputActions`) · the results strip · the prompt line ·
 *   Send to the next step
 * The viewers open from here like `StageColumn`'s: `HistoryViewer` for images, `ImageViewer` for
 * a run's results; Edit mode is `PhoneEdit` (its own page).
 */
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { HistoryViewer } from '~/screens/viewer/HistoryViewer';
import { ImageViewer } from '~/screens/viewer/ImageViewer';
import { enterEdit } from '~/canvas/edit/editStore';
import { editSourceOf } from '~/canvas/edit/useStageEdit';
import { PhoneEdit } from '~/canvas/edit/PhoneEdit';
import { useRoute } from '~/app/routeStore';
import { menuProps } from '~/app/contextMenu';
import type { Step } from '~/app/stepsStore';
import { useStageMedia } from '~/screens/image/useStageMedia';
import { canvasTarget } from '~/screens/image/canvasMenu';
import { T } from '~/theme/tokens';
import { OutputPicture } from './OutputPicture';
import { ResultThumbs } from './ResultThumbs';
import { OutputActions, SendNext } from './OutputActions';

const NOOP = () => {};
const NO_ZOOM = { fit: NOOP, zoomIn: NOOP, zoomOut: NOOP };

export function ProgressLine({ status, progress }: { status: string | null; progress: number | null }) {
  return (
    <div style={{ padding: `0 ${T.pad.panel}px`, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status ?? 'Working…'}</span>
        {progress != null && <span style={{ color: 'var(--il-ember-hi)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress * 100)}%</span>}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(4, (progress ?? 0.08) * 100)}%`, background: 'var(--il-ember)', borderRadius: 2, transition: 'width 200ms linear' }} />
      </div>
    </div>
  );
}

/** The step's media + the way to open it full screen (shared by the picture and the strip). */
export function usePhoneStage(step: Step) {
  const media = useStageMedia(step);
  const history = useStore((s) => s.history);
  const viewerOpen = useStore((s) => s.viewerOpen);
  const openViewer = useStore((s) => s.openViewer);
  const closeViewer = useStore((s) => s.closeViewer);
  const [runFull, setRunFull] = useState<number | 'live' | null>(null);
  const [openedLive, setOpenedLive] = useState(false);
  const indexOf = (key: string) => media.items.findIndex((i) => i.key === key);
  const pick = (key: string) => { const i = indexOf(key); if (i >= 0) media.pick(i); };
  const open = (key?: string) => {
    const at = key ? indexOf(key) : media.index;
    if (key && at >= 0) media.pick(at);
    if (media.source === 'image') {
      if (history.length || media.live) { setOpenedLive(!key && !!media.live); openViewer(); }
      return;
    }
    if (at >= 0) setRunFull(at); else if (media.live) setRunFull('live');
  };
  const viewer = media.source === 'image'
    ? (viewerOpen && (history.length > 0 || !!media.live) ? <HistoryViewer onClose={closeViewer} showLive={openedLive} /> : null)
    : runFull !== null ? (
      <ImageViewer
        items={runFull === 'live' ? [] : media.items}
        index={runFull === 'live' ? 0 : runFull}
        liveUrl={runFull === 'live' ? media.live : null}
        onIndexChange={(i) => { setRunFull(i); media.pick(i); }}
        onClose={() => setRunFull(null)}
      />
    ) : null;
  return { media, pick, open, viewer };
}

export type PhoneStageApi = ReturnType<typeof usePhoneStage>;

/** `stage` = the caller's `usePhoneStage(step)` when it needs `open` too (a Fullscreen button). */
export function PhoneStage({ step, stage, fill = false }: {
  step: Step; stage: PhoneStageApi;
  /** Landscape main pane: the picture fills the pane's height, the actions row under it; the results, prompt and Send go to the side pane (`StageExtras`). */
  fill?: boolean;
}) {
  const { media, pick, open, viewer } = stage;
  const go = useRoute((s) => s.go);
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const items = media.items;
  const current = media.item;
  const live = media.live;
  const src = editSourceOf(media);
  const comparable = !live && current?.kind === 'image' && items.filter((i) => i.kind === 'image').length > 1;
  const noun = step.kind === 'video' ? 'video' : step.kind === 'image' ? 'image' : 'result';
  const fallbackAspect = step.kind === 'image' ? width / height : step.kind === 'video' ? 16 / 9 : 1;
  const caption = media.entry?.positive ?? null;
  const menu = current && !live ? menuProps('canvas-image', { ...canvasTarget(media, NO_ZOOM, () => open()), noZoom: true }) : {};
  const picture = (
    <OutputPicture items={items} currentKey={current?.key ?? null} onPick={pick} onOpen={open} live={live} busy={media.busy} status={media.statusLine}
      liveGrid={media.source === 'image'} fallbackAspect={fallbackAspect} empty={`No ${noun} yet — press Generate.`}
      compare={comparable} sourceKey={media.entry?.derivedFrom?.id ?? null} fill={fill} />
  );
  const actions = <OutputActions step={step} current={current} comparable={comparable} onEdit={src && !live ? () => enterEdit(src, false) : undefined} />;
  if (fill) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div {...menu} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{picture}</div>
        {media.busy && <div style={{ paddingTop: 6, flex: 'none' }}><ProgressLine status={media.statusLine} progress={media.progress} /></div>}
        <div style={{ flex: 'none', padding: '8px 0 calc(6px + var(--il-safe-bottom))' }}>{actions}</div>
        {viewer}
        <PhoneEdit />
      </div>
    );
  }
  return (
    <>
      <div {...menu}>{picture}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md, paddingTop: T.gap.md }}>
        {media.busy && <ProgressLine status={media.statusLine} progress={media.progress} />}
        {actions}
        <ResultThumbs items={items} currentKey={current?.key ?? null} onPick={pick} onOpen={(k) => open(k)} onMore={() => go('library')} />
        {caption && (
          <p style={{ margin: `0 ${T.pad.panel}px`, fontSize: 13, color: 'var(--il-fg2)', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</p>
        )}
        <SendNext step={step} current={current} />
      </div>
      {viewer}
      <PhoneEdit />
    </>
  );
}

/** Landscape side pane, Output tab: the results, the prompt line and Send to the next step (the picture is in the main pane). */
export function StageExtras({ step, stage }: { step: Step; stage: PhoneStageApi }) {
  const { media, pick, open } = stage;
  const go = useRoute((s) => s.go);
  const caption = media.entry?.positive ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md, padding: `${T.gap.md}px 0` }}>
      <ResultThumbs items={media.items} currentKey={media.item?.key ?? null} onPick={pick} onOpen={(k) => open(k)} onMore={() => go('library')} />
      {caption && <p style={{ margin: `0 ${T.pad.panel}px`, fontSize: 13, color: 'var(--il-fg2)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{caption}</p>}
      <SendNext step={step} current={media.item} />
    </div>
  );
}
