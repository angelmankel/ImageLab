/**
 * Wan 2.2 A14B video graphs (text to video, image to video), as in ImageLabDocker's
 * workflows/Wan 2.2 *.json.
 *
 * A14B is two 14B experts: the high-noise one samples the first steps and hands its still-noisy
 * latent to the low-noise one, which finishes. Each runs through `ModelSamplingSD3` (shift) and
 * its own LoRAs (Wan 2.2 LoRAs ship as a high/low pair). The video is saved as MP4 (H.264) in
 * `output/video/`.
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
};

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
  const steps = Math.max(1, Math.round(s.steps));
  const switchAt = Math.min(steps, Math.max(0, Math.round(s.switchStep)));
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
    model, add_noise: first ? 'enable' : 'disable', noise_seed: seed, steps, cfg: Number(s.cfg),
    sampler_name: s.sampler, scheduler: s.scheduler, positive, negative, latent_image: from,
    start_at_step: first ? 0 : switchAt, end_at_step: first ? switchAt : 10000,
    return_with_leftover_noise: first ? 'enable' : 'disable',
  }, title);
  const noisy = sample('11', high, true, latent, 'High noise');
  const done = sample('12', low, false, noisy, 'Low noise');

  const frames = node('13', 'VAEDecode', { samples: done, vae });
  const video = node('14', 'CreateVideo', { images: frames, fps: Number(s.fps) });
  node('15', 'SaveVideo', { video, filename_prefix: `video/ImageLab_${s.mode.toUpperCase()}`, format: 'mp4', codec: 'h264' });
  return g;
}

/** A file ComfyUI saved as video, by name. */
export function isVideoName(name: string): boolean {
  return /\.(mp4|webm|mov|mkv)$/i.test(name);
}
