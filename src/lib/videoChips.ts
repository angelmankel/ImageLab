/**
 * The Video step's settings as chips (`features/next/VideoChips.tsx`): each chip's text and
 * whether it differs from the engine's defaults. Only `./wanGraph`, `./h3Graph`,
 * `./videoSections` and `./chips` at runtime, so the tests load it from source.
 */
import {
  H3_FPS, clipFrames, defaultVideoSettings, effectiveSampling, h3EffectiveSteps, outputFrames, upscaledSize, type VideoSettings,
} from './wanGraph';
import { h3ModelFile } from './h3Graph';
import { activePatches, fileLabel, missingVideoFilesBySection, videoSeconds, type VideoServerLists } from './videoSections';
import { aspectLabel, fmtNum, fmtSize, type ChipReading } from './chips';

export type VideoChipId =
  | 'engine' | 'task' | 'start' | 'end' | 'refs'
  | 'models' | 'textEncoder' | 'vae' | 'dtype'
  | 'loras'
  | 'size' | 'length' | 'fps' | 'audio' | 'refSize'
  | 'fast' | 'turbo'
  | 'steps' | 'switch' | 'cfg' | 'shift' | 'sampler'
  | 'nag' | 'cfgZero' | 'easyCache' | 'torch' | 'longClip' | 'lowVramAttention' | 'lowVramFf'
  | 'upscale'
  | 'colorMatch' | 'interpolate' | 'file';

export type VideoChipState = VideoSettings & { startImage: string };

/** The chips that apply to the engine and task in use, in row order. */
export function visibleVideoChips(v: Pick<VideoChipState, 'engine' | 'mode' | 'h3'>): VideoChipId[] {
  const h3 = v.engine === 'h3';
  const i2v = h3 ? v.h3.mode === 'i2v' : v.mode === 'i2v';
  const ref = h3 && v.h3.mode === 'ref';
  return [
    'engine', 'task', ...(i2v ? ['start' as const, 'end' as const] : []), ...(ref ? ['refs' as const] : []),
    'models', 'textEncoder', 'vae', 'dtype',
    'loras',
    'size', 'length', ...(h3 ? ['audio' as const, ...(ref ? ['refSize' as const] : [])] : ['fps' as const]),
    h3 ? 'turbo' : 'fast',
    'steps', ...(h3 ? [] : ['switch' as const]), 'cfg', 'shift', 'sampler',
    ...(h3 ? ['lowVramAttention' as const, 'lowVramFf' as const] : ['nag' as const, 'cfgZero' as const, 'easyCache' as const, 'torch' as const, 'longClip' as const]),
    'upscale',
    ...(i2v ? ['colorMatch' as const] : []), 'interpolate', 'file',
  ];
}

const onOff = (on: boolean) => (on ? 'on' : 'off');

/** Every video chip's reading; `server` (optional) marks the chips whose file the server lacks. */
export function videoChipValues(v: VideoChipState, server?: VideoServerLists): Record<VideoChipId, ChipReading & { warn?: string }> {
  const d = defaultVideoSettings();
  const h3 = v.engine === 'h3';
  const h = v.h3;
  const dh = d.h3;
  const files = v.models[v.mode];
  const eff = effectiveSampling(v);
  const width = h3 ? h.width : v.width, height = h3 ? h.height : v.height;
  const [uw, uh] = upscaledSize(width, height, v.upscale.scale);
  const out = outputFrames(v);
  const enc = v.encode;
  const missing = server ? missingVideoFilesBySection(v, server) : { models: [], speed: [], upscale: [], finish: [] };
  const warn = (list: string[]) => (list.length ? `Not on the server: ${list.map(fileLabel).join(', ')}` : undefined);
  const refs = h.refImages.filter(Boolean).length;

  return {
    engine: { value: h3 ? 'MiniMax H3' : 'Wan 2.2', changed: h3 },
    task: {
      value: h3 ? (h.mode === 't2v' ? 'Text' : h.mode === 'i2v' ? 'First frame' : 'Reference') : v.mode === 't2v' ? 'Text → Video' : 'Image → Video',
      changed: h3 ? h.mode !== 't2v' : v.mode !== 't2v',
    },
    start: { value: v.startImage ? fileLabel(v.startImage) : 'none', changed: !!v.startImage },
    end: { value: v.endImage ? fileLabel(v.endImage) : 'none', changed: !!v.endImage },
    refs: { value: refs ? `${refs} picture${refs === 1 ? '' : 's'}` : 'none', changed: refs > 0 },
    models: {
      value: h3 ? fileLabel(h3ModelFile(h)) : files.high === files.low ? fileLabel(files.high) : `${fileLabel(files.high)} · ${fileLabel(files.low)}`,
      changed: h3 ? h.models.fl2va !== dh.models.fl2va || h.models.ref2va !== dh.models.ref2va : files.high !== d.models[v.mode].high || files.low !== d.models[v.mode].low,
      warn: warn(missing.models),
    },
    textEncoder: { value: fileLabel(h3 ? h.textEncoder : v.textEncoder), changed: h3 ? h.textEncoder !== dh.textEncoder : v.textEncoder !== d.textEncoder },
    vae: { value: h3 ? `${fileLabel(h.videoVae)} · ${fileLabel(h.audioVae)}` : fileLabel(v.vae), changed: h3 ? h.videoVae !== dh.videoVae || h.audioVae !== dh.audioVae : v.vae !== d.vae },
    dtype: { value: v.weightDtype === 'default' ? 'default' : v.weightDtype.replace(/_/g, ' '), changed: v.weightDtype !== 'default' },
    loras: (() => { const on = (h3 ? h.loras : v.loras).filter(l => l.on).length; return { value: on ? String(on) : 'none', changed: on > 0 }; })(),
    size: { value: `${fmtSize(width, height)} · ${aspectLabel(width, height)}`, changed: h3 ? width !== dh.width || height !== dh.height : width !== d.width || height !== d.height },
    length: { value: `${clipFrames(v)} f · ${videoSeconds(v)} s`, changed: h3 ? h.length !== dh.length : v.length !== d.length },
    fps: { value: `${v.fps} fps`, changed: v.fps !== d.fps },
    audio: { value: onOff(h.audio), changed: !h.audio },
    refSize: { value: h.refImageSize, changed: h.refImageSize !== 'match' },
    fast: { value: v.fast ? `on · ${eff.steps} steps` : 'off', changed: !v.fast || eff.steps !== d.fastRecipe.steps, warn: warn(missing.speed) },
    turbo: { value: h.turbo.on ? `on · ${h3EffectiveSteps(h)} steps` : 'off', changed: h.turbo.on, warn: warn(missing.speed) },
    steps: { value: String(h3 ? h3EffectiveSteps(h) : eff.steps), changed: h3 ? h.steps !== dh.steps : (v.fast ? eff.steps !== d.fastRecipe.steps : v.steps !== d.steps) },
    switch: { value: `at ${eff.switchStep}`, changed: v.fast ? eff.switchStep !== d.fastRecipe.switchStep : v.switchStep !== d.switchStep },
    cfg: {
      value: h3 ? fmtNum(h.cfg) : eff.cfgLow !== eff.cfg ? `${fmtNum(eff.cfg)} / ${fmtNum(eff.cfgLow)}` : fmtNum(eff.cfg),
      changed: h3 ? h.cfg !== dh.cfg : (v.fast ? eff.cfg !== d.fastRecipe.cfg : v.cfg !== d.cfg || v.cfgLow != null),
    },
    shift: {
      value: h3 ? `${fmtNum(h.shiftVideo)} · audio ${fmtNum(h.shiftAudio)}` : v.shiftLow != null ? `${fmtNum(v.shift)} / ${fmtNum(v.shiftLow)}` : fmtNum(v.shift),
      changed: h3 ? h.shiftVideo !== dh.shiftVideo || h.shiftAudio !== dh.shiftAudio : v.shift !== d.shift || v.shiftLow != null,
    },
    sampler: { value: h3 ? `${h.sampler} · ${h.scheduler}` : `${v.sampler} · ${v.scheduler}`, changed: h3 ? h.sampler !== dh.sampler || h.scheduler !== dh.scheduler : v.sampler !== d.sampler || v.scheduler !== d.scheduler },
    nag: { value: v.guidance.nag.on ? String(v.guidance.nag.scale) : 'off', changed: v.guidance.nag.on },
    cfgZero: { value: onOff(v.guidance.cfgZeroStar), changed: v.guidance.cfgZeroStar },
    easyCache: { value: v.speedups.easyCache.on ? `${v.speedups.easyCache.threshold}` : 'off', changed: v.speedups.easyCache.on },
    torch: { value: onOff(v.speedups.torchCompile), changed: v.speedups.torchCompile },
    longClip: { value: v.longClip.on ? `${v.longClip.windowFrames}/${v.longClip.overlapFrames}` : 'off', changed: v.longClip.on },
    lowVramAttention: { value: h.lowVram.attention ? `×${h.lowVram.headChunks}` : 'off', changed: h.lowVram.attention },
    lowVramFf: { value: h.lowVram.feedForward ? `×${h.lowVram.chunks}` : 'off', changed: h.lowVram.feedForward },
    upscale: { value: v.upscale.on ? `${v.upscale.scale}× → ${fmtSize(uw, uh)}` : 'off', changed: v.upscale.on, warn: warn(missing.upscale) },
    colorMatch: { value: v.colorMatch.on ? `${v.colorMatch.method} ${fmtNum(v.colorMatch.strength)}` : 'off', changed: v.colorMatch.on },
    interpolate: { value: v.interpolate.on ? `${v.interpolate.multiplier}× → ${out.fps} fps` : 'off', changed: v.interpolate.on, warn: warn(missing.finish) },
    file: { value: `${enc.container.toUpperCase()} ${enc.codec === 'h264' ? 'H.264' : 'AV1'}${enc.crf != null ? ` · CRF ${enc.crf}` : ''}`, changed: enc.container !== 'mp4' || enc.codec !== 'h264' || enc.crf != null },
  };
}

/** Which patches are on, for the Guidance row's title. */
export { activePatches };
export const h3Fps = H3_FPS;
