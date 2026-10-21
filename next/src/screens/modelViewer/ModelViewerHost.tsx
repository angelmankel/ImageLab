/**
 * The one mount point of the viewer (in `app/App.tsx`): nothing while closed; open, a fixed
 * `inset: 0` layer at `T.z.viewer` (250 — above the Models modal at 200), portalled to the body
 * so it sits outside any Mantine modal's DOM. A layer, not a route: closing it leaves the picker
 * that opened it exactly as it was.
 *
 * Desktop (fix list item 32): a BIG MODAL, not full screen — a dimmed, blurred backdrop and a
 * centred window (the window minus a 20px margin, capped; no viewport units, item 26) with the viewer inside; a tap on the backdrop closes it.
 * Phone: the window IS the screen (the Back pill closes).
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { T } from '~/theme/tokens';
import { viewerLayerRef } from '~/theme/scrollShards';
import { useIsPhone } from '~/app/useIsPhone';
import { useModelViewer } from './viewerStore';
import { useExternalViewer } from '~/screens/viewer/externalViewer';
import { ModelViewer } from './ModelViewer';

/**
 * Mantine's Modal closes on Escape from a window capture listener registered before ours, so
 * stopping propagation cannot beat it. It does skip an event whose target carries this attribute,
 * and a keydown's target is the focused element: the root carries it, and every element that
 * takes focus inside the layer is stamped as it does.
 */
const STOP = 'data-mantine-stop-propagation';

/**
 * The window's size on desktop: as big as the screen allows, with a margin that says "modal".
 * No vw / vh (fix list 2 item 26): under the UI scale's CSS `zoom` a viewport unit is zoomed too
 * (110% scale → 94vh became 103% of the window and the modal ran off the bottom and right). The
 * fixed layer (`inset: 0`) IS the real window at every scale, so the window is 100% of it minus
 * the layer's padding, capped.
 */
const WINDOW_PAD = 20;
const WINDOW_MAX_W = 1720;
const WINDOW_MAX_H = 1120;

export function ModelViewerHost(): JSX.Element | null {
  const opened = useModelViewer((s) => s.opened);
  const close = useModelViewer((s) => s.close);
  const phone = useIsPhone();
  // Under the full-screen viewer (opaque, item 31) the backdrop blur is never seen: drop it, so the
  // compositor does not re-blur the whole page on every picture (perf pass).
  const covered = useExternalViewer((s) => s.open);
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
        style={{ ...layer, background: 'rgba(8, 8, 10, .62)', backdropFilter: covered ? 'none' : 'blur(6px)', WebkitBackdropFilter: covered ? 'none' : 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: WINDOW_PAD, boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: WINDOW_MAX_W, maxHeight: WINDOW_MAX_H, minWidth: 0, minHeight: 0, boxSizing: 'border-box', borderRadius: T.radius.xl, border: '1px solid var(--il-line-soft)', background: 'var(--il-bg)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
          <ErrorBoundary label="Model viewer"><ModelViewer /></ErrorBoundary>
        </div>
      </div>
    ),
    document.body,
  );
}
