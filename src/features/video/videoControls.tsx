/**
 * The video mode's pinned controls and helpers, shared by the desktop and phone shells: the seed
 * row, the time-estimate line under Generate, the "Wan's defaults" reset, the preset chips, the
 * sweep ("vary one setting across N runs") row, and the hook that swaps a missing Wan file for its
 * installed stand-in.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Menu, NumberInput, Select, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconBookmark, IconDeviceFloppy, IconDice5, IconDotsVertical, IconPlayerPlay, IconPlayerStop, IconTrash } from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import { ChipPicker, type Chip } from '@/components/blocks';
import { useStore } from '@/lib/store';
import { buildWanGraph, pickInstalledWanFiles, wanRunShape } from '@/lib/wanGraph';
import { estimateRun, formatDuration } from '@/lib/videoEstimate';
import { matchesPreset } from '@/lib/videoPresets';
import { SWEEP_AXES, sweepItems, type SweepAxis } from '@/lib/videoSweep';
import { StepperInput } from '@/components/fields';
import { useHostTimings } from './videoTimings';
import { useVideo, videoSettingsOf } from './videoStore';
import { useVideoPresets } from './videoPresets';
import { useVideoRun } from './videoRun';
import { useVideoSweep } from './videoSweep';

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
 * made when it started, counted down. During a sweep it says which run this is.
 */
export function useVideoEstimateLine(host: string | null, busy: boolean): string {
  const estimate = useVideoEstimate(host);
  const sweep = useVideoSweep(useShallow((s) => (s.current ? { label: s.current.label, done: s.total - s.queue.length, total: s.total } : null)));
  const [started, setStarted] = useState<{ at: number; ms: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) { setStarted(null); return; }
    setStarted((s) => s ?? (estimate ? { at: Date.now(), ms: estimate.ms } : null));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const prefix = sweep ? `Sweep ${sweep.done}/${sweep.total} · ${sweep.label} · ` : '';
  if (busy) {
    if (!started) return `${prefix}Timing this run to estimate the next ones`;
    const left = started.ms - (now - started.at);
    return prefix + (left > 0 ? `About ${formatDuration(left)} left` : 'Taking longer than the estimate');
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

// ── Presets ─────────────────────────────────────────────────────────────────

/** Named recipes as chips: tap to apply, the filled one is the recipe in use. Save adds the
 *  current settings; the menu on a chip overwrites, renames or deletes it. */
export function VideoPresetRow({ large }: { large?: boolean }) {
  const v = useVideo();
  const presets = useVideoPresets((s) => s.presets);
  const activeId = useVideoPresets((s) => s.activeId);
  const { save, overwrite, apply, rename, remove } = useVideoPresets.getState();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const settings = videoSettingsOf(v);
  const chips: Chip[] = presets.map((p) => ({ id: p.id, label: p.name, selected: matchesPreset(settings, p), color: p.id === activeId ? undefined : 'gray', title: `Saved ${new Date(p.savedAt).toLocaleString()}` }));
  const active = presets.find((p) => p.id === activeId);

  const commit = () => { save(name); setName(''); setNaming(false); };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Text size="xs" fw={600} c="dimmed" className="flex items-center gap-1"><IconBookmark size={13} /> Presets</Text>
        <Group gap={4} wrap="nowrap">
          {active && !matchesPreset(settings, active) && (
            <Tooltip label={`Overwrite "${active.name}" with the current settings`}>
              <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconDeviceFloppy size={13} />} onClick={() => overwrite(active.id)}>Update</Button>
            </Tooltip>
          )}
          <Button size="compact-xs" variant="light" onClick={() => setNaming((o) => !o)}>Save as…</Button>
          {active && (
            <Menu position="bottom-end" withinPortal shadow="md">
              <Menu.Target><ActionIcon size="sm" variant="subtle" color="gray" aria-label="Preset actions"><IconDotsVertical size={14} /></ActionIcon></Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{active.name}</Menu.Label>
                <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={() => overwrite(active.id)}>Overwrite with current settings</Menu.Item>
                <Menu.Item onClick={() => { const n = window.prompt('Preset name', active.name); if (n != null) rename(active.id, n); }}>Rename…</Menu.Item>
                <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(active.id)}>Delete</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </div>
      {naming && (
        <Group gap={6} wrap="nowrap">
          <TextInput size="xs" value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Name, e.g. Anime crisp 6-step" autoFocus style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setNaming(false); }} aria-label="Preset name" />
          <Button size="xs" onClick={commit}>Save</Button>
        </Group>
      )}
      {chips.length
        ? <ChipPicker items={chips} onPick={apply} large={large} />
        : <Text size="xs" c="dimmed">A preset keeps the recipe (models, sampling, guidance, finish), not the prompt, the pictures or the seed.</Text>}
    </div>
  );
}

// ── Sweeps ──────────────────────────────────────────────────────────────────

/**
 * "Vary one setting across N runs": pick the knob and a range, and N videos queue one after the
 * other with the seed held, each labelled with its value. Fast off / on follows the knob.
 */
export function VideoSweepRow({ host }: { host: string | null }) {
  const v = useVideo();
  const busy = useVideoRun((s) => s.busy);
  const sweep = useVideoSweep(useShallow((s) => ({ current: s.current, left: s.queue.length, total: s.total })));
  const [axis, setAxis] = useState<SweepAxis>('seed');
  const info = SWEEP_AXES.find((a) => a.id === axis) ?? SWEEP_AXES[0];
  const [range, setRange] = useState<Record<string, { from: number; to: number; count: number }>>({});
  const r = range[axis] ?? { from: axis === 'seed' ? v.seed : info.from, to: info.to, count: 4 };
  const setR = (p: Partial<typeof r>) => setRange((all) => ({ ...all, [axis]: { ...r, ...p } }));
  const items = useMemo(() => sweepItems(videoSettingsOf(v), axis, r.from, r.to, r.count), [v, axis, r.from, r.to, r.count]);
  const running = !!sweep.current;
  const options = SWEEP_AXES.map((a) => ({ value: a.id, label: a.label + (a.needsFast === true ? ' (Fast)' : a.needsFast === false ? ' (Fast off)' : '') }));

  return (
    <div className="flex flex-col gap-2">
      <Group gap={6} wrap="nowrap" align="flex-end">
        <Select size="xs" label="Vary" value={axis} onChange={(a) => { if (a) setAxis(a as SweepAxis); }} data={options} allowDeselect={false} style={{ flex: 1.4, minWidth: 0 }} aria-label="Setting to vary" />
        <NumberInput size="xs" label={axis === 'seed' ? 'From seed' : 'From'} value={r.from} onChange={(n) => setR({ from: Number(n) || 0 })} min={info.min} max={info.max} step={info.step} decimalScale={3} style={{ flex: 1, minWidth: 0 }} aria-label="From" />
        {axis !== 'seed' && <NumberInput size="xs" label="To" value={r.to} onChange={(n) => setR({ to: Number(n) || 0 })} min={info.min} max={info.max} step={info.step} decimalScale={3} style={{ flex: 1, minWidth: 0 }} aria-label="To" />}
        <NumberInput size="xs" label="Runs" value={r.count} onChange={(n) => setR({ count: Math.max(1, Math.min(12, Number(n) || 1)) })} min={1} max={12} step={1} style={{ width: 64 }} aria-label="Runs" />
      </Group>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed" truncate style={{ flex: 1, minWidth: 0 }}>
          {running
            ? `Sweep ${sweep.total - sweep.left}/${sweep.total} · ${sweep.current?.label}`
            : items.length ? `${items.length} run${items.length === 1 ? '' : 's'}: ${items.map((i) => i.label.replace(`${info.label} `, '')).join(', ')} · seed held` : 'Nothing to run'}
        </Text>
        {running
          ? <Button size="xs" color="red" variant="light" leftSection={<IconPlayerStop size={14} />} onClick={() => { useVideoSweep.getState().cancel(); void useVideoRun.getState().cancel(); }}>Stop sweep</Button>
          : <Button size="xs" variant="light" leftSection={<IconPlayerPlay size={14} />} disabled={!host || busy || !items.length}
            onClick={() => { if (host) void useVideoSweep.getState().start(host, items); }}>Run {items.length}</Button>}
      </Group>
    </div>
  );
}

/** The sweep label of a result, if a sweep made it ("CFG 3.5"). */
export function useResultLabel(url: string | null | undefined): string | undefined {
  return useVideoSweep((s) => (url ? s.labels[url] : undefined));
}
