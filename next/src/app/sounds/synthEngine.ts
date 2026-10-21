/**
 * The audio output of every UI sound (FIXLIST-2 "synth sounds"): ONE AudioContext (interactive
 * latency), made and resumed on the first press or key (`warmAudio`, which also unlocks iOS with
 * a silent buffer), and the master chain every sound — synth or sample — goes through:
 *
 *   sounds ─┬────────────────────────────► master ─► limiter ─► speakers
 *           └► room send ─► Convolver (generated impulse, makeImpulse) ─┘
 *
 * The limiter is a zero-latency soft clip (linear to -3 dBFS, rounding to 0 dBFS at +6 dB over):
 * a DynamicsCompressorNode would add 6 ms of look-ahead and its automatic make-up gain. The
 * sounds are scaled so they never reach it alone (tests/synth.test.cjs); it catches pile-ups.
 *
 * `playSynth` builds the patch, scales it to its category's loudness (measured once per theme ×
 * action by the offline renderer, ~1 ms each, done ahead on idle) and starts it ~3 ms ahead.
 * Phones / tablets suspend the context while the page is hidden.
 */
import { buildPatch, ACTION_CATEGORY, CATEGORY_DB } from './synthThemes';
import { renderPatch, loudnessDb } from './synthRender';
import { dbToGain, limiterCurve, makeImpulse, noiseSamples } from './synthPatch';
import { startPatch, type Voice } from './synthVoice';
import { SYNTH_THEME_IDS, ACTION_IDS, type SoundAction, type SynthThemeId } from './soundActions';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let roomIn: GainNode | null = null;
let roomReady = false;

/** Phones and tablets: the coarse pointer is the hint. */
export function isTouchDevice(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches; } catch { return false; }
}

function build(c: AudioContext) {
  const pre = c.createGain();
  pre.gain.value = 0.5; // the curve's input range [-1, 1] stands for [-2, 2]
  const lim = c.createWaveShaper();
  lim.curve = limiterCurve() as Float32Array<ArrayBuffer>;
  pre.connect(lim);
  lim.connect(c.destination);
  master = pre;
  roomIn = c.createGain();
}

/** The room, built on idle after the first gesture (an impulse takes a few ms to generate). */
function buildRoom(c: AudioContext) {
  if (roomReady || !roomIn || !master) return;
  try {
    const [l, r] = makeImpulse(c.sampleRate);
    const buf = c.createBuffer(2, l.length, c.sampleRate);
    buf.copyToChannel(l as Float32Array<ArrayBuffer>, 0);
    buf.copyToChannel(r as Float32Array<ArrayBuffer>, 1);
    const conv = c.createConvolver();
    conv.normalize = false;
    conv.buffer = buf;
    roomIn.connect(conv);
    conv.connect(master);
    roomReady = true;
  } catch { /* dry is fine */ }
}

/** The context (made if needed, resumed if suspended), or null without Web Audio. */
export function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
      build(ctx);
      watchVisibility();
    }
    if (ctx.state === 'suspended' && document.visibilityState !== 'hidden') void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** Where a sound connects: the master (null before the context exists). */
export function output(): AudioNode | null { return master; }

/** Phones / tablets: suspended while hidden (battery), resumed when back. */
function watchVisibility() {
  document.addEventListener('visibilitychange', () => {
    const c = ctx;
    if (!c) return;
    if (document.visibilityState === 'hidden') { if (isTouchDevice()) void c.suspend().catch(() => {}); }
    else if (c.state === 'suspended') void c.resume().catch(() => {});
  });
}

let warmed = false;
/** First press / key: make + resume the context inside the gesture, unlock iOS, prepare on idle. */
export function warmAudio(theme?: SynthThemeId) {
  const c = audio();
  if (!c || warmed) return;
  warmed = true;
  try {
    const b = c.createBufferSource();
    b.buffer = c.createBuffer(1, 1, c.sampleRate);
    b.connect(c.destination);
    b.start();
  } catch { /* fine */ }
  idle(() => buildRoom(c));
  if (theme) calibrateTheme(theme);
}

// ---- loudness calibration -----------------------------------------------------------------------

const norm = new Map<string, number>();
const CAL_SR = 24000;

/** The gain that puts this theme's action at its category's loudness. */
export function normGain(theme: SynthThemeId, action: SoundAction): number {
  const key = `${theme}/${action}`;
  let g = norm.get(key);
  if (g === undefined) {
    const measured = loudnessDb(renderPatch(buildPatch(theme, action), CAL_SR));
    g = Number.isFinite(measured) ? dbToGain(Math.max(-30, Math.min(30, CATEGORY_DB[ACTION_CATEGORY[action]] - measured))) : 0;
    norm.set(key, g);
  }
  return g;
}

/** Measure a theme's sounds a few at a time when the page is idle. */
export function calibrateTheme(theme: SynthThemeId) {
  if (!(SYNTH_THEME_IDS as readonly string[]).includes(theme)) return;
  const todo = ACTION_IDS.filter((a) => !norm.has(`${theme}/${a}`));
  const step = () => {
    for (let i = 0; i < 4 && todo.length; i++) normGain(theme, todo.shift()!);
    if (todo.length) idle(step);
  };
  idle(step);
}

// ---- playing ----------------------------------------------------------------------------------

const noiseBufs = new Map<number, AudioBuffer>();
function noise(seed: number): AudioBuffer {
  let b = noiseBufs.get(seed);
  if (!b) {
    const c = ctx!;
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    b.copyToChannel(noiseSamples(seed, c.sampleRate) as Float32Array<ArrayBuffer>, 0);
    noiseBufs.set(seed, b);
  }
  return b;
}

let voices = 0;
export const MAX_VOICES = 12;
/** Voices count shared with the sample player. */
export function voiceStarted(): boolean { if (voices >= MAX_VOICES) return false; voices++; return true; }
export function voiceEnded() { voices = Math.max(0, voices - 1); }

/** Interface sounds wobble a hair per play (pitch / level) so repeats feel alive. */
const VARY: ReadonlySet<SoundAction> = new Set(['hover', 'click', 'tab', 'copy', 'toggleOn', 'toggleOff']);

/** Play one theme's action at `gain` (already master × volume). Returns its handle, or null. */
export function playSynth(theme: SynthThemeId, action: SoundAction, gain: number): Voice | null {
  if (gain <= 0) return null;
  const c = audio();
  const out = master;
  if (!c || !out || !voiceStarted()) return null;
  try {
    const vary = VARY.has(action) ? Math.random() * 2 - 1 : 0;
    const p = buildPatch(theme, action, vary);
    return startPatch(c, out, roomReady ? roomIn : null, p, gain * normGain(theme, action), c.currentTime + 0.003, noise, voiceEnded);
  } catch {
    voiceEnded();
    return null;
  }
}

function idle(fn: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2000 }); else window.setTimeout(fn, 50);
}
