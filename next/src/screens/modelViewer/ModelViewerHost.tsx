/**
 * The one mount point of the viewer (in `app/App.tsx`): nothing while closed; open, a fixed
 * `inset: 0` layer at `T.z.viewer` (250 — above the Models modal at 200), portalled to the body
 * so it sits outside any Mantine modal's DOM, with the viewer inside. A layer, not a route:
 * closing it leaves the picker that opened it exactly as it was.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { T } from '~/theme/tokens';
import { useModelViewer } from './viewerStore';
import { ModelViewer } from './ModelViewer';

/**
 * Mantine's Modal closes on Escape from a window capture listener registered before ours, so
 * stopping propagation cannot beat it. It does skip an event whose target carries this attribute,
 * and a keydown's target is the focused element: the root carries it, and every element that
 * takes focus inside the layer is stamped as it does.
 */
const STOP = 'data-mantine-stop-propagation';

export function ModelViewerHost(): JSX.Element | null {
  const opened = useModelViewer((s) => s.opened);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (opened) root.current?.focus({ preventScroll: true }); }, [opened]);
  if (!opened) return null;
  return createPortal(
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Model" data-no-swipe data-pad-layer {...{ [STOP]: 'true' }}
      onFocusCapture={(e) => (e.target as HTMLElement).setAttribute?.(STOP, 'true')}
      style={{ position: 'fixed', inset: 0, zIndex: T.z.viewer, background: 'var(--il-bg)', color: 'var(--il-fg)', fontFamily: 'var(--il-font)', outline: 'none', overflow: 'hidden' }}>
      <ErrorBoundary label="Model viewer"><ModelViewer /></ErrorBoundary>
    </div>,
    document.body,
  );
}
