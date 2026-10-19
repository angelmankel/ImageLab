/**
 * The Video view's settings sections: their order, which chosen files the server lacks, and each
 * section's live one-line summary (the desktop's section headers, the phone's settings rows).
 *
 * Only `./wanGraph` at runtime, which imports nothing, so the tests load both from source.
 */
import { clipFps, clipFrames, effectiveSampling, h3EffectiveSteps, hasSpeedInside, outputFrames, upscaledSize, type VideoSettings } from './wanGraph';
import { h3ModelFile, h3TurboLora } from './h3Graph';
import type { ServerInfo } from './types';

export type VideoSectionId = 'mode' | 'prompt' | 'models' | 'loras' | 'size' | 'speed' | 'guidance' | 'upscale' | 'finish';

/** Top to bottom: what to make, then what it looks like, then how fast and how big, then the file. */
export const VIDEO_SECTIONS: readonly VideoSectionId[] = ['mode', 'prompt', 'models', 'loras', 'size', 'speed', 'guidance', 'upscale', 'finish'];

/** Same shape as the Generate panel's `SectionStatus`, so both phone lists draw rows alike. */
export interface VideoSectionStatus {
  summary: string;
  badge?: string;
  /** `warn`: something will stop or spoil the run. */
  tone?: 'accent' | 'warn';
  note?: string;
}

export type VideoServerLists = Pick<ServerInfo, 'models' | 'diffusionModels' | 'textEncoders' | 'vaes' | 'loras' | 'upscaleModels'> & Partial<Pick<ServerInfo, 'interpolationModels'>>;

/** The chosen files the server does not have, by the section that picks them (none while the
 *  server lists are still empty). */
export function missingVideoFilesBySection(v: VideoSettings, server: VideoServerLists): { models: string[]; speed: string[]; upscale: string[]; finish: string[] } {
  if (!server.models.length) return { models: [], speed: [], upscale: [], finish: [] };
  const h3 = v.engine === 'h3';
  const files = v.models[v.mode];
  const h = v.h3;
  const turbo = h3 ? h3TurboLora(h) : null;
  return {
    models: h3
      ? [
        ...(server.diffusionModels.includes(h3ModelFile(h)) ? [] : [h3ModelFile(h)]),
        ...(server.textEncoders.includes(h.textEncoder) ? [] : [h.textEncoder]),
        ...(server.vaes.includes(h.videoVae) ? [] : [h.videoVae]),
        ...((h.audio || h.mode === 'ref') && !server.vaes.includes(h.audioVae) ? [h.audioVae] : []),
      ]
      : [
        ...[files.high, files.low].filter((f) => !server.diffusionModels.includes(f)),
        ...(server.textEncoders.includes(v.textEncoder) ? [] : [v.textEncoder]),
        ...(server.vaes.includes(v.vae) ? [] : [v.vae]),
      ],
    speed: h3
      ? (turbo && !server.loras.includes(turbo) ? [turbo] : [])
      : v.fast
        ? (['high', 'low'] as const).filter((w) => !hasSpeedInside(v, files[w])).map((w) => v.fastLoras[v.mode][w]).filter((f) => !server.loras.includes(f))
        : [],
    upscale: v.upscale.on && v.upscale.method === 'model' && !server.upscaleModels.includes(v.upscale.model) ? [v.upscale.model] : [],
    // An old server has no frame_interpolation folder at all: then the model is "missing" too.
    finish: v.interpolate?.on && !(server.interpolationModels ?? []).includes(v.interpolate.model) ? [v.interpolate.model] : [],
  };
}

/** All of them, in section order: what the run refuses to queue without. */
export function missingVideoFiles(v: VideoSettings, server: VideoServerLists): string[] {
  const m = missingVideoFilesBySection(v, server);
  return [...m.models, ...m.speed, ...m.upscale, ...m.finish];
}

/** How long the clip plays, as the Length slider says it (either engine; Wan when no engine is given). */
export const videoSeconds = (v: Pick<VideoSettings, 'length' | 'fps'> & Partial<Pick<VideoSettings, 'engine' | 'h3'>>) =>
  (clipFrames(v) / Math.max(1, clipFps(v))).toFixed(1);

/** The seconds a Wan or H3 frame count plays. */
export const framesSeconds = (frames: number, fps: number) => (frames / Math.max(1, fps)).toFixed(1);

/** A file or `LoadImage` reference, short enough for a summary. */
export const fileLabel = (f: string) =>
  f.replace(/\s*\[\w+\]$/, '').replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i, '');

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const warn = (note: string): Pick<VideoSectionStatus, 'badge' | 'tone' | 'note'> => ({ badge: '!', tone: 'warn', note });
const notOnServer = (files: string[]) => warn(`Not on the server: ${files.map(fileLabel).join(', ')}`);

/** The guidance / speedup patches that are on, named. */
export function activePatches(v: VideoSettings): string[] {
  const out: string[] = [];
  if (v.engine === 'h3') {
    const lv = v.h3.lowVram;
    if (lv?.attention) out.push(`attention ×${lv.headChunks}`);
    if (lv?.feedForward) out.push(`feed-forward ×${lv.chunks}`);
    return out;
  }
  if (v.guidance?.cfgZeroStar) out.push('CFG-Zero*');
  if (v.guidance?.nag?.on) out.push(`NAG ${v.guidance.nag.scale}`);
  if (v.speedups?.easyCache?.on) out.push('EasyCache');
  if (v.speedups?.torchCompile) out.push('torch.compile');
  if (v.longClip?.on) out.push(`windows ${v.longClip.windowFrames}/${v.longClip.overlapFrames}`);
  return out;
}

export function videoSectionStatus(v: VideoSettings & { startImage: string }, server: VideoServerLists): Record<VideoSectionId, VideoSectionStatus> {
  const missing = missingVideoFilesBySection(v, server);
  const h3 = v.engine === 'h3';
  const h = v.h3;
  const files = v.models[v.mode];
  const prompt = v.positive.trim().split('\n')[0];
  const loras = (h3 ? h.loras : v.loras).filter((l) => l.on);
  const allLoras = h3 ? h.loras : v.loras;
  const width = h3 ? h.width : v.width, height = h3 ? h.height : v.height;
  const [uw, uh] = upscaledSize(width, height, v.upscale.scale);
  const eff = effectiveSampling(v);
  const i2v = h3 ? h.mode === 'i2v' : v.mode === 'i2v';
  const patches = activePatches(v);
  const out = outputFrames(v);
  const finishParts = [
    ...(i2v && v.colorMatch?.on ? ['colour match'] : []),
    ...(v.interpolate?.on ? [`${v.interpolate.multiplier}× frames → ${out.fps} fps`] : []),
  ];
  const enc = v.encode ?? { container: 'mp4', codec: 'h264', crf: null };
  const encodeLabel = `${enc.container.toUpperCase()} ${enc.codec === 'h264' ? 'H.264' : 'AV1'}${enc.crf != null ? ` · CRF ${enc.crf}` : ''}`;
  const refs = h3 ? h.refImages.filter(Boolean) : [];

  const mode: VideoSectionStatus = h3
    ? h.mode === 't2v'
      ? { summary: 'MiniMax H3 · Text → Video' }
      : h.mode === 'ref'
        ? refs.length
          ? { summary: `MiniMax H3 · Reference → Video · ${plural(refs.length, 'picture')}` }
          : { summary: 'MiniMax H3 · Reference → Video · no pictures', ...warn('Add at least one reference picture.') }
        : v.startImage
          ? { summary: `MiniMax H3 · Image → Video · ${fileLabel(v.startImage)}${v.endImage ? ` → ${fileLabel(v.endImage)}` : ''}` }
          : { summary: 'MiniMax H3 · Image → Video · no first frame', ...warn('Choose a first frame first.') }
    : v.mode === 't2v'
      ? { summary: 'Text → Video' }
      : v.startImage
        ? { summary: `Image → Video · ${fileLabel(v.startImage)}${v.endImage ? ` → ${fileLabel(v.endImage)}` : ''}` }
        : { summary: 'Image → Video · no start image', ...warn('Choose a start image first.') };

  const speed: VideoSectionStatus = h3
    ? {
      summary: h.turbo?.on
        ? `Turbo · ${h3EffectiveSteps(h)} steps${Number(h.cfg) !== 1 ? ` · CFG ${h.cfg}` : ''}`
        : `${h3EffectiveSteps(h)} steps${Number(h.cfg) !== 1 ? ` · CFG ${h.cfg}` : ''} · ${h.sampler}`,
      ...(missing.speed.length ? notOnServer(missing.speed) : h.turbo?.on ? { badge: 'turbo', tone: 'accent' as const } : {}),
    }
    : {
      summary: v.fast
        ? `Fast · ${eff.steps} steps · CFG ${eff.cfg}`
        : `${eff.steps} steps · CFG ${eff.cfg}${eff.cfgLow !== eff.cfg ? ` / ${eff.cfgLow}` : ''} · ${v.sampler}`,
      ...(missing.speed.length ? notOnServer(missing.speed) : v.fast ? { badge: 'fast', tone: 'accent' as const } : {}),
    };

  return {
    mode,
    prompt: prompt
      ? { summary: prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt }
      : { summary: 'Empty', ...warn('Write a prompt first.') },
    models: {
      summary: h3
        ? `${fileLabel(h3ModelFile(h))} · ${fileLabel(h.textEncoder)}`
        : files.high === files.low ? fileLabel(files.high) : `${fileLabel(files.high)} · ${fileLabel(files.low)}`,
      ...(missing.models.length ? notOnServer(missing.models) : {}),
    },
    loras: loras.length
      ? { summary: loras.map((l) => fileLabel(l.name)).join(' · '), badge: String(loras.length), note: `${plural(loras.length, 'LoRA')} on` }
      : { summary: allLoras.length ? `${plural(allLoras.length, 'LoRA')}, all off` : 'None' },
    size: { summary: `${width} × ${height} · ${clipFrames(v)} frames · ${videoSeconds(v)} s${h3 ? (h.audio ? ' · stereo audio' : ' · silent') : ''}` },
    speed,
    guidance: patches.length
      ? { summary: patches.join(' · '), badge: String(patches.length), tone: 'accent' }
      : { summary: h3 ? 'No VRAM patches' : 'Plain CFG' },
    upscale: !v.upscale.on
      ? { summary: 'Off' }
      : {
        summary: `${uw} × ${uh} · ${v.upscale.method === 'model' ? fileLabel(v.upscale.model) : `${v.upscale.resizeMethod} resize`}`,
        ...(missing.upscale.length ? notOnServer(missing.upscale) : { badge: `${v.upscale.scale}×`, tone: 'accent' as const }),
      },
    finish: {
      summary: finishParts.length ? `${finishParts.join(' · ')} · ${encodeLabel}` : encodeLabel,
      ...(missing.finish.length ? notOnServer(missing.finish) : finishParts.length ? { badge: String(finishParts.length), tone: 'accent' as const } : {}),
    },
  };
}
