/**
 * The fullscreen model viewer lives in `~/screens/modelViewer` (another session's folder). It is
 * loaded on demand through a glob so this compiles and builds whether or not that folder exists
 * yet: a glob that matches nothing is an empty object and the tap does nothing.
 */
export type ModelViewerTarget = { modelId: number; versionId?: number | null; imageIndex?: number } | { file: string };

const mods = import.meta.glob('../../modelViewer/index.ts');

export async function openModelViewer(target: ModelViewerTarget): Promise<void> {
  const load = Object.values(mods)[0];
  if (!load) return;
  const m = (await load()) as { openModelViewer?: (t: ModelViewerTarget) => void };
  m.openModelViewer?.(target);
}

/** True when the viewer is part of this build (to show the picture as tappable). */
export const hasModelViewer = Object.keys(mods).length > 0;
