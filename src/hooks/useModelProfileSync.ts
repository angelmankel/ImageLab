import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { readModelInfo } from '@/components/models/modelInfo';
import { profileById, profileTransition, resolveProfile, type ModelProfile } from '@/lib/modelProfiles';

/**
 * Keeps `workflow.modelProfile` in step with the base checkpoint's type. When the type changes
 * (a new model picked, its CivitAI data arriving, or a type chosen by hand) the new type's
 * defaults apply to every value still at the old type's default — hand-changed values stay.
 * Mounted once, in App.
 */
export function useModelProfileSync() {
  const base = useStore((s) => s.workflow.checkpoints[0]?.name);
  const override = useStore((s) => (base ? s.workflow.modelProfileOverrides?.[base] : undefined));
  const current = useStore((s) => s.workflow.modelProfile);
  // Re-read when model metadata lands.
  useStore((s) => s.modelHashes);
  useStore((s) => s.civitaiByHash);
  const info = base ? readModelInfo(base) : null;
  const next = resolveProfile(base, info?.bucket ?? 'Unknown', !!info && !info.resolved, override);

  useEffect(() => {
    // Still waiting for CivitAI, or nothing changed.
    if (next === undefined || (next ?? undefined) === current) return;
    const st = useStore.getState();
    st.setWorkflow(profileTransition(st.workflow, st.workflow.modelProfile, next));
  }, [next, current]);
}

/** The current model type, and what it would be without a hand-picked override. */
export function useModelProfile(): { profile: ModelProfile | null; detected: string | null | undefined } {
  const base = useStore((s) => s.workflow.checkpoints[0]?.name);
  const current = useStore((s) => s.workflow.modelProfile);
  useStore((s) => s.modelHashes);
  useStore((s) => s.civitaiByHash);
  const info = base ? readModelInfo(base) : null;
  return {
    profile: profileById(current),
    detected: resolveProfile(base, info?.bucket ?? 'Unknown', !!info && !info.resolved),
  };
}
