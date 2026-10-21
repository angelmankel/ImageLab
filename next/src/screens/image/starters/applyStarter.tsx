/**
 * Item 9: using a starter. The prompt (and the negative when it has one) replace the Image step's
 * texts; a CivitAI picture also brings its steps / CFG / seed. Ctrl+Z (list 2 #12) puts the
 * prompt layers and those settings back. "As input" makes a picture the input image.
 */
import { useStore } from '@/lib/store';
import type { LayerKind } from '@/lib/types';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { pushUndo } from '~/app/undo';
import { notifyError, say } from '~/app/notify';

function setMainText(kind: LayerKind, text: string) {
  const st = useStore.getState();
  const main = st.layers.find((l) => l.kind === kind);
  if (main) st.updateLayer(main.id, { text, on: true, weight: 1 });
  else if (text.trim()) st.addLayer(kind, { text });
}

export interface StarterUse { positive: string; negative?: string; steps?: number; cfg?: number; seed?: number }

export function applyStarter(p: StarterUse, name: string) {
  const st = useStore.getState();
  const layers = st.layers;
  const wf = st.workflow;
  const before = { steps: wf.steps, cfg: wf.cfg, seed: wf.seed, randomizeSeed: wf.randomizeSeed };
  setMainText('positive', p.positive);
  if (p.negative) setMainText('negative', p.negative);
  const patch: Record<string, number | boolean> = {};
  if (typeof p.steps === 'number') patch.steps = p.steps;
  if (typeof p.cfg === 'number') patch.cfg = p.cfg;
  if (typeof p.seed === 'number') { patch.seed = p.seed; patch.randomizeSeed = false; }
  if (Object.keys(patch).length) st.setWorkflow(patch);
  const after = useStore.getState().layers;
  pushUndo({
    label: 'Use starter',
    undo: () => {
      const now = useStore.getState();
      now.setPromptLayers(layers);
      if (Object.keys(patch).length) now.setWorkflow(before);
    },
    redo: () => {
      const now = useStore.getState();
      now.setPromptLayers(after);
      if (Object.keys(patch).length) now.setWorkflow(patch);
    },
  });
  say(`Started from “${name}”`);
}

export async function setAsInput(url: string, name: string) {
  try {
    const state = await urlToImageState(url, name);
    const prev = useStore.getState().workflow.inputImage;
    useStore.getState().setWorkflow({ inputImage: state });
    pushUndo({ label: 'Set input image', undo: () => useStore.getState().setWorkflow({ inputImage: prev }), redo: () => useStore.getState().setWorkflow({ inputImage: state }) });
    say(`Input image set · ${state.width}×${state.height}`);
  } catch (e) {
    notifyError('Could not load the picture', e);
  }
}
