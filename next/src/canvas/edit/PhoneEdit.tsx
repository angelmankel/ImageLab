/**
 * Item 13 on a phone: Edit mode as its own full-screen page (the phone has no stage beside a
 * panel). Nothing over the picture.
 *   Portrait   a title row with the picture size; the GPU canvas fills the middle; the open tool's
 *              options and the sideways tool row sit under it (`EditBar` phone; its first tile, ✕, closes).
 *   Landscape  (mobile pass) the canvas on the left, full height; a side column on the right with
 *              the title, the open tool's options and the tools as a grid (`EditBar` phone side),
 *              the notch side keeps its safe inset. Rotating keeps the edit (it lives in `editStore`).
 * Opened from the Output page's Edit button. No pull-to-close: a pull would throw edits away.
 */
import { lazy, Suspense } from 'react';
import { T } from '~/theme/tokens';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { useEdit } from './editStore';
import { EditBar } from './EditBar';

const GpuStage = lazy(() => import('../GpuStage').then((m) => ({ default: m.GpuStage })));
const NO_VIEW = { src: null, fade: false, itemKey: null, checker: true };

function Title({ side }: { side: boolean }) {
  const pic = useEdit((s) => s.hist?.present.pic ?? null);
  const label = useEdit((s) => s.hist?.past.length ? 'edited' : null);
  return (
    <div style={{ height: side ? 44 : 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: side ? `0 ${T.pad.panel}px` : `calc(env(safe-area-inset-top, 0px)) ${T.pad.panel}px 0`, boxSizing: 'content-box', borderBottom: '1px solid var(--il-line)' }}>
      <span style={{ fontWeight: 800, fontSize: side ? 16 : 18, flex: 1 }}>Edit</span>
      {pic && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{pic.w} × {pic.h}{label ? ` · ${label}` : ''}</span>}
    </div>
  );
}

export function PhoneEdit() {
  const on = useEdit((s) => s.on);
  const land = usePhoneLandscape();
  if (!on) return null;
  const canvas = (
    <Suspense fallback={<div style={{ flex: 1, background: 'var(--il-bg-deep)' }} />}>
      <GpuStage editing phone bar={!land} view={NO_VIEW} />
    </Suspense>
  );
  if (land) {
    return (
      <div role="dialog" aria-label="Edit" data-no-swipe
        style={{ position: 'fixed', inset: 0, zIndex: T.z.sheet, display: 'flex', background: 'var(--il-bg)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{canvas}</div>
        <div style={{ width: 'clamp(250px, 34%, 320px)', flex: 'none', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--il-line)', background: 'var(--il-panel)' }}>
          <Title side />
          <EditBar phone side />
        </div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-label="Edit" data-no-swipe style={{ position: 'fixed', inset: 0, zIndex: T.z.sheet, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <Title side={false} />
      {canvas}
    </div>
  );
}
