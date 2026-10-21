/**
 * The pack's manifest (`soundPack.json`, written by next/scripts/convert-sounds.cjs), loaded on
 * demand: its own chunk, fetched when Settings → Sounds opens, never in the main bundle.
 */
import { useEffect, useState } from 'react';
import type { PackFolder, PackSound } from './soundActions';

export interface SoundPack { pack: string; formats: string[]; folders: PackFolder[]; sounds: PackSound[] }

let cached: SoundPack | null = null;
let loading: Promise<SoundPack | null> | null = null;

export function loadSoundPack(): Promise<SoundPack | null> {
  if (cached) return Promise.resolve(cached);
  loading ??= import('./soundPack.json').then((m) => { cached = (m.default ?? m) as SoundPack; return cached; }).catch(() => { loading = null; return null; });
  return loading;
}

/** The manifest, null until it has loaded. */
export function useSoundPack(): SoundPack | null {
  const [pack, setPack] = useState<SoundPack | null>(cached);
  useEffect(() => {
    if (pack) return;
    let alive = true;
    void loadSoundPack().then((p) => { if (alive) setPack(p); });
    return () => { alive = false; };
  }, [pack]);
  return pack;
}
