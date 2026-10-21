/**
 * Phone 3 of the Models-Phone board: a model opened full screen. Name + ♥ on top, then one scroll
 * (`touch-action: pan-y`) with the full-bleed gallery and everything else from `Detail`; the
 * centred Back pill closes it (and the phone's back button works: opening pushes one history entry).
 * In the picker modal the pill reads "Back" too and returns to the list.
 */
import { useEffect } from 'react';
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react';
import { haptic } from '~/phone';
import { BackPill } from '~/ui';
import { useModels } from './modelsStore';
import { Detail } from './Detail';
import { useKeepScroll } from './useKeepScroll';

/** The phone's back button closes the opened model instead of leaving the screen (opening pushes one history entry). */
export function useBackClosesModel(modelId: number | null) {
  const close = useModels((s) => s.close);
  useEffect(() => {
    if (modelId == null) return;
    const key = `models-open-${modelId}`;
    history.pushState({ key }, '');
    const onPop = () => close();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.key === key) history.back();
    };
  }, [modelId, close]);
}

export function PhoneModel({ modelId }: { modelId: number }) {
  const close = useModels((s) => s.close);
  const keepScroll = useKeepScroll(`detail:${modelId}`);
  useBackClosesModel(modelId);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', padding: '12px 16px 0' }}><ModelHead modelId={modelId} /></div>
      <div ref={keepScroll} className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 0 100px', touchAction: 'pan-y', overflowX: 'hidden' }}>
        <Detail modelId={modelId} size="phone" />
      </div>
      <BackPill onClick={close} />
    </div>
  );
}

/** The opened model's name + ♥ (+ ✕ in the landscape side pane). */
export function ModelHead({ modelId, onClose }: { modelId: number; onClose?: () => void }) {
  const name = useModels((s) => s.items.find((m) => m.id === modelId)?.name);
  const fav = useModels((s) => s.favourites.includes(modelId));
  const toggleFavourite = useModels((s) => s.toggleFavourite);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: onClose ? 16 : 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name ?? 'Model'}</span>
      <button type="button" aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} onClick={() => { haptic(); toggleFavourite(modelId); }} style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'var(--il-elev)', color: fav ? 'var(--il-ember)' : 'var(--il-fg2)', display: 'grid', placeItems: 'center', flex: 'none', cursor: 'pointer' }}>
        {fav ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2.2} />}
      </button>
      {onClose && (
        <button type="button" aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', flex: 'none', cursor: 'pointer' }}>
          <IconX size={20} stroke={2.2} />
        </button>
      )}
    </div>
  );
}
