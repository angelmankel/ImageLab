/**
 * The synthesised UI sounds' language (FIXLIST-2 "synth sounds"): a sound is a `Patch`, a short
 * list of `Layer`s (an oscillator — sine / triangle, optionally FM — or seeded noise, through an
 * optional biquad, an envelope and a panner). Everything is plain numbers (Hz, ms, dB), so the
 * SAME patch drives the live Web Audio graph (synthVoice.ts) and the pure offline renderer
 * (synthRender.ts, node tests + loudness calibration). Every time-varying value is an AudioParam
 * event list built here (`*Events`), with Web Audio's exact ramp maths in `paramAt`, so both
 * renderers agree by construction. Pure: no imports.
 */

export type Wave = 'sine' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/** Attack (linear from 0), decay to `sustain` (exp), hold, release to -60 dB (exp), then 6 ms to 0. All ms. */
export interface Env { attack: number; decay?: number; sustain?: number; hold?: number; release: number }

export interface Layer {
  src: 'osc' | 'noise';
  wave?: Wave;
  /** Hz (osc). */
  freq?: number;
  /** Exponential glide from `freq` to `freqTo` over `glide` ms after the start. */
  freqTo?: number;
  glide?: number;
  /** Cents (osc). */
  detune?: number;
  /** FM: a sine at freq × ratio, depth index × its frequency; the index glides (exp) to `indexTo` over `time` ms. */
  fm?: { ratio: number; index: number; indexTo?: number; time?: number };
  /** Which noise buffer (noise). */
  seed?: number;
  /** Q is linear for every type (the engine converts lowpass / highpass to Web Audio's dB). */
  filter?: { type: FilterType; freq: number; freqTo?: number; time?: number; q?: number };
  /** Start, ms. */
  at: number;
  env: Env;
  /** Peak level, dB. */
  level: number;
  /** -1..1; `panTo` = a linear sweep over the layer's length. */
  pan?: number;
  panTo?: number;
}

export interface Patch {
  layers: Layer[];
  /** Gentle tanh saturation of the summed layers (1 = none). */
  drive?: number;
  /** Send to the shared room, dB (undefined = dry). */
  reverb?: number;
}

/** One AudioParam event: `set` = setValueAtTime, `lin` / `exp` = the ramps ending at `t` (seconds). */
export interface ParamEvent { k: 'set' | 'lin' | 'exp'; v: number; t: number }

export const TAIL_MS = 6;
const FLOOR = 1e-3; // -60 dB: the exponential release ends here, then a 6 ms line to true 0

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

// ---- the key ---------------------------------------------------------------------------------

/** Every tonal sound is in D major pentatonic (D E F# A B), so any two sounds harmonise. */
export const KEY_ROOT_MIDI = 62; // D4
const PENTA = [0, 2, 4, 7, 9];
/** Pentatonic step → MIDI note: 0 = D4, 5 = D5, 10 = D6, -5 = D3. */
export function midiOf(step: number): number {
  const o = Math.floor(step / 5);
  return KEY_ROOT_MIDI + 12 * o + PENTA[((step % 5) + 5) % 5];
}
/** Pentatonic step → Hz (equal temperament, A4 = 440). */
export function hz(step: number): number {
  return 440 * Math.pow(2, (midiOf(step) - 69) / 12);
}

// ---- timing ------------------------------------------------------------------------------------

function envTimes(e: Env) {
  const a = Math.max(0.5, e.attack);
  const d = e.sustain !== undefined && e.sustain < 1 ? Math.max(1, e.decay ?? 0) : 0;
  const h = Math.max(0, e.hold ?? 0);
  const r = Math.max(2, e.release);
  return { a, d, h, r, sus: d ? Math.max(FLOOR * 10, e.sustain ?? 1) : 1 };
}

/** When a layer has fully stopped, ms after the patch starts. */
export function layerEnd(l: Layer): number {
  const { a, d, h, r } = envTimes(l.env);
  return l.at + a + d + h + r + TAIL_MS;
}

/** The patch's length, ms (dry: the room's tail comes after). */
export function patchLength(p: Patch): number {
  let end = 0;
  for (const l of p.layers) end = Math.max(end, layerEnd(l));
  return end;
}

// ---- param events (seconds) --------------------------------------------------------------------

const s = (ms: number) => ms / 1000;

/** The envelope: 0 at the start, never a step, 0 at the end. */
export function envEvents(l: Layer, extraDb = 0): ParamEvent[] {
  const { a, d, h, r, sus } = envTimes(l.env);
  const peak = dbToGain(l.level + extraDb);
  const t0 = l.at;
  const ev: ParamEvent[] = [{ k: 'set', v: 0, t: s(t0) }, { k: 'lin', v: peak, t: s(t0 + a) }];
  let t = t0 + a;
  if (d) { t += d; ev.push({ k: 'exp', v: peak * sus, t: s(t) }); }
  if (h) { t += h; ev.push({ k: 'set', v: peak * sus, t: s(t) }); }
  t += r;
  ev.push({ k: 'exp', v: peak * sus * FLOOR, t: s(t) });
  ev.push({ k: 'lin', v: 0, t: s(t + TAIL_MS) });
  return ev;
}

/** A value that may glide (exp) to `to` over `ms` from the layer's start. */
function glideEvents(at: number, from: number, to: number | undefined, ms: number | undefined): ParamEvent[] {
  const ev: ParamEvent[] = [{ k: 'set', v: from, t: s(at) }];
  if (to !== undefined && to > 0 && to !== from) ev.push({ k: 'exp', v: to, t: s(at + Math.max(1, ms ?? 1)) });
  return ev;
}

export function freqEvents(l: Layer, mul = 1): ParamEvent[] {
  const f = (l.freq ?? 440) * mul;
  return glideEvents(l.at, f, l.freqTo !== undefined ? l.freqTo * mul : undefined, l.glide);
}

/** FM depth in Hz (index × the modulator's starting frequency). */
export function fmDepthEvents(l: Layer): ParamEvent[] {
  if (!l.fm) return [];
  const mf = (l.freq ?? 440) * l.fm.ratio;
  const to = l.fm.indexTo !== undefined ? Math.max(1e-3, l.fm.indexTo) * mf : undefined;
  return glideEvents(l.at, Math.max(1e-3, l.fm.index) * mf, to, l.fm.time);
}

export function filterEvents(l: Layer): ParamEvent[] {
  if (!l.filter) return [];
  return glideEvents(l.at, l.filter.freq, l.filter.freqTo, l.filter.time);
}

export function panEvents(l: Layer): ParamEvent[] {
  const p0 = clampPan(l.pan ?? 0);
  const ev: ParamEvent[] = [{ k: 'set', v: p0, t: s(l.at) }];
  if (l.panTo !== undefined && l.panTo !== l.pan) ev.push({ k: 'lin', v: clampPan(l.panTo), t: s(layerEnd(l)) });
  return ev;
}

const clampPan = (p: number) => Math.max(-1, Math.min(1, p));

/**
 * An AudioParam's value at `t` (seconds), Web Audio's rules: before the first event its value;
 * between events the NEXT event's ramp (linear / exponential) from the previous value, or a hold
 * when the next one is a `set`; after the last, the last value.
 */
export function paramAt(ev: readonly ParamEvent[], t: number, before = 0): number {
  if (!ev.length) return before;
  if (t < ev[0].t) return before;
  for (let i = 1; i < ev.length; i++) {
    const n = ev[i];
    if (t < n.t) {
      const p = ev[i - 1];
      if (n.k === 'set') return p.v;
      const x = (t - p.t) / (n.t - p.t);
      if (n.k === 'lin') return p.v + (n.v - p.v) * x;
      return p.v * Math.pow(n.v / p.v, x);
    }
  }
  return ev[ev.length - 1].v;
}

// ---- small helpers shared by both renderers ------------------------------------------------------

/** Seeded white noise in [-1, 1): mulberry32. */
export function noiseSamples(seed: number, n: number): Float32Array {
  let a = (seed * 0x9e3779b9) >>> 0 || 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }
  return out;
}

/** The WaveShaper curve of the gentle saturation: tanh(drive·x) / tanh(drive), odd, 0 at 0 (no DC). */
export function shaperCurve(drive: number, n = 1025): Float32Array {
  const c = new Float32Array(n);
  const k = Math.max(1.0001, drive);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

/** Web Audio's WaveShaper lookup (linear interpolation, clamped ends). */
export function shape(curve: Float32Array, x: number): number {
  const n = curve.length;
  const v = ((n - 1) / 2) * (x + 1);
  if (v <= 0) return curve[0];
  if (v >= n - 1) return curve[n - 1];
  const k = Math.floor(v);
  const f = v - k;
  return curve[k] * (1 - f) + curve[k + 1] * f;
}

/**
 * The master limiter's WaveShaper curve. Its input is the mix × 0.5 (so [-1, 1] stands for ±2,
 * +6 dB over full scale): exactly linear (× 2 back) up to -3 dBFS, then a tanh knee that reaches
 * 0 dBFS at +6 dB over. Zero latency, no make-up gain, odd (no DC).
 */
export function limiterCurve(n = 4097): Float32Array {
  const c = new Float32Array(n);
  const t = Math.SQRT1_2; // -3 dBFS
  for (let i = 0; i < n; i++) {
    const x = 2 * ((i * 2) / (n - 1) - 1);
    const a = Math.abs(x);
    const y = a <= t ? a : t + (1 - t) * Math.tanh((a - t) / (1 - t));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/**
 * The shared room: a short stereo impulse (8 ms pre-delay, ~0.7 s RT60, darker as it decays),
 * energy 1 per channel so the send level in dB is the wet level. Starts and ends at 0.
 */
export function makeImpulse(sr: number, seconds = 0.9, rt60 = 0.7): [Float32Array, Float32Array] {
  const n = Math.round(sr * seconds);
  const pre = Math.round(sr * 0.008);
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const noise = noiseSamples(9001 + ch * 77, n);
    const buf = out[ch];
    let lp = 0;
    let energy = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const fc = 7000 * Math.pow(1500 / 7000, Math.min(1, t / rt60));
      const a = Math.exp((-2 * Math.PI * fc) / sr);
      lp = (1 - a) * noise[i] + a * lp;
      const fadeIn = Math.min(1, t / 0.004);
      const fadeOut = Math.min(1, (n - 1 - i) / (sr * 0.02));
      buf[i] = lp * Math.exp((-6.91 * t) / rt60) * fadeIn * fadeOut;
      energy += buf[i] * buf[i];
    }
    const g = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = 0; i < n; i++) buf[i] *= g;
  }
  return out;
}
