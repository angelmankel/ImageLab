import { useEffect, useRef, useState } from 'react';
import {
  Anchor, Badge, Button, Chip, Group, Loader, Paper, SegmentedControl, Stack, Text, TextInput, UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconDownload, IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { localEntry } from '@/lib/aiProviders';
import { formatBytes, hfPullName, vramFit, type VramFit } from '@/lib/llmModels';
import { hfRepoFiles, searchHfGguf, type HfRepo, type HfRepoFiles, type HfSort } from '@/lib/localLlm';
import { useLocalModels } from './localModelsStore';

const PRESETS = ['abliterated', 'uncensored', 'gemma-3 abliterated', 'qwen3 abliterated', 'mistral-nemo', 'prompt'];

const FIT_BADGE: Record<VramFit, { color: string; label: string }> = {
  fits: { color: 'teal', label: 'fits on GPU' },
  tight: { color: 'yellow', label: 'partly on CPU (slow)' },
  'too-big': { color: 'red', label: 'too big' },
};

/**
 * Search Hugging Face's GGUF models and download a chosen quantization into Ollama
 * (`hf.co/{repo}:{quant}`). Each repo opens to its quant list with sizes and a GPU-fit hint.
 */
export function HfBrowser() {
  const [query, setQuery] = useState('abliterated');
  const [sort, setSort] = useState<HfSort>('downloads');
  const [repos, setRepos] = useState<HfRepo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const search = async (q: string, s: HfSort) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true); setError('');
    try {
      const rows = await searchHfGguf(q, s, ctrl.signal);
      if (!ctrl.signal.aborted) setRepos(rows);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void search(query, sort), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="sm">
        <div>
          <Text fw={600} size="sm">Browse Hugging Face</Text>
          <Text size="xs" c="dimmed">GGUF models. Open one, pick a size, and the server downloads it. Q4_K_M is a good default; Q6_K / Q8_0 are better and bigger.</Text>
        </div>
        <TextInput
          leftSection={busy ? <Loader size={14} /> : <IconSearch size={16} />}
          placeholder="Search models…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          spellCheck={false}
        />
        <Group gap={6}>
          {PRESETS.map((p) => (
            <Chip key={p} size="xs" checked={query === p} onChange={() => setQuery(p)}>{p}</Chip>
          ))}
        </Group>
        <SegmentedControl
          size="xs"
          value={sort}
          onChange={(v) => setSort(v as HfSort)}
          data={[
            { value: 'downloads', label: 'Most downloaded' },
            { value: 'trendingScore', label: 'Trending' },
            { value: 'likes', label: 'Most liked' },
            { value: 'lastModified', label: 'Newest' },
          ]}
        />
        {error && <Text size="xs" c="red.5">{error}</Text>}
        <Stack gap={4}>
          {repos.map((r) => (
            <RepoRow key={r.id} repo={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
          {!busy && !error && repos.length === 0 && <Text size="xs" c="dimmed">No GGUF models found.</Text>}
        </Stack>
      </Stack>
    </Paper>
  );
}

function RepoRow({ repo, open, onToggle }: { repo: HfRepo; open: boolean; onToggle: () => void }) {
  const [owner, name] = repo.id.split('/');
  return (
    <Paper withBorder radius="sm">
      <UnstyledButton onClick={onToggle} className="flex w-full items-center gap-2 px-2 py-1.5">
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <div className="min-w-0 flex-1">
          <Text size="sm" fw={500} truncate title={repo.id}>{name}</Text>
          <Text size="xs" c="dimmed" truncate>
            {owner} · {repo.downloads.toLocaleString()} downloads · {repo.likes} likes
            {repo.updated && ` · ${repo.updated.slice(0, 10)}`}
          </Text>
        </div>
      </UnstyledButton>
      {open && <RepoFiles repoId={repo.id} />}
    </Paper>
  );
}

function RepoFiles({ repoId }: { repoId: string }) {
  const vramGb = useStore((s) => s.ai.localVramGb);
  const localBaseUrl = useStore((s) => localEntry(s.ai).baseUrl);
  const models = useLocalModels((s) => s.models);
  const pulls = useLocalModels((s) => s.pulls);
  const pull = useLocalModels((s) => s.pull);
  const [files, setFiles] = useState<HfRepoFiles | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    hfRepoFiles(repoId, ctrl.signal).then(setFiles).catch((e) => {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    });
    return () => ctrl.abort();
  }, [repoId]);

  if (error) return <Text size="xs" c="red.5" px="sm" pb="xs">{error}</Text>;
  if (!files) return <Group px="sm" pb="xs"><Loader size="xs" /></Group>;

  const installed = new Set(models.map((m) => m.name.toLowerCase()));
  return (
    <Stack gap={4} px="sm" pb="xs">
      <Group gap={6}>
        <Anchor href={`https://huggingface.co/${repoId}`} target="_blank" rel="noreferrer" size="xs">Model page</Anchor>
        {files.hasProjector && <Badge size="xs" variant="light" color="teal">vision</Badge>}
      </Group>
      {files.choices.length === 0 && <Text size="xs" c="dimmed">No single-file quantizations found in this repo.</Text>}
      {files.choices.map((c) => {
        const pullName = hfPullName(repoId, c.quant);
        const fit = FIT_BADGE[vramFit(c.bytes, vramGb)];
        const have = installed.has(pullName.toLowerCase());
        const p = pulls[pullName];
        const inFlight = p && !p.done;
        return (
          <Group key={c.quant} gap="xs" wrap="nowrap">
            <Text size="xs" ff="monospace" w={70}>{c.quant}</Text>
            <Text size="xs" c="dimmed" w={60}>{formatBytes(c.bytes)}</Text>
            <Badge size="xs" variant="light" color={fit.color}>{fit.label}</Badge>
            {c.files.length > 1 && <Badge size="xs" variant="light" color="gray">{c.files.length} parts</Badge>}
            <div className="flex-1" />
            <Button
              size="compact-xs"
              variant={have ? 'light' : 'default'}
              leftSection={<IconDownload size={12} />}
              disabled={have || inFlight}
              onClick={() => void pull(localBaseUrl, pullName)}
            >
              {have ? 'Installed' : inFlight ? `${p.total ? Math.round((p.completed / p.total) * 100) : 0}%` : 'Download'}
            </Button>
          </Group>
        );
      })}
    </Stack>
  );
}
