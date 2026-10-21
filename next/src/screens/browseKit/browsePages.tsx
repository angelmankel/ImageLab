/**
 * m-browse's places in the phone map (mobile pass, Donny 10-21: stacked cards, the 2D map). Imported
 * once by the phone shell. Each place hangs off Home at depth 1 (the HUD ring opens
 * [home, <place>]); deeper cards are pushed from inside:
 *   'library' (History) → 'picture' {key}      siblings = the grid's pictures
 *   'models'            → 'model' {id}         siblings = the grid's models   (../models/modelsPages)
 *   'comfy'  (ComfyUI)
 * The names match the route screens, so old `useRoute.go('library')` lands on the same page.
 */
import { registerPhonePage, type PhonePageProps } from '~/phone';
import { LibraryPage, PicturePage, visibleKeys } from '~/screens/library/LibraryPhoneScreen';
import { ComfyPhoneScreen } from '~/screens/comfy/ComfyPhoneScreen';
import '~/screens/models/modelsPages';

function ComfyPage() {
  return <div style={{ position: 'absolute', inset: 0 }}><ComfyPhoneScreen /></div>;
}

registerPhonePage('library', { Component: (p: PhonePageProps) => <LibraryPage {...p} />, title: () => 'History', screen: 'library' });
registerPhonePage<{ key: string }>('picture', {
  Component: PicturePage,
  title: (p) => { const i = visibleKeys.keys.indexOf(String(p.key)); return i >= 0 ? `${i + 1} / ${visibleKeys.keys.length}` : 'Picture'; },
  screen: 'library',
  siblings: (p) => {
    const keys = visibleKeys.keys;
    return { count: keys.length, index: keys.indexOf(String(p.key)), at: (i) => ({ kind: 'picture', params: { key: keys[i] } }) };
  },
});
registerPhonePage('comfy', { Component: ComfyPage, title: () => 'ComfyUI', screen: 'comfy' });
