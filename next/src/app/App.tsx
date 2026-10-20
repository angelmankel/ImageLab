/**
 * The root. Picks the shell by width and the screen by route.
 *
 *   Desktop (DesktopShell)                    Phone (PhoneShell)
 *   ┌ top bar ────────────────────────────┐   ┌ screen (full) ───────┐
 *   │ rail │ step panel │ stage │ history │   │  … swipe = step …    │
 *   └──────┴────────────┴───────┴─────────┘   └ glass dock / Back ───┘
 *
 * Screens: `screens/<name>/index.tsx` exports `<Name>Screen` (desktop) and `<Name>PhoneScreen`.
 * Only the step screen can generate; the others show the Back pill on the phone (rule 11).
 */
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsPhone } from './useIsPhone';
import { DesktopShell } from '~/screens/image/DesktopShell';
import { PhoneShell } from '~/screens/phone/PhoneShell';
import { ModelViewerHost } from '~/screens/modelViewer';
import { useCreditNewResults } from '~/screens/image/resultSteps';
import { ContextMenuHost } from './contextMenu';

export function App() {
  const phone = useIsPhone();
  useCreditNewResults();
  return (
    <ErrorBoundary label="ImageLab">
      {phone ? <PhoneShell /> : <DesktopShell />}
      <ModelViewerHost />
      <ContextMenuHost />
    </ErrorBoundary>
  );
}
