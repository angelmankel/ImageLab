/**
 * "Clear all": every generation setting back to its default and no models chosen — no
 * checkpoints, VAE, LoRAs or embeddings. The prompt parts and the input image stay: they are what
 * is being made, not how. A notification offers Undo for a few seconds.
 */
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { defaultWorkflow } from '@/lib/storage';
import { useStore } from '@/lib/store';
import type { WorkflowState } from '@/lib/types';
import { useParamPresets } from './paramPresets';

export function clearedWorkflow(current: WorkflowState): WorkflowState {
  return {
    ...defaultWorkflow(),
    inputImage: current.inputImage,
    checkpoints: [],
    vae: '',
    loras: [],
    embeddings: [],
    modelKeywords: {},
    loopback: undefined,
  };
}

export function clearAllSettings() {
  const st = useStore.getState();
  const before = structuredClone(st.workflow);
  st.setWorkflow(clearedWorkflow(st.workflow));
  // The loaded preset no longer matches what is on screen.
  useParamPresets.setState({ active: null });
  const id = `clear-all-${Date.now()}`;
  notifications.show({
    id, color: 'teal', autoClose: 8000, title: 'Settings and models cleared',
    message: (
      <Button size="compact-xs" variant="light" mt={4} onClick={() => {
        // Keep whatever input image is loaded now; undo only the settings.
        useStore.getState().setWorkflow({ ...before, inputImage: useStore.getState().workflow.inputImage });
        notifications.hide(id);
      }}>Undo</Button>
    ),
  });
}
