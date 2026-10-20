/**
 * Item 9: using a starter. The prompt (and the negative when it has one) replace the Image step's
 * texts; a CivitAI picture also brings its steps / CFG / seed. One toast with Undo (3 s) puts the
 * prompt layers and those settings back. "As input" makes a picture the input image.
 */
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import type { LayerKind } from '@/lib/types';
import { urlToImageState } from '@/features/inputImage/imageOps';

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
  const id = `starter-${Date.now()}`;
  notifications.show({
    id, autoClose: 3000, title: `Started from “${name}”`,
    message: (
      <Button size="compact-xs" variant="light" mt={4} onClick={() => {
        const now = useStore.getState();
        now.setPromptLayers(layers);
        if (Object.keys(patch).length) now.setWorkflow(before);
        notifications.hide(id);
      }}>Undo</Button>
    ),
  });
}

export async function setAsInput(url: string, name: string) {
  try {
    const state = await urlToImageState(url, name);
    useStore.getState().setWorkflow({ inputImage: state });
    notifications.show({ autoClose: 3000, title: 'Input image set', message: `${state.width}×${state.height}` });
  } catch (e) {
    notifications.show({ autoClose: 3000, color: 'red', title: 'Could not load the picture', message: e instanceof Error ? e.message : String(e) });
  }
}
