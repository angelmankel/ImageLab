/**
 * Settings → Appearance: the tile size of the History & collections grid (`collectionsTileSize`,
 * limits from `@/lib/storage`), and how video thumbnails play app-wide (`~/app/videoPreview`:
 * On hover · Autoplay · Off). The old logo picker (fix list 47) is gone: the logo is Monolith.
 */
import { Slider } from '~/ui';
import { useStore } from '@/lib/store';
import { COLLECTIONS_TILE_MAX, COLLECTIONS_TILE_MIN } from '@/lib/storage';
import type { SettingDef } from './categories';
import { useVideoPreview, type VideoPreviewMode } from '~/app/videoPreview';
import { Seg } from './themes/bits';

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

function VideoPreviewCtl() {
  const mode = useVideoPreview((s) => s.mode);
  const setMode = useVideoPreview((s) => s.setMode);
  return <Seg<VideoPreviewMode> label="Video previews" value={mode} options={[{ value: 'hover', label: 'On hover' }, { value: 'autoplay', label: 'Autoplay' }, { value: 'off', label: 'Off' }]} onChange={setMode} />;
}

export const APPEARANCE_ROWS: readonly SettingDef[] = [
  {
    id: 'appearance.tiles', category: 'appearance', label: 'Library tile size', wide: true,
    hint: 'How big the tiles in History & collections are.',
    keywords: ['grid', 'thumbnail', 'zoom', 'collections', 'history', 'gallery', 'pixels', 'display'],
    Control: TileCtl, Value: TileValue,
  },
  {
    id: 'appearance.videoPreviews', category: 'appearance', label: 'Video previews',
    hint: 'How video thumbnails play. Off shows a still.',
    keywords: ['video', 'autoplay', 'hover', 'play', 'clip', 'thumbnail', 'preview', 'motion', 'animate', 'models', 'history', 'library'],
    Control: VideoPreviewCtl,
  },
];
