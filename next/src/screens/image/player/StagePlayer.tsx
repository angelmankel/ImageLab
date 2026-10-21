/**
 * The stage's clip player (Donny, 10-20: "make the video preview fill the space, replace the
 * clunky player"). Rule 1: the clip is `object-fit: contain` over the whole stage area, no native
 * controls, nothing over it; the controls are their own 44px row underneath (`PlayerRow`). Used
 * by the desktop stage for video results and by the phone's Output page for clips (`phone`).
 *
 * Behaviour: plays at once (an H3 clip with its soundtrack unmuted unless the user muted it,
 * falling back to muted when the browser refuses: `playOrMute`), loops by default; loop · mute ·
 * volume · speed are remembered (`playerPrefs`). Desktop: a click on the clip is play / pause and
 * the keys are `usePlayerKeys`. Phone: a tap opens fullscreen (rule 11, `onTap`), a sideways
 * swipe pages results (`onSwipe`), the row does the toggling. While a job renders it shows the
 * live frame and the row turns into a render bar. Zoom is for pictures: none here.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { playOrMute, videoHasAudio } from '@/lib/videoAudio';
import { classifyPress, nextSpeed, seekBy as seekByLogic, stepFrame } from './playerLogic';
import { usePlayerPrefs } from './playerPrefs';
import { useClipFps } from './useClipFps';
import { usePlayerKeys } from './usePlayerKeys';
import { PlayerRow } from './PlayerRow';
import { FrameImage } from '../frame/FrameImage';

export interface StagePlayerProps {
  /** The clip's URL; null while nothing is rendered yet. */
  src: string | null;
  /** The clip's file name (frame-rate guess, soundtrack by name). */
  name?: string | null;
  /** The live preview frame while a job renders (shown instead of the clip). */
  live?: string | null;
  busy?: boolean;
  progress?: number | null;
  statusLine?: string | null;
  /** What the empty stage says. */
  empty?: string;
  phone?: boolean;
  onFullscreen: () => void;
  canFullscreen: boolean;
  /** Phone: a tap on the clip (with the current time) — opens the fullscreen player. */
  onTap?: (time: number) => void;
  /** Phone: a sideways swipe on the clip, +1 = next (older) result, −1 = previous. */
  onSwipe?: (dir: 1 | -1) => void;
  /** Seek here (and play) when it changes: the phone carries on after fullscreen. */
  resumeAt?: { time: number; nonce: number } | null;
  /** Bind the desktop keys. */
  keys?: boolean;
  keysWhen?: () => boolean;
  /** The clip area's box on the phone (aspect ratio, cap); desktop fills the column. */
  clipStyle?: CSSProperties;
  style?: CSSProperties;
}

export function StagePlayer({ src, name, live = null, busy = false, progress = null, statusLine = null, empty = 'No video yet — press Generate.', phone = false, onFullscreen, canFullscreen, onTap, onSwipe, resumeAt, keys = false, keysWhen, clipStyle, style }: StagePlayerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const loop = usePlayerPrefs((s) => s.loop);
  const speed = usePlayerPrefs((s) => s.speed);
  const prefMuted = usePlayerPrefs((s) => s.muted);
  const prefVolume = usePlayerPrefs((s) => s.volume);
  const setPrefs = usePlayerPrefs((s) => s.set);
  const hasAudio = videoHasAudio(name || src || '');
  const fps = useClipFps(video, src, name || src || '');

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(!hasAudio || prefMuted);
  const [volume, setVolume] = useState(prefVolume);
  const wasPlaying = useRef(false);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => { setTime(0); setDuration(0); setPlaying(false); setMuted(!hasAudio || prefMuted); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // The row follows the clip smoothly while it plays (timeupdate alone is ~4 Hz).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { const v = video.current; if (v) setTime(v.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, src]);

  useEffect(() => { const v = video.current; if (v) v.loop = loop; }, [loop, src]);
  useEffect(() => { const v = video.current; if (v) v.playbackRate = speed; }, [speed, src]);
  useEffect(() => {
    const v = video.current;
    if (!v || !resumeAt) return;
    v.currentTime = resumeAt.time;
    setTime(resumeAt.time);
    void v.play().catch(() => { /* a gesture is needed; the row's Play is one */ });
  }, [resumeAt]);

  const play = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.muted) void v.play().catch(() => { /* nothing more to try */ }); else playOrMute(v);
  }, []);
  const playPause = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused || v.ended) play(); else v.pause();
  }, [play]);
  const step = useCallback((dir: 1 | -1) => {
    const v = video.current;
    if (!v || !(v.duration > 0)) return;
    v.pause();
    const t = stepFrame(v.currentTime, fps, dir, v.duration);
    v.currentTime = t; setTime(t);
  }, [fps]);
  const seekBy = useCallback((s: number) => {
    const v = video.current;
    if (!v || !(v.duration > 0)) return;
    const t = seekByLogic(v.currentTime, s, v.duration);
    v.currentTime = t; setTime(t);
  }, []);
  const seekStart = useCallback(() => { const v = video.current; if (!v) return; wasPlaying.current = !v.paused && !v.ended; v.pause(); }, []);
  const seek = useCallback((t: number) => { const v = video.current; if (!v) return; v.currentTime = t; setTime(t); }, []);
  const seekEnd = useCallback(() => { if (wasPlaying.current) play(); wasPlaying.current = false; }, [play]);
  const toggleLoop = useCallback(() => setPrefs({ loop: !usePlayerPrefs.getState().loop }), [setPrefs]);
  const toggleMute = useCallback(() => {
    const v = video.current;
    if (!v || !hasAudio) return;
    v.muted = !v.muted;
    setPrefs({ muted: v.muted });
  }, [hasAudio, setPrefs]);
  const setVol = useCallback((x: number) => {
    const v = video.current;
    if (!v || !hasAudio) return;
    v.volume = x; v.muted = x === 0;
    setPrefs({ volume: x, muted: x === 0 });
  }, [hasAudio, setPrefs]);
  const cycleSpeed = useCallback(() => setPrefs({ speed: nextSpeed(usePlayerPrefs.getState().speed) }), [setPrefs]);

  usePlayerKeys({ playPause, seekBy, step, mute: toggleMute, loop: toggleLoop, fullscreen: onFullscreen }, keys && !!src && !busy && !live, keysWhen);

  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.loop = loop; v.playbackRate = speed; v.volume = prefVolume;
    setDuration(v.duration);
    setMuted(v.muted); setVolume(v.volume);
    play();
  };

  // A press on the clip: a tap (desktop play / pause, phone fullscreen) or, on the phone, a swipe.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId || !src || live) return;
    const kind = classifyPress(e.clientX - p.x, e.clientY - p.y, phone);
    if (kind === 'tap') {
      if (phone) { const v = video.current; v?.pause(); onTap?.(v?.currentTime ?? 0); } else playPause();
    } else if (kind === 'next') onSwipe?.(1);
    else if (kind === 'prev') onSwipe?.(-1);
  };

  const shown = live ?? src;
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
      <div
        aria-label="Stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; }}
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--il-bg-deep)', overflow: 'hidden', position: 'relative', userSelect: 'none', touchAction: phone ? 'pan-y' : 'auto', cursor: src && !live ? 'pointer' : 'default', ...clipStyle }}
      >
        {live ? (
          <FrameImage src={live} fade imgProps={{ draggable: false, alt: 'Live preview' }} imgStyle={{ width: '100%', height: '100%' }} />
        ) : src ? (
          <video
            key={src}
            ref={video}
            src={src}
            autoPlay
            playsInline
            loop={loop}
            muted={!hasAudio || prefMuted}
            preload="auto"
            onLoadedMetadata={onLoadedMetadata}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); const v = video.current; if (v) setTime(v.currentTime); }}
            onTimeUpdate={(e) => { if (!playing) setTime(e.currentTarget.currentTime); }}
            onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume); }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', outline: 'none', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 600, padding: 24 }}>
            {busy ? (statusLine ?? 'Working…') : empty}
          </div>
        )}
        {busy && shown && statusLine && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 0 }} aria-live="polite" aria-label={statusLine} />}
      </div>
      <PlayerRow
        phone={phone}
        busy={busy}
        progress={progress}
        statusLine={statusLine}
        ready={!!src && !live && duration > 0}
        playing={playing}
        time={time}
        duration={duration}
        loop={loop}
        muted={muted}
        volume={volume}
        speed={speed}
        hasAudio={hasAudio}
        canFullscreen={canFullscreen}
        onPlayPause={playPause}
        onStep={step}
        onSeekStart={seekStart}
        onSeek={seek}
        onSeekEnd={seekEnd}
        onLoop={toggleLoop}
        onMute={toggleMute}
        onVolume={setVol}
        onSpeed={cycleSpeed}
        onFullscreen={onFullscreen}
      />
    </div>
  );
}
