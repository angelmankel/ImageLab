/**
 * The phone's section page body (mobile pass, m-create; Donny's 2D map, depth 3, siblings = the
 * step's tabs Prompt · Composition · Model · Parameters · Style): one desktop tab, full width, the
 * same component the step panel shows (`StepTabBody`). A choice inside opens as a sheet; an item
 * with its own detail is one more layer.
 */
import type { Step } from '~/app/stepsStore';
import type { StepTab } from '~/screens/image/layoutStore';
import { StepTabBody } from '~/screens/image/StepPanel';

export function TabPageBody({ step, tab }: { step: Step; tab: StepTab }) {
  return (
    <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--il-panel)', minHeight: '100%' }}>
      <StepTabBody step={step} tab={tab} />
    </div>
  );
}
