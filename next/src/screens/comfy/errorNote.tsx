/**
 * FIXLIST-2 #50 (+ #12 toast rule): an error that needs attention, said in plain words, with the
 * raw exception folded away under "Details" for when Donny wants it. Stays until closed.
 */
import { useState } from 'react';
import { notifications } from '@mantine/notifications';

function Details({ text, hint }: { text: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {hint && <span style={{ fontWeight: 600 }}>{hint}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ alignSelf: 'flex-start', border: 0, padding: 0, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
      >
        {open ? 'Hide details' : 'Details'}
      </button>
      {open && (
        <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.4, color: 'var(--il-fg2)', background: 'var(--il-card)', borderRadius: 8, padding: '6px 8px', maxHeight: 160, overflow: 'auto', userSelect: 'text' }}>
          {text}
        </code>
      )}
    </span>
  );
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name && err.name !== 'Error' ? `${err.name}: ` : ''}${err.message}`;
  return String(err);
}

/** Red note: `title` in plain words, optional one-line `hint`, the raw error under Details. */
export function errorNote(title: string, err: unknown, hint?: string): void {
  notifications.show({ color: 'red', title, autoClose: false, message: <Details text={errorText(err)} hint={hint} /> });
}
