/**
 * Cross-screen actions. The Library, Models and ComfyUI screens call these; the Image step
 * (owner: the Shell + Image step agent) implements them against the main app's stores.
 * Keep the signatures; fill the bodies. Everything is a plain function so a screen can call it
 * from an event handler without hooks.
 */
import type { HistoryEntry } from '@/lib/types';

/** Put this prompt (positive + negative) into the active step's prompt. */
export function usePromptFrom(entry: Pick<HistoryEntry, 'positive' | 'negative'>): void {
  console.warn('[next] usePromptFrom not wired yet', entry);
}

/** Copy every setting of this history entry (model, size, steps, cfg, sampler, seed…) into the active step. */
export function reuseSettingsFrom(entry: HistoryEntry): void {
  console.warn('[next] reuseSettingsFrom not wired yet', entry);
}

/** Make this image the input of a step (default: the next step after the active one). */
export function sendToStep(image: { url: string; entry?: HistoryEntry }, stepId?: string): void {
  console.warn('[next] sendToStep not wired yet', image, stepId);
}

/** Models screen → the active step: apply a CivitAI sample's generation data. */
export function applyGenerationData(meta: { prompt?: string; negativePrompt?: string; steps?: number; cfgScale?: number; sampler?: string; seed?: number; width?: number; height?: number; [k: string]: unknown }, what: 'prompt' | 'settings'): void {
  console.warn('[next] applyGenerationData not wired yet', what, meta);
}
