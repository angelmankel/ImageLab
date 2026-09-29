import type { Layer, WorkflowState } from '../types';
import { workflowFamily, type GraphFamily } from '../modelProfiles';
import { buildSdGraph } from './sd';
import { buildAnimaGraph } from './anima';
import type { BuildGraphResult, GraphBuilder, InpaintConfig } from './types';

export type { BuildGraphResult, GraphBuilder, InpaintConfig } from './types';

/** One builder per graph family. A new family (Flux…) adds its file here. */
const BUILDERS: Record<GraphFamily, GraphBuilder> = {
  sd15: buildSdGraph,
  sdxl: buildSdGraph,
  anima: buildAnimaGraph,
};

/**
 * Build the ComfyUI prompt graph for the workflow's model type (`workflow.modelProfile`).
 *
 * Returns the graph plus any per-pass clamp notes (e.g. "Pass 2 capped to
 * 2048 → effective ×1.60") so the queuer can surface them in the status pill.
 */
export function buildGraph(
  workflow: WorkflowState,
  layers: Layer[],
  inputImageRef: string | null = null,
  inpaint: InpaintConfig | null = null,
): BuildGraphResult {
  const family = workflowFamily(workflow);
  return BUILDERS[family](workflow, layers, inputImageRef, inpaint, family);
}
