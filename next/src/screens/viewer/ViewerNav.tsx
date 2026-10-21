/**
 * List-2 item 22: the viewer's slim top nav — its own 44px row (52 on a phone), never over the
 * picture. Left: close (Esc), the counter (LIVE while a frame streams), and with the metadata view
 * on the file facts. Right: the slideshow (▶ / ■ + the transition & speed picker with live
 * previews), ♥, 🗑 (Delete key; undo with Ctrl+Z), and ⓘ = the metadata view (strip + panel,
 * remembered). Phone: close, counter, ▶, ♥, ⓘ and "⋯" (the rest: download, Remove BG, send…).
 * `idle` fades the buttons out (the row stays, so the picture never jumps).
 */
import { Popover } from '@mantine/core';
import {
  IconX, IconPlayerPlayFilled, IconPlayerStopFilled, IconChevronDown, IconHeart, IconHeartFilled, IconTrash, IconInfoCircle, IconInfoCircleFilled, IconDots,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { deleteOutput } from '~/app/deleteResult';
import { openMenu } from '~/app/contextMenu';
import { IconBtn, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { formatDate } from '~/lib/time';
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
  return formatDate(t);
};

export function ViewerNav({ item, index, count, live, natural, playing, setPlaying, onClose, phone, canPlay, idle, onHold }: {
  item: ViewerItem | undefined; index: number; count: number; live: boolean; natural: { w: number; h: number } | null;
  playing: boolean; setPlaying: (on: boolean) => void; onClose: () => void; phone: boolean; canPlay: boolean;
  /** Fade the buttons (the mouse rests). */
  idle: boolean;
  /** A popover of the nav opened / closed: keep the nav awake meanwhile. */
  onHold: (on: boolean) => void;
}) {
  const meta = useViewerStore((s) => s.meta);
  const setMeta = useViewerStore((s) => s.setMeta);
  const transition = useViewerStore((s) => s.transition);
  const setTransition = useViewerStore((s) => s.setTransition);
  const speed = useViewerStore((s) => s.speedMs);
  const setSpeed = useViewerStore((s) => s.setSpeed);
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const liked = useStore((s) => (item?.entry ? !!s.history.find((h) => h.id === item.entry!.id)?.liked : false));
  const entry = item?.entry ?? null;
  const own = !!item && !live && !item.external;
  const ext = item?.filename.split('.').pop()?.toUpperCase();
  const took = formatDuration(item?.durationMs ?? entry?.durationMs);
  const when = item?.createdAt || entry?.createdAt;
  const facts = [natural ? `${natural.w} × ${natural.h}` : null, ext, when ? ago(when) : null, took].filter(Boolean).join(' · ');
  const sz = phone ? 44 : 34;

  const showPicker = (
    <Popover position="bottom-end" withinPortal zIndex={T.z.popover} shadow="md" radius={14} onOpen={() => onHold(true)} onClose={() => onHold(false)}>
      <Popover.Target>
        <button type="button" className="il-btn" aria-label="Slideshow transition and speed"
          style={{ height: 28, border: 0, borderRadius: 9, background: 'transparent', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {SHOW_TRANSITIONS.find((t) => t.id === transition)?.label} · {speed / 1000} s <IconChevronDown size={13} />
        </button>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', padding: 12, width: 300 }}>
        <div className="il-eyebrow" style={{ marginBottom: 8 }}>Transition</div>
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

  const play = <IconBtn icon={playing ? <IconPlayerStopFilled size={15} /> : <IconPlayerPlayFilled size={15} />} label={playing ? 'Stop slideshow' : 'Slideshow'} keys="S" on={playing} onClick={() => setPlaying(!playing)} size={phone ? sz : 28} />;

  return (
    <div onPointerEnter={() => onHold(true)} onPointerLeave={() => onHold(false)}
      style={{ height: phone ? 52 : 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: phone ? '0 6px' : '0 8px', background: '#0B0B0D', paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, opacity: idle ? 0 : 1, transition: 'opacity calc(.25s * var(--il-motion, 1)) ease' }}>
        <IconBtn icon={<IconX size={18} stroke={2.4} />} label="Close" keys="Esc" onClick={onClose} size={sz} />
        {live ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--il-err) 22%, transparent)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 11, letterSpacing: '.08em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: 'var(--il-err)' }} />LIVE
          </span>
        ) : count > 1 && (
          <span style={{ fontWeight: 800, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--il-fg2)', padding: '0 6px', whiteSpace: 'nowrap' }}>{index + 1} / {count}</span>
        )}
        {!phone && meta && item && !live && (
          <span style={{ minWidth: 0, fontSize: 11, color: 'var(--il-muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.external?.source ? `${item.external.source} · ` : ''}{facts}</span>
        )}
        <div style={{ flex: 1 }} />
        {canPlay && (phone ? play : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, background: 'var(--il-elev)', borderRadius: 11 }}>
            {play}
            {showPicker}
          </div>
        ))}
        {!phone && <Sep />}
        {entry && !live && (
          <IconBtn icon={liked ? <IconHeartFilled size={17} /> : <IconHeart size={17} stroke={2.2} />} label={liked ? 'Unfavourite' : 'Favourite'} keys="F" on={liked} onClick={() => toggleLiked(entry.id)} size={sz} style={{ color: liked ? 'var(--il-ember)' : undefined }} />
        )}
        {!phone && own && <IconBtn icon={<IconTrash size={17} stroke={2.2} />} label="Delete" keys="Del" onClick={() => deleteOutput({ entry, url: item!.url })} size={sz} />}
        <IconBtn icon={meta ? <IconInfoCircleFilled size={18} /> : <IconInfoCircle size={18} stroke={2.2} />} label={meta ? 'Hide details' : 'Details'} keys="I" on={meta} onClick={() => setMeta(!meta)} size={sz} />
        {phone && item && !live && (
          <IconBtn icon={<IconDots size={18} stroke={2.4} />} label="More" size={sz}
            onClick={(e) => openMenu('viewer-image', { item, onClose }, e.currentTarget)} />
        )}
      </div>
    </div>
  );
}
