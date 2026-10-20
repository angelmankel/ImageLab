import { useEffect, useState } from 'react';
import {
  ActionIcon, Badge, Button, Group, NumberInput, Paper, Progress, SegmentedControl, Select, Stack, Text, TextInput, Tooltip,
} from '@mantine/core';
import {
  IconCheck, IconDownload, IconEye, IconPlayerStop, IconRefresh, IconServer, IconTrash, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { LOCAL_LLM_DEFAULT_BASE_URL, podLlmUrl } from '@/lib/storage';
import { localEntry } from '@/lib/aiProviders';
import { ollamaRoot } from '@/lib/localLlm';
import { formatBytes, modelLabel } from '@/lib/llmModels';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useLocalModels, useLocalModelsFor, type PullState } from './localModelsStore';
import { HfBrowser } from './HfBrowser';

/**
 * Settings → AI → Local LLM: which Ollama server (the home PC, this pod, or any address), its
 * installed models (use / use for images / unload / delete), downloads by name, and the Hugging
 * Face GGUF browser. Each server keeps its own models; picking one lists what it has. Reads and
 * writes the Local entry of the providers store (`lib/aiProviders`).
 */
export function LocalLlmSection() {
  const ai = useStore((s) => s.ai);
  const local = localEntry(ai);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const setAi = useStore((s) => s.setAi);
  const setActiveAi = useStore((s) => s.setActiveAi);
  const setLocal = (patch: Partial<typeof local>) => setAiProvider('local', patch);
  const { checkedUrl, loading, version, error, models, running, pulls, refresh, pull, remove, unload } = useLocalModels();
  const confirm = useConfirm();
  const base = local.baseUrl;
  const [pullName, setPullName] = useState('');
  const [actionError, setActionError] = useState('');

  useLocalModelsFor(base);
  // The server answering is Local's Test: unlock its model pickers (here and in the new UI).
  useEffect(() => { if (version && !error && checkedUrl === base && !local.tested) setAiProvider('local', { tested: true }); }, [version, error, checkedUrl, base, local.tested, setAiProvider]);

  const act = async (fn: () => Promise<void>) => {
    setActionError('');
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); }
  };

  const loaded = new Map(running.map((r) => [r.name, r]));
  const visionModels = models.filter((m) => m.vision);

  const pod = podLlmUrl();
  const same = (a: string, b: string) => !!b && ollamaRoot(a) === ollamaRoot(b);
  const where = same(base, LOCAL_LLM_DEFAULT_BASE_URL) ? 'home' : same(base, pod) ? 'pod' : 'custom';

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" fw={500}>Where it runs</Text>
        <SegmentedControl
          fullWidth
          value={where}
          onChange={(v) => {
            if (v === 'home') setLocal({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL });
            else if (v === 'pod') setLocal({ baseUrl: pod });
          }}
          data={[
            { value: 'home', label: 'Home PC' },
            { value: 'pod', label: 'This pod', disabled: !pod },
            { value: 'custom', label: 'Other', disabled: where !== 'custom' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {pod
            ? 'Home PC is winold on the LAN. This pod runs its own Ollama with the pod\'s GPU; a model downloaded there stays until the pod is terminated.'
            : 'This pod is offered when ImageLab is opened from a pod.'}
        </Text>
      </Stack>
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput
          className="flex-1"
          label="Server"
          description="Ollama behind Traefik (HTTPS). A plain http:// address only works when ImageLab is opened over http too."
          placeholder="https://llm.blueoceanswim.com"
          leftSection={<IconServer size={16} />}
          value={base}
          onChange={(e) => setLocal({ baseUrl: e.currentTarget.value })}
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
          const active = ai.active === 'local' && local.model === m.name;
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
                  onClick={() => { setActiveAi('local'); setLocal({ model: m.name, tested: true }); }}
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
                      if (local.model === m.name) setLocal({ model: '' });
                      if (local.visionModel === m.name) setLocal({ visionModel: '' });
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
        value={local.visionModel || ''}
        onChange={(v) => setLocal({ visionModel: v ?? '' })}
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
        value={ai.localVramGb}
        onChange={(v) => setAi({ localVramGb: typeof v === 'number' ? v : 20 })}
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
