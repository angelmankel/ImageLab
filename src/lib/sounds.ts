/**
 * App sounds: the shared switchboard (mute, master volume, `playSound`).
 *
 * The next UI registers a sample player (`setSoundPlayer`, next/src/app/sounds: Donny's UI sound
 * pack, one sound + volume per action, FIXLIST-2 "New UI sounds"); while one is registered every
 * `playSound` goes to it. Without one (the classic app) the old synthesised tones below play.
 *
 * Carried over from v1: a short rising blip when a job is queued (`playSubmitSound`) and a soft
 * two-note chime when its image lands (`playCompleteSound`). The next UI (item 44) adds small UI
 * sounds — hover, click, toggle, success, error — through `playSound(kind)`, a mute switch
 * (`muted`, the top-right MuteToggle) and a per-kind on / off (Settings → Sounds). All of it lives
 * in this one store (`imagelab.sound.v1`, this browser), so the classic app obeys the mute too.
 * Volume 0 or muted = silence.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The synthesised kinds (classic) plus the next UI's actions (`next/src/app/sounds/soundActions.ts`). */
export type SoundKind =
  | 'hover' | 'click' | 'toggle' | 'success' | 'error' | 'queued' | 'done'
  | 'toggleOn' | 'toggleOff' | 'tab' | 'open' | 'close' | 'allDone' | 'download' | 'favorite' | 'copy'
  | 'delete' | 'undo' | 'redo' | 'notify' | 'warning' | 'dropOk' | 'dropRejected';

/** A registered sample player: plays `kind` (already gated by mute and the first gesture). */
export type SoundPlayer = (kind: SoundKind, opts: { on?: boolean }) => void;
let player: SoundPlayer | null = null;
/** The next UI's sample player; null puts the synthesised tones back. */
export function setSoundPlayer(p: SoundPlayer | null) { player = p; }

type SynthKind = 'hover' | 'click' | 'toggle' | 'success' | 'error' | 'queued' | 'done';
const DEFAULT_KINDS: Record<SynthKind, boolean> = { hover: true, click: true, toggle: true, success: true, error: true, queued: true, done: true };

interface SoundState {
  /** 0..1. Starts at half, as v1 did. */
  volume: number;
  /** The mute switch: silences every sound, keeps the volume. */
  muted: boolean;
  /** Per-kind on / off of the synthesised tones (the next UI picks a sound or none per action instead). */
  kinds: Record<SynthKind, boolean>;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setKind: (kind: SynthKind, on: boolean) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      volume: 0.5,
      muted: false,
      kinds: DEFAULT_KINDS,
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setKind: (kind, on) => set((s) => ({ kinds: { ...s.kinds, [kind]: on } })),
    }),
    {
      name: 'imagelab.sound.v1',
      // An older save has no `kinds` or only some: fill the rest from the defaults.
      merge: (saved, cur) => {
        const p = (saved ?? {}) as Partial<SoundState>;
        return { ...cur, ...p, kinds: { ...DEFAULT_KINDS, ...(p.kinds ?? {}) } };
      },
    },
  ),
);

let ctx: AudioContext | null = null;
/** True after the first press / key: browsers refuse audio before a user gesture. */
let gestured = false;
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true; };
  window.addEventListener('pointerdown', mark, { capture: true, once: true });
  window.addEventListener('keydown', mark, { capture: true, once: true });
}

/** One context for the page. A browser only lets it start after a user gesture, which the
 *  Generate click is; a chime for a job queued before any click may stay silent, and that is fine. */
function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, length: number, vol: number, rampTo?: number, type: OscillatorType = 'sine', peak = 0.12) {
  const c = audio();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  const t0 = c.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, t0 + Math.min(0.08, length));
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.setValueAtTime(peak * vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

/** The volume a synthesised kind plays at now, 0 = do not play. */
function level(kind: SoundKind): number {
  const s = useSoundStore.getState();
  if (s.muted || s.volume <= 0 || s.kinds[kind as SynthKind] === false) return 0;
  return s.volume;
}

/** True once the page has had a press or key (browsers refuse audio before one). */
export function soundGestured(): boolean { return gestured; }

let lastUi = 0;

/**
 * Play one UI sound. `on` picks the toggle's direction (up = on). Hover and click are quiet and
 * rate-limited (one per 35 ms), and nothing plays before the first user gesture.
 */
export function playSound(kind: SoundKind, opts: { on?: boolean } = {}) {
  if (player) {
    const st = useSoundStore.getState();
    if (st.muted || st.volume <= 0) return;
    if (!gestured && kind !== 'queued' && kind !== 'done' && kind !== 'allDone' && kind !== 'download') return;
    try { player(kind, opts); } catch { /* sound is never worth an error */ }
    return;
  }
  const vol = level(kind);
  if (vol <= 0) return;
  if (!gestured && kind !== 'queued' && kind !== 'done') return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (kind === 'hover' || kind === 'click') {
    if (now - lastUi < 35) return;
    lastUi = now;
  }
  try {
    switch (kind) {
      case 'hover': tone(2400, 0, 0.025, vol, undefined, 'sine', 0.018); break;
      case 'click': tone(1300, 0, 0.045, vol, 900, 'triangle', 0.06); break;
      case 'toggle':
        if (opts.on === false) { tone(880, 0, 0.05, vol, undefined, 'triangle', 0.05); tone(660, 0.045, 0.06, vol, undefined, 'triangle', 0.05); }
        else { tone(660, 0, 0.05, vol, undefined, 'triangle', 0.05); tone(990, 0.045, 0.07, vol, undefined, 'triangle', 0.05); }
        break;
      case 'success': tone(1046.5, 0, 0.12, vol, undefined, 'sine', 0.07); tone(1568, 0.07, 0.16, vol, undefined, 'sine', 0.06); break;
      case 'error': tone(260, 0, 0.18, vol, 190, 'triangle', 0.09); break;
      case 'queued': tone(600, 0, 0.1, vol, 800); break;
      case 'done': tone(523.25, 0, 0.3, vol); tone(659.25, 0.12, 0.28, vol); break;
    }
  } catch { /* sound is never worth an error */ }
}

/** A quick soft blip, 600 → 800 Hz. Plays when a generation is queued. */
export function playSubmitSound() {
  playSound('queued');
}

/** A gentle C5 → E5 chime. Plays when a generation's image arrives. */
export function playCompleteSound() {
  playSound('done');
}
