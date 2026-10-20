/**
 * Rule 6: the Prompt tab. The prompt box; Write it (LLM) · Library · Clear; snippet chips (tap to
 * add); Style thumbs; the Negative prompt as one folding card (header: icon, name, a short
 * reading of what it avoids, chevron; open: the box and the negative snippets inside the card). The text binds to the main
 * store's prompt layers (`usePromptText`), so the job gets exactly what the old app would.
 */
import { useState } from 'react';
import { IconBan, IconChevronDown, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { aiReady } from '@/lib/venice';
import { usePromptText } from './usePromptText';
import { SnippetRow } from './SnippetRow';
import { StyleRow } from './StyleRow';
import { WriteItModal } from './WriteItModal';
import { LibraryModal } from './LibraryModal';

const btn = (accent: boolean): React.CSSProperties => ({ height: 34, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: accent ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' });

export function PromptTab({ large = false }: { large?: boolean }) {
  const prompt = usePromptText('positive');
  const negative = usePromptText('negative');
  const venice = useStore((s) => s.venice);
  const [writing, setWriting] = useState(false);
  const [library, setLibrary] = useState(false);
  const [negOpen, setNegOpen] = useState(false);
  const extraParts = useStore((s) => s.layers.filter((l) => l.kind === 'positive' && l.on && l.text.trim()).length - 1);

  return (
    <>
      <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '10px 12px 10px' }}>
        <textarea aria-label="Prompt" rows={large ? 5 : 6} value={prompt.text} onChange={(e) => prompt.set(e.target.value)} onBlur={prompt.flush}
          placeholder="What do you want to see?"
          style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 15, lineHeight: 1.5, resize: 'none', outline: 'none', padding: 0, display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => { prompt.flush(); setWriting(true); }} style={btn(true)} title={aiReady(venice) ? 'Let the AI write the prompt' : 'Set up the AI helper in Settings to write prompts'}>✦ Write it</button>
          <button type="button" onClick={() => { prompt.flush(); setLibrary(true); }} style={btn(false)}>Library</button>
          {extraParts > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }} title="More prompt parts are on (snippets, style, written parts)">+{extraParts} part{extraParts === 1 ? '' : 's'}</span>}
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="Clear prompt" onClick={() => { prompt.clear(); }} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={14} stroke={2.4} /></button>
        </div>
      </div>
      <SnippetRow kind="positive" />
      <StyleRow />
      <div style={{ background: 'var(--il-card)', borderRadius: 16, overflow: 'hidden' }}>
        <button type="button" onClick={() => setNegOpen((v) => !v)} aria-expanded={negOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 48, padding: '0 12px 0 14px', border: 0, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
          <IconBan size={16} stroke={2.2} style={{ color: 'var(--il-muted)', flex: 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 800, flex: 'none' }}>Negative prompt</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', opacity: negOpen ? 0 : 1 }}>
            {negative.text.trim() || 'nothing to avoid yet'}
          </span>
          <IconChevronDown size={16} stroke={2.4} style={{ color: 'var(--il-muted)', flex: 'none', transform: negOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
        </button>
        {negOpen && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative', background: 'var(--il-bg-deep)', borderRadius: 12, padding: '10px 40px 10px 12px' }}>
              <textarea aria-label="Negative prompt" rows={3} value={negative.text} onChange={(e) => negative.set(e.target.value)} onBlur={negative.flush} placeholder="blurry, lowres, extra fingers…"
                style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, resize: 'none', outline: 'none', padding: 0, display: 'block' }} />
              {negative.text.trim() && (
                <button type="button" aria-label="Clear negative prompt" onClick={negative.clear} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.4} /></button>
              )}
            </div>
            <div style={{ height: 1, background: 'var(--il-line-soft)' }} />
            <SnippetRow kind="negative" />
          </div>
        )}
      </div>
      <WriteItModal opened={writing} onClose={() => setWriting(false)} />
      <LibraryModal opened={library} onClose={() => setLibrary(false)} />
    </>
  );
}
