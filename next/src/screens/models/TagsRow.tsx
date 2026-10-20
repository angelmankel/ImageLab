/**
 * Tag browsing (models-picker brief, item 4): group chips (Style · Character · Concept · Clothing
 * · Pose · Tool · Base · Most used) built from the loaded models; the open group shows its tags as
 * chips, picked ones ember. `TagGroups` is that block — in the phone's Filters sheet and in the
 * desktop bar's Tags menu (`autoOpen`: a group is always open there). The picked tags are also
 * removable chips in the active-filter line (`SelectedTagChips`).
 */
import { useMemo } from 'react';
import { IconX } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { groupTags } from './tags';
import { useModels } from './modelsStore';
import { FChip, type Size } from './bits';

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

/** Every group stacked: the phone's Filters sheet, the desktop Tags menu (`autoOpen` keeps one group open). */
export function TagGroups({ pool, size = 'phone', autoOpen }: { pool: CivitaiModel[]; size?: Size; autoOpen?: boolean }) {
  const selectedTags = useModels((s) => s.selectedTags);
  const toggleTag = useModels((s) => s.toggleTag);
  const open = useModels((s) => s.tagsOpen);
  const setOpen = useModels((s) => s.setTagsOpen);
  const groups = useMemo(() => groupTags(pool, { limit: size === 'phone' ? 30 : 40, selected: selectedTags }), [pool, selectedTags, size]);
  if (!groups.length) return <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Load some models to browse their tags</span>;
  const shown = autoOpen && !groups.some((g) => g.group === open) ? groups[0].group : open;
  const pick = (g: string) => setOpen(shown === g ? (autoOpen ? g : null) : g);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {groups.map((g) => {
          const picked = g.tags.filter((t) => selectedTags.includes(t.tag)).length;
          return <FChip key={g.group} size={size} on={shown === g.group} onClick={() => pick(g.group)} style={size === 'desktop' && shown !== g.group && picked ? { borderColor: 'var(--il-ember-line)', color: 'var(--il-ember-hi)' } : undefined}>{g.group}{picked ? ` · ${picked}` : ''}</FChip>;
        })}
      </div>
      {groups.filter((g) => g.group === shown).map((g) => (
        <div key={g.group} className={size === 'phone' ? undefined : 'il-scroll'} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 14, background: size === 'phone' ? 'var(--il-panel)' : 'var(--il-bg)', maxHeight: size === 'phone' ? undefined : 220, overflowY: size === 'phone' ? undefined : 'auto' }}>
          {g.tags.map((t) => <FChip key={t.tag} size={size} on={selectedTags.includes(t.tag)} onClick={() => toggleTag(t.tag)}>{t.tag}<span style={{ opacity: .6, fontSize: size === 'phone' ? 10 : 9 }}>{t.count}</span></FChip>)}
        </div>
      ))}
    </div>
  );
}
