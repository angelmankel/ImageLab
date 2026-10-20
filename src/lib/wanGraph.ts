/**
 * Wan 2.2 A14B video graphs (text to video, image to video), as in ImageLabDocker's
 * workflows/Wan 2.2 *.json.
 *
 * A14B is two 14B experts: the high-noise one samples the first steps and hands its still-noisy
 * latent to the low-noise one, which finishes. Each runs through `ModelSamplingSD3` (shift) and
 * its own LoRAs (Wan 2.2 LoRAs ship as a high/low pair). The video is saved as MP4 (H.264) in
 * `output/video/`.
 *
 * Fast mode adds the lightx2v 4-step distill LoRA of the mode to each expert and runs 4 steps
 * (switch at 2) at CFG 1 — CFG 1 also halves each step. On the A100 an 832×480×33 clip took
 * 18.6 s instead of 117 s, at about the same quality.
 *
 * Everything past the basics is optional and off by default, and every node it adds is in
 * ComfyUI v0.34.5 itself or in the pinned KJNodes, checked against their source:
 *   - per-expert CFG and shift, the model's weight dtype, the Fast recipe's own steps / switch /
 *     LoRA strength (`FAST` stays the default);
 *   - an end frame (`WanFirstLastFrameToVideo`) for image to video;
 *   - guidance patches on both experts: `CFGZeroStar`, KJNodes' `WanVideoNAG` (a negative prompt
 *     that works at CFG 1), `EasyCache` (skips near-identical steps; pointless at 4 steps),
 *     `WanContextWindowsManual` (clips longer than the model was trained for), `TorchCompileModel`;
 *   - after decoding: KJNodes `ColorMatchV2` back to the start frame, the upscale, then core
 *     RIFE / FILM frame interpolation (`FrameInterpolationModelLoader` + `FrameInterpolate`);
 *   - the encode: container, codec and CRF through `SaveVideo`'s dynamic `format` input.
 *
 * No runtime imports: the tests load this file on its own.
 */

export type VideoMode = 't2v' | 'i2v';

/** Which model family the Video mode drives: Wan 2.2 A14B (two experts, silent) or MiniMax H3
 *  (one omni model, video + stereo audio). Each keeps its own settings; `lib/h3Graph.ts` builds
 *  the H3 graph. */
export type VideoEngine = 'wan' | 'h3';

/** H3 tasks: text → video, first (+ optional last) frame → video, reference pictures → video. */
export type H3Mode = 't2v' | 'i2v' | 'ref';

export type H3Lora = { id: string; name: string; strength: number; on: boolean };

/** MiniMax H3's own settings (ComfyUI v0.34.5's `nodes_minimax_h3.py` and the bundled
 *  `video_minimax_h3_*` templates): the fl2va checkpoint serves text and first/last frame, the
 *  ref2va one the reference task; one Qwen3-VL-32B text encoder, a video VAE and an audio VAE. */
export type H3Settings = {
  mode: H3Mode;
  models: { fl2va: string; ref2va: string };
  textEncoder: string;
  videoVae: string;
  audioVae: string;
  loras: H3Lora[];
  /** Multiples of 32; the model's native canvas is a 768 short edge capped at 768×1344. */
  width: number;
  height: number;
  /** Frames at 24 fps on the model's 17k + 5 grid (124 = ~5 s; trained 124–362). */
  length: number;
  steps: number;
  /** 1 is the template (`BasicGuider`, no negative); above 1 the zeroed negative starts to cost. */
  cfg: number;
  sampler: string;
  scheduler: string;
  shiftVideo: number;
  shiftAudio: number;
  /** Decode and mux the model's stereo soundtrack. Off saves the audio decode only. */
  audio: boolean;
  /** The lightx2v turbo LoRAs: `lora` + `steps` for fl2va (8-step file at 8, 4-step at 4),
   *  `loraRef` + `stepsRef` for ref2va. */
  turbo: { on: boolean; lora: string; steps: number; loraRef: string; stepsRef: number; strength: number };
  /** Reference task: `LoadImage` references, up to 9, named <Picture 1>… in the prompt. */
  refImages: string[];
  refImageSize: 'match' | 'max';
  /** KJNodes' peak-VRAM patches for H3, exact in output: attention in head groups and a
   *  chunked feed-forward. For a shared card (the pod's 41 GB video share). */
  lowVram: { attention: boolean; headChunks: number; feedForward: boolean; chunks: number };
};

export type VideoLora = {
  id: string;
  /** The high-noise file, or the only file. */
  name: string;
  strength: number;
  on: boolean;
  /** Which expert the one file patches. Wan 2.2 LoRAs come as a high-noise and a low-noise file;
   *  with `nameLow` set the entry is that pair and this is moot (both experts, each its own file). */
  expert: 'high' | 'low' | 'both';
  /** Strength on the low-noise expert when it differs (`both` or a pair); unset: `strength`. */
  strengthLow?: number | null;
  /** The low-noise file when the LoRA ships as two files: `name` loads on the high expert at
   *  `strength`, this on the low expert at `strengthLow ?? strength`. Unset (every older save):
   *  one file, where `expert` says. */
  nameLow?: string | null;
};

export type WeightDtype = 'default' | 'fp8_e4m3fn' | 'fp8_e4m3fn_fast' | 'fp8_e5m2';

export type VideoSettings = {
  mode: VideoMode;
  positive: string;
  negative: string;
  /** Expert files per mode: the T2V and I2V experts are different models. */
  models: Record<VideoMode, { high: string; low: string }>;
  textEncoder: string;
  vae: string;
  loras: VideoLora[];
  width: number;
  height: number;
  /** Frames; Wan wants 4n + 1. */
  length: number;
  fps: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  shift: number;
  /** The step where the low-noise expert takes over. */
  switchStep: number;
  seed: number;
  randomizeSeed: boolean;
  /** Fast mode: the lightx2v LoRAs below, 4 steps, CFG 1 (steps / switch / CFG above are ignored). */
  fast: boolean;
  /** The lightx2v 4-step LoRAs per mode and expert. */
  fastLoras: Record<VideoMode, { high: string; low: string }>;
  /** Per model file: the speed LoRA is already merged in, so Fast adds none (unset: guessed by
   *  name, `speedLoraBuiltIn`). */
  speedInside: Record<string, boolean>;
  /** Optional upscale of the finished frames, before the MP4 is written. */
  upscale: VideoUpscale;

  // ── Everything below is optional in saved settings; `loadVideoSettings` fills the defaults. ──

  /** The low-noise expert's CFG when it differs; null: the same `cfg`. */
  cfgLow: number | null;
  /** The low-noise expert's shift when it differs; null: the same `shift`. */
  shiftLow: number | null;
  /** `UNETLoader`'s weight_dtype (GGUF files ignore it). `fp8_e4m3fn_fast` is quicker on Ada+. */
  weightDtype: WeightDtype;
  /** The Fast recipe: steps, switch step and the strength of the lightx2v LoRA on each expert.
   *  Defaults are `FAST` and 1. More steps (6–8) with the same LoRA add detail; a lower strength
   *  on the high expert brings motion back. `motionSteps` > 0 is the community's "3-sampler" fix
   *  for the LoRA's slow-motion look: that many first steps run on the high expert *without* the
   *  speed LoRA at `motionCfg`, then the lightx2v high expert continues to the switch step. */
  fastRecipe: FastRecipe;
  /** Image to video: a `LoadImage` reference the clip ends on (`WanFirstLastFrameToVideo`). */
  endImage: string;
  /** Guidance patches on both experts. */
  guidance: VideoGuidance;
  /** Speedups on both experts. */
  speedups: VideoSpeedups;
  /** Longer clips: sample in overlapping windows (`WanContextWindowsManual`). */
  longClip: { on: boolean; windowFrames: number; overlapFrames: number };
  /** Image to video: pull the decoded frames' colours back to the start frame (KJNodes ColorMatchV2). */
  colorMatch: { on: boolean; method: ColorMatchMethod; strength: number };
  /** RIFE / FILM frame interpolation after the upscale; the saved fps is multiplied. */
  interpolate: VideoInterpolate;
  /** The file ComfyUI writes. Defaults give exactly `format: mp4, codec: h264` as before. */
  encode: VideoEncode;
  /** Wan (default, every older save) or MiniMax H3. Upscale, interpolation and the encode are shared. */
  engine: VideoEngine;
  h3: H3Settings;
};

export type FastRecipe = { steps: number; switchStep: number; cfg: number; strengthHigh: number; strengthLow: number; motionSteps: number; motionCfg: number };

export type VideoGuidance = {
  /** `CFGZeroStar`: zero-init of the first step plus optimised scaling; cleaner at normal CFG. */
  cfgZeroStar: boolean;
  /** KJNodes `WanVideoNAG`: the negative prompt acts inside Wan's cross-attention, so it works
   *  with CFG 1 (Fast). Defaults are the node's (11 / 0.25 / 2.5). */
  nag: { on: boolean; scale: number; alpha: number; tau: number };
};

export type VideoSpeedups = {
  /** `EasyCache`: reuse a step whose change is under the threshold. Needs enough steps to matter. */
  easyCache: { on: boolean; threshold: number; startPercent: number; endPercent: number };
  /** `TorchCompileModel` (inductor): faster steps after a slow first run on each shape. */
  torchCompile: boolean;
};

export type VideoInterpolate = {
  on: boolean;
  /** A file in models/frame_interpolation (Comfy-Org/frame_interpolation on Hugging Face). */
  model: string;
  /** Frames out per frame in, 2..16. */
  multiplier: number;
};

export type ColorMatchMethod = 'mkl' | 'hm' | 'reinhard' | 'mvgd' | 'hm-mvgd-hm' | 'hm-mkl-hm' | 'reinhard_lab_gpu';

export type VideoEncode = {
  container: 'mp4' | 'mkv' | 'webm';
  /** WebM takes AV1 only. */
  codec: 'h264' | 'av1';
  /** Constant rate factor; null: the encoder's default (H.264 23, AV1 30). Lower is better and bigger. */
  crf: number | null;
};

export type VideoUpscale = {
  on: boolean;
  /** `model`: an upscale model, then an exact resize to the target; `resize`: interpolation only. */
  method: 'model' | 'resize';
  model: string;
  /** Output size relative to the generated video. */
  scale: number;
  /** Interpolation for the resize (and for landing a model's output on the exact size). */
  resizeMethod: 'lanczos' | 'bicubic' | 'bilinear' | 'area' | 'nearest-exact';
};

/** The size an upscaled video comes out at: H.264 wants even sides. */
export function upscaledSize(width: number, height: number, scale: number): [number, number] {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return [even(width * scale), even(height * scale)];
}

/** What fast mode runs with. */
export const FAST = { steps: 4, switchStep: 2, cfg: 1 } as const;

/** The core RIFE / FILM weights (Comfy-Org/frame_interpolation); the first is the pick. */
export const INTERPOLATION_MODELS = ['rife_v4.26.safetensors', 'rife_v4.25_lite.safetensors', 'rife_v4.26_heavy.safetensors', 'film_net_fp16.safetensors'];

export const COLOR_MATCH_METHODS: readonly ColorMatchMethod[] = ['mkl', 'hm', 'reinhard', 'mvgd', 'hm-mvgd-hm', 'hm-mkl-hm', 'reinhard_lab_gpu'];

/** `SaveVideo` at v0.34.5: mp4 / mkv take H.264 or AV1, webm AV1 only. */
export const CONTAINER_CODECS: Record<VideoEncode['container'], readonly VideoEncode['codec'][]> = { mp4: ['h264', 'av1'], mkv: ['h264', 'av1'], webm: ['av1'] };

/** Wan's own negative prompt (it was trained with a Chinese one). */
export const WAN_NEGATIVE = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';

export function defaultVideoSettings(): VideoSettings {
  return {
    mode: 't2v',
    positive: '',
    negative: WAN_NEGATIVE,
    models: {
      t2v: { high: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors', low: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors' },
      i2v: { high: 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', low: 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors' },
    },
    textEncoder: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
    vae: 'wan_2.1_vae.safetensors',
    loras: [],
    width: 832,
    height: 480,
    length: 81,
    fps: 16,
    steps: 20,
    cfg: 3.5,
    sampler: 'euler',
    scheduler: 'simple',
    shift: 8,
    switchStep: 10,
    seed: 0,
    randomizeSeed: true,
    fast: true,
    fastLoras: {
      t2v: { high: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors', low: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors' },
      i2v: { high: 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors', low: 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors' },
    },
    speedInside: {},
    // Off by default. The SPAN 2x model is the fast one: on the A100, 81 frames 832x480 -> 2x took
    // ~5 s more than a plain resize.
    upscale: { on: false, method: 'model', model: '2xNomosUni_span_multijpg.safetensors', scale: 2, resizeMethod: 'lanczos' },

    cfgLow: null,
    shiftLow: null,
    weightDtype: 'default',
    fastRecipe: { steps: FAST.steps, switchStep: FAST.switchStep, cfg: FAST.cfg, strengthHigh: 1, strengthLow: 1, motionSteps: 0, motionCfg: 3.5 },
    endImage: '',
    // Defaults are the nodes' own (KJNodes WanVideoNAG, nodes_easycache.py, nodes_context_windows.py).
    guidance: { cfgZeroStar: false, nag: { on: false, scale: 11, alpha: 0.25, tau: 2.5 } },
    speedups: { easyCache: { on: false, threshold: 0.2, startPercent: 0.15, endPercent: 0.95 }, torchCompile: false },
    longClip: { on: false, windowFrames: 81, overlapFrames: 30 },
    colorMatch: { on: false, method: 'mkl', strength: 1 },
    interpolate: { on: false, model: INTERPOLATION_MODELS[0], multiplier: 2 },
    encode: { container: 'mp4', codec: 'h264', crf: null },
    engine: 'wan',
    h3: defaultH3Settings(),
  };
}

/** H3's frame rate is fixed. */
export const H3_FPS = 24;

/** The turbo LoRAs in Comfy-Org/MiniMax-H3 (lightx2v distills), with the steps each is made for. */
export const H3_TURBO_LORAS = {
  fl2va8: 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors',
  fl2va4: 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
  ref4: 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors',
} as const;

/** The steps a turbo LoRA was distilled for, from its name; null when the name does not say. */
export function h3TurboStepsOf(lora: string): number | null {
  const m = /(\d+)[-_ ]?step/i.exec(lora);
  return m ? Number(m[1]) : null;
}

/** The templates' defaults: pruned INT8 checkpoints, the NVFP4 text encoder (runs on any GPU),
 *  fp16 video VAE, 0.4 MP 16:9, 5 s, 20 steps res_multistep / simple, turbo off. */
export function defaultH3Settings(): H3Settings {
  return {
    mode: 't2v',
    models: { fl2va: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', ref2va: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors' },
    textEncoder: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
    videoVae: 'minimax_h3_video_vae_fp16.safetensors',
    audioVae: 'minimax_h3_audio_vae_fp32.safetensors',
    loras: [],
    width: 864,
    height: 480,
    length: 124,
    steps: 20,
    cfg: 1,
    sampler: 'res_multistep',
    scheduler: 'simple',
    shiftVideo: 12,
    shiftAudio: 3,
    audio: true,
    turbo: { on: false, lora: H3_TURBO_LORAS.fl2va8, steps: 8, loraRef: H3_TURBO_LORAS.ref4, stepsRef: 4, strength: 1 },
    refImages: [],
    refImageSize: 'match',
    lowVram: { attention: false, headChunks: 4, feedForward: false, chunks: 2 },
  };
}

/** Saved H3 settings (any version) with every missing field at its default. */
export function loadH3Settings(raw: unknown): H3Settings {
  const base = defaultH3Settings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const r = raw as Partial<H3Settings>;
  const obj = <T extends object>(def: T, v: unknown): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...def, ...(v as Partial<T>) } : def);
  const out: H3Settings = { ...base, ...r };
  out.models = obj(base.models, r.models);
  out.turbo = obj(base.turbo, r.turbo);
  out.lowVram = obj(base.lowVram, r.lowVram);
  if (!Array.isArray(out.loras)) out.loras = [];
  if (!Array.isArray(out.refImages)) out.refImages = [];
  out.refImages = out.refImages.filter((x): x is string => typeof x === 'string' && !!x).slice(0, 9);
  return out;
}

/** Snap a frame count up to H3's 17k + 5 grid (5, 22, 39, … 124 …), as the node does. */
export function h3Length(frames: number): number {
  let n = Math.max(5, Math.round(Number(frames) || 5));
  while (n % 17 !== 5) n += 1;
  return n;
}

/** H3 canvases are multiples of 32. */
export const h3Side = (px: number) => Math.max(32, Math.round(px / 32) * 32);

/** The steps an H3 run samples: the turbo LoRA's own count when it is on. */
export function h3EffectiveSteps(h: H3Settings): number {
  const turbo = h.turbo ?? defaultH3Settings().turbo;
  if (turbo.on) return Math.max(1, Math.round(h.mode === 'ref' ? turbo.stepsRef : turbo.steps));
  return Math.max(1, Math.round(h.steps));
}

/** The frames and fps of the clip itself, whichever engine makes it. */
export function clipFrames(s: Pick<VideoSettings, 'length'> & Partial<Pick<VideoSettings, 'engine' | 'h3'>>): number {
  return s.engine === 'h3' && s.h3 ? h3Length(s.h3.length) : wanLength(s.length);
}
export function clipFps(s: Pick<VideoSettings, 'fps'> & Partial<Pick<VideoSettings, 'engine'>>): number {
  return s.engine === 'h3' ? H3_FPS : Number(s.fps);
}

/** A MiniMax H3 file by name (Comfy-Org's repack: minimax_h3_*, qwen3vl_32b_minimax_h3_*). */
export const isH3Name = (name: string) => /minimax[-_ ]?h3/i.test(name);

/** Any video-only model file (Wan or H3): kept out of the image pickers. */
export const isVideoModelName = (name: string) => isWanName(name) || isH3Name(name);

/** H3 clips are saved with this prefix; a file named so carries the model's soundtrack, so the
 *  players unmute it. */
export const H3_FILE_PREFIX = 'ImageLab_H3';
export const videoHasAudio = (urlOrName: string) => {
  try { return /ImageLab_H3/i.test(decodeURIComponent(urlOrName)); } catch { return /ImageLab_H3/i.test(urlOrName); }
};

/**
 * Saved settings (any version) to the current shape: every missing key gets its default, nested
 * objects are merged key by key, so a saved `imagelab.video.v1` from before a field existed
 * builds exactly the graph it built then.
 */
export function loadVideoSettings(raw: unknown): VideoSettings {
  const base = defaultVideoSettings();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof VideoSettings, unknown>>;
  const obj = <T extends object>(def: T, v: unknown): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...def, ...(v as Partial<T>) } : def);
  const out: VideoSettings = { ...base, ...(r as Partial<VideoSettings>) };
  out.models = obj(base.models, r.models);
  out.fastLoras = obj(base.fastLoras, r.fastLoras);
  out.speedInside = obj(base.speedInside, r.speedInside);
  out.upscale = obj(base.upscale, r.upscale);
  out.fastRecipe = obj(base.fastRecipe, r.fastRecipe);
  const g = obj(base.guidance, r.guidance);
  out.guidance = { ...g, nag: obj(base.guidance.nag, (r.guidance as Partial<VideoGuidance> | undefined)?.nag) };
  const sp = obj(base.speedups, r.speedups);
  out.speedups = { ...sp, easyCache: obj(base.speedups.easyCache, (r.speedups as Partial<VideoSpeedups> | undefined)?.easyCache) };
  out.longClip = obj(base.longClip, r.longClip);
  out.colorMatch = obj(base.colorMatch, r.colorMatch);
  out.interpolate = obj(base.interpolate, r.interpolate);
  out.encode = obj(base.encode, r.encode);
  out.engine = r.engine === 'h3' ? 'h3' : 'wan';
  out.h3 = loadH3Settings(r.h3);
  if (!Array.isArray(out.loras)) out.loras = [];
  if (typeof out.endImage !== 'string') out.endImage = '';
  return out;
}

/** A GGUF (quantized) model: it loads through ComfyUI-GGUF's `UnetLoaderGGUF`, not `UNETLoader`. */
export const isGgufName = (name: string) => /\.gguf$/i.test(name);

/**
 * Whether a Wan mix already has the lightx2v / Lightning speed LoRA merged in, by its name. Adding
 * the LoRA again degrades the video (the makers say so). SmoothMix's T2V versions have it
 * ("light2xv baked in"), its I2V v2.0 does not; "WAN 2.2 Enhanced NSFW" has it in every version
 * except the ones named "nolightning".
 */
export function speedLoraBuiltIn(name: string): boolean {
  const n = name.replace(/^.*[\\/]/, '');
  if (/no[-_ ]?light/i.test(n)) return false;
  if (/smoothmixwan/i.test(n)) return /t2v/i.test(n);
  if (/wan22EnhancedNSFW/i.test(n)) return true;
  return /lightning|lightx2v|light2xv/i.test(n);
}

/** Whether Fast should skip the speed LoRA for this file: the user's choice, else the name's. */
export const hasSpeedInside = (s: Pick<VideoSettings, 'speedInside'>, file: string) =>
  s.speedInside?.[file] ?? speedLoraBuiltIn(file);

/** Round a frame count to Wan's 4n + 1 (5, 9, … 81 …). */
export function wanLength(frames: number): number {
  return Math.max(5, Math.round((Math.round(frames) - 1) / 4) * 4 + 1);
}

/** Wan sizes are multiples of 16. */
export const wanSide = (px: number) => Math.max(16, Math.round(px / 16) * 16);

const fastRecipeOf = (s: Pick<VideoSettings, 'fastRecipe'>): FastRecipe => ({ ...defaultVideoSettings().fastRecipe, ...(s.fastRecipe ?? {}) });

/** What the samplers actually run with: Fast's recipe, or the full settings. `motionSteps` is the
 *  LoRA-free high-noise steps before the lightx2v ones (Fast only, never past the switch). */
export function effectiveSampling(s: VideoSettings): { steps: number; switchStep: number; cfg: number; cfgLow: number; motionSteps: number; motionCfg: number } {
  const fr = fastRecipeOf(s);
  const steps = Math.max(1, Math.round(s.fast ? fr.steps : s.steps));
  const switchStep = Math.min(steps, Math.max(0, Math.round(s.fast ? fr.switchStep : s.switchStep)));
  const cfg = s.fast ? Number(fr.cfg) : Number(s.cfg);
  const cfgLow = s.fast ? cfg : (s.cfgLow == null ? cfg : Number(s.cfgLow));
  const motionSteps = s.fast ? Math.min(switchStep, Math.max(0, Math.round(Number(fr.motionSteps) || 0))) : 0;
  return { steps, switchStep, cfg, cfgLow, motionSteps, motionCfg: Number(fr.motionCfg) || 3.5 };
}

/** The frame count and fps the saved file has (either engine). */
export function outputFrames(s: Pick<VideoSettings, 'length' | 'fps' | 'interpolate'> & Partial<Pick<VideoSettings, 'engine' | 'h3'>>): { frames: number; fps: number } {
  const frames = clipFrames(s);
  const fps = clipFps(s);
  const mult = s.interpolate?.on ? Math.max(2, Math.min(16, Math.round(s.interpolate.multiplier))) : 1;
  // FrameInterpolate: (frames − 1) × multiplier + 1 frames out.
  return mult > 1 ? { frames: (frames - 1) * mult + 1, fps: fps * mult } : { frames, fps };
}

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } }>;
type Ref = [string, number];

/**
 * The API graph for one video. `startImage` is the `LoadImage` reference of the uploaded start
 * frame; image to video without one is refused by the caller.
 */
export function buildWanGraph(s: VideoSettings, startImage: string | null = null): Graph {
  const i2v = s.mode === 'i2v';
  const files = s.models[s.mode];
  const { steps, switchStep: switchAt, cfg, cfgLow, motionSteps, motionCfg } = effectiveSampling(s);
  const seed = Math.trunc(Number(s.seed) || 0);
  const width = wanSide(s.width), height = wanSide(s.height), length = wanLength(s.length);
  const fr = fastRecipeOf(s);
  const guidance = s.guidance ?? defaultVideoSettings().guidance;
  const speedups = s.speedups ?? defaultVideoSettings().speedups;
  const g: Graph = {};
  const node = (id: string, class_type: string, inputs: Record<string, unknown>, title?: string): Ref => {
    g[id] = { class_type, inputs, ...(title ? { _meta: { title } } : {}) };
    return [id, 0];
  };

  // Each expert: its model, its LoRAs, the shift, then the optional patches. `plain` is the
  // motion pass's copy of the high expert: the same loader node, no speed LoRA, its own chain.
  const expert = (which: 'high' | 'low', id: string, plain = false): Ref => {
    const file = which === 'high' ? files.high : files.low;
    const title = which === 'high' ? 'High-noise model' : 'Low-noise model';
    const loaderId = plain ? id.slice(0, -1) : id;
    let model: Ref = plain ? [loaderId, 0] : isGgufName(file)
      ? node(id, 'UnetLoaderGGUF', { unet_name: file }, title)
      : node(id, 'UNETLoader', { unet_name: file, weight_dtype: s.weightDtype ?? 'default' }, title);
    if (s.fast && !plain && !hasSpeedInside(s, file)) {
      const strength = Number(which === 'high' ? fr.strengthHigh : fr.strengthLow);
      model = node(`${id}f`, 'LoraLoaderModelOnly', { model, lora_name: s.fastLoras[s.mode][which], strength_model: Number.isFinite(strength) ? strength : 1 }, 'lightx2v 4-step');
    }
    s.loras.forEach((l, i) => {
      // A pair (`nameLow`) is one file per expert; a single file goes where `expert` says.
      const pair = !!l.nameLow;
      const file = pair && which === 'low' ? l.nameLow! : l.name;
      if (!l.on || !file || (!pair && l.expert !== 'both' && l.expert !== which)) return;
      const strength = which === 'low' && (pair || l.expert === 'both') && l.strengthLow != null ? Number(l.strengthLow) : Number(l.strength);
      model = node(`${id}l${i}`, 'LoraLoaderModelOnly', { model, lora_name: file, strength_model: strength });
    });
    const shift = which === 'low' && s.shiftLow != null ? Number(s.shiftLow) : Number(s.shift);
    model = node(`${id}s`, 'ModelSamplingSD3', { model, shift });
    if (speedups.torchCompile) model = node(`${id}t`, 'TorchCompileModel', { model, backend: 'inductor' }, 'torch.compile');
    if (guidance.cfgZeroStar) model = node(`${id}c`, 'CFGZeroStar', { model }, 'CFG-Zero*');
    if (guidance.nag?.on && Number(guidance.nag.scale) > 0) {
      // The negative text embedding comes from node 8 (the negative CLIPTextEncode, below).
      model = node(`${id}n`, 'WanVideoNAG', { model, conditioning: ['8', 0], nag_scale: Number(guidance.nag.scale), nag_alpha: Number(guidance.nag.alpha), nag_tau: Number(guidance.nag.tau) }, 'NAG');
    }
    const ec = speedups.easyCache;
    if (ec?.on) {
      model = node(`${id}e`, 'EasyCache', { model, reuse_threshold: Number(ec.threshold), start_percent: Number(ec.startPercent), end_percent: Number(ec.endPercent), verbose: false }, 'EasyCache');
    }
    const lc = s.longClip;
    if (lc?.on) {
      const windowFrames = Math.min(length, wanLength(lc.windowFrames));
      const overlap = Math.max(0, Math.min(windowFrames - 1, Math.round(lc.overlapFrames)));
      model = node(`${id}w`, 'WanContextWindowsManual', {
        model, context_length: windowFrames, context_overlap: overlap, context_schedule: 'static_standard', context_stride: 1,
        closed_loop: false, fuse_method: 'pyramid', freenoise: true, retain_first_frame: i2v, split_conds_to_windows: false,
      }, 'Context windows');
    }
    return model;
  };
  const high = expert('high', '1');
  const low = expert('low', '2');
  // The motion pass reuses loader '1' (same weights, so nothing loads twice).
  const plainHigh = motionSteps > 0 ? expert('high', '1p', true) : null;

  const clip = node('3', 'CLIPLoader', { clip_name: s.textEncoder, type: 'wan', device: 'default' });
  const vae = node('4', 'VAELoader', { vae_name: s.vae });
  let positive = node('7', 'CLIPTextEncode', { text: s.positive, clip }, 'Positive');
  let negative = node('8', 'CLIPTextEncode', { text: s.negative, clip }, 'Negative');

  let latent: Ref;
  let start: Ref | null = null;
  if (i2v) {
    start = node('9', 'LoadImage', { image: startImage ?? '' }, 'Start image');
    if (s.endImage) {
      const end = node('9e', 'LoadImage', { image: s.endImage }, 'End image');
      node('10', 'WanFirstLastFrameToVideo', { positive, negative, vae, width, height, length, batch_size: 1, start_image: start, end_image: end });
    } else {
      node('10', 'WanImageToVideo', { positive, negative, vae, width, height, length, batch_size: 1, start_image: start });
    }
    positive = ['10', 0]; negative = ['10', 1]; latent = ['10', 2];
  } else {
    latent = node('10', 'EmptyHunyuanLatentVideo', { width, height, length, batch_size: 1 });
  }

  const sample = (id: string, model: Ref, from: Ref, startAt: number, endAt: number, cfgHere: number, title: string): Ref => node(id, 'KSamplerAdvanced', {
    model, add_noise: startAt === 0 ? 'enable' : 'disable', noise_seed: seed, steps, cfg: cfgHere,
    sampler_name: s.sampler, scheduler: s.scheduler, positive, negative, latent_image: from,
    start_at_step: startAt, end_at_step: endAt,
    return_with_leftover_noise: endAt < steps ? 'enable' : 'disable',
  }, title);
  let noisy = latent;
  if (plainHigh) noisy = sample('11p', plainHigh, noisy, 0, motionSteps, motionCfg, 'Motion pass (no speed LoRA)');
  if (motionSteps < switchAt) noisy = sample('11', high, noisy, motionSteps, switchAt, cfg, 'High noise');
  const done = sample('12', low, noisy, switchAt, 10000, cfgLow, 'Low noise');

  let frames = node('13', 'VAEDecode', { samples: done, vae });
  const cm = s.colorMatch;
  if (start && cm?.on && Number(cm.strength) > 0) {
    frames = node('13m', 'ColorMatchV2', { image_target: frames, image_ref: start, method: cm.method, strength: Number(cm.strength), multithread: true }, 'Colour match');
  }
  const up = s.upscale;
  if (up?.on && Number(up.scale) > 0 && Number(up.scale) !== 1) {
    const [tw, th] = upscaledSize(width, height, Number(up.scale));
    if (up.method === 'model' && up.model) {
      // The model scales by its own factor (2x, 4x); an exact resize then lands on the target.
      const model = node('16m', 'UpscaleModelLoader', { model_name: up.model }, 'Upscale model');
      const big = node('16x', 'ImageUpscaleWithModel', { upscale_model: model, image: frames });
      frames = node('16', 'ImageScale', { image: big, upscale_method: up.resizeMethod, width: tw, height: th, crop: 'disabled' }, 'Upscale');
    } else {
      frames = node('16', 'ImageScale', { image: frames, upscale_method: up.resizeMethod, width: tw, height: th, crop: 'disabled' }, 'Upscale');
    }
  }
  const out = outputFrames(s);
  if (s.interpolate?.on && out.frames > length) {
    const model = node('17m', 'FrameInterpolationModelLoader', { model_name: s.interpolate.model }, 'Interpolation model');
    frames = node('17', 'FrameInterpolate', { interp_model: model, images: frames, multiplier: Math.round(s.interpolate.multiplier) }, 'Frame interpolation');
  }
  const video = node('14', 'CreateVideo', { images: frames, fps: out.fps });
  node('15', 'SaveVideo', { video, filename_prefix: `video/ImageLab_${s.mode.toUpperCase()}`, ...saveVideoInputs(s.encode) });
  return g;
}

/**
 * `SaveVideo`'s format input is a dynamic combo (COMFY_DYNAMICCOMBO_V3): the chosen option's
 * nested inputs travel as dotted keys — `format.codec`, `format.codec.encoding`,
 * `format.codec.encoding.crf` — which ComfyUI's `build_nested_inputs` folds back into a dict.
 * The default encode keeps the plain `format: mp4, codec: h264` pair that has run on the pod.
 */
export function saveVideoInputs(e: VideoEncode | undefined): Record<string, unknown> {
  const container = e?.container ?? 'mp4';
  const allowed = CONTAINER_CODECS[container] ?? CONTAINER_CODECS.mp4;
  const codec = e?.codec && allowed.includes(e.codec) ? e.codec : allowed[0];
  const crf = e?.crf;
  if (crf == null || !Number.isFinite(Number(crf))) return { format: container, codec };
  const max = codec === 'av1' ? 63 : 51;
  return {
    format: container,
    'format.codec': codec,
    'format.codec.encoding': 're-encode',
    'format.codec.encoding.crf': Math.max(0, Math.min(max, Math.round(Number(crf)))),
  };
}

/** A file ComfyUI saved as video, by name. */
export function isVideoName(name: string): boolean {
  return /\.(mp4|webm|mov|mkv)$/i.test(name);
}

/** A Wan file by name (CivitAI mixes like SmoothMix keep "wan" in the name). */
export const isWanName = (name: string) => /wan[-_ .]?2|smoothmixwan/i.test(name);

/**
 * Installed files for the chosen ones that are missing: for each expert, the one Wan file of the
 * mode (t2v / i2v) whose name says high or low; the umt5 text encoder; the Wan 2.1 VAE (A14B
 * uses it, not the 2.2 one). Only fills what is missing and has exactly one clear candidate.
 */
export function pickInstalledWanFiles(
  s: Pick<VideoSettings, 'mode' | 'models' | 'textEncoder' | 'vae'>,
  server: { diffusionModels: string[]; textEncoders: string[]; vaes: string[] },
): Partial<Pick<VideoSettings, 'models' | 'textEncoder' | 'vae'>> {
  const patch: Partial<Pick<VideoSettings, 'models' | 'textEncoder' | 'vae'>> = {};
  const only = (list: string[]) => (list.length === 1 ? list[0] : undefined);
  // A T2V file says t2v. An I2V file says i2v and not t2v: SmoothMix's family name is "…I2V", so
  // its T2V versions carry both.
  const ofMode = (f: string) => (s.mode === 't2v' ? /t2v/i.test(f) : /i2v/i.test(f) && !/t2v/i.test(f));
  const wan = server.diffusionModels.filter((f) => isWanName(f) && ofMode(f));
  const current = s.models[s.mode];
  const next = { ...current };
  for (const which of ['high', 'low'] as const) {
    if (server.diffusionModels.includes(current[which])) continue;
    const found = only(wan.filter((f) => new RegExp(which, 'i').test(f)));
    if (found) next[which] = found;
  }
  if (next.high !== current.high || next.low !== current.low) patch.models = { ...s.models, [s.mode]: next };
  if (!server.textEncoders.includes(s.textEncoder)) {
    const te = only(server.textEncoders.filter((f) => /umt5/i.test(f)));
    if (te) patch.textEncoder = te;
  }
  if (!server.vaes.includes(s.vae)) {
    const vae = only(server.vaes.filter((f) => /wan[-_ ]?2[._]1.*vae|wan.*2\.1/i.test(f)));
    if (vae) patch.vae = vae;
  }
  return patch;
}

type AnyGraph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
const num = (v: unknown) => Number(v) || 0;

/**
 * What a Wan graph will do, for the time estimate (lib/videoEstimate). Read from the graph itself
 * so an estimate and a measured run are described the same way. Interpolated frames count in the
 * output (`frames` is what the finish stage handles), not in the sampling.
 */
export function wanRunShape(graph: AnyGraph): import('./videoEstimate').RunShape {
  const latent = graph['10']?.inputs ?? {};
  const sampler = graph['11']?.inputs ?? graph['11p']?.inputs ?? {};
  const cfgs = ['11p', '11', '12'].map((id) => num(graph[id]?.inputs.cfg));
  const out = graph['16']?.inputs;
  const width = num(latent.width), height = num(latent.height);
  const models = Object.values(graph)
    .filter((n) => ['UNETLoader', 'UnetLoaderGGUF', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly', 'UpscaleModelLoader', 'FrameInterpolationModelLoader'].includes(n.class_type))
    .map((n) => String(n.inputs.unet_name ?? n.inputs.clip_name ?? n.inputs.vae_name ?? n.inputs.lora_name ?? n.inputs.model_name ?? ''))
    .sort();
  const frames = num(latent.length);
  const mult = graph['17'] ? Math.max(1, num(graph['17'].inputs.multiplier)) : 1;
  return {
    width, height, frames, steps: num(sampler.steps), cfg: Math.max(...cfgs),
    outWidth: out ? num(out.width) : width, outHeight: out ? num(out.height) : height,
    outFrames: mult > 1 ? (frames - 1) * mult + 1 : frames,
    upscaleModel: graph['16m'] ? String(graph['16m'].inputs.model_name) : null,
    modelsKey: models.join('|'),
  };
}

/** The sampler, upscale and finish node ids of a Wan or H3 graph (the rest of a run's time is
 *  loading). The H3 graph keeps the same ids ('13a' is its audio decode). */
export const WAN_NODE_GROUPS = {
  sampling: ['11p', '11', '12'],
  upscale: ['16m', '16x'],
  finish: ['13', '13a', '13m', '16', '17m', '17', '14', '15'],
} as const;

/** A finished run's timing, split into the parts the estimate learns separately. */
export function wanRunTiming(graph: AnyGraph, nodeMs: Record<string, number>, at = Date.now()): import('./videoEstimate').RunTiming {
  const shape = wanRunShape(graph);
  const sum = (ids: readonly string[]) => ids.reduce((t, id) => t + (nodeMs[id] ?? 0), 0);
  const sampling = sum(WAN_NODE_GROUPS.sampling);
  const upscale = sum(WAN_NODE_GROUPS.upscale);
  const finish = sum(WAN_NODE_GROUPS.finish);
  const all = Object.values(nodeMs).reduce((t, ms) => t + ms, 0);
  const outFrames = shape.outFrames ?? shape.frames;
  return {
    at,
    sampleUnits: (shape.width * shape.height * shape.frames * shape.steps * (shape.cfg > 1 ? 2 : 1)) / 1e9,
    samplingMs: sampling,
    outUnits: (shape.outWidth * shape.outHeight * outFrames) / 1e9,
    finishMs: finish,
    upscaleModel: shape.upscaleModel,
    upscaleMs: upscale,
    loadMs: Math.max(0, all - sampling - upscale - finish),
    modelsKey: shape.modelsKey,
  };
}
