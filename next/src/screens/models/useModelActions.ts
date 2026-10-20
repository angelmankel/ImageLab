/**
 * What a model can do to the active step (rule 13): "Use in step" puts an installed file into
 * the step's workflow (main store: addCheckpoint / addLora / addEmbedding), a sample's generation
 * data goes to the step through `~/app/actions.applyGenerationData`, Delete removes the file from
 * the server through the ImageLab node. Every action lands on the step screen.
 */
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { deleteModel } from '@/lib/comfy';
import type { CivitaiImageMeta, CivitaiModelVersion } from '@/lib/civitai';
import { applyGenerationData } from '~/app/actions';
import { useRoute } from '~/app/routeStore';
import { useActiveStep } from '~/app/stepsStore';
import { primaryFile } from '@/features/model-metadata/civitai';
import { useInstalled } from './useInstalled';

/** The meta of a CivitAI sample as `applyGenerationData` wants it (size split into width/height). */
export function metaForStep(meta: CivitaiImageMeta, image?: { width?: number; height?: number }): Parameters<typeof applyGenerationData>[0] {
  const size = typeof meta.Size === 'string' ? meta.Size : typeof meta.size === 'string' ? meta.size : '';
  const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
  const width = m ? Number(m[1]) : image?.width;
  const height = m ? Number(m[2]) : image?.height;
  const clipSkip = Number(meta.clipSkip ?? meta['Clip skip'] ?? meta.clip_skip);
  return {
    ...meta,
    prompt: meta.prompt, negativePrompt: meta.negativePrompt, steps: meta.steps, cfgScale: meta.cfgScale, sampler: meta.sampler, seed: meta.seed,
    width, height, ...(Number.isFinite(clipSkip) ? { clipSkip } : {}),
  };
}

export function useModelActions() {
  const go = useRoute((s) => s.go);
  const step = useActiveStep();
  const installed = useInstalled();
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);

  const usePrompt = (meta: CivitaiImageMeta, image?: { width?: number; height?: number }) => { applyGenerationData(metaForStep(meta, image), 'prompt'); go('step'); };
  const useSettings = (meta: CivitaiImageMeta, image?: { width?: number; height?: number }) => { applyGenerationData(metaForStep(meta, image), 'settings'); go('step'); };

  /** Put the version's installed file into the active step. Returns false when nothing fits. */
  const useInStep = (version: CivitaiModelVersion, modelType: string): boolean => {
    const file = version.files.find((f) => installed.file(f)) ?? primaryFile(version);
    const name = file ? installed.serverName(file.name) : undefined;
    if (!name) { notifications.show({ color: 'yellow', message: 'Download it first — the file is not on a server yet' }); return false; }
    const s = useStore.getState();
    const t = modelType;
    if (t === 'Checkpoint') s.addCheckpoint(name);
    else if (t === 'LORA' || t === 'LoCon' || t === 'DoRA') s.addLora(name);
    else if (t === 'TextualInversion') s.addEmbedding(name.replace(/\.[^.]+$/, ''));
    else if (t === 'VAE') s.setWorkflow({ vae: name });
    else { notifications.show({ color: 'yellow', message: `${t} files are not something a step loads` }); return false; }
    notifications.show({ color: 'ember', message: `${name.split('/').pop()} added to ${step.name}` });
    go('step');
    return true;
  };

  const copy = async (text: string, what = 'Copied') => {
    try { await navigator.clipboard.writeText(text); notifications.show({ color: 'ember', message: what }); }
    catch { notifications.show({ color: 'red', message: 'Could not copy' }); }
  };

  /** Delete an installed file from every server that has it. */
  const deleteFile = async (fileName: string, hashKey?: string) => {
    const key = hashKey ?? installed.serverName(fileName);
    if (!key) return;
    const slash = key.indexOf('/');
    const folder = slash > 0 ? key.slice(0, slash) : '';
    const rest = slash > 0 ? key.slice(slash + 1) : key;
    if (!folder) { notifications.show({ color: 'red', message: 'Which folder it is in is unknown — delete it from ComfyUI' }); return; }
    const targets = servers.filter((s) => serverInfo[s.id]);
    const results = await Promise.allSettled(targets.map((s) => deleteModel(s.host, folder, rest)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    notifications.show({ color: ok ? 'ember' : 'red', message: ok ? `Deleted ${rest} on ${ok} server${ok === 1 ? '' : 's'}` : 'Delete failed' });
    for (const s of targets) void useStore.getState().refreshServerInfo(s.id);
  };

  return { usePrompt, useSettings, useInStep, copy, deleteFile, stepName: step.name };
}
