/**
 * Video — Wan 2.2 A14B, text to video or image to video.
 *
 * Built from the parts the other views already use: the field components (sliders, selects,
 * seed, dimensions), Studio's image uploader, runner and result view (which plays video), and the
 * model picker for LoRAs. The graph is `lib/wanGraph.ts`, the same one as ImageLabDocker's
 * workflows/Wan 2.2 *.json. Its settings live in `videoStore`, apart from the generate view's.
 *
 * Desktop: controls on the left, the video on the right. Phone: the video on top, the controls
 * under it, Generate pinned to the bottom.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Collapse, Group, Loader, Paper, SegmentedControl, Stack, Switch, Text, Textarea, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle, IconArrowBackUp, IconChevronDown, IconChevronUp, IconPlayerPlay, IconPlayerStop, IconPlus, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { FAST, buildWanGraph, isVideoName, pickInstalledWanFiles, upscaledSize, wanLength, wanRunShape, wanRunTiming, type VideoMode, type VideoSettings, type VideoUpscale } from '@/lib/wanGraph';
import { estimateRun, formatDuration } from '@/lib/videoEstimate';
import { useHostTimings, useVideoTimings } from './videoTimings';
import type { ServerInfo } from '@/lib/types';
import { DimensionsField, FieldWrapper, SeedField, SelectField, SliderField, StrengthControl } from '@/components/fields';
import type { PresetGroup } from '@/components/fields/DimensionsField';
import { ModelSelectorModal } from '@/components/models/ModelSelectorModal';
import { modelLabel } from '@/components/models/modelInfo';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import { ImageInput } from '@/features/studio/ImageInput';
import { ResultView } from '@/features/studio/StudioPanels';
import { useStudioHost } from '@/features/studio/StudioView';
import { useComfyRun, type StudioRun } from '@/features/studio/useStudioRun';
import type { WorkflowParam } from '@/features/studio/params';
import { randomVideoSeed, useVideo } from './videoStore';

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
 *  name: the section heading already says what it is. */
const START_IMAGE: WorkflowParam = {
  id: 'video:start', nodeId: 9, nodeLabel: 'Start image', nodeType: 'LoadImage', name: '',
  type: 'COMBO', value: '', default: '', options: [], multiline: false, seedLike: false,
};

function useVideoRun(host: string | null): StudioRun {
  return useComfyRun(host, {
    build: async () => {
      const st = useVideo.getState();
      if (!st.positive.trim()) return { error: 'Write a prompt first.' };
      if (st.mode === 'i2v' && !st.startImage) return { error: 'Choose a start image first.' };
      const missing = missingVideoFiles(st, useStore.getState().server);
      if (missing.length) return { error: `Not on the server: ${missing.map(modelLabel).join(', ')}. Pick installed files under Models, or download these first.` };
      let seed = st.seed;
      if (st.randomizeSeed) { seed = randomVideoSeed(); st.set({ seed }); }
      return { graph: buildWanGraph({ ...st, seed }, st.startImage || null) };
    },
    // Only videos: the same server's images belong to the other views.
    keep: (img) => isVideoName(img.filename),
    // Every finished run teaches the time estimate.
    onFinished: ({ graph, nodeMs }) => {
      if (host) useVideoTimings.getState().record(host, wanRunTiming(graph as Parameters<typeof wanRunTiming>[0], nodeMs));
    },
  });
}

/** The estimate for the current settings on this server, from its past runs. */
function useVideoEstimate(host: string | null) {
  const v = useVideo();
  const runs = useHostTimings(host);
  return useMemo(() => {
    const shape = wanRunShape(buildWanGraph(v, v.startImage || 'x'));
    const last = runs.length ? runs[runs.length - 1].modelsKey : null;
    return estimateRun(runs, shape, last);
  }, [v, runs]);
}

/** When a chosen Wan file is not on the server but one installed file clearly is its stand-in
 *  (SmoothMix's t2v High / Low, the umt5 encoder…), use that one. */
function useInstalledWanFiles() {
  const mode = useVideo((s) => s.mode);
  const diffusionModels = useStore((s) => s.server.diffusionModels);
  const textEncoders = useStore((s) => s.server.textEncoders);
  const vaes = useStore((s) => s.server.vaes);
  useEffect(() => {
    if (!diffusionModels.length) return;
    const st = useVideo.getState();
    const patch = pickInstalledWanFiles(st, { diffusionModels, textEncoders, vaes });
    if (Object.keys(patch).length) st.set(patch);
  }, [mode, diffusionModels, textEncoders, vaes]);
}

export function VideoView() {
  const host = useStudioHost();
  const isDesktop = useIsDesktop();
  const run = useVideoRun(host);
  useInstalledWanFiles();

  if (!host) {
    return (
      <Stack h="100%" align="center" justify="center" gap={6} px="xl" ta="center">
        <Text size="sm" fw={500}>No ComfyUI server</Text>
        <Text size="xs" c="dimmed">Add one in Settings, then come back.</Text>
      </Stack>
    );
  }

  const result = (
    <ResultView
      results={run.results}
      latest={run.latest}
      busy={run.busy}
      status={run.status}
      progress={run.progress}
      currentNode={run.currentNode}
      preview={run.preview}
      queueRemaining={run.queueRemaining}
    />
  );
  const error = run.error && <Text size="xs" c="red.4" className="shrink-0">{run.error}</Text>;

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0">
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-border-subtle">
          {/* Block, not flex: a flex column would squash each section to fit instead of scrolling. */}
          <div className="scroll-y min-h-0 flex-1 px-3 py-3">
            <VideoControls host={host} />
          </div>
          <footer className="shrink-0 border-t border-border-subtle p-3">
            <VideoGenerateBar run={run} host={host} />
          </footer>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          {result}
          {error}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[42vh] shrink-0 flex-col gap-2 p-2">{result}</div>
      <div className="scroll-y min-h-0 flex-1 border-t border-border-subtle px-3 py-3">
        {error}
        <VideoControls host={host} />
      </div>
      <footer className="shrink-0 border-t border-border-subtle p-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <VideoGenerateBar run={run} host={host} />
      </footer>
    </div>
  );
}

function VideoGenerateBar({ run, host }: { run: StudioRun; host: string }) {
  const estimate = useVideoEstimate(host);
  // While a run goes: the estimate made when it started, counted down.
  const [started, setStarted] = useState<{ at: number; ms: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run.busy) { setStarted(null); return; }
    setStarted((s) => s ?? (estimate ? { at: Date.now(), ms: estimate.ms } : null));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  let line: string;
  if (run.busy) {
    if (!started) line = 'Timing this run to estimate the next ones';
    else {
      const left = started.ms - (now - started.at);
      line = left > 0 ? `About ${formatDuration(left)} left` : 'Taking longer than the estimate';
    }
  } else if (estimate) {
    line = `About ${formatDuration(estimate.ms)}${estimate.parts.load > 0 ? ' (incl. loading models)' : ''} · from ${estimate.runs} run${estimate.runs === 1 ? '' : 's'}`
      + (estimate.partial ? ' · upscale time learned after its first run' : '');
  } else {
    line = 'Time estimate after your first video on this server';
  }

  return (
    <Stack gap={6}>
    <Group gap="xs" wrap="nowrap">
      <Button
        aria-label="Generate video"
        onClick={() => void run.run()}
        disabled={run.busy}
        fullWidth
        size="md"
        leftSection={run.busy ? <Loader size="xs" color="white" /> : <IconPlayerPlay size="1rem" />}
        className="flex-1"
      >
        {run.busy ? (run.status ?? 'Working…') : 'Generate video'}
      </Button>
      {run.busy && (
        <Button variant="default" size="md" leftSection={<IconPlayerStop size="1rem" />} onClick={() => void run.cancel()} className="shrink-0">
          Stop
        </Button>
      )}
    </Group>
    <Text size="xs" c="dimmed" ta="center" className="tabular-nums">{line}</Text>
    </Stack>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: 0.6 }}>{title}</Text>
        {right}
      </Group>
      {children}
    </Stack>
  );
}

function VideoControls({ host }: { host: string }) {
  const v = useVideo();
  const [negOpen, setNegOpen] = useState(false);
  const seconds = (wanLength(v.length) / Math.max(1, v.fps)).toFixed(1);

  return (
    <Stack gap="lg">
      <SegmentedControl
        fullWidth
        value={v.mode}
        onChange={(m) => v.set({ mode: m as VideoMode })}
        data={[{ value: 't2v', label: 'Text → Video' }, { value: 'i2v', label: 'Image → Video' }]}
      />

      <MissingFiles />

      <Section title="Prompt">
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
      </Section>

      {v.mode === 'i2v' && (
        <Section title="Start image">
          <ImageInput param={START_IMAGE} value={v.startImage} onChange={(ref) => v.set({ startImage: String(ref ?? '') })} host={host} />
        </Section>
      )}

      <Section title="Video">
        <DimensionsField value={{ width: v.width, height: v.height }} onChange={({ width, height }) => v.set({ width, height })} presets={WAN_PRESETS} />
        <SliderField label="Length (frames)" value={v.length} min={5} max={161} step={4} defaultValue={81} presets={[33, 49, 81, 121]}
          onChange={(length) => v.set({ length: wanLength(length) })} description={`${seconds} s at ${v.fps} fps`} />
        <SliderField label="Frame rate" value={v.fps} min={8} max={30} step={1} defaultValue={16} presets={[16, 24]} onChange={(fps) => v.set({ fps })} />
      </Section>

      <ModelsSection />

      <SamplingSection />

      <UpscaleSection />
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
    <Section title="Upscale" right={
      <Switch size="sm" checked={up.on} onChange={(e) => set({ on: e.currentTarget.checked })} aria-label="Upscale the video"
        label={<Text size="xs" c="dimmed">{up.on ? `${w} × ${h}` : 'Off'}</Text>} labelPosition="left" />
    }>
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
    </Section>
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
  const availability = useResourceAvailability('lora');
  const [picking, setPicking] = useState(false);
  const files = v.models[v.mode];
  const toggleLora = (name: string) => {
    const found = v.loras.find((l) => l.name === name);
    if (found) v.removeLora(found.id); else v.addLora(name);
  };

  return (
    <Section title="Models">
      <FileSelect label="High-noise model" value={files.high} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'high', f)} />
      <FileSelect label="Low-noise model" value={files.low} files={server.diffusionModels} onChange={(f) => v.setModel(v.mode, 'low', f)} />
      <FileSelect label="Text encoder" value={v.textEncoder} files={server.textEncoders} onChange={(textEncoder) => v.set({ textEncoder })} />
      <FileSelect label="VAE" value={v.vae} files={server.vaes} onChange={(vae) => v.set({ vae })} />

      <FieldWrapper label="LoRAs" rightSection={<Badge size="sm" variant="light" color="grape">{v.loras.length}</Badge>}>
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
          <Button variant="light" color="grape" leftSection={<IconPlus size="1rem" />} onClick={() => setPicking(true)} fullWidth>Add LoRA</Button>
        </Stack>
      </FieldWrapper>
      <ModelSelectorModal
        opened={picking}
        onClose={() => setPicking(false)}
        kind="lora"
        models={server.loras}
        selectedModels={v.loras.map((l) => l.name)}
        onToggleModel={toggleLora}
        availability={availability}
        fitsType={{ label: 'Wan', fits: (bucket) => bucket === 'Wan Video' || bucket === 'Unknown' }}
      />
    </Section>
  );
}

function SamplingSection() {
  const v = useVideo();
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  return (
    <Section title="Sampling" right={
      <Tooltip label="Back to Wan's defaults (prompt, start image and LoRAs stay)" withArrow>
        <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Reset video settings" onClick={v.resetSettings}><IconArrowBackUp size={15} /></ActionIcon>
      </Tooltip>
    }>
      <Paper withBorder p="xs" radius="sm">
        <Switch
          checked={v.fast}
          onChange={(e) => v.set({ fast: e.currentTarget.checked })}
          label={<Text size="sm" fw={500}>Fast (4 steps)</Text>}
          description={`lightx2v speed LoRAs on both models, ${FAST.steps} steps at CFG ${FAST.cfg}: about 6× faster, nearly the same look. Off: the full steps and CFG below.`}
        />
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
      <SeedField value={v.seed} onChange={(seed) => v.set({ seed })} auto={v.randomizeSeed} onAutoChange={(randomizeSeed) => v.set({ randomizeSeed })} />
    </Section>
  );
}

/** The chosen files the server does not have (none while the server lists are still empty). */
function missingVideoFiles(v: VideoSettings, server: ServerInfo): string[] {
  if (!server.models.length) return [];
  const files = v.models[v.mode];
  return [
    ...[files.high, files.low].filter((f) => !server.diffusionModels.includes(f)),
    ...(server.textEncoders.includes(v.textEncoder) ? [] : [v.textEncoder]),
    ...(server.vaes.includes(v.vae) ? [] : [v.vae]),
    ...(v.fast ? [v.fastLoras[v.mode].high, v.fastLoras[v.mode].low].filter((f) => !server.loras.includes(f)) : []),
    ...(v.upscale.on && v.upscale.method === 'model' && !server.upscaleModels.includes(v.upscale.model) ? [v.upscale.model] : []),
  ];
}

/** Wan's files are not in the image's models.txt yet: say which ones the server lacks. */
function MissingFiles() {
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
