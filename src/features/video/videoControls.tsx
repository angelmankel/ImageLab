/**
 * The video mode's pinned controls and helpers, shared by the desktop and phone shells: the seed
 * row, the time-estimate line under Generate, the "Wan's defaults" reset, and the hook that swaps
 * a missing Wan file for its installed stand-in.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Switch, Text, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconDice5 } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { buildWanGraph, pickInstalledWanFiles, wanRunShape } from '@/lib/wanGraph';
import { estimateRun, formatDuration } from '@/lib/videoEstimate';
import { StepperInput } from '@/components/fields';
import { useHostTimings } from './videoTimings';
import { useVideo } from './videoStore';

/** The estimate for the current settings on this server, from its past runs. */
export function useVideoEstimate(host: string | null) {
  const v = useVideo();
  const runs = useHostTimings(host);
  return useMemo(() => {
    const shape = wanRunShape(buildWanGraph(v, v.startImage || 'x'));
    const last = runs.length ? runs[runs.length - 1].modelsKey : null;
    return estimateRun(runs, shape, last);
  }, [v, runs]);
}

/**
 * One line under Generate: the estimate for these settings, or — while a run goes — the estimate
 * made when it started, counted down.
 */
export function useVideoEstimateLine(host: string | null, busy: boolean): string {
  const estimate = useVideoEstimate(host);
  const [started, setStarted] = useState<{ at: number; ms: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) { setStarted(null); return; }
    setStarted((s) => s ?? (estimate ? { at: Date.now(), ms: estimate.ms } : null));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (busy) {
    if (!started) return 'Timing this run to estimate the next ones';
    const left = started.ms - (now - started.at);
    return left > 0 ? `About ${formatDuration(left)} left` : 'Taking longer than the estimate';
  }
  if (estimate) {
    return `About ${formatDuration(estimate.ms)}${estimate.parts.load > 0 ? ' (incl. loading models)' : ''} · from ${estimate.runs} run${estimate.runs === 1 ? '' : 's'}`
      + (estimate.partial ? ' · upscale time learned after its first run' : '');
  }
  return 'Time estimate after your first video on this server';
}

/** When a chosen Wan file is not on the server but one installed file clearly is its stand-in
 *  (SmoothMix's t2v High / Low, the umt5 encoder…), use that one. Mount once per shell. */
export function useInstalledWanFiles() {
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

/** Settings back to Wan's defaults; what you made stays. */
export function VideoResetRow() {
  const reset = useVideo((s) => s.resetSettings);
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="xs" c="dimmed">Prompt, start image and LoRAs stay.</Text>
      <Button size="xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={15} />} onClick={reset} aria-label="Reset video settings" className="shrink-0">
        Wan's defaults
      </Button>
    </Group>
  );
}

const MAX_SEED = 0xFFFFFFFF;

/** The seed row (as the image mode's footer has it). */
export function VideoSeedRow() {
  const seed = useVideo((s) => s.seed);
  const auto = useVideo((s) => s.randomizeSeed);
  const set = useVideo((s) => s.set);
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" w={32}>Seed</Text>
      <StepperInput value={seed} min={0} max={MAX_SEED} step={1} size="xs" style={{ flex: 1, minWidth: 0 }}
        onChange={(seed) => set({ seed })} aria-label="Seed"
        styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
      <Tooltip label="Randomize seed">
        <ActionIcon variant="light" color="gray" size="md" onClick={() => set({ seed: Math.floor(Math.random() * MAX_SEED) })} aria-label="Randomize seed"><IconDice5 size={15} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Pick a new seed for every generation">
        <Switch size="xs" checked={auto} onChange={(e) => set({ randomizeSeed: e.currentTarget.checked })} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
      </Tooltip>
    </Group>
  );
}
