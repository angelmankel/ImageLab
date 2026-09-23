import { useStore } from '@/lib/store';
import { SliderField } from '@/components/fields/SliderField';

/**
 * Denoise slider for img2img / inpaint pipelines. Reads + writes
 * `workflow.inputDenoise` on the global store.
 *
 * Hosted by the Input image section (img2img) and the canvas Inpaint section.
 * Standalone so the next move — surfacing it as a floating control under
 * the selected layer's bounds on the canvas — is a single new render site,
 * not a rewrite.
 */
export function DenoiseField({ label = 'Denoise' }: { label?: string }) {
  const inputDenoise = useStore(s => s.workflow.inputDenoise);
  const setWorkflow = useStore(s => s.setWorkflow);
  return (
    <SliderField
      label={label}
      value={inputDenoise}
      onChange={(v) => setWorkflow({ inputDenoise: v })}
      min={0}
      max={1}
      step={0.01}
      defaultValue={0.6}
    />
  );
}
