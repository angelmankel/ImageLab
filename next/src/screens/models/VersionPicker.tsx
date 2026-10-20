/**
 * Pick which version of a model to download / use (fix list item 32: "no way to select a version
 * to download from here"). One control for the tile's action bar and the detail panel's version
 * card: the chosen version's name + base + size and a ▾; the menu lists every version with its
 * base model, size and ✓ when a server has it. A single-version model shows the same face, no menu.
 * A dropdown, not a pill strip, so a model with 20 versions never pushes anything sideways.
 */
import { Menu } from '@mantine/core';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { primaryFile } from '@/features/model-metadata/civitai';
import { T } from '~/theme/tokens';
import { baseModelShort, fmtSizeKB } from './civitaiQuery';
import { useInstalled } from './useInstalled';

export function VersionPicker({ model, version, onVersion, h = 34, showBase = false, grow = true }: {
  model: CivitaiModel; version: CivitaiModelVersion; onVersion: (v: CivitaiModelVersion) => void;
  h?: number; showBase?: boolean; grow?: boolean;
}) {
  const installed = useInstalled();
  const versions = model.modelVersions;
  const many = versions.length > 1;
  const size = fmtSizeKB(primaryFile(version)?.sizeKB);
  const has = installed.version(version);
  const face = (
    <button
      type="button"
      className="ilm-vsel"
      disabled={!many}
      aria-label={many ? `Version ${version.name} · ${versions.length} versions · pick another` : `Version ${version.name}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: grow ? 1 : 'none', minWidth: 0, height: h, padding: '0 9px 0 10px', borderRadius: 10, cursor: many ? 'pointer' : 'default',
        border: '1px solid var(--il-line-strong)', background: 'var(--il-elev)', color: 'var(--il-fg)', font: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textAlign: 'left',
      }}
    >
      {has && <IconCheck size={12} stroke={3} color="var(--il-ok)" style={{ flex: 'none' }} />}
      <b style={{ fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{version.name}</b>
      {showBase && version.baseModel && <span style={{ color: 'var(--il-muted)', whiteSpace: 'nowrap', flex: 'none' }}>{baseModelShort(version.baseModel)}</span>}
      <span style={{ marginLeft: 'auto', color: 'var(--il-muted)', whiteSpace: 'nowrap', flex: 'none' }}>{size}{many ? ` · ${versions.length}` : ''}</span>
      {many && <IconChevronDown size={13} stroke={2.6} style={{ flex: 'none', color: 'var(--il-fg2)' }} />}
    </button>
  );
  if (!many) return face;
  return (
    <Menu position="bottom-start" withinPortal shadow="md" zIndex={T.z.popover} width={280} offset={4}>
      <Menu.Target>{face}</Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()} className="il-scroll" style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', borderRadius: 12, padding: 4, maxHeight: 340, overflowY: 'auto' }}>
        {versions.map((v) => {
          const on = v.id === version.id;
          const vHas = installed.version(v);
          return (
            <Menu.Item key={v.id} onClick={() => onVersion(v)}
              style={{ borderRadius: 8, minHeight: 38, fontSize: 12, fontWeight: 700, background: on ? 'var(--il-ember-soft)' : undefined, color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                {v.baseModel && <span style={{ flex: 'none', fontSize: 10, color: 'var(--il-muted)' }}>{baseModelShort(v.baseModel)}</span>}
                <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 11, color: 'var(--il-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {fmtSizeKB(primaryFile(v)?.sizeKB)}
                  {vHas && <IconCheck size={12} stroke={3} color="var(--il-ok)" />}
                </span>
              </span>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
