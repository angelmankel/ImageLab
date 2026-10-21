/**
 * Fix list 2 (ADDED after close): "after a job is done, it should set the current image for that
 * session to that latest image in the job". The pure rule, tested in tests/sessionPick.test.cjs;
 * `sessionPick.ts` applies it to the stores.
 */

export type LandedPick = { kind: 'entry'; key: string } | { kind: 'run'; key: string };

/**
 * What a finished job (`promptId`) makes current: the first picture of the job — the image
 * history first (newest first; a batch is pushed so its first picture is on top), else the run
 * results (a run's pictures land on top in their own order). null = its output is not there yet.
 */
export function landedPick(
  promptId: string,
  history: ReadonlyArray<{ id: string; promptId?: string }>,
  runs: ReadonlyArray<ReadonlyArray<{ url: string; promptId?: string }>>,
): LandedPick | null {
  const e = history.find((h) => h.promptId === promptId);
  if (e) return { kind: 'entry', key: e.id };
  for (const list of runs) {
    const r = list.find((x) => x.promptId === promptId);
    if (r) return { kind: 'run', key: r.url };
  }
  return null;
}

/** Job ids that were in `prev` and are gone from `next` (finished, failed or cancelled). */
export function endedJobs(prev: readonly string[], next: readonly string[]): string[] {
  if (!prev.length) return [];
  const now = new Set(next);
  return prev.filter((id) => !now.has(id));
}
