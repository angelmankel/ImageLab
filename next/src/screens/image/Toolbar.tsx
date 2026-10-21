/**
 * Rule 7: the image toolbar, its own 52px row, icons centred, no seek, no info chips. View and
 * output actions only (item 13): Fit · Zoom in · Zoom out | Edit (E) · Compare | Vary · Recall ·
 * Send to next step · ★ · Download · Delete · Fullscreen | Live preview on / off. Fullscreen is the
 * white one. Every edit tool (crop, Remove BG, …) lives in Edit mode's left tool bar
 * (`~/canvas/edit`); the zoom buttons drive whichever canvas shows (the GPU one in Edit mode).
 * Delete has no confirm: the note offers Undo (`~/app/deleteResult`; the Delete / Backspace key on
 * the stage does the same). Compare splits the stage (`CompareView`).
 */
import { IconArrowsMaximize, IconZoomIn, IconZoomOut, IconPencil, IconColumns2, IconRefresh, IconHistory, IconArrowRight, IconHeart, IconHeartFilled, IconDownload, IconMaximize, IconTrash, IconBroadcast, IconBroadcastOff } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { useSteps, nextStepId, type Step } from '~/app/stepsStore';
import { recallFrom, reuseSettingsFrom, sendToNextStep } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { toggleEdit, useEdit } from '~/canvas/edit/editStore';
import { editSourceOf } from '~/canvas/edit/useStageEdit';
import type { ZoomControls } from '~/canvas/gpu/zoomControls';
import { IconBtn, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { StageBadge } from './StageBadge';
import { useStage } from './stageStore';
import { useStepRun } from './GenerateBar';
import type { StageMedia } from './useStageMedia';
import { notifyError } from '~/app/notify';

const round: React.CSSProperties = { borderRadius: '50%', background: 'var(--il-elev)' };

async function download(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj; a.download = filename || 'imagelab.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch (e) { notifyError('Download failed', e); }
}

export function Toolbar({ step, media, zoom, onFullscreen, canFullscreen, phone = false }: {
  step: Step; media: StageMedia; zoom: ZoomControls; onFullscreen: () => void; canFullscreen: boolean; phone?: boolean;
}) {
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const setLivePreview = useViewerPrefs((s) => s.setLivePreview);
  const { run } = useStepRun(step);
  const compare = useStage((s) => s.compare);
  const setCompare = useStage((s) => s.setCompare);
  const editing = useEdit((s) => s.on);
  const canEdit = !!editSourceOf(media) && !media.live;
  const has = !!media.item;
  const hasNext = useSteps((s) => !!nextStepId(s.steps, s.activeId));
  /** Zoom is for pictures; a clip (StagePlayer) has none. */
  const zoomable = has && media.item?.kind !== 'video';
  const entry = media.entry;
  const liked = !!entry?.liked;

  const vary = () => {
    if (!has) return;
    if (media.source === 'image' && entry) reuseSettingsFrom(entry);
    run(true);
  };
  const comparable = has && media.items.filter((i) => i.kind === 'image').length > 1 && media.item?.kind !== 'video';

  return (
    <>
      <div className="il-scroll-x" style={{ position: 'relative', height: T.size.toolbar, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: phone ? 'flex-start' : 'center', gap: 6, padding: phone ? '0 10px' : '0 150px', touchAction: 'pan-x pan-y' }}>
        {!phone && <StageBadge item={media.item} />}
        <IconBtn icon={<IconArrowsMaximize size={16} stroke={2.2} />} label="Fit to view" onClick={zoom.fit} style={round} disabled={!zoomable} />
        <IconBtn icon={<IconZoomIn size={16} stroke={2.2} />} label="Zoom in" onClick={zoom.zoomIn} style={round} disabled={!zoomable} />
        <IconBtn icon={<IconZoomOut size={16} stroke={2.2} />} label="Zoom out" onClick={zoom.zoomOut} style={round} disabled={!zoomable} />
        <Sep />
        <IconBtn icon={<IconPencil size={16} stroke={2.2} />} label={editing ? 'Leave Edit mode' : 'Edit'} keys="E" on={editing} onClick={() => toggleEdit(editSourceOf(media))} style={{ ...round, background: editing ? 'var(--il-ember-soft)' : 'var(--il-elev)' }} disabled={!editing && !canEdit} />
        <IconBtn icon={<IconColumns2 size={16} stroke={2.2} />} label={compare ? 'Close compare' : 'Compare'} on={compare} onClick={() => setCompare(!compare)} style={{ ...round, background: compare ? 'var(--il-ember-soft)' : 'var(--il-elev)' }} disabled={editing || (!comparable && !compare)} />
        <Sep />
        <IconBtn icon={<IconRefresh size={16} stroke={2.2} />} label="Vary with a new seed" onClick={vary} style={round} disabled={!has} />
        <IconBtn icon={<IconHistory size={16} stroke={2.2} />} label="Recall settings" onClick={() => { if (entry) recallFrom(entry); }} style={round} disabled={!entry} />
        <IconBtn icon={<IconArrowRight size={16} stroke={2.2} />} label={hasNext ? 'Send to the next step' : 'Send to a new step'} onClick={(e) => { if (media.item) sendToNextStep({ url: media.item.url, entry: entry ?? undefined }, e.currentTarget); }} style={round} disabled={!has} />
        <IconBtn icon={liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={2.2} />} label={liked ? 'Remove from favourites' : 'Favourite'} on={liked} onClick={() => { if (entry) toggleLiked(entry.id); }} style={{ ...round, color: liked ? 'var(--il-ember)' : undefined }} disabled={!entry} />
        <IconBtn icon={<IconDownload size={16} stroke={2.2} />} label="Download" onClick={() => { if (media.item) void download(media.item.url, media.item.filename); }} style={round} disabled={!has} />
        <IconBtn icon={<IconTrash size={16} stroke={2.2} />} label="Delete" onClick={() => { if (media.item) deleteOutput({ entry: media.source === 'image' ? entry : null, url: media.item.url }); }} style={round} disabled={!has} />
        <IconBtn icon={<IconMaximize size={16} stroke={2.2} />} label="Fullscreen" onClick={onFullscreen} style={{ borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)' }} disabled={!canFullscreen} />
        <Sep />
        <IconBtn icon={livePreview ? <IconBroadcast size={16} stroke={2.2} /> : <IconBroadcastOff size={16} stroke={2.2} />} label={livePreview ? 'Live preview on' : 'Live preview off'} on={livePreview} onClick={() => setLivePreview(!livePreview)} style={{ ...round, background: livePreview ? 'var(--il-ember-soft)' : 'var(--il-elev)' }} />
      </div>
    </>
  );
}
