/**
 * Items 12 + 13 (and 39: workflow steps use it too): the prompt card. Two tabs on its top edge —
 * Prompt / Negative (with how many parts the negative has) — switch the ONE smart box between the
 * two texts. Negative mode cannot be missed: the card turns red-tinted with a red top edge, the
 * tab fills red, an "AVOIDING" badge shows, the caret and selection go red. Under the box: the
 * caller's tools (Write it, Starters…) and the clear button. Pure view: the texts come in as props.
 */
import type { ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { Button } from '~/ui';
import { sectionCount } from './promptSections';
import { SmartPromptBox } from './SmartPromptBox';
import type { Tiles } from './useTiles';

export interface PromptText { value: string; onChange: (t: string) => void; onBlur?: () => void }

export function PromptCard({ positive, negative, negativeMode, onMode, tiles, tools, onClear, large = false, onSaveAsSnippet, placeholder }: {
  positive: PromptText;
  /** Leave out when the step has no negative prompt: the tabs go too. */
  negative?: PromptText;
  negativeMode: boolean;
  onMode: (negative: boolean) => void;
  tiles: Tiles;
  tools?: ReactNode;
  onClear?: (negative: boolean) => void;
  large?: boolean;
  onSaveAsSnippet?: (text: string) => void;
  placeholder?: string;
}) {
  const phone = useIsPhone();
  const neg = negativeMode && !!negative;
  const cur = neg ? negative! : positive;
  const negCount = negative ? sectionCount(negative.value) : 0;
  const tabH = phone ? 40 : 30;

  const tab = (isNeg: boolean, label: ReactNode) => {
    const on = isNeg === neg;
    return (
      <button type="button" role="tab" aria-selected={on} onClick={() => onMode(isNeg)}
        style={{
          height: tabH, padding: '0 12px', border: 0, borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 800,
          background: on ? (isNeg ? 'var(--il-err)' : 'var(--il-card-on)') : 'transparent',
          color: on ? (isNeg ? 'var(--il-bg)' : 'var(--il-fg)') : 'var(--il-muted)',
        }}>{label}</button>
    );
  };

  return (
    <div style={{
      borderRadius: 16, padding: '0 0 10px', position: 'relative', transition: 'background-color .15s ease, border-color .15s ease',
      background: neg ? 'color-mix(in srgb, var(--il-err) 9%, var(--il-card))' : 'var(--il-card)',
      border: `1px solid ${neg ? 'color-mix(in srgb, var(--il-err) 40%, transparent)' : 'transparent'}`,
      boxShadow: neg ? 'inset 0 3px 0 var(--il-err)' : undefined,
    }}>
      {negative && (
        <div role="tablist" aria-label="Prompt or negative prompt" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px 0' }}>
          {tab(false, 'Prompt')}
          {tab(true, <>Negative{negCount > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: neg ? 'rgba(0,0,0,.22)' : 'var(--il-line-soft)', color: neg ? 'var(--il-bg)' : 'var(--il-muted)' }}>{negCount}</span>}</>)}
          {neg && <span style={{ marginLeft: 'auto', paddingRight: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.6px', color: 'color-mix(in srgb, var(--il-err) 70%, white)' }}>AVOIDING</span>}
        </div>
      )}
      <div style={{ padding: '8px 12px 0' }}>
        <SmartPromptBox
          key={neg ? 'neg' : 'pos'}
          kind={neg ? 'negative' : 'positive'}
          value={cur.value}
          onChange={cur.onChange}
          onBlur={cur.onBlur}
          snippets={neg ? tiles.negative : tiles.positive}
          categoryNames={tiles.categoryNames}
          placeholder={neg ? 'What to keep out… blurry, lowres, extra fingers' : placeholder ?? 'What do you want to see?  Type / for snippets'}
          minRows={large ? 5 : 4}
          large={large}
          onSaveAsSnippet={neg ? undefined : onSaveAsSnippet}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 0' }}>
        {tools}
        <div style={{ flex: 1 }} />
        {onClear && <Button tone="card" size={phone ? 'lg' : 'sm'} icon={<IconX size={14} stroke={2.4} />} tooltip={neg ? 'Clear the negative prompt' : 'Clear the prompt'} disabled={!cur.value.trim()} onClick={() => onClear(neg)} />}
      </div>
    </div>
  );
}
