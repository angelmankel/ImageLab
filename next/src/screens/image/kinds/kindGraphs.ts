/**
 * The pure graph parts of the Refine / Upscale / Remove BG steps (fix list 15, 22, 43), tested in
 * tests/kindGraphs.test.cjs. No imports, so node can load it.
 *
 *  - `serverRef`: a picture that already lives on the target server (a /view URL of that host) is
 *    used where it is, as an annotated LoadImage name ("sub/x.png [output]"), instead of being
 *    downloaded and uploaded again (fix list 31: that round trip was the slow part of sending).
 *  - `skipBaseSampler`: Refine and "Upscale + refine" reuse the session's classic graph (models,
 *    LoRAs, prompt, the Loopback rounds / passes) built in img2img mode, then take its base sampler
 *    out: whatever read the sampler's latent reads the encoded input instead, whatever read its
 *    decoded picture reads the input picture. So the rounds start from the step's input.
 *  - `upscaleGraph`: a plain upscale — LoadImage → upscale model → exact size → SaveImage, or a
 *    lanczos resize when the server has no upscale model.
 */

type Node = { class_type: string; inputs: Record<string, unknown> };
export type ApiGraph = Record<string, Node>;
type Ref = [string, number];

/** The LoadImage name for a picture already on `base` (`<scheme>://host/...`), or null when it is not one of its /view URLs. */
export function serverRef(url: string, base: string): string | null {
  const prefix = `${base.replace(/\/$/, '')}/view?`;
  if (!url.startsWith(prefix)) return null;
  const q = new URLSearchParams(url.slice(prefix.length));
  const filename = q.get('filename');
  if (!filename) return null;
  const sub = q.get('subfolder') ?? '';
  const type = q.get('type') || 'output';
  const path = sub ? `${sub}/${filename}` : filename;
  return type === 'input' ? path : `${path} [${type}]`;
}

const isRef = (v: unknown, id: string, slot: number): boolean => Array.isArray(v) && v.length === 2 && v[0] === id && v[1] === slot;

/**
 * Take the base sampler ("3") and its decode ("8") out of a classic img2img graph: references to
 * ["3", 0] become the encoded input ["i1", 0], references to ["8", 0] the input picture ["i0", 0].
 * Returns a new graph; null when the graph has no img2img input (nothing to start from).
 */
export function skipBaseSampler(graph: ApiGraph): ApiGraph | null {
  if (!graph.i0 || !graph.i1 || !graph['3']) return null;
  const out: ApiGraph = {};
  for (const [id, node] of Object.entries(graph)) {
    if (id === '3' || id === '8') continue;
    const inputs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.inputs)) {
      inputs[k] = isRef(v, '3', 0) ? ['i1', 0] : isRef(v, '8', 0) ? ['i0', 0] : v;
    }
    out[id] = { ...node, inputs };
  }
  return out;
}

/** True when the output node reads the input picture directly (no round ran: nothing to refine). */
export const outputIsInput = (graph: ApiGraph, outId = '9'): boolean => isRef(graph[outId]?.inputs.images, 'i0', 0);

export interface UpscaleSpec {
  /** LoadImage name of the picture. */
  ref: string;
  /** Upscale model file; null = a plain lanczos resize. */
  model: string | null;
  /** The size multiplier the step lands on. */
  factor: number;
  /** The picture's size, when known: the result is exactly `factor` × it (rounded to 8). */
  width?: number;
  height?: number;
  /** The model's own scale (×2, ×4), used when the size is unknown. */
  nativeScale?: number;
  prefix?: string;
}

/** The plain Upscale graph; the result is node "9" (SaveImage). */
export function upscaleGraph(s: UpscaleSpec): ApiGraph {
  const g: ApiGraph = { i0: { class_type: 'LoadImage', inputs: { image: s.ref } } };
  let img: Ref = ['i0', 0];
  const factor = Math.max(1, s.factor);
  if (s.model) {
    g.u1 = { class_type: 'UpscaleModelLoader', inputs: { model_name: s.model } };
    g.u2 = { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['u1', 0], image: img } };
    img = ['u2', 0];
    // The model's own ×2 / ×4 is brought to the asked factor.
    if (s.width && s.height) {
      g.u3 = { class_type: 'ImageScale', inputs: { image: img, width: round8(s.width * factor), height: round8(s.height * factor), upscale_method: 'lanczos', crop: 'disabled' } };
      img = ['u3', 0];
    } else if (Math.abs(factor - (s.nativeScale ?? factor)) > 0.01) {
      g.u3 = { class_type: 'ImageScaleBy', inputs: { image: img, scale_by: factor / (s.nativeScale ?? factor), upscale_method: 'lanczos' } };
      img = ['u3', 0];
    }
  } else if (s.width && s.height) {
    g.u3 = { class_type: 'ImageScale', inputs: { image: img, width: round8(s.width * factor), height: round8(s.height * factor), upscale_method: 'lanczos', crop: 'disabled' } };
    img = ['u3', 0];
  } else {
    g.u3 = { class_type: 'ImageScaleBy', inputs: { image: img, scale_by: factor, upscale_method: 'lanczos' } };
    img = ['u3', 0];
  }
  g['9'] = { class_type: 'SaveImage', inputs: { images: img, filename_prefix: s.prefix ?? 'imagelab/upscale' } };
  return g;
}

const round8 = (n: number) => Math.max(8, Math.round(n / 8) * 8);
