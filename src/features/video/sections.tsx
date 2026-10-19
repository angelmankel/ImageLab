/**
 * The Video view's settings sections — what each one renders, its name and icon, and its live
 * status (`lib/videoSections.ts`). The desktop shows them as folding cards, phones as a
 * `SettingsPager` list; the controls inside are the same either way.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Collapse, Group, Paper, SegmentedControl, Stack, Switch, Text, Textarea, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle, IconArrowsMaximize, IconAspectRatio, IconBolt, IconBox, IconChevronDown, IconChevronUp, IconMessageCircle,
  IconPhotoVideo, IconPlus, IconStack2, IconX, type Icon as TablerIcon,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { FAST, hasSpeedInside, upscaledSize, wanLength, type VideoMode, type VideoUpscale } from '@/lib/wanGraph';
import { missingVideoFiles, videoSeconds, videoSectionStatus, type VideoSectionId, type VideoSectionStatus } from '@/lib/videoSections';
import { DimensionsField, SelectField, SliderField, StrengthControl } from '@/components/fields';
import type { PresetGroup } from '@/components/fields/DimensionsField';
import { ModelSelectorModal } from '@/components/models/ModelSelectorModal';
import { modelLabel } from '@/components/models/modelInfo';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import { ImageInput } from '@/features/studio/ImageInput';
import type { WorkflowParam } from '@/features/studio/params';
import { useVideo } from './videoStore';

export const VIDEO_SECTION_META: Record<VideoSectionId, { title: string; icon: TablerIcon }> = {
  mode: { title: 'Mode & input', icon: IconPhotoVideo },
  prompt: { title: 'Prompt', icon: IconMessageCircle },
  models: { title: 'Models', icon: IconBox },
  loras: { title: 'LoRAs', icon: IconStack2 },
  size: { title: 'Size & length', icon: IconAspectRatio },
  speed: { title: 'Speed & sampling', icon: IconBolt },
  upscale: { title: 'Upscale', icon: IconArrowsMaximize },
};

/** Every section's status, recomputed when the settings or the server lists change. */
export function useVideoSectionStatus(): Record<VideoSectionId, VideoSectionStatus> {
  const v = useVideo();
  const server = useStore((s) => s.server);
  return useMemo(() => videoSectionStatus(v, server), [v, server]);
}

export function VideoSectionBody({ id, host }: { id: VideoSectionId; host: string }): ReactNode {
  switch (id) {
    case 'mode': return <ModeSection host={host} />;
    case 'prompt': return <PromptSection />;
    case 'models': return <ModelsSection />;
    case 'loras': return <LorasSection />;
    case 'size': return <SizeSection />;
    case 'speed': return <SpeedSection />;
    case 'upscale': return <UpscaleSection />;
  }
}

/** Wan sizes: 480p and 720p buckets, multiples of 16. */
const WAN_PRESETS: PresetGroup[] = [
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

function ModeSection({ host }: { host: string }) {
  const v = useVideo();
  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={v.mode}
        onChange={(m) => v.set({ mode: m as VideoMode })}
        data={[{ value: 't2v', label: 'Text → Video' }, { value: 'i2v', label: 'Image → Video' }]}
      />
      {v.mode === 'i2v' ? (
        <Stack gap={4}>
          <Text size="sm" fw={500}>Start image</Text>
          <ImageInput param={START_IMAGE} value={v.startImage} onChange={(ref) => v.set({ startImage: String(ref ?? '') })} host={host} />
        </Stack>
      ) : (
        <Text size="xs" c="dimmed">Image → Video starts from a picture of yours; Send to video on any image sets it.</Text>
      )}
    </Stack>
  );
}

function PromptSection() {
  const v = useVideo();
  const [negOpen, setNegOpen] = useState(false);
  return (
    <Stack gap="sm">
      <Textarea
        value={v.positive}
        onChange={(e) => v.set({ positive: e.currentTarget.value })}
        placeholder={v.mode === 'i2v' ? 'What happens: the motion, the camera…' : 'The scene, what moves, how the camera moves…'}
        autosize
        minRows={4}
        maxRows={12}
        aria-label="Prompt"
      />
      <UnstyledButton onClick={() => setNegOpen((o) => !o)} aria-expanded={negOpen}>
        <Group gap={4}>
          {negOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          <Text size="xs" c="dimmed">Negative prompt</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={negOpen}>
        <Textarea value={v.negative} onChange={(e) => v.set({ negative: e.currentTarget.value })} autosize minRows={3} maxRows={8} aria-label="Negative prompt"
          description="Wan was trained with this Chinese negative; English works too." />
      </Collapse>
    </Stack>
  );
}

function SizeSection() {
  const v = useVideo();
  return (
    <Stack gap="sm">
      <DimensionsField value={{ width: v.width, height: v.height }} onChange={({ width, height }) => v.set({ width, height })} presets={WAN_PRESETS} />
      <SliderField label="Length (frames)" value={v.length} min={5} max={161} step={4} defaultValue={81} presets={[33, 49, 81, 121]}
        onChange={(length) => v.set({ length: wanLength(length) })} description={`${videoSeconds(v)} s at ${v.fps} fps`} />
      <SliderField label="Frame rate" value={v.fps} min={8} max={30} step={1} defaultValue={16} presets={[16, 24]} onChange={(fps) => v.set({ fps })} />
    </Stack>
  );
}

/** A select over one server list; the chosen file stays listed (marked) even if it is missing. */
function FileSelect({ label, value, files, onChange }: { label: string; value: string; files: string[]; onChange: (v: string) => void }) {
  const missing = !!value && !files.includes(value);
  const data = [...(missing ? [{ value, label: `${modelLabel(value)} (not installed)` }] : []), ...files.map((f) => ({ value: f, label: modelLabel(f) }))];
  return (
    <SelectField label={label} value={value} onChange={onChange} data={data}
      rightSection={missing ? <Badge size="xs" color="orange" variant="light">missing</Badge> : undefined} />
  );
}

function ModelsSection() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const files = v.models[v.mode];
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">{v.mode === 't2v' ? 'Text' : 'Image'} → Video has its own pair of experts; installed stand-ins are picked for you.</Text>
      <FileSelect label="High-noise model" value={files.high} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'high', f)} />
      <FileSelect label="Low-noise model" value={files.low} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'low', f)} />
      <FileSelect label="Text encoder" value={v.textEncoder} files={server.textEncoders} onChange={(textEncoder) => v.set({ textEncoder })} />
      <FileSelect label="VAE" value={v.vae} files={server.vaes} onChange={(vae) => v.set({ vae })} />
    </Stack>
  );
}

function LorasSection() {
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
            <SegmentedControl size="xs" fullWidth value={l.expert} onChange={(expert) => v.updateLora(l.id, { expert: expert as typeof l.expert })}
              data={[{ value: 'high', label: 'High noise' }, { value: 'low', label: 'Low noise' }, { value: 'both', label: 'Both' }]} />
            <StrengthControl label="Strength" value={l.strength} min={0} max={3} step={0.05} chips={[0.5, 1, 1.5]} color="grape"
              onChange={(strength) => v.updateLora(l.id, { strength })} />
          </Stack>
        </Paper>
      ))}
      {!v.loras.length && <Text size="xs" c="dimmed">Wan 2.2 LoRAs come as a high-noise and a low-noise file; a name that says which starts on that expert.</Text>}
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

function SpeedSection() {
  const v = useVideo();
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  const files = v.models[v.mode];
  return (
    <Stack gap="sm">
      <Paper withBorder p="xs" radius="sm">
        <Stack gap="xs">
          <Switch
            checked={v.fast}
            onChange={(e) => v.set({ fast: e.currentTarget.checked })}
            label={<Text size="sm" fw={500}>Fast (4 steps)</Text>}
            description={`lightx2v speed LoRAs on both models (none on a model that has one inside), ${FAST.steps} steps at CFG ${FAST.cfg}: about 6× faster, nearly the same look. Off: the full steps and CFG below.`}
          />
          {v.fast && (
            <Stack gap={6} className="border-t border-border-default pt-2">
              {(['high', 'low'] as const).map((which) => (
                <Switch key={which} size="xs" checked={hasSpeedInside(v, files[which])}
                  onChange={(e) => v.set({ speedInside: { ...v.speedInside, [files[which]]: e.currentTarget.checked } })}
                  label={<Text size="xs">{which === 'high' ? 'High-noise' : 'Low-noise'} model has the speed LoRA inside</Text>} />
              ))}
              <Text size="xs" c="dimmed">Fast then adds no lightx2v LoRA to it: a second one makes the video worse. Guessed from the name (SmoothMix T2V, Lightning mixes).</Text>
            </Stack>
          )}
        </Stack>
      </Paper>
      <SliderField label="Steps" value={v.fast ? FAST.steps : v.steps} min={2} max={60} step={1} defaultValue={20} presets={[8, 20, 30]} disabled={v.fast}
        onChange={(steps) => v.set({ steps, switchStep: Math.min(v.switchStep, steps) })} />
      <SliderField label="Switch to low-noise at step" value={v.fast ? FAST.switchStep : v.switchStep} min={0} max={v.fast ? FAST.steps : v.steps} step={1} defaultValue={10} disabled={v.fast}
        description="The high-noise expert lays out motion and layout; the low-noise one adds detail."
        onChange={(switchStep) => v.set({ switchStep })} />
      <SliderField label="CFG" value={v.fast ? FAST.cfg : v.cfg} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 3.5, 5]} disabled={v.fast} onChange={(cfg) => v.set({ cfg })} />
      <SliderField label="Shift" value={v.shift} min={1} max={16} step={0.5} defaultValue={8} presets={[5, 8]} onChange={(shift) => v.set({ shift })} />
      <SelectField label="Sampler" value={v.sampler} onChange={(sampler) => v.set({ sampler })} data={samplers} />
      <SelectField label="Scheduler" value={v.scheduler} onChange={(scheduler) => v.set({ scheduler })} data={schedulers} />
    </Stack>
  );
}

/** Fast upscale models first; measured on the A100 (81 frames 832x480 -> 2x, incl. writing the
 *  MP4): resize 7 s, 2xNomosUni SPAN 12 s, 2x-AnimeSharpV4 Fast 20 s, 4x-ClearReality 33 s,
 *  RealESRGAN x4 anime 6B 57 s, 4x-UltraSharp 102 s. */
const FAST_UPSCALERS = ['2xNomosUni_span_multijpg.safetensors', '2x-AnimeSharpV4_Fast_RCAN_PU.safetensors', '4x-ClearRealityV1.safetensors'];

function UpscaleSection() {
  const v = useVideo();
  const models = useStore((s) => s.server.upscaleModels);
  const up = v.upscale;
  const set = (p: Partial<VideoUpscale>) => v.set({ upscale: { ...up, ...p } });
  const [w, h] = upscaledSize(v.width, v.height, up.scale);
  const ordered = [...FAST_UPSCALERS.filter((m) => models.includes(m)), ...models.filter((m) => !FAST_UPSCALERS.includes(m))];
  const data = ordered.map((m) => ({ value: m, label: `${modelLabel(m)}${FAST_UPSCALERS.includes(m) ? ' (fast)' : ''}` }));
  if (up.model && !models.includes(up.model)) data.unshift({ value: up.model, label: `${modelLabel(up.model)} (not installed)` });
  return (
    <Stack gap="sm">
      <Switch checked={up.on} onChange={(e) => set({ on: e.currentTarget.checked })} aria-label="Upscale the video"
        label={<Text size="sm" fw={500}>Upscale the video</Text>}
        description={up.on ? 'Runs on the finished frames, before the MP4 is written.' : `Off: the MP4 comes out at ${v.width} × ${v.height}.`} />
      {up.on && (
        <>
          <SegmentedControl fullWidth size="xs" value={up.method} onChange={(m) => set({ method: m as VideoUpscale['method'] })}
            data={[{ value: 'model', label: 'Upscale model' }, { value: 'resize', label: 'Plain resize' }]} />
          {up.method === 'model' && (
            <SelectField label="Model" value={up.model} onChange={(model) => set({ model })} data={data}
              description="SPAN 2x is the quickest; 4x models are sharper and much slower on 81 frames." />
          )}
          <SliderField label="Scale" value={up.scale} min={1.25} max={4} step={0.25} defaultValue={2} presets={[1.5, 2, 3, 4]}
            onChange={(scale) => set({ scale })} description={`${v.width} × ${v.height} → ${w} × ${h}`} />
          <SelectField label={up.method === 'model' ? 'Resize to exact size with' : 'Interpolation'} value={up.resizeMethod}
            onChange={(resizeMethod) => set({ resizeMethod: resizeMethod as VideoUpscale['resizeMethod'] })}
            data={['lanczos', 'bicubic', 'bilinear', 'area', 'nearest-exact']} />
        </>
      )}
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
      <Text size="xs" c="dimmed" mt={4}>Links are in the note of ImageLabDocker's workflows/Wan 2.2 {v.mode === 't2v' ? 'T2V' : 'I2V'} A14B.json.</Text>
    </Alert>
  );
}
