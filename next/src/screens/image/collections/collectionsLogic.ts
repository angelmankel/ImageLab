/**
 * Collections in the history panel (FIXLIST 21), the pure part (tested in
 * tests/collections.test.cjs). A collection is the main store's `Collection` (`@/lib/types`):
 * an ordered list of item ids, where an id is a history entry id, a run result's key (its url)
 * or an imported picture's id (`importedImages`, bytes in IndexedDB). In the history panel a
 * picture lives in ONE collection: "move" takes it out of the others. The Library screen still
 * reads the same lists. Imports nothing at run time.
 */
export interface CollectionLike { id: string; name: string; itemIds: readonly string[] }

/** Move an item into `targetId` (appended = newest there), out of every other collection. */
export function moveInto<C extends CollectionLike>(collections: readonly C[], targetId: string, itemId: string): C[] {
  return collections.map((c) => {
    if (c.id === targetId) return { ...c, itemIds: [...c.itemIds.filter((i) => i !== itemId), itemId] };
    return c.itemIds.includes(itemId) ? { ...c, itemIds: c.itemIds.filter((i) => i !== itemId) } : c;
  });
}

/** Take an item out of every collection (back to "no collection"). */
export function removeEverywhere<C extends CollectionLike>(collections: readonly C[], itemId: string): C[] {
  return collections.map((c) => (c.itemIds.includes(itemId) ? { ...c, itemIds: c.itemIds.filter((i) => i !== itemId) } : c));
}

/** The collection an item is in (the first, if an old Library pick put it in several). */
export function collectionOf<C extends CollectionLike>(collections: readonly C[], itemId: string): C | null {
  return collections.find((c) => c.itemIds.includes(itemId)) ?? null;
}

/** Put a deleted collection back where it was (Undo), unless it is back already. */
export function restoreAt<C extends CollectionLike>(collections: readonly C[], c: C, index: number): C[] {
  if (collections.some((x) => x.id === c.id)) return [...collections];
  const out = [...collections];
  out.splice(Math.max(0, Math.min(index, out.length)), 0, c);
  return out;
}

/** "Collection 3": the first number no collection uses yet. */
export function nextName(collections: readonly CollectionLike[]): string {
  const used = new Set(collections.map((c) => c.name.trim().toLowerCase()));
  for (let n = collections.length + 1; ; n++) if (!used.has(`collection ${n}`)) return `Collection ${n}`;
}

/** The ids a collection shows, newest added first, keeping only those that still exist. */
export function shownIds(c: CollectionLike, exists: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (let i = c.itemIds.length - 1; i >= 0; i--) if (exists(c.itemIds[i])) out.push(c.itemIds[i]);
  return out;
}

/** The cover: the newest item that still exists, or null. */
export function coverId(c: CollectionLike, exists: (id: string) => boolean): string | null {
  for (let i = c.itemIds.length - 1; i >= 0; i--) if (exists(c.itemIds[i])) return c.itemIds[i];
  return null;
}
