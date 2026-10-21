/**
 * One setting as a row: label + short hint on the left, the control on the right, a hairline
 * between rows; `wide` rows (lists, sliders) put the control under the label, and on the phone
 * every non-compact control stacks too. `Mark` lights the search hits; `RowGroup` is the small
 * titled group a long category uses.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import type { SettingDef } from './categories';
import { CTL_WIDTH } from './inputs';
import { highlight } from './settingsLogic';
import { Collapse } from '~/ui';

export function Mark({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  return (
    <>
      {highlight(text, query).map((s, i) => s.hit
        ? <mark key={i} style={{ background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', borderRadius: 3, padding: '0 1px' }}>{s.text}</mark>
        : <span key={i}>{s.text}</span>)}
    </>
  );
}

/** `control` renders in place of `def.Control` (a page built from static defs, like a provider's);
 *  `disabled` dims the row and says why in the hint. */
export function SettingRow({ def, query, first, control, disabled }: { def: SettingDef; query?: string; first?: boolean; control?: ReactNode; disabled?: boolean }) {
  const phone = useIsPhone();
  const stacked = def.wide || (phone && !def.compact);
  const { Control, Value } = def;
  return (
    <div
      role="group"
      aria-label={def.label}
      data-setting={def.id}
      style={{
        display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', gap: stacked ? T.gap.md : T.gap.xl,
        padding: '11px 0', borderTop: first ? 0 : '1px solid var(--il-line)', opacity: disabled ? 0.45 : 1,
      }}
      aria-disabled={disabled || undefined}
    >
      <div style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--il-fg)' }}><Mark text={def.label} query={query} /></span>
          {stacked && Value && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}><Value /></span>}
        </div>
        {(def.hint || def.links) && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.45, marginTop: 2 }}>
            {def.hint && <Mark text={def.hint} query={query} />}
            {def.links?.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: 'var(--il-ember)', textDecoration: 'none', fontWeight: 700 }}>{l.text}</a>
            ))}
          </div>
        )}
      </div>
      <div style={{
        flex: 'none', minWidth: 0, width: stacked ? '100%' : undefined, maxWidth: stacked ? undefined : '58%',
        display: 'flex', justifyContent: stacked ? 'flex-start' : 'flex-end',
        ['--il-ctl-w' as string]: stacked ? '100%' : `${CTL_WIDTH}px`,
      } as CSSProperties}>
        {control ?? <Control />}
      </div>
    </div>
  );
}

/** A small titled group of rows ("Provider", "Venice", "Local LLM"). */
export function RowGroup({ title, children }: { title?: string; children: ReactNode }) {
  // A titled group (a long category) folds under the shared low-profile header (item 7), remembered per group.
  if (!title) return <section style={{ marginBottom: 18 }}>{children}</section>;
  return (
    <section style={{ marginBottom: 18 }}>
      <Collapse id={`settings.${title}`} label={title} gap={0} headerStyle={{ borderBottom: '1px solid var(--il-line-strong)' }}>{children}</Collapse>
    </section>
  );
}
