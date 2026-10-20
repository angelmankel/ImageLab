/**
 * Item 43: the Remove BG graph, pure (no imports, so the node test can load it). ComfyUI core's
 * background removal (`comfy_extras/nodes_bg_removal`, BiRefNet in models/background_removal):
 *   LoadImage → LoadBackgroundRemovalModel → RemoveBackground (foreground mask) → InvertMask
 *   → JoinImageWithAlpha → SaveImage.
 * JoinImageWithAlpha takes "1 = transparent" (LoadImage's mask convention) and inverts it, so the
 * foreground mask is inverted first: the subject stays opaque, the background goes clear (RGBA PNG).
 * Shared by the canvas toolbar button (`removeBg.ts`) and the steps agent's Remove BG step.
 */

export const REMOVE_BG_MODEL = 'birefnet.safetensors';
/** The node whose images are the result. */
export const REMOVE_BG_OUT = '6';
/** The ComfyUI node classes the graph needs (for a "missing node" check). */
export const REMOVE_BG_NODES = ['LoadBackgroundRemovalModel', 'RemoveBackground', 'InvertMask', 'JoinImageWithAlpha'] as const;

type Node = { class_type: string; inputs: Record<string, unknown> };

/**
 * The API graph. `ref` = a LoadImage name ("imagelab/foo.png"); `model` = a file in
 * models/background_removal; `prefix` = SaveImage's filename prefix.
 */
export function removeBgGraph(ref: string, model: string = REMOVE_BG_MODEL, prefix = 'imagelab/removebg'): Record<string, Node> {
  return {
    '1': { class_type: 'LoadImage', inputs: { image: ref } },
    '2': { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: model } },
    '3': { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['2', 0], image: ['1', 0] } },
    '4': { class_type: 'InvertMask', inputs: { mask: ['3', 0] } },
    '5': { class_type: 'JoinImageWithAlpha', inputs: { image: ['1', 0], alpha: ['4', 0] } },
    [REMOVE_BG_OUT]: { class_type: 'SaveImage', inputs: { images: ['5', 0], filename_prefix: prefix } },
  };
}

/** The model to use from what the server lists: the default when present, else the first, else null. */
export function pickRemoveBgModel(options: readonly string[]): string | null {
  return options.includes(REMOVE_BG_MODEL) ? REMOVE_BG_MODEL : options[0] ?? null;
}

/** "photo.final.jpg" → "photo.final_nobg.png" (the cut-out is always a PNG). */
export function noBgName(filename: string): string {
  const base = (filename.split('/').pop() || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}_nobg.png`;
}
