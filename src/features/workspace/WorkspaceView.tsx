/**
 * The one workspace for Image, Video and Workflow. The phone gets `MobileWorkspace`; desktop
 * widths get `features/desktop/DesktopWorkspace` (the desktop shell).
 */
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { DesktopWorkspace } from '@/features/desktop/DesktopWorkspace';
import { MobileWorkspace } from './MobileWorkspace';
import { NextWorkspace } from '@/features/next/NextWorkspace';
import { useNext } from '@/features/next/nextStore';

/** The new workspace (`features/next`) unless Settings → Workspace says "Classic workspace". */
export function WorkspaceView() {
  const isDesktop = useIsDesktop();
  const classic = useNext(s => s.classic);
  if (!classic) return <NextWorkspace />;
  return (
    <ErrorBoundary label="Workspace">
      {isDesktop ? <DesktopWorkspace /> : <MobileWorkspace />}
    </ErrorBoundary>
  );
}
