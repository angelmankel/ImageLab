import { LeftPanel } from './LeftPanel';
import { RightPanel } from '@/features/canvasLayers';
import { SidePanel, SidePanelTrigger, BothPanelsTrigger } from './SidePanel';
import { SIDENAV_W } from './constants';
import { usePanelLayout } from './panelLayout';
import { PanelResizeHandle } from './PanelResizeHandle';
import { cn } from '@/lib/cn';

interface Props {
  isDesktop: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
}

export function AppSidePanels({ isDesktop, leftOpen, rightOpen, setLeftOpen, setRightOpen }: Props) {
  const anyOpen = leftOpen || rightOpen;
  const leftW = usePanelLayout(s => s.left);
  const rightW = usePanelLayout(s => s.right);
  return (
    <>
      {/* Mobile scrim. A drawer covering most of the screen needs somewhere to tap to
          dismiss it — without one the only way out is the small collapse chevron, and
          taps on what looks like the canvas behind land on the canvas. It sits just
          under the drawer's z-30 and fades rather than popping. */}
      {!isDesktop && (
        <div
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
          aria-hidden
          className={cn(
            'fixed inset-0 z-20 bg-black/55 transition-opacity duration-200',
            anyOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
      )}
      <SidePanel
        side="left"
        open={leftOpen}
        isDesktop={isDesktop}
        width={leftW}
        mobileLeftOffset={SIDENAV_W}
        // Desktop folds the panel from its resize handle; a phone drawer needs its own close.
        header={isDesktop ? undefined : (
          <div className="flex items-center justify-end gap-2">
            <SidePanelTrigger side="left" open={leftOpen} onClick={() => setLeftOpen(false)} />
          </div>
        )}
      >
        <LeftPanel />
      </SidePanel>
      <SidePanel
        side="right"
        open={rightOpen}
        isDesktop={isDesktop}
        width={rightW}
        mobileLeftOffset={SIDENAV_W}
        header={
          <div className="flex items-center gap-1.5">
            <SidePanelTrigger side="right" open={rightOpen} onClick={() => setRightOpen(false)} />
            {/* "Open both" is a desktop convenience. On a phone the two drawers cannot
                share the width, so offering it only ever produced the overlap. */}
            {isDesktop && (
              <BothPanelsTrigger
                leftOpen={leftOpen}
                rightOpen={rightOpen}
                onChange={(open) => { setLeftOpen(open); setRightOpen(open); }}
              />
            )}
          </div>
        }
      >
        <RightPanel />
      </SidePanel>
      {isDesktop && <>
        <PanelResizeHandle side="left" open={leftOpen} setOpen={setLeftOpen} />
        <PanelResizeHandle side="right" open={rightOpen} setOpen={setRightOpen} />
      </>}
    </>
  );
}
