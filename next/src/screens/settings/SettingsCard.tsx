/**
 * One settings section in the Ember look: a `ui/Card` with a title and a one-line description,
 * then its rows (gap 8, rule 10). `Field` is a labelled row for a Mantine input.
 */
import type { ReactNode } from 'react';
import { Card } from '~/ui';

export function SettingsCard({ title, description, children, right }: { title: string; description?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10, breakInside: 'avoid', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
          {description && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', marginTop: 2, lineHeight: 1.45 }}>{description}</div>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.45 }}>{hint}</span>}
    </div>
  );
}

/** Mantine input styles that sit on a card: elev background, strong hairline, 12 radius. */
export const inputStyles = {
  input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 600 },
} as const;

export const monoInputStyles = {
  input: { ...inputStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 },
} as const;
