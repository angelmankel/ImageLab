/**
 * Rule 14: the log = what the bus heard from this host (`useHostLog`), newest at the bottom,
 * monospace, Copy · Clear. Follows the bottom unless the reader scrolled up.
 */
import { useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { clock, logText, type LogTone } from './comfyHelpers';
import { useComfyLog, useHostLog } from './useComfyHost';

const TONE: Record<LogTone, string> = {
  dim: 'var(--il-dim)', info: 'var(--il-muted)', ok: 'var(--il-ok)', warn: 'var(--il-ember)', err: 'var(--il-err)',
};

function SmallBtn({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ height: 28, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--il-card)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

export function LogBox({ host, fill = true, maxHeight }: { host: string | null; fill?: boolean; maxHeight?: number }) {
  const lines = useHostLog(host);
  const clear = useComfyLog((s) => s.clear);
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(logText(lines)); notifications.show({ message: 'Log copied' }); }
    catch { notifications.show({ color: 'red', message: 'Could not copy the log' }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: fill ? 1 : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Log</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <SmallBtn onClick={() => void copy()}>Copy</SmallBtn>
          <SmallBtn onClick={() => { if (host) clear(host); }}>Clear</SmallBtn>
        </div>
      </div>
      <div
        ref={boxRef}
        className="il-scroll"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
        style={{
          flex: fill ? 1 : undefined, minHeight: fill ? 0 : 120, maxHeight, padding: '10px 12px', borderRadius: 16, background: 'var(--il-bg)',
          border: '1px solid var(--il-line)', overflowX: 'auto', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, lineHeight: 1.7,
          color: 'var(--il-muted)', whiteSpace: 'nowrap', touchAction: 'pan-y',
        }}
      >
        {lines.map((l, i) => (
          <div key={`${l.at}-${i}`} style={{ color: TONE[l.tone] }}>[{clock(l.at)}] {l.text}</div>
        ))}
        {!lines.length && <div style={{ color: 'var(--il-dim)' }}>{host ? 'Waiting for ComfyUI…' : 'No server.'}</div>}
      </div>
    </div>
  );
}
