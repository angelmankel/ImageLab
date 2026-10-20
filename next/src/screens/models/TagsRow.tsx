/**
 * Tag browsing (models-picker brief, item 4): a row of group chips (Style · Character · Concept
 * · Clothing · Pose · Tool · Base · Most used) built from the loaded models; an open group shows
 * its tags as chips, picked ones ember. The picked tags are also removable chips in the
 * active-filter line. `TagGroups` is the same thing stacked, for the phone's Filters sheet.
 */
import { useMemo } from 'react';
import { IconX } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { groupTags } from './tags';
import { useModels } from './modelsStore';
import { FChip, Label, type Size } from './bits';

export function TagsRow({ pool }: { pool: CivitaiModel[] }) {
  const selectedTags = useModels((s) => s.selectedTags);
  const toggleTag = useModels((s) => s.toggleTag);
  const clearTags = useModels((s) => s.clearTags);
  const open = useModels((s) => s.tagsOpen);
  const setOpen = useModels((s) => s.setTagsOpen);
  const groups = useMemo(() => groupTags(pool, { limit: 40, selected: selectedTags }), [pool, selectedTags]);
  const current = groups.find((g) => g.group === open);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 'none' }}>
      <div className="il-scroll-x" style={{ height: 40, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap' }}>
        <Label style={{ marginRight: 2 }}>TAGS</Label>
        {groups.length === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>load some models to browse their tags</span>}
        {groups.map((g) => {
          const picked = g.tags.filter((t) => selectedTags.includes(t.tag)).length;
          return (
            <FChip key={g.group} on={open === g.group} onClick={() => setOpen(open === g.group ? null : g.group)} style={open === g.group ? undefined : picked ? { borderColor: 'var(--il-ember-line)', color: 'var(--il-ember-hi)' } : undefined}>
              {g.group}{picked ? ` · ${picked}` : ''}<span style={{ opacity: .6, fontSize: 9 }}>{open === g.group ? '▴' : '▾'}</span>
            </FChip>
          );
        })}
        {selectedTags.length > 0 && <button type="button" onClick={clearTags} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, marginLeft: 4, flex: 'none', cursor: 'pointer', padding: 0 }}>Clear tags</button>}
      </div>
      {current && (
        <div style={{ margin: '0 12px 6px', padding: 8, borderRadius: 14, background: 'var(--il-panel)', border: '1px solid var(--il-line)', display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 132, overflowY: 'auto' }} className="il-scroll">
          {current.tags.map((t) => (
            <FChip key={t.tag} on={selectedTags.includes(t.tag)} onClick={() => toggleTag(t.tag)}>
              {t.tag}<span style={{ opacity: .6, fontSize: 9 }}>{t.count}</span>
            </FChip>
          ))}
        </div>
      )}
    </div>
  );
}

/** The picked tags as removable chips (the active-filter line, the phone's summary). */
export function SelectedTagChips({ size = 'desktop' }: { size?: Size }) {
  const selectedTags = useModels((s) => s.selectedTags);
  const toggleTag = useModels((s) => s.toggleTag);
  if (!selectedTags.length) return null;
  return (
    <>
      {selectedTags.map((t) => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: size === 'phone' ? 32 : 22, padding: '0 6px 0 9px', borderRadius: 999, background: 'var(--il-ember-soft)', border: '1px solid var(--il-ember-line)', color: 'var(--il-ember-hi)', fontSize: size === 'phone' ? 12 : 11, fontWeight: 800, flex: 'none' }}>
          #{t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => toggleTag(t)} style={{ width: 16, height: 16, padding: 0, border: 0, borderRadius: '50%', background: 'transparent', color: 'inherit', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={10} stroke={3} /></button>
        </span>
      ))}
    </>
  );
}

/** Every group stacked, for the phone's Filters sheet. */
export function TagGroups({ pool }: { pool: CivitaiModel[] }) {
  const selectedTags = useModels((s) => s.selectedTags);
  const toggleTag = useModels((s) => s.toggleTag);
  const open = useModels((s) => s.tagsOpen);
  const setOpen = useModels((s) => s.setTagsOpen);
  const groups = useMemo(() => groupTags(pool, { limit: 30, selected: selectedTags }), [pool, selectedTags]);
  if (!groups.length) return <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Load some models to browse their tags</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {groups.map((g) => {
          const picked = g.tags.filter((t) => selectedTags.includes(t.tag)).length;
          return <FChip key={g.group} size="phone" on={open === g.group} onClick={() => setOpen(open === g.group ? null : g.group)}>{g.group}{picked ? ` · ${picked}` : ''}</FChip>;
        })}
      </div>
      {groups.filter((g) => g.group === open).map((g) => (
        <div key={g.group} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 14, background: 'var(--il-panel)' }}>
          {g.tags.map((t) => <FChip key={t.tag} size="phone" on={selectedTags.includes(t.tag)} onClick={() => toggleTag(t.tag)}>{t.tag}<span style={{ opacity: .6, fontSize: 10 }}>{t.count}</span></FChip>)}
        </div>
      ))}
    </div>
  );
}
