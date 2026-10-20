/**
 * The clip's frame rate for frame stepping: the file-name guess at once (H3 24, Wan 16), then the
 * real rate once the browser has presented enough frames (`requestVideoFrameCallback`: frames
 * per media second, snapped to a common rate). Only measured at 1× — faster playback drops
 * frames and would read low. Firefox without rVFC keeps the guess.
 */
import { useEffect, useState, type RefObject } from 'react';
import { estimateFps, guessFps, type FrameSample } from './playerLogic';

export function useClipFps(video: RefObject<HTMLVideoElement | null>, src: string | null, name: string): number {
  const [fps, setFps] = useState(() => guessFps(name));
  useEffect(() => {
    setFps(guessFps(name));
    const v = video.current;
    if (!v || !src || typeof v.requestVideoFrameCallback !== 'function') return;
    let first: FrameSample | null = null;
    let alive = true;
    let handle = 0;
    const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (!alive) return;
      const s: FrameSample = { mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames };
      if (v.playbackRate !== 1 || !first || s.mediaTime < first.mediaTime) {
        first = v.playbackRate === 1 ? s : null;
      } else {
        const est = estimateFps(first, s);
        if (est) { setFps(est); return; }
      }
      handle = v.requestVideoFrameCallback(tick);
    };
    handle = v.requestVideoFrameCallback(tick);
    return () => { alive = false; v.cancelVideoFrameCallback(handle); };
  }, [video, src, name]);
  return fps;
}
