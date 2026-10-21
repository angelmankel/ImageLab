/**
 * Models in the phone map (mobile pass, Donny 10-21: stacked cards, depth is vertical; mockup
 * agent-handoffs/fixlist2-mockups/mobile-m-browse.html §3).
 *
 *   'models'  (depth 1, from the HUD ring): search, Sort · Period · Rating · Filters (a sheet), the
 *             source + type chips, the 2-column grid (3 in landscape). A tap on a tile's name
 *             row = the model's card; a tap on its picture = the model viewer (its own layer).
 *   'model' {id}: the opened model (`Detail`: gallery, versions, Download / Use, words, files).
 *             Sideways = the next / previous model of the grid; pull down = back to the grid.
 *             The band: ‹ Models · ◉ · ♥.
 * Landscape: the frame puts the grid and the model card side by side (the desktop's detail panel).
 * The ModelsModal picker keeps its own in-modal navigation (`PhoneBrowser`).
 */
import { useEffect } from 'react';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { haptic, phoneNav, registerPhonePage, usePhoneBand, type PhonePageProps } from '~/phone';
import { usePhoneLandscape } from '~/app/useIsPhone';
import { useModels } from './modelsStore';
import { PhoneBrowse, shownModelIds } from './PhoneBrowse';
import { Detail } from './Detail';
import { useBrowserSetup } from './ModelsBrowser';
import { useKeepScroll } from './useKeepScroll';

function ModelsPage({ page }: PhonePageProps) {
  useBrowserSetup();
  const land = usePhoneLandscape();
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <PhoneBrowse land={land} onOpenModel={(m) => { haptic(); phoneNav.push('model', { id: m.id }, { from: page.key }); }} />
    </div>
  );
}

function ModelPage({ params }: PhonePageProps<{ id: number }>) {
  const id = Number(params.id);
  const fav = useModels((s) => s.favourites.includes(id));
  const toggleFavourite = useModels((s) => s.toggleFavourite);
  const keepScroll = useKeepScroll(`detail:${id}`);
  // The store's opened model follows the card (versions, the picked picture); leaving clears it.
  useEffect(() => {
    if (useModels.getState().selectedId !== id) useModels.getState().open(id);
    return () => { if (useModels.getState().selectedId === id) useModels.getState().close(); };
  }, [id]);
  usePhoneBand({
    right: {
      label: fav ? 'Saved' : 'Favourite', tone: fav ? 'primary' : 'default',
      icon: fav ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2.2} />,
      onClick: () => { haptic(); toggleFavourite(id); },
    },
  });
  return (
    <div ref={keepScroll} className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: 16 }}>
      <Detail modelId={id} size="phone" />
    </div>
  );
}

registerPhonePage('models', { Component: ModelsPage, title: () => 'Models', screen: 'models' });
registerPhonePage<{ id: number }>('model', {
  Component: ModelPage,
  title: (p) => useModels.getState().items.find((m) => m.id === Number(p.id))?.name ?? 'Model',
  screen: 'models',
  siblings: (p) => {
    const ids = shownModelIds.ids;
    return { count: ids.length, index: ids.indexOf(Number(p.id)), at: (i) => ({ kind: 'model', params: { id: ids[i] } }) };
  },
});
