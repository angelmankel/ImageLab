/**
 * Settings → Appearance: the logo (fix list 47: Spark · Frame · Prism, `~/app/logo`) and the tile
 * size of the History & collections grid (`collectionsTileSize`, limits from `@/lib/storage`).
 */
import { Slider } from '@mantine/core';
import { useStore } from '@/lib/store';
import { COLLECTIONS_TILE_MAX, COLLECTIONS_TILE_MIN } from '@/lib/storage';
import type { SettingDef } from './categories';
import { LOGOS, LogoMark, LogoWordmark, useLogo } from '~/app/logo';

function TileValue() {
  const tile = useStore((s) => s.collectionsTileSize);
  return <>{tile}px</>;
}

function TileCtl() {
  const tile = useStore((s) => s.collectionsTileSize);
  const setTile = useStore((s) => s.setCollectionsTileSize);
  return (
    <div style={{ width: '100%' }}>
      <Slider value={tile} min={COLLECTIONS_TILE_MIN} max={COLLECTIONS_TILE_MAX} step={10} onChange={setTile} label={null} size="sm" color="ember"
        aria-label="Library tile size" styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
    </div>
  );
}

/** Fix list 47: the three logo options, one tap each (the top-left mark, the wordmark and the favicon follow). */
function LogoCtl() {
  const logo = useLogo((s) => s.logo);
  const setLogo = useLogo((s) => s.setLogo);
  return (
    <div role="radiogroup" aria-label="Logo" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, width: '100%' }}>
      {LOGOS.map((l) => {
        const on = l.id === logo;
        return (
          <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => setLogo(l.id)} title={l.caption}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minHeight: 72, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-soft)'}`, color: 'var(--il-fg)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><LogoMark id={l.id} size={30} /><LogoWordmark id={l.id} size={17} /></span>
            <span style={{ fontSize: 11, fontWeight: 700, color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)' }}>{l.name}{on ? ' · in use' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

function LogoValue() {
  const logo = useLogo((s) => s.logo);
  return <>{LOGOS.find((l) => l.id === logo)?.name}</>;
}

export const APPEARANCE_ROWS: readonly SettingDef[] = [
  {
    id: 'appearance.logo', category: 'appearance', label: 'Logo', wide: true,
    hint: 'The app’s mark and name in the top left and the browser tab icon. Spark is the default.',
    keywords: ['logo', 'brand', 'icon', 'favicon', 'wordmark', 'spark', 'frame', 'prism'],
    Control: LogoCtl, Value: LogoValue,
  },
  {
    id: 'appearance.tiles', category: 'appearance', label: 'Library tile size', wide: true,
    hint: 'How big the tiles in History & collections are.',
    keywords: ['grid', 'thumbnail', 'zoom', 'collections', 'history', 'gallery', 'pixels', 'display'],
    Control: TileCtl, Value: TileValue,
  },
];
