/**
 * The globals on the HUD ring (Donny 10-21): Generate + Jobs · Undo / Redo · History / Models /
 * ComfyUI · Settings / Mute / Sessions. Home is the circle itself. One hook builds the live list
 * (labels, disabled, counts) so the ring and its tests agree on the order.
 */
import type { ReactNode } from 'react';
import {
  IconArrowBackUp, IconArrowForwardUp, IconBoltFilled, IconCube, IconDice5Filled, IconHistory, IconListDetails,
  IconSettings, IconStack2, IconTopologyStar3, IconVolume, IconVolumeOff,
} from '@tabler/icons-react';
import { playSound, useSoundStore } from '@/lib/sounds';
import { redo, undo, useRedoLabel, useUndoLabel } from '~/app/undo';
import { useQueue } from '~/app/queue';
import { useGenerate } from '~/screens/phone/imageBridge';
import { usePhone } from '~/screens/phone/phoneStore';
import { phoneNav } from './navStore';
import { openSheet } from './hudStore';

export interface RingItem { id: string; label: string; icon: ReactNode; run: () => void; disabled?: boolean; badge?: string | null; hot?: boolean }

const I = 22;

export function useRingItems(): { inner: RingItem[]; outer: RingItem[] } {
  const u = useUndoLabel();
  const r = useRedoLabel();
  const { rows } = useQueue();
  const { generate, generateRandom } = useGenerate();
  const seedMode = usePhone((s) => s.seedMode);
  const muted = useSoundStore((s) => s.muted || s.volume <= 0);
  const place = (kind: string) => () => phoneNav.open([{ kind: 'home' }, { kind }]);
  return {
    inner: [
      { id: 'undo', label: 'Undo', icon: <IconArrowBackUp size={I} stroke={2.2} />, run: () => { undo(); }, disabled: !u },
      { id: 'generate', label: 'Generate', icon: seedMode === 'random' ? <IconDice5Filled size={I} /> : <IconBoltFilled size={I} />, run: () => (seedMode === 'random' ? generateRandom() : generate()), hot: true },
      { id: 'jobs', label: 'Jobs', icon: <IconListDetails size={I} stroke={2.1} />, run: () => openSheet('jobs'), badge: rows.length ? String(rows.length > 9 ? '9+' : rows.length) : null },
      { id: 'redo', label: 'Redo', icon: <IconArrowForwardUp size={I} stroke={2.2} />, run: () => { redo(); }, disabled: !r },
    ],
    outer: [
      { id: 'library', label: 'History', icon: <IconHistory size={I} stroke={2.1} />, run: place('library') },
      { id: 'models', label: 'Models', icon: <IconCube size={I} stroke={2.1} />, run: place('models') },
      { id: 'comfy', label: 'ComfyUI', icon: <IconTopologyStar3 size={I} stroke={2.1} />, run: place('comfy') },
      { id: 'sessions', label: 'Sessions', icon: <IconStack2 size={I} stroke={2.1} />, run: () => openSheet('sessions') },
      { id: 'settings', label: 'Settings', icon: <IconSettings size={I} stroke={2.1} />, run: place('settings') },
      {
        id: 'mute', label: muted ? 'Sound on' : 'Mute', icon: muted ? <IconVolumeOff size={I} stroke={2.1} /> : <IconVolume size={I} stroke={2.1} />,
        run: () => {
          const s = useSoundStore.getState();
          if (s.volume <= 0) { s.setVolume(0.5); s.setMuted(false); } else s.toggleMuted();
          window.setTimeout(() => playSound('toggle', { on: true }), 0);
        },
      },
    ],
  };
}
