/**
 * Full-screen video for touch screens.
 *
 * One tap on the video in the page opens this; one tap here closes it, back at the same moment.
 * A drag left or right seeks (the whole screen width is the whole clip; see `lib/videoScrub`) and
 * leaves the video paused on that frame. The rotate button asks the browser for a real landscape
 * lock; where that is refused it turns the picture 90° with CSS, and the drag then runs down the
 * screen, along the picture.
 *
 * It never uses the browser's Fullscreen API: on Android, Chrome answers every
 * `requestFullscreen` with its own "drag from top to exit full screen" banner, which a page cannot
 * hide. The overlay already covers the screen (and the installed app has no address bar).
 */
import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Text } from '@mantine/core';
import { IconDeviceMobileRotated, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { DRAG_SLOP, alongVideo, scrubTime, timeLabel } from '@/lib/videoScrub';

type Orientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

export function VideoFullscreen({ url, startTime = 0, onClose }: {
  url: string;
  startTime?: number;
  /** Called with the time the video was at, so the page can carry on from there. */
  onClose: (time: number) => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; scrubbing: boolean } | null>(null);
  const [landscape, setLandscape] = useState(false);
  const [cssRotated, setCssRotated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [time, setTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 2500);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    const orientation = screen.orientation as Orientation | undefined;
    try { orientation?.unlock?.(); } catch { /* not locked */ }
    onClose(video.current?.currentTime ?? time);
  };

  const rotate = async () => {
    const orientation = screen.orientation as Orientation | undefined;
    if (landscape) {
      try { orientation?.unlock?.(); } catch { /* ignore */ }
      setCssRotated(false);
      setLandscape(false);
      return;
    }
    try {
      // No requestFullscreen here either (see above): the lock works without it in the installed
      // app on some phones; elsewhere it is refused and the picture turns instead.
      if (!orientation?.lock) throw new Error('no orientation lock');
      await orientation.lock('landscape');
      setCssRotated(false);
    } catch {
      setCssRotated(true);    // the browser refused: turn the picture instead
    }
    setLandscape(true);
  };

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  // ── Gestures: a tap closes, a drag seeks ────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, t: video.current?.currentTime ?? 0, scrubbing: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const v = video.current;
    if (!d || !v) return;
    const delta = alongVideo(e.clientX - d.x, e.clientY - d.y, cssRotated);
    if (!d.scrubbing) {
      if (Math.abs(delta) < DRAG_SLOP) return;
      d.scrubbing = true;
      setScrubbing(true);
      v.pause();
    }
    const span = cssRotated ? window.innerHeight : window.innerWidth;
    v.currentTime = scrubTime(d.t, delta, span, v.duration);
    setTime(v.currentTime);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.scrubbing) { setScrubbing(false); return; }
    close();
  };

  // Buttons must not count as a tap on the video.
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={overlay}
      data-no-swipe
      className="fixed inset-0 z-[250] overflow-hidden bg-black"
      style={{ touchAction: 'none' }}
    >
      <div
        className="absolute"
        style={cssRotated
          ? { width: '100vh', height: '100vw', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
          : { inset: 0 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; setScrubbing(false); }}
      >
        <video
          ref={video}
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-contain"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = startTime; setDuration(e.currentTarget.duration); }}
          onTimeUpdate={(e) => { if (!drag.current?.scrubbing) setTime(e.currentTarget.currentTime); }}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />

        {(scrubbing || hint) && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <Text size={scrubbing ? 'lg' : 'sm'} fw={600} c="white" className="rounded-md bg-black/60 px-3 py-1.5 tabular-nums">
              {scrubbing ? timeLabel(time, duration) : 'Tap to close · drag ← → to seek'}
            </Text>
          </div>
        )}

        <Group
          justify="space-between"
          wrap="nowrap"
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-8"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          onPointerDown={stop}
          onPointerUp={stop}
          onClick={stop}
        >
          <ActionIcon size="xl" radius="xl" variant="filled" color="dark" aria-label={paused ? 'Play' : 'Pause'} onClick={togglePlay}>
            {paused ? <IconPlayerPlay size={22} /> : <IconPlayerPause size={22} />}
          </ActionIcon>
          <Text size="sm" c="white" className="tabular-nums">{timeLabel(time, duration)}</Text>
          <ActionIcon size="xl" radius="xl" variant={landscape ? 'filled' : 'light'} color={landscape ? 'teal' : 'gray'}
            aria-label={landscape ? 'Back to portrait' : 'Rotate to landscape'} onClick={() => void rotate()}>
            <IconDeviceMobileRotated size={22} />
          </ActionIcon>
        </Group>
      </div>
    </div>
  );
}
