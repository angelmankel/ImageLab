/**
 * The one workspace: Image, Video and Workflow are modes of a single layout, not separate views.
 *
 * The three old `mainView` values stay as the persisted state and *are* the mode, so nothing saved
 * has to migrate and every `setMainView('video')` caller still lands in the right place. Imports
 * nothing, so the tests load it from source.
 */

export type WorkspaceMode = 'image' | 'video' | 'workflow';
/** The `mainView` values that are workspace modes. */
export type WorkspaceView = 'generate' | 'video' | 'studio';

export const WORKSPACE_MODES: readonly { mode: WorkspaceMode; view: WorkspaceView; label: string; noun: string }[] = [
  { mode: 'image', view: 'generate', label: 'Image', noun: 'image' },
  { mode: 'video', view: 'video', label: 'Video', noun: 'video' },
  { mode: 'workflow', view: 'studio', label: 'Workflow', noun: 'result' },
];

export function modeOfView(view: string): WorkspaceMode | null {
  return WORKSPACE_MODES.find(m => m.view === view)?.mode ?? null;
}

export function viewOfMode(mode: WorkspaceMode): WorkspaceView {
  return WORKSPACE_MODES.find(m => m.mode === mode)?.view ?? 'generate';
}

export const isWorkspaceView = (view: string): view is WorkspaceView => modeOfView(view) !== null;

/** How much of a mode is on screen: the few critical things, or every parameter. */
export type Detail = 'simple' | 'advanced';

/** Image sections (`lib/panelTabs.ts` ids) that simple mode shows. The rest wait behind Advanced. */
const SIMPLE_IMAGE_SECTIONS = new Set(['prompts', 'models', 'composition', 'input']);
/** Video sections (`lib/videoSections.ts` ids) that simple mode shows. */
const SIMPLE_VIDEO_SECTIONS = new Set(['mode', 'prompt', 'size']);

export function sectionTier(id: string): Detail {
  return SIMPLE_IMAGE_SECTIONS.has(id) ? 'simple' : 'advanced';
}
export function videoSectionTier(id: string): Detail {
  return SIMPLE_VIDEO_SECTIONS.has(id) ? 'simple' : 'advanced';
}

/** The sections a detail level shows, in the given order; advanced shows all of them. */
export function visibleSections<T extends string>(order: readonly T[], detail: Detail, tier: (id: T) => Detail): T[] {
  return detail === 'advanced' ? [...order] : order.filter(id => tier(id) === 'simple');
}

/** One finished thing to show: an image or a video, wherever it came from. */
export interface ResultItem {
  key: string;
  url: string;
  kind: 'image' | 'video';
  filename: string;
  createdAt: number;
}

export const isVideoFile = (name: string) => /\.(mp4|webm|mov)$/i.test(name);

/** Recently used snippet ids, newest first, capped: what the quick picker leads with. */
export function pushRecent(list: readonly string[], id: string, max = 12): string[] {
  return [id, ...list.filter(x => x !== id)].slice(0, max);
}

/**
 * The order the snippet chips come in: the ones already in the prompt first (so they can be taken
 * out again), then recents newest first, then the rest as given.
 */
export function chipOrder<T extends { id: string }>(all: readonly T[], inPrompt: ReadonlySet<string>, recents: readonly string[]): T[] {
  const byId = new Map(all.map(s => [s.id, s]));
  const out: T[] = [];
  const seen = new Set<string>();
  const take = (id: string) => { const s = byId.get(id); if (s && !seen.has(id)) { seen.add(id); out.push(s); } };
  for (const s of all) if (inPrompt.has(s.id)) take(s.id);
  for (const id of recents) take(id);
  for (const s of all) take(s.id);
  return out;
}
