/**
 * The bar across the top of the desktop workspace, in flow (not floating): the mode switch and
 * Simple / Advanced on the left, what is happening in the middle (connection, server, queue,
 * downloads, and one pill per running job in any mode), and the column toggles on the right. A
 * folded settings column leaves a compact Generate here so a run is never more than a click away.
 */
import { ModeSwitch, DetailToggle } from '@/components/blocks';
import { JobTray } from '@/components/blocks/JobTray';
import { JobStatusCluster } from '@/features/layout/JobStatusCluster';
import { SidePanelTrigger, BothPanelsTrigger } from '@/features/layout/SidePanel';
import { GenerateWidget } from '@/features/generate/GenerateWidget';
import type { WorkspaceMode } from '@/lib/workspace';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { CompactRun } from './WorkspaceFooter';

interface Props {
  mode: WorkspaceMode;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  videoHost: string | null;
  workflowHost: string | null;
  info: ObjectInfo | null;
}

export function WorkspaceTopBar({ mode, leftOpen, rightOpen, setLeftOpen, setRightOpen, videoHost, workflowHost, info }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-panel/85 px-2 backdrop-blur-md">
      <div className="flex shrink-0 items-center gap-1.5">
        {!leftOpen && <SidePanelTrigger side="left" open={leftOpen} onClick={() => setLeftOpen(true)} />}
        <ModeSwitch />
        <DetailToggle />
      </div>
      <div className="scroll-x-thin flex min-w-0 flex-1 items-center gap-3">
        <JobStatusCluster />
        <JobTray />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!leftOpen && (mode === 'image'
          ? <GenerateWidget />
          : <CompactRun mode={mode} videoHost={videoHost} workflowHost={workflowHost} info={info} />)}
        {!rightOpen && <SidePanelTrigger side="right" open={rightOpen} onClick={() => setRightOpen(true)} />}
        {!leftOpen && !rightOpen && (
          <BothPanelsTrigger leftOpen={leftOpen} rightOpen={rightOpen} onChange={open => { setLeftOpen(open); setRightOpen(open); }} />
        )}
      </div>
    </header>
  );
}
