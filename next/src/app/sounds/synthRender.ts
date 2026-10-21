/**
 * The pure offline renderer of a synth `Patch` (FIXLIST-2 "synth sounds"): the same signal path
 * as the live Web Audio graph (synthVoice.ts) — oscillator / FM / noise → biquad (Web Audio's
 * filter formulas) → envelope → equal-power pan → tanh shaper → gain → the room (convolution) —
 * computed sample by sample from the same param events (synthPatch.ts). Used by node tests
 * (clipping, DC, clicks, length, loudness) and, in the browser, to measure each sound's loudness
 * once so every action sits at its category's level. Pure: imports only synthPatch.
 */
import {
  envEvents, filterEvents, fmDepthEvents, freqEvents, layerEnd, noiseSamples, panEvents, paramAt,
  patchLength, shape, shaperCurve, dbToGain, type Layer, type Patch, type ParamEvent,
} from './synthPatch';

export interface Stereo { l: Float32Array; r: Float32Array; sr: number }

/** Biquad coefficients, Web Audio spec (lowpass / highpass Q in dB there: we pass linear q). */
export function biquad(type: 'lowpass' | 'highpass' | 'bandpass' | 'highshelf', f0: number, q: number, sr: number, gainDb = 0) {
  const f = Math.min(f0, sr / 2 - 1);
  const w0 = (2 * Math.PI * f) / sr;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'highshelf') {
    const A = Math.pow(10, gainDb / 40);
    const alpha = (sw / 2) * Math.sqrt(2); // S = 1
    const sa = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) + (A - 1) * cw + sa);
    b1 = -2 * A * ((A - 1) + (A + 1) * cw);
    b2 = A * ((A + 1) + (A - 1) * cw - sa);
    a0 = (A + 1) - (A - 1) * cw + sa;
    a1 = 2 * ((A - 1) - (A + 1) * cw);
    a2 = (A + 1) - (A - 1) * cw - sa;
  } else {
    const alpha = sw / (2 * Math.max(1e-4, q));
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Runs a biquad in place (direct form I). `fAt(n)` = cutoff per sample, null = constant. */
function filterRun(x: Float32Array, from: number, to: number, type: 'lowpass' | 'highpass' | 'bandpass' | 'highshelf', q: number, sr: number, f: number | ((n: number) => number), gainDb = 0) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let c = biquad(type, typeof f === 'number' ? f : f(from), q, sr, gainDb);
  let last = typeof f === 'number' ? f : -1;
  for (let n = from; n < to; n++) {
    if (typeof f !== 'number') {
      const fn = f(n);
      if (Math.abs(fn - last) > 0.05) { c = biquad(type, fn, q, sr, gainDb); last = fn; }
    }
    const xn = x[n];
    const y = c.b0 * xn + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xn; y2 = y1; y1 = y;
    x[n] = y;
  }
}

const TAU = 2 * Math.PI;

function triangle(phase: number): number {
  const p = phase - Math.floor(phase);
  return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
}

/** One layer, mono, into `buf` (from its start sample), before the pan. */
function renderLayer(l: Layer, sr: number, buf: Float32Array, extraDb: number) {
  const n0 = Math.round((l.at / 1000) * sr);
  const n1 = Math.min(buf.length, Math.ceil((layerEnd(l) / 1000) * sr) + 1);
  if (l.src === 'osc') {
    const fev = freqEvents(l);
    const mev = l.fm ? freqEvents(l, l.fm.ratio) : null;
    const dev = l.fm ? fmDepthEvents(l) : null;
    const det = Math.pow(2, (l.detune ?? 0) / 1200);
    let ph = 0, mph = 0;
    const tri = l.wave === 'triangle';
    for (let n = n0; n < n1; n++) {
      const t = n / sr;
      const f = paramAt(fev, t, fev[0].v);
      let m = 0;
      if (mev && dev) {
        m = Math.sin(TAU * mph) * paramAt(dev, t, dev[0].v);
        mph += paramAt(mev, t, mev[0].v) / sr;
      }
      buf[n] = tri ? triangle(ph) : Math.sin(TAU * ph);
      ph += ((f + m) * det) / sr;
    }
  } else {
    const len = sr; // one second, looped (as the engine's buffer)
    const noise = noiseSamples(l.seed ?? 1, len);
    for (let n = n0; n < n1; n++) buf[n] = noise[(n - n0) % len];
  }
  if (l.filter) {
    const fe = filterEvents(l);
    const q = l.filter.q ?? (l.filter.type === 'bandpass' ? 1 : Math.SQRT1_2);
    const constant = fe.length < 2;
    filterRun(buf, n0, n1, l.filter.type, q, sr, constant ? l.filter.freq : (n) => paramAt(fe, n / sr, fe[0].v));
  }
  const env = envEvents(l, extraDb);
  for (let n = n0; n < n1; n++) buf[n] *= paramAt(env, n / sr);
  return { n0, n1 };
}

/**
 * Render a patch: dry stereo at `gain`, plus the room when `ir` is given (`patch.reverb` dB send),
 * `tailMs` of extra room after the dry end. `extraDb` adds to every layer (per-play variation).
 */
export function renderPatch(p: Patch, sr: number, o: { gain?: number; ir?: [Float32Array, Float32Array] | null; tailMs?: number } = {}): Stereo {
  const dryLen = Math.ceil((patchLength(p) / 1000) * sr) + 2;
  const wet = !!o.ir && p.reverb !== undefined;
  const len = dryLen + (wet ? o.ir![0].length + Math.round(((o.tailMs ?? 0) / 1000) * sr) : 0);
  const l = new Float32Array(len);
  const r = new Float32Array(len);
  const tmp = new Float32Array(len);
  for (const layer of p.layers) {
    tmp.fill(0);
    const { n0, n1 } = renderLayer(layer, sr, tmp, 0);
    const pev: ParamEvent[] = panEvents(layer);
    const still = pev.length < 2;
    let gl = 0, gr = 0;
    if (still) { const x = (pev[0].v + 1) / 2; gl = Math.cos((x * Math.PI) / 2); gr = Math.sin((x * Math.PI) / 2); }
    for (let n = n0; n < n1; n++) {
      if (!still) { const x = (paramAt(pev, n / sr, pev[0].v) + 1) / 2; gl = Math.cos((x * Math.PI) / 2); gr = Math.sin((x * Math.PI) / 2); }
      l[n] += tmp[n] * gl;
      r[n] += tmp[n] * gr;
    }
  }
  if (p.drive && p.drive > 1) {
    const curve = shaperCurve(p.drive);
    for (let n = 0; n < dryLen; n++) { l[n] = shape(curve, l[n]); r[n] = shape(curve, r[n]); }
  }
  const g = o.gain ?? 1;
  if (g !== 1) for (let n = 0; n < len; n++) { l[n] *= g; r[n] *= g; }
  if (wet) {
    const send = dbToGain(p.reverb!);
    const wl = convolve(l.subarray(0, dryLen), o.ir![0]);
    const wr = convolve(r.subarray(0, dryLen), o.ir![1]);
    for (let n = 0; n < len && n < wl.length; n++) { l[n] += wl[n] * send; r[n] += wr[n] * send; }
  }
  return { l, r, sr };
}

// ---- FFT convolution (the room) ------------------------------------------------------------------

function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = i + k, b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

export function convolve(x: Float32Array, h: Float32Array): Float32Array {
  const outLen = x.length + h.length - 1;
  let n = 1;
  while (n < outLen) n <<= 1;
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  ar.set(x); br.set(h);
  fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) {
    const r = ar[i] * br[i] - ai[i] * bi[i];
    ai[i] = ar[i] * bi[i] + ai[i] * br[i];
    ar[i] = r;
  }
  fft(ar, ai, true);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = ar[i];
  return out;
}

// ---- measuring ------------------------------------------------------------------------------------

/**
 * A simple loudness estimate, dB: K-weighting-like pre-filter (high-pass 100 Hz, +4 dB shelf over
 * 1.5 kHz), mean square summed over both channels in 50 ms windows (5 ms hop), the loudest window.
 * Short sounds read quieter, as the ear hears them. A centred full-scale sine ≈ -3 dB.
 */
export function loudnessDb(s: Stereo): number {
  const win = Math.max(1, Math.round(0.05 * s.sr));
  const hop = Math.max(1, Math.round(0.005 * s.sr));
  const chans = [s.l, s.r].map((c) => {
    const x = Float32Array.from(c);
    filterRun(x, 0, x.length, 'highpass', Math.SQRT1_2, s.sr, 100);
    filterRun(x, 0, x.length, 'highshelf', 0, s.sr, 1500, 4);
    return x;
  });
  const sq = new Float64Array(s.l.length + 1);
  for (let i = 0; i < s.l.length; i++) sq[i + 1] = sq[i] + chans[0][i] ** 2 + chans[1][i] ** 2;
  let best = 0;
  const n = s.l.length;
  for (let a = 0; a < Math.max(1, n - win + 1); a += hop) {
    const b = Math.min(n, a + win);
    best = Math.max(best, (sq[b] - sq[a]) / win);
  }
  return best > 0 ? 10 * Math.log10(best) : -Infinity;
}

export interface Stats { peakDb: number; rmsDb: number; dc: number; first: number; last: number; activeMs: number; lengthMs: number }

/** Peak, plain RMS over the active part, DC (mean / peak), first / last samples, active length (to -60 dB re peak). */
export function stats(s: Stereo): Stats {
  let peak = 0;
  for (const c of [s.l, s.r]) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  const floor = peak * 1e-3;
  let lastActive = 0;
  let sum = 0, sumL = 0, sumR = 0;
  for (let i = 0; i < s.l.length; i++) {
    if (Math.abs(s.l[i]) > floor || Math.abs(s.r[i]) > floor) lastActive = i;
    sumL += s.l[i]; sumR += s.r[i];
  }
  for (let i = 0; i <= lastActive; i++) sum += s.l[i] ** 2 + s.r[i] ** 2;
  const n = s.l.length;
  return {
    peakDb: 20 * Math.log10(peak || 1e-12),
    rmsDb: 10 * Math.log10(sum / (2 * (lastActive + 1)) || 1e-24),
    dc: peak ? Math.max(Math.abs(sumL / n), Math.abs(sumR / n)) / peak : 0,
    first: Math.max(Math.abs(s.l[0]), Math.abs(s.r[0])),
    last: Math.max(Math.abs(s.l[n - 1]), Math.abs(s.r[n - 1])),
    activeMs: ((lastActive + 1) / s.sr) * 1000,
    lengthMs: (n / s.sr) * 1000,
  };
}
