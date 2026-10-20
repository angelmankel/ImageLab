/**
 * Which stores hold entries that wait for a download (models-picker brief, item 5, made
 * store-agnostic): the Image step's workflow, the Video step's `videoStore`, a Workflow step's
 * loader widgets. Each registers a scope once at module load; `usePendingReconcile` asks every
 * scope to land a file that arrived (by file name, so two steps waiting on the same LoRA both
 * flip) and asks a record's own scope whether its entry still exists.
 */
import type { PendingRecord } from './pendingLogic';

export interface PendingScope {
  /** The waiting entry still exists (false drops the record). */
  has: (record: PendingRecord) => boolean;
  /** The file landed under the server's name `file`: rename the waiting entries, restore On. */
  land: (record: PendingRecord, file: string) => void;
}

export const IMAGE_SCOPE = 'image';

const scopes = new Map<string, PendingScope>();

export function registerPendingScope(name: string, scope: PendingScope): void {
  scopes.set(name, scope);
}

export const pendingScopes = (): ReadonlyMap<string, PendingScope> => scopes;

/** The scope a record belongs to (none = the Image step). */
export const scopeOf = (r: Pick<PendingRecord, 'scope'>): string => r.scope ?? IMAGE_SCOPE;
