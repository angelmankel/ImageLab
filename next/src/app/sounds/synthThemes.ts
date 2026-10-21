/**
 * The synthesised sound themes (FIXLIST-2 "synth sounds"): what each action SOUNDS like, in one
 * place. A recipe per action says what happens musically (which notes of the key, when, how
 * long, a tap / a breath of air / a low thump); a theme says what the instrument is:
 *   - Soft:  warm sine with a whisper of FM on the attack, dark noise, almost dry;
 *   - Glass: FM bells (inharmonic 1 : 3.5), a faint two-octave shimmer, a little room;
 *   - Pop:   round sine "bloops" that rise into pitch, a touch of triangle body, short and dry.
 * Every note is from D major pentatonic (synthPatch `hz(step)`), so all sounds harmonise.
 * Loudness: each action has a category with a target level; the engine measures each patch once
 * (synthRender `loudnessDb`) and scales it to that target, so a 30 ms click and a 0.8 s chime
 * feel equally present. Pure: imports synthPatch only (types from soundActions).
 */
import type { SoundAction, SynthThemeId } from './soundActions';
import { hz, type Layer, type Patch, layerEnd } from './synthPatch';

export type SoundCategory = 'tick' | 'ui' | 'motion' | 'event' | 'chime' | 'alert';

/** Target loudness per category (synthRender `loudnessDb` at gain 1). */
export const CATEGORY_DB: Record<SoundCategory, number> = {
  tick: -34, ui: -21, motion: -23, event: -18, chime: -16, alert: -18,
};

/** Longest a sound may be (dry), ms. */
export const MAX_MS: Record<SoundCategory, number> = {
  tick: 60, ui: 400, motion: 400, event: 400, chime: 900, alert: 400,
};

export const ACTION_CATEGORY: Record<SoundAction, SoundCategory> = {
  hover: 'tick', click: 'ui', toggleOn: 'ui', toggleOff: 'ui', tab: 'ui', open: 'motion', close: 'motion',
  queued: 'event', done: 'chime', allDone: 'chime', download: 'chime', success: 'event', favorite: 'event',
  copy: 'ui', delete: 'event', undo: 'motion', redo: 'motion', notify: 'event', warning: 'alert',
  error: 'alert', dropOk: 'event', dropRejected: 'ui',
};

interface NoteOpts { attack?: number; bright?: number; pan?: number; dull?: boolean }

/** A theme = an instrument for the recipes. Times ms, levels dB (relative, normalised later). */
export interface SynthTheme {
  id: SynthThemeId;
  /** One pitched note (step of the key), `len` = its ring (release), ms. */
  note(step: number, at: number, len: number, db: number, o?: NoteOpts): Layer[];
  /** A soft tap: a short pitched body + a breath of noise. */
  tap(step: number, at: number, db: number): Layer[];
  /** Air moving: band-passed noise sweeping up or down, `len` ms. */
  air(dir: 'up' | 'down', at: number, len: number, db: number, pan?: [number, number]): Layer[];
  /** A low, soft thump that falls into `step`. */
  thump(step: number, at: number, len: number, db: number): Layer[];
  /** The hover tick. */
  tick(): Layer[];
  drive: number;
  reverb?: number;
}

// ---- the three instruments -----------------------------------------------------------------------

/** Two slightly detuned copies spread left / right: width without phasiness. */
function wide(l: Layer, cents: number, spread: number): Layer[] {
  if (!cents) return [l];
  return [
    { ...l, detune: (l.detune ?? 0) - cents, pan: (l.pan ?? 0) - spread, level: l.level - 3 },
    { ...l, detune: (l.detune ?? 0) + cents, pan: (l.pan ?? 0) + spread, level: l.level - 3 },
  ];
}

const soft: SynthTheme = {
  id: 'soft',
  drive: 1.4,
  reverb: -22,
  note(step, at, len, db, o = {}) {
    const f = hz(step);
    const body: Layer = {
      src: 'osc', wave: 'sine', freq: f, at, level: db, pan: o.pan,
      fm: { ratio: 1, index: o.dull ? 0.35 : 0.5 + 0.6 * (o.bright ?? 0.5), indexTo: 0.02, time: Math.min(len, 90) },
      env: { attack: o.attack ?? 3, release: len },
    };
    return wide(body, 3, 0.18);
  },
  tap(step, at, db) {
    return [
      { src: 'osc', wave: 'sine', freq: hz(step) * 1.5, freqTo: hz(step), glide: 12, at, level: db, env: { attack: 0.8, release: 32 } },
      { src: 'noise', seed: 3, filter: { type: 'bandpass', freq: 1800, q: 0.9 }, at, level: db - 6, env: { attack: 0.5, release: 9 } },
    ];
  },
  air(dir, at, len, db, pan = [-0.25, 0.25]) {
    const [f0, f1] = dir === 'up' ? [500, 2600] : [2400, 450];
    const att = dir === 'up' ? len * 0.55 : len * 0.25;
    const mk = (seed: number, p0: number, p1: number): Layer => ({
      src: 'noise', seed, at, level: db - 3, pan: p0, panTo: p1,
      filter: { type: 'bandpass', freq: f0, freqTo: f1, time: len * 0.8, q: 1.1 },
      env: { attack: att, release: len - att },
    });
    return [mk(5, pan[0], pan[0] * 0.5), mk(6, pan[1], pan[1] * 0.5)];
  },
  thump(step, at, len, db) {
    return [
      { src: 'osc', wave: 'sine', freq: hz(step) * 1.7, freqTo: hz(step), glide: 45, at, level: db, env: { attack: 2, release: len } },
      { src: 'noise', seed: 7, filter: { type: 'lowpass', freq: 500, q: 0.7 }, at, level: db - 8, env: { attack: 1, release: len * 0.35 } },
    ];
  },
  tick() {
    return [{ src: 'osc', wave: 'sine', freq: hz(15), at: 0, level: -6, env: { attack: 0.6, release: 10 } }];
  },
};

const glass: SynthTheme = {
  id: 'glass',
  drive: 1.1,
  reverb: -13,
  note(step, at, len, db, o = {}) {
    const f = hz(step);
    const ring = len * 1.2;
    const bell: Layer = {
      src: 'osc', wave: 'sine', freq: f, at, level: db, pan: o.pan,
      fm: { ratio: 3.5, index: o.dull ? 0.5 : 0.9 + 1.1 * (o.bright ?? 0.5), indexTo: 0.04, time: ring * 0.6 },
      env: { attack: o.attack ?? 1.2, release: ring },
    };
    const shimmer: Layer = { src: 'osc', wave: 'sine', freq: f * 4, at, level: db - (o.dull ? 30 : 20), pan: o.pan, env: { attack: 1, release: ring * 0.3 } };
    return [...wide(bell, 4, 0.3), shimmer];
  },
  tap(step, at, db) {
    return [
      { src: 'osc', wave: 'sine', freq: hz(step + 5), at, level: db - 1, fm: { ratio: 3.5, index: 1.2, indexTo: 0.05, time: 30 }, env: { attack: 0.6, release: 42 } },
      { src: 'noise', seed: 3, filter: { type: 'bandpass', freq: 5200, q: 1.8 }, at, level: db - 9, env: { attack: 0.4, release: 6 } },
    ];
  },
  air(dir, at, len, db, pan = [-0.35, 0.35]) {
    const [f0, f1] = dir === 'up' ? [900, 5200] : [4800, 800];
    const att = dir === 'up' ? len * 0.55 : len * 0.25;
    const mk = (seed: number, p0: number, p1: number): Layer => ({
      src: 'noise', seed, at, level: db - 3, pan: p0, panTo: p1,
      filter: { type: 'bandpass', freq: f0, freqTo: f1, time: len * 0.8, q: 1.6 },
      env: { attack: att, release: len - att },
    });
    const tone: Layer = {
      src: 'osc', wave: 'sine', freq: hz(dir === 'up' ? 10 : 13), freqTo: hz(dir === 'up' ? 13 : 10), glide: len * 0.7,
      at, level: db - 14, env: { attack: att, release: len - att },
    };
    return [mk(5, pan[0], pan[0] * 0.5), mk(6, pan[1], pan[1] * 0.5), tone];
  },
  thump(step, at, len, db) {
    return [
      { src: 'osc', wave: 'sine', freq: hz(step) * 1.6, freqTo: hz(step), glide: 40, at, level: db, env: { attack: 2, release: len } },
      { src: 'osc', wave: 'sine', freq: hz(step + 10), at, level: db - 16, fm: { ratio: 3.5, index: 0.6, indexTo: 0.02, time: len * 0.5 }, env: { attack: 1, release: len * 0.8 } },
    ];
  },
  tick() {
    return [{ src: 'osc', wave: 'sine', freq: hz(17), at: 0, level: -6, fm: { ratio: 3.5, index: 0.4, indexTo: 0.02, time: 8 }, env: { attack: 0.5, release: 12 } }];
  },
};

const pop: SynthTheme = {
  id: 'pop',
  drive: 1.8,
  reverb: -26,
  note(step, at, len, db, o = {}) {
    const f = hz(step);
    const ring = len * 0.75;
    const bloop: Layer = {
      src: 'osc', wave: 'sine', freq: f * 0.72, freqTo: f, glide: 20, at, level: db, pan: o.pan,
      env: { attack: o.attack ?? 1.5, release: ring },
    };
    const body: Layer = {
      src: 'osc', wave: 'triangle', freq: f * 0.72, freqTo: f, glide: 20, at, level: db - (o.dull ? 20 : 14), pan: o.pan,
      filter: { type: 'lowpass', freq: 2400, q: 0.7 }, env: { attack: 2, release: ring * 0.6 },
    };
    return [...wide(bloop, 2, 0.12), body];
  },
  tap(step, at, db) {
    return [{ src: 'osc', wave: 'sine', freq: hz(step + 2) * 0.6, freqTo: hz(step + 2), glide: 14, at, level: db, env: { attack: 1, release: 40 } }];
  },
  air(dir, at, len, db, pan = [-0.2, 0.2]) {
    const [f0, f1] = dir === 'up' ? [380, 1800] : [1700, 360];
    const att = dir === 'up' ? len * 0.5 : len * 0.25;
    const mk = (seed: number, p0: number, p1: number): Layer => ({
      src: 'noise', seed, at, level: db - 3, pan: p0, panTo: p1,
      filter: { type: 'bandpass', freq: f0, freqTo: f1, time: len * 0.8, q: 2.6 },
      env: { attack: att, release: len - att },
    });
    const tone: Layer = {
      src: 'osc', wave: 'sine', freq: hz(dir === 'up' ? 5 : 8), freqTo: hz(dir === 'up' ? 8 : 5), glide: len * 0.6,
      at, level: db - 9, env: { attack: att, release: len - att },
    };
    return [mk(5, pan[0], pan[0] * 0.5), mk(6, pan[1], pan[1] * 0.5), tone];
  },
  thump(step, at, len, db) {
    return [{ src: 'osc', wave: 'sine', freq: hz(step) * 1.9, freqTo: hz(step), glide: 35, at, level: db, env: { attack: 1.5, release: len * 0.8 } }];
  },
  tick() {
    return [{ src: 'osc', wave: 'sine', freq: hz(12) * 0.75, freqTo: hz(12), glide: 6, at: 0, level: -6, env: { attack: 0.6, release: 12 } }];
  },
};

export const SYNTH_THEMES: Record<SynthThemeId, SynthTheme> = { soft, glass, pop };

// ---- the recipes (what each action means) -------------------------------------------------------

type Recipe = (t: SynthTheme) => Layer[];

const RECIPES: Record<SoundAction, Recipe> = {
  // An almost silent high tick.
  hover: (t) => t.tick(),
  // A short warm tap.
  click: (t) => t.tap(3, 0, -6),
  // Two quick notes up (A5 → D6) / down (F#5 → D5).
  toggleOn: (t) => [...t.note(8, 0, 60, -8, { bright: 0.4 }), ...t.note(10, 42, 90, -6, { bright: 0.6 })],
  toggleOff: (t) => [...t.note(7, 0, 60, -7, { dull: true }), ...t.note(5, 42, 90, -7, { dull: true })],
  // A light tap with a high, short note (B5) on top: a page turning.
  tab: (t) => [...t.tap(4, 0, -9), ...t.note(9, 6, 55, -12, { bright: 0.3 })],
  // A breath of air rising / falling.
  open: (t) => t.air('up', 0, 240, -6),
  close: (t) => t.air('down', 0, 200, -6),
  // One light pluck (A5).
  queued: (t) => [...t.tap(5, 0, -14), ...t.note(8, 0, 170, -6, { bright: 0.7 })],
  // D6 then F#6: a bright major third.
  done: (t) => [...t.note(10, 0, 480, -6), ...t.note(12, 95, 560, -6)],
  // A5 D6 F#6 A6 rising over a low D: the batch resolves.
  allDone: (t) => [
    ...t.note(0, 0, 640, -14, { dull: true }),
    ...t.note(8, 0, 380, -8), ...t.note(10, 75, 400, -8), ...t.note(12, 150, 440, -8), ...t.note(13, 225, 560, -6),
  ],
  // A6 falling to D6 with a soft landing: in place.
  download: (t) => [...t.note(13, 0, 260, -8), ...t.note(10, 85, 520, -6), ...t.thump(0, 85, 160, -16)],
  // D6 → A6, quick: a nod.
  success: (t) => [...t.note(10, 0, 180, -7), ...t.note(13, 60, 280, -7)],
  // Four tiny notes racing up (D6 F#6 A6 D7): a sparkle.
  favorite: (t) => [
    ...t.note(10, 0, 110, -10, { bright: 0.8 }), ...t.note(12, 34, 120, -9, { bright: 0.8 }),
    ...t.note(13, 68, 140, -8, { bright: 0.9 }), ...t.note(15, 102, 230, -8, { bright: 1 }),
  ],
  // Tap-tap: one thing, twice.
  copy: (t) => [...t.tap(6, 0, -7), ...t.tap(6, 62, -8)],
  // A soft low thump falling to A3: gone, not alarming.
  delete: (t) => t.thump(-2, 0, 200, -4),
  // A swish to the left / right, swelling then cut (a reversed sound's shape).
  undo: (t) => t.air('down', 0, 170, -6).map((l) => ({ ...l, pan: 0.85, panTo: -0.85, env: { attack: 125, release: 40 } })),
  redo: (t) => t.air('up', 0, 170, -6).map((l) => ({ ...l, pan: -0.85, panTo: 0.85, env: { attack: 125, release: 40 } })),
  // One soft note (B5).
  notify: (t) => t.note(9, 0, 200, -6, { bright: 0.2 }),
  // A5 then E5, rounded: look here.
  warning: (t) => [...t.note(8, 0, 150, -6, { attack: 8, dull: true }), ...t.note(6, 150, 200, -6, { attack: 8, dull: true })],
  // A low, muted double buzz on D3 (two detuned triangles behind a low-pass): never harsh.
  error: () => {
    const pulse = (at: number): Layer[] => [-14, 14].map((c, i) => ({
      src: 'osc', wave: 'triangle', freq: hz(-5), detune: c, at, level: -5, pan: i ? 0.15 : -0.15,
      filter: { type: 'lowpass', freq: 750, q: 0.8 }, env: { attack: 5, hold: 45, release: 80 },
    }));
    return [...pulse(0), ...pulse(140)];
  },
  // A plop into place, then a small bright note (D6).
  dropOk: (t) => [...t.thump(5, 0, 110, -6), ...t.note(10, 45, 170, -10)],
  // Two dull low taps going down: no.
  dropRejected: (t) => [...t.thump(2, 0, 80, -6), ...t.thump(0, 95, 100, -7)],
};

/** Shortens every layer that would ring past `max` ms (releases only; starts stay). */
function fit(layers: Layer[], max: number): Layer[] {
  return layers.map((l) => {
    const over = layerEnd(l) - max;
    if (over <= 0) return l;
    return { ...l, env: { ...l.env, release: Math.max(4, l.env.release - over) } };
  });
}

/**
 * The patch of one action in one theme. `vary` (-1..1) nudges pitch (±8 cents) and level
 * (±0.5 dB) so a run of clicks never sounds like a machine gun; 0 = the reference.
 */
export function buildPatch(theme: SynthThemeId, action: SoundAction, vary = 0): Patch {
  const t = SYNTH_THEMES[theme];
  const cat = ACTION_CATEGORY[action];
  let layers = fit(RECIPES[action](t), MAX_MS[cat] - 10);
  if (vary) layers = layers.map((l) => ({ ...l, detune: (l.detune ?? 0) + vary * 8, level: l.level + vary * 0.5 }));
  return { layers, drive: t.drive, reverb: cat === 'tick' ? undefined : t.reverb };
}
