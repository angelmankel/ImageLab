/**
 * Which step queued a video / workflow run (item 46): the run stores know prompt ids, not steps.
 * `runTagged` notes the prompt ids a step's Generate added; the queue rows (job row, Job queue,
 * tab title's "step 2") read them back with `runStepOf`. Session memory only. Each run also gets
 * its owner (session + step, `~/app/outputs`), captured when Generate was pressed, so its preview
 * and results go to the session that asked for it (fix list 2, item 15).
 */
import type { RunStore } from '@/lib/comfyRunner';
import { noteRunStart } from './stepFingerprint';
import { ownerOfStep, recordJob } from './outputs';

const tags = new Map<string, string>();

export async function runTagged(store: RunStore, stepId: string, fn: () => Promise<unknown>): Promise<void> {
  const before = new Set(store.getState().jobs.map((j) => j.promptId));
  noteRunStart(store, stepId);
  const owner = ownerOfStep(stepId);
  await fn();
  for (const j of store.getState().jobs) {
    if (before.has(j.promptId)) continue;
    tags.set(j.promptId, stepId);
    if (owner) recordJob(j.promptId, owner);
  }
  if (tags.size > 500) for (const k of [...tags.keys()].slice(0, 250)) tags.delete(k);
}

export const runStepOf = (promptId: string): string | undefined => tags.get(promptId);
