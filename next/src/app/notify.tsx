/**
 * The app's two ways to tell the user something (fix list 2, item 12: far fewer toasts).
 *
 *   notifyError('Download failed', err)   a TOAST, only for critical errors that need action: a job
 *                                         failed, server offline, download / upload / save failed,
 *                                         a missing node or model. A plain sentence (`humanError`),
 *                                         the raw text behind "Details".
 *   say('Copied')                         everything else: a short line in the footer's status spot
 *                                         for a few seconds (`useSaid`), never a toast. `tone: 'warn'`
 *                                         for "that did nothing because …" (on a phone, which has no
 *                                         footer, a warn becomes a small toast so it is not lost).
 *
 * Undo is never a toast: push it to `~/app/undo`.
 */
import { useState } from 'react';
import { create } from 'zustand';
import { notifications } from '@mantine/notifications';
import { humanError } from './notifyLogic';

export { humanError, rawError } from './notifyLogic';

let seq = 0;

function ErrorBody({ text, detail }: { text: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {text && <span>{text}</span>}
      {detail && (
        <button type="button" onClick={() => setOpen(!open)}
          style={{ alignSelf: 'flex-start', border: 0, padding: 0, background: 'transparent', color: 'var(--il-muted)', font: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {open ? 'Hide details' : 'Details'}
        </button>
      )}
      {open && detail && (
        <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, color: 'var(--il-fg2)', userSelect: 'text' }}>{detail}</pre>
      )}
    </div>
  );
}

/**
 * A critical error toast: `title` = what failed ("Download failed"), `err` = what was thrown / the
 * server's text. `hint` = your own plain sentence (else one is read from `err`); `sticky` = stays until closed.
 */
export function notifyError(title: string, err?: unknown, opts: { id?: string; hint?: string; sticky?: boolean } = {}): void {
  const h = humanError(err);
  const text = opts.hint ?? h.text;
  const detail = opts.hint ? (h.detail || h.text) : h.detail;
  const id = opts.id ?? `il-err-${++seq}`;
  notifications.show({ id, color: 'red', title, message: text || detail ? <ErrorBody text={text} detail={detail} /> : '', autoClose: opts.sticky ? false : 8000 });
}

export type SayTone = 'ok' | 'warn' | 'busy';
interface Said { text: string; tone: SayTone; seq: number }

/** The footer's status line (`Footer.tsx` renders it). */
export const useSaid = create<Said>(() => ({ text: '', tone: 'ok', seq: 0 }));

let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** A routine confirmation or a soft warning, in the footer (not a toast). `busy` stays until the next `say`. */
export function say(text: string, opts: { tone?: SayTone; ms?: number } = {}): void {
  const tone = opts.tone ?? 'ok';
  const n = useSaid.getState().seq + 1;
  useSaid.setState({ text, tone, seq: n });
  clearTimeout(clearTimer);
  if (tone !== 'busy') clearTimer = setTimeout(() => { if (useSaid.getState().seq === n) useSaid.setState({ text: '' }); }, opts.ms ?? (tone === 'warn' ? 4000 : 2500));
  // The phone shows say() in its band (phone/nav/Band) — no toast.
}

/** Clear a `busy` line (or any). */
export function unsay(): void {
  useSaid.setState({ text: '' });
}
