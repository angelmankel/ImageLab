/** Library (rule 12): tile size — three round buttons on one elev track (small · medium · large). */
import type { ReactNode } from 'react';
import { Tooltip } from '@mantine/core';
import { useLibrary } from './libraryStore';
import type { TileSize } from './libraryLogic';
import { TilesLarge, TilesMedium, TilesSmall } from './icons';

const SIZES: Array<{ key: TileSize; label: string; icon: ReactNode }> = [
  { key: 's', label: 'Small tiles', icon: <TilesSmall /> },
  { key: 'm', label: 'Medium tiles', icon: <TilesMedium /> },
  { key: 'l', label: 'Large tiles', icon: <TilesLarge /> },
];

export function TileSizeSwitch() {
  const size = useLibrary((s) => s.tileSize);
  const setSize = useLibrary((s) => s.setTileSize);
  return (
    <div role="group" aria-label="Tile size" style={{ display: 'flex', gap: 2, background: 'var(--il-elev)', borderRadius: 999, padding: 3, flex: 'none' }}>
      {SIZES.map((s) => {
        const on = s.key === size;
        return (
          <Tooltip key={s.key} label={s.label}>
            <button type="button" aria-label={s.label} aria-pressed={on} onClick={() => setSize(s.key)}
              style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              {s.icon}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
