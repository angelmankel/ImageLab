/**
 * The Video view's settings sections — what each one renders, its name and icon, and its live
 * status (`lib/videoSections.ts`). The classic desktop shows them as folding cards, phones as a
 * `SettingsPager` list; the new workspace's Video step (`features/next/VideoChips.tsx`) shows
 * the same controls one chip each. So every control is its own exported piece here, and the
 * sections are compositions of them: nothing is drawn twice.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Collapse, Group, Paper, SegmentedControl, Stack, Switch, Text, Textarea, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle, IconArrowsMaximize, IconAspectRatio, IconBolt, IconBox, IconChevronDown, IconChevronUp, IconMessageCircle,
  IconMovie, IconPhotoVideo, IconPlus, IconStack2, IconWand, IconX, type Icon as TablerIcon,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import {
  COLOR_MATCH_METHODS, CONTAINER_CODECS, FAST, H3_FPS, H3_TURBO_LORAS, INTERPOLATION_MODELS, clipFrames, effectiveSampling, h3EffectiveSteps, h3Length, h3TurboStepsOf, hasSpeedInside, isH3Name, outputFrames, upscaledSize, wanLength,
  type ColorMatchMethod, type H3Mode, type VideoEncode, type VideoEngine, type VideoMode, type VideoSettings, type VideoUpscale, type WeightDtype,
} from '@/lib/wanGraph';
import { H3_SIZE_PRESETS, h3ModelFile } from '@/lib/h3Graph';
import { framesSeconds, missingVideoFiles, videoSeconds, videoSectionStatus, type VideoSectionId, type VideoSectionStatus } from '@/lib/videoSections';
import { DimensionsField, SelectField, SliderField, StrengthControl, ToggleField } from '@/components/fields';
import type { PresetGroup } from '@/components/fields/DimensionsField';
import { ModelSelectorModal } from '@/components/models/ModelSelectorModal';
import { modelLabel } from '@/components/models/modelInfo';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import { ImageInput } from '@/features/studio/ImageInput';
import type { WorkflowParam } from '@/features/studio/params';
import { useVideo } from './videoStore';
import { VideoPromptTools } from './VideoPromptTools';

export const VIDEO_SECTION_META: Record<VideoSectionId, { title: string; icon: TablerIcon }> = {
  mode: { title: 'Mode & input', icon: IconPhotoVideo },
  prompt: { title: 'Prompt', icon: IconMessageCircle },
  models: { title: 'Models', icon: IconBox },
  loras: { title: 'LoRAs', icon: IconStack2 },
  size: { title: 'Size & length', icon: IconAspectRatio },
  speed: { title: 'Speed & sampling', icon: IconBolt },
  guidance: { title: 'Guidance & speedups', icon: IconWand },
  upscale: { title: 'Upscale', icon: IconArrowsMaximize },
  finish: { title: 'Finish & encode', icon: IconMovie },
};

/** Every section's status, recomputed when the settings or the server lists change. */
export function useVideoSectionStatus(): Record<VideoSectionId, VideoSectionStatus> {
  const v = useVideo();
  const server = useStore((s) => s.server);
  return useMemo(() => videoSectionStatus(v, server), [v, server]);
}

export function VideoSectionBody({ id, host }: { id: VideoSectionId; host: string }): ReactNode {
  const h3 = useVideo((s) => s.engine === 'h3');
  switch (id) {
    case 'mode': return <ModeSection host={host} />;
    case 'prompt': return <PromptSection />;
    case 'models': return h3 ? <H3ModelsSection /> : <ModelsSection />;
    case 'loras': return h3 ? <H3LorasSection /> : <LorasSection />;
    case 'size': return h3 ? <H3SizeSection /> : <SizeSection />;
    case 'speed': return h3 ? <H3SpeedSection /> : <SpeedSection />;
    case 'guidance': return h3 ? <H3GuidanceSection /> : <GuidanceSection />;
    case 'upscale': return <UpscaleSection />;
    case 'finish': return <FinishSection />;
  }
}

/** Whether the run starts from a picture, whichever engine. */
export const isI2v = (v: Pick<VideoSettings, 'engine' | 'mode' | 'h3'>) => (v.engine === 'h3' ? v.h3.mode === 'i2v' : v.mode === 'i2v');

// ── Mode & input ────────────────────────────────────────────────────────────

/** Wan 2.2 or MiniMax H3: one switch, each with its own settings underneath. */
export function EngineSwitch() {
  const engine = useVideo((s) => s.engine);
  const set = useVideo((s) => s.set);
  return (
    <Stack gap={4}>
      <SegmentedControl
        fullWidth
        value={engine}
        onChange={(e) => set({ engine: e as VideoEngine })}
        data={[{ value: 'wan', label: 'Wan 2.2' }, { value: 'h3', label: 'MiniMax H3' }]}
        aria-label="Video model"
      />
      <Text size="xs" c="dimmed">
        {engine === 'h3'
          ? 'One 33B omni model: video with its own stereo soundtrack, 24 fps, up to 15 s, text / first-last frame / reference pictures. Slower per clip than Wan.'
          : 'Two 14B experts, silent video, 16 fps, quick with the lightx2v speed LoRAs. Switch to MiniMax H3 for sound.'}
      </Text>
    </Stack>
  );
}

/** Text → Video / Image → Video (Wan), or H3's text / first frame / reference task. */
export function TaskSwitch() {
  const v = useVideo();
  if (v.engine === 'h3') {
    return (
      <Stack gap={4}>
        <SegmentedControl
          fullWidth
          value={v.h3.mode}
          onChange={(m) => v.setH3({ mode: m as H3Mode })}
          data={[{ value: 't2v', label: 'Text' }, { value: 'i2v', label: 'First frame' }, { value: 'ref', label: 'Reference' }]}
          aria-label="H3 task"
        />
        {v.h3.mode === 't2v' && <Text size="xs" c="dimmed">Text alone. H3 writes the sound too: tell it what to hear ("Audio: rain on tin, a distant train, no music").</Text>}
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      <SegmentedControl
        fullWidth
        value={v.mode}
        onChange={(m) => v.set({ mode: m as VideoMode })}
        data={[{ value: 't2v', label: 'Text → Video' }, { value: 'i2v', label: 'Image → Video' }]}
        aria-label="Video task"
      />
      {v.mode === 't2v' && <Text size="xs" c="dimmed">Image → Video starts from a picture of yours; Send to video on any image sets it.</Text>}
    </Stack>
  );
}

/** Wan sizes: 480p and 720p buckets, multiples of 16. */
export const WAN_PRESETS: PresetGroup[] = [
  { group: '480p', items: [
    { value: '832x480', label: '832 × 480 (16:9)' },
    { value: '480x832', label: '480 × 832 (9:16)' },
    { value: '624x624', label: '624 × 624 (1:1)' },
  ] },
  { group: '720p', items: [
    { value: '1280x720', label: '1280 × 720 (16:9)' },
    { value: '720x1280', label: '720 × 1280 (9:16)' },
    { value: '960x960', label: '960 × 960 (1:1)' },
  ] },
];

/** The start image slot, described the way Studio's uploader expects a LoadImage widget. No
 *  name: the label above it already says what it is. */
const START_IMAGE: WorkflowParam = {
  id: 'video:start', nodeId: 9, nodeLabel: 'Start image', nodeType: 'LoadImage', name: '',
  type: 'COMBO', value: '', default: '', options: [], multiline: false, seedLike: false,
};
const END_IMAGE: WorkflowParam = { ...START_IMAGE, id: 'video:end', nodeLabel: 'End image' };

/** A small "more" fold inside a section, for the knobs that are rarely touched. */
function Fold({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <>
      <UnstyledButton onClick={onToggle} aria-expanded={open}>
        <Group gap={4}>
          {open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          <Text size="xs" c="dimmed">{label}</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={open}><Stack gap="sm">{children}</Stack></Collapse>
    </>
  );
}

/** The clip's first picture (Wan's start image, H3's first frame). */
export function StartFrameField({ host }: { host: string }) {
  const v = useVideo();
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>{v.engine === 'h3' ? 'First frame' : 'Start image'}</Text>
      <ImageInput param={START_IMAGE} value={v.startImage} onChange={(ref) => v.set({ startImage: String(ref ?? '') })} host={host} />
      {v.engine === 'h3' && <Text size="xs" c="dimmed">H3 stretches the first frame to the video size, so pick a size with the picture's shape (Send to video flips it for you).</Text>}
    </Stack>
  );
}

/** The optional last picture: the clip travels from the first to it. */
export function EndFrameField({ host }: { host: string }) {
  const v = useVideo();
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>{v.engine === 'h3' ? 'Last frame' : 'End image'}</Text>
      <ImageInput param={END_IMAGE} value={v.endImage} onChange={(ref) => v.set({ endImage: String(ref ?? '') })} host={host} />
      <Text size="xs" c="dimmed">
        {v.engine === 'h3'
          ? 'With a last frame the clip travels from the first picture to the second (the same fl2va model). It is cover-cropped to the size. Clear it to go back to first frame only.'
          : 'With an end image the clip travels from the first picture to the second (first/last frame mode, the same I2V models). Clear it to go back to plain Image → Video.'}
      </Text>
    </Stack>
  );
}

/** Reference pictures for H3's reference task: up to nine `LoadImage` slots, <Picture n> in the prompt. */
export function RefImages({ host }: { host: string }) {
  const refs = useVideo((s) => s.h3.refImages);
  const setH3 = useVideo((s) => s.setH3);
  const update = (list: string[]) => setH3({ refImages: list.filter(Boolean).slice(0, 9) });
  const slots = [...refs.filter(Boolean), ...(refs.filter(Boolean).length < 9 ? [''] : [])];
  return (
    <Stack gap="xs">
      {slots.map((img, i) => (
        <Stack key={`${i}:${img}`} gap={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500}>{img ? `<Picture ${i + 1}>` : refs.filter(Boolean).length ? 'Add another picture' : 'Reference picture'}</Text>
            {img && <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Remove picture ${i + 1}`} onClick={() => update(refs.filter((r, j) => r && j !== i))}><IconX size={14} /></ActionIcon>}
          </Group>
          <ImageInput
            param={{ ...START_IMAGE, id: `video:ref:${i}`, nodeLabel: `Picture ${i + 1}` }}
            value={img}
            onChange={(ref) => { const next = [...refs.filter(Boolean)]; next[i] = String(ref ?? ''); update(next); }}
            host={host}
          />
        </Stack>
      ))}
      <Text size="xs" c="dimmed">Say in the prompt what each one is for: "the character in &lt;Picture 1&gt; walks through the street in &lt;Picture 2&gt;". The model keeps their identity; "match" sizing is the quick one, "max" (under Size) holds detail better and is several times slower.</Text>
    </Stack>
  );
}

function ModeSection({ host }: { host: string }) {
  const v = useVideo();
  const [endOpen, setEndOpen] = useState(!!v.endImage);
  const i2v = isI2v(v);
  return (
    <Stack gap="sm">
      <EngineSwitch />
      <TaskSwitch />
      {i2v && (
        <>
          <StartFrameField host={host} />
          <Fold label={v.endImage ? (v.engine === 'h3' ? 'Last frame (set)' : 'End image (set)') : v.engine === 'h3' ? 'Last frame' : 'End image'} open={endOpen} onToggle={() => setEndOpen((o) => !o)}>
            <EndFrameField host={host} />
          </Fold>
        </>
      )}
      {v.engine === 'h3' && v.h3.mode === 'ref' && <RefImages host={host} />}
    </Stack>
  );
}

function PromptSection() {
  const v = useVideo();
  const [negOpen, setNegOpen] = useState(false);
  const h3 = v.engine === 'h3';
  return (
    <Stack gap="sm">
      <VideoPromptTools kind="positive" />
      <Textarea
        value={v.positive}
        onChange={(e) => v.set({ positive: e.currentTarget.value })}
        placeholder={h3
          ? (v.h3.mode === 'ref' ? 'What happens, who is who: <Picture 1> …, <Picture 2> …; the camera; "Audio: …"' : 'The scene, the motion, the camera — and the sound: "Audio: …"')
          : v.mode === 'i2v' ? 'What happens: the motion, the camera…' : 'The scene, what moves, how the camera moves…'}
        autosize
        minRows={4}
        maxRows={12}
        aria-label="Prompt"
      />
      {h3 && (
        <Text size="xs" c="dimmed">
          H3 follows long, concrete prompts: look, scene, a timeline ("[0–2 s] …"), camera, then an "Audio:" line (ambience, effects, music, speech in quotes). It takes no negative prompt.
        </Text>
      )}
      {!h3 && <Fold label="Negative prompt" open={negOpen} onToggle={() => setNegOpen((o) => !o)}>
        <VideoPromptTools kind="negative" />
        <Textarea value={v.negative} onChange={(e) => v.set({ negative: e.currentTarget.value })} autosize minRows={3} maxRows={8} aria-label="Negative prompt"
          description={v.fast && !v.guidance.nag.on ? 'At CFG 1 (Fast) the negative does nothing — turn on NAG under Guidance to make it count.' : 'Wan was trained with this Chinese negative; English works too.'} />
      </Fold>}
    </Stack>
  );
}

// ── Size & length ───────────────────────────────────────────────────────────

const H3_LENGTHS = [73, 124, 243, 362];

export function H3SizeField() {
  const v = useVideo();
  const h = v.h3;
  return (
    <Stack gap="sm">
      <DimensionsField value={{ width: h.width, height: h.height }} onChange={({ width, height }) => v.setH3({ width, height })} presets={H3_SIZE_PRESETS} />
      <Text size="xs" c="dimmed">Multiples of 32. 864 × 480 is the template's quick size; 1344 × 768 is the model's native canvas (about 3× the work). Above 768 × 1344 pixels is outside what it was trained on.</Text>
    </Stack>
  );
}

export function H3LengthField() {
  const v = useVideo();
  const h = v.h3;
  const secs = framesSeconds(h3Length(h.length), H3_FPS);
  return (
    <SliderField label="Length (frames at 24 fps)" value={h.length} min={22} max={362} step={17} defaultValue={124} presets={H3_LENGTHS} ends={['Short clip, quick', '15 s, slow; needs the most VRAM']}
      onChange={(length) => v.setH3({ length: h3Length(length) })}
      description={`${secs} s · frames snap to the model's 17k + 5 grid · trained for 5–15 s${v.interpolate.on ? ` · saved at ${outputFrames(v).fps} fps after interpolation` : ''}`} />
  );
}

export function H3AudioField() {
  const v = useVideo();
  const h = v.h3;
  return (
    <ToggleField label="Audio" checked={h.audio} onChange={(audio) => v.setH3({ audio })}
      description={h.audio ? 'The model\'s stereo soundtrack (32 kHz) is decoded and muxed into the MP4.' : 'Silent: the audio decode is skipped (the model still generates it inside).'} />
  );
}

export function H3RefSizeField() {
  const v = useVideo();
  const h = v.h3;
  return (
    <SelectField label="Reference picture size" value={h.refImageSize} onChange={(s) => v.setH3({ refImageSize: s as 'match' | 'max' })} searchable={false}
      data={[{ value: 'match', label: 'match — scaled to the video\'s pixel area (quick)' }, { value: 'max', label: 'max — 2048 px short edge (best identity, several × slower)' }]} />
  );
}

function H3SizeSection() {
  const h = useVideo((s) => s.h3);
  return (
    <Stack gap="sm">
      <H3SizeField />
      <H3LengthField />
      <H3AudioField />
      {h.mode === 'ref' && <H3RefSizeField />}
    </Stack>
  );
}

export function WanSizeField() {
  const v = useVideo();
  return <DimensionsField value={{ width: v.width, height: v.height }} onChange={({ width, height }) => v.set({ width, height })} presets={WAN_PRESETS} />;
}

export function WanLengthField() {
  const v = useVideo();
  return (
    <SliderField label="Length (frames)" value={v.length} min={5} max={161} step={4} defaultValue={81} presets={[33, 49, 81, 121]} ends={['Short clip, quick', 'Long clip, slow; may loop or drift']}
      onChange={(length) => v.set({ length: wanLength(length) })} description={`${videoSeconds(v)} s at ${v.fps} fps${v.interpolate.on ? ` · saved at ${outputFrames(v).fps} fps after interpolation` : ''}`} />
  );
}

export function WanFpsField() {
  const v = useVideo();
  return (
    <SliderField label="Frame rate" value={v.fps} min={8} max={30} step={1} defaultValue={16} presets={[16, 24]} onChange={(fps) => v.set({ fps })}
      ends={['Longer clip, slower motion', 'Shorter clip, faster motion']} />
  );
}

function SizeSection() {
  return (
    <Stack gap="sm">
      <WanSizeField />
      <WanLengthField />
      <WanFpsField />
    </Stack>
  );
}

// ── Models ──────────────────────────────────────────────────────────────────

/** A select over one server list; the chosen file stays listed (marked) even if it is missing. */
export function FileSelect({ label, value, files, onChange, description }: { label: string; value: string; files: string[]; onChange: (v: string) => void; description?: ReactNode }) {
  const missing = !!value && !files.includes(value);
  const data = [...(missing ? [{ value, label: `${modelLabel(value)} (not installed)` }] : []), ...files.map((f) => ({ value: f, label: modelLabel(f) }))];
  return (
    <SelectField label={label} value={value} onChange={onChange} data={data} description={description}
      rightSection={missing ? <Badge size="xs" color="orange" variant="light">missing</Badge> : undefined} />
  );
}

const WEIGHT_DTYPES: { value: WeightDtype; label: string }[] = [
  { value: 'default', label: 'default (as saved)' },
  { value: 'fp8_e4m3fn', label: 'fp8 e4m3fn' },
  { value: 'fp8_e4m3fn_fast', label: 'fp8 e4m3fn fast (Ada / Blackwell)' },
  { value: 'fp8_e5m2', label: 'fp8 e5m2' },
];

/** `UNETLoader`'s weight dtype, both engines. */
export function WeightDtypeField() {
  const v = useVideo();
  const files = v.models[v.mode];
  const gguf = v.engine !== 'h3' && /\.gguf$/i.test(files.high) && /\.gguf$/i.test(files.low);
  return (
    <SelectField label="Weight dtype" value={v.weightDtype} onChange={(weightDtype) => v.set({ weightDtype: weightDtype as WeightDtype })} data={WEIGHT_DTYPES} searchable={false} disabled={gguf}
      description={v.engine === 'h3' ? 'Leave on default for the INT8 files: they carry their own quantisation.'
        : gguf ? 'GGUF models carry their own quantisation.' : 'How UNETLoader holds the weights. fp8 fast uses the GPU\'s fp8 matmul: quicker, a touch less exact.'} />
  );
}

export function H3ModelFiles() {
  const v = useVideo();
  const h = v.h3;
  const server = useStore((s) => s.server);
  const h3Files = server.diffusionModels.filter(isH3Name);
  const diffusion = h3Files.length ? h3Files : server.diffusionModels;
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">Text and first / last frame run the fl2va checkpoint, reference pictures the ref2va one. The pod carries the pruned INT8 pair (21 GB each) from Comfy-Org/MiniMax-H3.</Text>
      <FileSelect label={h.mode === 'ref' ? 'Model (ref2va, in use)' : 'Model (fl2va, in use)'} value={h3ModelFile(h)} files={diffusion}
        onChange={(f) => v.setH3({ models: { ...h.models, [h.mode === 'ref' ? 'ref2va' : 'fl2va']: f } })} />
      <FileSelect label={h.mode === 'ref' ? 'Model for text / first frame (fl2va)' : 'Model for reference pictures (ref2va)'} value={h.mode === 'ref' ? h.models.fl2va : h.models.ref2va} files={diffusion}
        onChange={(f) => v.setH3({ models: { ...h.models, [h.mode === 'ref' ? 'fl2va' : 'ref2va']: f } })} />
    </Stack>
  );
}

export function H3TextEncoderField() {
  const v = useVideo();
  const encoders = useStore((s) => s.server.textEncoders);
  return (
    <FileSelect label="Text encoder (Qwen3-VL-32B)" value={v.h3.textEncoder} files={encoders} onChange={(textEncoder) => v.setH3({ textEncoder })}
      description="nvfp4_awq (16 GB, the template's, runs on any GPU) or int8_convrot (27 GB, closer to the original). Both are on the pod." />
  );
}

export function H3VaeFields() {
  const v = useVideo();
  const vaes = useStore((s) => s.server.vaes);
  return (
    <Stack gap="sm">
      <FileSelect label="Video VAE" value={v.h3.videoVae} files={vaes} onChange={(videoVae) => v.setH3({ videoVae })} />
      <FileSelect label="Audio VAE" value={v.h3.audioVae} files={vaes} onChange={(audioVae) => v.setH3({ audioVae })} />
    </Stack>
  );
}

function H3ModelsSection() {
  return (
    <Stack gap="sm">
      <H3ModelFiles />
      <H3TextEncoderField />
      <H3VaeFields />
      <WeightDtypeField />
    </Stack>
  );
}

export function WanModelFiles() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const files = v.models[v.mode];
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">{v.mode === 't2v' ? 'Text' : 'Image'} → Video has its own pair of experts; installed stand-ins are picked for you.</Text>
      <FileSelect label="High-noise model" value={files.high} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'high', f)} />
      <FileSelect label="Low-noise model" value={files.low} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'low', f)} />
    </Stack>
  );
}

export function WanTextEncoderField() {
  const v = useVideo();
  const encoders = useStore((s) => s.server.textEncoders);
  return <FileSelect label="Text encoder" value={v.textEncoder} files={encoders} onChange={(textEncoder) => v.set({ textEncoder })} />;
}

export function WanVaeField() {
  const v = useVideo();
  const vaes = useStore((s) => s.server.vaes);
  return <FileSelect label="VAE" value={v.vae} files={vaes} onChange={(vae) => v.set({ vae })} />;
}

function ModelsSection() {
  return (
    <Stack gap="sm">
      <WanModelFiles />
      <WanTextEncoderField />
      <WanVaeField />
      <WeightDtypeField />
    </Stack>
  );
}

// ── LoRAs ───────────────────────────────────────────────────────────────────

const LORA_ENDS = ['Weaker effect', 'Stronger, may break the look'] as const;

export function H3LorasSection() {
  const v = useVideo();
  const h = v.h3;
  const loras = useStore((s) => s.server.loras);
  const availability = useResourceAvailability('lora');
  const [picking, setPicking] = useState(false);
  const toggle = (name: string) => {
    const found = h.loras.find((l) => l.name === name);
    if (found) v.removeH3Lora(found.id); else v.addH3Lora(name);
  };
  return (
    <Stack gap="xs">
      {h.loras.map((l) => (
        <Paper key={l.id} withBorder p="xs" radius="sm" style={{ opacity: l.on ? 1 : 0.55 }}>
          <Stack gap={6}>
            <Group gap="xs" wrap="nowrap">
              <Switch size="xs" checked={l.on} onChange={(e) => v.updateH3Lora(l.id, { on: e.currentTarget.checked })} aria-label={`${l.name} on`} />
              <Text size="xs" fw={600} truncate style={{ flex: 1, minWidth: 0 }} title={l.name}>{modelLabel(l.name)}</Text>
              <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Remove ${l.name}`} onClick={() => v.removeH3Lora(l.id)}><IconX size={14} /></ActionIcon>
            </Group>
            <StrengthControl label="Strength" value={l.strength} min={0} max={3} step={0.05} chips={[0.5, 1, 1.5]} color="grape" ends={LORA_ENDS}
              onChange={(strength) => v.updateH3Lora(l.id, { strength })} />
          </Stack>
        </Paper>
      ))}
      {!h.loras.length && <Text size="xs" c="dimmed">H3 LoRAs are single files (one model, no experts). The turbo speed LoRAs live under Speed & sampling, not here.</Text>}
      <Button variant="light" color="grape" leftSection={<IconPlus size="1rem" />} onClick={() => setPicking(true)} fullWidth>Add LoRA</Button>
      <ModelSelectorModal
        opened={picking}
        onClose={() => setPicking(false)}
        kind="lora"
        models={loras}
        selectedModels={h.loras.map((l) => l.name)}
        onToggleModel={toggle}
        availability={availability}
        fitsType={{ label: 'MiniMax H3', fits: (bucket) => bucket === 'MiniMax H3' || bucket === 'Unknown' }}
      />
    </Stack>
  );
}

export function LorasSection() {
  const v = useVideo();
  const loras = useStore((s) => s.server.loras);
  const availability = useResourceAvailability('lora');
  const [picking, setPicking] = useState(false);
  const toggleLora = (name: string) => {
    const found = v.loras.find((l) => l.name === name);
    if (found) v.removeLora(found.id); else v.addLora(name);
  };

  return (
    <Stack gap="xs">
      {v.loras.map((l) => (
        <Paper key={l.id} withBorder p="xs" radius="sm" style={{ opacity: l.on ? 1 : 0.55 }}>
          <Stack gap={6}>
            <Group gap="xs" wrap="nowrap">
              <Switch size="xs" checked={l.on} onChange={(e) => v.updateLora(l.id, { on: e.currentTarget.checked })} aria-label={`${l.name} on`} />
              <Text size="xs" fw={600} truncate style={{ flex: 1, minWidth: 0 }} title={l.name}>{modelLabel(l.name)}</Text>
              <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Remove ${l.name}`} onClick={() => v.removeLora(l.id)}><IconX size={14} /></ActionIcon>
            </Group>
            {/* A two-file LoRA (high + low noise) is always one file per expert: no expert pick. */}
            {l.nameLow ? (
              <Text size="xs" c="dimmed" truncate title={l.nameLow}>High + low pair · low file: {modelLabel(l.nameLow)}</Text>
            ) : (
              <SegmentedControl size="xs" fullWidth value={l.expert} onChange={(expert) => v.updateLora(l.id, { expert: expert as typeof l.expert })}
                data={[{ value: 'high', label: 'High noise' }, { value: 'low', label: 'Low noise' }, { value: 'both', label: 'Both' }]} />
            )}
            <StrengthControl label={(l.nameLow || l.expert === 'both') && l.strengthLow != null ? 'Strength (high)' : 'Strength'} value={l.strength} min={0} max={3} step={0.05} chips={[0.5, 1, 1.5]} color="grape" ends={LORA_ENDS}
              onChange={(strength) => v.updateLora(l.id, { strength })} />
            {(l.nameLow || l.expert === 'both') && (
              <>
                <Switch size="xs" checked={l.strengthLow != null} label={<Text size="xs">Own strength on the low-noise expert</Text>}
                  onChange={(e) => v.updateLora(l.id, { strengthLow: e.currentTarget.checked ? l.strength : null })} />
                {l.strengthLow != null && (
                  <StrengthControl label="Strength (low)" value={l.strengthLow} min={0} max={3} step={0.05} chips={[0.5, 1, 1.5]} color="grape" ends={LORA_ENDS}
                    onChange={(strengthLow) => v.updateLora(l.id, { strengthLow })} />
                )}
              </>
            )}
          </Stack>
        </Paper>
      ))}
      {!v.loras.length && <Text size="xs" c="dimmed">Wan 2.2 LoRAs come as a high-noise and a low-noise file; a name that says which starts on that expert. Anime Style v2 (wan2.2_*_animestyle_v2_high / low) is on the pod.</Text>}
      <Button variant="light" color="grape" leftSection={<IconPlus size="1rem" />} onClick={() => setPicking(true)} fullWidth>Add LoRA</Button>
      <ModelSelectorModal
        opened={picking}
        onClose={() => setPicking(false)}
        kind="lora"
        models={loras}
        selectedModels={v.loras.map((l) => l.name)}
        onToggleModel={toggleLora}
        availability={availability}
        fitsType={{ label: 'Wan', fits: (bucket) => bucket === 'Wan Video' || bucket === 'Unknown' }}
      />
    </Stack>
  );
}

// ── Speed & sampling ────────────────────────────────────────────────────────

/** What the low and high end of the shared sliders do. */
const STEPS_ENDS = ['Quicker, rougher', 'More detail, slower'] as const;
const SWITCH_ENDS = ['Less motion, more detail', 'More motion, less detail'] as const;
const CFG_ENDS = ['Looser, softer colours', 'Follows the prompt, may burn'] as const;

/** H3's Turbo: the lightx2v turbo LoRA, its steps and strength, the files. */
export function TurboBlock() {
  const v = useVideo();
  const h = v.h3;
  const serverLoras = useStore((s) => s.server.loras);
  const t = h.turbo;
  const setTurbo = (p: Partial<typeof t>) => v.setH3({ turbo: { ...t, ...p } });
  const ref = h.mode === 'ref';
  const [filesOpen, setFilesOpen] = useState(false);
  const turboLoras: string[] = [H3_TURBO_LORAS.fl2va8, H3_TURBO_LORAS.fl2va4, H3_TURBO_LORAS.ref4];
  const loraFiles = [...turboLoras.filter((f) => serverLoras.includes(f)), ...serverLoras.filter((f) => !turboLoras.includes(f) && /turbo|lightning|lightx2v/i.test(f))];
  // Picking a turbo file sets the steps it was distilled for ("4step", "8step").
  const pickLora = (which: 'lora' | 'loraRef', file: string) => {
    const steps = h3TurboStepsOf(file);
    setTurbo(which === 'lora' ? { lora: file, ...(steps ? { steps } : {}) } : { loraRef: file, ...(steps ? { stepsRef: steps } : {}) });
  };
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <Switch
          checked={t.on}
          onChange={(e) => setTurbo({ on: e.currentTarget.checked })}
          label={<Text size="sm" fw={500}>Turbo ({ref ? t.stepsRef : t.steps} steps)</Text>}
          description={`lightx2v's turbo LoRA on the model, ${ref ? t.stepsRef : t.steps} steps instead of ${h.steps}: about ${Math.max(1, Math.round(h.steps / Math.max(1, ref ? t.stepsRef : t.steps)))}× faster. The 8-step file keeps more detail than the 4-step; speech and timbre want 12+ steps, so leave Turbo off for talking.`}
        />
        {t.on && (
          <Stack gap={6} className="border-t border-border-default pt-2">
            <SliderField label={ref ? 'Turbo steps (reference)' : 'Turbo steps'} value={ref ? t.stepsRef : t.steps} min={2} max={16} step={1} defaultValue={ref ? 4 : 8} presets={[4, 6, 8]}
              onChange={(n) => setTurbo(ref ? { stepsRef: n } : { steps: n })} ends={['What the LoRA was made for', 'More detail, slower']}
              description="4 for a 4-step file, 8 for the 8-step one; 6–8 with the 4-step file at strength ~0.8 also works." />
            <StrengthControl label="Turbo LoRA strength" value={t.strength} min={0} max={1.5} step={0.05} chips={[0.8, 1]} color="yellow" onChange={(strength) => setTurbo({ strength })}
              ends={['Softer, more motion', 'Cleaner, as distilled']} />
            <Fold label="Turbo LoRA files" open={filesOpen} onToggle={() => setFilesOpen((o) => !o)}>
              <FileSelect label="Text / first frame (fl2va)" value={t.lora} files={loraFiles} onChange={(f) => pickLora('lora', f)} />
              <FileSelect label="Reference pictures (ref2va)" value={t.loraRef} files={loraFiles} onChange={(f) => pickLora('loraRef', f)}
                description="The pod has the fl2v 8-step and 4-step (768p) files and the ref2v 4-step one. Distilled on the full builds; they are what the templates use with the pruned ones too." />
            </Fold>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export function H3StepsField() {
  const v = useVideo();
  const h = v.h3;
  return (
    <SliderField label="Steps" value={h.turbo.on ? h3EffectiveSteps(h) : h.steps} min={4} max={50} step={1} defaultValue={20} presets={[12, 20, 30]} disabled={h.turbo.on}
      onChange={(steps) => v.setH3({ steps })} ends={STEPS_ENDS} description={h.turbo.on ? 'Turbo sets the steps; turn it off to use these.' : '20 is the template. Simple shots are fine at 12–16; fine detail keeps improving to about 50.'} />
  );
}

export function H3CfgField() {
  const v = useVideo();
  const h = v.h3;
  return (
    <SliderField label="CFG" value={h.cfg} min={1} max={6} step={0.1} defaultValue={1} presets={[1, 2, 3]} onChange={(cfg) => v.setH3({ cfg })}
      description="1 is the template (no guidance pass, as BasicGuider). Above 1 the model runs twice per step against an empty negative: stronger prompt following, may burn." ends={['The template; fastest', 'Follows the prompt harder; 2× work']} />
  );
}

export function H3ShiftFields() {
  const v = useVideo();
  const h = v.h3;
  return (
    <Stack gap="sm">
      <SliderField label="Video shift" value={h.shiftVideo} min={1} max={30} step={0.5} defaultValue={12} presets={[10, 12]} onChange={(shiftVideo) => v.setH3({ shiftVideo })}
        description="The flow schedule's shift. 12 is the model's default; FastH3 uses 10." ends={['More detail, less motion', 'Bigger motion, looser detail']} />
      <SliderField label="Audio shift" value={h.shiftAudio} min={0.5} max={10} step={0.5} defaultValue={3} presets={[2, 3]} onChange={(shiftAudio) => v.setH3({ shiftAudio })}
        description="The soundtrack's own shift; 3 is the default, 2 with the 4-step distill." ends={['Cleaner, flatter sound', 'More texture, may smear']} />
    </Stack>
  );
}

export function H3SamplerFields() {
  const v = useVideo();
  const h = v.h3;
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  return (
    <Stack gap="sm">
      <SelectField label="Sampler" value={h.sampler} onChange={(sampler) => v.setH3({ sampler })} data={[...new Set([h.sampler, ...samplers])]}
        description="res_multistep / simple is the template; lcm / simple for the 4-step distill. Keep one sampler run: splitting resets multistep history." />
      <SelectField label="Scheduler" value={h.scheduler} onChange={(scheduler) => v.setH3({ scheduler })} data={[...new Set([h.scheduler, ...schedulers])]} />
    </Stack>
  );
}

function H3SpeedSection() {
  return (
    <Stack gap="sm">
      <TurboBlock />
      <H3StepsField />
      <H3CfgField />
      <H3ShiftFields />
      <H3SamplerFields />
    </Stack>
  );
}

/** Wan's Fast mode: the lightx2v LoRAs, the recipe fold, the speed LoRA files. */
export function FastBlock() {
  const v = useVideo();
  const serverLoras = useStore((s) => s.server.loras);
  const files = v.models[v.mode];
  const fr = v.fastRecipe;
  const setFr = (p: Partial<typeof fr>) => v.set({ fastRecipe: { ...fr, ...p } });
  const eff = effectiveSampling(v);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [speedLorasOpen, setSpeedLorasOpen] = useState(false);
  const setFastLora = (which: 'high' | 'low', file: string) => v.set({ fastLoras: { ...v.fastLoras, [v.mode]: { ...v.fastLoras[v.mode], [which]: file } } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <Switch
          checked={v.fast}
          onChange={(e) => v.set({ fast: e.currentTarget.checked })}
          label={<Text size="sm" fw={500}>Fast ({fr.steps} steps)</Text>}
          description={`lightx2v speed LoRAs on both models (none on a model that has one inside), ${fr.steps} steps at CFG ${fr.cfg}: about 6× faster, nearly the same look. Off: the full steps and CFG below.`}
        />
        {v.fast && (
          <Stack gap={6} className="border-t border-border-default pt-2">
            {(['high', 'low'] as const).map((which) => (
              <Switch key={which} size="xs" checked={hasSpeedInside(v, files[which])}
                onChange={(e) => v.set({ speedInside: { ...v.speedInside, [files[which]]: e.currentTarget.checked } })}
                label={<Text size="xs">{which === 'high' ? 'High-noise' : 'Low-noise'} model has the speed LoRA inside</Text>} />
            ))}
            <Text size="xs" c="dimmed">Fast then adds no lightx2v LoRA to it: a second one makes the video worse. Guessed from the name (SmoothMix T2V, Lightning mixes).</Text>
            <Fold label="Fast recipe: steps, switch, LoRA strength, motion pass" open={recipeOpen} onToggle={() => setRecipeOpen((o) => !o)}>
              <SliderField label="Fast steps" value={fr.steps} min={2} max={12} step={1} defaultValue={FAST.steps} presets={[4, 6, 8]}
                onChange={(steps) => setFr({ steps, switchStep: Math.min(fr.switchStep, steps), motionSteps: Math.min(fr.motionSteps, steps) })}
                description="4 is what the LoRA was distilled for; 6–8 add detail at the cost of time." ends={STEPS_ENDS} />
              <SliderField label="Switch to low-noise at step" value={fr.switchStep} min={0} max={fr.steps} step={1} defaultValue={FAST.switchStep}
                onChange={(switchStep) => setFr({ switchStep, motionSteps: Math.min(fr.motionSteps, switchStep) })} ends={SWITCH_ENDS} />
              <SliderField label="Fast CFG" value={fr.cfg} min={1} max={3} step={0.1} defaultValue={FAST.cfg} presets={[1]} onChange={(cfg) => setFr({ cfg })}
                description="1 is the distilled value (and half the work per step). Above 1 the negative prompt starts to act."
                ends={['Fastest; negative ignored', 'Follows the prompt; 2× work, may burn']} />
              <StrengthControl label="lightx2v strength · high" value={fr.strengthHigh} min={0} max={1.5} step={0.05} chips={[0.6, 0.8, 1]} color="yellow" onChange={(strengthHigh) => setFr({ strengthHigh })}
                ends={['More motion, noisier', 'Cleaner, stiffer motion']} />
              <StrengthControl label="lightx2v strength · low" value={fr.strengthLow} min={0} max={1.5} step={0.05} chips={[0.6, 0.8, 1]} color="yellow" onChange={(strengthLow) => setFr({ strengthLow })}
                ends={['Softer, may be noisy', 'Cleaner detail']} />
              <SliderField label="Motion pass (steps without the speed LoRA)" value={fr.motionSteps} min={0} max={Math.max(0, fr.switchStep)} step={1} defaultValue={0} presets={[0, 1, 2]}
                onChange={(motionSteps) => setFr({ motionSteps })} ends={['Off: fastest, calmer motion', 'More motion, slower']}
                description={fr.motionSteps > 0
                  ? `Steps 0–${eff.motionSteps} run the high-noise model plain at CFG ${fr.motionCfg} (twice the work each), then lightx2v takes over: the community's fix for the LoRA's slow-motion look.`
                  : 'The speed LoRA on the high-noise expert flattens motion. A plain pass first lays out the movement; 1–2 steps is the usual dose.'} />
              {fr.motionSteps > 0 && (
                <SliderField label="Motion pass CFG" value={fr.motionCfg} min={1} max={8} step={0.5} defaultValue={3.5} presets={[3, 3.5, 5]} onChange={(motionCfg) => setFr({ motionCfg })}
                  ends={['Gentle motion', 'Stronger motion, may burn']} />
              )}
            </Fold>
            <Fold label="Speed LoRA files" open={speedLorasOpen} onToggle={() => setSpeedLorasOpen((o) => !o)}>
              <FileSelect label="High-noise speed LoRA" value={v.fastLoras[v.mode].high} files={serverLoras} onChange={(f) => setFastLora('high', f)} />
              <FileSelect label="Low-noise speed LoRA" value={v.fastLoras[v.mode].low} files={serverLoras} onChange={(f) => setFastLora('low', f)}
                description="The pod has the Comfy-Org v1 / v1.1 pairs (default), the newer lightx2v I2V 260412 rank-64 pair and the T2V Seko V2.0 pair." />
            </Fold>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

/** Steps and the expert switch (Fast sets both; then these are read-only). */
export function WanStepsFields() {
  const v = useVideo();
  const fr = v.fastRecipe;
  return (
    <Stack gap="sm">
      <SliderField label="Steps" value={v.fast ? fr.steps : v.steps} min={2} max={60} step={1} defaultValue={20} presets={[8, 20, 30]} disabled={v.fast}
        onChange={(steps) => v.set({ steps, switchStep: Math.min(v.switchStep, steps) })} ends={STEPS_ENDS}
        description={v.fast ? 'Fast sets the steps (its recipe is under the Fast chip); turn it off to use these.' : undefined} />
      <WanSwitchField />
    </Stack>
  );
}

export function WanSwitchField() {
  const v = useVideo();
  const fr = v.fastRecipe;
  return (
    <SliderField label="Switch to low-noise at step" value={v.fast ? fr.switchStep : v.switchStep} min={0} max={v.fast ? fr.steps : v.steps} step={1} defaultValue={10} disabled={v.fast}
      description="The high-noise expert lays out motion and layout; the low-noise one adds detail."
      onChange={(switchStep) => v.set({ switchStep })} ends={SWITCH_ENDS} />
  );
}

export function WanCfgFields() {
  const v = useVideo();
  const fr = v.fastRecipe;
  return (
    <Stack gap="sm">
      <SliderField label={v.cfgLow == null ? 'CFG' : 'CFG · high noise'} value={v.fast ? fr.cfg : v.cfg} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 3.5, 5]} disabled={v.fast} onChange={(cfg) => v.set({ cfg })}
        ends={CFG_ENDS} description={v.fast ? 'Fast runs at its own CFG (under the Fast chip).' : undefined} />
      {!v.fast && (
        <Switch size="xs" checked={v.cfgLow != null} label={<Text size="xs">Own CFG for the low-noise expert</Text>}
          onChange={(e) => v.set({ cfgLow: e.currentTarget.checked ? v.cfg : null })} />
      )}
      {!v.fast && v.cfgLow != null && (
        <SliderField label="CFG · low noise" value={v.cfgLow} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 2, 3.5]} onChange={(cfgLow) => v.set({ cfgLow })}
          description="A lower CFG on the detail pass keeps colours from burning." ends={CFG_ENDS} />
      )}
    </Stack>
  );
}

export function WanShiftFields() {
  const v = useVideo();
  return (
    <Stack gap="sm">
      <SliderField label={v.shiftLow == null ? 'Shift' : 'Shift · high noise'} value={v.shift} min={1} max={16} step={0.5} defaultValue={8} presets={[5, 8]} onChange={(shift) => v.set({ shift })}
        description="Higher pushes more steps into the noisy phase: bigger motion, looser detail. lightx2v was distilled at 5; 8 is ComfyUI's template."
        ends={['Smaller motion, tighter detail', 'Bigger motion, looser detail']} />
      <Switch size="xs" checked={v.shiftLow != null} label={<Text size="xs">Own shift for the low-noise expert</Text>}
        onChange={(e) => v.set({ shiftLow: e.currentTarget.checked ? v.shift : null })} />
      {v.shiftLow != null && (
        <SliderField label="Shift · low noise" value={v.shiftLow} min={1} max={16} step={0.5} defaultValue={8} presets={[3, 5, 8]} onChange={(shiftLow) => v.set({ shiftLow })}
          ends={['Finer, crisper detail', 'Smoother, looser detail']} />
      )}
    </Stack>
  );
}

export function WanSamplerFields() {
  const v = useVideo();
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  return (
    <Stack gap="sm">
      <SelectField label="Sampler" value={v.sampler} onChange={(sampler) => v.set({ sampler })} data={[...new Set([v.sampler, ...samplers])]}
        description={v.fast ? 'euler / simple matches how lightx2v was distilled.' : 'euler, dpmpp_2m, res_multistep and uni_pc are the usual Wan picks.'} />
      <SelectField label="Scheduler" value={v.scheduler} onChange={(scheduler) => v.set({ scheduler })} data={[...new Set([v.scheduler, ...schedulers])]} />
    </Stack>
  );
}

function SpeedSection() {
  return (
    <Stack gap="sm">
      <FastBlock />
      <WanStepsFields />
      <WanCfgFields />
      <WanShiftFields />
      <WanSamplerFields />
    </Stack>
  );
}

// ── Guidance & speedups ─────────────────────────────────────────────────────

export function NagBlock() {
  const v = useVideo();
  const g = v.guidance;
  const setNag = (p: Partial<typeof g.nag>) => v.set({ guidance: { ...g, nag: { ...g.nag, ...p } } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="NAG — negative prompt at CFG 1" checked={g.nag.on} onChange={(on) => setNag({ on })}
          description="Normalized Attention Guidance (KJNodes WanVideoNAG): the negative acts inside Wan's cross-attention, so it works with the speed LoRAs at CFG 1 for a small cost per step. Not yet run on the pod from here." />
        {g.nag.on && (
          <>
            <SliderField label="NAG scale" value={g.nag.scale} min={0} max={30} step={0.5} defaultValue={11} presets={[5, 8, 11, 15]} onChange={(scale) => setNag({ scale })}
              description="How far from the negative. 11 is the node's default; 0 turns it off."
              ends={['Negative barely acts', 'Strong negative, may distort']} />
            <SliderField label="Alpha" value={g.nag.alpha} min={0} max={1} step={0.05} defaultValue={0.25} presets={[0.25, 0.5, 1]} onChange={(alpha) => setNag({ alpha })} description="Blend of the guided attention: 1 replaces it, 0 does nothing."
              ends={['Subtle', 'Full effect']} />
            <SliderField label="Tau" value={g.nag.tau} min={0} max={10} step={0.1} defaultValue={2.5} presets={[1.5, 2.5, 3.5]} onChange={(tau) => setNag({ tau })} description="Clamp on the guidance norm; higher lets it push harder."
              ends={['Held back, safer', 'Pushes harder']} />
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function CfgZeroField() {
  const v = useVideo();
  const g = v.guidance;
  const eff = effectiveSampling(v);
  const cfg1 = eff.cfg <= 1 && eff.cfgLow <= 1 && eff.motionSteps === 0;
  return (
    <ToggleField label="CFG-Zero*" checked={g.cfgZeroStar} onChange={(cfgZeroStar) => v.set({ guidance: { ...g, cfgZeroStar } })}
      description={cfg1 ? 'Only acts when a sampler runs CFG above 1 (Fast off, or the motion pass).' : 'Zero-inits the first step and rescales the guidance: cleaner colours at normal CFG, free.'} />
  );
}

export function EasyCacheBlock() {
  const v = useVideo();
  const sp = v.speedups;
  const setCache = (p: Partial<typeof sp.easyCache>) => v.set({ speedups: { ...sp, easyCache: { ...sp.easyCache, ...p } } });
  const eff = effectiveSampling(v);
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="EasyCache" checked={sp.easyCache.on} onChange={(on) => setCache({ on })}
          description={eff.steps <= 6 ? `Skips steps whose change is small. With ${eff.steps} steps there is nothing to skip; it pays at 15+ steps.` : 'Skips steps whose predicted change is under the threshold: 1.3–2× faster at 20 steps, slight softening.'} />
        {sp.easyCache.on && (
          <>
            <SliderField label="Reuse threshold" value={sp.easyCache.threshold} min={0.05} max={1} step={0.05} defaultValue={0.2} presets={[0.1, 0.2, 0.3]} onChange={(threshold) => setCache({ threshold })} description="Higher skips more and loses more."
              ends={['Exact, slower', 'Faster, softer']} />
            <SliderField label="Active from" value={sp.easyCache.startPercent} min={0} max={1} step={0.05} defaultValue={0.15} presets={[0.1, 0.15, 0.3]} onChange={(startPercent) => setCache({ startPercent })} description="Fraction of the run; the first steps are never skipped."
              ends={['Starts sooner, faster', 'Starts later, safer']} />
            <SliderField label="Active until" value={sp.easyCache.endPercent} min={0} max={1} step={0.05} defaultValue={0.95} presets={[0.8, 0.95, 1]} onChange={(endPercent) => setCache({ endPercent })}
              ends={['Stops early, crisper finish', 'Runs to the end, faster']} />
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function TorchCompileField() {
  const v = useVideo();
  const sp = v.speedups;
  return (
    <ToggleField label="torch.compile (inductor)" checked={sp.torchCompile} onChange={(torchCompile) => v.set({ speedups: { ...sp, torchCompile } })}
      description="Compiles both experts: the first run on a new size takes minutes longer, later ones ~1.2–1.5× faster while the server stays up. Unverified on the pod; turn off if a run errors." />
  );
}

export function LongClipBlock() {
  const v = useVideo();
  const setLong = (p: Partial<typeof v.longClip>) => v.set({ longClip: { ...v.longClip, ...p } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="Long clip: context windows" checked={v.longClip.on} onChange={(on) => setLong({ on })}
          description={v.mode === 'i2v'
            ? 'Samples a long clip in overlapping 81-frame windows. Works poorly with Image → Video (the start frame drifts); meant for Text → Video with a still camera.'
            : 'Samples a long clip in overlapping windows blended with FreeNoise, so 121–241 frames stay coherent. Backgrounds can drift between windows.'} />
        {v.longClip.on && (
          <>
            <SliderField label="Window (frames)" value={v.longClip.windowFrames} min={17} max={121} step={4} defaultValue={81} presets={[49, 81, 121]}
              onChange={(windowFrames) => setLong({ windowFrames: wanLength(windowFrames) })} description={`Never more than the clip (${wanLength(v.length)} frames).`}
              ends={['Less VRAM, more drift', 'More coherent, more VRAM']} />
            <SliderField label="Overlap (frames)" value={v.longClip.overlapFrames} min={0} max={64} step={2} defaultValue={30} presets={[16, 30, 48]}
              onChange={(overlapFrames) => setLong({ overlapFrames })} description="More overlap blends better and costs more."
              ends={['Faster, visible seams', 'Smoother joins, slower']} />
          </>
        )}
      </Stack>
    </Paper>
  );
}

function GuidanceSection() {
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">Model patches on both experts, all in ComfyUI itself. Each is off unless you turn it on.</Text>
      <NagBlock />
      <CfgZeroField />
      <EasyCacheBlock />
      <TorchCompileField />
      <LongClipBlock />
    </Stack>
  );
}

/** Why H3 has VRAM patches at all, for the top of its Guidance section. */
export function H3VramNote() {
  const v = useVideo();
  const tokens = Math.round((clipFrames(v) - 5) / 17 * 5 + 2) * Math.ceil(v.h3.height / 16) * Math.ceil(v.h3.width / 16);
  return (
    <Text size="xs" c="dimmed">
      H3 runs on one card: about {Math.round(tokens / 1000)}k video tokens at this size and length, plus audio and text, through a 33B model. On a shared 80 GB card (the pod's video share is 41 GB) long or native-size clips can run out of VRAM; these KJNodes patches cut the peak without changing the output. Off by default; turn them on if a run fails with "out of memory".
    </Text>
  );
}

export function H3LowVramAttentionBlock() {
  const v = useVideo();
  const lv = v.h3.lowVram;
  const set = (p: Partial<typeof lv>) => v.setH3({ lowVram: { ...lv, ...p } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="Low-VRAM attention" checked={lv.attention} onChange={(attention) => set({ attention })}
          description="Splits each attention call into head groups so its temporary buffers shrink by the count. Same result, a little slower." />
        {lv.attention && (
          <SliderField label="Head groups" value={lv.headChunks} min={1} max={14} step={1} defaultValue={4} presets={[2, 4, 8]} onChange={(headChunks) => set({ headChunks })}
            ends={['Less saving', 'Most saving, slowest']} />
        )}
      </Stack>
    </Paper>
  );
}

export function H3LowVramFeedForwardBlock() {
  const v = useVideo();
  const lv = v.h3.lowVram;
  const set = (p: Partial<typeof lv>) => v.setH3({ lowVram: { ...lv, ...p } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="Chunked feed-forward" checked={lv.feedForward} onChange={(feedForward) => set({ feedForward })}
          description="Runs the feed-forward (SwiGLU) over the token sequence in pieces; each piece still uses the fused INT8 kernel, so the output matches." />
        {lv.feedForward && (
          <SliderField label="Chunks" value={lv.chunks} min={1} max={16} step={1} defaultValue={2} presets={[2, 4, 8]} onChange={(chunks) => set({ chunks })}
            ends={['Less saving', 'Most saving, slowest']} />
        )}
      </Stack>
    </Paper>
  );
}

function H3GuidanceSection() {
  return (
    <Stack gap="sm">
      <H3VramNote />
      <H3LowVramAttentionBlock />
      <H3LowVramFeedForwardBlock />
      <Text size="xs" c="dimmed">Not here on purpose: SageAttention (no wheel in the image; its INT8 path also artefacts with int8_convrot) and the hosted 2K upscaler / Context-IR, which are Comfy Cloud only. The Upscale section's SPAN models work on H3 frames as on Wan's.</Text>
    </Stack>
  );
}

// ── Upscale ─────────────────────────────────────────────────────────────────

/** Fast upscale models first; measured on the A100 (81 frames 832x480 -> 2x, incl. writing the
 *  MP4): resize 7 s, 2xNomosUni SPAN 12 s, 2x-AnimeSharpV4 Fast 20 s, 4x-ClearReality 33 s,
 *  RealESRGAN x4 anime 6B 57 s, 4x-UltraSharp 102 s. */
const FAST_UPSCALERS = ['2xNomosUni_span_multijpg.safetensors', '2x-AnimeSharpV4_Fast_RCAN_PU.safetensors', '4x-ClearRealityV1.safetensors'];

export function UpscaleSection() {
  const v = useVideo();
  const models = useStore((s) => s.server.upscaleModels);
  const up = v.upscale;
  const set = (p: Partial<VideoUpscale>) => v.set({ upscale: { ...up, ...p } });
  const baseW = v.engine === 'h3' ? v.h3.width : v.width, baseH = v.engine === 'h3' ? v.h3.height : v.height;
  const [w, h] = upscaledSize(baseW, baseH, up.scale);
  const ordered = [...FAST_UPSCALERS.filter((m) => models.includes(m)), ...models.filter((m) => !FAST_UPSCALERS.includes(m))];
  const data = ordered.map((m) => ({ value: m, label: `${modelLabel(m)}${FAST_UPSCALERS.includes(m) ? ' (fast)' : ''}` }));
  if (up.model && !models.includes(up.model)) data.unshift({ value: up.model, label: `${modelLabel(up.model)} (not installed)` });
  return (
    <Stack gap="sm">
      <Switch checked={up.on} onChange={(e) => set({ on: e.currentTarget.checked })} aria-label="Upscale the video"
        label={<Text size="sm" fw={500}>Upscale the video</Text>}
        description={up.on ? 'Runs on the finished frames, before the MP4 is written.' : `Off: the MP4 comes out at ${baseW} × ${baseH}.`} />
      {up.on && (
        <>
          <SegmentedControl fullWidth size="xs" value={up.method} onChange={(m) => set({ method: m as VideoUpscale['method'] })}
            data={[{ value: 'model', label: 'Upscale model' }, { value: 'resize', label: 'Plain resize' }]} />
          {up.method === 'model' && (
            <SelectField label="Model" value={up.model} onChange={(model) => set({ model })} data={data}
              description="SPAN 2x is the quickest; 4x models are sharper and much slower on 81 frames." />
          )}
          <SliderField label="Scale" value={up.scale} min={1.25} max={4} step={0.25} defaultValue={2} presets={[1.5, 2, 3, 4]}
            onChange={(scale) => set({ scale })} description={`${baseW} × ${baseH} → ${w} × ${h}`}
            ends={['Small file, quick', 'Big file, slow']} />
          <SelectField label={up.method === 'model' ? 'Resize to exact size with' : 'Interpolation'} value={up.resizeMethod}
            onChange={(resizeMethod) => set({ resizeMethod: resizeMethod as VideoUpscale['resizeMethod'] })}
            data={['lanczos', 'bicubic', 'bilinear', 'area', 'nearest-exact']} />
        </>
      )}
    </Stack>
  );
}

// ── Finish & encode ─────────────────────────────────────────────────────────

export function ColorMatchBlock() {
  const v = useVideo();
  const cm = v.colorMatch;
  const setCm = (p: Partial<typeof cm>) => v.set({ colorMatch: { ...cm, ...p } });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="Colour match to the start image" checked={cm.on} onChange={(on) => setCm({ on })}
          description="Pulls every frame's colours back to the start picture (KJNodes Color Match), against the drift and wash-out of image to video." />
        {cm.on && (
          <>
            <SelectField label="Method" value={cm.method} onChange={(method) => setCm({ method: method as ColorMatchMethod })} data={[...COLOR_MATCH_METHODS]} searchable={false}
              description="mkl is the fast default; hm-mvgd-hm is the most faithful; reinhard_lab_gpu runs on the GPU." />
            <StrengthControl label="Strength" value={cm.strength} min={0} max={1.5} step={0.05} chips={[0.5, 0.8, 1]} color="teal" onChange={(strength) => setCm({ strength })}
              ends={['Light touch, colours may drift', 'Locks to the start colours']} />
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function InterpolateBlock() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const ip = v.interpolate;
  const setIp = (p: Partial<typeof ip>) => v.set({ interpolate: { ...ip, ...p } });
  const out = outputFrames(v);
  const installed = server.interpolationModels ?? [];
  const ordered = [...INTERPOLATION_MODELS.filter((m) => installed.includes(m)), ...installed.filter((m) => !INTERPOLATION_MODELS.includes(m))];
  const ipData = ordered.map((m) => ({ value: m, label: modelLabel(m) }));
  if (ip.model && !installed.includes(ip.model)) ipData.unshift({ value: ip.model, label: `${modelLabel(ip.model)} (not installed)` });
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <ToggleField label="Frame interpolation (RIFE / FILM)" checked={ip.on} onChange={(on) => setIp({ on })}
          description={ip.on
            ? `${clipFrames(v)} → ${out.frames} frames, saved at ${out.fps} fps: the same seconds, ${ip.multiplier}× smoother. Runs after the upscale.`
            : `Doubles or more the frames after rendering, so ${v.engine === 'h3' ? '24 fps plays as 48' : '16 fps plays as 32'}. Cheap (seconds) and a big win for anime pans; costs nothing in sampling.`} />
        {ip.on && (
          <>
            <SegmentedControl fullWidth size="xs" value={String(ip.multiplier)} onChange={(m) => setIp({ multiplier: Number(m) })}
              data={[2, 3, 4].map((m) => ({ value: String(m), label: `${m}× → ${(v.engine === 'h3' ? H3_FPS : v.fps) * m} fps` }))} />
            <SelectField label="Model" value={ip.model} onChange={(model) => setIp({ model })} data={ipData}
              description="RIFE 4.26 is the pick; lite is quicker; heavy is sharper on big motion; FILM handles larger jumps but is slower." />
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function EncodeBlock() {
  const v = useVideo();
  const enc = v.encode;
  const setEnc = (p: Partial<VideoEncode>) => {
    const next = { ...enc, ...p };
    if (!CONTAINER_CODECS[next.container].includes(next.codec)) next.codec = CONTAINER_CODECS[next.container][0];
    v.set({ encode: next });
  };
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <Text size="sm" fw={500}>File</Text>
        <Group grow>
          <SegmentedControl size="xs" value={enc.container} onChange={(container) => setEnc({ container: container as VideoEncode['container'] })}
            data={[{ value: 'mp4', label: 'MP4' }, { value: 'mkv', label: 'MKV' }, { value: 'webm', label: 'WebM' }]} />
          <SegmentedControl size="xs" value={enc.codec} onChange={(codec) => setEnc({ codec: codec as VideoEncode['codec'] })}
            data={CONTAINER_CODECS[enc.container].map((c) => ({ value: c, label: c === 'h264' ? 'H.264' : 'AV1' }))} />
        </Group>
        <Switch size="xs" checked={enc.crf != null} label={<Text size="xs">Set the quality (CRF)</Text>}
          onChange={(e) => setEnc({ crf: e.currentTarget.checked ? (enc.codec === 'av1' ? 30 : 23) : null })} />
        {enc.crf != null && (
          <SliderField label="CRF" value={enc.crf} min={0} max={enc.codec === 'av1' ? 63 : 51} step={1} defaultValue={enc.codec === 'av1' ? 30 : 23} presets={enc.codec === 'av1' ? [20, 30, 40] : [15, 18, 23, 28]}
            onChange={(crf) => setEnc({ crf })} description="Lower is better and bigger. H.264 18 is near lossless to the eye; the default is 23 (AV1: 30)."
            ends={['Best quality, big file', 'Small file, blocky']} />
        )}
        <Text size="xs" c="dimmed">MP4 H.264 plays everywhere, the browser included. AV1 is half the size at the same look but slower to write; WebM is AV1 only.</Text>
      </Stack>
    </Paper>
  );
}

function FinishSection() {
  const v = useVideo();
  return (
    <Stack gap="sm">
      {isI2v(v) && <ColorMatchBlock />}
      <InterpolateBlock />
      <EncodeBlock />
    </Stack>
  );
}

/** Wan's files are not in the image's models.txt yet: say which ones the server lacks. */
export function MissingFiles() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const missing = missingVideoFiles(v, server);
  if (!missing.length) return null;
  return (
    <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />} p="xs" title="Not on the server yet">
      <Text size="xs">{missing.map(modelLabel).join(', ')}</Text>
      <Text size="xs" c="dimmed" mt={4}>
        {v.engine === 'h3'
          ? 'Hugging Face Comfy-Org/MiniMax-H3 (diffusion_models, text_encoders, vae, loras); the model browser downloads by URL.'
          : `Links are in the note of ImageLabDocker's workflows/Wan 2.2 ${v.mode === 't2v' ? 'T2V' : 'I2V'} A14B.json.`}
      </Text>
    </Alert>
  );
}

export type { VideoSettings };
