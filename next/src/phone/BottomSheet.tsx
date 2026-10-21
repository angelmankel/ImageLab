/**
 * The phone's sheet (mobile pass, m-shell). One component for every phone sheet, so they all feel the
 * same: a grabber, a title row, a scrolling body, an optional footer (actions, a text box).
 *
 *   Portrait   ┌──────────────┐        Landscape  ┌──────────┬─────────┐
 *              │   picture    │                   │ picture  │ ▏ sheet │  (slides in from the right,
 *              ├──── ▬ ───────┤                   │          │ ▏ title │   full height, pull right
 *              │ title    ✕   │                   │          │ ▏ body  │   to close: thumbs are at
 *              │ body…        │                   │          │ ▏ foot  │   the sides in landscape)
 *              │ footer       │                   └──────────┴─────────┘
 *              └──────────────┘ (pull down to close)
 *
 *   <BottomSheet opened={o} onClose={close} title="Snippets" footer={<Button …/>}>…</BottomSheet>
 *
 * Safe areas: the footer / body clears the home bar; the side sheet clears the notch side.
 * Keyboard: the sheet rides above the on-screen keyboard (`--il-kb`, ./keyboard).
 * Pull-to-close works on the grabber and title anywhere, and on the body once it is scrolled to
 * the top. Esc closes. The open sheet survives a rotation (same component, it only changes side).
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Drawer } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { dvh, vw } from '~/theme/uiScale';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { usePullToClose } from './usePullToClose';

export interface BottomSheetProps {
  opened: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Bold title in the sheet's head row; omit for a bare grabber. */
  title?: ReactNode;
  /** Right side of the head row (an action next to ✕). */
  headRight?: ReactNode;
  /** Pinned under the body, above the home bar / keyboard. */
  footer?: ReactNode;
  /** 'auto' = as tall as the content (max 92%); 'full' = 92% always. */
  size?: 'auto' | 'full';
  /** In landscape, slide in from the right (default) instead of the bottom. */
  sideInLandscape?: boolean;
  /** Width of the side sheet in landscape (CSS length). */
  sideWidth?: string;
  /** Show the ✕ in the head row (default when there is a title). */
  withClose?: boolean;
  zIndex?: number;
  /** Body padding (default the panel padding). */
  bodyPadding?: number | string;
  /** Body ref (scroll restore, etc.). */
  bodyRef?: (el: HTMLDivElement | null) => void;
  'aria-label'?: string;
}

export function BottomSheet({
  opened, onClose, children, title, headRight, footer, size = 'auto', sideInLandscape = true,
  sideWidth = `min(440px, ${vw(56)})`, withClose, zIndex = T.z.sheet, bodyPadding = T.pad.panel, bodyRef, ...rest
}: BottomSheetProps) {
  const land = usePhoneLandscape() && sideInLandscape;
  const inner = useRef<HTMLDivElement>(null);
  const content = () => inner.current?.closest<HTMLElement>('.mantine-Drawer-content');
  const overlay = () => inner.current?.closest('.mantine-Drawer-root')?.querySelector<HTMLElement>('.mantine-Drawer-overlay');
  usePullToClose(inner, { onClose, dir: land ? 'right' : 'down', enabled: opened, target: content, fade: overlay });

  const showX = withClose ?? !!title;
  const maxH = `calc(${dvh(92)} - var(--il-kb, 0px))`;
  const contentStyle: CSSProperties = land
    ? { background: 'var(--il-panel)', borderLeft: '1px solid var(--il-line-soft)', borderRadius: '22px 0 0 22px', height: '100%', display: 'flex', flexDirection: 'column', paddingRight: 'env(safe-area-inset-right, 0px)' }
    : {
      background: 'var(--il-panel)', borderTop: '1px solid var(--il-line-soft)', borderRadius: '22px 22px 0 0',
      maxHeight: maxH, height: size === 'full' ? maxH : undefined, marginBottom: 'var(--il-kb, 0px)', display: 'flex', flexDirection: 'column',
      paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)',
    };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={land ? 'right' : 'bottom'}
      size={land ? sideWidth : 'auto'}
      withCloseButton={false}
      zIndex={zIndex}
      radius={0}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      aria-label={rest['aria-label']}
      styles={{ content: contentStyle, body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div ref={inner} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', paddingTop: land ? 'env(safe-area-inset-top, 0px)' : 0 }}>
          {!land && (
            <button type="button" aria-label="Close" onClick={onClose}
              style={{ width: '100%', height: 20, border: 0, padding: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--il-line-strong)' }} />
            </button>
          )}
          {(title || headRight || showX) && (
            <div style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, padding: `${land ? 6 : 0}px 6px 4px ${T.pad.panel + 4}px` }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
              {headRight}
              {showX && (
                <button type="button" aria-label="Close" onClick={onClose}
                  style={{ width: 44, height: 44, flex: 'none', border: 0, borderRadius: 22, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  <IconX size={20} stroke={2.2} />
                </button>
              )}
            </div>
          )}
        </div>
        <div ref={bodyRef} className="il-scroll"
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y',
            padding: bodyPadding, paddingBottom: footer ? (typeof bodyPadding === 'number' ? bodyPadding : undefined) : `calc(${typeof bodyPadding === 'number' ? `${bodyPadding}px` : bodyPadding} + var(--il-safe-bottom))`,
          }}>
          {children}
        </div>
        {footer && (
          <div style={{ flex: 'none', padding: `10px ${T.pad.panel}px calc(10px + var(--il-safe-bottom))`, borderTop: '1px solid var(--il-line-soft)', background: 'var(--il-panel)' }}>
            {footer}
          </div>
        )}
      </div>
    </Drawer>
  );
}
