/**
 * Hint metadata (item 26): ONE list, parameter id → name + help text, shown as the tooltip of
 * that control (`<Tip hint="steps">`, `SliderRow id="steps"`, `Button hint=…`). Donny edits the
 * texts in Settings → Hints (overrides saved in this browser under `imagelab.next.hints.v1`,
 * stock text when an override is empty); the global on / off is the same store (`enabled`,
 * remembered), flipped by the footer's `HintsToggle` or the H key (`useHintsHotkey`).
 * Add a parameter: one line in HINTS. Pure except the zustand store.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HintMeta { id: string; label: string; hint: string; group: string }

const g = (group: string, rows: Array<[string, string, string]>): HintMeta[] => rows.map(([id, label, hint]) => ({ id, label, hint, group }));

export const HINTS: readonly HintMeta[] = [
  ...g('Parameters', [
    ['steps', 'Steps', 'How many denoising passes. 20–30 is plenty for most models; more is slower and not always better. Turbo / lightning models want 4–8.'],
    ['cfg', 'CFG', 'How strictly the prompt is followed. 4–8 is typical; too high burns colours and over-sharpens, too low drifts off the prompt. Distilled models want 1–2.'],
    ['sampler', 'Sampler', 'The algorithm that removes the noise. euler is fast and clean; the _ancestral ones add variety each step; dpmpp_2m is a sharp all-rounder; _sde adds grain and detail.'],
    ['scheduler', 'Scheduler', 'How the noise is spread over the steps. normal / karras suit most models; sgm_uniform and simple are for turbo and video models; beta keeps more detail late.'],
    ['seed', 'Seed', 'The random start. The same seed, prompt and settings give the same picture. Lock it to vary one setting at a time; unlock for a new one every run.'],
    ['seed.lock', 'Keep the seed', 'Locked: every run uses this exact seed. Unlocked: a fresh seed is rolled for each run.'],
    ['batch', 'Batch', 'How many pictures one run makes, each with its own seed. More pictures need more VRAM and take longer.'],
    ['clipSkip', 'Clip skip', 'Stops the text encoder a few layers early. 2 is standard for anime / Pony / Illustrious models; off (1) for realistic SDXL and Flux.'],
    ['denoise', 'Denoise', 'How much of the input picture is repainted. 0.3 keeps it, 0.5 reshapes it, 0.8+ barely remembers it.'],
    ['width', 'Width', 'Picture width in pixels. Stay on multiples of 64 near the model\'s native size (SD 1.5: 512, SDXL: 1024).'],
    ['height', 'Height', 'Picture height in pixels. Stay on multiples of 64 near the model\'s native size (SD 1.5: 512, SDXL: 1024).'],
    ['aspect', 'Aspect ratio', 'The shape of the picture. Portrait for people, landscape for scenes, square for icons and avatars.'],
    ['longest', 'Longest side', 'The size of the longer edge; the other follows the aspect ratio. Bigger is slower and may repeat subjects on SD 1.5.'],
    ['vae', 'VAE', 'Decodes the latent into pixels. The built-in one is right for most checkpoints; a separate VAE fixes washed-out colours on some SD 1.5 models.'],
  ]),
  ...g('Models', [
    ['checkpoint', 'Checkpoint', 'The base model: it sets the style, the quality and which LoRAs fit (SD 1.5 · SDXL · Pony · Illustrious · Flux…).'],
    ['lora', 'LoRA', 'A small add-on that teaches the model a character, style or concept. Must match the checkpoint\'s base type.'],
    ['lora.strength', 'LoRA strength', 'How hard the LoRA pushes. 0.6–1.0 is normal; above 1.2 it tends to break anatomy and colours.'],
    ['embedding', 'Embedding', 'A textual inversion: a word the prompt can use. Negative embeddings (easynegative, badhands…) go in the negative prompt.'],
    ['controlnet', 'ControlNet', 'Guides the picture with a sketch, pose, depth map or edges taken from the guide image.'],
    ['controlnet.strength', 'ControlNet strength', 'How much the guide image steers the result. 0.5–0.8 keeps the composition without copying it.'],
    ['modelType', 'Model type', 'The base-model family read from CivitAI. It picks the start values, quality tags and which add-ons fit.'],
  ]),
  ...g('Loopback', [
    ['loopback', 'Loopback', 'Re-samples the picture several rounds, growing it each round: more detail at a bigger size without a separate upscale step.'],
    ['loopback.rounds', 'Rounds', 'How many times the picture is re-sampled. 2–3 rounds are usual; each round takes about as long as the first picture.'],
    ['loopback.grow', 'Grow per round', 'How much bigger the picture gets each round. ×1.5 is safe; ×2 needs a good denoise ramp.'],
    ['loopback.denoise', 'Loopback denoise', 'How much each round repaints. Start near 0.5 and end near 0.3 to add detail without changing the picture.'],
    ['loopback.noise', 'Extra noise', 'Fresh noise added before each round: more new detail and grain. 0 is off.'],
    ['loopback.steps', 'Loopback steps', 'Steps per round. Fewer than the first picture is fine: the denoise is low.'],
    ['loopback.cfg', 'Loopback CFG', 'Guidance per round. A little lower than the first picture keeps colours natural.'],
  ]),
  ...g('Prompt', [
    ['prompt', 'Prompt', 'What to draw. Subject first, then setting, light, style. Weights like (word:1.2) push a word harder.'],
    ['negative', 'Negative prompt', 'What to keep out: artefacts, extra limbs, text, watermarks. Keep it short; a huge negative hurts more than it helps.'],
    ['snippets', 'Snippets', 'Saved phrases to tap into the prompt. Your own and the suggested ones.'],
    ['style', 'Style', 'A saved look: style words that go to the end of the prompt.'],
  ]),
  ...g('Video', [
    ['video.frames', 'Frames', 'The length of the clip in frames at the engine\'s frame rate. Longer clips take much longer and may drift.'],
    ['video.fps', 'Frame rate', 'Frames per second of the saved clip. 16 is Wan\'s native rate; 24 is smoother and needs interpolation or more frames.'],
    ['video.fast', 'Fast mode', 'The 4-step distilled LoRA: about six times faster, slightly less motion. Good for drafts.'],
    ['video.shift', 'Shift', 'Moves the sampling schedule toward big-motion or fine-detail steps. 5–8 is the usual range for Wan.'],
    ['video.upscale', 'Upscale', 'Runs an upscale model on every frame before encoding. Slow; use it on the clip you like.'],
    ['video.interpolate', 'Interpolation', 'Makes in-between frames with RIFE / FILM: smoother motion at a higher frame rate.'],
  ]),
  ...g('Workflow', [
    ['workflow.param', 'Workflow parameter', 'A widget of a node in the saved ComfyUI workflow. Reset puts back the value saved in ComfyUI; the pin keeps it on top.'],
    ['workflow.input', 'Workflow input', 'The picture the workflow\'s Load Image node gets: the previous step\'s output, or one of yours.'],
  ]),
  ...g('App', [
    ['hints', 'Hints', 'Help text on every parameter. Turn them off once you know the controls (H).'],
    ['sound', 'Sounds', 'Small sounds for clicks, toggles and finished jobs. The mute button silences all of them.'],
    ['fullscreen', 'Fullscreen', 'The whole app full screen (F). Esc leaves it.'],
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
