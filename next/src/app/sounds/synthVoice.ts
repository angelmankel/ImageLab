/**
 * One synth sound, live (FIXLIST-2 "synth sounds"): a `Patch` → Web Audio nodes, scheduled from
 * `t0`. Per layer: OscillatorNode (+ an FM sine into its frequency) or a looping seeded-noise
 * buffer → BiquadFilterNode → envelope GainNode → StereoPannerNode; the layers sum into a bus →
 * tanh WaveShaper (gentle saturation) → the play's GainNode → the master, with a send to the
 * shared room. Every AudioParam gets the events of synthPatch.ts (the same ones the offline
 * renderer and the tests use): envelopes start and end at exactly 0, so no click. All nodes are
 * disconnected when the last source ends. Imports only synthPatch, so a fake context can test it.
 */
import {
  envEvents, filterEvents, fmDepthEvents, freqEvents, layerEnd, panEvents, patchLength, shaperCurve,
  dbToGain, type ParamEvent, type Patch,
} from './synthPatch';

/** The bits of BaseAudioContext used here (a fake one in tests). */
export type Ctx = Pick<BaseAudioContext, 'createOscillator' | 'createGain' | 'createBiquadFilter' | 'createBufferSource' | 'createWaveShaper'> & {
  createStereoPanner?: BaseAudioContext['createStereoPanner'];
};

export function applyEvents(param: AudioParam, ev: readonly ParamEvent[], t0: number) {
  if (!ev.length) return;
  param.value = ev[0].v;
  for (const e of ev) {
    const t = t0 + e.t;
    if (e.k === 'set') param.setValueAtTime(e.v, t);
    else if (e.k === 'lin') param.linearRampToValueAtTime(e.v, t);
    else param.exponentialRampToValueAtTime(e.v, t);
  }
}

const curves = new Map<number, Float32Array>();
function curveOf(drive: number): Float32Array {
  let c = curves.get(drive);
  if (!c) { c = shaperCurve(drive); curves.set(drive, c); }
  return c;
}

export interface Voice { stop: (at: number) => void; end: number }

/**
 * Start `p` at `t0` (context seconds) at `gain`, into `out` (+ `send` at the patch's reverb dB).
 * `noise(seed)` = a 1 s white-noise AudioBuffer for that seed. `onDone` fires once, when it ends.
 */
export function startPatch(c: Ctx, out: AudioNode, send: AudioNode | null, p: Patch, gain: number, t0: number,
  noise: (seed: number) => AudioBuffer, onDone?: () => void): Voice {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const bus = c.createGain();
  nodes.push(bus);
  let head: AudioNode = bus;
  if (p.drive && p.drive > 1) {
    const sh = c.createWaveShaper();
    sh.curve = curveOf(p.drive) as Float32Array<ArrayBuffer>;
    bus.connect(sh);
    nodes.push(sh);
    head = sh;
  }
  const level = c.createGain();
  level.gain.value = gain;
  head.connect(level);
  level.connect(out);
  nodes.push(level);
  if (send && p.reverb !== undefined) {
    const s = c.createGain();
    s.gain.value = dbToGain(p.reverb);
    level.connect(s);
    s.connect(send);
    nodes.push(s);
  }
  for (const l of p.layers) {
    const start = t0 + l.at / 1000;
    const stop = t0 + layerEnd(l) / 1000 + 0.01;
    let src: AudioScheduledSourceNode;
    if (l.src === 'osc') {
      const o = c.createOscillator();
      o.type = l.wave ?? 'sine';
      applyEvents(o.frequency, freqEvents(l), t0);
      if (l.detune) o.detune.value = l.detune;
      if (l.fm) {
        const m = c.createOscillator();
        m.type = 'sine';
        applyEvents(m.frequency, freqEvents(l, l.fm.ratio), t0);
        const depth = c.createGain();
        applyEvents(depth.gain, fmDepthEvents(l), t0);
        m.connect(depth);
        depth.connect(o.frequency);
        m.start(start);
        m.stop(stop);
        nodes.push(m, depth);
        sources.push(m);
      }
      src = o;
    } else {
      const b = c.createBufferSource();
      b.buffer = noise(l.seed ?? 1);
      b.loop = true;
      src = b;
    }
    nodes.push(src);
    let node: AudioNode = src;
    if (l.filter) {
      const f = c.createBiquadFilter();
      f.type = l.filter.type;
      const q = l.filter.q ?? (l.filter.type === 'bandpass' ? 1 : Math.SQRT1_2);
      // Web Audio reads a low / high-pass Q in dB, a band-pass Q as is.
      f.Q.value = l.filter.type === 'bandpass' ? q : 20 * Math.log10(q);
      applyEvents(f.frequency, filterEvents(l), t0);
      node.connect(f);
      nodes.push(f);
      node = f;
    }
    const env = c.createGain();
    applyEvents(env.gain, envEvents(l), t0);
    node.connect(env);
    nodes.push(env);
    node = env;
    if (c.createStereoPanner) {
      const pan = c.createStereoPanner();
      applyEvents(pan.pan, panEvents(l), t0);
      node.connect(pan);
      nodes.push(pan);
      node = pan;
    }
    node.connect(bus);
    src.start(start);
    src.stop(stop);
    sources.push(src);
  }
  const end = t0 + patchLength(p) / 1000 + 0.01;
  let left = sources.length;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } }
    onDone?.();
  };
  for (const s of sources) s.onended = () => { if (--left <= 0) finish(); };
  if (!sources.length) finish();
  // A context suspended mid-sound (a phone going to the background) may never fire onended: free
  // the voice anyway a little after it should have ended.
  const safety = setTimeout(finish, patchLength(p) + 3000) as unknown as { unref?: () => void };
  safety.unref?.();
  return {
    end,
    stop: (at: number) => {
      try {
        level.gain.cancelScheduledValues(at);
        level.gain.setValueAtTime(level.gain.value, at);
        level.gain.linearRampToValueAtTime(0, at + 0.03);
        for (const s of sources) s.stop(at + 0.04);
      } catch { /* already over */ }
    },
  };
}
