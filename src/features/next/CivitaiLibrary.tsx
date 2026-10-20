/**
 * The prompt hub's Library: pictures from CivitAI for the models installed on this server, each
 * with the prompt that made it, as a grid right in the panel (the data comes from
 * `features/layers/civitaiPrompts`, shared with the old modal). Tap a picture = use its prompt:
 * in the Image step the positive + negative, and steps / CFG / seed when the picture carries
 * them; in the Video step the AI rewrites it as a motion prompt. "As input" makes the picture the
 * img2img input image, or the clip's start frame.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Loader, Select, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconPhotoUp, IconRefresh, IconTextCaption } from '@tabler/icons-react';
import { Segmented } from '@/components/blocks/Segmented';
import { useStore } from '@/lib/store';
import { civitaiThumbUrl, type CivitaiImage, type NsfwFilter } from '@/lib/civitai';

import { aiNotReadyHint, aiReady, generateVideoPrompt } from '@/lib/venice';
import { loadNsfw, saveNsfw, useCivitaiGallery, useInstalledCivitai } from '@/features/layers/civitaiPrompts';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { sendUrlToVideo } from '@/features/video/sendToVideo';
import { sendToWorkflow } from '@/features/workspace/sendTo';
import { useVideo } from '@/features/video/videoStore';
import { promptKindOf, usePrompt, type HubKind } from './PromptHub';

const NSFW: { value: NsfwFilter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'sfw', label: 'SFW' }, { value: 'nsfw', label: 'NSFW' }];

export function CivitaiLibrary({ kind, large }: { kind: HubKind; large: boolean }) {
  const installed = useInstalledCivitai(promptKindOf(kind));
  const [picked, setPicked] = useState<number | null>(null);
  const [nsfw, setNsfw] = useState<NsfwFilter>(loadNsfw);
  useEffect(() => { saveNsfw(nsfw); }, [nsfw]);
  const model = installed.find(m => m.versionId === picked) ?? installed[0] ?? null;
  const { items, loading, failed, hasMore, more, reload } = useCivitaiGallery(model?.versionId ?? null, nsfw);
  const apply = usePrompt(kind);
  const venice = useStore(s => s.venice);
  const engine = useVideo(s => s.engine);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);

  const options = useMemo(() => installed.map(m => ({ value: String(m.versionId), label: `${m.model} · ${m.version}${m.type === 'Checkpoint' ? '' : ` (${m.type})`}` })), [installed]);

  const use = async (img: CivitaiImage) => {
    const m = img.meta!;
    if (kind === 'workflow') { apply({ positive: m.prompt! }, `a CivitAI prompt for ${model?.model ?? 'this model'}`); return; }
    if (kind === 'image') {
      apply({ positive: m.prompt!, negative: m.negativePrompt || undefined }, `a CivitAI prompt for ${model?.model ?? 'this model'}`);
      const patch: Record<string, number | boolean> = {};
      if (typeof m.steps === 'number') patch.steps = m.steps;
      if (typeof m.cfgScale === 'number') patch.cfg = m.cfgScale;
      if (typeof m.seed === 'number') { patch.seed = m.seed; patch.randomizeSeed = false; }
      if (Object.keys(patch).length) useStore.getState().setWorkflow(patch);
      return;
    }
    if (!aiReady(venice)) { apply({ positive: m.prompt! }, 'a CivitAI prompt'); notifications.show({ title: 'Used as written', message: `${aiNotReadyHint(venice)} to rewrite pictures as motion prompts`, color: 'yellow' }); return; }
    setBusyUrl(img.url);
    try {
      const text = await generateVideoPrompt({ seed: m.prompt!, source: 'prompt', engine: engine === 'h3' ? 'h3' : 'wan', settings: venice });
      apply({ positive: text.trim() || m.prompt! }, 'a CivitAI picture, as motion');
    } catch (e) {
      notifications.show({ title: 'Could not rewrite the prompt', message: e instanceof Error ? e.message : String(e), color: 'red' });
    } finally { setBusyUrl(null); }
  };

  const asInput = async (img: CivitaiImage) => {
    const url = civitaiThumbUrl(img.url, 1280);
    const name = `civitai-${img.url.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'image'}.png`;
    setBusyUrl(img.url);
    try {
      if (kind === 'video') { await sendUrlToVideo(url, name, { open: false }); return; }
      if (kind === 'workflow') { await sendToWorkflow({ url, filename: name, kind: 'image' }); return; }
      const state = await urlToImageState(url, name);
      useStore.getState().setWorkflow({ inputImage: state });
      useStore.getState().setStatus(`Input image set from CivitAI — ${state.width}×${state.height}`, 'ok');
    } catch (e) {
      notifications.show({ title: 'Could not load the picture', message: e instanceof Error ? e.message : String(e), color: 'red' });
    } finally { setBusyUrl(null); }
  };

  if (!installed.length) {
    return <Text size="xs" c="dimmed" px={4} py="md" ta="center">{kind === 'video' ? 'No installed video model or LoRA is known to CivitAI yet.' : 'No installed model is known to CivitAI yet. Hashes may still be loading.'}</Text>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Group gap={6} wrap="nowrap">
        <Select size={large ? 'md' : 'xs'} data={options} value={model ? String(model.versionId) : null} onChange={v => { if (v) setPicked(Number(v)); }}
          allowDeselect={false} searchable={!large} aria-label="Model" comboboxProps={{ withinPortal: true }} style={{ flex: 1, minWidth: 0 }} />
        {model && (
          <Tooltip label="Open on CivitAI"><ActionIcon size={large ? 'lg' : 'md'} variant="subtle" color="gray" component="a" href={`https://civitai.com/models/${model.modelId}?modelVersionId=${model.versionId}`} target="_blank" rel="noreferrer" aria-label="Open on CivitAI"><IconExternalLink size={15} /></ActionIcon></Tooltip>
        )}
        <Tooltip label="Reload"><ActionIcon size={large ? 'lg' : 'md'} variant="subtle" color="gray" onClick={reload} disabled={loading} aria-label="Reload"><IconRefresh size={15} /></ActionIcon></Tooltip>
      </Group>
      <Segmented ariaLabel="Content filter" size="xs" value={nsfw} onChange={setNsfw} options={NSFW} />
      {failed && <Text c="red" size="xs" ta="center" py="md">CivitAI did not answer. Try again in a moment.</Text>}
      {!failed && !loading && items.length === 0 && <Text c="dimmed" size="xs" ta="center" py="md">No pictures with a prompt for this version{nsfw !== 'all' ? ' under this filter' : ''}.</Text>}
      <div className="grid grid-cols-2 gap-2">
        {items.map((img, i) => {
          const busy = busyUrl === img.url;
          return (
            <div key={`${img.url}-${i}`} className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-elev">
              <UnstyledButton onClick={() => void use(img)} aria-label="Use this prompt" className="relative block" title={img.meta?.prompt}>
                <div style={{ aspectRatio: `${img.width} / ${img.height}`, maxHeight: 220, overflow: 'hidden', background: '#000' }}>
                  <img src={civitaiThumbUrl(img.url, 450)} alt="" loading="lazy" className="block h-full w-full object-cover" />
                </div>
                {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader size="sm" /></div>}
              </UnstyledButton>
              <div className="flex flex-col gap-1 p-1.5">
                <Text size="xs" lineClamp={2} c="dimmed" title={img.meta?.prompt}>{img.meta?.prompt}</Text>
                <Group gap={2} wrap="nowrap" justify="space-between">
                  <Button size="compact-xs" variant="subtle" leftSection={<IconTextCaption size={12} />} onClick={() => void use(img)} disabled={busy}>Use</Button>
                  <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconPhotoUp size={12} />} onClick={() => void asInput(img)} disabled={busy}>As input</Button>
                </Group>
              </div>
            </div>
          );
        })}
      </div>
      <Group justify="center" py={4}>
        {loading ? <Loader size="sm" /> : hasMore ? <Button variant="default" size="xs" onClick={more}>Load more</Button> : null}
      </Group>
    </div>
  );
}
