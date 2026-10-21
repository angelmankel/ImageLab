/**
 * The sample player behind every UI sound in the next UI (FIXLIST-2 "New UI sounds"). Web Audio
 * for low latency: one AudioContext (made on the first play, after a user gesture), each sound
 * fetched + decoded once on first use (or prefetched when the page is idle) and kept as an
 * AudioBuffer. Nothing here ever blocks the UI or throws: a sound that is not ready within a
 * moment is skipped, a file that fails is remembered as silent.
 *
 * Format: Ogg Opus when the browser says it can play it, else MP3 (older Safari / iOS have no Ogg
 * Opus); a decode failure of an .ogg switches the page to MP3 and retries once.
 */
import { setSoundPlayer, useSoundStore, type SoundKind } from '@/lib/sounds';
import { useTheme } from '~/theme/themeStore';
import { SOUND_BASE } from './soundConfig';
import { actionOfKind, MAX_GAIN, playGain, soundUrl, type SoundAction } from './soundActions';
import { useSoundPicks } from './soundStore';

type Ext = 'ogg' | 'mp3';
let ext: Ext | null = null;
function format(): Ext {
  if (ext) return ext;
  try {
    const a = document.createElement('audio');
    ext = a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp3';
  } catch { ext = 'mp3'; }
  return ext;
}

let ctx: AudioContext | null = null;
function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** A decoder that needs no user gesture (prefetch before the first click). */
let offline: OfflineAudioContext | null = null;
function decoder(): BaseAudioContext | null {
  if (ctx) return ctx;
  try {
    if (!offline) offline = new OfflineAudioContext(1, 1, 48000);
    return offline;
  } catch { return null; }
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
const ready = new Map<string, AudioBuffer | null>();

async function fetchDecode(id: string, e: Ext): Promise<AudioBuffer> {
  const res = await fetch(soundUrl(SOUND_BASE, id, e));
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.arrayBuffer();
  const dec = decoder();
  if (!dec) throw new Error('no audio');
  return await new Promise<AudioBuffer>((resolve, reject) => {
    // The callback form: older Safari's decodeAudioData returns no promise.
    const p = dec.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.catch === 'function') p.catch(reject);
  });
}

/** The decoded sound (cached), or null when it cannot load. */
export function loadSound(id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = (async () => {
      try { return await fetchDecode(id, format()); }
      catch {
        if (format() === 'ogg') {
          try { const b = await fetchDecode(id, 'mp3'); ext = 'mp3'; return b; } catch { /* fall through */ }
        }
        return null;
      }
    })().then((b) => { ready.set(id, b); return b; });
    buffers.set(id, p);
  }
  return p;
}

let voices = 0;
const MAX_VOICES = 8;
const lastStart = new Map<SoundAction, { at: number; src: AudioBufferSourceNode; gain: GainNode }>();

function start(buf: AudioBuffer, gain: number, action?: SoundAction) {
  const c = context();
  if (!c || voices >= MAX_VOICES) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = Math.min(MAX_GAIN, gain);
  src.connect(g);
  g.connect(c.destination);
  voices++;
  src.onended = () => { voices--; try { src.disconnect(); g.disconnect(); } catch { /* gone */ } };
  src.start();
  if (action) lastStart.set(action, { at: performance.now(), src, gain: g });
}

/** Play a sound id at a gain now; if it is still loading, play it only if it arrives within `waitMs`. */
export function playId(id: string, gain: number, action?: SoundAction, waitMs = 250) {
  if (gain <= 0) return;
  context();
  const buf = ready.get(id);
  if (buf) { start(buf, gain, action); return; }
  if (buf === null) return;
  const asked = performance.now();
  void loadSound(id).then((b) => { if (b && performance.now() - asked <= waitMs) start(b, gain, action); });
}

/** Fade out an action's sound if it started within `ms` (a later, bigger sound replaces it). */
export function cutRecent(action: SoundAction, ms: number) {
  const v = lastStart.get(action);
  const c = ctx;
  if (!v || !c || performance.now() - v.at > ms) return;
  try {
    v.gain.gain.setTargetAtTime(0, c.currentTime, 0.02);
    v.src.stop(c.currentTime + 0.12);
  } catch { /* already stopped */ }
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** The gain an action plays at right now (0 = silent). */
export function actionGain(action: SoundAction): number {
  const pick = useSoundPicks.getState().picks[action];
  const { muted, volume } = useSoundStore.getState();
  return playGain({
    master: volume, volume: pick?.volume ?? 0, muted, sound: pick?.sound ?? null, action,
    motion: useTheme.getState().theme.motion, reducedMotion: reducedMotion(),
    followMotion: useSoundPicks.getState().followMotion,
  });
}

/** Per action: when it last played (hover / click / tab are rate-limited to one per 35 ms). */
const lastPlay = new Map<SoundAction, number>();
/** "All done" is armed by the jobs watcher for a moment; the next "done" becomes it. */
let allDoneArmed = 0;
export function armAllDone() { allDoneArmed = performance.now(); }

/** Play an action with its picked sound and volume. */
export function playAction(action: SoundAction) {
  const now = performance.now();
  if (action === 'hover' || action === 'click' || action === 'tab') {
    if (now - (lastPlay.get(action) ?? -1e9) < 35) return;
    lastPlay.set(action, now);
  }
  if (action === 'done' && allDoneArmed && now - allDoneArmed < 400) {
    allDoneArmed = 0;
    action = 'allDone';
  }
  if (action === 'allDone') { allDoneArmed = 0; cutRecent('done', 600); }
  const sound = useSoundPicks.getState().picks[action]?.sound;
  if (!sound) return;
  playId(sound, actionGain(action), action);
}

/** Settings ▶: one sound at an action's volume (or the action's own pick), obeying mute only. */
export function previewSound(id: string, volume: number) {
  const { muted, volume: master } = useSoundStore.getState();
  const gain = playGain({ master, volume, muted, sound: id });
  context();
  // A preview may wait for the download: the user asked for it.
  playId(id, gain, undefined, 4000);
}

/** Decode the picked sounds when the page is idle, so the first click is instant. */
export function prefetchPicked() {
  const ids = new Set<string>();
  for (const p of Object.values(useSoundPicks.getState().picks)) if (p.sound) ids.add(p.sound);
  const list = [...ids];
  const step = () => {
    const id = list.shift();
    if (!id) return;
    void loadSound(id).finally(() => idle(step));
  };
  idle(step);
}

function idle(fn: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 }); else window.setTimeout(fn, 200);
}

let installed = false;
/** Route every `playSound` (shared code, classic callers) to the sample player. Once, in App. */
export function installSoundEngine() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  setSoundPlayer((kind: SoundKind, opts) => {
    const action = actionOfKind(kind, opts.on);
    if (action) playAction(action);
  });
  window.setTimeout(prefetchPicked, 1500);
  // A newly picked sound: fetch it now, so its first use is instant.
  useSoundPicks.subscribe((s, prev) => {
    if (s.picks === prev.picks) return;
    for (const p of Object.values(s.picks)) if (p.sound) void loadSound(p.sound);
  });
}
