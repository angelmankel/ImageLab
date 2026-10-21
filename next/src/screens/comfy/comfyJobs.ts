/**
 * FIXLIST-2 #51: prompts on our ComfyUI servers that this app did not queue (the embedded
 * ComfyUI's own Run / Queue, another client) — kept as "ComfyUI" rows that `~/app/queue` merges
 * into the Jobs popover, the job row and the tab title, each with progress and cancel.
 *
 * Where it learns from: `/queue` (whose prompt is whose: `extra_data.client_id`), fetched when the
 * shared bus (`@/lib/comfyBus`, never a socket of our own) says the queue moved — ComfyUI
 * broadcasts `status` to every client — and polled while foreign prompts exist. ComfyUI sends a
 * prompt's progress only to the client that queued it, so the embedded frame's own socket events
 * are fed in too (`frameEvent`, hooked by ./comfyFrame); prompts from elsewhere show without a %.
 * Started once by `useComfyJobsWatch()` (AppEffects).
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { subscribeComfy, type ComfyEvent } from '@/lib/comfyBus';
import { clientId, comfyHttpFor } from '@/lib/comfyHost';
import { deleteQueuedPrompt } from '@/lib/comfy';
import { useStore } from '@/lib/store';
import { servedFromHost } from '@/lib/storage';
import { fetchQueueRaw } from './comfyApi';
import { foreignItems, foreignRows, parseComfyRowId, type ComfyQueueRow, type ForeignItem, type ForeignLive } from './comfyJobsLogic';

export type { ComfyQueueRow } from './comfyJobsLogic';

interface HostJobs { name: string; items: ForeignItem[]; live: ForeignLive | null }
interface ComfyJobsState { hosts: Record<string, HostJobs>; rows: ComfyQueueRow[] }

const EMPTY: ComfyQueueRow[] = [];
export const useComfyJobs = create<ComfyJobsState>(() => ({ hosts: {}, rows: EMPTY }));

const firstSeen: Record<string, number> = {};
const POLL_BUSY_MS = 2500;
const POLL_IDLE_MS = 30_000;

function rebuild(hosts: Record<string, HostJobs>) {
  const rows = Object.entries(hosts).flatMap(([host, h]) => foreignRows(host, h.name, h.items, h.live, firstSeen));
  useComfyJobs.setState({ hosts, rows: rows.length ? rows : EMPTY });
}

function patchHost(host: string, patch: Partial<HostJobs>) {
  const cur = useComfyJobs.getState().hosts[host];
  if (!cur) return;
  rebuild({ ...useComfyJobs.getState().hosts, [host]: { ...cur, ...patch } });
}

interface Watch { unsub: () => void; timer: number | undefined; soon: number | undefined; busy: boolean; stopped: boolean }
const watches = new Map<string, Watch>();

async function refresh(host: string): Promise<void> {
  const w = watches.get(host);
  if (!w || w.stopped || w.busy) return;
  window.clearTimeout(w.timer);
  w.busy = true;
  try {
    if (document.visibilityState !== 'hidden') {
      const raw = await fetchQueueRaw(host);
      if (w.stopped) return;
      const items = foreignItems(raw, clientId);
      const now = Date.now();
      for (const it of items) if (!firstSeen[it.promptId]) firstSeen[it.promptId] = now;
      const cur = useComfyJobs.getState().hosts[host];
      const live = cur?.live && items.some((i) => i.state === 'running' && i.promptId === cur.live!.promptId) ? cur.live : null;
      const same = cur && cur.items.length === items.length && cur.items.every((x, i) => x.promptId === items[i].promptId && x.state === items[i].state);
      if (!same || live !== cur?.live) patchHost(host, { items, live });
    }
  } catch { /* offline: keep what we had until the next answer */ } finally {
    w.busy = false;
    if (!w.stopped) {
      const has = (useComfyJobs.getState().hosts[host]?.items.length ?? 0) > 0;
      w.timer = window.setTimeout(() => void refresh(host), has ? POLL_BUSY_MS : POLL_IDLE_MS);
    }
  }
}

function refreshSoon(host: string) {
  const w = watches.get(host);
  if (!w) return;
  window.clearTimeout(w.soon);
  w.soon = window.setTimeout(() => void refresh(host), 250);
}

const isForeign = (host: string, promptId: string) => !!useComfyJobs.getState().hosts[host]?.items.some((i) => i.promptId === promptId);

/** Prompts already looked up once: our own jobs' progress ticks must not refetch /queue each step. */
const checked = new Set<string>();
function checkOnce(host: string, promptId: string) {
  if (!promptId || checked.has(promptId)) return;
  if (checked.size > 500) checked.clear();
  checked.add(promptId);
  refreshSoon(host);
}

/** One event about `host` (from the bus, or the embedded ComfyUI's own socket). */
export function onHostEvent(host: string, ev: ComfyEvent): void {
  if (!watches.has(host)) return;
  switch (ev.type) {
    case 'progress':
      if (isForeign(host, ev.promptId)) patchHost(host, { live: { promptId: ev.promptId, node: ev.node, value: ev.value, max: ev.max } });
      else checkOnce(host, ev.promptId);
      break;
    case 'executing':
      if (!ev.node) { refreshSoon(host); break; }
      if (isForeign(host, ev.promptId)) {
        const cur = useComfyJobs.getState().hosts[host]?.live;
        if (cur?.promptId !== ev.promptId || cur.node !== ev.node) patchHost(host, { live: { promptId: ev.promptId, node: ev.node, value: 0, max: 0 } });
      } else checkOnce(host, ev.promptId);
      break;
    case 'status':
    case 'execution_start':
    case 'execution_success':
    case 'execution_error':
      refreshSoon(host);
      break;
    default:
      break;
  }
}

/** The embedded ComfyUI's last started prompt (its 'executing' events carry only the node). */
const framePrompt: Record<string, string> = {};

/** A raw event from the embedded ComfyUI's `app.api` (detail as its frontend dispatches it). */
export function frameEvent(host: string, type: string, detail: unknown): void {
  const d = (detail ?? {}) as { prompt_id?: unknown; value?: unknown; max?: unknown; node?: unknown };
  const pid = typeof d.prompt_id === 'string' ? d.prompt_id : framePrompt[host] ?? '';
  switch (type) {
    case 'execution_start':
      if (pid) framePrompt[host] = pid;
      onHostEvent(host, { type: 'execution_start', promptId: pid });
      break;
    case 'progress':
      if (pid) onHostEvent(host, { type: 'progress', promptId: pid, value: Number(d.value) || 0, max: Number(d.max) || 0, node: d.node == null ? null : String(d.node) });
      break;
    case 'executing': {
      const node = detail == null ? null : typeof detail === 'object' ? (d.node == null ? null : String(d.node)) : String(detail);
      if (pid) onHostEvent(host, { type: 'executing', promptId: pid, node });
      break;
    }
    case 'execution_success':
    case 'execution_error':
    case 'execution_interrupted':
    case 'status':
      refreshSoon(host);
      break;
    default:
      break;
  }
}

function watch(host: string, name: string) {
  const existing = useComfyJobs.getState().hosts[host];
  if (existing) { if (existing.name !== name) patchHost(host, { name }); return; }
  rebuild({ ...useComfyJobs.getState().hosts, [host]: { name, items: [], live: null } });
  const w: Watch = { unsub: () => {}, timer: undefined, soon: undefined, busy: false, stopped: false };
  watches.set(host, w);
  w.unsub = subscribeComfy(host, { onEvent: (ev) => onHostEvent(host, ev), onOpen: () => refreshSoon(host) });
  void refresh(host);
}

function unwatch(host: string) {
  const w = watches.get(host);
  if (w) { w.stopped = true; w.unsub(); window.clearTimeout(w.timer); window.clearTimeout(w.soon); watches.delete(host); }
  const hosts = { ...useComfyJobs.getState().hosts };
  delete hosts[host];
  rebuild(hosts);
}

function sync() {
  const origin = servedFromHost();
  const want = new Map<string, string>();
  for (const s of useStore.getState().servers) {
    if (s.enabled === false) continue;
    want.set(s.host, origin && s.host === origin ? 'This pod' : s.name);
  }
  for (const host of [...watches.keys()]) if (!want.has(host)) unwatch(host);
  for (const [host, name] of want) watch(host, name);
}

/** Mount once (AppEffects): watch every enabled server for prompts queued outside this app. */
export function useComfyJobsWatch(): void {
  useEffect(() => {
    sync();
    let last = useStore.getState().servers;
    const unsub = useStore.subscribe((s) => { if (s.servers !== last) { last = s.servers; sync(); } });
    const onVisible = () => { if (document.visibilityState === 'visible') for (const h of watches.keys()) refreshSoon(h); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      for (const h of [...watches.keys()]) unwatch(h);
    };
  }, []);
}

/** Cancel a "ComfyUI" row: running = interrupt that prompt, queued = take it off the queue. */
export async function cancelComfyRow(id: string): Promise<void> {
  const p = parseComfyRowId(id);
  if (!p) return;
  const item = useComfyJobs.getState().hosts[p.host]?.items.find((i) => i.promptId === p.promptId);
  try {
    if (item?.state === 'running') {
      // Newer ComfyUI interrupts only this prompt; older ones interrupt the running one, which it is.
      await fetch(`${comfyHttpFor(p.host)}/interrupt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_id: p.promptId }) });
    } else {
      await deleteQueuedPrompt(p.host, p.promptId);
    }
  } finally {
    refreshSoon(p.host);
  }
}
