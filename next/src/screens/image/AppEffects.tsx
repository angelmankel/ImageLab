/**
 * The hooks the app needs mounted once at the root, whichever shell is up (the main app mounts
 * the same ones in its App.tsx): the ComfyUI sockets and job reconciliation, model hashes,
 * downloads polling, server favourites, the model-type sync, the pod's video server probe, the
 * tab title, the Wan stand-ins; and the video / workflow run stores pointed at their hosts and
 * attached, so a run keeps reporting whichever step is on screen. Renders nothing.
 */
import { useEffect } from 'react';
import { useComfyConnection } from '@/hooks/useComfyConnection';
import { useModelHashes } from '@/hooks/useModelHashes';
import { useDownloads } from '@/hooks/useDownloads';
import { useServerFavorites } from '@/hooks/useServerFavorites';
import { useModelProfileSync } from '@/hooks/useModelProfileSync';
import { useVideoServerProbe } from '@/hooks/useVideoServerProbe';
import { useTabStatus } from '@/hooks/useTabStatus';
import { useInstalledWanFiles } from '@/features/video/videoControls';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { notifications } from '@mantine/notifications';
import { useSteps } from '~/app/stepsStore';
import { ensureStepWorkflowOpen } from '~/screens/comfy';
import { usePendingReconcile } from '~/screens/image/model';
import { useWorkflowFollow } from './workflow/followWorkflow';

export function AppEffects() {
  useComfyConnection();
  useModelHashes();
  useDownloads();
  useServerFavorites();
  useModelProfileSync();
  useVideoServerProbe();
  useTabStatus();
  useInstalledWanFiles();
  // Models added before their download: flip them on when the file lands, whichever tab is open.
  usePendingReconcile();
  // Workflow steps that follow step 1's models (fix list item 40): kept in step live.
  useWorkflowFollow();
  const videoHost = useModeHost('video');
  const workflowHost = useModeHost('workflow');
  useEffect(() => { useVideoRun.getState().setHost(videoHost); }, [videoHost]);
  useEffect(() => { useWorkflowRun.getState().setHost(workflowHost); }, [workflowHost]);
  useEffect(() => useVideoRun.getState().attach(), []);
  useEffect(() => useWorkflowRun.getState().attach(), []);
  // A workflow step runs only when its workflow is the studio store's open one: load it when the
  // step becomes active (the ComfyUI screen's "Use as step" loads it too).
  const activeId = useSteps((s) => s.activeId);
  const activeKind = useSteps((s) => s.steps.find((x) => x.id === s.activeId)?.kind);
  useEffect(() => {
    if (activeKind !== 'workflow') return;
    ensureStepWorkflowOpen(activeId).catch((err: unknown) => {
      notifications.show({ color: 'red', message: `Could not open this step's workflow: ${err instanceof Error ? err.message : String(err)}` });
    });
  }, [activeId, activeKind]);
  return null;
}
