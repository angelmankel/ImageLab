/**
 * Small app-wide signals for things that live in component state rather than a store — the
 * Settings window's open flag in App, the phone shell's tab — so a far-off caller (the quick
 * search) can ask for them without prop-drilling. Imports nothing.
 */

type AppEvents = {
  'open-settings': undefined;
  'open-spotlight': undefined;
  /** Switch the phone's Generate shell to one of its tabs. */
  'mobile-tab': 'parameters' | 'image' | 'gallery';
};

const PREFIX = 'imagelab:';

export function emitApp<K extends keyof AppEvents>(name: K, ...detail: AppEvents[K] extends undefined ? [] : [AppEvents[K]]) {
  window.dispatchEvent(new CustomEvent(PREFIX + name, { detail: detail[0] }));
}

/** Listen; returns the unsubscribe, so it drops straight into a useEffect. */
export function onApp<K extends keyof AppEvents>(name: K, handler: (detail: AppEvents[K]) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent).detail as AppEvents[K]);
  window.addEventListener(PREFIX + name, fn);
  return () => window.removeEventListener(PREFIX + name, fn);
}
