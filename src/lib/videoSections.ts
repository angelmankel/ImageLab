/**
 * The Video view's settings sections: their order, which chosen files the server lacks, and each
 * section's live one-line summary (the desktop's section headers, the phone's settings rows).
 *
 * Only `./wanGraph` at runtime, which imports nothing, so the tests load both from source.
 */
import { effectiveSampling, hasSpeedInside, outputFrames, upscaledSize, wanLength, type VideoSettings } from './wanGraph';
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
  const files = v.models[v.mode];
  return {
    models: [
      ...[files.high, files.low].filter((f) => !server.diffusionModels.includes(f)),
      ...(server.textEncoders.includes(v.textEncoder) ? [] : [v.textEncoder]),
      ...(server.vaes.includes(v.vae) ? [] : [v.vae]),
    ],
    speed: v.fast
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

/** How long the clip plays, as the Length slider says it. */
export const videoSeconds = (v: Pick<VideoSettings, 'length' | 'fps'>) => (wanLength(v.length) / Math.max(1, v.fps)).toFixed(1);

/** A file or `LoadImage` reference, short enough for a summary. */
export const fileLabel = (f: string) =>
  f.replace(/\s*\[\w+\]$/, '').replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i, '');

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const warn = (note: string): Pick<VideoSectionStatus, 'badge' | 'tone' | 'note'> => ({ badge: '!', tone: 'warn', note });
const notOnServer = (files: string[]) => warn(`Not on the server: ${files.map(fileLabel).join(', ')}`);

/** The guidance / speedup patches that are on, named. */
export function activePatches(v: VideoSettings): string[] {
  const out: string[] = [];
  if (v.guidance?.cfgZeroStar) out.push('CFG-Zero*');
  if (v.guidance?.nag?.on) out.push(`NAG ${v.guidance.nag.scale}`);
  if (v.speedups?.easyCache?.on) out.push('EasyCache');
  if (v.speedups?.torchCompile) out.push('torch.compile');
  if (v.longClip?.on) out.push(`windows ${v.longClip.windowFrames}/${v.longClip.overlapFrames}`);
  return out;
}

export function videoSectionStatus(v: VideoSettings & { startImage: string }, server: VideoServerLists): Record<VideoSectionId, VideoSectionStatus> {
  const missing = missingVideoFilesBySection(v, server);
  const files = v.models[v.mode];
  const prompt = v.positive.trim().split('\n')[0];
  const loras = v.loras.filter((l) => l.on);
  const [uw, uh] = upscaledSize(v.width, v.height, v.upscale.scale);
  const eff = effectiveSampling(v);
  const i2v = v.mode === 'i2v';
  const patches = activePatches(v);
  const out = outputFrames(v);
  const finishParts = [
    ...(i2v && v.colorMatch?.on ? ['colour match'] : []),
    ...(v.interpolate?.on ? [`${v.interpolate.multiplier}× frames → ${out.fps} fps`] : []),
  ];
  const enc = v.encode ?? { container: 'mp4', codec: 'h264', crf: null };
  const encodeLabel = `${enc.container.toUpperCase()} ${enc.codec === 'h264' ? 'H.264' : 'AV1'}${enc.crf != null ? ` · CRF ${enc.crf}` : ''}`;

  return {
    mode: v.mode === 't2v'
      ? { summary: 'Text → Video' }
      : v.startImage
        ? { summary: `Image → Video · ${fileLabel(v.startImage)}${v.endImage ? ` → ${fileLabel(v.endImage)}` : ''}` }
        : { summary: 'Image → Video · no start image', ...warn('Choose a start image first.') },
    prompt: prompt
      ? { summary: prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt }
      : { summary: 'Empty', ...warn('Write a prompt first.') },
    models: {
      summary: files.high === files.low ? fileLabel(files.high) : `${fileLabel(files.high)} · ${fileLabel(files.low)}`,
      ...(missing.models.length ? notOnServer(missing.models) : {}),
    },
    loras: loras.length
      ? { summary: loras.map((l) => fileLabel(l.name)).join(' · '), badge: String(loras.length), note: `${plural(loras.length, 'LoRA')} on` }
      : { summary: v.loras.length ? `${plural(v.loras.length, 'LoRA')}, all off` : 'None' },
    size: { summary: `${v.width} × ${v.height} · ${wanLength(v.length)} frames · ${videoSeconds(v)} s` },
    speed: {
      summary: v.fast
        ? `Fast · ${eff.steps} steps · CFG ${eff.cfg}`
        : `${eff.steps} steps · CFG ${eff.cfg}${eff.cfgLow !== eff.cfg ? ` / ${eff.cfgLow}` : ''} · ${v.sampler}`,
      ...(missing.speed.length ? notOnServer(missing.speed) : v.fast ? { badge: 'fast', tone: 'accent' as const } : {}),
    },
    guidance: patches.length
      ? { summary: patches.join(' · '), badge: String(patches.length), tone: 'accent' }
      : { summary: 'Plain CFG' },
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
