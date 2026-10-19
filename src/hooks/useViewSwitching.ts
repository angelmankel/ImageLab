import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/lib/canvasStore';
import { isWorkspaceView } from '@/lib/workspace';

/**
 * Drives the brief loading veil + animate-view-in keyed wrapper around the
 * main view. Re-keys when the user swaps ComfyUI servers without leaving the
 * comfy view so the iframe remounts.
 */
export function useViewSwitching() {
  const mainView = useCanvasStore(s => s.mainView);
  const comfyServerId = useCanvasStore(s => s.comfyServerId);
  // Image, Video and Workflow are one shell: a mode switch must not remount it.
  const viewKey = mainView === 'comfy' ? `comfy:${comfyServerId ?? 'none'}` : isWorkspaceView(mainView) ? 'workspace' : mainView;

  const [isSwitching, setIsSwitching] = useState(false);
  useEffect(() => {
    setIsSwitching(true);
    const t = setTimeout(() => setIsSwitching(false), 260);
    return () => clearTimeout(t);
  }, [viewKey]);

  return { mainView, viewKey, isSwitching };
}
