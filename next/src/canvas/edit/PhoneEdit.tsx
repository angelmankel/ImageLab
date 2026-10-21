/**
 * Item 13 on a phone: Edit mode as its own full-screen page (the phone has no stage beside a
 * panel). Top: a title row with the picture size (the tool row's first tile, ✕, closes); the GPU
 * canvas fills the middle (nothing over the picture); the open tool's options and the sideways tool
 * row sit under it (`EditBar` phone). Opened from the Output page's Edit button.
 */
import { lazy, Suspense } from 'react';
import { T } from '~/theme/tokens';
import { useEdit } from './editStore';

const GpuStage = lazy(() => import('../GpuStage').then((m) => ({ default: m.GpuStage })));
const NO_VIEW = { src: null, fade: false, itemKey: null, checker: true };

export function PhoneEdit() {
  const on = useEdit((s) => s.on);
  const pic = useEdit((s) => s.hist?.present.pic ?? null);
  const label = useEdit((s) => s.hist?.past.length ? 'edited' : null);
  if (!on) return null;
  return (
    <div role="dialog" aria-label="Edit" data-no-swipe style={{ position: 'fixed', inset: 0, zIndex: T.z.sheet, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: `calc(env(safe-area-inset-top, 0px)) ${T.pad.panel}px 0`, boxSizing: 'content-box', borderBottom: '1px solid var(--il-line)' }}>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Edit</span>
        {pic && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{pic.w} × {pic.h}{label ? ` · ${label}` : ''}</span>}
      </div>
      <Suspense fallback={<div style={{ flex: 1, background: 'var(--il-bg-deep)' }} />}>
        <GpuStage editing phone view={NO_VIEW} />
      </Suspense>
    </div>
  );
}
