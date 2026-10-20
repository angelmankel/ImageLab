/**
 * Phone 3 of the Models-Phone board: a model opened full screen. Name + ♥ on top, then one scroll
 * (`touch-action: pan-y`) with the full-bleed gallery and everything else from `Detail`; the
 * centred Back pill closes it (and the phone's back button works: opening pushes one history entry).
 * In the picker modal the pill reads "Back" too and returns to the list.
 */
import { useEffect } from 'react';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { BackPill } from '~/ui';
import { useModels } from './modelsStore';
import { Detail } from './Detail';

export function PhoneModel({ modelId }: { modelId: number }) {
  const close = useModels((s) => s.close);
  const name = useModels((s) => s.items.find((m) => m.id === modelId)?.name);
  const fav = useModels((s) => s.favourites.includes(modelId));
  const toggleFavourite = useModels((s) => s.toggleFavourite);

  // The phone's back button closes the model instead of leaving the screen.
  useEffect(() => {
    const key = `models-open-${modelId}`;
    history.pushState({ key }, '');
    const onPop = () => close();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.key === key) history.back();
    };
  }, [modelId, close]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px 0' }}>
        <span style={{ fontWeight: 800, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name ?? 'Model'}</span>
        <button type="button" aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} onClick={() => toggleFavourite(modelId)} style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'var(--il-elev)', color: fav ? 'var(--il-ember)' : 'var(--il-fg2)', display: 'grid', placeItems: 'center', flex: 'none', cursor: 'pointer' }}>
          {fav ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2.2} />}
        </button>
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 0 100px', touchAction: 'pan-y' }}>
        <Detail modelId={modelId} size="phone" />
      </div>
      <BackPill onClick={close} />
    </div>
  );
}
