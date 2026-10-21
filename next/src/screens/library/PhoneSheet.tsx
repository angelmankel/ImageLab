/**
 * Library, phone (rule 12 + 11): the item sheet — a bottom Drawer with the same picture, info and
 * actions as the desktop panel. Tap the picture = fullscreen; swipe sideways = next / previous.
 */
import { useRef } from 'react';
import { Drawer } from '@mantine/core';
import { useSwipe } from '@/hooks/useSwipe';
import { T } from '~/theme/tokens';
import type { LibItem } from './libraryLogic';
import { ItemDetail } from './ItemDetail';
import { dvh } from '~/theme/uiScale';

export function PhoneSheet({ item, index, count, onClose, onOpen, onStep }: {
  item: LibItem | null; index: number; count: number; onClose: () => void; onOpen: () => void; onStep: (dir: 1 | -1) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  useSwipe(body, { dir: -1, enabled: !!item && index < count - 1, onSwipe: () => onStep(1) });
  useSwipe(body, { dir: 1, enabled: !!item && index > 0, onSwipe: () => onStep(-1) });

  return (
    <Drawer
      opened={!!item}
      onClose={onClose}
      position="bottom"
      size="auto"
      zIndex={T.z.sheet}
      withCloseButton={false}
      radius={0}
      styles={{
        content: { background: 'var(--il-panel)', borderRadius: '22px 22px 0 0', maxHeight: dvh(92), display: 'flex', flexDirection: 'column' },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <button type="button" aria-label="Close" onClick={onClose}
        style={{ flex: 'none', height: 22, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--il-line-strong)' }} />
      </button>
      <div ref={body} className="il-scroll" style={{ flex: 1, minHeight: 0, padding: `0 ${T.pad.panel}px calc(${T.pad.panel}px + var(--il-safe-bottom))`, touchAction: 'pan-y' }}>
        {item && <ItemDetail key={item.key} item={item} phone onOpen={onOpen} onDeleted={onClose} pager={`${index + 1} / ${count}`} />}
      </div>
    </Drawer>
  );
}
