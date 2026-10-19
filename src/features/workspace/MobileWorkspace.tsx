/** Placeholder until the phone workspace is written; the old views stand in. */
import { useCanvasStore } from '@/lib/canvasStore';
import { MobileShell } from '@/features/layout/MobileShell';
import { StudioView } from '@/features/studio/StudioView';
import { VideoView } from '@/features/video/VideoView';

export function MobileWorkspace() {
  const mainView = useCanvasStore(s => s.mainView);
  if (mainView === 'studio') return <StudioView />;
  if (mainView === 'video') return <VideoView />;
  return <MobileShell />;
}
