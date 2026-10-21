/**
 * The panel's trigger words (a chip per word, tap to copy, the copy icon on hover; "Copy all")
 * and the short About (HTML stripped, folded to 3 lines, item 29). Each renders nothing when the
 * model has nothing to say. Tags live in the folds (PanelFolds).
 */
import { IconCopy } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { stripHtml } from '@/features/model-metadata/civitai';
import { useModelActions } from '~/screens/models/useModelActions';
import { FoldText, Section, TextBtn } from './metaBits';
import './viewer.css';

export function SectionWords({ version }: { version: CivitaiModelVersion | undefined }) {
  const { copy } = useModelActions();
  const words = version?.trainedWords ?? [];
  if (!words.length) return null;
  return (
    <Section title="Trigger words" right={<TextBtn onClick={() => void copy(words.join(', '), 'Trigger words copied')}>Copy all</TextBtn>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {words.map((w) => (
          <button key={w} type="button" className="ilv-row" onClick={() => void copy(w, `“${w}” copied`)} title="Copy" style={{ height: 26, padding: '0 9px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w}</span><IconCopy className="ilv-copy" size={11} stroke={2.2} style={{ flex: 'none' }} />
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
    <Section title="About">
      <FoldText text={desc} lines={3} />
    </Section>
  );
}
