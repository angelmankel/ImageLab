/**
 * The Output page's picture (rule 11): the step's current result, full width, its own aspect
 * (capped so the strip below stays in reach), nothing over it. It is the main app's swipeable
 * hero (`HeroResult` bare: swipe left / right = next / previous result, a live frame while the
 * job runs) and a TAP opens the original fullscreen viewer straight away — the viewer grows out of
 * this picture (`data-viewer-origin`). While the hero can page it is `data-no-swipe`, so its
 * sideways swipes never change the step.
 */
import { HeroResult } from '@/components/blocks/HeroResult';
import { useMediaAspect } from '@/hooks/useMediaAspect';
import type { ResultItem } from '@/lib/workspace';

export function OutputPicture({ items, currentKey, onPick, onOpen, live, busy, status, fallbackAspect, empty }: {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
  live: string | null;
  busy: boolean;
  status?: string | null;
  fallbackAspect: number;
  empty: string;
}) {
  const current = items.find((i) => i.key === currentKey) ?? null;
  const shown = live ?? current?.url ?? null;
  const measured = useMediaAspect(shown, !live && current?.kind === 'video' ? 'video' : 'image');
  const aspect = measured ?? fallbackAspect;
  const canPage = items.length > 1 && !live;
  return (
    <div
      data-no-swipe={canPage ? '' : undefined}
      style={{ position: 'relative', width: '100%', aspectRatio: String(aspect || 1), maxHeight: '68dvh', flex: 'none', overflow: 'hidden', background: 'var(--il-bg)' }}
    >
      <HeroResult
        bare
        hideProgress
        items={items}
        currentKey={currentKey}
        onPick={onPick}
        preview={live}
        busy={busy}
        statusLine={status ?? undefined}
        onOpen={(it) => onOpen(it.key)}
        empty={empty}
      />
    </div>
  );
}
