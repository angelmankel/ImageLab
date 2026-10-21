/**
 * Which step queued a video / workflow run (item 46): the run stores know prompt ids, not steps.
 * `runTagged` notes the prompt ids a step's Generate added; the queue rows (job row, Job queue,
 * tab title's "step 2") read them back with `runStepOf`. Session memory only.
 */
import type { RunStore } from '@/lib/comfyRunner';
import { noteRunStart } from './stepFingerprint';

const tags = new Map<string, string>();

export async function runTagged(store: RunStore, stepId: string, fn: () => Promise<unknown>): Promise<void> {
  const before = new Set(store.getState().jobs.map((j) => j.promptId));
  noteRunStart(store, stepId);
  await fn();
  for (const j of store.getState().jobs) if (!before.has(j.promptId)) tags.set(j.promptId, stepId);
  if (tags.size > 500) for (const k of [...tags.keys()].slice(0, 250)) tags.delete(k);
}

export const runStepOf = (promptId: string): string | undefined => tags.get(promptId);
