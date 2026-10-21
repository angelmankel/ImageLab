/**
 * FIXLIST-2 #51, the pure part: prompts on a ComfyUI server that this app did not queue (the
 * embedded ComfyUI's own Run / Queue, another client) as rows for our Jobs popover / job row / tab
 * title, labelled "ComfyUI". No React, no stores: tested in tests/comfyJobs.test.cjs.
 */
export interface ForeignItem {
  promptId: string;
  number: number;
  state: 'running' | 'queued';
  graph: Record<string, unknown>;
}

/** Progress of the running prompt, from the bus or the embedded ComfyUI's own socket. */
export interface ForeignLive { promptId: string; node: string | null; value: number; max: number }

/** The row shape of `~/app/queueLogic` (kept structural so this file imports nothing). */
export interface ComfyQueueRow {
  id: string;
  source: 'comfy';
  label: string;
  status: 'running' | 'queued';
  progress?: number;
  startedAt?: number;
  detail?: string;
}

/**
 * `/queue` → the prompts that are not ours: `extra_data.client_id` is not this app's client id
 * and the id is not one of our known prompt ids. Running first, then queued in run order.
 */
export function foreignItems(raw: unknown, ourClientId: string, ours: ReadonlySet<string> = new Set()): ForeignItem[] {
  const json = (raw ?? {}) as { queue_running?: unknown; queue_pending?: unknown };
  const map = (arr: unknown, state: ForeignItem['state']): ForeignItem[] => {
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((e): ForeignItem[] => {
      if (!Array.isArray(e)) return [];
      const promptId = String(e[1] ?? '');
      if (!promptId || ours.has(promptId)) return [];
      const extra = (e[3] && typeof e[3] === 'object' ? e[3] : {}) as { client_id?: unknown };
      if (ourClientId && extra.client_id === ourClientId) return [];
      const number = Number(e[0]);
      const graph = e[2] && typeof e[2] === 'object' ? (e[2] as Record<string, unknown>) : {};
      return [{ promptId, number: Number.isFinite(number) ? number : 0, state, graph }];
    });
  };
  return [...map(json.queue_running, 'running'), ...map(json.queue_pending, 'queued').sort((a, b) => a.number - b.number)];
}

/** A node's title in an API graph: `_meta.title`, else its class, else "node <id>". */
export function graphNodeName(graph: Record<string, unknown> | null | undefined, nodeId: string | null): string {
  if (!nodeId) return '';
  const n = graph?.[nodeId] as { class_type?: unknown; _meta?: { title?: unknown } } | undefined;
  const title = n?._meta?.title;
  if (typeof title === 'string' && title) return title;
  if (typeof n?.class_type === 'string' && n.class_type) return n.class_type;
  return `node ${nodeId}`;
}

const ROW_PREFIX = 'comfy:';
export const comfyRowId = (host: string, promptId: string) => `${ROW_PREFIX}${host}|${promptId}`;
export function parseComfyRowId(id: string): { host: string; promptId: string } | null {
  if (!id.startsWith(ROW_PREFIX)) return null;
  const rest = id.slice(ROW_PREFIX.length);
  const bar = rest.lastIndexOf('|');
  return bar > 0 ? { host: rest.slice(0, bar), promptId: rest.slice(bar + 1) } : null;
}

/** 0..1 when the live progress is for this prompt and has a max. */
export function liveFraction(live: ForeignLive | null | undefined, promptId: string): number | undefined {
  if (!live || live.promptId !== promptId || !(live.max > 0)) return undefined;
  return Math.min(1, Math.max(0, live.value / live.max));
}

/** Rows for one host: label "ComfyUI", detail "<server> · <node> · 12/20" while running. */
export function foreignRows(
  host: string, serverName: string, items: readonly ForeignItem[], live: ForeignLive | null, firstSeen: Readonly<Record<string, number>>,
): ComfyQueueRow[] {
  return items.map((it) => {
    const running = it.state === 'running';
    const on = running && live?.promptId === it.promptId ? live : null;
    const node = on ? graphNodeName(it.graph, on.node) : '';
    const steps = on && on.max > 0 ? `${on.value}/${on.max}` : '';
    return {
      id: comfyRowId(host, it.promptId), source: 'comfy', label: 'ComfyUI', status: it.state,
      progress: running ? liveFraction(live, it.promptId) : undefined,
      startedAt: firstSeen[it.promptId],
      detail: [serverName, node, steps].filter(Boolean).join(' · ') || undefined,
    };
  });
}

/** The chip over the ComfyUI frame: "KSampler · 12/20 · 60%" / "Running…" (+ " · 2 queued"). */
export function chipText(node: string, live: ForeignLive | null, queued: number): string {
  const parts: string[] = [];
  if (node) parts.push(node);
  if (live && live.max > 0) parts.push(`${live.value}/${live.max}`, `${Math.round((live.value / live.max) * 100)}%`);
  if (!parts.length) parts.push('Running…');
  if (queued > 0) parts.push(`${queued} queued`);
  return parts.join(' · ');
}
