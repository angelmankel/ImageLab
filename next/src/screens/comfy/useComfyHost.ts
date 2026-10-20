/**
 * Everything live about one ComfyUI host for the ComfyUI screen (rule 14): online + GPU from
 * `/system_stats`, the queue from `/queue` (polled while the page is visible, refreshed at once when
 * the bus says the queue moved), the running prompt's progress, and the log.
 *
 * The log is the bus's messages for that host: this SUBSCRIBES to `@/lib/comfyBus` (one websocket
 * per host, owned there) and never opens a socket. Lines are kept per host for the session, so
 * leaving the screen and coming back keeps them.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { subscribeComfy, type ComfyEvent } from '@/lib/comfyBus';
import { fetchQueueRaw, fetchSystemStats } from './comfyApi';
import { appendLog, logLine, queueRows, readStats, type LiveProgress, type LogEvent, type LogLine, type QueueRow, type ServerStats } from './comfyHelpers';

const POLL_MS = 3000;
const EMPTY_LINES: readonly LogLine[] = Object.freeze([]);
const EMPTY_ROWS: readonly QueueRow[] = Object.freeze([]);

interface LogState {
  lines: Record<string, LogLine[]>;
  push: (host: string, line: LogLine) => void;
  clear: (host: string) => void;
}

export const useComfyLog = create<LogState>((set) => ({
  lines: {},
  push: (host, line) => set((s) => ({ lines: { ...s.lines, [host]: appendLog(s.lines[host] ?? EMPTY_LINES, line) } })),
  clear: (host) => set((s) => ({ lines: { ...s.lines, [host]: [] } })),
}));

/** The log lines for a host (a stable empty list when there are none). */
export function useHostLog(host: string | null): readonly LogLine[] {
  return useComfyLog((s) => (host ? s.lines[host] ?? EMPTY_LINES : EMPTY_LINES));
}

export interface ComfyHostState {
  /** null until the first answer. */
  online: boolean | null;
  stats: ServerStats | null;
  rows: readonly QueueRow[];
  live: LiveProgress | null;
  /** The bus socket for this host is open. */
  connected: boolean;
  refresh: () => void;
}

export function useComfyHost(host: string | null, names?: Record<string, string>): ComfyHostState {
  const [online, setOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [rows, setRows] = useState<readonly QueueRow[]>(EMPTY_ROWS);
  const [live, setLive] = useState<LiveProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const [nonce, setNonce] = useState(0);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const namesRef = useRef(names);
  namesRef.current = names;
  const kick = useRef<() => void>(() => {});

  // Poll status + queue.
  useEffect(() => {
    setOnline(null); setStats(null); setRows(EMPTY_ROWS); setLive(null);
    if (!host) return;
    let stopped = false;
    let timer: number | undefined;
    let soon: number | undefined;

    const tick = async () => {
      if (stopped) return;
      window.clearTimeout(timer);
      if (document.visibilityState !== 'hidden') {
        const [s, q] = await Promise.allSettled([fetchSystemStats(host), fetchQueueRaw(host)]);
        if (stopped) return;
        setOnline(s.status === 'fulfilled' || q.status === 'fulfilled');
        if (s.status === 'fulfilled') setStats(readStats(s.value));
        if (q.status === 'fulfilled') {
          const next = queueRows(q.value, namesRef.current);
          setRows(next.length ? next : EMPTY_ROWS);
          if (!next.some((r) => r.state === 'running')) setLive(null);
        }
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    kick.current = () => { window.clearTimeout(soon); soon = window.setTimeout(() => void tick(), 250); };

    void tick();
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer); window.clearTimeout(soon);
      kick.current = () => {};
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [host, nonce]);

  // Listen on the bus: progress, log, and "the queue moved".
  useEffect(() => {
    setConnected(false);
    if (!host) return;
    const push = useComfyLog.getState().push;
    const graphOf = (id: string) => rowsRef.current.find((r) => r.id === id)?.graph ?? null;
    const log = (ev: LogEvent) => {
      const line = logLine(ev, Date.now(), graphOf);
      if (line) push(host, line);
    };
    const onEvent = (ev: ComfyEvent) => {
      switch (ev.type) {
        case 'binary': return;
        case 'progress':
          setLive({ promptId: ev.promptId, node: ev.node, value: ev.value, max: ev.max });
          break;
        case 'executing':
          if (ev.node) setLive({ promptId: ev.promptId, node: ev.node, value: 0, max: 0 });
          break;
        case 'execution_start':
        case 'status':
          kick.current();
          break;
        case 'execution_success':
        case 'execution_error':
          setLive(null);
          kick.current();
          break;
        default:
          break;
      }
      log(ev as LogEvent);
    };
    const unsubscribe = subscribeComfy(host, {
      onOpen: () => { setConnected(true); log({ type: 'open' }); },
      onClose: () => { setConnected(false); log({ type: 'close' }); },
      onEvent,
    });
    return unsubscribe;
  }, [host]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { online, stats, rows, live, connected, refresh };
}
