/**
 * Trigger words as tap-to-add chips (rule 4): "+ word" puts the word into the prompt, "✓ word"
 * means it is there, a second tap takes it out. The prompt is the main app's first positive layer
 * (`useStore().layers`, the same text the Prompt tab edits). "Auto" is the main app's per-model
 * keyword switch (`workflow.modelKeywords`): when on, every trigger word joins the prompt at
 * generate time without being in the text; tapping a word turns it off so nothing doubles.
 */
import { Chip } from '~/ui';
import { useStore } from '@/lib/store';
import { hasWord, toggleWord } from './promptWords';

export interface AutoWords { on: boolean; set: (on: boolean) => void }

export function TriggerWords({ words, auto, title = 'Trigger words · tap to add to the prompt' }: {
  words: string[]; auto?: AutoWords; title?: string;
}) {
  const layers = useStore((s) => s.layers);
  const main = layers.find((l) => l.kind === 'positive');
  const text = main?.text ?? '';
  if (!words.length) return null;

  const tap = (word: string) => {
    const st = useStore.getState();
    const cur = st.layers.find((l) => l.kind === 'positive');
    const next = toggleWord(cur?.text ?? '', word);
    if (cur) st.updateLayer(cur.id, { text: next });
    else st.addLayer('positive', { text: next });
    if (auto?.on) auto.set(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{title}</span>
        {auto && (
          <Chip small on={auto.on} onClick={() => auto.set(!auto.on)} title={auto.on ? 'All of them join the prompt at generate time. Tap to manage them by hand.' : 'Tap to add all of them at generate time.'}>
            {auto.on ? '✓ Auto' : 'Auto'}
          </Chip>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {words.map((w) => {
          const on = hasWord(text, w);
          return <Chip key={w} on={on} onClick={() => tap(w)} title={on ? 'In the prompt · tap to take out' : 'Tap to add to the prompt'}>{on ? '✓' : '+'} {w}</Chip>;
        })}
      </div>
    </div>
  );
}
