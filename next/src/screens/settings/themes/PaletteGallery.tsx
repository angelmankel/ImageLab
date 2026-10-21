/**
 * Settings → Themes → Palette (item 35): every palette as a card (stripes = page · card · accent ·
 * bright accent · second colour). Tap = use it. On a desktop, resting the pointer on a card
 * previews it on the whole app; leaving puts yours back. Saved palettes carry a × (with Undo);
 * the last card saves the current colours under a name.
 */
import { useState } from 'react';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { pushUndo } from '~/app/undo';
import { useTheme } from '~/theme/themeStore';
import { PRESETS, type NamedPalette, type Palette } from '~/theme/themeModel';
import { Button } from '~/ui';
import { Stripes } from './bits';

const stripes = (p: Palette) => [p.bg, p.card, p.ember, p.emberHi, p.accent2];

function Card({ p, on, onDelete }: { p: NamedPalette; on: boolean; onDelete?: () => void }) {
  const pick = useTheme((s) => s.pickPalette);
  const setPreview = useTheme((s) => s.setPreview);
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-pressed={on} aria-label={`Use the ${p.name} palette`} className="il-btn"
        onClick={() => pick(p)}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !on) setPreview(p.palette); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPreview(null); }}
        style={{
          display: 'block', width: '100%', padding: 0, border: 0, textAlign: 'left', overflow: 'hidden',
          borderRadius: 'calc(12px * var(--il-corners, 1))', background: p.palette.card,
          outline: on ? '2px solid var(--il-ember)' : `1px solid ${p.palette.lineSoft}`, outlineOffset: on ? 1 : -1,
        }}>
        <Stripes colors={stripes(p.palette)} h={40} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', fontSize: 11, fontWeight: 700, color: p.palette.fg2, minHeight: 28 }}>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          {on && <IconCheck size={13} stroke={3} style={{ color: p.palette.ember, flex: 'none' }} />}
        </span>
      </button>
      {onDelete && (
        <button type="button" aria-label={`Delete ${p.name}`} onClick={onDelete} className="il-btn"
          style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)', color: '#fff', padding: 0 }}>
          <IconX size={13} stroke={2.6} />
        </button>
      )}
    </div>
  );
}

function SaveCard() {
  const save = useTheme((s) => s.savePalette);
  const [name, setName] = useState<string | null>(null);
  if (name === null) {
    return (
      <button type="button" onClick={() => setName('')} className="il-btn"
        style={{ minHeight: 74, border: '1px dashed var(--il-line-strong)', borderRadius: 'calc(12px * var(--il-corners, 1))', background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <IconPlus size={16} stroke={2.4} />Save current
      </button>
    );
  }
  const done = () => { save(name || 'My palette'); setName(null); };
  return (
    <div style={{ minHeight: 74, border: '1px solid var(--il-ember-line)', borderRadius: 'calc(12px * var(--il-corners, 1))', padding: 6, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--il-card)' }}>
      <div className="il-field" style={{ height: 30 }}>
        <input autoFocus value={name} placeholder="Name" maxLength={40} aria-label="Palette name"
          onChange={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') done(); if (e.key === 'Escape') setName(null); }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Button size="sm" tone="primary" h={28} grow onClick={done}>Save</Button>
        <Button size="sm" tone="ghost" h={28} onClick={() => setName(null)}>Cancel</Button>
      </div>
    </div>
  );
}

export function PaletteGallery() {
  const theme = useTheme((s) => s.theme);
  const saved = useTheme((s) => s.saved);
  const remove = useTheme((s) => s.deletePalette);
  const replace = useTheme((s) => s.replace);
  const custom = theme.paletteId === 'custom';
  const del = (p: NamedPalette) => {
    const before = { theme: useTheme.getState().theme, saved: useTheme.getState().saved };
    remove(p.id);
    pushUndo({ label: 'Delete palette', undo: () => { useTheme.setState({ saved: before.saved }); replace(before.theme); }, redo: () => useTheme.getState().deletePalette(p.id) });
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8, width: '100%' }}>
      {custom && <Card p={{ id: 'custom', name: 'Yours (unsaved)', palette: theme.palette }} on />}
      {saved.map((p) => <Card key={p.id} p={p} on={theme.paletteId === p.id} onDelete={() => del(p)} />)}
      {PRESETS.map((p) => <Card key={p.id} p={p} on={theme.paletteId === p.id} />)}
      <SaveCard />
    </div>
  );
}
