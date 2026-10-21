/**
 * The player behind every UI sound in the next UI (FIXLIST-2 "New UI sounds" + "synth sounds").
 * An action's pick resolves (`resolveSound`) to a SYNTH sound — built live by synthEngine.ts —
 * or a PACK sample (Web Audio buffer, fetched + decoded once, or prefetched on idle). Both go
 * through synthEngine's one context and master chain. Nothing here ever blocks the UI or
 * throws: a sample that is not ready within a moment is skipped, a file that fails is silent.
 *
 * When it plays: mute, master and action volume, the motion rule (`playGain`); while the page is
 * hidden, never on a phone / tablet, and on a desktop only the report sounds (job done…).
 * Sample format: Ogg Opus when the browser can play it, else MP3.
 */
import { setSoundPlayer, soundGestured, useSoundStore, type SoundKind } from '@/lib/sounds';
import { useTheme } from '~/theme/themeStore';
import { SOUND_BASE } from './soundConfig';
import {
  actionDef, actionOfKind, MAX_GAIN, playGain, resolveSound, soundUrl, THEME_SOUND,
  type ResolvedSound, type SoundAction, type SoundThemeId, type SynthThemeId,
} from './soundActions';
import { useSoundPicks } from './soundStore';
import { audio, calibrateTheme, isTouchDevice, output, playSynth, voiceEnded, voiceStarted, warmAudio } from './synthEngine';
import { buildPatch } from './synthThemes';
import { patchLength } from './synthPatch';
import { loadSoundPack } from './soundPack';

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

/** A decoder that needs no user gesture (prefetch before the first click). */
let offline: OfflineAudioContext | null = null;
function decoder(): BaseAudioContext | null {
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

/** The decoded sample (cached), or null when it cannot load. */
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

/** The last play of each action, so a bigger sound can fade it ("all done" replaces "done"). */
const lastStart = new Map<SoundAction, { at: number; stop: (t: number) => void }>();

function startSample(buf: AudioBuffer, gain: number, action?: SoundAction) {
  const c = audio();
  const out = output();
  if (!c || !out || !voiceStarted()) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = Math.min(MAX_GAIN, gain);
  src.connect(g);
  g.connect(out);
  src.onended = () => { voiceEnded(); try { src.disconnect(); g.disconnect(); } catch { /* gone */ } };
  src.start();
  if (action) {
    lastStart.set(action, {
      at: performance.now(),
      stop: (t) => { try { g.gain.setTargetAtTime(0, t, 0.02); src.stop(t + 0.12); } catch { /* stopped */ } },
    });
  }
}

/** Play a sample id at a gain now; if it is still loading, play it only if it arrives within `waitMs`. */
export function playId(id: string, gain: number, action?: SoundAction, waitMs = 250) {
  if (gain <= 0) return;
  audio();
  const buf = ready.get(id);
  if (buf) { startSample(buf, gain, action); return; }
  if (buf === null) return;
  const asked = performance.now();
  void loadSound(id).then((b) => { if (b && performance.now() - asked <= waitMs) startSample(b, gain, action); });
}

/** Play whatever a pick resolved to. */
export function playResolved(r: ResolvedSound, gain: number, action?: SoundAction, waitMs?: number) {
  if (!r || gain <= 0) return;
  if (r.kind === 'pack') { playId(r.id, gain, action, waitMs); return; }
  const v = playSynth(r.theme, r.action, gain);
  if (v && action) lastStart.set(action, { at: performance.now(), stop: (t) => v.stop(t) });
}

/** Fade out an action's sound if it started within `ms` (a later, bigger sound replaces it). */
export function cutRecent(action: SoundAction, ms: number) {
  const v = lastStart.get(action);
  const c = audio();
  if (!v || !c || performance.now() - v.at > ms) return;
  v.stop(c.currentTime);
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

/** Hidden page: nothing on a phone / tablet; on a desktop only the report sounds (a job landed…). */
function hiddenBlocks(action: SoundAction): boolean {
  try {
    if (document.visibilityState !== 'hidden') return false;
  } catch { return false; }
  return isTouchDevice() || actionDef(action)?.ui !== false;
}

/** Per action: when it last played (hover / click / tab are rate-limited to one per 35 ms). */
const lastPlay = new Map<SoundAction, number>();
/** "All done" is armed by the jobs watcher for a moment; the next "done" becomes it. */
let allDoneArmed = 0;
export function armAllDone() { allDoneArmed = performance.now(); }

/** Play an action with its pick (theme sound, synth sound or sample) and volume. */
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
  if (hiddenBlocks(action)) return;
  const { theme, picks } = useSoundPicks.getState();
  const r = resolveSound(action, picks[action]?.sound, theme);
  if (!r) return;
  playResolved(r, actionGain(action), action);
}

/** Settings ▶: a pick (theme / synth / sample) at a volume, obeying mute and master only. */
export function previewPick(action: SoundAction, sound: string | null, volume: number, theme = useSoundPicks.getState().theme) {
  const r = resolveSound(action, sound, theme);
  if (!r) return;
  const { muted, volume: master } = useSoundStore.getState();
  const gain = playGain({ master, volume, muted, sound: sound ?? null });
  warmAudio();
  // A preview may wait for the download: the user asked for it.
  playResolved(r, gain, undefined, 4000);
}

/** Settings ▶ on a pack sample by id. */
export function previewSound(id: string, volume: number) {
  previewPick('click', id, volume);
}

/** How long a resolved sound lasts, ms (pack: the manifest's duration when loaded). */
export function soundLengthMs(r: ResolvedSound): number {
  if (!r) return 0;
  if (r.kind === 'synth') return patchLength(buildPatch(r.theme, r.action));
  const s = packDurations.get(r.id);
  return s ? s * 1000 : 800;
}
const packDurations = new Map<string, number>();

/** The theme's sound for an action (Play all, the mixer's ▶). */
export function themeSound(action: SoundAction, theme: SoundThemeId): ResolvedSound {
  return resolveSound(action, THEME_SOUND, theme);
}

/** Decode the picked samples when the page is idle, so the first use is instant. */
export function prefetchPicked() {
  const { theme, picks } = useSoundPicks.getState();
  const ids = new Set<string>();
  for (const [a, p] of Object.entries(picks)) {
    const r = resolveSound(a as SoundAction, p.sound, theme);
    if (r?.kind === 'pack') ids.add(r.id);
  }
  const list = [...ids];
  const step = () => {
    const id = list.shift();
    if (!id) return;
    void loadSound(id).finally(() => idle(step));
  };
  idle(step);
}

/** The pack's durations for Play all (manifest chunk, loaded on demand). */
export function loadPackDurations() {
  void loadSoundPack().then((p) => { if (p) for (const s of p.sounds) packDurations.set(s.id, s.duration); });
}

function idle(fn: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 }); else window.setTimeout(fn, 200);
}

const synthThemeOf = (t: SoundThemeId): SynthThemeId | undefined => (t === 'pack' ? undefined : t);

let installed = false;
/** Route every `playSound` (shared code, classic callers) here. Once, in App (UiEffects). */
export function installSoundEngine() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  setSoundPlayer((kind: SoundKind, opts) => {
    const action = actionOfKind(kind, opts.on);
    if (action) playAction(action);
  });
  // Make + resume the context inside the first gesture, so the first sound starts at once.
  const warm = () => warmAudio(synthThemeOf(useSoundPicks.getState().theme));
  if (soundGestured()) warm();
  else {
    window.addEventListener('pointerdown', warm, { capture: true, once: true });
    window.addEventListener('keydown', warm, { capture: true, once: true });
  }
  window.setTimeout(prefetchPicked, 1500);
  // A new theme or pick: measure / fetch it now, so its first use is instant.
  useSoundPicks.subscribe((s, prev) => {
    if (s.theme !== prev.theme) { const t = synthThemeOf(s.theme); if (t) calibrateTheme(t); }
    if (s.picks === prev.picks && s.theme === prev.theme) return;
    prefetchPicked();
  });
}
