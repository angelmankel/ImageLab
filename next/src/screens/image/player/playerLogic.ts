/**
 * The stage player's pure maths (no imports: tests/player.test.cjs loads this file alone):
 * the frame rate guess, the rVFC frame-rate estimate, frame stepping, time formatting,
 * scrub position ↔ time, the speed cycle, the saved preferences.
 */

export const WAN_FPS = 16;
export const H3_FPS = 24;
export const DEFAULT_FPS = 24;

/** The speed chip's cycle. */
export const SPEEDS: readonly number[] = [0.25, 0.5, 1, 1.5, 2];

/** Past this many pixels a press on the clip is a drag, not a tap. */
export const TAP_SLOP = 8;
/** A sideways drag this long on the phone's clip pages to the next / previous result. */
export const SWIPE_PX = 48;

/** ←/→ seek this far. */
export const SEEK_STEP = 1;

/**
 * The clip's frame rate from its file name, used until the browser has shown enough frames to
 * measure it: MiniMax H3 saves at 24, Wan (`ImageLab_T2V` / `_I2V` …) at 16, anything else 24.
 */
export function guessFps(urlOrName: string | null | undefined): number {
  if (!urlOrName) return DEFAULT_FPS;
  let name = urlOrName;
  try { name = decodeURIComponent(urlOrName); } catch { /* keep the raw name */ }
  if (/ImageLab_H3/i.test(name)) return H3_FPS;
  if (/ImageLab_/i.test(name)) return WAN_FPS;
  return DEFAULT_FPS;
}

export interface FrameSample { mediaTime: number; presentedFrames: number }

const COMMON_RATES = [8, 10, 12, 15, 16, 20, 24, 25, 30, 32, 48, 50, 60];
/** Frames to see before trusting an estimate. */
export const FPS_MIN_FRAMES = 12;

/**
 * The frame rate between two `requestVideoFrameCallback` samples, snapped to a common rate when
 * within 6% of one; null until enough frames went by. A loop (media time going back) or a dropped
 * frame cannot be told apart here: the caller restarts from a fresh first sample when time jumps.
 */
export function estimateFps(a: FrameSample, b: FrameSample): number | null {
  const dt = b.mediaTime - a.mediaTime;
  const df = b.presentedFrames - a.presentedFrames;
  if (!(dt > 0) || df < FPS_MIN_FRAMES) return null;
  const raw = df / dt;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  for (const r of COMMON_RATES) if (Math.abs(raw - r) / r <= 0.06) return r;
  return Math.max(1, Math.round(raw));
}

/** The frame that contains `t` (a hair of tolerance so a frame centre never rounds down). */
export function frameAt(t: number, fps: number): number {
  return Math.max(0, Math.floor(t * fps + 1e-4));
}

/** The centre of frame `n`, the safest time to ask a browser to show exactly that frame. */
export function frameCentre(n: number, fps: number): number {
  return (n + 0.5) / fps;
}

/** One frame back (`dir = -1`) or forward (`+1`) from `t`, never past the ends. */
export function stepFrame(t: number, fps: number, dir: 1 | -1, duration: number): number {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const next = frameCentre(frameAt(t, safeFps) + dir, safeFps);
  return clampTime(next, duration);
}

/** `t + delta`, kept inside the clip. */
export function seekBy(t: number, delta: number, duration: number): number {
  return clampTime(t + delta, duration);
}

export function clampTime(t: number, duration: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  if (duration > 0 && t > duration) return duration;
  return t;
}

/** "0:03", "1:05"; with `tenths` "0:03.4". NaN / negative read as 0. */
export function fmtTime(s: number, tenths = false): string {
  const t = Number.isFinite(s) && s > 0 ? s : 0;
  const whole = tenths ? Math.floor(t * 10) / 10 : Math.floor(t);
  const m = Math.floor(whole / 60);
  const sec = whole - m * 60;
  const body = tenths ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return `${m}:${body}`;
}

/** "0:03 / 0:05" */
export function fmtClock(t: number, duration: number): string {
  return `${fmtTime(t)} / ${fmtTime(duration)}`;
}

/** Where a time sits on the bar, 0..1. */
export function posOf(t: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(1, Math.max(0, t / duration));
}

/** The time under a pointer at `x` over a bar that spans `left`..`left + width`. */
export function timeAt(x: number, left: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0;
  const f = Math.min(1, Math.max(0, (x - left) / width));
  return f * duration;
}

/** The next speed in the cycle; anything off the list goes back to 1×. */
export function nextSpeed(speed: number): number {
  const i = SPEEDS.indexOf(speed);
  if (i < 0) return 1;
  return SPEEDS[(i + 1) % SPEEDS.length];
}

/** "1×", "0.5×", "0.25×" */
export function fmtSpeed(speed: number): string {
  return `${speed}×`;
}

/** What a press on the clip was: a tap, a sideways swipe (its direction), or nothing. */
export function classifyPress(dx: number, dy: number, phone: boolean): 'tap' | 'next' | 'prev' | null {
  if (Math.hypot(dx, dy) < TAP_SLOP) return 'tap';
  if (!phone) return null;
  if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? 'next' : 'prev';
  return null;
}

// ── Saved choices ───────────────────────────────────────────────────────────

export const PREFS_KEY = 'imagelab.next.player.v1';

export interface PlayerPrefs {
  loop: boolean;
  /** Applies to clips with a soundtrack only; silent clips are always muted. */
  muted: boolean;
  /** 0..1 */
  volume: number;
  speed: number;
}

export const DEFAULT_PREFS: PlayerPrefs = { loop: true, muted: false, volume: 1, speed: 1 };

/** The saved preferences from their JSON; anything missing or odd falls back to the default. */
export function parsePrefs(raw: string | null | undefined): PlayerPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { ...DEFAULT_PREFS }; }
  if (!obj || typeof obj !== 'object') return { ...DEFAULT_PREFS };
  const o = obj as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    loop: typeof o.loop === 'boolean' ? o.loop : DEFAULT_PREFS.loop,
    muted: typeof o.muted === 'boolean' ? o.muted : DEFAULT_PREFS.muted,
    volume: Math.min(1, Math.max(0, num(o.volume, DEFAULT_PREFS.volume))),
    speed: SPEEDS.includes(num(o.speed, 1)) ? num(o.speed, 1) : 1,
  };
}

/** The element's starting mute: silent clips always, clips with sound as the user last chose. */
export function initialMuted(hasAudio: boolean, prefs: Pick<PlayerPrefs, 'muted'>): boolean {
  return !hasAudio || prefs.muted;
}
