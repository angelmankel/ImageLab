/**
 * The Video step's settings as chips, in short titled rows that are always all on screen:
 * Mode · Models · LoRAs · Size & length · Speed · Sampling · Guidance · Upscale · Finish.
 * The readings come from `lib/videoChips.ts`; each chip's editor is the very control the classic
 * Video sections draw (`features/video/sections.tsx` exports them one by one), so a setting is
 * never two implementations. The rows follow the engine: Wan 2.2 shows Fast and the expert
 * switch, MiniMax H3 shows Turbo, audio and its VRAM patches.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { filterChips } from '@/lib/chips';
import { videoChipValues, visibleVideoChips, type VideoChipId } from '@/lib/videoChips';
import { H3_SIZE_PRESETS } from '@/lib/h3Graph';
import { h3Length, wanLength } from '@/lib/wanGraph';
import { useVideo } from '@/features/video/videoStore';
import {
  CfgZeroField, ColorMatchBlock, EasyCacheBlock, EncodeBlock, EndFrameField, EngineSwitch, FastBlock, H3AudioField, H3CfgField, H3LengthField,
  H3LorasSection, H3LowVramAttentionBlock, H3LowVramFeedForwardBlock, H3ModelFiles, H3RefSizeField, H3SamplerFields, H3ShiftFields, H3SizeField,
  H3StepsField, H3TextEncoderField, H3VaeFields, H3VramNote, InterpolateBlock, LongClipBlock, LorasSection, NagBlock, RefImages, StartFrameField,
  TaskSwitch, TorchCompileField, TurboBlock, UpscaleSection, WAN_PRESETS, WanCfgFields, WanFpsField, WanLengthField, WanModelFiles, WanSamplerFields,
  WanShiftFields, WanSizeField, WanStepsFields, WanSwitchField, WanTextEncoderField, WanVaeField, WeightDtypeField,
} from '@/features/video/sections';
import { ChipPopover, ChipRow, type ChipPreset } from './ChipPopover';

interface Def { id: VideoChipId; row: string; label: string; keywords: string[] }

const DEFS: Def[] = [
  { id: 'engine', row: 'Mode', label: 'Engine', keywords: ['wan', 'minimax', 'h3', 'model family', 'sound', 'audio'] },
  { id: 'task', row: 'Mode', label: 'Task', keywords: ['text to video', 'image to video', 't2v', 'i2v', 'reference', 'first frame'] },
  { id: 'start', row: 'Mode', label: 'Start frame', keywords: ['start image', 'first frame', 'input', 'picture', 'upload'] },
  { id: 'end', row: 'Mode', label: 'End frame', keywords: ['last frame', 'end image', 'first last'] },
  { id: 'refs', row: 'Mode', label: 'Reference pictures', keywords: ['reference', 'identity', 'character', 'picture'] },
  { id: 'models', row: 'Models', label: 'Models', keywords: ['high noise', 'low noise', 'expert', 'fl2va', 'ref2va', 'checkpoint', 'diffusion'] },
  { id: 'textEncoder', row: 'Models', label: 'Text encoder', keywords: ['umt5', 'qwen', 'clip'] },
  { id: 'vae', row: 'Models', label: 'VAE', keywords: ['decoder', 'audio vae', 'video vae'] },
  { id: 'dtype', row: 'Models', label: 'Weights', keywords: ['dtype', 'fp8', 'precision', 'quantisation'] },
  { id: 'loras', row: 'LoRAs', label: 'LoRAs', keywords: ['lora', 'style', 'strength', 'expert'] },
  { id: 'size', row: 'Size & length', label: 'Size', keywords: ['width', 'height', 'aspect', 'resolution', '480p', '720p', 'portrait', 'landscape'] },
  { id: 'length', row: 'Size & length', label: 'Length', keywords: ['frames', 'seconds', 'duration', 'clip'] },
  { id: 'fps', row: 'Size & length', label: 'Frame rate', keywords: ['fps', 'speed of motion'] },
  { id: 'audio', row: 'Size & length', label: 'Audio', keywords: ['sound', 'soundtrack', 'silent', 'mute'] },
  { id: 'refSize', row: 'Size & length', label: 'Reference size', keywords: ['match', 'max', 'identity'] },
  { id: 'fast', row: 'Speed', label: 'Fast', keywords: ['lightx2v', 'speed lora', 'recipe', 'motion pass', '4 steps', 'quick'] },
  { id: 'turbo', row: 'Speed', label: 'Turbo', keywords: ['lightx2v', 'turbo lora', 'speed', '8 steps', '4 steps', 'quick'] },
  { id: 'steps', row: 'Sampling', label: 'Steps', keywords: ['iterations', 'quality'] },
  { id: 'switch', row: 'Sampling', label: 'Switch', keywords: ['low noise', 'high noise', 'expert', 'step'] },
  { id: 'cfg', row: 'Sampling', label: 'CFG', keywords: ['guidance', 'scale', 'prompt strength'] },
  { id: 'shift', row: 'Sampling', label: 'Shift', keywords: ['sigma', 'schedule', 'motion', 'audio shift'] },
  { id: 'sampler', row: 'Sampling', label: 'Sampler', keywords: ['scheduler', 'euler', 'res_multistep', 'uni_pc'] },
  { id: 'nag', row: 'Guidance', label: 'NAG', keywords: ['negative', 'attention guidance', 'cfg 1'] },
  { id: 'cfgZero', row: 'Guidance', label: 'CFG-Zero*', keywords: ['zero init', 'colours', 'guidance'] },
  { id: 'easyCache', row: 'Guidance', label: 'EasyCache', keywords: ['cache', 'skip steps', 'faster'] },
  { id: 'torch', row: 'Guidance', label: 'torch.compile', keywords: ['compile', 'inductor', 'faster'] },
  { id: 'longClip', row: 'Guidance', label: 'Long clip', keywords: ['context windows', 'freenoise', 'long video', 'overlap'] },
  { id: 'lowVramAttention', row: 'Guidance', label: 'Low-VRAM attention', keywords: ['vram', 'memory', 'oom', 'head groups'] },
  { id: 'lowVramFf', row: 'Guidance', label: 'Chunked feed-forward', keywords: ['vram', 'memory', 'oom', 'chunks'] },
  { id: 'upscale', row: 'Upscale', label: 'Upscale', keywords: ['span', 'resize', 'scale', 'bigger', '2x', '4x'] },
  { id: 'colorMatch', row: 'Finish', label: 'Colour match', keywords: ['color', 'drift', 'wash out', 'start image'] },
  { id: 'interpolate', row: 'Finish', label: 'Interpolation', keywords: ['rife', 'film', 'smooth', 'frames', 'fps'] },
  { id: 'file', row: 'Finish', label: 'File', keywords: ['mp4', 'mkv', 'webm', 'h264', 'av1', 'crf', 'encode', 'codec', 'quality'] },
];
const ROWS = ['Mode', 'Models', 'LoRAs', 'Size & length', 'Speed', 'Sampling', 'Guidance', 'Upscale', 'Finish'];

const WAN_LENGTHS = [33, 49, 81, 121];
const H3_LENGTHS = [73, 124, 243, 362];

export function VideoChips({ host, large = false }: { host: string; large?: boolean }) {
  const v = useVideo();
  const server = useStore(s => s.server);
  const [query, setQuery] = useState('');
  const h3 = v.engine === 'h3';
  const values = useMemo(() => videoChipValues(v, server), [v, server]);
  const shown = useMemo(() => {
    const visible = new Set(visibleVideoChips(v));
    return filterChips(DEFS.filter(d => visible.has(d.id)), query);
  }, [v, query]);

  const sizes = (h3 ? H3_SIZE_PRESETS : WAN_PRESETS).flatMap(g => g.items);
  const presetsFor = (id: VideoChipId): ChipPreset[] => {
    switch (id) {
      case 'engine': return [
        { label: 'Wan 2.2', on: !h3, onPick: () => v.set({ engine: 'wan' }) },
        { label: 'MiniMax H3', on: h3, onPick: () => v.set({ engine: 'h3' }) },
      ];
      case 'task': return h3
        ? [
          { label: 'Text', on: v.h3.mode === 't2v', onPick: () => v.setH3({ mode: 't2v' }) },
          { label: 'First frame', on: v.h3.mode === 'i2v', onPick: () => v.setH3({ mode: 'i2v' }) },
          { label: 'Reference', on: v.h3.mode === 'ref', onPick: () => v.setH3({ mode: 'ref' }) },
        ]
        : [
          { label: 'Text → Video', on: v.mode === 't2v', onPick: () => v.set({ mode: 't2v' }) },
          { label: 'Image → Video', on: v.mode === 'i2v', onPick: () => v.set({ mode: 'i2v' }) },
        ];
      case 'size': return sizes.map(p => {
        const m = /^(\d+)x(\d+)$/.exec(p.value)!;
        const pw = Number(m[1]); const ph = Number(m[2]);
        const cur = h3 ? v.h3 : v;
        return { label: p.label.replace(/ \((.+)\)$/, ' $1'), on: cur.width === pw && cur.height === ph, onPick: () => (h3 ? v.setH3({ width: pw, height: ph }) : v.set({ width: pw, height: ph })) };
      });
      case 'length': return (h3 ? H3_LENGTHS : WAN_LENGTHS).map(n => ({
        label: `${n} f`, on: (h3 ? v.h3.length : v.length) === n,
        onPick: () => (h3 ? v.setH3({ length: h3Length(n) }) : v.set({ length: wanLength(n) })),
      }));
      case 'fps': return [16, 24].map(n => ({ label: `${n} fps`, on: v.fps === n, onPick: () => v.set({ fps: n }) }));
      case 'audio': return [
        { label: 'Sound on', on: v.h3.audio, onPick: () => v.setH3({ audio: true }) },
        { label: 'Silent', on: !v.h3.audio, onPick: () => v.setH3({ audio: false }) },
      ];
      case 'fast': return [
        { label: 'Fast on', on: v.fast, onPick: () => v.set({ fast: true }) },
        { label: 'Full quality', on: !v.fast, onPick: () => v.set({ fast: false }) },
      ];
      case 'turbo': return [
        { label: 'Turbo on', on: v.h3.turbo.on, onPick: () => v.setH3({ turbo: { ...v.h3.turbo, on: true } }) },
        { label: 'Full steps', on: !v.h3.turbo.on, onPick: () => v.setH3({ turbo: { ...v.h3.turbo, on: false } }) },
      ];
      case 'steps': return h3
        ? (v.h3.turbo.on ? [] : [12, 20, 30].map(n => ({ label: String(n), on: v.h3.steps === n, onPick: () => v.setH3({ steps: n }) })))
        : (v.fast ? [4, 6, 8].map(n => ({ label: String(n), on: v.fastRecipe.steps === n, onPick: () => v.set({ fastRecipe: { ...v.fastRecipe, steps: n, switchStep: Math.min(v.fastRecipe.switchStep, n), motionSteps: Math.min(v.fastRecipe.motionSteps, n) } }) }))
          : [8, 20, 30].map(n => ({ label: String(n), on: v.steps === n, onPick: () => v.set({ steps: n, switchStep: Math.min(v.switchStep, n) }) })));
      case 'cfg': return h3
        ? [1, 2, 3].map(n => ({ label: String(n), on: v.h3.cfg === n, onPick: () => v.setH3({ cfg: n }) }))
        : (v.fast ? [] : [1, 3.5, 5].map(n => ({ label: String(n), on: v.cfg === n, onPick: () => v.set({ cfg: n }) })));
      case 'shift': return h3 ? [] : [5, 8].map(n => ({ label: String(n), on: v.shift === n, onPick: () => v.set({ shift: n }) }));
      case 'upscale': return [
        { label: 'Off', on: !v.upscale.on, onPick: () => v.set({ upscale: { ...v.upscale, on: false } }) },
        ...[1.5, 2, 3, 4].map(n => ({ label: `${n}×`, on: v.upscale.on && v.upscale.scale === n, onPick: () => v.set({ upscale: { ...v.upscale, on: true, scale: n } }) })),
      ];
      case 'interpolate': return [
        { label: 'Off', on: !v.interpolate.on, onPick: () => v.set({ interpolate: { ...v.interpolate, on: false } }) },
        ...[2, 3, 4].map(n => ({ label: `${n}×`, on: v.interpolate.on && v.interpolate.multiplier === n, onPick: () => v.set({ interpolate: { ...v.interpolate, on: true, multiplier: n } }) })),
      ];
      case 'nag': return [
        { label: 'Off', on: !v.guidance.nag.on, onPick: () => v.set({ guidance: { ...v.guidance, nag: { ...v.guidance.nag, on: false } } }) },
        { label: 'On', on: v.guidance.nag.on, onPick: () => v.set({ guidance: { ...v.guidance, nag: { ...v.guidance.nag, on: true } } }) },
      ];
      default: return [];
    }
  };

  const body = (id: VideoChipId): ReactNode => {
    switch (id) {
      case 'engine': return <EngineSwitch />;
      case 'task': return <TaskSwitch />;
      case 'start': return <StartFrameField host={host} />;
      case 'end': return <EndFrameField host={host} />;
      case 'refs': return <RefImages host={host} />;
      case 'models': return h3 ? <H3ModelFiles /> : <WanModelFiles />;
      case 'textEncoder': return h3 ? <H3TextEncoderField /> : <WanTextEncoderField />;
      case 'vae': return h3 ? <H3VaeFields /> : <WanVaeField />;
      case 'dtype': return <WeightDtypeField />;
      case 'loras': return h3 ? <H3LorasSection /> : <LorasSection />;
      case 'size': return h3 ? <H3SizeField /> : <WanSizeField />;
      case 'length': return h3 ? <H3LengthField /> : <WanLengthField />;
      case 'fps': return <WanFpsField />;
      case 'audio': return <H3AudioField />;
      case 'refSize': return <H3RefSizeField />;
      case 'fast': return <FastBlock />;
      case 'turbo': return <TurboBlock />;
      case 'steps': return h3 ? <H3StepsField /> : <WanStepsFields />;
      case 'switch': return <WanSwitchField />;
      case 'cfg': return h3 ? <H3CfgField /> : <WanCfgFields />;
      case 'shift': return h3 ? <H3ShiftFields /> : <WanShiftFields />;
      case 'sampler': return h3 ? <H3SamplerFields /> : <WanSamplerFields />;
      case 'nag': return <NagBlock />;
      case 'cfgZero': return <CfgZeroField />;
      case 'easyCache': return <EasyCacheBlock />;
      case 'torch': return <TorchCompileField />;
      case 'longClip': return <LongClipBlock />;
      case 'lowVramAttention': return <><H3VramNote /><H3LowVramAttentionBlock /></>;
      case 'lowVramFf': return <><H3VramNote /><H3LowVramFeedForwardBlock /></>;
      case 'upscale': return <UpscaleSection />;
      case 'colorMatch': return <ColorMatchBlock />;
      case 'interpolate': return <InterpolateBlock />;
      case 'file': return <EncodeBlock />;
    }
  };
  const widthFor = (id: VideoChipId) => (id === 'loras' || id === 'fast' || id === 'turbo' || id === 'refs' || id === 'start' || id === 'end' ? 440 : id === 'models' || id === 'size' ? 400 : 360);

  return (
    <div className="flex flex-col gap-3">
      <TextInput size={large ? 'md' : 'xs'} value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Find a setting…" leftSection={<IconSearch size={14} />} aria-label="Find a setting" />
      {ROWS.map(row => {
        const chips = shown.filter(d => d.row === row);
        if (!chips.length) return null;
        return (
          <ChipRow key={row} title={row}>
            {chips.map(d => {
              const r = values[d.id];
              return (
                <ChipPopover key={d.id} label={d.label} value={r.value} changed={r.changed} warn={r.warn} presets={presetsFor(d.id)} width={widthFor(d.id)}>
                  {body(d.id)}
                </ChipPopover>
              );
            })}
          </ChipRow>
        );
      })}
      {shown.length === 0 && <Text size="xs" c="dimmed" ta="center" py="sm">No setting called “{query}”.</Text>}
    </div>
  );
}
