/**
 * The mute switch (item 44): an icon button for the top bar's right side, beside fullscreen (the
 * shell agent places it). Silences every sound — UI clicks, the queued blip, the done chime —
 * without touching the volume; remembered across reloads (`@/lib/sounds`, `imagelab.sound.v1`).
 */
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { playSound, useSoundStore } from '@/lib/sounds';
import { IconBtn } from './IconBtn';

export function MuteToggle({ size = 36 }: { size?: number }) {
  const muted = useSoundStore((s) => s.muted);
  const off = useSoundStore((s) => s.volume <= 0);
  const silent = muted || off;
  const toggle = () => {
    const s = useSoundStore.getState();
    if (s.volume <= 0) { s.setVolume(0.5); s.setMuted(false); }
    else s.toggleMuted();
    // Unmuting confirms with the toggle sound (it plays only when unmuted).
    window.setTimeout(() => playSound('toggle', { on: true }), 0);
  };
  return (
    <IconBtn
      icon={silent ? <IconVolumeOff size={Math.round(size * 0.5)} /> : <IconVolume size={Math.round(size * 0.5)} />}
      label={silent ? 'Sounds off — turn on' : 'Mute sounds'}
      hint="sound"
      size={size}
      on={silent}
      onClick={toggle}
    />
  );
}
