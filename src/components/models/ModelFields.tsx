/**
 * The Models section's fields, laid out as in v1's ModelPickerField: a label with a count badge,
 * the chosen models as a two-column grid of preview cards, and a tinted "Add …" button that opens
 * the full-screen ModelSelectorModal. Checkpoints are blue, LoRAs grape, as they were.
 *
 * Differences from v1 follow this app's graph: extra checkpoints merge into the first, so their
 * merge's ratio and each LoRA's model and CLIP strengths sit full-width under the tiles; the
 * VAE is a plain select with "built-in" as the empty choice.
 */
import { memo, useState, type ReactNode } from 'react';
import {
  ActionIcon, Badge, Box, Button, Group, Image, Paper, ScrollArea, SimpleGrid, Stack, Switch, Text,
} from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { TileHover } from '@/components/ui/TileHover';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import { useModelMetadataStore } from '@/features/model-metadata';
import { Select } from '@/components/ui/Select';
import { FieldWrapper } from '@/components/fields/FieldWrapper';
import { StrengthControl } from '@/components/fields/StrengthControl';
import { ModelSelectorModal } from './ModelSelectorModal';
import { modelLabel, plainDescription, useModelInfo } from './modelInfo';

async function refreshAllServers() {
  const st = useStore.getState();
  await Promise.all(st.servers.map((sv) => st.refreshServerInfo(sv.id)));
}

// ============================================
// SelectedModelCard — image-focused card
// ============================================

interface SelectedModelCardProps {
  fileName: string;
  isDisabled?: boolean;
  badge?: string;
  onRemove: () => void;
  onOpen: () => void;
  /** Bottom-strip controls under the name (LoRA on/off switch). */
  footer?: ReactNode;
}

const SelectedModelCard = memo(function SelectedModelCard({
  fileName, isDisabled, badge, onRemove, onOpen, footer,
}: SelectedModelCardProps) {
  const info = useModelInfo(fileName);
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = info.images[imageIndex];
  const label = modelLabel(fileName);
  const displayName = label.length > 25 ? label.slice(0, 22) + '...' : label;
  const description = plainDescription(info.description);

  const hoverInfo = (
    <Stack gap="xs">
      <Text size="sm" fw={600}>{info.name || label}</Text>
      {info.baseModel && <Badge size="xs" variant="light" color="blue">{info.baseModel}</Badge>}
      {description && (
        <ScrollArea.Autosize scrollbars="y" mah={120} type="auto" offsetScrollbars>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{description}</Text>
        </ScrollArea.Autosize>
      )}
      {info.trainedWords.length > 0 && (
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Trigger words:</Text>
          <Group gap={4}>
            {info.trainedWords.map((w, i) => <Badge key={i} size="xs" variant="outline" color="grape">{w}</Badge>)}
          </Group>
        </Box>
      )}
      {!info.resolved && <Text size="xs" c="dimmed">No metadata available</Text>}
      <Text size="xs" c="dimmed" lineClamp={1}>{fileName}</Text>
    </Stack>
  );

  return (
    <TileHover width={280} position="top" content={hoverInfo}>
        <Box
          style={{
            position: 'relative', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden',
            opacity: isDisabled ? 0.5 : 1, transition: 'opacity 0.2s', cursor: 'pointer', userSelect: 'none',
            border: '1px solid var(--mantine-color-dark-4)',
          }}
        >
          <Box style={{ aspectRatio: '1', position: 'relative', background: 'var(--mantine-color-dark-6)' }} onClick={onOpen}>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={label}
                h="100%"
                w="100%"
                fit="cover"
                onError={() => setImageIndex((i) => i + 1)}
              />
            ) : (
              <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text size="xs" c="dimmed">{info.resolved ? 'No preview' : 'Loading…'}</Text>
              </Box>
            )}

            <ActionIcon
              size="sm"
              variant="filled"
              color="dark"
              aria-label={`Remove ${label}`}
              style={{ position: 'absolute', top: 6, right: 6, opacity: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              <IconX size={14} />
            </ActionIcon>

            {(badge || info.baseModel) && (
              <Badge size="xs" variant="filled" color="dark" style={{ position: 'absolute', top: 6, left: 6, opacity: 0.9, maxWidth: 'calc(100% - 40px)' }}>
                {badge ?? info.baseModel}
              </Badge>
            )}

            <Box
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.95))',
                padding: '24px 8px 8px 8px',
              }}
            >
              <Text size="xs" fw={600} c="white" lineClamp={1} title={fileName}>{displayName}</Text>
              {footer && (
                <Group mt={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>{footer}</Group>
              )}
            </Box>
          </Box>
        </Box>
    </TileHover>
  );
});

const LORA_MAX = 5;
const LORA_CHIPS = [0.5, 1, 1.5, 2, 3];

/** One model's settings under the tiles: its name, then its controls at full panel width. */
function ModelSettings({ name, off, children }: { name: string; off?: boolean; children: ReactNode }) {
  return (
    <Paper withBorder p="xs" radius="sm" style={{ opacity: off ? 0.55 : 1 }}>
      <Stack gap="xs">
        <Text size="xs" fw={600} truncate title={name}>{modelLabel(name)}</Text>
        {children}
      </Stack>
    </Paper>
  );
}

// ============================================
// Picker blocks
// ============================================

function PickerBlock({ label, count, color, addLabel, emptyLabel, onAdd, children, settings }: {
  label: string; count: number; color: string; addLabel: string; emptyLabel: string; onAdd: () => void; children: ReactNode;
  /** Full-width controls under the tiles (strengths, merge ratios) — too cramped inside a half-width tile. */
  settings?: ReactNode;
}) {
  return (
    <FieldWrapper label={label} rightSection={<Badge size="sm" variant="light" color={color}>{count}</Badge>}>
      <Stack gap="xs">
        {count > 0 && <SimpleGrid cols={2} spacing="xs">{children}</SimpleGrid>}
        {settings}
        <Button variant="light" color={color} leftSection={<IconPlus size="1rem" />} onClick={onAdd} fullWidth>
          {addLabel}
        </Button>
        {count === 0 && <Text size="xs" c="dimmed" ta="center">{emptyLabel}</Text>}
      </Stack>
    </FieldWrapper>
  );
}

export function CheckpointsField() {
  const checkpoints = useStore((s) => s.workflow.checkpoints);
  const models = useStore((s) => s.server.models);
  const addCheckpoint = useStore((s) => s.addCheckpoint);
  const removeCheckpoint = useStore((s) => s.removeCheckpoint);
  const updateCheckpoint = useStore((s) => s.updateCheckpoint);
  const openForFile = useModelMetadataStore((s) => s.openForFile);
  const availability = useResourceAvailability('checkpoint');
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    const existing = checkpoints.find((c) => c.name === name);
    if (existing) removeCheckpoint(existing.id);
    else addCheckpoint(name);
  };

  return (
    <>
      <PickerBlock
        label="Checkpoints"
        count={checkpoints.length}
        color="blue"
        addLabel="Add Checkpoint"
        emptyLabel="No checkpoints selected"
        onAdd={() => setOpen(true)}
        settings={checkpoints.slice(1).map((c) => (
          <ModelSettings key={c.id} name={c.name}>
            <StrengthControl label="Merge ratio" value={c.ratio} min={0} max={1} step={0.01} chips={[0.25, 0.5, 0.75]} color="blue"
              onChange={(ratio) => updateCheckpoint(c.id, { ratio })} />
          </ModelSettings>
        ))}
      >
        {checkpoints.map((c, i) => (
          <SelectedModelCard
            key={c.id}
            fileName={c.name}
            badge={checkpoints.length > 1 ? (i === 0 ? 'Base' : `Merge ${Math.round(c.ratio * 100)}%`) : undefined}
            onRemove={() => removeCheckpoint(c.id)}
            onOpen={() => openForFile(c.id, c.name)}
          />
        ))}
      </PickerBlock>
      <ModelSelectorModal
        opened={open}
        onClose={() => setOpen(false)}
        kind="checkpoint"
        models={models}
        selectedModels={checkpoints.map((c) => c.name)}
        onToggleModel={toggle}
        onClearSelection={() => checkpoints.forEach((c) => removeCheckpoint(c.id))}
        availability={availability}
        onRefresh={refreshAllServers}
      />
    </>
  );
}

export function LorasField() {
  const loras = useStore((s) => s.workflow.loras);
  const models = useStore((s) => s.server.loras);
  const addLora = useStore((s) => s.addLora);
  const removeLora = useStore((s) => s.removeLora);
  const updateLora = useStore((s) => s.updateLora);
  const openForFile = useModelMetadataStore((s) => s.openForFile);
  const availability = useResourceAvailability('lora');
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    const existing = loras.find((l) => l.name === name);
    if (existing) removeLora(existing.id);
    else addLora(name);
  };

  return (
    <>
      <PickerBlock
        label="Loras"
        count={loras.length}
        color="grape"
        addLabel="Add LoRA"
        emptyLabel="No LoRAs selected"
        onAdd={() => setOpen(true)}
        settings={loras.map((l) => (
          <ModelSettings key={l.id} name={l.name} off={!l.on}>
            <StrengthControl label="Model strength" value={l.strength} min={0} max={LORA_MAX} step={0.05} chips={LORA_CHIPS}
              onChange={(strength) => updateLora(l.id, { strength })} />
            <StrengthControl label="Clip strength" value={l.clipStrength} min={0} max={LORA_MAX} step={0.05} chips={LORA_CHIPS}
              onChange={(clipStrength) => updateLora(l.id, { clipStrength })} />
          </ModelSettings>
        ))}
      >
        {loras.map((l) => (
          <SelectedModelCard
            key={l.id}
            fileName={l.name}
            isDisabled={!l.on}
            onRemove={() => removeLora(l.id)}
            onOpen={() => openForFile(l.id, l.name)}
            footer={
              <Switch
                size="xs"
                checked={l.on}
                onChange={() => updateLora(l.id, { on: !l.on })}
                label={<Text size="xs" c="dimmed">{l.on ? 'On' : 'Off'}</Text>}
                styles={{ track: { cursor: 'pointer' }, label: { cursor: 'pointer', paddingLeft: 4 } }}
              />
            }
          />
        ))}
      </PickerBlock>
      <ModelSelectorModal
        opened={open}
        onClose={() => setOpen(false)}
        kind="lora"
        models={models}
        selectedModels={loras.map((l) => l.name)}
        onToggleModel={toggle}
        onClearSelection={() => loras.forEach((l) => removeLora(l.id))}
        availability={availability}
        onRefresh={refreshAllServers}
      />
    </>
  );
}

const BUILT_IN_VAE = '__builtin__';

export function VaeField() {
  const vae = useStore((s) => s.workflow.vae);
  const vaes = useStore((s) => s.server.vaes);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const availability = useResourceAvailability('vae');
  const options = [{ value: BUILT_IN_VAE, label: "Checkpoint's built-in VAE" }, ...[...new Set([...(vae ? [vae] : []), ...vaes])].map((v) => ({ value: v, label: modelLabel(v) }))];
  return (
    <FieldWrapper label="VAE">
      <Select
        value={vae || BUILT_IN_VAE}
        options={options}
        onValueChange={(v) => setWorkflow({ vae: v === BUILT_IN_VAE ? '' : v })}
        ariaLabel="VAE"
        getOptionState={(v) => {
          if (v === BUILT_IN_VAE) return undefined;
          const a = availability(v);
          return { disabled: !a.enabled, title: a.servers.length ? `On ${a.servers.join(', ')}` : 'Not installed' };
        }}
      />
    </FieldWrapper>
  );
}

/** Checkpoints, LoRAs, and VAE, in v1's order. */
export function ModelFields() {
  return (
    <Stack gap="md">
      <CheckpointsField />
      <LorasField />
      <VaeField />
    </Stack>
  );
}
