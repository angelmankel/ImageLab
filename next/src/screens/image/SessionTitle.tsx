/**
 * The session's name as an inline-editable title (fix list 36 / 27): one click turns it into a text
 * box in place, Enter or leaving it saves, Esc cancels. Blank is allowed and shows the grey
 * "Untitled session" placeholder (item 20: sessions start without a name). Same on every step.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSteps } from '~/app/stepsStore';
import { UNTITLED } from '~/app/sessionsLogic';

export function SessionTitle({ size = 15, style }: { size?: number; style?: CSSProperties }) {
  const name = useSteps((s) => s.sessionName);
  const rename = useSteps((s) => s.renameSession);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);

  const base: CSSProperties = {
    display: 'block', width: '100%', minWidth: 0, fontSize: size, fontWeight: 800, lineHeight: 1.35, letterSpacing: '-.1px',
    borderRadius: 6, padding: '1px 4px', margin: '0 0 0 -4px', fontFamily: 'inherit', ...style,
  };

  if (editing) {
    const done = (save: boolean) => { if (save) rename(draft); setEditing(false); };
    return (
      <input
        ref={input}
        value={draft}
        placeholder={UNTITLED}
        aria-label="Session name"
        maxLength={80}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') { e.stopPropagation(); done(false); } }}
        onBlur={() => done(true)}
        style={{ ...base, border: 0, outline: '2px solid var(--il-ember)', background: 'var(--il-elev)', color: 'var(--il-fg)' }}
      />
    );
  }
  const blank = !name.trim();
  return (
    <button
      type="button"
      className="il-session-title"
      title="Click to rename this session"
      onClick={() => { setDraft(name); setEditing(true); }}
      style={{
        ...base, border: 0, background: 'transparent', textAlign: 'left', cursor: 'text',
        color: blank ? 'var(--il-dim)' : 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {blank ? UNTITLED : name}
    </button>
  );
}
