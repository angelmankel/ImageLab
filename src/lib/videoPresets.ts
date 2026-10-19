/**
 * Named video presets: a recipe (models, sampling, guidance, finish…) without the prompt, the
 * pictures or the seed, so one recipe serves many prompts. Applying one keeps what the preset left
 * out. The store is `features/video/videoPresets.ts`; this is the pure part, tested.
 *
 * Imports only `./wanGraph` (which imports nothing), so the tests load it from source.
 */
import { loadVideoSettings, type VideoSettings } from './wanGraph';

/** What a preset never carries: the thing being made and this run's seed. */
export const PRESET_EXCLUDED = ['positive', 'seed', 'randomizeSeed', 'endImage'] as const;
type Excluded = (typeof PRESET_EXCLUDED)[number];

export type VideoPresetBody = Omit<VideoSettings, Excluded>;

export interface VideoPreset {
  id: string;
  name: string;
  savedAt: number;
  settings: VideoPresetBody;
}

export function presetBody(s: VideoSettings): VideoPresetBody {
  const out: Record<string, unknown> = { ...s };
  for (const k of PRESET_EXCLUDED) delete out[k];
  // H3's reference pictures are pictures, not recipe.
  if (s.h3) out.h3 = { ...s.h3, refImages: [] };
  return JSON.parse(JSON.stringify(out)) as VideoPresetBody;
}

/** `current` with the preset's recipe over it; missing fields in an old preset keep their defaults. */
export function applyPreset(current: VideoSettings, preset: Pick<VideoPreset, 'settings'>): VideoSettings {
  const body = loadVideoSettings({ ...current, ...preset.settings });
  return {
    ...body, positive: current.positive, seed: current.seed, randomizeSeed: current.randomizeSeed, endImage: current.endImage,
    h3: { ...body.h3, refImages: current.h3?.refImages ?? [] },
  };
}

/** Whether the current settings are exactly this preset's recipe. */
export function matchesPreset(current: VideoSettings, preset: Pick<VideoPreset, 'settings'>): boolean {
  return JSON.stringify(presetBody(current)) === JSON.stringify(presetBody(loadVideoSettings({ ...current, ...preset.settings })));
}

/** A name that is not taken: "Name", "Name 2", "Name 3"… */
export function uniquePresetName(name: string, taken: readonly string[]): string {
  const base = name.trim() || 'Preset';
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base} ${i}`)) return `${base} ${i}`;
}
