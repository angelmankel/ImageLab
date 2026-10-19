/**
 * The one workspace for Image, Video and Workflow. The phone gets `MobileWorkspace`; desktop
 * widths get `features/desktop/DesktopWorkspace` (the desktop shell).
 */
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { DesktopWorkspace } from '@/features/desktop/DesktopWorkspace';
import { MobileWorkspace } from './MobileWorkspace';

export function WorkspaceView() {
  const isDesktop = useIsDesktop();
  return (
    <ErrorBoundary label="Workspace">
      {isDesktop ? <DesktopWorkspace /> : <MobileWorkspace />}
    </ErrorBoundary>
  );
}
