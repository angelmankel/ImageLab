import { StepperInput } from '@/components/fields/StepperInput';
import {
  IconArrowDown, IconArrowUp, IconArrowsMaximize, IconBackground, IconChevronDown, IconChevronRight,
  IconCopy, IconDice5, IconDimensions, IconPlus, IconSparkles, IconTrash, type Icon as TablerIcon,
} from '@tabler/icons-react';
import {
  ActionIcon, Badge, Button, Collapse, Group, Paper, SegmentedControl, Select, SimpleGrid,
  Stack, Switch, Text, ThemeIcon, Tooltip, UnstyledButton,
} from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import { createPass, listedPasses, withPipeline, PASS_LABELS, type PassKind } from '@/lib/pipeline';
import type { Pass } from '@/lib/types';
import { FieldWrapper } from '@/components/fields/FieldWrapper';
import { NumberField } from '@/components/fields/NumberField';
import { ControlSection } from './ControlSection';
import { ParamRow } from './ParamRow';

const MAX_SEED = 0xFFFFFFFF;
/** v1's upscale presets, plus a half-size step since a pass can also shrink. */
const SCALE_PRESETS = [0.5, 1, 1.25, 1.5, 2, 2.5, 3, 4];

const PASS_ICONS: Record<PassKind, TablerIcon> = {
  sample: IconSparkles, upscale: IconArrowsMaximize, resize: IconDimensions, 'remove-bg': IconBackground,
};

const passBlurb = (kind: PassKind, inpaintMode: boolean) =>
  kind === 'sample' ? inpaintMode ? 'Whole-image runs only' : 'Another sampling pass'
    : kind === 'upscale' ? 'Enlarge with a model'
      : kind === 'resize' ? 'Set the final size' : 'Make it transparent';

export function PipelinePanel({ inpaintMode = false }: { inpaintMode?: boolean }) {
  const workflow = useStore(s => s.workflow);
  const server = useStore(s => s.server);
  const setWorkflow = useStore(s => s.setWorkflow);
  const passes = listedPasses(workflow);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ pass: Pass; index: number } | null>(null);
  const save = (next: Pass[]) => setWorkflow(withPipeline(next));
  const update = (id: string, patch: Partial<Pass>) => save(passes.map(p => p.id === id ? { ...p, ...patch } : p));
  const move = (index: number, delta: number) => {
    const next = [...passes];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next);
  };
  const add = (kind: PassKind) => {
    const pass = createPass(workflow, kind, uid());
    pass.upscaleModel ||= server.upscaleModels[0] || '';
    save([...passes, pass]); setExpanded(pass.id); setAdding(false);
  };
  const duplicate = (pass: Pass, index: number) => {
    const clone = { ...pass, id: uid() };
    const next = [...passes];
    next.splice(index + 1, 0, clone);
    save(next); setExpanded(clone.id);
  };
  const remove = (pass: Pass, index: number) => {
    save(passes.filter(p => p.id !== pass.id));
    setRemoved({ pass, index });
  };

  return <ControlSection id="workspace-passes" title="Passes" icon={IconArrowsMaximize}
    summary={`${passes.filter(p => p.on !== false && !(inpaintMode && (!p.kind || p.kind === 'sample'))).length} after base image`}
    expandOn={adding}
    action={<Button size="compact-sm" variant={adding ? 'filled' : 'light'} leftSection={<IconPlus size={14} />}
      onClick={() => setAdding(!adding)} aria-label="Add pass" aria-expanded={adding}>Add pass</Button>}>
    <Stack gap="xs" pb="xs">
      {/* The base image is step 1 of the pipeline; the passes below number on from it. */}
      <Group gap="xs" wrap="nowrap" px={4}>
        <ThemeIcon size={22} radius="xl" variant="light"><Text size="xs" fw={600}>1</Text></ThemeIcon>
        <Text size="sm" fw={500}>Base image</Text>
        <Text size="xs" c="dimmed" ml="auto">{workflow.steps} steps</Text>
      </Group>

      <Collapse in={adding}>
        <SimpleGrid cols={2} spacing="xs" aria-label="Add a pass">
          {(Object.keys(PASS_LABELS) as PassKind[]).map(kind => {
            const Icon = PASS_ICONS[kind];
            const off = inpaintMode && kind === 'sample';
            return <UnstyledButton key={kind} aria-label={`Add ${PASS_LABELS[kind]} pass`} disabled={off} onClick={() => add(kind)}
              className="rounded-md border border-border-default bg-bg-input px-2.5 py-2 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40">
              <Group gap={6} wrap="nowrap"><Icon size={14} stroke={1.6} /><Text size="xs" fw={600}>{PASS_LABELS[kind]}</Text></Group>
              <Text size="10px" c="dimmed" mt={2}>{passBlurb(kind, inpaintMode)}</Text>
            </UnstyledButton>;
          })}
        </SimpleGrid>
      </Collapse>

      {!passes.length && !adding && <Text size="xs" c="dimmed" px={4}>Add refinement or finishing steps here. They run from top to bottom.</Text>}

      {passes.map((pass, index) => {
        const kind = pass.kind ?? 'sample';
        const Icon = PASS_ICONS[kind];
        const n = index + 2;
        const unavailable = inpaintMode && kind === 'sample';
        const enabled = pass.on !== false && !unavailable;
        const open = expanded === pass.id;
        const summary = kind === 'sample' ? `${pass.steps} steps · ${pass.denoise} denoise · ${pass.scale}×` : kind === 'remove-bg' ? 'Transparent background' : kind === 'resize' && pass.resizeMode === 'size' ? `${pass.width} × ${pass.height}` : `${pass.scale}×`;
        return <Paper key={pass.id} withBorder radius="md" bg="dark.6" style={{ opacity: enabled ? 1 : 0.6, overflow: 'hidden' }}>
          <Group gap="xs" wrap="nowrap" px="xs">
            <UnstyledButton aria-expanded={open} onClick={() => setExpanded(open ? null : pass.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left">
              {open ? <IconChevronDown size={14} className="shrink-0 opacity-50" /> : <IconChevronRight size={14} className="shrink-0 opacity-50" />}
              <Badge size="sm" circle variant="default">{n}</Badge>
              <Icon size={15} stroke={1.6} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <Text size="sm" fw={500} truncate>{PASS_LABELS[kind]}</Text>
                <Text size="xs" c="dimmed" truncate>{unavailable ? 'Not applied to inpainting' : summary}</Text>
              </span>
            </UnstyledButton>
            <Tooltip label={pass.on !== false ? 'Bypass this pass' : 'Turn this pass back on'}>
              <Switch size="sm" checked={pass.on !== false} onChange={e => update(pass.id, { on: e.currentTarget.checked })} aria-label={`Enable pass ${n}`} />
            </Tooltip>
          </Group>
          <Group gap={2} px={6} py={4} className="border-t border-border-subtle">
            <PassAction label="Move up" aria={`Move pass ${n} up`} disabled={index === 0} onClick={() => move(index, -1)}><IconArrowUp size={15} /></PassAction>
            <PassAction label="Move down" aria={`Move pass ${n} down`} disabled={index === passes.length - 1} onClick={() => move(index, 1)}><IconArrowDown size={15} /></PassAction>
            <PassAction label="Duplicate" aria={`Duplicate pass ${n}`} onClick={() => duplicate(pass, index)}><IconCopy size={15} /></PassAction>
            <div className="flex-1" />
            <PassAction label="Remove" aria={`Remove pass ${n}`} color="red" onClick={() => remove(pass, index)}><IconTrash size={15} /></PassAction>
          </Group>
          <Collapse in={open}>
            <Stack gap="sm" p="sm" className="border-t border-border-subtle">
              <PassFields pass={pass} update={patch => update(pass.id, patch)} />
            </Stack>
          </Collapse>
        </Paper>;
      })}

      {removed && <Group role="status" justify="space-between" px={4}>
        <Text size="xs" c="dimmed">Pass removed</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => { const next = [...passes]; next.splice(removed.index, 0, removed.pass); save(next); setRemoved(null); }}>Undo</Button>
      </Group>}
    </Stack>
  </ControlSection>;
}

function PassAction({ label, aria, onClick, disabled, color = 'gray', children }: {
  label: string; aria: string; onClick: () => void; disabled?: boolean; color?: string; children: ReactNode;
}) {
  return <Tooltip label={label}>
    <ActionIcon variant="subtle" color={color} size="md" onClick={onClick} disabled={disabled} aria-label={aria}>{children}</ActionIcon>
  </Tooltip>;
}

/** A labelled Mantine select that keeps the pass-specific aria-label. */
function PassSelect({ label, aria, value, options, onChange }: {
  label: string; aria: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return <FieldWrapper label={label}>
    <Select data={options} value={value} onChange={v => { if (v != null) onChange(v); }} allowDeselect={false} searchable
      aria-label={aria} comboboxProps={{ withinPortal: true }} maxDropdownHeight={300} />
  </FieldWrapper>;
}

function PassFields({ pass, update }: { pass: Pass; update: (patch: Partial<Pass>) => void }) {
  const server = useStore(s => s.server);
  const kind = pass.kind ?? 'sample';
  const models = [...new Set([pass.upscaleModel, ...server.upscaleModels].filter((m): m is string => !!m))];
  const modelField = <PassSelect label="Model" aria="Pass upscale model" value={pass.upscaleModel || ''} options={models} onChange={upscaleModel => update({ upscaleModel })} />;
  if (kind === 'remove-bg') return <Text size="xs" c="dimmed">Removes the background from the previous step’s image and keeps transparency.</Text>;
  return <>
    {kind === 'upscale' && modelField}
    {kind === 'resize' && <FieldWrapper label="Size by">
      <SegmentedControl fullWidth size="xs" value={pass.resizeMode || 'factor'} onChange={v => update({ resizeMode: v as Pass['resizeMode'] })} aria-label="Resize mode"
        data={[{ value: 'factor', label: 'Factor' }, { value: 'size', label: 'Size' }]} />
    </FieldWrapper>}
    {kind === 'resize' && pass.resizeMode === 'size'
      ? <SimpleGrid cols={2} spacing="xs">
        <FieldWrapper label="Width"><StepperInput value={pass.width || 1024} min={8} max={16384} step={8} onChange={width => update({ width })} aria-label="Pass width" styles={{ input: { textAlign: 'center' } }} /></FieldWrapper>
        <FieldWrapper label="Height"><StepperInput value={pass.height || 1024} min={8} max={16384} step={8} onChange={height => update({ height })} aria-label="Pass height" styles={{ input: { textAlign: 'center' } }} /></FieldWrapper>
      </SimpleGrid>
      : <ParamRow label="Scale" value={pass.scale} min={0.1} max={4} step={0.05} presets={SCALE_PRESETS} defaultValue={kind === 'sample' ? 1 : 2} format={v => `${v}×`} onChange={scale => update({ scale })} />}
    {kind !== 'resize' && <NumberField label="Max edge" description="Output long edge is capped here" value={pass.maxEdge} min={64} max={16384} step={64} onChange={maxEdge => update({ maxEdge })} />}
    {kind === 'resize' && <PassSelect label="Method" aria="Pass resize method" value={pass.resizeMethod || 'lanczos'} options={['lanczos', 'bicubic', 'bilinear', 'area', 'nearest-exact']} onChange={v => update({ resizeMethod: v as Pass['resizeMethod'] })} />}
    {kind === 'sample' && <>
      <ParamRow label="Steps" value={pass.steps} min={1} max={200} defaultValue={12} onChange={steps => update({ steps })} />
      <ParamRow label="CFG" value={pass.cfg} min={0} max={30} step={0.1} defaultValue={7} onChange={cfg => update({ cfg })} />
      <ParamRow label="Denoise" value={pass.denoise} min={0} max={1} step={0.01} defaultValue={0.3} onChange={denoise => update({ denoise })} />
      <PassSelect label="Sampler" aria="Pass sampler" value={pass.sampler} options={[...new Set([pass.sampler, ...server.samplers])]} onChange={sampler => update({ sampler })} />
      <PassSelect label="Scheduler" aria="Pass scheduler" value={pass.scheduler} options={[...new Set([pass.scheduler, ...server.schedulers])]} onChange={scheduler => update({ scheduler })} />
      {pass.scale !== 1 && <>
        <FieldWrapper label="Enlarge in">
          <SegmentedControl fullWidth size="xs" value={pass.upscaleMode || 'latent'} onChange={v => update({ upscaleMode: v as Pass['upscaleMode'] })} aria-label="Pass enlargement method"
            data={[{ value: 'latent', label: 'Latent' }, { value: 'model', label: 'Model' }]} />
        </FieldWrapper>
        {pass.upscaleMode === 'model' && modelField}
      </>}
      <FieldWrapper label="Seed" rightSection={
        <Switch size="xs" checked={pass.randomizeSeed} onChange={e => update({ randomizeSeed: e.currentTarget.checked })}
          label={<Text size="xs" c="dimmed">New seed each run</Text>} aria-label="New seed each run" />
      }>
        <Group gap="xs" wrap="nowrap">
          <StepperInput value={pass.seed} min={0} max={MAX_SEED} step={1} style={{ flex: 1 }}
            onChange={seed => update({ seed })} aria-label="Pass seed" styles={{ input: { textAlign: 'center' } }} />
          <Tooltip label="Randomize seed">
            <ActionIcon variant="light" size="lg" onClick={() => update({ seed: Math.floor(Math.random() * MAX_SEED) })} aria-label="Randomize pass seed"><IconDice5 size={16} /></ActionIcon>
          </Tooltip>
        </Group>
      </FieldWrapper>
    </>}
  </>;
}
