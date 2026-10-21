/**
 * Prompt studio runs, outside the modal (fix list 2, "ADDED after close"): the option cards and
 * their LLM calls live here, per session, like the video / workflow run stores. Closing the studio
 * never stops a write; reopening shows the same cards (running, then finished). An option that
 * finishes while its session's studio is closed is `fresh`: the "✦ Write it" button counts those
 * (`useStudioBadge`) and opening the studio clears them. In memory only (the prompts themselves are
 * also kept in Recent writes, which is persisted).
 */
import { create } from 'zustand';
import { aiChat } from '@/lib/ai';
import type { AiSettings } from '@/lib/aiProviders';
import { useSessions } from '~/app/sessionsStore';
import { cleanPrompt } from './studioLogic';
import { useWriteIt } from './writeItStore';

export interface StudioOption { key: string; versions: string[]; busy: boolean; error?: string; fresh?: boolean }

interface RunsState {
  bySession: Record<string, StudioOption[]>;
  /** The session whose studio is open now, or null. */
  openFor: string | null;
}

const useRuns = create<RunsState>(() => ({ bySession: {}, openFor: null }));
const EMPTY: StudioOption[] = Object.freeze([]) as unknown as StudioOption[];
const ctrls = new Map<string, AbortController>();
let seq = 0;

/** The session results belong to: the open one. */
export function sessionNow(): string {
  try { return useSessions.getState().currentId || 'app'; } catch { return 'app'; }
}

export function useStudioOptions(sessionId: string): StudioOption[] {
  return useRuns((s) => s.bySession[sessionId] ?? EMPTY);
}

/** The button's state for a session: writing, and how many finished options wait unseen. */
export function useStudioBadge(sessionId: string): { running: boolean; fresh: number } {
  const running = useRuns((s) => (s.bySession[sessionId] ?? EMPTY).some((o) => o.busy));
  const fresh = useRuns((s) => (s.bySession[sessionId] ?? EMPTY).filter((o) => o.fresh && !o.busy).length);
  return { running, fresh };
}

function setList(sessionId: string, fn: (list: StudioOption[]) => StudioOption[]): void {
  useRuns.setState((s) => ({ bySession: { ...s.bySession, [sessionId]: fn(s.bySession[sessionId] ?? EMPTY) } }));
}

export function patchOption(sessionId: string, key: string, fn: (o: StudioOption) => StudioOption): void {
  setList(sessionId, (list) => list.map((o) => (o.key === key ? fn(o) : o)));
}

/** The studio opened (clears the badge) or closed for a session. */
export function setStudioOpen(sessionId: string | null): void {
  useRuns.setState((s) => {
    if (!sessionId) return { openFor: null };
    const list = s.bySession[sessionId];
    const cleared = list?.some((o) => o.fresh) ? list.map((o) => (o.fresh ? { ...o, fresh: false } : o)) : list;
    return { openFor: sessionId, bySession: cleared ? { ...s.bySession, [sessionId]: cleared } : s.bySession };
  });
}

/** New empty (busy) cards replacing the session's list; returns their keys. */
export function freshOptions(sessionId: string, n: number): string[] {
  const keys = Array.from({ length: n }, () => `o${++seq}`);
  for (const k of ctrls.keys()) if (k.startsWith(`${sessionId}|`)) { ctrls.get(k)?.abort(); ctrls.delete(k); }
  setList(sessionId, () => keys.map((key) => ({ key, versions: [], busy: true })));
  return keys;
}

/** A finished card from a text (Recent → Tweak). */
export function addOption(sessionId: string, text: string): void {
  setList(sessionId, (list) => [...list, { key: `o${++seq}`, versions: [text], busy: false }]);
}

export interface StudioRequest {
  settings: AiSettings;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  extra?: Record<string, unknown>;
  /** What the Recent list shows as the idea. */
  idea: string;
}

/** Write (or rewrite / tweak) one card in the background. */
export async function runOption(sessionId: string, key: string, req: StudioRequest): Promise<void> {
  const id = `${sessionId}|${key}`;
  ctrls.get(id)?.abort();
  const ctrl = new AbortController();
  ctrls.set(id, ctrl);
  patchOption(sessionId, key, (o) => ({ ...o, busy: true, error: undefined }));
  try {
    const raw = await aiChat({
      settings: req.settings, signal: ctrl.signal, extra: req.extra, temperature: req.temperature, maxTokens: req.maxTokens,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
    });
    if (ctrl.signal.aborted) return;
    const text = cleanPrompt(raw);
    if (!text) throw new Error('The AI returned nothing usable — try again.');
    const fresh = useRuns.getState().openFor !== sessionId;
    patchOption(sessionId, key, (o) => ({ ...o, busy: false, fresh, versions: [...o.versions, text] }));
    useWriteIt.getState().addRecent({ id: `${key}-${Date.now()}`, at: Date.now(), idea: req.idea, prompt: text });
  } catch (e) {
    if (!ctrl.signal.aborted) patchOption(sessionId, key, (o) => ({ ...o, busy: false, error: e instanceof Error ? e.message : 'Writing failed' }));
  } finally {
    if (ctrls.get(id) === ctrl) ctrls.delete(id);
  }
}
