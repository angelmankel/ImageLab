/**
 * The player's controls row (rule 1: its own 44px row under the clip, never over it), the Ember
 * look, tight: Play/Pause · frame back · frame forward · the scrub bar · 0:03 / 0:05 · Loop ·
 * Mute (+ a volume slider on hover / press, clips with sound only) · speed chip · Fullscreen.
 * While a job renders: the status line and a thin render bar in the scrub bar's place, no
 * transport. A mouse press on a button never leaves it focused, so Space stays play / pause.
 */
import { useState } from 'react';
import { Slider } from '@mantine/core';
import { IconCaretLeftFilled, IconCaretRightFilled, IconMaximize, IconPlayerPauseFilled, IconPlayerPlayFilled, IconRepeat, IconRepeatOff, IconVolume, IconVolume2, IconVolumeOff } from '@tabler/icons-react';
import { Chip, IconBtn } from '~/ui';
import { fmtClock, fmtSpeed } from './playerLogic';
import { RenderBar, ScrubBar } from './ScrubBar';

export const PLAYER_ROW_H = 44;

export interface PlayerRowProps {
  phone: boolean;
  busy: boolean;
  progress: number | null;
  statusLine: string | null;
  /** A clip is loaded (metadata known): the transport works. */
  ready: boolean;
  playing: boolean;
  time: number;
  duration: number;
  loop: boolean;
  muted: boolean;
  volume: number;
  speed: number;
  hasAudio: boolean;
  canFullscreen: boolean;
  onPlayPause: () => void;
  onStep: (dir: 1 | -1) => void;
  onSeekStart: () => void;
  onSeek: (t: number) => void;
  onSeekEnd: () => void;
  onLoop: () => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onSpeed: () => void;
  onFullscreen: () => void;
}

export function PlayerRow(p: PlayerRowProps) {
  const [volOpen, setVolOpen] = useState(false);
  const size = p.phone ? 40 : 32;
  const icon = p.phone ? 18 : 16;
  const tip = !p.phone;
  const round: React.CSSProperties = { borderRadius: '50%' };
  const off = !p.ready;

  return (
    <div
      role="toolbar"
      aria-label="Player"
      onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}
      style={{ height: PLAYER_ROW_H, flex: 'none', display: 'flex', alignItems: 'center', gap: p.phone ? 2 : 1, padding: p.phone ? '0 6px' : '0 8px', background: 'var(--il-bg)', borderTop: '1px solid var(--il-line)', boxSizing: 'border-box', touchAction: 'pan-y' }}
    >
      {p.busy ? (
        <>
          <span style={{ flex: 'none', maxWidth: '40%', padding: '0 6px', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.statusLine ?? 'Rendering…'}
          </span>
          <RenderBar progress={p.progress} />
          <span style={{ flex: 'none', minWidth: 36, textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--il-ember-hi)', fontVariantNumeric: 'tabular-nums' }}>
            {p.progress != null ? `${Math.round(p.progress * 100)}%` : ''}
          </span>
        </>
      ) : (
        <>
          <IconBtn size={size} tooltip={tip} style={round} disabled={off} label={p.playing ? 'Pause' : 'Play'} onClick={p.onPlayPause}
            icon={p.playing ? <IconPlayerPauseFilled size={icon} /> : <IconPlayerPlayFilled size={icon} />} />
          <IconBtn size={size} tooltip={tip} style={round} disabled={off} label="Back one frame" onClick={() => p.onStep(-1)} icon={<IconCaretLeftFilled size={icon} />} />
          <IconBtn size={size} tooltip={tip} style={round} disabled={off} label="Forward one frame" onClick={() => p.onStep(1)} icon={<IconCaretRightFilled size={icon} />} />
          <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'stretch', padding: '0 8px' }}>
            <ScrubBar time={p.time} duration={p.duration} phone={p.phone} disabled={off} onSeekStart={p.onSeekStart} onSeek={p.onSeek} onSeekEnd={p.onSeekEnd} />
          </div>
          <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', padding: '0 4px' }}>
            {fmtClock(p.time, p.duration)}
          </span>
          <IconBtn size={size} tooltip={tip} style={round} on={p.loop} label={p.loop ? 'Loop on' : 'Loop off'} onClick={p.onLoop}
            icon={p.loop ? <IconRepeat size={icon} stroke={2.2} /> : <IconRepeatOff size={icon} stroke={2.2} />} />
          <div
            onMouseEnter={() => { if (p.hasAudio && !p.phone) setVolOpen(true); }}
            onMouseLeave={() => { if (!p.phone) setVolOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', flex: 'none' }}
          >
            <IconBtn size={size} tooltip={tip} style={round} disabled={!p.hasAudio} label={!p.hasAudio ? 'Silent clip' : p.muted ? 'Unmute' : 'Mute'}
              onClick={() => { if (p.phone && p.hasAudio) setVolOpen(p.muted); p.onMute(); }}
              icon={!p.hasAudio || p.muted ? <IconVolumeOff size={icon} stroke={2.2} /> : p.volume < 0.5 ? <IconVolume2 size={icon} stroke={2.2} /> : <IconVolume size={icon} stroke={2.2} />} />
            {volOpen && p.hasAudio && (
              <div style={{ width: p.phone ? 90 : 72, padding: '0 8px 0 2px' }}>
                <Slider value={Math.round((p.muted ? 0 : p.volume) * 100)} min={0} max={100} step={1} label={null} size="xs" color="ember" aria-label="Volume"
                  onChange={(v) => p.onVolume(v / 100)} styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
              </div>
            )}
          </div>
          <Chip small onClick={p.onSpeed} title="Playback speed" on={p.speed !== 1} style={{ flex: 'none', minWidth: 42, justifyContent: 'center', height: p.phone ? 30 : 24, padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
            {fmtSpeed(p.speed)}
          </Chip>
        </>
      )}
      <IconBtn size={size} tooltip={tip} label="Fullscreen" onClick={p.onFullscreen} disabled={!p.canFullscreen}
        style={{ borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)', marginLeft: 2 }} icon={<IconMaximize size={icon} stroke={2.2} />} />
    </div>
  );
}
