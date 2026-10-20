/**
 * Rule 7: the image toolbar, its own 52px row, icons centred, no seek, no info chips:
 * Fit · Zoom in · Zoom out | Crop & re-render · Mask & inpaint · Compare · Remove BG | Vary · Recall ·
 * Send to next step · ★ · Download · Delete · Fullscreen | Live preview on / off. Fullscreen is the white one.
 * Delete has no confirm: the note offers Undo (`~/app/deleteResult`; the Delete / Backspace key on
 * the stage does the same). Item 23 (10-20): every button works except the brush (inpaint, planned
 * on its own): Crop opens the crop editor and re-renders the crop full size when it changed (img2img
 * scales the input up), Compare splits the stage (`CompareView`), Remove BG (item 43) makes a
 * cut-out (`~/app/removeBgAction`), shown over a checkerboard.
 */
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { Loader } from '@mantine/core';
import { IconArrowsMaximize, IconZoomIn, IconZoomOut, IconCrop, IconBrush, IconColumns2, IconRefresh, IconHistory, IconArrowRight, IconHeart, IconHeartFilled, IconDownload, IconMaximize, IconTrash, IconBroadcast, IconBroadcastOff, IconBackground } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import { useSteps, nextStepId, type Step } from '~/app/stepsStore';
import { recallFrom, reuseSettingsFrom, sendToNextStep } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { removeBgFrom, useRemovingBg } from '~/app/removeBgAction';
import { IconBtn, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { StageBadge } from './StageBadge';
import { useLayout } from './layoutStore';
import { useStage } from './stageStore';
import { useStepRun } from './GenerateBar';
import type { StageMedia } from './useStageMedia';
import type { useStageZoom } from './useStageZoom';

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
  } catch (e) { notifications.show({ title: 'Download failed', message: e instanceof Error ? e.message : String(e), color: 'red' }); }
}

const soon = (what: string) => notifications.show({ title: what, message: 'Coming soon.', color: 'gray', autoClose: 2000 });

export function Toolbar({ step, media, zoom, onFullscreen, canFullscreen, phone = false }: {
  step: Step; media: StageMedia; zoom: ReturnType<typeof useStageZoom>; onFullscreen: () => void; canFullscreen: boolean; phone?: boolean;
}) {
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const setLivePreview = useViewerPrefs((s) => s.setLivePreview);
  const inputImage = useStore((s) => s.workflow.inputImage);
  const setTab = useLayout((s) => s.setTab);
  const { run } = useStepRun(step);
  const [cropping, setCropping] = useState<{ before: unknown } | null>(null);
  const compare = useStage((s) => s.compare);
  const setCompare = useStage((s) => s.setCompare);
  const removing = useRemovingBg(media.item?.url);
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
  const crop = async () => {
    if (!media.item) return;
    try {
      const state = await urlToImageState(media.item.url, media.item.filename);
      useStore.getState().setWorkflow({ inputImage: state });
      setTab('input');
      setCropping({ before: useStore.getState().workflow.inputImage });
    } catch (e) { notifications.show({ title: 'Could not load the picture', message: e instanceof Error ? e.message : String(e), color: 'red' }); }
  };

  /** The crop editor closed: a changed crop is re-rendered at full size on an Image step. */
  const cropDone = () => {
    const changed = !!cropping && useStore.getState().workflow.inputImage !== cropping.before;
    setCropping(null);
    if (!changed) return;
    if (step.kind === 'image') {
      run(false);
      notifications.show({ title: 'Re-rendering the crop', message: 'Full size, from the cropped part.', color: 'teal', autoClose: 2500 });
    } else notifications.show({ title: 'Cropped', message: "The crop is the Image step's input now.", color: 'teal', autoClose: 2500 });
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
        <IconBtn icon={<IconCrop size={16} stroke={2.2} />} label="Crop a part and re-render it full size" onClick={() => void crop()} style={round} disabled={!has || media.item?.kind === 'video'} />
        <IconBtn icon={<IconBrush size={16} stroke={2.2} />} label="Mask and inpaint" onClick={() => soon('Mask & inpaint')} style={round} disabled={!has} />
        <IconBtn icon={<IconColumns2 size={16} stroke={2.2} />} label={compare ? 'Close compare' : 'Compare — split view against another result'} on={compare} onClick={() => setCompare(!compare)} style={{ ...round, background: compare ? 'var(--il-ember-soft)' : 'var(--il-elev)' }} disabled={!comparable && !compare} />
        <IconBtn icon={removing ? <Loader size={14} color="var(--il-ember)" /> : <IconBackground size={16} stroke={2.2} />} label={removing ? 'Removing the background…' : 'Remove BG — cut the subject out (transparent PNG)'} onClick={() => { if (media.item) void removeBgFrom({ url: media.item.url, filename: media.item.filename, entry: media.source === 'image' ? entry : null }); }} style={round} disabled={!has || media.item?.kind === 'video' || removing} />
        <Sep />
        <IconBtn icon={<IconRefresh size={16} stroke={2.2} />} label="Vary — same settings, new seed" onClick={vary} style={round} disabled={!has} />
        <IconBtn icon={<IconHistory size={16} stroke={2.2} />} label="Recall — everything from this image back into the step" onClick={() => { if (entry) recallFrom(entry); }} style={round} disabled={!entry} />
        <IconBtn icon={<IconArrowRight size={16} stroke={2.2} />} label={hasNext ? 'Send to the next step' : 'Send to a new step (pick its kind)'} onClick={(e) => { if (media.item) sendToNextStep({ url: media.item.url, entry: entry ?? undefined }, e.currentTarget); }} style={round} disabled={!has} />
        <IconBtn icon={liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={2.2} />} label={liked ? 'Remove from favourites' : 'Favourite'} on={liked} onClick={() => { if (entry) toggleLiked(entry.id); }} style={{ ...round, color: liked ? 'var(--il-ember)' : undefined }} disabled={!entry} />
        <IconBtn icon={<IconDownload size={16} stroke={2.2} />} label="Download" onClick={() => { if (media.item) void download(media.item.url, media.item.filename); }} style={round} disabled={!has} />
        <IconBtn icon={<IconTrash size={16} stroke={2.2} />} label="Delete (Undo in the note)" onClick={() => { if (media.item) deleteOutput({ entry: media.source === 'image' ? entry : null, url: media.item.url }); }} style={round} disabled={!has} />
        <IconBtn icon={<IconMaximize size={16} stroke={2.2} />} label="Fullscreen" onClick={onFullscreen} style={{ borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)' }} disabled={!canFullscreen} />
        <Sep />
        <IconBtn icon={livePreview ? <IconBroadcast size={16} stroke={2.2} /> : <IconBroadcastOff size={16} stroke={2.2} />} label={livePreview ? 'Live preview on — frames show while a job runs' : 'Live preview off — the last result stays while a job runs'} on={livePreview} onClick={() => setLivePreview(!livePreview)} style={{ ...round, background: livePreview ? 'var(--il-ember-soft)' : 'var(--il-elev)' }} />
      </div>
      {cropping && inputImage && <EditImageModal image={inputImage} onClose={cropDone} />}
    </>
  );
}
