import { GenerateButton } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { ImageSettingsColumn } from '@/features/desktop/SettingsColumn';
import { SeedRow, usePanelScope } from '@/features/workspace/imageScope';

// The scope and the seed row moved to the shared layer; older imports still find them here.
export { SeedRow, usePanelScope };

/**
 * The infinite canvas's left panel on desktop: the image mode's settings cards (the same column
 * the workspace uses, in layer scope) over the generate footer. Phones get
 * `panel/MobileParameters` instead.
 */
export function LeftPanel() {
  const { scope, empty, note } = usePanelScope();

  return <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
    <ImageSettingsColumn scope={scope} note={note} empty={empty} />
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-default p-2.5">
      <GenerationProgress />
      {!empty && <SeedRow />}
      <GenerateButton />
    </div>
  </div>;
}
