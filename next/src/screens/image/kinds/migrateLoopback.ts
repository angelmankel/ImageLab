/**
 * Fix list 15, once per saved session: Loopback left the Image step. A workflow that still has
 * Loopback switched on gets a Refine step right after step 1 with those same rounds (and the
 * Loopback switch goes off), so nothing that was running quietly stops happening. A session that
 * already has a Refine step is left alone.
 */
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useSteps } from '~/app/stepsStore';

export function useLoopbackToRefine(): void {
  useEffect(() => {
    // The stores load from storage asynchronously: look a moment after start.
    const t = setTimeout(() => {
      const lb = useStore.getState().workflow.loopback;
      const st = useSteps.getState();
      if (!lb?.enabled || st.steps.some((s) => s.kind === 'refine')) return;
      const id = st.addStepAfter('refine', { after: st.steps[0].id, activate: false });
      st.updateParams(id, { refine: { ...lb, enabled: true } });
      useStore.getState().setWorkflow({ loopback: { ...lb, enabled: false } });
    }, 1500);
    return () => clearTimeout(t);
  }, []);
}
