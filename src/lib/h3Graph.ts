/**
 * MiniMax H3 video graphs: text → video, first / last frame → video, reference pictures → video,
 * every one with the model's own stereo soundtrack. Read from ComfyUI v0.34.5's
 * `comfy_extras/nodes_minimax_h3.py` and the bundled `video_minimax_h3_t2v / i2v / r2v`
 * templates (the pod's ComfyUI serves both), not guessed.
 *
 * H3 is one 33B omni model: a joint video + audio latent (`MiniMaxH3ImageToVideo` /
 * `MiniMaxH3ReferenceToVideo` make it together with the conditioning), sampled by one stock
 * sampler, then decoded twice — the video VAE takes the video half (`VAEDecode` unbinds the pair),
 * the audio VAE the audio half (`VAEDecodeAudio`) — and `CreateVideo` muxes the two at 24 fps.
 * The templates run `BasicGuider` (no negative, no CFG); this graph is the same thing through
 * `KSampler` at CFG 1 with a zeroed negative, so a CFG above 1 is one slider away.
 *
 * Node ids follow the Wan graph where the role matches ('10' is the conditioning + latent node
 * with width / height / length, '11' the sampler, '13' the decode, '14' / '15' the file) so the
 * time estimate (`wanRunShape`, `WAN_NODE_GROUPS`) and the Finish / Upscale steps read both.
 *
 * Imports only `./wanGraph` (which imports nothing), so the tests load it from source.
 */
import {
  H3_FILE_PREFIX, H3_FPS, buildWanGraph, defaultH3Settings, h3EffectiveSteps, h3Length, h3Side, isH3Name, outputFrames, saveVideoInputs, upscaledSize,
  type H3Settings, type VideoSettings,
} from './wanGraph';

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } }>;
type Ref = [string, number];

/** Size presets: the templates' 0.4 MP buckets, and the model's native 768-short-edge canvas. */
export const H3_SIZE_PRESETS = [
  { group: '0.4 MP (quick)', items: [
    { value: '864x480', label: '864 × 480 (16:9)' },
    { value: '480x864', label: '480 × 864 (9:16)' },
    { value: '640x640', label: '640 × 640 (1:1)' },
    { value: '736x544', label: '736 × 544 (4:3)' },
  ] },
  { group: 'Native 768p', items: [
    { value: '1344x768', label: '1344 × 768 (16:9)' },
    { value: '768x1344', label: '768 × 1344 (9:16)' },
    { value: '768x768', label: '768 × 768 (1:1)' },
    { value: '1024x768', label: '1024 × 768 (4:3)' },
    { value: '768x1024', label: '768 × 1024 (3:4)' },
  ] },
];

/** The checkpoint a mode runs on. */
export const h3ModelFile = (h: H3Settings) => (h.mode === 'ref' ? h.models.ref2va : h.models.fl2va);

/** The turbo LoRA a mode uses (null when turbo is off). */
export const h3TurboLora = (h: H3Settings) => (h.turbo?.on ? (h.mode === 'ref' ? h.turbo.loraRef : h.turbo.lora) : null);

/**
 * The API graph for one H3 video. `startImage` is the `LoadImage` reference of the uploaded first
 * frame (i2v); the reference task reads `h3.refImages`. The caller refuses an i2v without a start
 * image and a ref without a picture.
 */
export function buildH3Graph(s: VideoSettings, startImage: string | null = null): Graph {
  const h: H3Settings = { ...defaultH3Settings(), ...(s.h3 ?? {}) };
  const steps = h3EffectiveSteps(h);
  const seed = Math.trunc(Number(s.seed) || 0);
  const width = h3Side(h.width), height = h3Side(h.height), length = h3Length(h.length);
  const audio = h.audio !== false;
  const g: Graph = {};
  const node = (id: string, class_type: string, inputs: Record<string, unknown>, title?: string): Ref => {
    g[id] = { class_type, inputs, ...(title ? { _meta: { title } } : {}) };
    return [id, 0];
  };

  // The model: checkpoint, turbo LoRA, the user's LoRAs, the flow shifts, then the VRAM patches.
  let model: Ref = node('1', 'UNETLoader', { unet_name: h3ModelFile(h), weight_dtype: s.weightDtype ?? 'default' }, 'MiniMax H3');
  const turbo = h3TurboLora(h);
  if (turbo) model = node('1f', 'LoraLoaderModelOnly', { model, lora_name: turbo, strength_model: Number.isFinite(Number(h.turbo.strength)) ? Number(h.turbo.strength) : 1 }, 'Turbo LoRA');
  (h.loras ?? []).forEach((l, i) => {
    if (!l.on || !l.name) return;
    model = node(`1l${i}`, 'LoraLoaderModelOnly', { model, lora_name: l.name, strength_model: Number(l.strength) });
  });
  model = node('1s', 'MiniMaxH3SigmaShift', { model, shift_video: Number(h.shiftVideo), shift_audio: Number(h.shiftAudio) }, 'Sigma shift');
  const lv = h.lowVram ?? defaultH3Settings().lowVram;
  if (lv.attention) model = node('1a', 'MiniMaxLowVRAMAttention', { model, head_chunks: Math.max(1, Math.round(lv.headChunks)) }, 'Low-VRAM attention');
  if (lv.feedForward) model = node('1k', 'MiniMaxChunkFeedForward', { model, chunks: Math.max(1, Math.round(lv.chunks)), seq_threshold: 4096 }, 'Chunked feed-forward');

  const clip = node('3', 'CLIPLoader', { clip_name: h.textEncoder, type: 'minimax', device: 'default' });
  const vae = node('4', 'VAELoader', { vae_name: h.videoVae }, 'Video VAE');
  const needAudioVae = audio || h.mode === 'ref';
  const audioVae: Ref | null = needAudioVae ? node('4a', 'VAELoader', { vae_name: h.audioVae }, 'Audio VAE') : null;

  let start: Ref | null = null;
  if (h.mode === 'ref') {
    const refs: Record<string, Ref> = {};
    (h.refImages ?? []).filter(Boolean).slice(0, 9).forEach((img, i) => {
      refs[`ref_images.ref_image_${i}`] = node(`9r${i}`, 'LoadImage', { image: img }, `<Picture ${i + 1}>`);
    });
    node('10', 'MiniMaxH3ReferenceToVideo', { clip, vae, audio_vae: audioVae, prompt: s.positive, width, height, length, ref_image_size: h.refImageSize ?? 'match', ...refs });
  } else {
    const frames: Record<string, Ref> = {};
    if (h.mode === 'i2v') {
      start = node('9', 'LoadImage', { image: startImage ?? '' }, 'First frame');
      frames.first_frame = start;
      if (s.endImage) frames.last_frame = node('9e', 'LoadImage', { image: s.endImage }, 'Last frame');
    }
    node('10', 'MiniMaxH3ImageToVideo', { clip, vae, prompt: s.positive, width, height, length, ...frames });
  }
  const positive: Ref = ['10', 0];
  const latent: Ref = ['10', 1];
  const negative = node('8', 'ConditioningZeroOut', { conditioning: positive }, 'No negative');

  const sampled = node('11', 'KSampler', {
    model, seed, steps, cfg: Number(h.cfg) || 1, sampler_name: h.sampler, scheduler: h.scheduler,
    positive, negative, latent_image: latent, denoise: 1,
  }, 'Sample video + audio');

  let frames = node('13', 'VAEDecode', { samples: sampled, vae }, 'Decode video');
  const sound: Ref | null = audio && audioVae ? node('13a', 'VAEDecodeAudio', { samples: sampled, vae: audioVae }, 'Decode audio') : null;

  // The shared finish: colour match to the first frame, the upscale, interpolation, the file.
  const cm = s.colorMatch;
  if (start && cm?.on && Number(cm.strength) > 0) {
    frames = node('13m', 'ColorMatchV2', { image_target: frames, image_ref: start, method: cm.method, strength: Number(cm.strength), multithread: true }, 'Colour match');
  }
  const up = s.upscale;
  if (up?.on && Number(up.scale) > 0 && Number(up.scale) !== 1) {
    const [tw, th] = upscaledSize(width, height, Number(up.scale));
    if (up.method === 'model' && up.model) {
      const um = node('16m', 'UpscaleModelLoader', { model_name: up.model }, 'Upscale model');
      const big = node('16x', 'ImageUpscaleWithModel', { upscale_model: um, image: frames });
      frames = node('16', 'ImageScale', { image: big, upscale_method: up.resizeMethod, width: tw, height: th, crop: 'disabled' }, 'Upscale');
    } else {
      frames = node('16', 'ImageScale', { image: frames, upscale_method: up.resizeMethod, width: tw, height: th, crop: 'disabled' }, 'Upscale');
    }
  }
  const out = outputFrames({ ...s, engine: 'h3', h3: h });
  if (s.interpolate?.on && out.frames > length) {
    const im = node('17m', 'FrameInterpolationModelLoader', { model_name: s.interpolate.model }, 'Interpolation model');
    frames = node('17', 'FrameInterpolate', { interp_model: im, images: frames, multiplier: Math.round(s.interpolate.multiplier) }, 'Frame interpolation');
  }
  const video = node('14', 'CreateVideo', { images: frames, fps: out.fps || H3_FPS, ...(sound ? { audio: sound } : {}) });
  node('15', 'SaveVideo', { video, filename_prefix: `video/${H3_FILE_PREFIX}_${h.mode.toUpperCase()}`, ...saveVideoInputs(s.encode) });
  return g;
}

/** The graph for the engine in the settings. */
export function buildVideoGraph(s: VideoSettings, startImage: string | null = null): Graph {
  return s.engine === 'h3' ? buildH3Graph(s, startImage) : buildWanGraph(s, startImage);
}

/**
 * Installed H3 files for chosen ones the server lacks: the one fl2va / ref2va checkpoint, the one
 * qwen3vl H3 text encoder, the one video / audio VAE. Only fills a slot with exactly one candidate.
 */
export function pickInstalledH3Files(
  h: Pick<H3Settings, 'models' | 'textEncoder' | 'videoVae' | 'audioVae'>,
  server: { diffusionModels: string[]; textEncoders: string[]; vaes: string[] },
): Partial<Pick<H3Settings, 'models' | 'textEncoder' | 'videoVae' | 'audioVae'>> {
  const patch: Partial<Pick<H3Settings, 'models' | 'textEncoder' | 'videoVae' | 'audioVae'>> = {};
  const only = (list: string[]) => (list.length === 1 ? list[0] : undefined);
  const h3 = server.diffusionModels.filter(isH3Name);
  const next = { ...h.models };
  if (!server.diffusionModels.includes(next.fl2va)) { const f = only(h3.filter((x) => /fl2va/i.test(x))); if (f) next.fl2va = f; }
  if (!server.diffusionModels.includes(next.ref2va)) { const f = only(h3.filter((x) => /ref2va/i.test(x))); if (f) next.ref2va = f; }
  if (next.fl2va !== h.models.fl2va || next.ref2va !== h.models.ref2va) patch.models = next;
  if (!server.textEncoders.includes(h.textEncoder)) { const te = only(server.textEncoders.filter(isH3Name)); if (te) patch.textEncoder = te; }
  if (!server.vaes.includes(h.videoVae)) { const v = only(server.vaes.filter((x) => isH3Name(x) && /video/i.test(x))); if (v) patch.videoVae = v; }
  if (!server.vaes.includes(h.audioVae)) { const v = only(server.vaes.filter((x) => isH3Name(x) && /audio/i.test(x))); if (v) patch.audioVae = v; }
  return patch;
}
