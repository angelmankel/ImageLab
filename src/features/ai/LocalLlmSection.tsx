import { useState } from 'react';
import {
  ActionIcon, Badge, Button, Group, NumberInput, Paper, Progress, Select, Stack, Text, TextInput, Tooltip,
} from '@mantine/core';
import {
  IconCheck, IconDownload, IconEye, IconPlayerStop, IconRefresh, IconServer, IconTrash, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { formatBytes, modelLabel } from '@/lib/llmModels';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useLocalModels, useLocalModelsFor, type PullState } from './localModelsStore';
import { HfBrowser } from './HfBrowser';

/**
 * Settings → AI → Local LLM: the Ollama server address, its installed models (use / use for
 * images / unload / delete), downloads by name, and the Hugging Face GGUF browser.
 */
export function LocalLlmSection() {
  const venice = useStore((s) => s.venice);
  const setVenice = useStore((s) => s.setVenice);
  const { loading, version, error, models, running, pulls, refresh, pull, remove, unload } = useLocalModels();
  const confirm = useConfirm();
  const base = venice.localBaseUrl;
  const [pullName, setPullName] = useState('');
  const [actionError, setActionError] = useState('');

  useLocalModelsFor(base);

  const act = async (fn: () => Promise<void>) => {
    setActionError('');
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); }
  };

  const loaded = new Map(running.map((r) => [r.name, r]));
  const visionModels = models.filter((m) => m.vision);

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput
          className="flex-1"
          label="Server"
          description="Ollama behind Traefik (HTTPS). A plain http:// address only works when ImageLab is opened over http too."
          placeholder="https://llm.blueoceanswim.com"
          leftSection={<IconServer size={16} />}
          value={base}
          onChange={(e) => setVenice({ localBaseUrl: e.currentTarget.value })}
          spellCheck={false}
        />
        <Tooltip label="Check again">
          <ActionIcon size="lg" variant="default" loading={loading} onClick={() => void refresh(base)} aria-label="Refresh local models">
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error ? (
        <Text size="xs" c="red.5">{error}</Text>
      ) : version ? (
        <Text size="xs" c="dimmed">Connected · Ollama {version} · {models.length} model{models.length === 1 ? '' : 's'} installed</Text>
      ) : null}
      {actionError && <Text size="xs" c="red.5">{actionError}</Text>}

      <Stack gap={6}>
        {models.map((m) => {
          const active = venice.provider === 'local' && venice.localModel === m.name;
          const run = loaded.get(m.name);
          return (
            <Paper key={m.name} withBorder radius="sm" px="sm" py={6}>
              <Group gap="xs" wrap="nowrap">
                <div className="min-w-0 flex-1">
                  <Text size="sm" fw={500} truncate title={m.name}>{modelLabel(m.name)}</Text>
                  <Group gap={4} mt={2}>
                    <Text size="xs" c="dimmed">{[m.params, m.quant, formatBytes(m.bytes)].filter(Boolean).join(' · ')}</Text>
                    {m.vision && <Badge size="xs" variant="light" color="teal">vision</Badge>}
                    {m.thinking && <Badge size="xs" variant="light" color="grape">thinking off</Badge>}
                    {run && <Badge size="xs" variant="light" color="yellow">on GPU · {formatBytes(run.vramBytes)}</Badge>}
                  </Group>
                </div>
                <Button
                  size="compact-xs"
                  variant={active ? 'filled' : 'default'}
                  leftSection={active ? <IconCheck size={12} /> : undefined}
                  onClick={() => setVenice({ provider: 'local', localModel: m.name })}
                >
                  {active ? 'In use' : 'Use'}
                </Button>
                {run && (
                  <Tooltip label="Unload from the GPU now">
                    <ActionIcon variant="subtle" color="gray" onClick={() => act(() => unload(base, m.name))} aria-label="Unload">
                      <IconPlayerStop size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="Delete from the server">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Delete model"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete model?',
                        message: `${m.name} (${formatBytes(m.bytes)}) will be removed from the server.`,
                        confirmLabel: 'Delete',
                        destructive: true,
                      });
                      if (!ok) return;
                      if (venice.localModel === m.name) setVenice({ localModel: '' });
                      if (venice.localVisionModel === m.name) setVenice({ localVisionModel: '' });
                      await act(() => remove(base, m.name));
                    }}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      <Select
        label="Model for images"
        description="Tagging, describe and image → prompt in Collections. Needs a vision model."
        leftSection={<IconEye size={16} />}
        value={venice.localVisionModel || ''}
        onChange={(v) => setVenice({ localVisionModel: v ?? '' })}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, zIndex: 320 }}
        data={[
          { value: '', label: 'Same as the text model' },
          ...visionModels.map((m) => ({ value: m.name, label: modelLabel(m.name) })),
        ]}
      />

      <NumberInput
        label="GPU memory (GB)"
        description="Used for the 'fits on GPU' hint when browsing. winold's RTX A4500 has 20 GB."
        min={1}
        max={256}
        value={venice.localVramGb}
        onChange={(v) => setVenice({ localVramGb: typeof v === 'number' ? v : 20 })}
        w={200}
      />

      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput
          className="flex-1"
          label="Download by name"
          description={<>An Ollama library name (<code>huihui_ai/qwen3-abliterated:14b</code>) or <code>hf.co/user/repo:Q4_K_M</code>.</>}
          placeholder="huihui_ai/gemma3-abliterated:4b"
          value={pullName}
          onChange={(e) => setPullName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && pullName.trim()) { void pull(base, pullName); setPullName(''); } }}
          spellCheck={false}
        />
        <Button
          leftSection={<IconDownload size={14} />}
          disabled={!pullName.trim() || !!error}
          onClick={() => { void pull(base, pullName); setPullName(''); }}
        >
          Download
        </Button>
      </Group>

      <PullList pulls={pulls} />

      <HfBrowser />
    </Stack>
  );
}

/** Downloads in flight and just finished, with a cancel / dismiss per row. */
export function PullList({ pulls }: { pulls: Record<string, PullState> }) {
  const cancelPull = useLocalModels((s) => s.cancelPull);
  const clearPull = useLocalModels((s) => s.clearPull);
  const rows = Object.entries(pulls);
  if (!rows.length) return null;
  return (
    <Stack gap={6}>
      {rows.map(([name, p]) => {
        const pct = p.total ? Math.min(100, (p.completed / p.total) * 100) : 0;
        const color = p.error ? 'red' : p.status === 'success' ? 'teal' : p.status === 'cancelled' ? 'gray' : 'violet';
        return (
          <Paper key={name} withBorder radius="sm" px="sm" py={6}>
            <Group gap="xs" wrap="nowrap">
              <div className="min-w-0 flex-1">
                <Text size="xs" fw={500} truncate title={name}>{modelLabel(name)}</Text>
                <Text size="xs" c={p.error ? 'red.5' : 'dimmed'} truncate>
                  {p.error ?? (p.total && !p.done
                    ? `${p.status.replace(/ [0-9a-f:]{12,}$/, '')} · ${formatBytes(p.completed)} / ${formatBytes(p.total)}`
                    : p.status)}
                </Text>
                {!p.done && <Progress mt={4} size="sm" value={pct} color={color} animated={!p.total} />}
              </div>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={p.done ? 'Dismiss' : 'Cancel download'}
                title={p.done ? 'Dismiss' : 'Cancel (the parts already downloaded are kept)'}
                onClick={() => (p.done ? clearPull(name) : cancelPull(name))}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
