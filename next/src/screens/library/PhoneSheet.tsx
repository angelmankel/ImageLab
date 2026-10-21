/**
 * Library, phone portrait (rule 12 + 11; mobile pass): the item sheet — the shared phone
 * `BottomSheet` (`~/phone`: pull down to close, safe areas) with the same picture, info and actions
 * as the desktop panel. Tap the picture = fullscreen; swipe sideways = next / previous.
 */
import { useRef } from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { BottomSheet, haptic } from '~/phone';
import type { LibItem } from './libraryLogic';
import { ItemDetail } from './ItemDetail';

export function PhoneSheet({ item, index, count, onClose, onOpen, onStep }: {
  item: LibItem | null; index: number; count: number; onClose: () => void; onOpen: () => void; onStep: (dir: 1 | -1) => void;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  const step = (dir: 1 | -1) => { haptic(); onStep(dir); };
  useSwipe(body, { dir: -1, enabled: !!item && index < count - 1, onSwipe: () => step(1) });
  useSwipe(body, { dir: 1, enabled: !!item && index > 0, onSwipe: () => step(-1) });

  return (
    <BottomSheet opened={!!item} onClose={onClose} aria-label="Picture" bodyRef={(el) => { body.current = el; }}>
      {item && <ItemDetail key={item.key} item={item} phone onOpen={onOpen} onDeleted={onClose} pager={`${index + 1} / ${count}`} />}
    </BottomSheet>
  );
}
