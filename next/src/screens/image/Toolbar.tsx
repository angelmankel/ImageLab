/**
 * Rule 7: the image toolbar, its own 52px row, icons centred, no seek, no info chips:
 * Fit · Zoom in · Zoom out | Crop & re-render · Mask & inpaint · Compare | Vary · Send to next
 * step · ★ · Download · Delete · Fullscreen. Fullscreen is the white one. Delete has no confirm: the
 * note offers Undo (`~/app/deleteResult`; the Delete / Backspace key on the stage does the same).
 */
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconArrowsMaximize, IconZoomIn, IconZoomOut, IconCrop, IconBrush, IconColumns2, IconRefresh, IconHistory, IconArrowRight, IconHeart, IconHeartFilled, IconDownload, IconMaximize, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import type { Step } from '~/app/stepsStore';
import { recallFrom, reuseSettingsFrom, sendToStep } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { IconBtn, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { StageBadge } from './StageBadge';
import { useLayout } from './layoutStore';
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
  const inputImage = useStore((s) => s.workflow.inputImage);
  const setTab = useLayout((s) => s.setTab);
  const { run } = useStepRun(step);
  const [cropping, setCropping] = useState(false);
  const has = !!media.item;
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
      setCropping(true);
    } catch (e) { notifications.show({ title: 'Could not load the picture', message: e instanceof Error ? e.message : String(e), color: 'red' }); }
  };

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
        <IconBtn icon={<IconColumns2 size={16} stroke={2.2} />} label="Compare with the previous result" onClick={() => soon('Compare')} style={round} disabled={!has} />
        <Sep />
        <IconBtn icon={<IconRefresh size={16} stroke={2.2} />} label="Vary — same settings, new seed" onClick={vary} style={round} disabled={!has} />
        <IconBtn icon={<IconHistory size={16} stroke={2.2} />} label="Recall — everything from this image back into the step" onClick={() => { if (entry) recallFrom(entry); }} style={round} disabled={!entry} />
        <IconBtn icon={<IconArrowRight size={16} stroke={2.2} />} label="Send to the next step" onClick={() => { if (media.item) sendToStep({ url: media.item.url, entry: entry ?? undefined }); }} style={round} disabled={!has} />
        <IconBtn icon={liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={2.2} />} label={liked ? 'Remove from favourites' : 'Favourite'} on={liked} onClick={() => { if (entry) toggleLiked(entry.id); }} style={{ ...round, color: liked ? 'var(--il-ember)' : undefined }} disabled={!entry} />
        <IconBtn icon={<IconDownload size={16} stroke={2.2} />} label="Download" onClick={() => { if (media.item) void download(media.item.url, media.item.filename); }} style={round} disabled={!has} />
        <IconBtn icon={<IconTrash size={16} stroke={2.2} />} label="Delete (Undo in the note)" onClick={() => { if (media.item) deleteOutput({ entry: media.source === 'image' ? entry : null, url: media.item.url }); }} style={round} disabled={!has} />
        <IconBtn icon={<IconMaximize size={16} stroke={2.2} />} label="Fullscreen" onClick={onFullscreen} style={{ borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)' }} disabled={!canFullscreen} />
      </div>
      {cropping && inputImage && <EditImageModal image={inputImage} onClose={() => setCropping(false)} />}
    </>
  );
}
