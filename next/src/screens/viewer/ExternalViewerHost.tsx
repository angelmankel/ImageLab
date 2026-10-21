/**
 * List-2 item 31: the one mount point (in `app/App.tsx`) of the full-screen viewer over external
 * pictures (`externalViewer.ts`). Sits one step above the model viewer modal, so Esc lands back on
 * the modal at the same picture.
 */
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { T } from '~/theme/tokens';
import { ImageViewer } from './ImageViewer';
import { closeExternalViewer, setExternalViewerIndex, useExternalViewer } from './externalViewer';

export function ExternalViewerHost() {
  const open = useExternalViewer((s) => s.open);
  const items = useExternalViewer((s) => s.items);
  const index = useExternalViewer((s) => s.index);
  if (!open || !items.length) return null;
  return (
    <ErrorBoundary label="Viewer">
      <ImageViewer items={items} index={index} onIndexChange={setExternalViewerIndex} onClose={closeExternalViewer} z={T.z.viewer + 10} />
    </ErrorBoundary>
  );
}
