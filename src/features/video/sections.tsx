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
  IconMovie, IconPhotoVideo, IconPlus, IconStack2, IconWand, IconX, type Icon as TablerIcon,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import {
  COLOR_MATCH_METHODS, CONTAINER_CODECS, FAST, INTERPOLATION_MODELS, effectiveSampling, hasSpeedInside, outputFrames, upscaledSize, wanLength,
  type ColorMatchMethod, type VideoEncode, type VideoMode, type VideoSettings, type VideoUpscale, type WeightDtype,
} from '@/lib/wanGraph';
import { missingVideoFiles, videoSeconds, videoSectionStatus, type VideoSectionId, type VideoSectionStatus } from '@/lib/videoSections';
import { DimensionsField, SelectField, SliderField, StrengthControl, ToggleField } from '@/components/fields';
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
  switch (id) {
    case 'mode': return <ModeSection host={host} />;
    case 'prompt': return <PromptSection />;
    case 'models': return <ModelsSection />;
    case 'loras': return <LorasSection />;
    case 'size': return <SizeSection />;
    case 'speed': return <SpeedSection />;
    case 'guidance': return <GuidanceSection />;
    case 'upscale': return <UpscaleSection />;
    case 'finish': return <FinishSection />;
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

function ModeSection({ host }: { host: string }) {
  const v = useVideo();
  const [endOpen, setEndOpen] = useState(!!v.endImage);
  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={v.mode}
        onChange={(m) => v.set({ mode: m as VideoMode })}
        data={[{ value: 't2v', label: 'Text → Video' }, { value: 'i2v', label: 'Image → Video' }]}
      />
      {v.mode === 'i2v' ? (
        <>
          <Stack gap={4}>
            <Text size="sm" fw={500}>Start image</Text>
            <ImageInput param={START_IMAGE} value={v.startImage} onChange={(ref) => v.set({ startImage: String(ref ?? '') })} host={host} />
          </Stack>
          <Fold label={v.endImage ? 'End image (set)' : 'End image'} open={endOpen} onToggle={() => setEndOpen((o) => !o)}>
            <ImageInput param={END_IMAGE} value={v.endImage} onChange={(ref) => v.set({ endImage: String(ref ?? '') })} host={host} />
            <Text size="xs" c="dimmed">With an end image the clip travels from the first picture to the second (first/last frame mode, the same I2V models). Clear it to go back to plain Image → Video.</Text>
          </Fold>
        </>
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
      <Fold label="Negative prompt" open={negOpen} onToggle={() => setNegOpen((o) => !o)}>
        <Textarea value={v.negative} onChange={(e) => v.set({ negative: e.currentTarget.value })} autosize minRows={3} maxRows={8} aria-label="Negative prompt"
          description={v.fast && !v.guidance.nag.on ? 'At CFG 1 (Fast) the negative does nothing — turn on NAG under Guidance to make it count.' : 'Wan was trained with this Chinese negative; English works too.'} />
      </Fold>
    </Stack>
  );
}

function SizeSection() {
  const v = useVideo();
  return (
    <Stack gap="sm">
      <DimensionsField value={{ width: v.width, height: v.height }} onChange={({ width, height }) => v.set({ width, height })} presets={WAN_PRESETS} />
      <SliderField label="Length (frames)" value={v.length} min={5} max={161} step={4} defaultValue={81} presets={[33, 49, 81, 121]} ends={['Short clip, quick', 'Long clip, slow; may loop or drift']}
        onChange={(length) => v.set({ length: wanLength(length) })} description={`${videoSeconds(v)} s at ${v.fps} fps${v.interpolate.on ? ` · saved at ${outputFrames(v).fps} fps after interpolation` : ''}`} />
      <SliderField label="Frame rate" value={v.fps} min={8} max={30} step={1} defaultValue={16} presets={[16, 24]} onChange={(fps) => v.set({ fps })}
        ends={['Longer clip, slower motion', 'Shorter clip, faster motion']} />
    </Stack>
  );
}

/** A select over one server list; the chosen file stays listed (marked) even if it is missing. */
function FileSelect({ label, value, files, onChange, description }: { label: string; value: string; files: string[]; onChange: (v: string) => void; description?: ReactNode }) {
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

function ModelsSection() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const files = v.models[v.mode];
  const gguf = /\.gguf$/i.test(files.high) && /\.gguf$/i.test(files.low);
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">{v.mode === 't2v' ? 'Text' : 'Image'} → Video has its own pair of experts; installed stand-ins are picked for you.</Text>
      <FileSelect label="High-noise model" value={files.high} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'high', f)} />
      <FileSelect label="Low-noise model" value={files.low} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'low', f)} />
      <FileSelect label="Text encoder" value={v.textEncoder} files={server.textEncoders} onChange={(textEncoder) => v.set({ textEncoder })} />
      <FileSelect label="VAE" value={v.vae} files={server.vaes} onChange={(vae) => v.set({ vae })} />
      <SelectField label="Weight dtype" value={v.weightDtype} onChange={(weightDtype) => v.set({ weightDtype: weightDtype as WeightDtype })} data={WEIGHT_DTYPES} searchable={false} disabled={gguf}
        description={gguf ? 'GGUF models carry their own quantisation.' : 'How UNETLoader holds the weights. fp8 fast uses the GPU\'s fp8 matmul: quicker, a touch less exact.'} />
    </Stack>
  );
}

const LORA_ENDS = ['Weaker effect', 'Stronger, may break the look'] as const;

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
            <StrengthControl label={l.expert === 'both' && l.strengthLow != null ? 'Strength (high)' : 'Strength'} value={l.strength} min={0} max={3} step={0.05} chips={[0.5, 1, 1.5]} color="grape" ends={LORA_ENDS}
              onChange={(strength) => v.updateLora(l.id, { strength })} />
            {l.expert === 'both' && (
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

/** What the low and high end of the shared sliders do. */
const STEPS_ENDS = ['Quicker, rougher', 'More detail, slower'] as const;
const SWITCH_ENDS = ['Less motion, more detail', 'More motion, less detail'] as const;
const CFG_ENDS = ['Looser, softer colours', 'Follows the prompt, may burn'] as const;

function SpeedSection() {
  const v = useVideo();
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  const serverLoras = useStore((s) => s.server.loras);
  const files = v.models[v.mode];
  const fr = v.fastRecipe;
  const setFr = (p: Partial<typeof fr>) => v.set({ fastRecipe: { ...fr, ...p } });
  const eff = effectiveSampling(v);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [speedLorasOpen, setSpeedLorasOpen] = useState(false);
  const setFastLora = (which: 'high' | 'low', file: string) => v.set({ fastLoras: { ...v.fastLoras, [v.mode]: { ...v.fastLoras[v.mode], [which]: file } } });
  return (
    <Stack gap="sm">
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
      <SliderField label="Steps" value={v.fast ? fr.steps : v.steps} min={2} max={60} step={1} defaultValue={20} presets={[8, 20, 30]} disabled={v.fast}
        onChange={(steps) => v.set({ steps, switchStep: Math.min(v.switchStep, steps) })} ends={STEPS_ENDS} />
      <SliderField label="Switch to low-noise at step" value={v.fast ? fr.switchStep : v.switchStep} min={0} max={v.fast ? fr.steps : v.steps} step={1} defaultValue={10} disabled={v.fast}
        description="The high-noise expert lays out motion and layout; the low-noise one adds detail."
        onChange={(switchStep) => v.set({ switchStep })} ends={SWITCH_ENDS} />
      <SliderField label={v.cfgLow == null ? 'CFG' : 'CFG · high noise'} value={v.fast ? fr.cfg : v.cfg} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 3.5, 5]} disabled={v.fast} onChange={(cfg) => v.set({ cfg })}
        ends={CFG_ENDS} />
      {!v.fast && (
        <Switch size="xs" checked={v.cfgLow != null} label={<Text size="xs">Own CFG for the low-noise expert</Text>}
          onChange={(e) => v.set({ cfgLow: e.currentTarget.checked ? v.cfg : null })} />
      )}
      {!v.fast && v.cfgLow != null && (
        <SliderField label="CFG · low noise" value={v.cfgLow} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 2, 3.5]} onChange={(cfgLow) => v.set({ cfgLow })}
          description="A lower CFG on the detail pass keeps colours from burning." ends={CFG_ENDS} />
      )}
      <SliderField label={v.shiftLow == null ? 'Shift' : 'Shift · high noise'} value={v.shift} min={1} max={16} step={0.5} defaultValue={8} presets={[5, 8]} onChange={(shift) => v.set({ shift })}
        description="Higher pushes more steps into the noisy phase: bigger motion, looser detail. lightx2v was distilled at 5; 8 is ComfyUI's template."
        ends={['Smaller motion, tighter detail', 'Bigger motion, looser detail']} />
      <Switch size="xs" checked={v.shiftLow != null} label={<Text size="xs">Own shift for the low-noise expert</Text>}
        onChange={(e) => v.set({ shiftLow: e.currentTarget.checked ? v.shift : null })} />
      {v.shiftLow != null && (
        <SliderField label="Shift · low noise" value={v.shiftLow} min={1} max={16} step={0.5} defaultValue={8} presets={[3, 5, 8]} onChange={(shiftLow) => v.set({ shiftLow })}
          ends={['Finer, crisper detail', 'Smoother, looser detail']} />
      )}
      <SelectField label="Sampler" value={v.sampler} onChange={(sampler) => v.set({ sampler })} data={samplers}
        description={v.fast ? 'euler / simple matches how lightx2v was distilled.' : 'euler, dpmpp_2m, res_multistep and uni_pc are the usual Wan picks.'} />
      <SelectField label="Scheduler" value={v.scheduler} onChange={(scheduler) => v.set({ scheduler })} data={schedulers} />
    </Stack>
  );
}

function GuidanceSection() {
  const v = useVideo();
  const g = v.guidance;
  const sp = v.speedups;
  const setNag = (p: Partial<typeof g.nag>) => v.set({ guidance: { ...g, nag: { ...g.nag, ...p } } });
  const setCache = (p: Partial<typeof sp.easyCache>) => v.set({ speedups: { ...sp, easyCache: { ...sp.easyCache, ...p } } });
  const setLong = (p: Partial<typeof v.longClip>) => v.set({ longClip: { ...v.longClip, ...p } });
  const eff = effectiveSampling(v);
  const cfg1 = eff.cfg <= 1 && eff.cfgLow <= 1 && eff.motionSteps === 0;
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">Model patches on both experts, all in ComfyUI itself. Each is off unless you turn it on.</Text>
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
      <ToggleField label="CFG-Zero*" checked={g.cfgZeroStar} onChange={(cfgZeroStar) => v.set({ guidance: { ...g, cfgZeroStar } })}
        description={cfg1 ? 'Only acts when a sampler runs CFG above 1 (Fast off, or the motion pass).' : 'Zero-inits the first step and rescales the guidance: cleaner colours at normal CFG, free.'} />
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
      <ToggleField label="torch.compile (inductor)" checked={sp.torchCompile} onChange={(torchCompile) => v.set({ speedups: { ...sp, torchCompile } })}
        description="Compiles both experts: the first run on a new size takes minutes longer, later ones ~1.2–1.5× faster while the server stays up. Unverified on the pod; turn off if a run errors." />
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
            onChange={(scale) => set({ scale })} description={`${v.width} × ${v.height} → ${w} × ${h}`}
            ends={['Small file, quick', 'Big file, slow']} />
          <SelectField label={up.method === 'model' ? 'Resize to exact size with' : 'Interpolation'} value={up.resizeMethod}
            onChange={(resizeMethod) => set({ resizeMethod: resizeMethod as VideoUpscale['resizeMethod'] })}
            data={['lanczos', 'bicubic', 'bilinear', 'area', 'nearest-exact']} />
        </>
      )}
    </Stack>
  );
}

function FinishSection() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const cm = v.colorMatch;
  const ip = v.interpolate;
  const enc = v.encode;
  const setCm = (p: Partial<typeof cm>) => v.set({ colorMatch: { ...cm, ...p } });
  const setIp = (p: Partial<typeof ip>) => v.set({ interpolate: { ...ip, ...p } });
  const setEnc = (p: Partial<VideoEncode>) => {
    const next = { ...enc, ...p };
    if (!CONTAINER_CODECS[next.container].includes(next.codec)) next.codec = CONTAINER_CODECS[next.container][0];
    v.set({ encode: next });
  };
  const out = outputFrames(v);
  const installed = server.interpolationModels ?? [];
  const ordered = [...INTERPOLATION_MODELS.filter((m) => installed.includes(m)), ...installed.filter((m) => !INTERPOLATION_MODELS.includes(m))];
  const ipData = ordered.map((m) => ({ value: m, label: modelLabel(m) }));
  if (ip.model && !installed.includes(ip.model)) ipData.unshift({ value: ip.model, label: `${modelLabel(ip.model)} (not installed)` });
  return (
    <Stack gap="sm">
      {v.mode === 'i2v' && (
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
      )}
      <Paper withBorder p="xs" radius="sm">
        <Stack gap="xs">
          <ToggleField label="Frame interpolation (RIFE / FILM)" checked={ip.on} onChange={(on) => setIp({ on })}
            description={ip.on
              ? `${wanLength(v.length)} → ${out.frames} frames, saved at ${out.fps} fps: the same seconds, ${ip.multiplier}× smoother. Runs after the upscale.`
              : `Doubles or more the frames after rendering, so 16 fps plays as 32. Cheap (seconds) and a big win for anime pans; costs nothing in sampling.`} />
          {ip.on && (
            <>
              <SegmentedControl fullWidth size="xs" value={String(ip.multiplier)} onChange={(m) => setIp({ multiplier: Number(m) })}
                data={[2, 3, 4].map((m) => ({ value: String(m), label: `${m}× → ${v.fps * m} fps` }))} />
              <SelectField label="Model" value={ip.model} onChange={(model) => setIp({ model })} data={ipData}
                description="RIFE 4.26 is the pick; lite is quicker; heavy is sharper on big motion; FILM handles larger jumps but is slower." />
            </>
          )}
        </Stack>
      </Paper>
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

export type { VideoSettings };
