/**
 * Bridge to the fullscreen model viewer (`~/screens/modelViewer`, another owner, may not exist
 * yet). A glob that matches nothing is an empty object, so the build passes either way; when the
 * folder lands, a tap on a preview image opens it. Loaded lazily on the first tap.
 */
import type { PreviewImage } from '@/lib/previewOrder';

type Start = PreviewImage & { versionId?: number };
export type ViewerTarget = { modelId: number; versionId?: number | null; imageIndex?: number; start?: Start } | { file: string; start?: Start };

const mods = import.meta.glob('../modelViewer/index.ts');

export function hasModelViewer(): boolean { return Object.keys(mods).length > 0; }

export async function openModelViewer(t: ViewerTarget): Promise<boolean> {
  const load = Object.values(mods)[0];
  if (!load) return false;
  const m = (await load()) as { openModelViewer?: (t: ViewerTarget) => void };
  if (!m.openModelViewer) return false;
  m.openModelViewer(t);
  return true;
}
