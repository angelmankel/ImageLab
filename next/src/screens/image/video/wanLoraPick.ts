/**
 * What a pick does to a Wan LoRA entry (Donny, 10-20: one entry holds the high + low pair): the
 * store side of `wanLoraPair.ts`'s plan — make or edit the entry, keep a pending record per file
 * no server has (the low one keyed to the entry as `<id>:low`), start the downloads the models
 * modal does not start itself. Shared by the list's api (`useVideoKindApi`) and the card's low
 * slot (`WanLoraPairCard`), so neither imports the other.
 */
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import type { VideoLora } from '@/lib/wanGraph';
import { useDownloadsStore } from '@/features/downloads';
import { usePendingModels, pendingKey, recordFromPick, sameFile, type PickTarget, type PickLike } from '~/screens/image/model';
import { noiseOf, planPairPick, type PairPlan, type PairSlot } from './wanLoraPair';
import { notifyError } from '~/app/notify';

export const VIDEO_SCOPE = 'video';

const loraOf = (id: string): VideoLora | undefined => useVideo.getState().loras.find((l) => l.id === id);

/**
 * One pick → the entry's files. 'add' makes (or finds) the entry; 'change' and 'low' edit one.
 * Files no server has become pending records (the entry waits Off); the downloads the models
 * modal does not start itself (a URL half; the version half of an installed pick) start here.
 */
export function pickWanLora(target: PickTarget | { mode: 'low'; id: string }, pick: PickLike): string | undefined | false {
  // Only the user's own LoRAs are pairs; a fixed slot (the Fast LoRAs) is the list's generic business.
  if (target.mode !== 'add' && !loraOf(target.id)) return false;
  const slot: PairSlot = target.mode === 'add' ? 'add' : target.mode === 'low' ? 'low' : 'high';
  const plan = planPairPick(pick, slot, useStore.getState().server.loras);
  if (plan.name === undefined && plan.nameLow === undefined) return undefined;
  const st = useVideo.getState();
  const pm = usePendingModels.getState();
  let id = target.mode === 'add' ? undefined : target.id;
  let reused = false;
  if (!id) {
    const found = plan.name ? st.loras.find((l) => sameFile(l.name, plan.name!)) : undefined;
    if (found) { id = found.id; reused = true; }
    else { st.addLora(plan.name!, plan.nameLow ?? undefined); id = useVideo.getState().loras.at(-1)?.id; }
  }
  if (!id) return undefined;
  const was = loraOf(id);
  if (!was) return undefined;
  // The user's On/Off while the old file waited, else the entry's own.
  const oldRecord = was.name ? pm.records[pendingKey('lora', was.name)] : undefined;
  const userOn = oldRecord?.userOn ?? was.on;
  // A slot that changes drops the record its old file waited for (only this entry's).
  const drop = (file: string | null | undefined) => {
    if (!file) return;
    const r = pm.records[pendingKey('lora', file)];
    if (r && r.entryId === id) pm.remove(r.key);
  };
  if (plan.name !== undefined && !sameFile(was.name, plan.name)) drop(was.name);
  // Adding a single file an existing pair already holds as its high file keeps that pair's low file.
  const setLow = plan.nameLow !== undefined && !(reused && plan.nameLow === null);
  if (setLow && was.nameLow && (!plan.nameLow || !sameFile(was.nameLow, plan.nameLow!))) drop(was.nameLow);

  const patch: Partial<Omit<VideoLora, 'id'>> = {};
  if (plan.name !== undefined) patch.name = plan.name;
  if (setLow) patch.nameLow = plan.nameLow;
  if (plan.nameLow) patch.expert = 'both';
  if (plan.pending.length) patch.on = false;
  useVideo.getState().updateLora(id, patch);

  for (const p of plan.pending) {
    const key = pendingKey('lora', p.file);
    if (!pm.records[key]) pm.add(recordFromPick('lora', pick, Date.now(), id, userOn, 1, { scope: VIDEO_SCOPE, folder: 'loras', list: 'loras', file: p.file, downloadUrl: p.downloadUrl }));
  }
  startPairDownloads(plan, pick);
  return id;
}

/** The downloads the models modal does not start: a URL half always; the version half when the pick was installed (the modal starts that only for a pick that is not). */
function startPairDownloads(plan: PairPlan, pick: PickLike) {
  const s = useStore.getState();
  if (!s.servers.some((sv) => !!s.serverInfo[sv.id])) return;
  const dl = useDownloadsStore.getState();
  for (const p of plan.pending) {
    const run = p.downloadUrl ? dl.startUrl(p.downloadUrl, 'loras', p.file) : pick.installed && pick.version.id ? dl.start(pick.version.id, 'loras') : null;
    if (run) void run.then((r) => { if (r.errors.length) notifyError('Download failed', r.errors.join('\n')); });
  }
}

/** Clearing a pair's low file leaves the high file where its name says (the single-file rule). */
export function clearLowFile(id: string) {
  const l = loraOf(id);
  if (!l) return;
  const pm = usePendingModels.getState();
  if (l.nameLow) { const r = pm.records[pendingKey('lora', l.nameLow)]; if (r && r.entryId === id) pm.remove(r.key); }
  useVideo.getState().updateLora(id, { nameLow: null, expert: noiseOf(l.name) ?? 'both' });
}
