/**
 * Fix list 2 #19 + #15: which session each job belongs to, for the tab's running indicator. A row
 * that carries a `sessionId` (item 15's routing) says it; otherwise its step id finds the session
 * that holds that step. Pure (tests/tabJobs.test.cjs).
 */

export interface TabJob { running: boolean; progress: number | null; count: number }

interface RowLike { stepId?: string; sessionId?: string; status: 'running' | 'queued'; progress?: number }
interface SessionLike { id: string; steps: ReadonlyArray<{ id: string }> }

export function jobsBySession(rows: readonly RowLike[], sessions: readonly SessionLike[]): Record<string, TabJob> {
  const owner = new Map<string, string>();
  for (const s of sessions) for (const st of s.steps) owner.set(st.id, s.id);
  const out: Record<string, TabJob> = {};
  for (const r of rows) {
    const sid = r.sessionId ?? (r.stepId ? owner.get(r.stepId) : undefined);
    if (!sid) continue;
    const t = out[sid] ?? (out[sid] = { running: false, progress: null, count: 0 });
    t.count += 1;
    if (r.status === 'running') { t.running = true; if (r.progress != null) t.progress = Math.max(t.progress ?? 0, r.progress); }
  }
  return out;
}
