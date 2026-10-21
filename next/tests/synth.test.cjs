// Synthesised UI sounds (FIXLIST-2 "synth sounds", src/app/sounds/synth*.ts). Nobody can listen
// from here, so every sound of every theme is rendered offline (synthRender: the same param events
// and signal path as the live graph) at the loudest the app ever plays it (2×, with the room) and
// checked: no clipping (peak < -1 dBFS), no DC, no click at the start / end, its length, its
// loudness at the category target, every note in the key. Plus the Web Audio graph builder against
// a fake context (envelopes start and end at exactly 0, everything wired and stopped).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const P = load('src/app/sounds/synthPatch.ts');
const R = load('src/app/sounds/synthRender.ts', { './synthPatch': P });
const TH = load('src/app/sounds/synthThemes.ts', { './synthPatch': P });
const V = load('src/app/sounds/synthVoice.ts', { './synthPatch': P });
const S = load('src/app/sounds/soundActions.ts');

const SR = 48000;
const IR = P.makeImpulse(SR);
const THEMES = S.SYNTH_THEME_IDS;
const ACTIONS = S.ACTION_IDS;
const MAX_GAIN = S.MAX_GAIN;

/** The engine's normalisation (synthEngine.normGain), at its 24 kHz measuring rate. */
function normGain(theme, action) {
  const measured = R.loudnessDb(R.renderPatch(TH.buildPatch(theme, action), 24000));
  return P.dbToGain(TH.CATEGORY_DB[TH.ACTION_CATEGORY[action]] - measured);
}

/** Plain RMS window (active part, room included) per category, dB at the default master × volume. */
const RMS_WINDOW = { tick: [-62, -36], ui: [-52, -26], motion: [-54, -28], event: [-50, -24], chime: [-48, -22], alert: [-48, -22] };

test('every action of every theme: no clipping, no DC, no clicks, length, loudness', () => {
  const defaultGain = S.playGain({ master: 0.5, volume: 0.7, muted: false, sound: 'x' });
  for (const theme of THEMES) {
    for (const action of ACTIONS) {
      const id = `${theme}/${action}`;
      const cat = TH.ACTION_CATEGORY[action];
      const g = normGain(theme, action);
      assert.ok(g > P.dbToGain(-30) && g < P.dbToGain(30), `${id}: sane normalisation ${P.gainToDb(g).toFixed(1)} dB`);
      for (const vary of [0, -1, 1]) {
        const p = TH.buildPatch(theme, action, vary);
        assert.ok(P.patchLength(p) <= TH.MAX_MS[cat], `${id}: ${P.patchLength(p).toFixed(0)} ms > ${TH.MAX_MS[cat]}`);
        const loud = R.renderPatch(p, SR, { gain: g * MAX_GAIN, ir: IR });
        const st = R.stats(loud);
        assert.ok(st.peakDb < -1, `${id} (vary ${vary}): peak ${st.peakDb.toFixed(2)} dBFS at 2×`);
        assert.ok(st.dc < 0.02, `${id}: DC ${st.dc}`);
        assert.ok(st.first < 1e-6, `${id}: first sample ${st.first}`);
        assert.ok(st.last < 1e-6, `${id}: last sample ${st.last}`);
        // the dry sound alone also ends at true silence (the envelope's 6 ms line to 0)
        const dry = R.renderPatch(p, SR, { gain: g });
        assert.ok(R.stats(dry).last < 1e-9, `${id}: dry tail`);
      }
      // the normalised loudness is the target; the plain RMS at the default level is in its window
      const at = R.renderPatch(TH.buildPatch(theme, action), 24000, { gain: g });
      assert.ok(Math.abs(R.loudnessDb(at) - TH.CATEGORY_DB[cat]) < 0.6, `${id}: loudness ${R.loudnessDb(at).toFixed(1)}`);
      const rms = R.stats(R.renderPatch(TH.buildPatch(theme, action), SR, { gain: g * defaultGain, ir: IR })).rmsDb;
      const [lo, hi] = RMS_WINDOW[cat];
      assert.ok(rms > lo && rms < hi, `${id}: RMS ${rms.toFixed(1)} dB outside ${lo}..${hi}`);
    }
  }
});

test('short sounds are short, chimes under 0.9 s, the hover is a tick', () => {
  for (const theme of THEMES) {
    for (const action of ACTIONS) {
      const ms = P.patchLength(TH.buildPatch(theme, action));
      const cat = TH.ACTION_CATEGORY[action];
      if (cat === 'chime') assert.ok(ms < 900, `${theme}/${action} ${ms}`);
      else if (cat === 'tick') assert.ok(ms < 40, `${theme}/${action} ${ms}`);
      else assert.ok(ms < 400, `${theme}/${action} ${ms}`);
      if (action === 'click') assert.ok(ms < 70, `click is a tap: ${ms}`);
    }
  }
});

test('every tonal note is in D major pentatonic', () => {
  const pcs = new Set([2, 4, 6, 9, 11]); // D E F# A B
  for (const theme of THEMES) {
    for (const action of ACTIONS) {
      for (const l of TH.buildPatch(theme, action).layers) {
        if (l.src !== 'osc') continue;
        const f = l.freqTo ?? l.freq;
        const midi = 69 + 12 * Math.log2(f / 440);
        assert.ok(Math.abs(midi - Math.round(midi)) < 1e-6, `${theme}/${action}: ${f} Hz is not a note`);
        assert.ok(pcs.has(((Math.round(midi) % 12) + 12) % 12), `${theme}/${action}: ${f} Hz out of key`);
      }
    }
  }
  assert.equal(Math.round(P.hz(0) * 100) / 100, 293.66, 'D4');
  assert.equal(Math.round(P.hz(5) * 100) / 100, 587.33, 'D5');
  assert.equal(P.hz(8), 880, 'A5');
});

test('no harsh waves: only sine / triangle, error behind a low-pass', () => {
  for (const theme of THEMES) for (const action of ACTIONS) {
    for (const l of TH.buildPatch(theme, action).layers) {
      if (l.src === 'osc') assert.ok(l.wave === 'sine' || l.wave === 'triangle', `${theme}/${action} ${l.wave}`);
    }
    for (const l of TH.buildPatch(theme, 'error').layers) assert.ok(l.filter && l.filter.type === 'lowpass' && l.filter.freq <= 1000);
  }
});

test('undo sweeps to the left, redo to the right', () => {
  for (const theme of THEMES) {
    const u = R.renderPatch(TH.buildPatch(theme, 'undo'), SR);
    const r = R.renderPatch(TH.buildPatch(theme, 'redo'), SR);
    const tailBalance = (s) => {
      let l = 0, rr = 0;
      const from = Math.floor(s.l.length * 0.55);
      for (let i = from; i < s.l.length; i++) { l += s.l[i] ** 2; rr += s.r[i] ** 2; }
      return 10 * Math.log10(rr / l);
    };
    assert.ok(tailBalance(u) < -3, `${theme} undo ends left`);
    assert.ok(tailBalance(r) > 3, `${theme} redo ends right`);
  }
});

test('themes differ: the same action is a different sound per theme', () => {
  for (const action of ['click', 'done', 'error']) {
    const a = JSON.stringify(TH.buildPatch('soft', action));
    assert.notEqual(a, JSON.stringify(TH.buildPatch('glass', action)));
    assert.notEqual(a, JSON.stringify(TH.buildPatch('pop', action)));
  }
});

test('paramAt follows Web Audio ramp maths', () => {
  const ev = [{ k: 'set', v: 0, t: 0 }, { k: 'lin', v: 1, t: 0.01 }, { k: 'exp', v: 0.001, t: 0.11 }, { k: 'lin', v: 0, t: 0.116 }];
  assert.equal(P.paramAt(ev, -1), 0);
  assert.ok(Math.abs(P.paramAt(ev, 0.005) - 0.5) < 1e-12);
  assert.ok(Math.abs(P.paramAt(ev, 0.06) - Math.sqrt(0.001)) < 1e-12, 'exp midpoint = geometric mean');
  assert.equal(P.paramAt(ev, 1), 0);
  const hold = [{ k: 'set', v: 2, t: 0 }, { k: 'set', v: 5, t: 1 }];
  assert.equal(P.paramAt(hold, 0.5), 2);
  // every envelope: starts at 0, ends at exactly 0, never a negative / zero exp target
  for (const theme of THEMES) for (const action of ACTIONS) for (const l of TH.buildPatch(theme, action).layers) {
    const e = P.envEvents(l);
    assert.deepEqual([e[0].k, e[0].v], ['set', 0]);
    assert.deepEqual([e.at(-1).k, e.at(-1).v], ['lin', 0]);
    for (const x of e) if (x.k === 'exp') assert.ok(x.v > 0);
  }
});

test('the room: starts silent, ends silent, energy 1, no DC', () => {
  for (const ch of IR) {
    assert.equal(ch[0], 0);
    assert.ok(Math.abs(ch.at(-1)) < 1e-6);
    let e = 0, sum = 0;
    for (const x of ch) { e += x * x; sum += x; }
    assert.ok(Math.abs(e - 1) < 1e-6);
    assert.ok(Math.abs(sum / ch.length) < 1e-3);
  }
});

test('limiter: exactly linear to -3 dBFS, never past 0 dBFS, odd', () => {
  const c = P.limiterCurve();
  for (let m = -0.7; m <= 0.7; m += 0.01) assert.ok(Math.abs(P.shape(c, m * 0.5) - m) < 1e-6, `linear at ${m}`);
  let prev = -Infinity;
  for (let m = -2; m <= 2; m += 0.01) {
    const y = P.shape(c, m * 0.5);
    assert.ok(Math.abs(y) <= 1, `bounded at ${m}`);
    assert.ok(y >= prev - 1e-9, 'monotonic');
    prev = y;
    assert.ok(Math.abs(y + P.shape(c, -m * 0.5)) < 1e-6, 'odd');
  }
});

test('the saturation curve: odd, 0 at 0, bounded', () => {
  const c = P.shaperCurve(1.8);
  assert.ok(Math.abs(P.shape(c, 0)) < 1e-9);
  assert.ok(Math.abs(P.shape(c, 0.3) + P.shape(c, -0.3)) < 1e-9);
  assert.ok(Math.abs(P.shape(c, 1)) <= 1 + 1e-9);
});

// ---- the live graph, against a fake AudioContext ---------------------------------------------------

function fakeContext() {
  const log = { nodes: [], started: [], stopped: [] };
  const param = (name) => ({ name, value: 0, events: [], setValueAtTime(v, t) { this.events.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); }, exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); }, cancelScheduledValues() {} });
  const node = (kind, params = []) => {
    const n = { kind, outs: [], connect(d) { this.outs.push(d); return d; }, disconnect() { this.outs = []; } };
    for (const p of params) n[p] = param(p);
    log.nodes.push(n);
    return n;
  };
  const source = (kind, params) => {
    const n = node(kind, params);
    n.start = (t) => log.started.push([n, t]);
    n.stop = (t) => { n.stopAt = t; log.stopped.push([n, t]); };
    return n;
  };
  return {
    log,
    createOscillator: () => source('osc', ['frequency', 'detune']),
    createBufferSource: () => source('buffer', []),
    createGain: () => node('gain', ['gain']),
    createBiquadFilter: () => node('biquad', ['frequency', 'Q']),
    createWaveShaper: () => node('shaper', []),
    createStereoPanner: () => node('pan', ['pan']),
  };
}

test('startPatch: every envelope 0 → 0, every source started and stopped after its envelope, all wired', () => {
  for (const theme of THEMES) for (const action of ACTIONS) {
    const c = fakeContext();
    const out = { kind: 'master' };
    const send = { kind: 'room' };
    const p = TH.buildPatch(theme, action);
    const t0 = 10;
    const t = process.hrtime.bigint();
    const v = V.startPatch(c, out, send, p, 0.5, t0, () => ({}));
    const us = Number(process.hrtime.bigint() - t) / 1000;
    assert.ok(us < 5000, `${theme}/${action}: built in ${us} µs`);
    const envs = c.log.nodes.filter((n) => n.kind === 'gain' && n.gain.events.length > 2);
    assert.equal(envs.length, p.layers.length, `${theme}/${action}: one envelope per layer`);
    for (const e of envs) {
      assert.deepEqual(e.gain.events[0].slice(0, 2), ['set', 0]);
      assert.equal(e.gain.value, 0, 'idle value 0 before the start');
      const last = e.gain.events.at(-1);
      assert.deepEqual(last.slice(0, 2), ['lin', 0]);
      assert.ok(e.gain.events[0][2] >= t0);
    }
    const srcs = c.log.nodes.filter((n) => n.kind === 'osc' || n.kind === 'buffer');
    assert.equal(c.log.started.length, srcs.length);
    const lastEnv = Math.max(...envs.map((e) => e.gain.events.at(-1)[2]));
    for (const s of srcs) assert.ok(s.stopAt > t0, 'every source stops');
    assert.ok(Math.max(...srcs.map((s) => s.stopAt)) >= lastEnv, 'the last source outlives the last envelope');
    assert.ok(v.end >= lastEnv);
    // the play's level → master, and a send → room when the theme has one
    assert.ok(c.log.nodes.some((n) => n.outs.includes(out)));
    assert.equal(c.log.nodes.some((n) => n.outs.includes(send)), p.reverb !== undefined);
    // FM modulators feed a carrier's frequency
    const fmLayers = p.layers.filter((l) => l.fm).length;
    const fmLinks = c.log.nodes.filter((n) => n.kind === 'gain' && n.outs.some((o) => o && o.name === 'frequency')).length;
    assert.equal(fmLinks, fmLayers);
    // low / high-pass Q goes in as dB, band-pass as is
    for (const b of c.log.nodes.filter((n) => n.kind === 'biquad')) assert.ok(Number.isFinite(b.Q.value));
  }
});

test('calibration (loudness measuring) is quick', () => {
  const t = Date.now();
  let n = 0;
  for (const theme of THEMES) for (const action of ACTIONS) { normGain(theme, action); n++; }
  const each = (Date.now() - t) / n;
  assert.ok(each < 25, `calibration ${each.toFixed(1)} ms per sound`);
});
