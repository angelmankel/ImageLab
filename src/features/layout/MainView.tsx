import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InfiniteCanvas } from '@/features/canvas/InfiniteCanvas';
import { StrippedCanvas } from '@/features/canvas/StrippedCanvas';
import { BrushCursor } from '@/features/canvas/BrushCursor';
import { CanvasToolbar } from '@/features/canvas/CanvasToolbar';
import { CollectionsView } from '@/features/collections';
import { ModelBrowserView } from '@/features/browser';
import { StudioView } from '@/features/studio/StudioView';
import { AppSidePanels } from './AppSidePanels';
import { CanvasTopNav } from './CanvasTopNav';
import { GenerateTopNav } from './GenerateTopNav';
import { NAV_HEIGHT, TOOLBAR_TRANSITION } from './constants';
import { usePanelLayout } from './panelLayout';

interface Props {
  mainView: string;
  isDesktop: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  desktopLeftInset: number;
  desktopRightInset: number;
}

export function MainView({
  mainView,
  isDesktop,
  leftOpen,
  rightOpen,
  setLeftOpen,
  setRightOpen,
  desktopLeftInset,
  desktopRightInset,
}: Props) {
  const leftW = usePanelLayout(s => s.left);
  const rightW = usePanelLayout(s => s.right);
  const dragging = usePanelLayout(s => s.dragging);
  if (mainView === 'collections') {
    return (
      <ErrorBoundary label="Collections panel">
        <CollectionsView />
      </ErrorBoundary>
    );
  }
  if (mainView === 'browser') {
    return (
      <ErrorBoundary label="Model browser">
        <ModelBrowserView />
      </ErrorBoundary>
    );
  }
  if (mainView === 'studio') {
    // Studio is a self-contained shell: it brings its own layout on both desktop and phone, and
    // shares none of the canvas chrome below.
    return (
      <ErrorBoundary label="Studio">
        <StudioView />
      </ErrorBoundary>
    );
  }
  if (mainView === 'comfy') {
    // Rendered by <ComfyLayer>, which sits outside this keyed subtree so the iframe survives a
    // view switch. Returning null here keeps the switch animation without a second frame.
    return null;
  }

  const leftInset = isDesktop && leftOpen ? leftW : 0;
  const rightInset = isDesktop && rightOpen ? rightW : 0;
  const panelProps = { isDesktop, leftOpen, rightOpen, setLeftOpen, setRightOpen };

  return (
    <>
      {mainView === 'canvas' ? (
        <InfiniteCanvas navOffset={NAV_HEIGHT} leftInset={leftInset} rightInset={rightInset} />
      ) : (
        <StrippedCanvas navOffset={NAV_HEIGHT} leftInset={leftInset} rightInset={rightInset} />
      )}

      <AppSidePanels {...panelProps} />

      {/* Top toolbar — same shell on both main views, but the right-slot
          content swaps to match what each view can actually act on. Canvas
          owns the compositor controls (grid snap, auto-frame); generate owns
          the history controls (recall the last params, peek at metadata). */}
      {mainView === 'canvas' && (
        <CanvasTopNav {...panelProps} leftInset={desktopLeftInset} rightInset={desktopRightInset} />
      )}
      {mainView === 'generate' && (
        <GenerateTopNav {...panelProps} leftInset={desktopLeftInset} rightInset={desktopRightInset} />
      )}

      {/* Floating canvas-tools palette — clears the LeftPanel overlay
          via `desktopLeftInset`. Hidden in generate mode by the
          component itself. */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          top: NAV_HEIGHT,
          left: desktopLeftInset + 12,
          transition: dragging ? 'none' : TOOLBAR_TRANSITION,
        }}
      >
        <CanvasToolbar />
      </div>
      <BrushCursor />
    </>
  );
}
