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
import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Collapse, Group, Loader, Paper, SegmentedControl, Stack, Switch, Text, Textarea, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle, IconArrowBackUp, IconChevronDown, IconChevronUp, IconPlayerPlay, IconPlayerStop, IconPlus, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { buildWanGraph, isVideoName, wanLength, type VideoMode } from '@/lib/wanGraph';
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
      let seed = st.seed;
      if (st.randomizeSeed) { seed = randomVideoSeed(); st.set({ seed }); }
      return { graph: buildWanGraph({ ...st, seed }, st.startImage || null) };
    },
    // Only videos: the same server's images belong to the other views.
    keep: (img) => isVideoName(img.filename),
  });
}

export function VideoView() {
  const host = useStudioHost();
  const isDesktop = useIsDesktop();
  const run = useVideoRun(host);

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
            <VideoGenerateBar run={run} />
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
        <VideoGenerateBar run={run} />
      </footer>
    </div>
  );
}

function VideoGenerateBar({ run }: { run: StudioRun }) {
  return (
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
      <SliderField label="Steps" value={v.steps} min={2} max={60} step={1} defaultValue={20} presets={[8, 20, 30]}
        onChange={(steps) => v.set({ steps, switchStep: Math.min(v.switchStep, steps) })} />
      <SliderField label="Switch to low-noise at step" value={v.switchStep} min={0} max={v.steps} step={1} defaultValue={10}
        description="The high-noise expert lays out motion and layout; the low-noise one adds detail."
        onChange={(switchStep) => v.set({ switchStep })} />
      <SliderField label="CFG" value={v.cfg} min={1} max={10} step={0.1} defaultValue={3.5} presets={[1, 3.5, 5]} onChange={(cfg) => v.set({ cfg })} />
      <SliderField label="Shift" value={v.shift} min={1} max={16} step={0.5} defaultValue={8} presets={[5, 8]} onChange={(shift) => v.set({ shift })} />
      <SelectField label="Sampler" value={v.sampler} onChange={(sampler) => v.set({ sampler })} data={samplers} />
      <SelectField label="Scheduler" value={v.scheduler} onChange={(scheduler) => v.set({ scheduler })} data={schedulers} />
      <SeedField value={v.seed} onChange={(seed) => v.set({ seed })} auto={v.randomizeSeed} onAutoChange={(randomizeSeed) => v.set({ randomizeSeed })} />
    </Section>
  );
}

/** Wan's files are not in the image's models.txt yet: say which ones the server lacks. */
function MissingFiles() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const files = v.models[v.mode];
  const missing = [
    ...[files.high, files.low].filter((f) => !server.diffusionModels.includes(f)),
    ...(server.textEncoders.includes(v.textEncoder) ? [] : [v.textEncoder]),
    ...(server.vaes.includes(v.vae) ? [] : [v.vae]),
  ];
  if (!missing.length || !server.models.length) return null;
  return (
    <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />} p="xs" title="Not on the server yet">
      <Text size="xs">{missing.map(modelLabel).join(', ')}</Text>
      <Text size="xs" c="dimmed" mt={4}>Links are in the note of ImageLabDocker's workflows/Wan 2.2 {v.mode === 't2v' ? 'T2V' : 'I2V'} A14B.json.</Text>
    </Alert>
  );
}
