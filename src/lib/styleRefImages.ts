import { openDB, type IDBPDatabase } from 'idb';
import type { WorkflowState } from './types';

/**
 * The pictures of the Style tab's references (`WorkflowState.styleRefs[].images`), kept in the
 * browser: IndexedDB `imagelab-style-refs`, keyed by a hash of the stored bytes (the workflow,
 * the history snapshot and the fingerprint carry only that key + a small thumbnail). Its own
 * database, like `importedDb.ts`, so no other store's upgrade can touch it.
 *
 * `uploadStyleImages(host, workflow)` sends each active picture to a server's input/ folder at
 * queue time and returns key → LoadImage ref for `buildGraph`'s `styleImages`.
 */
const DB_NAME = 'imagelab-style-refs';
const STORE = 'blobs';
let _db: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_db) _db = openDB(DB_NAME, 1, { upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); } });
  return _db;
}

/** Hex SHA-256 (first 20 chars) of a blob's bytes. */
export async function blobKey(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function putStyleImage(key: string, blob: Blob): Promise<void> {
  await (await db()).put(STORE, blob, key);
}

export async function getStyleImage(key: string): Promise<Blob | undefined> {
  try { return (await (await db()).get(STORE, key)) as Blob | undefined; } catch { return undefined; }
}

/** Upload every picture of the workflow's references that will run (`use` set) to `host`. Throws when one is gone from this browser. */
export async function uploadStyleImages(
  host: string,
  workflow: WorkflowState,
  upload: (host: string, blob: Blob, name: string) => Promise<string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of workflow.styleRefs ?? []) {
    if (!r.use) continue;
    for (const im of r.images) {
      if (out[im.key]) continue;
      const blob = await getStyleImage(im.key);
      if (!blob) throw new Error(`The picture "${im.name}" of a style reference is no longer in this browser: add it again`);
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      out[im.key] = await upload(host, blob, `styleref-${im.key}.${ext}`);
    }
  }
  return out;
}
