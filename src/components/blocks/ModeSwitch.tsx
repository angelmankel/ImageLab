/** Image / Video / Workflow — the workspace's mode, which is `mainView` underneath. */
import { IconMovie, IconPhoto, IconRoute } from '@tabler/icons-react';
import { useCanvasStore } from '@/lib/canvasStore';
import { WORKSPACE_MODES, modeOfView, viewOfMode, type WorkspaceMode } from '@/lib/workspace';
import { Segmented } from './Segmented';

const ICONS: Record<WorkspaceMode, React.ReactNode> = {
  image: <IconPhoto size={16} stroke={1.7} />,
  video: <IconMovie size={16} stroke={1.7} />,
  workflow: <IconRoute size={16} stroke={1.7} />,
};

export function useWorkspaceMode(): WorkspaceMode {
  return useCanvasStore(s => modeOfView(s.mainView) ?? 'image');
}

export function ModeSwitch({ size = 'sm', fullWidth = true }: { size?: 'xs' | 'sm' | 'md'; fullWidth?: boolean }) {
  const mode = useWorkspaceMode();
  const setMainView = useCanvasStore(s => s.setMainView);
  return (
    <Segmented
      ariaLabel="Mode"
      size={size}
      fullWidth={fullWidth}
      value={mode}
      onChange={m => setMainView(viewOfMode(m))}
      options={WORKSPACE_MODES.map(m => ({ value: m.mode, label: m.label, icon: ICONS[m.mode] }))}
    />
  );
}
