/**
 * The Video step's pure rules (rule 2: a step takes the previous step's output as its input).
 * No React, no stores: tested in tests/videoStep.test.cjs. The tabs and the chain runner use
 * these; the graph itself is the main app's (`@/lib/wanGraph`, `@/lib/h3Graph`).
 */
export type Engine = 'wan' | 'h3';
export type Task = 't2v' | 'i2v' | 'ref';

export interface Size { width: number; height: number }

/** Wan: 480p / 720p buckets, multiples of 16. H3: the templates' 0.4 MP buckets and the native 768p canvas, multiples of 32. */
export const SIZE_PRESETS: Record<Engine, Array<{ group: string; items: Array<Size & { label: string }> }>> = {
  wan: [
    { group: '480p', items: [
      { width: 832, height: 480, label: '16:9' }, { width: 480, height: 832, label: '9:16' }, { width: 624, height: 624, label: '1:1' },
    ] },
    { group: '720p', items: [
      { width: 1280, height: 720, label: '16:9' }, { width: 720, height: 1280, label: '9:16' }, { width: 960, height: 960, label: '1:1' },
    ] },
  ],
  h3: [
    { group: '0.4 MP · quick', items: [
      { width: 864, height: 480, label: '16:9' }, { width: 480, height: 864, label: '9:16' }, { width: 640, height: 640, label: '1:1' }, { width: 736, height: 544, label: '4:3' },
    ] },
    { group: '768p · native', items: [
      { width: 1344, height: 768, label: '16:9' }, { width: 768, height: 1344, label: '9:16' }, { width: 768, height: 768, label: '1:1' }, { width: 1024, height: 768, label: '4:3' }, { width: 768, height: 1024, label: '3:4' },
    ] },
  ],
};

/** The multiple a side must land on. */
export const sideStep = (engine: Engine) => (engine === 'h3' ? 32 : 16);

/** A side snapped to the engine's grid, never under one step. */
export function snapSide(engine: Engine, px: number): number {
  const s = sideStep(engine);
  return Math.max(s, Math.round((Number(px) || s) / s) * s);
}

/** Frames per second the clip plays at (H3 is fixed at 24). */
export const fpsOf = (engine: Engine, wanFps: number) => (engine === 'h3' ? 24 : Math.max(1, Math.round(Number(wanFps) || 16)));

/** Snap a frame count to the engine's grid: Wan 4n + 1, H3 17n + 5. */
export function snapFrames(engine: Engine, frames: number): number {
  const n = Math.round(Number(frames) || 0);
  if (engine === 'h3') { let f = Math.max(5, n); while (f % 17 !== 5) f += 1; return f; }
  return Math.max(5, Math.round((n - 1) / 4) * 4 + 1);
}

/** Seconds a frame count plays, one decimal. */
export const secondsOf = (frames: number, fps: number) => Math.round((frames / Math.max(1, fps)) * 10) / 10;

/** The frames nearest to `seconds` on the engine's grid. */
export const framesForSeconds = (engine: Engine, seconds: number, fps: number) => snapFrames(engine, seconds * fps);

/** The Length chips: a few clip lengths per engine, each with its seconds at `fps`. */
export function lengthChips(engine: Engine, fps: number): Array<{ frames: number; seconds: number }> {
  const list = engine === 'h3' ? [73, 124, 243, 362] : [33, 49, 81, 121];
  return list.map((frames) => ({ frames, seconds: secondsOf(frames, fps) }));
}

/** `size` turned to match the picture's orientation (a portrait picture flips a landscape size), as Send to video does. */
export function fitOrientation(size: Size, picture: { width: number; height: number } | null): Size {
  if (!picture || picture.width === picture.height || size.width === size.height) return size;
  const portrait = picture.height > picture.width;
  if (portrait === size.height > size.width) return size;
  return { width: size.height, height: size.width };
}

/** The task the engine is on. H3 has three; Wan two. */
export const tasksFor = (engine: Engine): Array<{ key: Task; label: string }> =>
  engine === 'h3'
    ? [{ key: 't2v', label: 'Text → Video' }, { key: 'i2v', label: 'Image → Video' }, { key: 'ref', label: 'Reference → Video' }]
    : [{ key: 't2v', label: 'Text → Video' }, { key: 'i2v', label: 'Image → Video' }];

/** Which parts of the step's interface apply to this engine and task. */
export function visibleFields(engine: Engine, task: Task): {
  startFrame: boolean; endFrame: boolean; refs: boolean; fps: boolean; audio: boolean; expertSwitch: boolean; fast: boolean; turbo: boolean; nag: boolean; colorMatch: boolean;
} {
  const h3 = engine === 'h3';
  const i2v = task === 'i2v';
  return {
    startFrame: i2v, endFrame: i2v, refs: h3 && task === 'ref', fps: !h3, audio: h3,
    expertSwitch: !h3, fast: !h3, turbo: h3, nag: !h3, colorMatch: i2v,
  };
}

export interface StartSource { url: string; name: string }

/** The step's input as `~/screens/image/stepInputLogic.ts` resolves it (the part the start frame needs). */
export type ResolvedInput = { kind: 'none' | 'explicit' } | { kind: 'waiting' } | { kind: 'chained'; src: StartSource };

/**
 * Where the start frame comes from when Generate is pressed:
 *   'prev'  — the step is chained and resolves to the previous step's picture: fetch + upload it;
 *   'own'   — the step has its own uploaded start image (`startImage`, a LoadImage reference);
 *   'none'  — nothing to start from (chained but waiting; text → video runs; image → video is refused).
 */
export function resolveStart(input: { resolved: ResolvedInput | null; startImage: string }):
  { source: 'prev'; prev: StartSource } | { source: 'own'; ref: string } | { source: 'none' } {
  const r = input.resolved;
  if (r?.kind === 'chained') return { source: 'prev', prev: r.src };
  if (r?.kind === 'waiting') return { source: 'none' };
  if (input.startImage) return { source: 'own', ref: input.startImage };
  return { source: 'none' };
}

/** Why Generate is off (null = it can run). Order: no server, nothing to chain to, no prompt, no picture. */
export function blockReason(input: {
  host: string | null; task: Task; chained: boolean; hasPrev: boolean; prevIndex: number; prevHasOutput: boolean; prompt: string; startImage: string; refs: number;
}): string | null {
  if (!input.host) return 'No video server';
  if (input.task === 'i2v' && input.chained && input.hasPrev && !input.prevHasOutput) return `Step ${input.prevIndex + 1} has no image yet`;
  if (!input.prompt.trim()) return 'Write a motion prompt first';
  if (input.task === 'i2v' && !(input.chained && input.hasPrev) && !input.startImage) return 'Pick a start picture in Input';
  if (input.task === 'ref' && input.refs === 0) return 'Add a reference picture in Input';
  return null;
}

/** A short label for a file or `LoadImage` reference. */
export const shortFile = (f: string) =>
  f.replace(/\s*\[\w+\]$/, '').replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf|png|jpe?g|webp)$/i, '');

/** The files of a server list that fit the engine first (Wan or H3 by name), then the rest. */
export function filesForEngine(files: readonly string[], engine: Engine): { fit: string[]; rest: string[] } {
  const isWan = (n: string) => /wan[-_ .]?2|smoothmixwan/i.test(n);
  const isH3 = (n: string) => /minimax[-_ ]?h3/i.test(n);
  const test = engine === 'h3' ? isH3 : isWan;
  return { fit: files.filter(test), rest: files.filter((f) => !test(f)) };
}

/** The speed label: Wan's Fast (lightx2v, N steps) or H3's Turbo (N steps). */
export const speedLabel = (engine: Engine, on: boolean, steps: number) =>
  engine === 'h3' ? (on ? `Turbo · ${steps} steps` : `Full · ${steps} steps`) : (on ? `Fast · ${steps} steps` : `Full · ${steps} steps`);
