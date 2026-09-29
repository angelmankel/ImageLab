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
 * No runtime imports: the tests load this file on its own.
 */

export type VideoMode = 't2v' | 'i2v';

export type VideoLora = {
  id: string;
  name: string;
  strength: number;
  on: boolean;
  /** Which expert it patches. Wan 2.2 LoRAs come as a high-noise and a low-noise file. */
  expert: 'high' | 'low' | 'both';
};

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
  /** Optional upscale of the finished frames, before the MP4 is written. */
  upscale: VideoUpscale;
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
    // Off by default. The SPAN 2x model is the fast one: on the A100, 81 frames 832x480 -> 2x took
    // ~5 s more than a plain resize.
    upscale: { on: false, method: 'model', model: '2xNomosUni_span_multijpg.safetensors', scale: 2, resizeMethod: 'lanczos' },
  };
}

/** Round a frame count to Wan's 4n + 1 (5, 9, … 81 …). */
export function wanLength(frames: number): number {
  return Math.max(5, Math.round((Math.round(frames) - 1) / 4) * 4 + 1);
}

/** Wan sizes are multiples of 16. */
export const wanSide = (px: number) => Math.max(16, Math.round(px / 16) * 16);

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } }>;
type Ref = [string, number];

/**
 * The API graph for one video. `startImage` is the `LoadImage` reference of the uploaded start
 * frame; image to video without one is refused by the caller.
 */
export function buildWanGraph(s: VideoSettings, startImage: string | null = null): Graph {
  const i2v = s.mode === 'i2v';
  const files = s.models[s.mode];
  const steps = s.fast ? FAST.steps : Math.max(1, Math.round(s.steps));
  const switchAt = Math.min(steps, Math.max(0, Math.round(s.fast ? FAST.switchStep : s.switchStep)));
  const cfg = s.fast ? FAST.cfg : Number(s.cfg);
  const seed = Math.trunc(Number(s.seed) || 0);
  const width = wanSide(s.width), height = wanSide(s.height), length = wanLength(s.length);
  const g: Graph = {};
  const node = (id: string, class_type: string, inputs: Record<string, unknown>, title?: string): Ref => {
    g[id] = { class_type, inputs, ...(title ? { _meta: { title } } : {}) };
    return [id, 0];
  };

  // Each expert: its model, its LoRAs, then the shift.
  const expert = (which: 'high' | 'low', id: string): Ref => {
    let model = node(id, 'UNETLoader', { unet_name: which === 'high' ? files.high : files.low, weight_dtype: 'default' },
      which === 'high' ? 'High-noise model' : 'Low-noise model');
    if (s.fast) {
      model = node(`${id}f`, 'LoraLoaderModelOnly', { model, lora_name: s.fastLoras[s.mode][which], strength_model: 1 }, 'lightx2v 4-step');
    }
    s.loras.forEach((l, i) => {
      if (!l.on || !l.name || (l.expert !== 'both' && l.expert !== which)) return;
      model = node(`${id}l${i}`, 'LoraLoaderModelOnly', { model, lora_name: l.name, strength_model: Number(l.strength) });
    });
    return node(`${id}s`, 'ModelSamplingSD3', { model, shift: Number(s.shift) });
  };
  const high = expert('high', '1');
  const low = expert('low', '2');

  const clip = node('3', 'CLIPLoader', { clip_name: s.textEncoder, type: 'wan', device: 'default' });
  const vae = node('4', 'VAELoader', { vae_name: s.vae });
  let positive = node('7', 'CLIPTextEncode', { text: s.positive, clip }, 'Positive');
  let negative = node('8', 'CLIPTextEncode', { text: s.negative, clip }, 'Negative');

  let latent: Ref;
  if (i2v) {
    const image = node('9', 'LoadImage', { image: startImage ?? '' }, 'Start image');
    node('10', 'WanImageToVideo', { positive, negative, vae, width, height, length, batch_size: 1, start_image: image });
    positive = ['10', 0]; negative = ['10', 1]; latent = ['10', 2];
  } else {
    latent = node('10', 'EmptyHunyuanLatentVideo', { width, height, length, batch_size: 1 });
  }

  const sample = (id: string, model: Ref, first: boolean, from: Ref, title: string): Ref => node(id, 'KSamplerAdvanced', {
    model, add_noise: first ? 'enable' : 'disable', noise_seed: seed, steps, cfg,
    sampler_name: s.sampler, scheduler: s.scheduler, positive, negative, latent_image: from,
    start_at_step: first ? 0 : switchAt, end_at_step: first ? switchAt : 10000,
    return_with_leftover_noise: first ? 'enable' : 'disable',
  }, title);
  const noisy = sample('11', high, true, latent, 'High noise');
  const done = sample('12', low, false, noisy, 'Low noise');

  let frames = node('13', 'VAEDecode', { samples: done, vae });
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
  const video = node('14', 'CreateVideo', { images: frames, fps: Number(s.fps) });
  node('15', 'SaveVideo', { video, filename_prefix: `video/ImageLab_${s.mode.toUpperCase()}`, format: 'mp4', codec: 'h264' });
  return g;
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
 * so an estimate and a measured run are described the same way.
 */
export function wanRunShape(graph: AnyGraph): import('./videoEstimate').RunShape {
  const latent = graph['10']?.inputs ?? {};
  const sampler = graph['11']?.inputs ?? {};
  const out = graph['16']?.inputs;
  const width = num(latent.width), height = num(latent.height);
  const models = Object.values(graph)
    .filter((n) => ['UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly', 'UpscaleModelLoader'].includes(n.class_type))
    .map((n) => String(n.inputs.unet_name ?? n.inputs.clip_name ?? n.inputs.vae_name ?? n.inputs.lora_name ?? n.inputs.model_name ?? ''))
    .sort();
  return {
    width, height, frames: num(latent.length), steps: num(sampler.steps), cfg: num(sampler.cfg),
    outWidth: out ? num(out.width) : width, outHeight: out ? num(out.height) : height,
    upscaleModel: graph['16m'] ? String(graph['16m'].inputs.model_name) : null,
    modelsKey: models.join('|'),
  };
}

/** A finished run's timing, split into the parts the estimate learns separately. */
export function wanRunTiming(graph: AnyGraph, nodeMs: Record<string, number>, at = Date.now()): import('./videoEstimate').RunTiming {
  const shape = wanRunShape(graph);
  const sum = (ids: string[]) => ids.reduce((t, id) => t + (nodeMs[id] ?? 0), 0);
  const sampling = sum(['11', '12']);
  const upscale = sum(['16m', '16x']);
  const finish = sum(['13', '16', '14', '15']);
  const all = Object.values(nodeMs).reduce((t, ms) => t + ms, 0);
  return {
    at,
    sampleUnits: (shape.width * shape.height * shape.frames * shape.steps * (shape.cfg > 1 ? 2 : 1)) / 1e9,
    samplingMs: sampling,
    outUnits: (shape.outWidth * shape.outHeight * shape.frames) / 1e9,
    finishMs: finish,
    upscaleModel: shape.upscaleModel,
    upscaleMs: upscale,
    loadMs: Math.max(0, all - sampling - upscale - finish),
    modelsKey: shape.modelsKey,
  };
}
