/**
 * Drop a picture on the Steps rail = a new step with that picture as its input (fix list 42;
 * FIXLIST default: the same step-kind popover as item 31). The popover opens where the picture
 * was let go; the new step goes at the end of the chain. Also a Send-to target ("New step with
 * this picture…") for the phone, registered by `GlobalTargets`.
 */
import { notifications } from '@mantine/notifications';
import { addStepWithPicker } from '~/app/stepKindPicker';
import { useSteps } from '~/app/stepsStore';
import { dropToStepInput } from './importImage';
import { useImageDrop } from './useImageDrop';
import type { DropItem } from './payload';

/** Read the picture, then open the step-kind picker at `at`. */
export async function newStepFromDrop(item: DropItem, at: { x: number; y: number }): Promise<void> {
  try {
    const input = await dropToStepInput(item);
    const steps = useSteps.getState().steps;
    addStepWithPicker(at, { after: steps[steps.length - 1]?.id ?? null, input });
  } catch (e) {
    notifications.show({ color: 'red', title: 'Could not use that picture', message: e instanceof Error ? e.message : String(e), autoClose: 3000 });
  }
}

/** Spread `props` on the rail; `over` / `active` for the highlight. */
export function useRailDrop() {
  return useImageDrop({ onDrop: (item, e) => void newStepFromDrop(item, { x: e.clientX, y: e.clientY }) });
}
