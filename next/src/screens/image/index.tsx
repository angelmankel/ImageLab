/**
 * The step screen (rules 1, 3, 7, 8): [StepPanel 404, resizable, collapse = slim tab][toolbar row
 * + stage][HistoryPanel 300, resizable, collapse = slim tab]. Nothing overlaps the picture. The
 * phone shell reuses the pieces exported here (StepPanel without the Generate group, the stage
 * column, the history panel, `useGenerate` for its dock, `AppEffects` at its root).
 */
import { useActiveStep } from '~/app/stepsStore';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
import { useLayout } from './layoutStore';
import { StepPanel } from './StepPanel';
import { StageColumn } from './Stage';
import { HistoryPanel } from './HistoryPanel';
import { useStepRun } from './GenerateBar';

export { StepPanel } from './StepPanel';
export { StageColumn, StageColumn as Stage } from './Stage';
export { Toolbar } from './Toolbar';
export { HistoryPanel } from './HistoryPanel';
export { GenerateBar, useStepRun } from './GenerateBar';
export { PromptTab } from './PromptTab';
export { InputTab } from './InputTab';
export { QueueList } from './QueueList';
export { AppEffects } from './AppEffects';
export { useStageMedia } from './useStageMedia';
export { useLayout } from './layoutStore';

/** The active step's Generate for the phone dock: `running` = this step's own job is running. */
export function useGenerate(): { generate: () => void; generateRandom: () => void; stop: () => void; running: boolean; progress: number | null; disabled: string | null } {
  const step = useActiveStep();
  const { run, stop, busy, progress, disabled } = useStepRun(step);
  return { generate: () => run(false), generateRandom: () => run(true), stop, running: busy, progress, disabled };
}

export function ImageScreen() {
  const step = useActiveStep();
  const stepW = useLayout((s) => s.stepW);
  const histW = useLayout((s) => s.histW);
  const stepOpen = useLayout((s) => s.stepOpen);
  const histOpen = useLayout((s) => s.histOpen);
  const setStepW = useLayout((s) => s.setStepW);
  const setHistW = useLayout((s) => s.setHistW);
  const toggleStep = useLayout((s) => s.toggleStep);
  const toggleHist = useLayout((s) => s.toggleHist);
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Panel side="left" width={stepW} min={T.size.stepPanelMin} max={640} open={stepOpen} onResize={setStepW} onToggle={toggleStep} tabLabel="Step">
        <StepPanel key={step.id} stepId={step.id} />
      </Panel>
      <StageColumn key={step.id} step={step} />
      <Panel side="right" width={histW} min={220} max={560} open={histOpen} onResize={setHistW} onToggle={toggleHist} tabLabel="History">
        <HistoryPanel columns={histW >= 440 ? 3 : 2} />
      </Panel>
    </div>
  );
}
