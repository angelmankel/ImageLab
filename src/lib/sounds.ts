/**
 * Generation sounds, carried over from ImageLab v1: a short rising blip when a job is queued and
 * a soft two-note chime when its image lands. Synthesised with the Web Audio API, so there are no
 * files to ship. Volume 0 is off.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundState {
  /** 0..1. Starts at half, as v1 did. */
  volume: number;
  setVolume: (volume: number) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      volume: 0.5,
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
    }),
    { name: 'imagelab.sound.v1' },
  ),
);

let ctx: AudioContext | null = null;

/** One context for the page. A browser only lets it start after a user gesture, which the
 *  Generate click is; a chime for a job queued before any click may stay silent, and that is fine. */
function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, length: number, vol: number, rampTo?: number) {
  const c = audio();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  const t0 = c.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, t0 + 0.08);
  gain.gain.setValueAtTime(0.001, c.currentTime);
  gain.gain.setValueAtTime(0.12 * vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + length);
  osc.start(t0);
  osc.stop(t0 + length);
}

/** A quick soft blip, 600 → 800 Hz. Plays when a generation is queued. */
export function playSubmitSound() {
  const vol = useSoundStore.getState().volume;
  if (vol <= 0) return;
  try { tone(600, 0, 0.1, vol, 800); } catch { /* sound is never worth an error */ }
}

/** A gentle C5 → E5 chime. Plays when a generation's image arrives. */
export function playCompleteSound() {
  const vol = useSoundStore.getState().volume;
  if (vol <= 0) return;
  try {
    tone(523.25, 0, 0.3, vol);
    tone(659.25, 0.12, 0.28, vol);
  } catch { /* sound is never worth an error */ }
}
