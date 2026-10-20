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

export function AppEffects() {
  useComfyConnection();
  useModelHashes();
  useDownloads();
  useServerFavorites();
  useModelProfileSync();
  useVideoServerProbe();
  useTabStatus();
  useInstalledWanFiles();
  const videoHost = useModeHost('video');
  const workflowHost = useModeHost('workflow');
  useEffect(() => { useVideoRun.getState().setHost(videoHost); }, [videoHost]);
  useEffect(() => { useWorkflowRun.getState().setHost(workflowHost); }, [workflowHost]);
  useEffect(() => useVideoRun.getState().attach(), []);
  useEffect(() => useWorkflowRun.getState().attach(), []);
  return null;
}
