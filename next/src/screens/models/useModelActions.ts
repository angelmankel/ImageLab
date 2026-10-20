/**
 * What a model can do (rule 13 + the picker brief): `pick` hands a `ModelPick` to whoever opened
 * the picker (downloading first when the file is not on the pod — the pick fires at once with
 * `installed: false`); without a picker, "Use in step" puts an installed file into the step's
 * workflow (main store: addCheckpoint / addLora / addEmbedding). A sample's generation data goes
 * to the step through `~/app/actions.applyGenerationData`; Delete removes the file from the pod.
 */
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { deleteModel } from '@/lib/comfy';
import type { CivitaiImageMeta, CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { civitaiThumbUrl, previewStill } from '@/lib/civitai';
import { applyGenerationData } from '~/app/actions';
import { useRoute } from '~/app/routeStore';
import { useActiveStep } from '~/app/stepsStore';
import { primaryFile } from '@/features/model-metadata/civitai';
import { useInstalled } from './useInstalled';
import { usePick } from './pickContext';
import { buildPick, pickFile } from './pick';
import { useVersionDownload } from './DownloadButton';

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
  const ctx = usePick();
  const { download, stateOf } = useVersionDownload();

  const leave = () => { if (ctx.close) ctx.close(); else go('step'); };

  const usePrompt = (meta: CivitaiImageMeta, image?: { width?: number; height?: number }) => { applyGenerationData(metaForStep(meta, image), 'prompt'); leave(); };
  const useSettings = (meta: CivitaiImageMeta, image?: { width?: number; height?: number }) => { applyGenerationData(metaForStep(meta, image), 'settings'); leave(); };

  /** The server file name for a version, when one of its files is on the pod. */
  const serverFileOf = (version: CivitaiModelVersion): string | undefined => {
    const file = version.files.find((f) => installed.file(f)) ?? primaryFile(version);
    return file ? installed.serverName(file.name) : undefined;
  };

  /**
   * The picker's primary action: hand the pick to the opener. Not on the pod yet → the download
   * starts and the pick still fires (`installed: false`), so the step can hold the entry disabled
   * until the file lands.
   */
  const pick = (model: CivitaiModel, version: CivitaiModelVersion): boolean => {
    if (!ctx.onPick) return false;
    const serverFile = serverFileOf(version);
    const img = version.images?.[0];
    const p = buildPick(model, version, { serverFile, thumb: img ? civitaiThumbUrl(previewStill(img, 450), 450) : undefined });
    if (!serverFile && stateOf(version).state !== 'offline') void download(version, model.type);
    ctx.onPick(p);
    ctx.close?.();
    return true;
  };

  /** Without a picker: put the version's installed file into the active step. */
  const useInStep = (version: CivitaiModelVersion, modelType: string): boolean => {
    const name = serverFileOf(version);
    if (!name) { notifications.show({ color: 'yellow', message: 'Download it first — the file is not on a server yet' }); return false; }
    const s = useStore.getState();
    const t = modelType;
    if (t === 'Checkpoint') s.addCheckpoint(name);
    else if (t === 'LORA' || t === 'LoCon' || t === 'DoRA') s.addLora(name);
    else if (t === 'TextualInversion') s.addEmbedding(name.replace(/\.[^.]+$/, ''));
    else if (t === 'VAE') s.setWorkflow({ vae: name });
    else { notifications.show({ color: 'yellow', message: `${t} files are not something a step loads` }); return false; }
    notifications.show({ color: 'ember', message: `${name.split('/').pop()} added to ${step.name}` });
    leave();
    return true;
  };

  /** Use = pick when a picker is open, else into the step. */
  const use = (model: CivitaiModel, version: CivitaiModelVersion): boolean => (ctx.onPick ? pick(model, version) : useInStep(version, model.type));

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

  /** The version a tile acts on: the installed one, else the first. */
  const versionToUse = (model: CivitaiModel): CivitaiModelVersion | undefined => model.modelVersions.find((v) => installed.version(v)) ?? model.modelVersions[0];

  return { usePrompt, useSettings, useInStep, pick, use, copy, deleteFile, versionToUse, serverFileOf, pickFile, stepName: step.name, picking: !!ctx.onPick, kind: ctx.kind };
}
