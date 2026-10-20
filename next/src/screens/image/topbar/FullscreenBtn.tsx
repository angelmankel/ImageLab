/**
 * Top-bar fullscreen toggle (rule 9): browser fullscreen on the whole page
 * (`document.documentElement`). The icon follows `fullscreenchange`, so Esc / F11 / the browser's
 * own exit keep it in sync. Renders nothing where the Fullscreen API is not allowed.
 */
import { useEffect, useState } from 'react';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { IconBtn } from '~/ui';

export function FullscreenBtn() {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  const toggle = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    p?.catch(() => { /* refused (no user gesture / policy): the icon stays as it was */ });
  };
  return (
    <IconBtn
      icon={full ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
      label={full ? 'Exit fullscreen' : 'Fullscreen'}
      onClick={toggle}
      on={full}
    />
  );
}
