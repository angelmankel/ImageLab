/**
 * The one mount point of the viewer (in `app/App.tsx`): nothing while closed; open, a fixed
 * `inset: 0` layer at `T.z.viewer` (250 — above the Models modal at 200), portalled to the body
 * so it sits outside any Mantine modal's DOM. A layer, not a route: closing it leaves the picker
 * that opened it exactly as it was.
 *
 * Desktop (fix list item 32): a BIG MODAL, not full screen — a dimmed, blurred backdrop and a
 * centred window (96vw × 94vh, capped) with the viewer inside; a tap on the backdrop closes it.
 * Phone: the window IS the screen (the Back pill closes).
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { T } from '~/theme/tokens';
import { viewerLayerRef } from '~/theme/scrollShards';
import { useIsPhone } from '~/app/useIsPhone';
import { useModelViewer } from './viewerStore';
import { ModelViewer } from './ModelViewer';

/**
 * Mantine's Modal closes on Escape from a window capture listener registered before ours, so
 * stopping propagation cannot beat it. It does skip an event whose target carries this attribute,
 * and a keydown's target is the focused element: the root carries it, and every element that
 * takes focus inside the layer is stamped as it does.
 */
const STOP = 'data-mantine-stop-propagation';

/** The window's size on desktop: as big as the screen allows, with a margin that says "modal". */
const WINDOW_W = 'min(96vw, 1720px)';
const WINDOW_H = 'min(94vh, 1120px)';

export function ModelViewerHost(): JSX.Element | null {
  const opened = useModelViewer((s) => s.opened);
  const close = useModelViewer((s) => s.close);
  const phone = useIsPhone();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!opened) return;
    root.current?.focus({ preventScroll: true });
    // An open Modal's scroll lock lets this layer scroll (scrollShards.ts).
    viewerLayerRef.current = root.current;
    return () => { viewerLayerRef.current = null; };
  }, [opened]);
  if (!opened) return null;

  const layer = { position: 'fixed', inset: 0, zIndex: T.z.viewer, color: 'var(--il-fg)', fontFamily: 'var(--il-font)', outline: 'none' } as const;
  return createPortal(
    phone ? (
      <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Model" data-no-swipe data-pad-layer {...{ [STOP]: 'true' }}
        onFocusCapture={(e) => (e.target as HTMLElement).setAttribute?.(STOP, 'true')}
        style={{ ...layer, background: 'var(--il-bg)', overflow: 'hidden' }}>
        <ErrorBoundary label="Model viewer"><ModelViewer /></ErrorBoundary>
      </div>
    ) : (
      <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Model" data-no-swipe data-pad-layer {...{ [STOP]: 'true' }}
        onFocusCapture={(e) => (e.target as HTMLElement).setAttribute?.(STOP, 'true')}
        onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
        style={{ ...layer, background: 'rgba(8, 8, 10, .62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'relative', width: WINDOW_W, height: WINDOW_H, borderRadius: T.radius.xl, border: '1px solid var(--il-line-soft)', background: 'var(--il-bg)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
          <ErrorBoundary label="Model viewer"><ModelViewer /></ErrorBoundary>
        </div>
      </div>
    ),
    document.body,
  );
}
