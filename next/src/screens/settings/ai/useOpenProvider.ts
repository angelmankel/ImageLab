/**
 * Which provider page is open, from the hash (`#/settings/ai/<id>`, settingsLogic.providerOfHash)
 * so Android back closes it on the phone and the desktop pane follows the same route. `open`
 * pushes a history entry; `close` pops it (or lands on `#/settings/ai` when nothing was pushed).
 */
import { useEffect, useState } from 'react';
import { isProviderId, type AiProviderId } from '@/lib/aiProviders';
import { hashOfCategory, hashOfProvider, providerOfHash } from '../settingsLogic';
import { useSettingsUi } from '../settingsStore';
import { useNavFrame } from '~/phone/nav/frameFlag';
import { phoneNav } from '~/phone/nav/navStore';

/** Whether this page pushed the open provider's history entry (shared: the list opens, the pane closes). */
let pushed = false;

function read(): AiProviderId | null {
  if (typeof location === 'undefined') return null;
  const id = providerOfHash(location.hash);
  return isProviderId(id) ? id : null;
}

export function useOpenProvider() {
  const [provider, setProvider] = useState<AiProviderId | null>(read);
  useEffect(() => {
    const onHash = () => setProvider(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return {
    provider,
    open: openProviderPage,
    close: () => {
      if (pushed) { pushed = false; history.back(); return; }
      history.replaceState(null, '', hashOfCategory('ai'));
      setProvider(null);
    },
  };
}

/** Open a provider page from anywhere in Settings (the list rows, "+ Add provider"); a search
 *  that showed the list is cleared so the page is what shows. */
export function openProviderPage(id: AiProviderId) {
  useSettingsUi.getState().setQuery('');
  // The phone map: a card, not a hash entry (the map is the phone's history).
  if (useNavFrame.getState().on) { phoneNav.push('settings-provider', { id }); return; }
  pushed = true;
  location.hash = hashOfProvider(id);
}
