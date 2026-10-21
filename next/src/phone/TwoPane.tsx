/**
 * The phone's landscape frame (mobile pass, m-shell): a compact desktop, not the portrait layout
 * stretched. Every phone screen in landscape fills this frame; nothing overlaps the picture.
 *
 *   ┌ safe ┬───────────────────────────┬──────────────────┬──────┬ safe ┐
 *   │ left │          main             │ sideHeader       │ rail │ right│
 *   │      │ (the picture / the grid)  │ side (scrolls)   │ (opt)│      │
 *   └──────┴───────────────────────────┴──────────────────┴──────┴──────┘
 *
 *   <PhoneTwoPane main={<Picture/>} side={<Panel/>} sideHeader={<StepsStrip/>} rail={<PhoneRail/>} />
 *
 * - `main` takes what is left; `side` is `sideWidth` wide (default clamp(300px, 42%, 440px)).
 * - `mainSide="right"` puts the main pane on the right (e.g. a list on the left, detail right).
 * - `rail` sits at the right edge, in its own column (thumb reach in landscape is the sides).
 * - The side pane scrolls by itself (`sideScrollRef` for scroll keeping); `side` may also be a full
 *   column of its own (`sideScroll={false}`).
 * - Safe areas: the notch side gets its inset, the bottom gets the home bar's.
 * Rotation keeps state as long as callers keep the same components mounted in both layouts
 * (state in stores, scroll via `useKeepScroll` from `~/phone`).
 */
import type { CSSProperties, ReactNode } from 'react';
import { T } from '~/theme/tokens';

export const SIDE_WIDTH = 'clamp(300px, 42%, 440px)';

export interface PhoneTwoPaneProps {
  main: ReactNode;
  side: ReactNode;
  sideHeader?: ReactNode;
  sideFooter?: ReactNode;
  rail?: ReactNode;
  sideWidth?: string;
  mainSide?: 'left' | 'right';
  sideScroll?: boolean;
  sideScrollRef?: (el: HTMLDivElement | null) => void;
  /** Background behind the main pane (the stage is darker than panels). */
  mainBackground?: string;
  style?: CSSProperties;
}

export function PhoneTwoPane({
  main, side, sideHeader, sideFooter, rail, sideWidth = SIDE_WIDTH, mainSide = 'left', sideScroll = true, sideScrollRef,
  mainBackground = 'var(--il-bg-deep)', style,
}: PhoneTwoPaneProps) {
  const mainPane = (
    <div key="main" data-pane="main" style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', background: mainBackground, overflow: 'hidden' }}>
      {main}
    </div>
  );
  const sidePane = (
    <div key="side" data-pane="side"
      style={{
        width: sideWidth, flex: 'none', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)',
        [mainSide === 'left' ? 'borderLeft' : 'borderRight']: '1px solid var(--il-line)',
      }}>
      {sideHeader && <div style={{ flex: 'none', padding: `calc(6px + env(safe-area-inset-top, 0px)) ${T.pad.panel}px 6px` }}>{sideHeader}</div>}
      {sideScroll ? (
        <div ref={sideScrollRef} className="il-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: sideFooter ? 0 : 'var(--il-safe-bottom)' }}>
          {side}
        </div>
      ) : <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{side}</div>}
      {sideFooter && <div style={{ flex: 'none', padding: `8px ${T.pad.panel}px calc(8px + var(--il-safe-bottom))`, borderTop: '1px solid var(--il-line-soft)' }}>{sideFooter}</div>}
    </div>
  );
  return (
    <div data-frame="phone-landscape"
      style={{
        position: 'absolute', inset: 0, display: 'flex', background: 'var(--il-bg)',
        paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: rail ? 0 : 'env(safe-area-inset-right, 0px)', ...style,
      }}>
      {mainSide === 'left' ? [mainPane, sidePane] : [sidePane, mainPane]}
      {rail}
    </div>
  );
}
