/**
 * Section 4 — Trigger words: a copyable chip per word, "Copy all" at the right. Section 5 —
 * Description (HTML stripped, folded to 6 lines). Section 6 — Tags (shown, not filters).
 * Three small sections that each render nothing when the model has nothing to say.
 */
import { IconCopy } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { stripHtml } from '@/features/model-metadata/civitai';
import { Tag } from '~/screens/models/bits';
import { useModelActions } from '~/screens/models/useModelActions';
import { FoldText, Section, TextBtn } from './metaBits';

export function SectionWords({ version }: { version: CivitaiModelVersion | undefined }) {
  const { copy } = useModelActions();
  const words = version?.trainedWords ?? [];
  if (!words.length) return null;
  return (
    <Section title="Trigger words" right={<TextBtn onClick={() => void copy(words.join(', '), 'Trigger words copied')}>Copy all</TextBtn>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {words.map((w) => (
          <button key={w} type="button" onClick={() => void copy(w, `“${w}” copied`)} title="Copy" style={{ height: 26, padding: '0 9px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w}</span><IconCopy size={11} stroke={2.2} style={{ flex: 'none', opacity: .7 }} />
          </button>
        ))}
      </div>
    </Section>
  );
}

export function SectionDescription({ model }: { model: CivitaiModel }) {
  const desc = stripHtml(model.description).trim();
  if (!desc) return null;
  return (
    <Section title="Description">
      <FoldText text={desc} lines={6} />
    </Section>
  );
}

export function SectionTags({ model }: { model: CivitaiModel }) {
  const tags = model.tags ?? [];
  if (!tags.length) return null;
  return (
    <Section title="Tags">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {tags.map((t) => <Tag key={t} tone="muted">{t}</Tag>)}
      </div>
    </Section>
  );
}
