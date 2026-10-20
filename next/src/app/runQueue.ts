/**
 * Item 46: every Generate press queues a job, even while the previous press is still being
 * submitted (the main app's `fireFromStore` drops a press that lands mid-submit). Presses run one
 * after another, each reading the parameters when its turn comes (a few ms after the press).
 */
let chain: Promise<unknown> = Promise.resolve();

export function enqueueRun(fn: () => Promise<unknown> | unknown): Promise<void> {
  const next = chain.then(() => fn()).then(() => undefined, (err: unknown) => { console.warn('[runQueue] a queued press failed', err); });
  chain = next;
  return next;
}
