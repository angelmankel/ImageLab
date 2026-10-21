/**
 * Style tab: pure edits of the references list (tested in tests/styleTab.test.cjs). Every edit
 * returns a new array (zustand + undo compare by reference).
 */
import { methodDefaults, newStyleRef, samplerAdvice, type StyleFamily, type StyleRef, type StyleRefType, type StyleWhere } from '@/lib/styleRefs';

export function replaceRef(refs: readonly StyleRef[], id: string, patch: Partial<StyleRef>): StyleRef[] {
  return refs.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function removeRef(refs: readonly StyleRef[], id: string): StyleRef[] {
  return refs.filter((r) => r.id !== id);
}

/**
 * Add a reference of a type with the packs' defaults. Face starts on the first method a server
 * runs (`faceMethod`, FaceID v2 when it can). Returns the new list, its id and the step's CFG
 * when the reference needs a lower one (InstantID above CFG 5), else undefined.
 */
export function addRef(refs: readonly StyleRef[], id: string, type: StyleRefType, fam: StyleFamily | null, cfg: number, faceMethod?: StyleRef['method'], where: StyleWhere = 'image'):
  { refs: StyleRef[]; id: string; cfg?: number } {
  let r = newStyleRef(id, type, fam, where);
  if (type === 'face' && faceMethod && faceMethod !== 'faceid') r = { ...r, method: faceMethod, ...methodDefaults(faceMethod, where) };
  const a = samplerAdvice(r);
  return { refs: [...refs, r], id, cfg: a?.cfgMax != null && cfg > a.cfgMax ? a.cfg : undefined };
}

/** Drag to reorder: move a reference to an index (the order the stage chains them in). */
export function moveRef(refs: readonly StyleRef[], id: string, to: number): StyleRef[] {
  const from = refs.findIndex((r) => r.id === id);
  if (from < 0) return [...refs];
  const next = [...refs];
  const [r] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, r);
  return next;
}
