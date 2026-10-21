/**
 * Hint metadata (item 26): ONE list, parameter id → name + help text, shown as the tooltip of
 * that control (`<Tip hint="steps">`, `SliderRow id="steps"`, `Button hint=…`). Donny edits the
 * texts in Settings → Hints (overrides saved in this browser under `imagelab.next.hints.v1`,
 * stock text when an override is empty); the global on / off is the same store (`enabled`,
 * remembered), flipped by the footer's `HintsToggle` or the H key (`UiEffects`).
 * Add a parameter: one line in HINTS. Pure except the zustand store.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HintMeta { id: string; label: string; hint: string; group: string }

const g = (group: string, rows: Array<[string, string, string]>): HintMeta[] => rows.map(([id, label, hint]) => ({ id, label, hint, group }));

export const HINTS: readonly HintMeta[] = [
  ...g('Parameters', [
    ['steps', 'Steps', 'How many denoising passes; 20–30 suits most models.'],
    ['cfg', 'CFG', 'How strictly the prompt is followed; 4–8 is typical.'],
    ['sampler', 'Sampler', 'The algorithm that removes the noise.'],
    ['scheduler', 'Scheduler', 'How the noise is spread over the steps.'],
    ['seed', 'Seed', 'The random start; the same seed repeats the picture.'],
    ['seed.lock', 'Keep the seed', 'Locked uses this seed every run.'],
    ['batch', 'Batch', 'How many pictures one run makes.'],
    ['clipSkip', 'Clip skip', '2 suits anime models; 1 suits realistic ones.'],
    ['denoise', 'Denoise', 'How much of the input picture is repainted.'],
    ['width', 'Width', 'Picture width; stay near the model\'s native size.'],
    ['height', 'Height', 'Picture height; stay near the model\'s native size.'],
    ['aspect', 'Aspect ratio', 'The shape of the picture.'],
    ['longest', 'Longest side', 'The size of the longer edge.'],
    ['vae', 'VAE', 'Turns the result into pixels; the built-in one fits most models.'],
  ]),
  ...g('Models', [
    ['checkpoint', 'Checkpoint', 'The base model: it sets the style and which LoRAs fit.'],
    ['lora', 'LoRA', 'A small add-on for a character, style or concept.'],
    ['lora.strength', 'LoRA strength', 'How hard the LoRA pushes; 0.6–1.0 is normal.'],
    ['embedding', 'Embedding', 'A trained word the prompt can use.'],
    ['controlnet', 'ControlNet', 'Guides the picture with a pose, depth map or edges.'],
    ['controlnet.strength', 'ControlNet strength', 'How much the guide image steers the result.'],
    ['modelType', 'Model type', 'The model family; it picks the start values.'],
  ]),
  ...g('Loopback', [
    ['loopback', 'Loopback', 'Re-samples and grows the picture for more detail.'],
    ['loopback.rounds', 'Rounds', 'How many times the picture is re-sampled.'],
    ['loopback.grow', 'Grow per round', 'How much bigger the picture gets each round.'],
    ['loopback.denoise', 'Loopback denoise', 'How much each round repaints.'],
    ['loopback.noise', 'Extra noise', 'Fresh noise before each round for more detail.'],
    ['loopback.steps', 'Loopback steps', 'Steps per round.'],
    ['loopback.cfg', 'Loopback CFG', 'Guidance per round.'],
  ]),
  ...g('Prompt', [
    ['prompt', 'Prompt', 'What to draw: subject, setting, light, style.'],
    ['negative', 'Negative prompt', 'What to keep out of the picture.'],
    ['snippets', 'Snippets', 'Saved phrases to tap into the prompt.'],
    ['style', 'Style', 'Style words added to the end of the prompt.'],
  ]),
  ...g('Video', [
    ['video.frames', 'Frames', 'The length of the clip in frames.'],
    ['video.fps', 'Frame rate', 'Frames per second of the saved clip.'],
    ['video.fast', 'Fast mode', 'About six times faster, slightly less motion.'],
    ['video.shift', 'Shift', 'Moves sampling toward big motion or fine detail.'],
    ['video.upscale', 'Upscale', 'Upscales every frame before saving; slow.'],
    ['video.interpolate', 'Interpolation', 'Adds in-between frames for smoother motion.'],
  ]),
  ...g('Workflow', [
    ['workflow.param', 'Workflow parameter', 'A setting of a node in the saved workflow.'],
    ['workflow.input', 'Workflow input', 'The picture the workflow\'s Load Image node gets.'],
  ]),
  ...g('App', [
    ['hints', 'Hints', 'Help text on every parameter.'],
    ['sound', 'Sounds', 'Small sounds for clicks and finished jobs.'],
    ['fullscreen', 'Fullscreen', 'The whole app full screen.'],
  ]),
];

const BY_ID: ReadonlyMap<string, HintMeta> = new Map(HINTS.map((h) => [h.id, h]));

/** The hint for an id with the overrides applied; unknown id → null. */
export function hintOf(id: string, overrides: Readonly<Record<string, string>> = {}): HintMeta | null {
  const base = BY_ID.get(id);
  if (!base) return null;
  const o = overrides[id];
  return o != null && o.trim() ? { ...base, hint: o } : base;
}

/** The groups in order with their rows (Settings → Hints). */
export function hintGroups(): Array<{ group: string; rows: HintMeta[] }> {
  const out: Array<{ group: string; rows: HintMeta[] }> = [];
  for (const h of HINTS) {
    const g2 = out.find((x) => x.group === h.group);
    if (g2) g2.rows.push(h);
    else out.push({ group: h.group, rows: [h] });
  }
  return out;
}

interface HintsState {
  enabled: boolean;
  overrides: Record<string, string>;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  setHint: (id: string, text: string) => void;
  resetHint: (id: string) => void;
  resetAll: () => void;
}

export const useHints = create<HintsState>()(
  persist(
    (set) => ({
      enabled: true,
      overrides: {},
      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setHint: (id, text) => set((s) => {
        const overrides = { ...s.overrides };
        const stock = BY_ID.get(id)?.hint;
        if (!text.trim() || text === stock) delete overrides[id];
        else overrides[id] = text;
        return { overrides };
      }),
      resetHint: (id) => set((s) => { const overrides = { ...s.overrides }; delete overrides[id]; return { overrides }; }),
      resetAll: () => set({ overrides: {} }),
    }),
    { name: 'imagelab.next.hints.v1' },
  ),
);

/** Read without subscribing (event handlers). */
export const hintsOn = () => useHints.getState().enabled;
