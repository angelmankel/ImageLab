/**
 * Item 30: the viewer's top bar — its own 56px row, never over the picture. Left: close, the
 * counter (LIVE while a frame streams), the file name with size · type · age · time taken. Right:
 * the slideshow group (play / pause + the transition & speed popover with live previews),
 * favourite, Remove BG, download, delete (Undo in the note), the panel toggle. Phone: close,
 * counter, play, favourite, and "⋯" for the rest.
 */
import { Popover } from '@mantine/core';
import {
  IconX, IconPlayerPlayFilled, IconPlayerPauseFilled, IconChevronDown, IconHeart, IconHeartFilled, IconBackground,
  IconDownload, IconTrash, IconLayoutSidebarRight, IconLayoutSidebarRightFilled, IconDots,
} from '@tabler/icons-react';
import { Loader } from '@mantine/core';
import { useStore } from '@/lib/store';
import { deleteOutput } from '~/app/deleteResult';
import { removeBgFrom, useRemovingBg } from '~/app/removeBgAction';
import { openMenu } from '~/app/contextMenu';
import { downloadUrl } from '~/screens/image/canvasMenu';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { SHOW_SPEEDS, SHOW_TRANSITIONS } from './slideshowLogic';
import { formatDuration } from './metaLogic';
import { useViewerStore } from './viewerStore';
import { TransitionPreview } from './TransitionPreview';
import type { ViewerItem } from './types';

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ViewerTopBar({ item, index, count, live, natural, playing, setPlaying, onClose, phone, canPlay }: {
  item: ViewerItem | undefined; index: number; count: number; live: boolean; natural: { w: number; h: number } | null;
  playing: boolean; setPlaying: (on: boolean) => void; onClose: () => void; phone: boolean; canPlay: boolean;
}) {
  const panel = useViewerStore((s) => s.panel);
  const setPanel = useViewerStore((s) => s.setPanel);
  const transition = useViewerStore((s) => s.transition);
  const setTransition = useViewerStore((s) => s.setTransition);
  const speed = useViewerStore((s) => s.speedMs);
  const setSpeed = useViewerStore((s) => s.setSpeed);
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const liked = useStore((s) => (item?.entry ? !!s.history.find((h) => h.id === item.entry!.id)?.liked : false));
  const removing = useRemovingBg(item?.url);
  const entry = item?.entry ?? null;
  const isImage = item?.kind === 'image' && !live;
  const ext = item?.filename.split('.').pop()?.toUpperCase();
  const took = formatDuration(item?.durationMs ?? entry?.durationMs);
  const facts = [natural ? `${natural.w} × ${natural.h}` : null, ext, item?.createdAt || entry?.createdAt ? ago((item?.createdAt || entry?.createdAt)!) : null, took].filter(Boolean).join(' · ');

  const like = () => { if (entry) toggleLiked(entry.id); };
  const del = () => { if (!item) return; deleteOutput({ entry, url: item.url }); };
  const round = { borderRadius: '50%', background: 'var(--il-elev)' } as const;
  const sz = phone ? 44 : 36;

  const showPicker = (
    <Popover position="bottom-end" withinPortal zIndex={T.z.popover} shadow="md" radius={14}>
      <Popover.Target>
        <button type="button" className="il-btn" aria-label="Slideshow transition and speed"
          style={{ height: 30, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 10px', cursor: 'pointer' }}>
          {SHOW_TRANSITIONS.find((t) => t.id === transition)?.label} · {speed / 1000} s <IconChevronDown size={13} />
        </button>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', padding: 12, width: 300 }}>
        <div className="il-eyebrow" style={{ marginBottom: 8 }}>Slideshow transition</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {SHOW_TRANSITIONS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTransition(t.id)} aria-pressed={transition === t.id}
              style={{ border: 0, borderRadius: 10, background: 'var(--il-card)', padding: 6, cursor: 'pointer', color: transition === t.id ? 'var(--il-fg)' : 'var(--il-fg2)', fontWeight: 800, fontSize: 10.5, boxShadow: transition === t.id ? '0 0 0 2px var(--il-ember)' : undefined }}>
              <TransitionPreview kind={t.id} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="il-eyebrow" style={{ marginBottom: 8 }}>Speed</div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--il-elev)', borderRadius: 12 }}>
          {SHOW_SPEEDS.map((ms) => (
            <button key={ms} type="button" onClick={() => setSpeed(ms)} aria-pressed={speed === ms}
              style={{ flex: 1, height: 30, border: 0, borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 12, background: speed === ms ? 'var(--il-ember-soft)' : 'transparent', color: speed === ms ? 'var(--il-ember-hi)' : 'var(--il-fg2)' }}>
              {ms / 1000} s
            </button>
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  );

  return (
    <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: phone ? '0 8px' : '0 12px', borderBottom: '1px solid var(--il-line)', background: 'var(--il-bg-deep)', paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
      <IconBtn icon={<IconX size={18} stroke={2.4} />} label="Close" keys="Esc" onClick={onClose} size={sz} style={round} />
      {live ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--il-err) 22%, transparent)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 11, letterSpacing: '.08em' }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: 'var(--il-err)' }} />LIVE
        </span>
      ) : count > 0 && (
        <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--il-fg)', padding: '0 4px', whiteSpace: 'nowrap' }}>{index + 1} / {count}</span>
      )}
      {!phone && item && !live && (
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</b>
          <span style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{facts}</span>
        </div>
      )}
      <div style={{ flex: 1 }} />
      {canPlay && (phone ? (
        <IconBtn icon={playing ? <IconPlayerPauseFilled size={17} /> : <IconPlayerPlayFilled size={17} />} label={playing ? 'Pause the slideshow' : 'Play the slideshow'} keys="S" on={playing} onClick={() => setPlaying(!playing)} size={sz} style={round} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, background: 'var(--il-elev)', borderRadius: 13 }}>
          <button type="button" className="il-btn" onClick={() => setPlaying(!playing)} aria-pressed={playing}
            style={{ height: 30, border: 0, borderRadius: 10, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, cursor: 'pointer', background: playing ? 'var(--il-ember-soft)' : 'transparent', color: playing ? 'var(--il-ember-hi)' : 'var(--il-fg2)' }}>
            {playing ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}{playing ? 'Pause' : 'Slideshow'}
          </button>
          {showPicker}
        </div>
      ))}
      {entry && !live && (
        <IconBtn icon={liked ? <IconHeartFilled size={17} /> : <IconHeart size={17} stroke={2.2} />} label={liked ? 'Remove from favourites' : 'Favourite'} keys="F" on={liked} onClick={like} size={sz} style={{ ...round, color: liked ? 'var(--il-ember)' : undefined }} />
      )}
      {!phone && isImage && (
        <IconBtn icon={removing ? <Loader size={14} color="var(--il-ember)" /> : <IconBackground size={17} stroke={2.2} />} label={removing ? 'Removing the background…' : 'Remove BG — cut the subject out'} disabled={removing} onClick={() => item && void removeBgFrom({ url: item.url, filename: item.filename, entry })} size={sz} style={round} />
      )}
      {!phone && item && !live && <IconBtn icon={<IconDownload size={17} stroke={2.2} />} label="Download" onClick={() => downloadUrl(item.url, item.filename)} size={sz} style={round} />}
      {!phone && item && !live && <IconBtn icon={<IconTrash size={17} stroke={2.2} />} label="Delete (Undo in the note)" keys="Del" onClick={del} size={sz} style={round} />}
      {!phone && (
        <IconBtn icon={panel ? <IconLayoutSidebarRightFilled size={17} /> : <IconLayoutSidebarRight size={17} stroke={2.2} />} label={panel ? 'Hide the panel' : 'Show the panel'} keys="I" on={panel} onClick={() => setPanel(!panel)} size={sz} style={round} />
      )}
      {phone && item && !live && (
        <IconBtn icon={<IconDots size={18} stroke={2.4} />} label="More" size={sz} style={round}
          onClick={(e) => openMenu('viewer-image', { item, onClose }, e.currentTarget)} />
      )}
    </div>
  );
}
