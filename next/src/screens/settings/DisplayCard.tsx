/**
 * Settings → Display: which image a model's preview starts on (`modelPreviewSource`) and the
 * tile size of the History & collections grid (`collectionsTileSize`). Logic = `@/lib/store`
 * with the option lists and limits from `@/lib/storage`.
 */
import { useStore } from '@/lib/store';
import { COLLECTIONS_TILE_MAX, COLLECTIONS_TILE_MIN, PREVIEW_SOURCES } from '@/lib/storage';
import { Chip, Row, SliderRow } from '~/ui';
import { Field, SettingsCard } from './SettingsCard';

export function DisplayCard() {
  const source = useStore((s) => s.modelPreviewSource);
  const setSource = useStore((s) => s.setModelPreviewSource);
  const tile = useStore((s) => s.collectionsTileSize);
  const setTile = useStore((s) => s.setCollectionsTileSize);
  const current = PREVIEW_SOURCES.find((p) => p.value === source);
  return (
    <SettingsCard title="Display" description="Model previews and the library grid.">
      <Field label="Model preview starts on" hint={current?.description}>
        <Row wrap>
          {PREVIEW_SOURCES.map((p) => <Chip key={p.value} small on={p.value === source} onClick={() => setSource(p.value)}>{p.label}</Chip>)}
        </Row>
      </Field>
      <SliderRow label="Library tile size" value={tile} min={COLLECTIONS_TILE_MIN} max={COLLECTIONS_TILE_MAX} step={10} onChange={setTile} format={(v) => `${v}px`} />
    </SettingsCard>
  );
}
