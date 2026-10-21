/**
 * What "default" means for the reset buttons (FIXLIST-2 item 8): the model type's saved start
 * values (steps, CFG, sampler, scheduler, size… from its profile, "Model default") over the app's
 * fresh workflow. Loopback's are `DEFAULT_LOOPBACK`. Pass them as `defaultValue` to SliderRow /
 * NumberField / SearchSelect.
 */
import { useMemo } from 'react';
import { defaultWorkflow } from '@/lib/storage';
import { DEFAULT_CLIP_SKIP, DEFAULT_LOOPBACK } from '@/lib/pipeline';
import { useModelProfile } from '@/hooks/useModelProfileSync';

export { DEFAULT_LOOPBACK };

/** The image step's defaults for the current model type. */
export function useImageDefaults() {
  const { profile } = useModelProfile();
  return useMemo(() => {
    const d = { ...defaultWorkflow(), ...(profile?.defaults ?? {}) };
    return { ...d, clipSkip: d.clipSkip ?? DEFAULT_CLIP_SKIP };
  }, [profile]);
}
