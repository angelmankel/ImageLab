/**
 * STUB — the desktop workspace shell is being written by the desktop-layout agent, who owns this
 * file. Until it lands, desktop widths get the previous per-mode views so the app keeps working.
 */
import { useCanvasStore } from '@/lib/canvasStore';
import { StudioView } from '@/features/studio/StudioView';
import { VideoView } from '@/features/video/VideoView';

export function DesktopWorkspace() {
  const mainView = useCanvasStore(s => s.mainView);
  if (mainView === 'studio') return <StudioView />;
  if (mainView === 'video') return <VideoView />;
  return null;
}
