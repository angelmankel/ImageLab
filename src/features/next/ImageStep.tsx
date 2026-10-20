/**
 * The Image step's panel: the run bar on top (desktop; the phone pins it under the scroll), the
 * prompt hub, then every setting as a chip in short rows. The canvas view's layer scope is not
 * a step: this panel is only ever the generate workflow.
 */
import { ImageRunBar } from './RunBars';
import { PromptHub } from './PromptHub';
import { ImageChips } from './ImageChips';

/** The scrolling part, shared by both shells. */
export function ImageStepBody({ large = false }: { large?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <PromptHub kind="image" large={large} />
      <ImageChips large={large} />
    </div>
  );
}

export function ImageStep() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Image step" data-pad-start>
      <div className="shrink-0 border-b border-border-default p-2.5"><ImageRunBar /></div>
      <div className="scroll-y min-h-0 flex-1 p-2.5" style={{ touchAction: 'pan-y' }}><ImageStepBody /></div>
    </div>
  );
}
