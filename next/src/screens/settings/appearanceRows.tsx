/**
 * Settings → Appearance: the tile size of the History & collections grid (`collectionsTileSize`,
 * limits from `@/lib/storage`). The old logo picker (fix list 47) is gone: the logo is Monolith.
 */
import { Slider } from '~/ui';
import { useStore } from '@/lib/store';
import { COLLECTIONS_TILE_MAX, COLLECTIONS_TILE_MIN } from '@/lib/storage';
import type { SettingDef } from './categories';

function TileValue() {
  const tile = useStore((s) => s.collectionsTileSize);
  return <>{tile}px</>;
}

function TileCtl() {
  const tile = useStore((s) => s.collectionsTileSize);
  const setTile = useStore((s) => s.setCollectionsTileSize);
  return (
    <div style={{ width: '100%' }}>
      <Slider value={tile} min={COLLECTIONS_TILE_MIN} max={COLLECTIONS_TILE_MAX} step={10} onChange={setTile} aria-label="Library tile size" />
    </div>
  );
}

export const APPEARANCE_ROWS: readonly SettingDef[] = [
  {
    id: 'appearance.tiles', category: 'appearance', label: 'Library tile size', wide: true,
    hint: 'How big the tiles in History & collections are.',
    keywords: ['grid', 'thumbnail', 'zoom', 'collections', 'history', 'gallery', 'pixels', 'display'],
    Control: TileCtl, Value: TileValue,
  },
];
