import { GenerateWidget } from '@/features/generate/GenerateWidget';
import { GenerateNavActions } from '@/features/generate/GenerateNavActions';
import { TopNav } from './TopNav';
import { JobStatusCluster } from './JobStatusCluster';
import { SidePanelTrigger, BothPanelsTrigger } from './SidePanel';
import { TOOLBAR_TRANSITION } from './constants';
import { usePanelLayout } from './panelLayout';

interface Props {
  isDesktop: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  leftInset: number;
  rightInset: number;
}

export function GenerateTopNav({ isDesktop, leftOpen, rightOpen, setLeftOpen, setRightOpen, leftInset, rightInset }: Props) {
  const dragging = usePanelLayout(s => s.dragging);
  return (
    <TopNav
      leftInset={leftInset}
      rightInset={rightInset}
      insetTransition={dragging ? 'none' : TOOLBAR_TRANSITION}
      left={
        <>
          {!leftOpen && (
            <SidePanelTrigger side="left" open={leftOpen} onClick={() => setLeftOpen(true)} />
          )}
          <JobStatusCluster />
          {isDesktop && !leftOpen && <GenerateWidget />}
        </>
      }
      right={
        <>
          <GenerateNavActions />
          {!rightOpen && (
            <SidePanelTrigger side="right" open={rightOpen} onClick={() => setRightOpen(true)} />
          )}
          {isDesktop && !leftOpen && !rightOpen && (
            <BothPanelsTrigger
              leftOpen={leftOpen}
              rightOpen={rightOpen}
              onChange={(open) => { setLeftOpen(open); setRightOpen(open); }}
            />
          )}
        </>
      }
    />
  );
}
